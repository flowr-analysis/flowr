import { describe } from 'vitest';
import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('R3 seeded randomness', () => {
		describe('simple', () => {
			assertLinter('none', parser, 'cat("hello")', 'seeded-randomness', [], { consumerCalls: 0, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('no producer', parser, 'runif(1)', 'seeded-randomness',
				[{ range: [1, 1, 1, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('no consumer', parser, 'set.seed(17)', 'seeded-randomness', [], { consumerCalls: 0, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('both', parser, 'set.seed(17)\nrunif(1)', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('after', parser, 'runif(1)\nset.seed(17)', 'seeded-randomness',
				[{ range: [1, 1, 1, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });

			assertLinter('multiple seeds', parser, 'set.seed(1);\nset.seed(2);\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('multiple consumers', parser, 'set.seed(1);\nset.seed(2);\nrunif(1);\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 2, callsWithFunctionProducers: 2, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
		});

		describe('loops', () => {
			assertLinter('invalid', parser, 'for(i in 1:10) { runif(1); }', 'seeded-randomness',
				[{ range: [1, 18, 1, 25], function: 'runif', certainty: LintingResultCertainty.Certain }]);
			assertLinter('valid', parser, 'for(i in 1:10) { set.seed(17); runif(1); }', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
		});

		describe('conditions', () => {
			assertLinter('both false', parser, 'if(FALSE) { set.seed(17); \nrunif(1); }', 'seeded-randomness', [], { consumerCalls: 0, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('both true', parser, 'if(TRUE) { set.seed(17); \nrunif(1); }', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('false', parser, 'if(FALSE) { set.seed(17); }\nrunif(1);', 'seeded-randomness',
				[{ range: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('true', parser, 'if(TRUE) { set.seed(17); }\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('unclear', parser, 'if(u) { set.seed(17); }\nrunif(1);', 'seeded-randomness',
				[{ range: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Uncertain }], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 1 });
			assertLinter('unclear', parser, 'if(u) {} else { set.seed(17); }\nrunif(1);', 'seeded-randomness',
				[{ range: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Uncertain }], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 1 });
			assertLinter('unclear after definite seed', parser, 'set.seed(17); if(u) { set.seed(17); }\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('exhaustive', parser, 'if(u) { set.seed(17); } else { set.seed(18); }\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 2, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('reversed', parser, 'set.seed(17);\nif(u) { runif(1) }', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('separate', parser, 'if (u) { set.seed(17) }; if (u) { runif(1) }', 'seeded-randomness',
				[{ range: [1, 35, 1, 42], function: 'runif', certainty: LintingResultCertainty.Uncertain }], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 1 });
			assertLinter('nested true', parser, 'if(TRUE) { if(TRUE) { set.seed(17); }\nrunif(1); }', 'seeded-randomness', [], { consumerCalls: 1, callsWithFunctionProducers: 1, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
			assertLinter('nested producer false', parser, 'if(TRUE) { if(FALSE) { set.seed(17); }\nrunif(1); }', 'seeded-randomness',
				[{ range: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
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
				[{ range: [3, 1, 3, 8], function: 'runif', certainty: LintingResultCertainty.Certain }],
				{ consumerCalls: 1, callsWithAssignmentProducers: 0, callsWithFunctionProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });
		});

		assertLinter('non-constant seed', parser, 'num<-1 + 7;\nset.seed(num);\nrunif(1);', 'seeded-randomness', [
			{ range: [3, 1, 3, 8], function: 'runif', certainty: LintingResultCertainty.Certain }
		], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 1, callsWithOtherBranchProducers: 0 });
		assertLinter('random seed', parser, 'set.seed(runif(1));\nrunif(1);', 'seeded-randomness', [
			{ range: [1, 10, 1, 17], function: 'runif', certainty: LintingResultCertainty.Certain },
			{ range: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Certain }
		], { consumerCalls: 2, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 2, callsWithOtherBranchProducers: 0 });

		assertLinter('custom set.seed', parser, 'set.seed <- function(x) {}\nset.seed(17)\nrunif(1)', 'seeded-randomness',
			[{ range: [3, 1, 3, 8], function: 'runif', certainty: LintingResultCertainty.Certain }], { consumerCalls: 1, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0 });

		assertLinter('set in function call', parser, 'runif(set.seed(17))', 'seeded-randomness',
			[{ range: [1, 1, 1, 19], function: 'runif', certainty: LintingResultCertainty.Certain }]);
		assertLinter('get in function call', parser, 'runif(runif(1))', 'seeded-randomness', [
			{ range: [1, 7, 1, 14], function: 'runif', certainty: LintingResultCertainty.Certain },
			{ range: [1, 1, 1, 15], function: 'runif', certainty: LintingResultCertainty.Certain }]);
	});
}));
