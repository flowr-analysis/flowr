import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';
import { CasingConvention } from '../../../src/linter/rules/naming-convention';

describe('flowR linter', withTreeSitter(parser => {
	describe('simple test', () => {
		assertLinter('simple', parser, 'testVar <- 5', 'naming-convention', [{
			suggestion:     'testVar',
			certainty:      LintingCertainty.Definitely,
			detectedCasing: CasingConvention.CamelCase,
			name:           'testVar',
			range:          [1, 1, 1, 7]
		}]);
	});
}));