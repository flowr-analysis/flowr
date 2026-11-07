import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, writesLikeR, type TransitivityCase } from './transitivity';

describe('Transitivity through call cycles, stored callbacks and late forcing, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'side effect in a call cycle', code: 'n <- 0\na <- function(k) if(k > 0) b(k - 1)\nb <- function(k) c2(k)\nc2 <- function(k) { n <<- n + 1; a(k) }\na(2)\nprint(n)' },
		{ name: 'option in a call cycle', code: 'a <- function(k) if(k > 0) b(k - 1)\nb <- function(k) { if(k == 0) options(digits = 3); a(k) }\na(1)\nprint(pi)' },
		{ name: 'six calls in reverse order', code: 'n <- 0\nf1 <- function() f2()\nf2 <- function() f3()\nf3 <- function() f4()\nf4 <- function() f5()\nf5 <- function() f6()\nf6 <- function() n <<- 1\nf1()\nprint(n)' },
		{ name: 'callee redefined before the second call', code: 'n <- 0\ng <- function() 1\nf <- function() g()\nr1 <- f()\ng <- function() n <<- 2\nf()\nprint(n)' },
		{ name: 'a function defined by a super assignment', code: 'setup <- function() h <<- function() k\nk <- 4\nsetup()\nprint(h())' },
		{ name: 'a function defined by a super assignment two levels down', code: 'outer <- function() { inner <- function() g <<- function() 7; inner() }\nouter()\nprint(g())' },
		{ name: 'a callback stored in a closure frame', code: 'mk <- function() { cb <- NULL; list(set = function(f) cb <<- f, run = function() cb()) }\no <- mk()\nk <- 3\no$set(function() k)\nprint(o$run())' },
		{ name: 'a method from a returned list', code: 'mk <- function() list(inc = function() n <<- n + 1)\nn <- 0\nmk()$inc()\nprint(n)' },
		{ name: 'a function applied recursively', code: 'apply_n <- function(f, n, x) if(n == 0) x else apply_n(f, n - 1, f(x))\nk <- 2\nprint(apply_n(function(v) v * k, 3, 1))' },
		{ name: 'a default function argument', code: 'f <- function(cb = function() n <<- 1) cb()\nn <- 0\nf()\nprint(n)' },
		{ name: 'a default calling a global function', code: 'g <- function() n <<- 5\nf <- function(a = g()) a\nn <- 0\nf()\nprint(n)' },
		{ name: 'a function passed in dots', code: 'ap <- function(...) { fs <- list(...); fs[[1]]() }\nk <- 9\nprint(ap(function() k))' },
		{ name: 'a promise forced after a nested super assignment', code: 'f <- function(a) g(a)\ng <- function(b) { x <<- 1; b }\nx <- 0\nprint(f(x))', red: 'R prints 1 as g forces the promise after x <<- 1, the slice drops x <<- 1 and prints 0' },
		{ name: 'promises forced out of order', code: 'f <- function(a, b) { b; a }\nn <- 0\nprint(f(n, n <- 4))' },
		{ name: 'Reduce over closures', code: 'k <- 1\nadders <- lapply(1:3, function(i) function(x) x + i + k)\nprint(Reduce(function(acc, f) f(acc), adders, 0))' },
		{ name: 'a super assignment into a local frame', code: 'r <- local({ v <- 1; f <- function() v <<- 5; f(); v })\nprint(r)' },
		{ name: 'S3 dispatch on a class made by a function', code: 'mk <- function() structure(list(), class = "z")\ndsc <- function(o) UseMethod("dsc")\ndsc.z <- function(o) k\nk <- 6\nprint(dsc(mk()))' },
		{ name: 'S3 dispatch on an inherited class', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\nk <- 6\nprint(dsc(structure(1, class = c("b", "a"))))' },
		{ name: 'NextMethod with a side effect', code: 'n <- 0\nf <- function(x) UseMethod("f")\nf.b <- function(x) NextMethod()\nf.a <- function(x) n <<- 3\nf(structure(1, class = c("b", "a")))\nprint(n)' },
		{ name: 'do.call of a generic by name', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\nk <- 6\nprint(do.call("dsc", list(structure(1, class = "a"))))' },
		{ name: 'a loop calling a function redefined in it', code: 'n <- 0\nf <- function() 0\nfor(i in 1:2) { f(); f <- function() n <<- n + 5 }\nprint(n)' },
		{ name: 'a while condition with a closure counter', code: 'mk <- function() { i <- 0; function() { i <<- i + 1; i } }\nnx <- mk()\nwhile(nx() < 3) {}\nprint(nx())' },
		{ name: 'an environment read three calls deep', code: 'e <- new.env()\ne$v <- 2\nf <- function(x) g(x)\ng <- function(y) h(y)\nh <- function(z) z$v\nprint(f(e))' },
		{ name: 'a returned environment changed by another function', code: 'mk <- function() { e <- new.env(); e$v <- 1; e }\nset <- function(e) e$v <- 3\nx <- mk()\nset(x)\nprint(x$v)' },
		{ name: 'assign into the environment of a closure', code: 'mk <- function() { v <- 1; function() v }\ng <- mk()\nassign("v", 4, envir = environment(g))\nprint(g())' },
		{ name: 'assign into parent.frame(2)', code: 'f <- function() g()\ng <- function() assign("z", 1, envir = parent.frame(2))\nf()\nprint(z)' },
		{ name: 'an error three calls deep handled with a global', code: 'k <- 2\nf <- function() g()\ng <- function() h()\nh <- function() stop("e")\nprint(tryCatch(f(), error = function(e) k))' },
		{ name: 'finally in a nested function', code: 'n <- 0\nf <- function() tryCatch(1, finally = n <<- 7)\ng <- function() f()\ng()\nprint(n)' },
		{ name: 'purrr walk with a side effect', code: 'library(purrr)\nn <- 0\nwalk(1:3, function(i) n <<- n + i)\nprint(n)', sigdb: true },
		{ name: 'outer with a closure', code: 'k <- 1\nprint(outer(1:2, 1:2, function(a, b) a + b + k)[2, 2])' },
		{ name: 'apply with a closure', code: 'k <- 10\nm <- matrix(1:4, 2)\nprint(apply(m, 1, function(r) sum(r) + k)[1])' },
		{ name: 'mapply with MoreArgs', code: 'k <- 1\nprint(mapply(function(a, b) a * b + k, 1:2, MoreArgs = list(b = 3))[2])' },
		{ name: 'Find', code: 'lim <- 2\nprint(Find(function(v) v > lim, 1:4))' },
		{ name: 'a signalled condition', code: 'k <- 3\nprint(withCallingHandlers(tryCatch(signalCondition(simpleCondition("m")), condition = function(c) k)))' },
		{ name: 'switch returning a function with a side effect', code: 'n <- 0\nh <- switch("b", a = function() 1, b = function() n <<- 2)\nh()\nprint(n)' },
		{ name: 'switch falling back to a function with a side effect', code: 'n <- 0\nh <- switch("z", a = function() 1, function() n <<- 2)\nh()\nprint(n)' },
		{ name: 'switch in a function returning a function with a side effect', code: 'n <- 0\npick <- function(t) switch(t, a = function() 1, b = function() n <<- 2)\npick("b")()\nprint(n)' },
		{ name: 'Map over a function chosen by switch', code: 'k <- 3\nf <- switch("a", a = function(v) v * k)\nprint(Map(f, 1:2)[[2]])' },
		{ name: 'repeat with next', code: 'i <- 0\ns <- 0\nrepeat { i <- i + 1; if(i == 2) next; s <- s + i; if(i >= 3) break }\nprint(s)' },
		{ name: 'a local closure seeing a later local change', code: 'g <- local({ v <- 1; f <- function() v; v <- 2; f })\nprint(g())' },
		{ name: 'a super assignment through Recall', code: 'n <- 0\nf <- function(k) { n <<- n + 1; if(k > 0) Recall(k - 1) }\nf(2)\nprint(n)' },
		{ name: 'a closure from a recursive factory', code: 'mk <- function(d) if(d == 0) function() k else mk(d - 1)\nk <- 5\nprint(mk(3)())' },
		{ name: 'an S4 method with a side effect', code: 'n <- 0\nsetGeneric("go", function(o) standardGeneric("go"))\nsetClass("T", representation(v = "numeric"))\nsetMethod("go", "T", function(o) n <<- o@v)\ngo(new("T", v = 4))\nprint(n)' },
		{ name: 'an S4 validity function reading a global', code: 'lim <- 0\nsetClass("P", representation(v = "numeric"), validity = function(object) if(object@v < lim) "neg" else TRUE)\nr <- tryCatch({ new("P", v = -1); "ok" }, error = function(e) "bad")\nprint(r)' },
		{ name: 'an S4 validity function set by setValidity', code: 'lim <- 0\nsetClass("P", representation(v = "numeric"))\nsetValidity("P", function(object) if(object@v < lim) "neg" else TRUE)\nr <- tryCatch({ new("P", v = -1); "ok" }, error = function(e) "bad")\nprint(r)' },
		{ name: 'an S4 validity function with a side effect', code: 'n <- 0\nsetClass("P", representation(v = "numeric"), validity = function(object) { n <<- n + 1; TRUE })\nx <- new("P", v = 1)\nprint(n)' },
		{ name: 'an S4 validity function of a superclass', code: 'lim <- 0\nsetClass("P", representation(v = "numeric"), validity = function(object) if(object@v < lim) "neg" else TRUE)\nsetClass("Q", contains = "P")\nr <- tryCatch({ new("Q", v = -1); "ok" }, error = function(e) "bad")\nprint(r)' },
		{ name: 'an S4 initialize method run by new', code: 'n <- 0\nsetClass("P", representation(v = "numeric"))\nsetMethod("initialize", "P", function(.Object, ...) { n <<- 1; callNextMethod(.Object, ...) })\nx <- new("P", v = 1)\nprint(n)' },
		{ name: 'an R6 active field', code: 'library(R6)\nk <- 3\nC <- R6Class("C", active = list(v = function() k * 2))\nprint(C$new()$v)' },
		{ name: 'an R6 initialize reading a global', code: 'library(R6)\nk <- 3\nC <- R6Class("C", public = list(v = NULL, initialize = function() self$v <- k))\nprint(C$new()$v)' },
		{ name: 'an R6 method with a super assignment through a field function', code: 'library(R6)\nn <- 0\nC <- R6Class("C", public = list(go = function() helper()))\nhelper <- function() n <<- 4\nC$new()$go()\nprint(n)' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
	resolvesLikeR(parser, 'value of promise after nested super assignment', 'f <- function(a) g(a)\ng <- function(b) { x <<- 1; b }\nx <- 0\ny <- f(x)\ncat(y)', '5@y', { imprecise: 'resolves 0 and unknown, R forces the promise after x <<- 1' });
	resolvesLikeR(parser, 'value of promises forced out of order', 'f <- function(a, b) { b; a }\nn <- 0\ny <- f(n, n <- 4)\ncat(y)', '4@y', { red: 'R prints 4 as b is forced before a, flowR resolves only 0' });
	resolvesLikeR(parser, 'value of function defined by super assignment', 'setup <- function() h <<- function() 4\nsetup()\ny <- h()\ncat(y)', '4@y');
	resolvesLikeR(parser, 'value of callee redefined', 'g <- function() 1\nf <- function() g()\ng <- function() 2\ny <- f()\ncat(y)', '5@y', { imprecise: 'resolves 2 and unknown' });
	resolvesLikeR(parser, 'value of local closure later change', 'g <- local({ v <- 1; f <- function() v; v <- 2; f })\ny <- g()\ncat(y)', '3@y');
	resolvesLikeR(parser, 'value of super assignment into a local frame', 'r <- local({ v <- 1; f <- function() v <<- 5; f(); v })\ncat(r)', '2@r');
	resolvesLikeR(parser, 'value of assign into a closure env', 'mk <- function() { v <- 1; function() v }\ng <- mk()\nassign("v", 4, envir = environment(g))\ny <- g()\ncat(y)', '5@y', { imprecise: 'resolves 1 and 4, the body of the closure reads v of every frame mk creates, the assign changes only that of g' });
	writesLikeR(parser, 'option in a call cycle', 'a <- function(k) if(k > 0) b(k - 1)\nb <- function(k) { if(k == 0) options(digits = 3); a(k) }\na(1)\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits']);
	writesLikeR(parser, 'option via a function defined by super assignment', 'setup <- function() h <<- function() options(digits = 3)\nsetup()\nh()\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits']);
	writesLikeR(parser, 'option via a callback stored in a closure', 'mk <- function() { cb <- NULL; list(set = function(f) cb <<- f, run = function() cb()) }\no <- mk()\no$set(function() options(digits = 3))\no$run()\nif(getOption("digits") == 3) cat("ok")', 4, ['#option:digits']);
	writesLikeR(parser, 'option via an S4 method', 'setGeneric("go", function(o) standardGeneric("go"))\nsetClass("T", representation(v = "numeric"))\nsetMethod("go", "T", function(o) options(digits = o@v))\ngo(new("T", v = 3))\nif(getOption("digits") == 3) cat("ok")', 4, ['#option:digits']);
	writesLikeR(parser, 'option via an R6 method', 'library(R6)\nC <- R6Class("C", public = list(go = function() options(digits = 3)))\no <- C$new()\no$go()\nif(getOption("digits") == 3) cat("ok")', 4, ['#option:digits']);
	writesLikeR(parser, 'option via a default argument', 'f <- function(a = options(digits = 3)) a\nf()\nif(getOption("digits") == 3) cat("ok")', 2, ['#option:digits']);
	writesLikeR(parser, 'option via a promise forced deep', 'f <- function(a) g(a)\ng <- function(b) b\nf(options(digits = 3))\nif(getOption("digits") == 3) cat("ok")', 3, ['#option:digits']);
	writesLikeR(parser, 'option in a tryCatch handler', 'tryCatch(stop("e"), error = function(e) options(digits = 3))\nif(getOption("digits") == 3) cat("ok")', 1, ['#option:digits']);
	writesLikeR(parser, 'global variable via assign in parent.frame', 'f <- function() assign("zz", 1, envir = parent.frame())\nf()\nif(exists("zz")) cat("ok")', 2, ['zz']);
}));
