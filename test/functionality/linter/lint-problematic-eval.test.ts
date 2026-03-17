import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';

describe('flowR linter', withTreeSitter(parser => {
	describe('Problematic Eval', () => {
		assertLinter('const-eval', parser, 'eval(parse(text="x"))', 'problematic-eval', [

		]);
	});
}));
