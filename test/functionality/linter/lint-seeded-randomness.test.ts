import { assert, describe, test } from 'vitest';
import { assertLinter, controlledSigDb } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { LintingResultCertainty, LintingResults } from '../../../src/linter/linter-format';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { executeLintingRule } from '../../../src/linter/linter-executor';
import type { BuiltInDefinitions } from '../../../src/dataflow/environments/built-in-config';
import { BuiltInProcName } from '../../../src/dataflow/environments/built-in-proc-name';
import { ArgProp, SemanticCallTag } from '../../../src/dataflow/environments/built-in-props';
import { Identifier } from '../../../src/dataflow/environments/identifier';

describe('flowR linter', withTreeSitter(parser => {
	describe('R3 seeded randomness', () => {
		describe('simple', () => {
			assertLinter('none', parser, 'cat("hello")', 'seeded-randomness', [], { consumerCalls: 0, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('no producer', parser, 'runif(1)', 'seeded-randomness',
				[{ loc: [1, 1, 1, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('no consumer', parser, 'set.seed(17)', 'seeded-randomness', [], { consumerCalls: 0, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('both', parser, 'set.seed(17)\nrunif(1)', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('after', parser, 'runif(1)\nset.seed(17)', 'seeded-randomness',
				[{ loc: [1, 1, 1, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });

			assertLinter('multiple seeds', parser, 'set.seed(1);\nset.seed(2);\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('multiple consumers', parser, 'set.seed(1);\nset.seed(2);\nrunif(1);\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 2, callsWithFunctionProducers: 2, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
		});

		describe('a consumer resolved via a loaded package is still flagged', () => {
			// regression: the loaded-package export must still count as a built-in call target
			assertLinter('with a (controlled) package database', parser, 'library(stats)\nrunif(1)', 'seeded-randomness',
				[{ loc: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Certain }],
				{ consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 },
				{ sigDb: controlledSigDb('stats', ['runif']) });
			assertLinter('without any package database', parser, 'library(stats)\nrunif(1)', 'seeded-randomness',
				[{ loc: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Certain }],
				{ consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 },
				{ noSigDb: true });
		});

		describe('loops', () => {
			assertLinter('invalid', parser, 'for(i in 1:10) { runif(1); }', 'seeded-randomness',
				[{ loc: [1, 18, 1, 25], function: 'runif', certainty: LintingResultCertainty.Certain }]);
			assertLinter('valid', parser, 'for(i in 1:10) { set.seed(17); runif(1); }', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
		});

		describe('conditions', () => {
			assertLinter('both false', parser, 'if(FALSE) { set.seed(17); \nrunif(1); }', 'seeded-randomness', [], { consumerCalls: 0, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('both true', parser, 'if(TRUE) { set.seed(17); \nrunif(1); }', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('false', parser, 'if(FALSE) { set.seed(17); }\nrunif(1);', 'seeded-randomness',
				[{ loc: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('true', parser, 'if(TRUE) { set.seed(17); }\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('unclear', parser, 'if(u) { set.seed(17); }\nrunif(1);', 'seeded-randomness',
				[{ loc: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Uncertain }], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 1 });
			assertLinter('unclear', parser, 'if(u) {} else { set.seed(17); }\nrunif(1);', 'seeded-randomness',
				[{ loc: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Uncertain }], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 1 });
			assertLinter('unclear after definite seed', parser, 'set.seed(17); if(u) { set.seed(17); }\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('exhaustive', parser, 'if(u) { set.seed(17); } else { set.seed(18); }\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 2, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('reversed', parser, 'set.seed(17);\nif(u) { runif(1) }', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('separate', parser, 'if (u) { set.seed(17) }; if (u) { runif(1) }', 'seeded-randomness',
				[{ loc: [1, 35, 1, 42], function: 'runif', certainty: LintingResultCertainty.Uncertain }], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 1 });
			assertLinter('nested true', parser, 'if(TRUE) { if(TRUE) { set.seed(17); }\nrunif(1); }', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('nested producer false', parser, 'if(TRUE) { if(FALSE) { set.seed(17); }\nrunif(1); }', 'seeded-randomness',
				[{ loc: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('nested consumer', parser, 'if(a) {set.seed(17); if(b) { runif(1); } }', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
		});

		describe('seed assignment', () => {
			assertLinter('set .Random.seed', parser, '.Random.seed <- 17\nrunif(1)', 'seeded-randomness', [],
				{ consumerCalls: 1, callsWithAssignmentProducers: 1, callsWithFunctionProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('set .Random.seed with assignment inbetween', parser, '.Random.seed <- 17\nx <- 7 \nrunif(1)', 'seeded-randomness', [],
				{ consumerCalls: 1, callsWithAssignmentProducers: 1, callsWithFunctionProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('set .Random.seed reverse', parser, '17 -> .Random.seed\nrunif(1)', 'seeded-randomness', [],
				{ consumerCalls: 1, callsWithAssignmentProducers: 1, callsWithFunctionProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('set .Random.seed override <-', parser, '`<-`<-function(){}\n.Random.seed <- 17\nrunif(1)', 'seeded-randomness',
				[{ loc: [3, 1, 3, 8], function: 'runif', certainty: LintingResultCertainty.Certain }],
				{ consumerCalls: 1, callsWithAssignmentProducers: 0, callsWithFunctionProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
		});

		assertLinter('seed a local folds to', parser, 'num<-1 + 7;\nset.seed(num);\nrunif(1);', 'seeded-randomness', [],
			{ consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
		assertLinter('non-constant seed', parser, 'num<-as.numeric(Sys.time());\nset.seed(num);\nrunif(1);', 'seeded-randomness', [
			{ loc: [3, 1, 3, 8], function: 'runif', certainty: LintingResultCertainty.Certain }
		], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 1, callsWithOtherBranchProducers: 0 });
		assertLinter('random seed', parser, 'set.seed(runif(1));\nrunif(1);', 'seeded-randomness', [
			{ loc: [1, 10, 1, 17], function: 'runif', certainty: LintingResultCertainty.Certain },
			{ loc: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Certain }
			/* the `runif` inside the seed runs before the seed is set, so only the one after it has a producer */
		], { consumerCalls: 2, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 1, callsWithOtherBranchProducers: 0 });

		assertLinter('custom set.seed', parser, 'set.seed <- function(x) {}\nset.seed(17)\nrunif(1)', 'seeded-randomness',
			[{ loc: [3, 1, 3, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });

		assertLinter('set in function call', parser, 'runif(set.seed(17))', 'seeded-randomness',
			[{ loc: [1, 1, 1, 19], function: 'runif', certainty: LintingResultCertainty.Certain }]);
		assertLinter('get in function call', parser, 'runif(runif(1))', 'seeded-randomness', [
			{ loc: [1, 7, 1, 14], function: 'runif', certainty: LintingResultCertainty.Certain },
			{ loc: [1, 1, 1, 15], function: 'runif', certainty: LintingResultCertainty.Certain }]);
		describe('a configured built-in reaches the rule defaults', () => {
			const definitions: BuiltInDefinitions = [{
				type:            'function',
				names:           [Identifier.from(['rollIt', 'base'])],
				processor:       BuiltInProcName.Default,
				config:          { tags: [SemanticCallTag.Random], sig: [['n', ArgProp.Forced | ArgProp.Value]] },
				assumePrimitive: false
			}];
			test('a `Random` built-in only the config states is an unseeded consumer', async() => {
				const analyzer = await new FlowrAnalyzerBuilder()
					.setParser(parser)
					.amendConfig(c => {
						c.semantics.environment.overwriteBuiltIns.definitions = definitions;
					})
					.build();
				analyzer.addRequest('rollIt(1)');
				const found = LintingResults.unpackSuccess(await executeLintingRule('seeded-randomness', analyzer, undefined));
				assert.deepStrictEqual(found.results.map(r => r.function), ['rollIt'],
					'the configured built-in has to be a randomness consumer');
			});
			test('and it does not leak into an analyzer that does not state it', async() => {
				const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
				analyzer.addRequest('rollIt(1)');
				const found = LintingResults.unpackSuccess(await executeLintingRule('seeded-randomness', analyzer, undefined));
				assert.isEmpty(found.results);
			});
		});

		describe('a name that only looks like a consumer', () => {
			/* `some` is purrr's predicate helper; only `car::some` samples rows, and consumers match by bare name */
			assertLinter('some is not a randomness consumer', parser, 'some(1:3, is.numeric)', 'seeded-randomness', [],
				{ consumerCalls: 0, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
		});
	});
}));
