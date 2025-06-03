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
		assertLinter('simple after', parser, 'runif(1)\nset.seed(17)', 'seeded-randomness',
			[{ range: [1,1,1,8], function: 'runif', certainty: LintingCertainty.Definitely }], { consumerCalls: 1, callsWithProducers: 0 });

		assertLinter('loop valid', parser, 'for(i in 1:10) { set.seed(17); runif(1); }', 'seeded-randomness', [], { consumerCalls: 1, callsWithProducers: 1 });
		// TODO why does this one pass?
		assertLinter('loop invalid', parser, 'for(i in 1:10) { runif(1); set.seed(17); }', 'seeded-randomness', [], { consumerCalls: 1, callsWithProducers: 1 });

		assertLinter('condition', parser, 'if(FALSE) { set.seed(17); }\nrunif(1);', 'seeded-randomness',
			[{ range: [2,1,2,8], function: 'runif', certainty: LintingCertainty.Definitely }], { consumerCalls: 1, callsWithProducers: 0 });
		assertLinter('condition true', parser, 'if(TRUE) { set.seed(17); }\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithProducers: 1 });

		assertLinter('non-constant seed', parser, 'num<-1 + 7;\nset.seed(num);\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithProducers: 1 });
		// TODO why does this one pass?
		assertLinter('random seed', parser, 'set.seed(runif(1));\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 2, callsWithProducers: 2 });

		assertLinter('multiple seeds', parser, 'set.seed(1);\nset.seed(2);\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 1, callsWithProducers: 1 });
		assertLinter('multiple consumers', parser, 'set.seed(1);\nset.seed(2);\nrunif(1);\nrunif(1);', 'seeded-randomness', [], { consumerCalls: 2, callsWithProducers: 2 });

		assertLinter('custom set.seed', parser, 'set.seed <- function(x) {}\nset.seed(17)\nrunif(1)', 'seeded-randomness',
			[{ range: [3,1,3,8], function: 'runif', certainty: LintingCertainty.Definitely }], { consumerCalls: 1, callsWithProducers: 0 });

		// 7. set.seed in einer quote Funktion
		// 8. Manually assigning .Random.seed
		// 9. verwenden der seed funktionen nested in den argumenten von anderen
		// 10. Using RNGversion to set versions
		// 11. zumindest dokumentieren wo das nicht geht: parallel, scoping, withr::with_seed, future with seed
		// 12. Maybe also warn if set.seed is used without a kind? (das wäre ne separate regel, aber ich hab gerade rasugefudnen, dass die den default manchmal ändern)
		// 13. set.seed oder irgendein use wo die control-flow abhängigkeit auch zufällig ist. also als doofes Besipiel if(runif(1) > 0.5) set.seed(...)
		// + versions of those with störvariablen, aliases etc.

		// we don't track aliases yet!
		// assertLinter('set.seed alias', parser, 'setseed <- set.seed\nsetseed(17)\nrunif(1)', 'seeded-randomness', [], { consumerCalls: 1, callsWithProducers: 1 });
	});
}));
