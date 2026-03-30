import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { SourceRange } from '../../../src/util/range';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('roxygen arguments', () => {
		assertLinter('More @param documented than implemented', parser, `#' This is a function.
#' An interesting function.
#' @param a some variable
#' @param b does not exist
f = function(a){return a;}`, 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(5, 5, 5, 26),
				overDocumented:  ['b'],
				underDocumented: []
			}
		]);
		assertLinter('Less @param documented than implemented', parser, `#' This is a function.
#' An interesting function.
#' @param a some variable
f = function(a, b){return a;}`, 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(4, 5, 4, 29),
				overDocumented:  [],
				underDocumented: ['b']
			}
		]);
		assertLinter('Same @param documented as implemented', parser, '#\' This is a function.\n#\' An interesting function.\n#\' @param a some variable\n#\' @param b does exist\nf = function(a,b){return a;}', 'roxygen-arguments', []);
		assertLinter('Parameterized function, not commented', parser, 'f = function(a){return a;}', 'roxygen-arguments', []);
		assertLinter('Unparameterized function, not commented', parser, 'f = function(){return 42;}', 'roxygen-arguments', []);
		assertLinter('Different @param documented than implemented', parser, '#\' @param a some variable\nf = function(b){return b;}', 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(2, 5, 2, 26),
				overDocumented:  ['a'],
				underDocumented: ['b']
			}
		]);
		assertLinter('@param documented, but function not parameterized', parser, '#\' @param a some variable\nf = function(){return 42;}', 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(2, 5, 2, 26),
				overDocumented:  ['a'],
				underDocumented: []
			}
		]);
		assertLinter('Parameterized function, @param not documented', parser, '#\' Just a comment\nf = function(a){return 42;}', 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(2, 5, 2, 27),
				overDocumented:  [],
				underDocumented: ['a']
			}
		]);
		assertLinter('Unparameterized function, no @param documented', parser, '#\' This is a function\nf = function(){return 42;}', 'roxygen-arguments', []);
		assertLinter('Function inherits all @param needed', parser, '#\' @param h this is a param\nf <- function(h){return h;}\n#\' @inheritParams f\n#\' @param t is random placeholder\ng <- function(h,t){return h+t;}', 'roxygen-arguments', []);
		assertLinter('More @param inherited (from 2) than used', parser, '#\' @param h this is a param\n@param i another one\nf <- function(h, i){return h;}\n@param n another one\nm <- function(h, i){return h;}\n#\' @inheritParams f\n#\' @inheritParams m\n#\' @param t is random placeholder\ng <- function(h,t){return h+t;}', 'roxygen-arguments', []);
		assertLinter('Function inherits, but still missing @param', parser, '#\' @param h this is a param\n#\' @param k this is a param\nf <- function(h, k){return h-k;}\n#\' @inheritParams f\n#\' @param t\ng <- function(t,h,i){return h+t+i;}', 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(6, 6, 6, 35),
				overDocumented:  [],
				underDocumented: ['i']
			}
		]);
		assertLinter('Inheriting param from different functions', parser, '#\' @param a this is a param\n#\' @param b this is a param\nf1 <- function(a, b){return a-b;}\n#\' @param c this is a param\n#\' @inheritParams f1\nf2 <- function(c, a){return c*a;}\n#\' @inheritParams f1\n#\' @inheritParams f2\n#\' @param t is a param\n#\' @param l is a param\nf3 <- function(a,h,t,k){return h+t+i-k;}', 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(11, 7, 11, 40),
				overDocumented:  ['l'],
				underDocumented: ['h', 'k']
			}
		]);
		assertLinter('Inheriting param from different functions, mistakes from several func', parser, '#\' @param a this is a param\n#\' @param b this is a param\nf1 <- function(a, b, h){return a-b+h;}\n#\' @param c this is a param\n#\' @inheritParams f1\nf2 <- function(c, a){return c*a;}\n#\' @inheritParams f1\n#\' @inheritParams f2\n#\' @param t is a param\n#\' @param l is a param\nf3 <- function(a,h,t,k){return h+t+i-k;}', 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(3, 7, 3, 38),
				overDocumented:  [],
				underDocumented: ['h']
			},
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(11, 7, 11, 40),
				overDocumented:  ['l'],
				underDocumented: ['h', 'k']
			}
		]);
		assertLinter('...', parser, '#\' @param h this is a param\n#\' @param k another one\n#\' @param l another one\nf <- function(h, ...){return h;}', 'roxygen-arguments', []);
		assertLinter('...', parser, '#\' @param h this is a param\nf <- function(h, a,...){return h;}', 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(2, 6, 2, 34),
				overDocumented:  [],
				underDocumented: ['a', '...']
			},
		]);
		assertLinter('Inheriting param + \'...\'', parser, '#\' @param a this is a param\n#\' @param b this is a param\nf1 <- function(a, b, h){return a-b-h;}\n#\' @inheritParams f1\n#\' @param c this is a param\nf2 <- function(c, ...){return c;}', 'roxygen-arguments', [
			{
				certainty:       LintingResultCertainty.Uncertain,
				loc:             SourceRange.from(3, 7, 3, 38),
				overDocumented:  [],
				underDocumented: ['h']
			}
		]);
		assertLinter('Inheriting param + \'...\'', parser, '#\' @param ... this is a param\n#\' @param a this is a param\nf1 <- function(a, ...){return a;}\n#\' @param b this is a param\n#\' @inheritParams f1\nf2 <- function(...){return 4;}', 'roxygen-arguments', []);
	});
}));