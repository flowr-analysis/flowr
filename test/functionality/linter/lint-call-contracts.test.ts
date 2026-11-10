import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { SourceRange } from '../../../src/util/range';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

/* every call reported fails in R, and every program without a report runs */
describe('flowR linter', withTreeSitter(parser => {
	const { Uncertain } = LintingResultCertainty;
	describe('call contracts', () => {
		const f = 'f <- function(m) { if(m < 0) stop("m < 0"); stopifnot(is.numeric(m)); m }\n';
		const generic = 'h <- function(x, ...) UseMethod("h")\nh.default <- function(x, ...) { stopifnot(is.numeric(x)); x }\n';
		const sqrtFails = 'is.numeric(x) || is.logical(x) || is.complex(x) || is.object(x) fails for';
		describe('calls that fail', () => {
			assertLinter('a value below the bound', parser, f + 'f(-1)', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(2, 1, 2, 5), function: 'f', broken: ['m >= 0 fails for m = -1'] }
			]);
			assertLinter('a value of the wrong type, resolved from a variable', parser, f + 'v <- "a"\nf(v)', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(3, 1, 3, 4), function: 'f', broken: ['is.numeric(m) fails for m = "a"'] }
			]);
			assertLinter('a required argument left out', parser, f + 'f()', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(2, 1, 2, 3), function: 'f', broken: ['m is not given'] }
			]);
			assertLinter('a choice of match.arg that names none', parser, 'g <- function(how = c("a", "bb")) { how <- match.arg(how); how }\ng("c")', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(2, 1, 2, 6), function: 'g', broken: ['how pmatches {"a", "bb"} fails for how = "c"'] }
			]);
			assertLinter('a relation of two formals', parser, 'f <- function(x, n) { stopifnot(length(x) >= n); x }\nf(1:3, 5)', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(2, 1, 2, 9), function: 'f', broken: ['all(length(x) >= n) fails for x = c(1, 2, 3), n = 5'] }
			]);
			assertLinter('a function of R written in C', parser, 'strsplit(1, "a")', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(1, 1, 1, 16), function: 'strsplit', broken: ['is.character(x) fails for x = 1'] }
			]);
			assertLinter('sqrt of a string', parser, 'sqrt("a")', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(1, 1, 1, 9), function: 'sqrt', broken: [`${sqrtFails} x = "a"`] }
			]);
			assertLinter('sqrt of strings that both fail', parser, 'x <- if(runif(1) > 0.5) "a" else "b"\nsqrt(x)', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(2, 1, 2, 7), function: 'sqrt', broken: [`${sqrtFails} x = "b" or "a"`] }
			]);
			assertLinter('an operator on a string', parser, '"a" + 1', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(1, 1, 1, 7), function: '+', broken: ['is.numeric(e1) || is.logical(e1) || is.complex(e1) || is.null(e1) || is.object(e1) || is.object(e2) fails for e1 = "a", e2 = 1'] }
			]);
			assertLinter('a negative m of a closure of R', parser, 'combn(4, -1)', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(1, 1, 1, 12), function: 'combn', broken: ['m >= 0 fails for m = -1'] }
			]);
			assertLinter('a closure of R without its arguments', parser, 'combn()', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(1, 1, 1, 7), function: 'combn', broken: ['x is not given', 'm is not given'] }
			]);
			assertLinter('more chosen than there are', parser, 'combn(1:3, 5)', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(1, 1, 1, 13), function: 'combn', broken: ['is.numeric(x) && length(x) == 1L && x > 0 && trunc(x) == x || length(x) >= m fails for x = c(1, 2, 3), m = 5'] }
			]);
			assertLinter('what a generic checks before it dispatches', parser, 'sort(1, decreasing = "a")', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(1, 1, 1, 25), function: 'sort', broken: ['is.logical(decreasing) fails for decreasing = "a"'] }
			]);
			assertLinter('a generic whose methods are all known', parser, generic + 'h("a")', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(3, 1, 3, 6), function: 'h', broken: ['is.object(x) || is.numeric(x) fails for x = "a"'] }
			]);
			assertLinter('a call of a function failing for what it is handed', parser, 'f <- function(x) sqrt(x)\nf("a")', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(2, 1, 2, 6), function: 'f', broken: [`${sqrtFails} x = "a"`] }
			]);
			assertLinter('not what a parameter holds for the calls flowR sees', parser, 'f <- function(x) { y <- x; sqrt(y) }\nf("a")', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(2, 1, 2, 6), function: 'f', broken: [`${sqrtFails} x = "a"`] }
			]);
			assertLinter('a call within tryCatch is still reported', parser, 'tryCatch(sqrt("a"), error = function(e) 1)', 'call-contracts', [
				{ certainty: Uncertain, loc: SourceRange.from(1, 10, 1, 18), function: 'sqrt', broken: [`${sqrtFails} x = "a"`] }
			]);
		});
		describe('calls that may run', () => {
			for(const [label, code] of [
				['a call within the contract', f + 'f(2)'],
				['an unknown value', f + 'f(runif(1))'],
				['a value that only some values break', 'x <- if(runif(1) > 0.5) "a" else 1\nsqrt(x)'],
				['enough to choose from', 'combn(1:5, 2)'],
				['a choice match.arg finds', 'g <- function(how = c("a", "bb")) { how <- match.arg(how); how }\ng("b")'],
				['a classed value of a generic with a method for it', 'scale.foo <- function(x, center = TRUE, scale = TRUE) x\nscale(structure(1, class = "foo"), center = "a")'],
				['a method for the implicit class of the value', generic + 'h.character <- function(x, ...) x\nh("a")'],
				['a value classed by structure', generic + 'h.foo <- function(x, ...) x\nh(structure("a", class = "foo"))'],
				['a value classed by replacement', generic + 'h.foo <- function(x, ...) x\ny <- "a"\nclass(y) <- "foo"\nh(y)'],
				['a method of R for the class', 'trunc(as.Date("2020-01-01"))'],
				['dots handed on', 'f <- function(...) sqrt(...)\nf(4)'],
				['an S4 object', 'setClass("A", representation(x = "numeric"))\nsetMethod("sqrt", "A", function(x) 1)\na <- new("A", x = 1)\nsqrt(a)'],
				['an operator with an Ops method of the program', 'Ops.foo <- function(e1, e2) 1\nx <- structure(1, class = "foo")\nx + "a"'],
				['a function of the program shadowing one of R', 'sqrt <- function(x) x\nsqrt("a")'],
				['code that never runs', 'if(FALSE) sqrt("a")'],
				['code after a stop', 'f <- function() { stop("x"); sqrt("a") }'],
				['quoted code', 'quote(sqrt("a"))'],
				['a vector of numbers', 'sqrt(c(1, 2))'],
				['a logical', 'sqrt(TRUE)']
			] as const) {
				assertLinter(label, parser, code, 'call-contracts', []);
			}
		});
	});
}));
