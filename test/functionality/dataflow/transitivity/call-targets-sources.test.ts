import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { callsLikeR, sliceMatchesR, writesLikeR, type TransitivityCase } from './transitivity';

describe('Transitivity of call targets, global state writes and sourcing, checked against R', withTreeSitter(parser => {
	describe('call targets', () => {
		callsLikeR(parser, 'UseMethod reaches the method', 'g <- function(o) UseMethod("g")\ng.a <- function(o)\n  1\ng(structure(1, class = "a"))\ncat("ok")', '1@UseMethod', ['2@function']);
		callsLikeR(parser, 'do.call reaches the function', 'h <- function()\n  1\ndo.call(h, list())\ncat("ok")', '3@do.call', ['1@function']);
		callsLikeR(parser, 'lapply reaches a named callback', 'h <- function(i)\n  i\ninvisible(lapply(1, h))\ncat("ok")', '3@lapply', ['1@function']);
		callsLikeR(parser, 'a function defined by a super assignment', 'setup <- function() {\n  h <<- function() 1\n}\nsetup()\nh()\ncat("ok")', '5@h', ['2@function']);
		callsLikeR(parser, 'Reduce reaches its function', 'h <- function(a, b)\n  a + b\ninvisible(Reduce(h, 1:3))\ncat("ok")', '3@Reduce', ['1@function']);
		callsLikeR(parser, 'match.fun of a parameter', 'h <- function() 1\nap <- function(f) { f <- match.fun(f); f() }\nap("h")\ncat("ok")', '2:40', ['1@function'], { red: 'R calls h through f(), flowR has no call edge from f() to h' });
		callsLikeR(parser, 'an S4 generic reaches the method', 'setGeneric("go", function(o) standardGeneric("go"))\nsetClass("T", representation(v = "numeric"))\nsetMethod("go", "T", function(o)\n  1)\ngo(new("T", v = 1))\ncat("ok")', '5@go', ['3@function']);
		callsLikeR(parser, 'sapply recursing into its caller', 'f <- function(n) if(n > 0) sapply(n - 1, f) else 0\ninvisible(f(1))\ncat("ok")', '1@sapply', ['1@function']);
		callsLikeR(parser, 'a function chosen by switch', 'h <- function() 1\nk <- switch("a", a = h)\nk()\ncat("ok")', '3@k', ['1@function']);
		callsLikeR(parser, 'a user infix operator', '"%+%" <- function(a, b) a\ninvisible(1 %+% 2)\ncat("ok")', '$15', ['1@function']);
		callsLikeR(parser, 'a named error handler', 'hd <- function(e)\n  1\ninvisible(tryCatch(stop("x"), error = hd))\ncat("ok")', '3@tryCatch', ['1@function']);
		callsLikeR(parser, 'Map over a function parameter', 'h <- function(a) a\nap <- function(f) Map(f, 1)\ninvisible(ap(h))\ncat("ok")', '2@Map', ['1@function']);
		callsLikeR(parser, 'an R6 method', 'library(R6)\nC <- R6Class("C", public = list(go = function()\n  1))\no <- C$new()\ninvisible(o$go())\ncat("ok")', '$31', ['2@function']);
		callsLikeR(parser, 'a function returned by Reduce', 'h <- function(x)\n  x\ncomp <- Reduce(function(f, g) function(x) g(f(x)), list(h, h))\ninvisible(comp(1))\ncat("ok")', '3:43', ['1@function']);
		callsLikeR(parser, 'eval of a constructed call', 'f <- function()\n  1\ninvisible(eval(call("f")))\ncat("ok")', '3@eval', ['1@function'], { red: 'R calls f, flowR links eval only to built-ins' });
	});

	describe('global state writes', () => {
		writesLikeR(parser, 'an option set through match.fun', 'h <- function() options(digits = 3)\nap <- function(f) { f <- match.fun(f); f() }\nap("h")\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits'], { red: 'R sets digits, flowR finds no write' });
		writesLikeR(parser, 'an option set by a function chosen by switch', 'h <- switch("b", a = function() 1, b = function() options(digits = 3))\nh()\nif(getOption("digits") == 3) cat("ok")', 2, ['#option:digits']);
		writesLikeR(parser, 'an option set by a function returned by Reduce', 'comp <- Reduce(function(f, g) function() { f(); g() }, list(function() 1, function() options(digits = 3)))\ncomp()\nif(getOption("digits") == 3) cat("ok")', 2, ['#option:digits'], { red: 'R sets digits, flowR finds no write' });
		writesLikeR(parser, 'an option set through eval of a constructed call', 'f <- function() options(digits = 3)\neval(call("f"))\nif(getOption("digits") == 3) cat("ok")', 2, ['#option:digits'], { imprecise: 'any option, as eval may run anything' });
		writesLikeR(parser, 'an option set by a function chosen by switch in a function', 'pick <- function(t) switch(t, a = function() 1, b = function() options(digits = 3))\npick("b")()\nif(getOption("digits") == 3) cat("ok")', 2, ['#option:digits']);
		writesLikeR(parser, 'an option set by a calling handler', 'f <- function() { warning("w"); 1 }\nwithCallingHandlers(f(), warning = function(w) { options(digits = 3); invokeRestart("muffleWarning") })\nif(getOption("digits") == 3) cat("ok")', 2, ['#option:digits']);
		writesLikeR(parser, 'an option set by an Ops method', 'Ops.foo <- function(e1, e2) { options(digits = 3); TRUE }\no <- structure(1, class = "foo")\ninvisible(o == 1)\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits'], { red: 'R sets digits, flowR finds no write as == is not dispatched' });
		writesLikeR(parser, 'an option set by a function stored by evalq', 'e <- new.env()\nevalq(f <- function() options(digits = 3), e)\ne$f()\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits'], { red: 'R sets digits, flowR finds no write' });
		writesLikeR(parser, 'an option set by a callback in an environment', 'reg <- new.env()\nassign("cb", function() options(digits = 3), envir = reg)\nreg$cb()\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits']);
		writesLikeR(parser, 'an option set by a promise forced deep', 'f <- function(a) g(a)\ng <- function(b) h(b)\nh <- function(cc) cc\nf(options(digits = 3))\nif(getOption("digits") == 3) cat("ok")', 4, ['#option:digits']);
		writesLikeR(parser, 'an option set by an R6 method chain', 'library(R6)\nhelp1 <- function() options(digits = 3)\nC <- R6Class("C", public = list(go = function() help1()))\nC$new()$go()\nif(getOption("digits") == 3) cat("ok")', 4, ['#option:digits'], { red: 'R sets digits, flowR finds no write through the R6 method' });
	});

	describe('source', () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a function defined before source uses sourced definitions', code: 'f <- function() g()\nsource("lib.R")\nprint(f())', files: { 'lib.R': 'g <- function() k\nk <- 3' } },
			{ name: 'source in a loop', code: 'for(i in 1:2) source("lib.R")\nprint(n)', files: { 'lib.R': 'n <- if(exists("n")) n + 1 else 1' } },
			{ name: 'source local into a factory', code: 'mk <- function() { source("lib.R", local = TRUE); function() v }\nprint(mk()())', files: { 'lib.R': 'v <- 4' } },
			{ name: 'conditional source', code: 'if(TRUE) source("lib.R")\nprint(v)', files: { 'lib.R': 'v <- 4' } },
			{ name: 'a sourced file calling a main function', code: 'n <- 0\nup <- function() n <<- 2\nsource("lib.R")\nprint(n)', files: { 'lib.R': 'up()' } },
			{ name: 'an S3 method from a sourced file', code: 'sz <- function(o) UseMethod("sz")\nsource("lib.R")\nk <- 3\nprint(sz(structure(1, class = "box")))', files: { 'lib.R': 'sz.box <- function(o) k' } },
			{ name: 'sys.source into an environment then called', code: 'e <- new.env()\nsys.source("lib.R", envir = e)\nprint(e$f())', files: { 'lib.R': 'k <- 2\nf <- function() k * 3' } },
			{ name: 'a sourced function setting an option two calls deep', code: 'source("lib.R")\nouter()\nprint(pi)', files: { 'lib.R': 'inner <- function() options(digits = 3)\nouter <- function() inner()' } },
			{ name: 'a sourced closure factory', code: 'source("lib.R")\nk <- 5\ng <- mk()\nprint(g())', files: { 'lib.R': 'mk <- function() function() k' } },
			{ name: 'a source path from a parameter', code: 'ld <- function(p) source(p)\nld("lib.R")\nprint(v)', files: { 'lib.R': 'v <- 4' } },
			{ name: 'an infix operator reading a global', code: '"%+%" <- function(a, b) a + k\nk <- 1\nprint(1 %+% 2)' },
			{ name: 'a backticked infix operator with a side effect', code: 'n <- 0\n`%+%` <- function(a, b) n <<- a + b\ninvisible(1 %+% 2)\nprint(n)' },
			{ name: 'an R6 method calling a helper with a side effect', code: 'library(R6)\nn <- 0\nhelp1 <- function() n <<- 3\nC <- R6Class("C", public = list(go = function() help1()))\nC$new()$go()\nprint(n)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	});
}));
