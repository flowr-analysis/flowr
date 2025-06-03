import { describe } from 'vitest';


import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { LintingCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('R3 seeded randomness', () => {
		assertLinter('none', parser, 'cat("hello")', 'seeded-randomness', [], { consumerCalls: 0, callsWithProducers: 0 });
		assertLinter('simple no producer', parser, 'runif(1)', 'seeded-randomness',
			[{ range: [1,1,1,8], function: 'runif', certainty: LintingCertainty.Definitely }], { consumerCalls: 1, callsWithProducers: 0 });
		assertLinter('simple no consumer', parser, 'set.seed(17)', 'seeded-randomness', [], { consumerCalls: 0, callsWithProducers: 0 });
		assertLinter('simple both', parser, 'set.seed(17)\nrunif(1)', 'seeded-randomness', [], { consumerCalls: 1, callsWithProducers: 1 });
	});
}));
