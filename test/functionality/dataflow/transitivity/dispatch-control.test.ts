import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, writesLikeR, type TransitivityCase, testing } from './transitivity';

describe('Transitivity through dispatch, sourcing and control flow, checked against R', withTreeSitter(parser => {
	describe('S3, S4 and R6 dispatch', () => testing(['oop-s3-dispatch', 'oop-s4-dispatch', 'oop-r6'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an S3 method reading a global', code: 'area <- function(s) UseMethod("area")\narea.sq <- function(s) s$w^2 * k\nk <- 2\nsq <- structure(list(w = 3), class = "sq")\nprint(area(sq))' },
			{ name: 'NextMethod reaching the default', code: 'f <- function(x) UseMethod("f")\nf.a <- function(x) NextMethod() + 1\nf.default <- function(x) base\nbase <- 10\nprint(f(structure(1, class = "a")))' },
			{ name: 'an S3 method with a super assignment', code: 'n <- 0\nbump <- function(o) UseMethod("bump")\nbump.cnt <- function(o) n <<- n + o$by\nbump(structure(list(by = 4), class = "cnt"))\nprint(n)' },
			{ name: 'an S3 method called through a generic two calls deep', code: 'k <- 3\nsz <- function(o) UseMethod("sz")\nsz.box <- function(o) o$n * k\nmeasure <- function(o) sz(o)\nreport <- function(o) measure(o)\nprint(report(structure(list(n = 2), class = "box")))' },
			{ name: 'an S4 method reading a global', code: 'setGeneric("ar", function(o) standardGeneric("ar"))\nsetClass("Sq", representation(w = "numeric"))\nk <- 2\nsetMethod("ar", "Sq", function(o) o@w * k)\nprint(ar(new("Sq", w = 3)))' },
			{ name: 'an R6 method reading a global', code: 'library(R6)\nk <- 2\nC <- R6Class("C", public = list(v = 1, inc = function() { self$v <- self$v + k; invisible(self) }))\no <- C$new()\no$inc()\nprint(o$v)' },
			{ name: 'an R6 method changing a field', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, inc = function() self$v <- 3))\no <- C$new()\no$inc()\nprint(o$v)' },
			{ name: 'an R6 method taken out of its instance', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, inc = function() self$v <- 3))\no <- C$new()\nf <- o$inc\nf()\nprint(o$v)' },
			{ name: 'an R6 method changing a field through another method', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, set = function(x) self$v <- x, inc = function() self$set(3)))\no <- C$new()\no$inc()\nprint(o$v)' },
			{ name: 'an R6 method changing a private field', code: 'library(R6)\nC <- R6Class("C", public = list(set = function() private$v <- 3, get = function() private$v), private = list(v = 1))\no <- C$new()\no$set()\nprint(o$get())' },
			{ name: 'R6 methods chained on an instance', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, inc = function() { self$v <- self$v + 1; invisible(self) }))\no <- C$new()\no$inc()$inc()\nprint(o$v)' },
			{ name: 'an R6 method called on a fresh instance', code: 'library(R6)\nn <- 0\nC <- R6Class("C", public = list(go = function() n <<- 2))\nC$new()$go()\nprint(n)' },
			{ name: 'a Reference Class method changing a field of .self', code: 'C <- setRefClass("C", fields = list(v = "numeric"), methods = list(inc = function() .self$v <- 3))\no <- C$new(v = 1)\no$inc()\nprint(o$v)' },
			{ name: 'an R6 method reading a global only', code: 'library(R6)\nk <- 2\nC <- R6Class("C", public = list(get = function() k))\no <- C$new()\nprint(o$get())' },
			{ name: 'an R6 method with a super assignment', code: 'library(R6)\nn <- 0\nC <- R6Class("C", public = list(go = function() n <<- 6))\no <- C$new()\no$go()\nprint(n)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('source', () => testing(['sourcing-external-files'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a function from a sourced file reading a main global', code: 'k <- 4\nsource("lib.R")\nprint(f())', files: { 'lib.R': 'f <- function() g()\ng <- function() k * 2' } },
			{ name: 'a sourced file sourcing another', code: 'source("a.R")\nprint(f())', files: { 'a.R': 'source("b.R")\nf <- function() g() + 1', 'b.R': 'g <- function() 5' } },
			{ name: 'a super assignment in a sourced function', code: 'n <- 0\nsource("lib.R")\nup()\nprint(n)', files: { 'lib.R': 'up <- function() n <<- 3' } },
			{ name: 'source within a function', code: 'load <- function() source("lib.R")\nload()\nprint(v)', files: { 'lib.R': 'v <- 9' } },
			{ name: 'a sourced file setting an option', code: 'source("lib.R")\nprint(pi)', files: { 'lib.R': 'options(digits = 3)' } }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('exit hooks and conditions', () => testing(['hooks', 'exceptions-and-errors'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an exit hook overriding a super assignment', code: 'x <- 1\nf <- function() { on.exit(x <<- 3); x <<- 2 }\nf()\nprint(x)' },
			{ name: 'an exit hook setting an option two calls deep', code: 'g <- function() { on.exit(options(digits = 3)); 1 }\nf <- function() g()\nf()\nprint(pi)' },
			{ name: 'exit hooks in order', code: 'x <- 0\nf <- function() { on.exit(x <<- 1); on.exit(x <<- x * 10, add = TRUE) }\nf()\nprint(x)' },
			{ name: 'an error handler reading a global', code: 'v <- 7\nr <- tryCatch(stop("x"), error = function(e) v)\nprint(r)' },
			{ name: 'a handler and finally with super assignments', code: 'n <- 0\ntryCatch(stop("x"), error = function(e) n <<- 1, finally = n <<- n + 10)\nprint(n)' },
			{ name: 'a warning raised two calls deep', code: 'k <- 5\nf <- function() warning("w")\ng <- function() f()\nr <- tryCatch(g(), warning = function(w) k)\nprint(r)' },
			{ name: 'a handler that never runs', code: 'n <- 0\nr <- tryCatch(1, error = function(e) n <<- 5)\nprint(n)' },
			{ name: 'withCallingHandlers with a restart', code: 'n <- 0\nf <- function() { warning("w"); 2 }\nr <- withCallingHandlers(f(), warning = function(w) { n <<- 1; invokeRestart("muffleWarning") })\nprint(n + r)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('handlers given by value', () => testing(['exceptions-and-errors', 'higher-order-functions'], () => {
		const muffling = 'function(w) { n <<- 1; invokeRestart("muffleWarning") }';
		const warns = 'f <- function() { warning("w"); 2 }';
		const cases: readonly TransitivityCase[] = [
			{ name: 'a calling handler by name', code: `n <- 0\nh <- ${muffling}\n${warns}\nr <- withCallingHandlers(f(), warning = h)\nprint(n + r)` },
			{ name: 'a calling handler from a list', code: `n <- 0\nhs <- list(w = ${muffling})\n${warns}\nr <- withCallingHandlers(f(), warning = hs$w)\nprint(n + r)` },
			{ name: 'a calling handler from a factory', code: `n <- 0\nmk <- function() ${muffling}\n${warns}\nr <- withCallingHandlers(f(), warning = mk())\nprint(n + r)` },
			{ name: 'a calling handler through a parameter', code: `n <- 0\n${warns}\nrun <- function(h) withCallingHandlers(f(), warning = h)\nr <- run(${muffling})\nprint(n + r)` },
			{ name: 'an inline calling handler in a function body', code: `n <- 0\n${warns}\nrun <- function() withCallingHandlers(f(), warning = ${muffling})\nr <- run()\nprint(n + r)` },
			{ name: 'a handler by name for a warning two calls deep in a function body', code: 'n <- 0\nh <- function(w) n <<- 1\nf <- function() warning("w")\ng <- function() f()\nrun <- function() tryCatch(g(), warning = h)\nrun()\nprint(n)' },
			{ name: 'a calling handler by name that never runs', code: 'n <- 0\nh <- function(w) n <<- 5\nr <- withCallingHandlers(1, warning = h)\nprint(n)' },
			{ name: 'an exiting handler by name', code: `n <- 0\nh <- function(w) n <<- 1\n${warns}\nr <- tryCatch(f(), warning = h)\nprint(n)` },
			{ name: 'an exiting handler from a list', code: `n <- 0\nhs <- list(w = function(w) n <<- 1)\n${warns}\nr <- tryCatch(f(), warning = hs[["w"]])\nprint(n)` },
			{ name: 'an exiting handler from a factory', code: `n <- 0\nmk <- function() function(w) n <<- 1\n${warns}\nr <- tryCatch(f(), warning = mk())\nprint(n)` },
			{ name: 'an exiting handler through a parameter', code: `n <- 0\n${warns}\nrun <- function(h) tryCatch(f(), warning = h)\nr <- run(function(w) n <<- 1)\nprint(n)` },
			{ name: 'an exiting handler by name that never runs', code: 'n <- 0\nh <- function(w) n <<- 5\nr <- tryCatch(1, warning = h)\nprint(n)' },
			{ name: 'an error handler by name that never runs', code: 'n <- 0\nh <- function(e) n <<- 5\nr <- tryCatch(1, error = h)\nprint(n)' },
			{ name: 'an error handler from a factory', code: 'n <- 0\nmk <- function() function(e) n <<- 1\nr <- tryCatch(stop("x"), error = mk())\nprint(n)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('handlers for the session', () => testing(['exceptions-and-errors', 'higher-order-functions'], () => {
		const muffling = 'function(w) { n <<- 1; invokeRestart("muffleWarning") }';
		const warns = 'f <- function() { warning("w"); 2 }';
		const cases: readonly TransitivityCase[] = [
			{ name: 'a global calling handler', code: `n <- 0\nglobalCallingHandlers(warning = ${muffling})\n${warns}\nr <- f()\nprint(n + r)` },
			{ name: 'a global calling handler by name', code: `n <- 0\nh <- ${muffling}\nglobalCallingHandlers(warning = h)\n${warns}\nr <- f()\nprint(n + r)` },
			{ name: 'a global calling handler in a list', code: `n <- 0\nglobalCallingHandlers(list(warning = ${muffling}))\n${warns}\nr <- f()\nprint(n + r)` },
			{ name: 'a global calling handler registered in a function', code: `n <- 0\nreg <- function() globalCallingHandlers(warning = ${muffling})\nreg()\n${warns}\nr <- f()\nprint(n + r)` },
			{ name: 'a global message handler', code: 'n <- 0\nglobalCallingHandlers(message = function(m) { n <<- 1; invokeRestart("muffleMessage") })\nmessage("hi")\nprint(n)' },
			{ name: 'a global calling handler that never runs', code: 'n <- 0\nglobalCallingHandlers(warning = function(w) n <<- 5)\nprint(n)' },
			{ name: 'a global calling handler registered after the warning', code: `n <- 0\n${warns}\nr <- suppressWarnings(f())\nglobalCallingHandlers(warning = function(w) n <<- 5)\nprint(n)` }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('switch and loops', () => testing(['switch'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'switch selecting a global', code: 'f <- function(t) switch(t, a = x, b = y)\nx <- 1\ny <- 2\nprint(f("b"))' },
			{ name: 'switch fall through', code: 'z <- 3\nprint(switch("a", a = , b = z))' },
			{ name: 'switch selecting a function', code: 'g1 <- function() 1\ng2 <- function() k\nk <- 4\nh <- switch("two", one = g1, two = g2)\nprint(h())' },
			{ name: 'a for loop accumulating', code: 'x <- 0\nfor(i in 1:3) x <- x + i\nprint(x)' },
			{ name: 'a value carried to the next iteration', code: 'a <- 1\nb <- 0\nfor(i in 1:2) { b <- a; a <- 5 }\nprint(b)' },
			{ name: 'a function redefined in a loop', code: 'f <- function() 1\ni <- 0\nwhile(i < 2) { r <- f(); f <- function() 2; i <- i + 1 }\nprint(r)' },
			{ name: 'repeat with break', code: 'i <- 0\nrepeat { i <- i + 1; if(i >= 3) break }\nprint(i)' },
			{ name: 'closures made in a loop with local', code: 'fs <- list()\nfor(i in 1:2) local({ j <- i; fs[[j]] <<- function() j })\nprint(fs[[1]]())' },
			{ name: 'a loop calling a function with a super assignment', code: 'n <- 0\nup <- function() n <<- n + 2\nfor(i in 1:3) up()\nprint(n)' },
			{ name: 'a value carried through three variables in a loop', code: 'a <- 1\nb <- 0\nc0 <- 0\nfor(i in 1:3) { c0 <- b; b <- a; a <- 9 }\nprint(c0)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('values', () => {
		resolvesLikeR(parser, 'switch selecting a global', 'f <- function(t) switch(t, a = x, b = y)\nx <- 1\ny <- 2\nz <- f("b")\ncat(z)', '5@z', { imprecise: 'both branches' });
		resolvesLikeR(parser, 'a for loop accumulating', 'x <- 0\nfor(i in 1:3) x <- x + i\ncat(x)', '3@x', { imprecise: 'unknown after the loop' });
		resolvesLikeR(parser, 'a value carried to the next iteration', 'a <- 1\nb <- 0\nfor(i in 1:2) { b <- a; a <- 5 }\ncat(b)', '3@b', { imprecise: 'resolves 1 and 5, R reads a <- 5 in the last iteration' });
		resolvesLikeR(parser, 'an exit hook overriding a super assignment', 'x <- 1\nf <- function() { on.exit(x <<- 3); x <<- 2 }\nf()\ncat(x)', '4@x');
	});

	describe('global state writes', () => testing(['functions-with-global-side-effects'], () => {
		writesLikeR(parser, 'an option set three calls deep', 'f <- function() g()\ng <- function() h()\nh <- function() options(digits = 3)\nf()\nif(getOption("digits") == 3) cat("ok")', 4, ['#option:digits']);
		writesLikeR(parser, 'an option set by a returned closure', 'mk <- function() function() options(digits = 3)\ns <- mk()\ns()\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits']);
		writesLikeR(parser, 'an option set in an lapply callback', 'invisible(lapply(3, function(d) options(digits = d)))\nif(getOption("digits") == 3) cat("ok")', 1, ['#option:digits']);
		writesLikeR(parser, 'an option set by an S3 method', 'st <- function(o) UseMethod("st")\nst.a <- function(o) options(digits = 3)\nst(structure(1, class = "a"))\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits']);
		writesLikeR(parser, 'an option set by an exit hook two calls deep', 'g <- function() { on.exit(options(digits = 3)); 1 }\nf <- function() g()\nf()\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits']);
		writesLikeR(parser, 'an option set through do.call', 'h <- function() options(digits = 3)\ndo.call(h, list())\nif(getOption("digits") == 3) cat("ok")', 2, ['#option:digits']);
		writesLikeR(parser, 'an option set through a function argument', 'h <- function() options(digits = 3)\nap <- function(fn) fn()\nap(h)\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits']);
		writesLikeR(parser, 'a global bound by a super assignment three calls deep', 'f <- function() g()\ng <- function() h()\nh <- function() zz <<- 1\nf()\nif(exists("zz")) cat("ok")', 4, ['zz']);
		writesLikeR(parser, 'a global bound by assign in a callback', 'invisible(sapply(1, function(i) assign("zz", i, envir = .GlobalEnv)))\nif(exists("zz")) cat("ok")', 1, ['zz']);
		writesLikeR(parser, 'an option set in a recursive function', 'a <- function(n) if(n > 0) a(n - 1) else options(digits = 3)\na(2)\nif(getOption("digits") == 3) cat("ok")', 2, ['#option:digits']);
	}));
}));
