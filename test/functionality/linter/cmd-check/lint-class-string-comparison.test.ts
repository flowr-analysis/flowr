import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('class-string-comparison', () => {
		const fix = (replacement: string, [sl, sc, el, ec]: readonly number[]) => [{ type: 'replace', description: `Replace with \`${replacement}\``, replacement, loc: [sl, sc, el, ec, '/pkg/R/code.R'] }];

		/* the R CMD check case */
		assertLinterPackage('class compared to a string in if', parser, 'f <- function(x) if(class(x) == "foo") 1 else 2', 'class-string-comparison', [
			{ certainty: LintingResultCertainty.Certain, classes: ['foo'], quickFix: fix('inherits(x, "foo")', [1, 21, 1, 37]) }
		]);
		assertLinterPackage('inequality turns into a negated inherits', parser, 'f <- function(x) if(class(x) != "foo") 1', 'class-string-comparison', [
			{ classes: ['foo'], quickFix: fix('!inherits(x, "foo")', [1, 21, 1, 37]) }
		]);
		assertLinterPackage('mirrored comparison (missed by R CMD check)', parser, 'f <- function(x) if("foo" == class(x)) 1', 'class-string-comparison', [
			{ classes: ['foo'], quickFix: fix('inherits(x, "foo")', [1, 21, 1, 37]) }
		]);
		assertLinterPackage('looks through parentheses', parser, 'f <- function(x) if(((class(x) == "a"))) 1', 'class-string-comparison', [{ classes: ['a'] }]);
		assertLinterPackage('looks through negation', parser, 'f <- function(x) if(!(class(x) == "a")) 1', 'class-string-comparison', [{ classes: ['a'] }]);
		assertLinterPackage('looks through logical operators', parser, 'f <- function(x) if(is.list(x) && class(x) == "a") 1', 'class-string-comparison', [{ classes: ['a'] }]);
		assertLinterPackage('reports every comparison of a condition', parser, 'f <- function(x) if(class(x) == "a" || class(x) == "b") 1', 'class-string-comparison', [
			{ classes: ['a'] }, { classes: ['b'] }
		]);
		assertLinterPackage('else-if chain', parser, 'f <- function(x, a) if(a) 1 else if(class(x) == "b") 2', 'class-string-comparison', [{ classes: ['b'] }]);
		assertLinterPackage('top-level code of a package file', parser, 'if(class(x) == "a") print(1)', 'class-string-comparison', [{ classes: ['a'] }]);
		assertLinterPackage('complex object keeps its text in the fix', parser, 'f <- function(obj) if(class(obj$a) == "b") 1', 'class-string-comparison', [
			{ quickFix: fix('inherits(obj$a, "b")', [1, 23, 1, 41]) }
		]);
		assertLinterPackage('reports the location of the comparison', parser, 'f <- function(x) {\n  if(class(x) == "a") 1\n}', 'class-string-comparison', [
			{ loc: [2, 6, 2, 20, '/pkg/R/code.R'] }
		]);

		describe('flowR extensions', () => {
			assertLinterPackage('while condition', parser, 'f <- function(x) while(class(x) == "a") x <- unclass(x)', 'class-string-comparison', [{ message: 'while() condition compares class() to a string, use inherits() instead' }]);
			assertLinterPackage('while condition, disabled', parser, 'f <- function(x) while(class(x) == "a") x <- unclass(x)', 'class-string-comparison', [], { checkWhile: false });
			assertLinterPackage('string resolved through a variable', parser, 'cls <- "a"\nf <- function(x) if(class(x) == cls) 1', 'class-string-comparison', [
				{ classes: ['a'], message: 'if() condition compares class() to a string variable, use inherits() instead', quickFix: fix('inherits(x, cls)', [2, 21, 2, 35]) }
			]);
			assertLinterPackage('string resolution disabled', parser, 'cls <- "a"\nf <- function(x) if(class(x) == cls) 1', 'class-string-comparison', [], { resolveStrings: false });
		});

		describe('no findings', () => {
			assertLinterPackage('redefined class function', parser, 'class <- function(x) "a"\nf <- function(x) if(class(x) == "a") 1', 'class-string-comparison', []);
			assertLinterPackage('comparison outside a condition', parser, 'f <- function(x) class(x) == "a"', 'class-string-comparison', []);
			assertLinterPackage('comparing two classes', parser, 'f <- function(x, y) if(class(x) == class(y)) 1', 'class-string-comparison', []);
			assertLinterPackage('first class only', parser, 'f <- function(x) if(class(x)[1] == "a") 1', 'class-string-comparison', []);
			assertLinterPackage('inherits is fine', parser, 'f <- function(x) if(inherits(x, "a")) 1', 'class-string-comparison', []);
			assertLinterPackage('membership test is not reported', parser, 'f <- function(x) if("a" %in% class(x)) 1', 'class-string-comparison', []);
			assertLinterPackage('arithmetic on a class comparison is no condition of its own', parser, 'f <- function(x) if(sum(class(x) == "a") > 0) 1', 'class-string-comparison', []);
			assertLinterPackage('unresolvable variable', parser, 'f <- function(x, cls) if(class(x) == cls) 1', 'class-string-comparison', []);
			assertLinterPackage('test code is no package code', parser, 'if(class(x) == "a") print(1)', 'class-string-comparison', [], { file: 'tests/testthat/test-a.R' });
			assertLinterPackage('inst code is no package code', parser, 'if(class(x) == "a") print(1)', 'class-string-comparison', [], { file: 'inst/scripts/run.R' });
		});
	});
}));
