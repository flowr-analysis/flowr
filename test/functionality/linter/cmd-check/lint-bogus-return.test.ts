import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinter, assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('bogus-return', () => {
		assertLinterPackage('bare return in a branch', parser, 'f <- function(x) {\n  if(x) return\n  2\n}', 'bogus-return', [{
			certainty: LintingResultCertainty.Certain,
			function:  'f',
			loc:       [2, 9, 2, 14, '/pkg/R/code.R'],
			quickFix:  [{ type: 'replace', description: 'Call `return()`', replacement: 'return()', loc: [2, 9, 2, 14, '/pkg/R/code.R'] }]
		}]);
		assertLinterPackage('bare return as the last expression', parser, 'f <- function(x) {\n  x <- x + 1\n  return\n}', 'bogus-return', [{ function: 'f' }]);
		assertLinterPackage('anonymous function names no function', parser, 'lapply(1:3, function(i) { if(i > 1) return; i })', 'bogus-return', [{ function: undefined }]);
		assertLinterPackage('several bare returns', parser, 'f <- function(a, b) { if(a) return; if(b) return; 1 }', 'bogus-return', [{ function: 'f' }, { function: 'f' }]);
		assertLinterPackage('nested function names the innermost binding', parser, 'f <- function() { g <- function() return; g }', 'bogus-return', [{ function: 'g' }]);
		assertLinter('a folder above named like a test folder keeps package code', parser, 'half <- function(x) { if(x < 0) return; x / 2 }', 'bogus-return', [{
			certainty: LintingResultCertainty.Certain,
			function:  'half',
			message:   'Possibly missing \'()\' after \'return\' in half, a bare return evaluates to the function itself',
			loc:       [1, 33, 1, 38, '/tmp/test-workspace/pkg/R/f.R'],
			quickFix:  [{ type: 'replace', description: 'Call `return()`', replacement: 'return()', loc: [1, 33, 1, 38, '/tmp/test-workspace/pkg/R/f.R'] }]
		}], undefined, { useAsFilePath: '/tmp/test-workspace/pkg/R/f.R' });
		assertLinterPackage('return as a value of an assignment', parser, 'f <- function() { r <- return; r }', 'bogus-return', [{ function: 'f' }]);

		describe('no findings', () => {
			assertLinterPackage('quoted return is data', parser, 'f <- function() quote(return)', 'bogus-return', []);
			assertLinterPackage('proper return call', parser, 'f <- function(x) return(x)', 'bogus-return', []);
			assertLinterPackage('empty return call', parser, 'f <- function(x) { if(x) return(); 1 }', 'bogus-return', []);
			assertLinterPackage('return with a space before the parenthesis', parser, 'f <- function(x) return (x)', 'bogus-return', []);
			assertLinterPackage('invisible return', parser, 'f <- function(x) return(invisible(x))', 'bogus-return', []);
			assertLinterPackage('return redefined locally', parser, 'f <- function() { return <- 5; return }', 'bogus-return', []);
			assertLinterPackage('return as a string', parser, 'f <- function() "return"', 'bogus-return', []);
			assertLinterPackage('return as an argument name', parser, 'f <- function() list(return = 1)', 'bogus-return', []);
			assertLinterPackage('bare return at top level is no function', parser, 'x <- return', 'bogus-return', []);
			assertLinterPackage('test code is no package code', parser, 'f <- function(x) { if(x) return; 1 }', 'bogus-return', [], { file: 'tests/testthat/test-f.R' });
		});
	});
}));
