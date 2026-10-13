import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('Simple Useless Loops', () => {
		/** Given a for-loop the linter checks, if the vector only contains one element */
		assertLinter('i in c(1)', parser, 'for(i in c(1)) { print(i) }', 'useless-loop', [{
			certainty: LintingResultCertainty.Certain,
			name:      'for',
			loc:       [1, 1, 1, 27]
		}]);

		assertLinter('i in a scalar', parser, 'for(i in 1) { print(i) }', 'useless-loop', [{
			certainty: LintingResultCertainty.Certain,
			name:      'for',
			loc:       [1, 1, 1, 24]
		}]);

		/** Given a loop the linter checks, if the loop is always stopped after the first iteration */
		assertLinter('always break', parser, 'for(i in c(1,2,3)) { print(i); break }', 'useless-loop', [{
			certainty: LintingResultCertainty.Certain,
			name:      'for',
			loc:       [1, 1, 1, 38]
		}]);
	});

	describe('Not a Useless Loop', () => {
		assertLinter('a vector holding a sequence', parser, 'x <- read.csv("a.csv")\nfor(j in c(1:nrow(x))) print(j)', 'useless-loop', []);
		assertLinter('vector c(c(1))', parser, 'for(i in c(c(1))) print(i)', 'useless-loop', [{ certainty: LintingResultCertainty.Certain, name: 'for', loc: [1, 1, 1, 26] }]);
		assertLinter('vector c(1:1)', parser, 'for(i in c(1:1)) print(i)', 'useless-loop', [{ certainty: LintingResultCertainty.Certain, name: 'for', loc: [1, 1, 1, 25] }]);
		assertLinter('vector c("a")', parser, 'for(i in c("a")) print(i)', 'useless-loop', [{ certainty: LintingResultCertainty.Certain, name: 'for', loc: [1, 1, 1, 25] }]);
		assertLinter('vector c(TRUE)', parser, 'for(i in c(TRUE)) print(i)', 'useless-loop', [{ certainty: LintingResultCertainty.Certain, name: 'for', loc: [1, 1, 1, 26] }]);
		assertLinter('vector c(c(1), 2)', parser, 'for(i in c(c(1), 2)) print(i)', 'useless-loop', []);
		assertLinter('vector c(1, 2)', parser, 'for(i in c(1, 2)) print(i)', 'useless-loop', []);
		assertLinter('vector c(1:3)', parser, 'for(i in c(1:3)) print(i)', 'useless-loop', []);
		assertLinter('vector c(NULL)', parser, 'for(i in c(NULL)) print(i)', 'useless-loop', []);
		assertLinter('vector c(x)', parser, 'for(i in c(x)) print(i)', 'useless-loop', []);
		assertLinter('vector c(f())', parser, 'for(i in c(f())) print(i)', 'useless-loop', []);
		assertLinter('vector c(1:n)', parser, 'for(i in c(1:n)) print(i)', 'useless-loop', []);
		assertLinter('vector c(c(1:n))', parser, 'for(i in c(c(1:n))) print(i)', 'useless-loop', []);
		assertLinter('vector c(-1:-1)', parser, 'for(i in c(-1:-1)) print(i)', 'useless-loop', [{ certainty: LintingResultCertainty.Certain, name: 'for', loc: [1, 1, 1, 27] }]);
		assertLinter('repeat with break', parser, 'repeat { x <- x + 2; if(u) { break } else {} }', 'useless-loop', []);
	});
}));