import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('true-false-abbreviation', () => {
		const use = (name: 'T' | 'F', [sl, sc]: readonly [number, number]) => ({
			certainty: LintingResultCertainty.Certain,
			kind:      'use',
			name,
			loc:       [sl, sc, sl, sc, '/pkg/R/code.R'],
			quickFix:  [{ type: 'replace', description: `Replace \`${name}\` with \`${name === 'T' ? 'TRUE' : 'FALSE'}\``, replacement: name === 'T' ? 'TRUE' : 'FALSE', loc: [sl, sc, sl, sc, '/pkg/R/code.R'] }]
		});

		assertLinterPackage('T as an argument', parser, 'f <- function(x) mean(x, na.rm = T)', 'true-false-abbreviation', [use('T', [1, 34])]);
		assertLinterPackage('F as an argument', parser, 'f <- function(x) sort(x, decreasing = F)', 'true-false-abbreviation', [use('F', [1, 39])]);
		assertLinterPackage('T as a default value', parser, 'f <- function(x, verbose = T) x', 'true-false-abbreviation', [use('T', [1, 28])]);
		assertLinterPackage('T in a condition', parser, 'f <- function(x) if(T) x', 'true-false-abbreviation', [use('T', [1, 21])]);
		assertLinterPackage('T and F in one call', parser, 'g <- function() c(T, F)', 'true-false-abbreviation', [use('T', [1, 19]), use('F', [1, 22])]);
		assertLinterPackage('top-level use', parser, 'x <- T', 'true-false-abbreviation', [use('T', [1, 6])]);
		assertLinterPackage('nested function', parser, 'f <- function() function(y) isTRUE(F)', 'true-false-abbreviation', [use('F', [1, 36])]);

		describe('redefinitions', () => {
			assertLinterPackage('assignment to T is reported instead of its use', parser, 'T <- 0\nf <- function() T + 1', 'true-false-abbreviation', [
				{ kind: 'redefinition', name: 'T', loc: [1, 1, 1, 1, '/pkg/R/code.R'] }
			], { reportRedefinitions: true });
			assertLinterPackage('parameter named F only shadows locally', parser, 'f <- function(F) F * 2', 'true-false-abbreviation', []);
			assertLinterPackage('local variable named T only shadows locally', parser, 'f <- function(x) { T <- nrow(x); T * 2 }', 'true-false-abbreviation', []);
			assertLinterPackage('redefinitions can be muted', parser, 'T <- 0\nf <- function() T + 1', 'true-false-abbreviation', [], { reportRedefinitions: false });
			assertLinterPackage('use before a later local redefinition in a function', parser, 'f <- function() { a <- T; T <- 2; a }', 'true-false-abbreviation', [{ kind: 'use', name: 'T' }]);
			assertLinterPackage('conditional local redefinition makes the use uncertain', parser, 'f <- function(a) { if(a) T <- 0; T }', 'true-false-abbreviation', [{ kind: 'use', certainty: LintingResultCertainty.Uncertain }]);
		});

		describe('no findings', () => {
			assertLinterPackage('TRUE and FALSE', parser, 'f <- function(x) mean(x, na.rm = TRUE) || FALSE', 'true-false-abbreviation', []);
			assertLinterPackage('argument named T', parser, 'f <- function() g(T = 1)', 'true-false-abbreviation', []);
			assertLinterPackage('list element named T', parser, 'f <- function(x) x$T', 'true-false-abbreviation', []);
			assertLinterPackage('string "T"', parser, 'f <- function() "T"', 'true-false-abbreviation', []);
			assertLinterPackage('other single letters', parser, 'f <- function(x, N) x + N', 'true-false-abbreviation', []);
			assertLinterPackage('namespaced symbol', parser, 'f <- function() base::T', 'true-false-abbreviation', []);
			assertLinterPackage('test code is no package code', parser, 'x <- T', 'true-false-abbreviation', [], { file: 'tests/testthat/test-x.R' });
			assertLinterPackage('vignette-like inst code is no package code', parser, 'x <- T', 'true-false-abbreviation', [], { file: 'inst/doc/run.R' });
		});
	});
}));
