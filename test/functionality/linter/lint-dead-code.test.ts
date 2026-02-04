import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, assertLinterWithIds } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { DefaultCfgSimplificationOrder } from '../../../src/control-flow/cfg-simplification';

describe('flowR linter', withTreeSitter(parser => {
	describe('dead code', () => {

		describe('simple', () => {
			assertLinter('none', parser, 'x <- 1', 'dead-code', []);
			assertLinter('always', parser, 'if(TRUE) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 17, 1, 17] }
			], { consideredNodes: 7 });
			assertLinter('never', parser, 'if(FALSE) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11] }
			], { consideredNodes: 7 });
			assertLinter('no analysis', parser, 'if(FALSE) 1 else 2', 'dead-code', [], { consideredNodes: 7 }, { simplificationPasses: DefaultCfgSimplificationOrder });
		});

		describe('stop', () => {
			assertLinter('stopifnot true', parser, 'if(TRUE) 1; stopifnot(TRUE); 2', 'dead-code', []);
			assertLinter('stopifnot false', parser, 'if(TRUE) 1; stopifnot(FALSE); 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 31, 1, 31] },
			]);
			assertLinter('stop condition', parser, `
x <- 2

if(u) {
  stop(42)
  x <- 3
}

print(2)
`, 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [6, 3, 6, 8] }
			]);
			assertLinter('return', parser, 'return(); 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11] }
			]);
			assertLinter('try', parser, 'try(stop(1)); 2', 'dead-code', []);
			assertLinter('try complex', parser, 'f <- function() { try(stop(1)); 2 }; f(); stop(1); 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 52, 1, 52] }
			]);
		});

		describe('non-constant', () => {
			assertLinter('always', parser, 'x <- TRUE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 25, 1, 25] }
			]);
			assertLinter('never', parser, 'x <- FALSE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 19, 1, 19] }
			]);
		});

		describe('if-elif-else', () => {
			assertLinterWithIds('TRUE FALSE', parser, 'if(TRUE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 17, 1, 35], involvedId: ['1@if', '1@FALSE', '1@2', '1@3', '$5', '$7', '$9'] }
			]);
			assertLinterWithIds('FALSE FALSE', parser, 'if(FALSE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11], involvedId: ['1@1', '$2'] },
				{ certainty: LintingResultCertainty.Certain, loc: [1, 29, 1, 29], involvedId: ['1@2', '$5'] }
			]);
			assertLinterWithIds('FALSE TRUE', parser, 'if(FALSE) 1 else if (TRUE) 2 else 3', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11], involvedId: ['1@1', '$2'] },
				{ certainty: LintingResultCertainty.Certain, loc: [1, 35, 1, 35], involvedId: ['1@3', '$7'] }
			]);
		});

		describe('loops', () => {
			assertLinter('after infinite repeat', parser, 'repeat{ foo }; 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 16, 1, 16] }
			]);
			assertLinter('after infinite while', parser, 'while(TRUE){ foo }; 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 21, 1, 21] }
			]);
		});
	});
}));
