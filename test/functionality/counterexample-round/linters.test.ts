import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import type { KnownParser } from '../../../src/r-bridge/parser';
import type { LintingRuleNames } from '../../../src/linter/linter-rules';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { executeLintingRule } from '../../../src/linter/linter-executor';
import { LintingResults } from '../../../src/linter/linter-format';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { DropPathsOption } from '../../../src/config';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';

/** asserts that the rule reports exactly the given number of findings, each containing the given fields */
function assertFindings(parser: KnownParser, code: string, rule: LintingRuleNames, expected: Record<string, unknown>[], files: string[] = []) {
	test(`${rule}: ${JSON.stringify(code)}`, async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setInput({ getId: deterministicCountingIdGenerator(0) }).setParser(parser)
			.configure('solver.resolveSource.dropPaths', DropPathsOption.All).build();
		if(files.length > 0) {
			analyzer.addFile(...files.map(f => new FlowrInlineTextFile(f, '')));
		}
		analyzer.addRequest(requestFromInput(code));
		const results = LintingResults.unpackSuccess(await executeLintingRule(rule, analyzer)).results as unknown as Record<string, unknown>[];
		assert.strictEqual(results.length, expected.length, JSON.stringify(results));
		expected.forEach((e, i) => {
			for(const [k, v] of Object.entries(e)) {
				assert.deepEqual(results[i][k], v, JSON.stringify(results));
			}
		});
	});
}

describe('counterexample round: linters', withTreeSitter(parser => {
	describe('file-path-validity', () => {
		/* R: the native pipe reads missing.csv and warns "cannot open file" */
		assertFindings(parser, '"missing.csv" |> read.csv()', 'file-path-validity', [{ filePath: 'missing.csv' }]);
		/* R: after setwd("sub") the relative a.csv resolves to sub/a.csv, which does not exist */
		assertFindings(parser, 'setwd("sub")\nread.csv("a.csv")', 'file-path-validity', [{ filePath: 'a.csv' }], ['a.csv']);
		assertFindings(parser, 'setwd("sub")\ndata("rat")', 'file-path-validity', [{ filePath: 'data/rat' }], ['data/rat.rda']);
		/* R: "data set 'rat' not found", the namespaced call and the second data set are checked just the same */
		assertFindings(parser, 'utils::data("rat")', 'file-path-validity', [{ filePath: 'data/rat' }]);
		assertFindings(parser, 'data("iris", "rat")', 'file-path-validity', [{ filePath: 'data/rat' }]);
		/* R: these calls create the file, so the read succeeds */
		assertFindings(parser, 'file.create("o.txt")\nreadLines("o.txt")', 'file-path-validity', []);
		assertFindings(parser, 'download.file("https://x.org", "o.csv")\nread.csv("o.csv")', 'file-path-validity', []);
		assertFindings(parser, 'file.copy("a.csv", "o.csv")\nread.csv("o.csv")', 'file-path-validity', [], ['a.csv']);
	});

	describe('network-functions', () => {
		assertFindings(parser, '"https://x.org/a.csv" |> read.csv()', 'network-functions', [{ function: 'utils::read.csv' }]);
	});

	describe('problematic-inputs', () => {
		/* R: pdf(title = "|x", "out.pdf") writes out.pdf, the title is no pipe */
		assertLinter('title is no file', parser, 'pdf(title = "|x", "out.pdf")', 'problematic-inputs', []);
		/* R: the unnamed argument binds `file`, pdf(width = 7, "|cat > piped.pdf") runs the command */
		assertFindings(parser, 'pdf(width = 7, "|lp")', 'problematic-inputs', [{ pipeCommand: '|lp' }]);
		assertFindings(parser, 'postscript(horizontal = FALSE, "|lp")', 'problematic-inputs', [{ pipeCommand: '|lp' }]);
	});

	describe('seeded-randomness', () => {
		/* R: withr::with_seed(1, runif(1)) yields the same value every time */
		assertLinter('with_seed seeds', parser, 'withr::with_seed(1, runif(1))', 'seeded-randomness', []);
		assertFindings(parser, 'stats::runif(1)', 'seeded-randomness', [{ certainty: 'certain' }]);
		assertFindings(parser, 'base::sample(3)', 'seeded-randomness', [{ certainty: 'certain' }]);
	});

	describe('undefined-symbol', () => {
		/* R: data("rat") and data(list = "rat") define rat just like data(rat) */
		assertFindings(parser, 'data("rat")\nprint(rat)', 'undefined-symbol', [], ['data/rat.R']);
		assertFindings(parser, 'data(list = "rat")\nprint(rat)', 'undefined-symbol', [], ['data/rat.R']);
	});

	describe('roxygen-arguments', () => {
		/* roxygen2::parse_text gives the param name `a b` */
		assertLinter('backticked param', parser, '#\' @param `a b` x\nf <- function(`a b`) 1', 'roxygen-arguments', []);
		/* roxygen2 reads ##' blocks as well */
		assertFindings(parser, '##\' @param b x\nf <- function(a) a', 'roxygen-arguments', [{ underDocumented: ['a'], overDocumented: ['b'] }]);
	});
}));
