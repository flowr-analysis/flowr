import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { executeLinterQuery } from '../../../src/queries/catalog/linter-query/linter-query-executor';
import type { LintingRuleNames } from '../../../src/linter/linter-rules';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';

describe('flowR linter', withTreeSitter(parser => {
	describe('active by default', () => {
		async function runLinter(rules: LintingRuleNames[] | undefined) {
			const analyzer = await new FlowrAnalyzerBuilder()
				.setParser(parser)
				.build();
			analyzer.addRequest('my_Var <- 5\nmyVar <- 6\n');
			const result = await executeLinterQuery({ analyzer }, [{ type: 'linter', rules }]);
			return Object.keys(result.results);
		}

		test('no explicit rules skips naming-convention', async() => {
			const keys = await runLinter(undefined);
			assert.isFalse(keys.includes('naming-convention'), `expected naming-convention to be skipped, got ${keys.join(', ')}`);
		});

		test('explicit rules include naming-convention', async() => {
			const keys = await runLinter(['naming-convention']);
			assert.deepEqual(keys, ['naming-convention']);
		});
	});

	describe('project-kind specialization', () => {
		async function defaultRuleKeys(description?: string): Promise<string[]> {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			if(description) {
				analyzer.addFile(new FlowrInlineTextFile('/project/DESCRIPTION', description));
			}
			analyzer.addRequest('cat("hello")');
			return Object.keys((await executeLinterQuery({ analyzer }, [{ type: 'linter' }])).results);
		}

		test('a lone script has the software-has-license/-tests rules disabled by default', async() => {
			const keys = await defaultRuleKeys();
			assert.isFalse(keys.includes('software-has-license'), `got ${keys.join(', ')}`);
			assert.isFalse(keys.includes('software-has-tests'), `got ${keys.join(', ')}`);
		});

		test('a package project runs the software-has-license/-tests rules by default', async() => {
			const keys = await defaultRuleKeys('Package: Foo\nVersion: 1.0\n');
			assert.isTrue(keys.includes('software-has-license'), `got ${keys.join(', ')}`);
			assert.isTrue(keys.includes('software-has-tests'), `got ${keys.join(', ')}`);
		});

		test('explicitly requested rules always run, even a config-disabled one on a script', async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest('cat("hello")');
			const rules: LintingRuleNames[] = ['software-has-license', 'software-has-tests'];
			const result = await executeLinterQuery({ analyzer }, [{ type: 'linter', rules }]);
			assert.deepEqual(Object.keys(result.results).sort(), [...rules].sort());
		});
	});
}));
