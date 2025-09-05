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
			range:     [1,1,1,27]
		}], undefined, undefined);

		/** Given a loop the linter checks, if the loop is always stopped after the first iteration */ 
		assertLinter('always break', parser, 'for(i in c(1,2,3)) { print(i); break }', 'useless-loop', [{
			certainty: LintingResultCertainty.Certain,
			name:      'for',
			range:     [1,1,1,38]
		}], undefined, undefined);
	});
}));