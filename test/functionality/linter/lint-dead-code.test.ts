import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';
import { DefaultCfgSimplificationOrder } from '../../../src/control-flow/cfg-simplification';

describe('flowR linter', withTreeSitter(parser => {
	describe('dead code', () => {

		describe('simple', () => {
			assertLinter('none', parser, 'x <- 1', 'dead-code', []);
			assertLinter('always', parser, 'if(TRUE) 1 else 2', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 17, 1, 17] }
			], { consideredNodes: 7 });
			assertLinter('never', parser, 'if(FALSE) 1 else 2', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 11, 1, 11] }
			], { consideredNodes: 7 });
			assertLinter('no analysis', parser, 'if(FALSE) 1 else 2', 'dead-code', [], { consideredNodes: 7 }, { simplificationPasses: DefaultCfgSimplificationOrder });
		});

		describe('stopifnot', () => {
			assertLinter('stopifnot true', parser, 'if(TRUE) 1; stopifnot(TRUE); 2', 'dead-code', []);
			assertLinter('stopifnot false', parser, 'if(TRUE) 1; stopifnot(FALSE); 2', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 13, 1, 28] },
				{ certainty: LintingCertainty.Certain, range: [1, 31, 1, 31] },
			]);
		});

		describe('non-constant', () => {
			assertLinter('always', parser, 'x <- TRUE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 25, 1, 25] }
			]);
			assertLinter('never', parser, 'x <- FALSE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 19, 1, 19] }
			]);
		});

		describe('if-elif-else', () => {
			assertLinter('TRUE FALSE', parser, 'if(TRUE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 17, 1, 35] }
			]);
			assertLinter('FALSE FALSE', parser, 'if(FALSE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 11, 1, 11] },
				{ certainty: LintingCertainty.Certain, range: [1, 29, 1, 29] }
			]);
			assertLinter('FALSE TRUE', parser, 'if(FALSE) 1 else if (TRUE) 2 else 3', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 11, 1, 11] },
				{ certainty: LintingCertainty.Certain, range: [1, 35, 1, 35] }
			]);
		});

		describe('loops', () => {
			assertLinter('after infinite repeat', parser, 'repeat{ foo }; 2', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 16, 1, 16] }
			]);
			assertLinter('after infinite while', parser, 'while(TRUE){ foo }; 2', 'dead-code', [
				{ certainty: LintingCertainty.Certain, range: [1, 21, 1, 21] }
			]);
		});
	});
}));
