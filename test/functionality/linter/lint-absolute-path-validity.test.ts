import { describe } from 'vitest';


import { assertLinter } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';

describe('flowR linter', withTreeSitter(parser => {
	describe('absolute path linter', () => {

		assertLinter('none', parser, 'cat("hello")', 'absolute-file-paths', [], { totalConsidered: 2 });
		assertLinter('none', parser, 'cat("hello")', 'absolute-file-paths', [], { totalConsidered: 2 });

	});
}));
