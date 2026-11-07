import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, type TransitivityCase } from './transitivity';

describe('Transitivity through late forcing, evaluation and operator dispatch, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'a promise forced after a sibling call sets its variable', code: 'f <- function(a) { g(); a }\ng <- function() x <<- 3\nx <- 0\nprint(f(x))', red: 'R prints 3 as a is forced after g(), the slice drops g() and prints 0' },
		{ name: 'a default reading a local set before forcing', code: 'f <- function(a = v) { v <- 2; a }\nv <- 1\nprint(f())' },
		{ name: 'a promise forced in an exit hook', code: 'f <- function(a) { on.exit(r <<- a); x <<- 5; invisible() }\nx <- 1\nf(x)\nprint(r)', red: 'R prints 5 as the exit hook forces a after x <<- 5, the slice drops x <<- 5' },
		{ name: 'a promise forced in finally', code: 'f <- function(a) tryCatch(x <<- 5, finally = r <<- a)\nx <- 1\nf(x)\nprint(r)' },
		{ name: 'substitute does not force', code: 'x <- 1\nf <- function(a) deparse(substitute(a))\nf(x <- 5)\nprint(x)', dropped: 'x <- 5', imprecise: 'keeps x <- 5 which substitute never forces' },
		{ name: 'exit hooks put first', code: 'f <- function() { on.exit(x <<- 1); on.exit(x <<- 2, add = TRUE, after = FALSE) }\nf()\nprint(x)' },
		{ name: 'a seed set in an lapply callback', code: 'invisible(lapply(1, function(i) set.seed(42)))\nprint(runif(1))' },
		{ name: 'a working directory restored by an exit hook', code: 'dir.create("sub")\nf <- function() { old <- setwd("sub"); on.exit(setwd(old)); 1 }\nf()\nprint(basename(getwd()))' },
		{ name: 'a package attached in a function', code: 'f <- function() library(R6)\nf()\nprint(exists("R6Class"))' },
		{ name: 'a list attached in a function', code: 'f <- function() attach(list(qq = 3), name = "x")\nf()\nprint(qq)' },
		{ name: 'suppressWarnings around a call', code: 'n <- 0\nf <- function() n <<- 1\nsuppressWarnings(f())\nprint(n)' },
		{ name: 'local around a call', code: 'n <- 0\nf <- function() n <<- 1\nlocal(f())\nprint(n)' },
		{ name: 'eval of a constructed call', code: 'n <- 0\nf <- function() n <<- 1\neval(call("f"))\nprint(n)' },
		{ name: 'eval of a call constructed before', code: 'n <- 0\nf <- function(v) n <<- v\ncl <- call("f", 5)\neval(cl)\nprint(n)' },
		{ name: 'eval of a call constructed with a computed name', code: 'n <- 0\nf <- function() n <<- 1\nnm <- "f"\neval(call(nm))\nprint(n)' },
		{ name: 'eval of a call constructed by as.call', code: 'n <- 0\nf <- function() n <<- 1\neval(as.call(list(as.name("f"))))\nprint(n)' },
		{ name: 'eval of a call constructed from a parameter', code: 'k <- 3\nh <- function() k\nrun <- function(nm) eval(call(nm))\nprint(run("h"))' },
		{ name: 'Map calling stored functions', code: 'n <- 0\ng <- function() n <<- 2\ninvisible(Map(function(f) f(), list(g)))\nprint(n)' },
		{ name: 'match.fun on a parameter', code: 'ap <- function(f) { f <- match.fun(f); f() }\nk <- 3\nh <- function() k\nprint(ap("h"))' },
		{ name: 'match.fun on a parameter handed down', code: 'ap <- function(f) { f <- match.fun(f); f() }\nouter <- function(g) ap(g)\nk <- 3\nh <- function() k\nprint(outer("h"))' },
		{ name: 'do.call of a parameter holding a name', code: 'ap <- function(f) do.call(f, list())\nk <- 3\nh <- function() k\nprint(ap("h"))' },
		{ name: 'sapply of a parameter holding a name', code: 'ap <- function(f) sapply(1, f)\nk <- 3\nh <- function(x) k\nprint(ap("h"))' },
		{ name: 'a function stored in an option', code: 'options(cb = function() k)\nk <- 4\nprint(getOption("cb")())' },
		{ name: 'a function stored in an attribute', code: 'x <- structure(1, fn = function() k)\nk <- 2\nprint(attr(x, "fn")())' },
		{ name: 'local into an environment', code: 'e <- new.env()\nlocal({ v <- 3; f <- function() v }, envir = e)\nprint(e$f())' },
		{ name: 'evalq defining a function', code: 'e <- new.env()\nk <- 5\nevalq(f <- function() k, e)\nprint(e$f())', red: 'R prints 5, the slice drops k <- 5 the function defined by evalq reads' },
		{ name: 'a format method', code: 'format.foo <- function(x, ...) paste0("k=", k)\nk <- 3\ncat(format(structure(1, class = "foo")), "\\n")' },
		{ name: 'a subset method', code: '"[.foo" <- function(x, i) k\nk <- 8\no <- structure(list(), class = "foo")\nprint(o[1])' },
		{ name: 'a dollar method', code: '"$.foo" <- function(x, name) k\nk <- 8\no <- structure(list(), class = "foo")\nprint(o$a)' },
		{ name: 'an Ops group generic', code: 'Ops.foo <- function(e1, e2) k\nk <- TRUE\no <- structure(1, class = "foo")\nprint(o == 2)' },
		{ name: 'an Ops group generic on the right operand', code: 'Ops.foo <- function(e1, e2) k\nk <- 4\no <- structure(1, class = "foo")\nprint(2 + o)' },
		{ name: 'a unary Ops group generic', code: 'Ops.foo <- function(e1, e2) k\nk <- 5\no <- structure(1, class = "foo")\nprint(!o)' },
		{ name: 'an Ops group generic of a superclass in a function', code: 'Ops.foo <- function(e1, e2) k\nk <- 6\nf <- function(a) a < 1\nprint(f(structure(1, class = c("bar", "foo"))))' },
		{ name: 'a Math group generic for round', code: 'Math.foo <- function(x, ...) k\nk <- 7\nprint(round(structure(1.5, class = "foo")))' },
		{ name: 'a Summary group generic', code: 'Summary.foo <- function(..., na.rm = FALSE) k\nk <- 8\nprint(sum(structure(1, class = "foo")))' },
		{ name: 'a length method', code: 'length.foo <- function(x) k\nk <- 7L\nprint(length(structure(list(), class = "foo")))' },
		{ name: 'a method defined before its generic', code: 'sz.box <- function(o) k\nk <- 2\nsz <- function(o) UseMethod("sz")\nprint(sz(structure(1, class = "box")))' },
		{ name: 'an as.character method in paste', code: 'as.character.foo <- function(x, ...) k\nk <- "z"\nprint(as.character(structure(1, class = "foo")))' },
		{ name: 'an S3 method stored by assign', code: 'assign("sz.box", function(o) k)\nk <- 2\nsz <- function(o) UseMethod("sz")\nprint(sz(structure(1, class = "box")))' },
		{ name: 'Reduce from the right', code: 'k <- 1\nprint(Reduce(function(a, b) a - b + k, 1:3, right = TRUE))' },
		{ name: 'environment of a function set to a later changed env', code: 'e <- new.env()\nf <- function() v\nenvironment(f) <- e\nassign("v", 6, envir = e)\nprint(f())' },
		{ name: 'a function returned from tryCatch', code: 'k <- 3\nh <- tryCatch(stop("e"), error = function(e) function() k)\nprint(h())' },
		{ name: 'a super assignment in a handler of a nested function', code: 'n <- 0\nf <- function() tryCatch(stop("e"), error = function(e) n <<- 4)\ng <- function() f()\ng()\nprint(n)' },
		{ name: 'a call through identity', code: 'n <- 0\nf <- function() n <<- 1\nidentity(f())\nprint(n)' },
		{ name: 'a function returned by Reduce', code: 'k <- 2\ncomp <- Reduce(function(f, g) function(x) g(f(x)), list(function(x) x + 1, function(x) x * k))\nprint(comp(1))' },
		{ name: 'a function returned by Reduce from the right', code: 'k <- 2\ncomp <- Reduce(function(g, acc) function(x) g(acc(x)), list(function(x) x * k, function(x) x + 1), right = TRUE)\nprint(comp(1))' },
		{ name: 'a function returned by Reduce with an initial one', code: 'k <- 2\ncomp <- Reduce(function(acc, g) function(x) g(acc(x)), list(function(x) x * k), function(x) x)\nprint(comp(1))' },
		{ name: 'a closure over a dots argument', code: 'mk <- function(...) function() sum(...)\nk <- 4\ng <- mk(k, 1)\nprint(g())' },
		{ name: 'a super assignment to a list element', code: 'l <- list(a = 1)\nf <- function() l$a <<- 5\ng <- function() f()\ng()\nprint(l$a)' },
		{ name: 'a replacement function', code: '"inc<-" <- function(x, value) x + value + k\nk <- 1\ny <- 1\ninc(y) <- 2\nprint(y)' },
		{ name: 'a replacement function called in a function', code: '"inc<-" <- function(x, value) x + value\ny <- 1\nf <- function() inc(y) <<- 2\nf()\nprint(y)' },
		{ name: 'vapply over a function list reading globals', code: 'a <- 1\nb <- 2\nprint(sum(vapply(list(function() a, function() b), function(f) f(), numeric(1))))' },
		{ name: 'a closure capturing a promise to a global changed later', code: 'mk <- function(v) function() v\nx <- 1\ng <- mk(x)\nx <- 2\nprint(g())' },
		{ name: 'a function list built in a loop', code: 'fs <- list()\nfor(i in 1:2) { local({ j <- i; fs[[j]] <<- function() j * k }) }\nk <- 10\nprint(fs[[2]]())' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
	resolvesLikeR(parser, 'value of promise forced after sibling', 'f <- function(a) { g(); a }\ng <- function() x <<- 3\nx <- 0\ny <- f(x)\ncat(y)', '5@y', { red: 'R prints 3 as a is forced after g(), flowR resolves only 0' });
	resolvesLikeR(parser, 'value of default reading a local', 'f <- function(a = v) { v <- 2; a }\nv <- 1\ny <- f()\ncat(y)', '4@y');
	resolvesLikeR(parser, 'value of exit hooks put first', 'f <- function() { on.exit(x <<- 1); on.exit(x <<- 2, add = TRUE, after = FALSE) }\nf()\ncat(x)', '3@x', { imprecise: 'resolves 1 and 2, R runs the hook put first before the other' });
	resolvesLikeR(parser, 'value of substitute does not force', 'x <- 1\nf <- function(a) deparse(substitute(a))\nf(x <- 5)\ncat(x)', '4@x', { imprecise: 'resolves 1 and 5, substitute never forces the argument' });
	resolvesLikeR(parser, 'value of a function in an option', 'options(cb = function() 4)\ny <- getOption("cb")()\ncat(y)', '3@y', { imprecise: 'unknown, a function stored in an option is not resolved' });
	resolvesLikeR(parser, 'value of super assignment to a list element', 'l <- list(a = 1)\nf <- function() l$a <<- 5\nf()\ny <- l$a\ncat(y)', '5@y', { imprecise: 'unknown, the list element changed by a super assignment is not resolved' });
	resolvesLikeR(parser, 'value of closure over promise to a global changed later', 'mk <- function(v) function() v\nx <- 1\ng <- mk(x)\nx <- 2\ny <- g()\ncat(y)', '6@y');
	resolvesLikeR(parser, 'value of env of a function set later', 'e <- new.env()\nf <- function() v\nenvironment(f) <- e\nassign("v", 6, envir = e)\ny <- f()\ncat(y)', '6@y');
}));
