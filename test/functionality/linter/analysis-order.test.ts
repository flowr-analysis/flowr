import { afterAll, assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { LintingRules, type LintingRuleNames } from '../../../src/linter/linter-rules';
import { withTreeSitter } from '../_helper/shell';

/** a small package, placed below a `test` folder that must not make all of its files tests */
const Package: Record<string, string> = {
	DESCRIPTION:               'Package: demo\nVersion: 1.0\nTitle: Demo\nLicense: MIT\nImports: methods\n',
	NAMESPACE:                 'export(greet, tau, only_in_tests)\nexportMethods(sin, Math, "+")\nexportClasses(float32)\nS3method(print, greeter)\nimportFrom(methods, setClass)\n',
	'R/code.R':                'greet <- function(name) paste("Hello", name)\ntau <- 2 * pi\nprint.greeter <- function(x, ...) cat(x$name)\nsetClass("float32", representation(x = "numeric"))\nsetMethod("Math", "float32", function(x) x)\n',
	'tests/testthat.R':        'library(testthat)\nlibrary(demo)\ntest_check("demo")\n',
	'tests/testthat/test-a.R': 'only_in_tests <- function() 1\ntest_that("greets", expect_equal(greet("a"), "Hello a"))\n'
};

describe('Linter results do not depend on what ran before', withTreeSitter(parser => {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-order-'));
	const root = path.join(base, 'test', 'fixture', 'demo');
	for(const [file, content] of Object.entries(Package)) {
		fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), content);
	}
	afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

	async function lint(before: 'nothing' | 'parse' | 'dataflow') {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest({ request: 'project', content: root });
		if(before !== 'nothing') {
			await analyzer[before]();
		}
		const { results } = (await analyzer.query({ type: 'linter' }));
		return Object.fromEntries(Object.entries(results).map(([rule, r]) => [rule, JSON.parse(JSON.stringify(r, (k, v: unknown) => k === '.meta' ? undefined : v)) as unknown]));
	}
	const fresh = lint('nothing');

	test('the package code is no test code, but the test code is', async() => {
		const runtime = (await fresh)['package-runtime'] as { results: { message: string }[] };
		assert.deepStrictEqual(runtime.results.map(r => r.message), ['undefined export: \'only_in_tests\', installing the package fails']);
	});
	test.each(['parse', 'dataflow'] as const)('after a prior %s', async before => {
		const [expected, actual] = [await fresh, await lint(before)];
		for(const rule of Object.keys(LintingRules) as LintingRuleNames[]) {
			assert.deepStrictEqual(actual[rule], expected[rule], `${rule} changes with a prior ${before}`);
		}
	});
}));
