import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, type TransitivityCase } from './transitivity';

describe('Transitivity in corner cases, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'default reads global changed in body', code: 'x <- 1\nf <- function(a = x) { x <<- 2; a }\nprint(f())' },
		{ name: 'promise forced after global change', code: 'x <- 1\nf <- function(a) { x <<- 2; a }\nprint(f(x))' },
		{ name: 'closure sees later local', code: 'f <- function() { x <- 1; g <- function() x; x <- 2; g }\nh <- f()\nprint(h())' },
		{ name: 'separate factory frames', code: 'mk <- function() { v <- 0; function() { v <<- v + 1; v } }\na <- mk()\nb <- mk()\na()\na()\nprint(b())' },
		{ name: 'super assignment hits a parameter', code: 'x <- 0\nf <- function(x) { g <- function() x <<- 5; g(); x }\nf(1)\nprint(x)' },
		{ name: 'assign without envir is local', code: 'f <- function() assign("x", 2)\nx <- 1\nf()\nprint(x)' },
		{ name: 'super assignment in local', code: 'x <- 1\nlocal({ x <<- 2 })\nprint(x)' },
		{ name: 'environment of closure changed', code: 'mk <- function() { v <- 1; function() v }\ng <- mk()\nenvironment(g)$v <- 5\nprint(g())' },
		{ name: 'S4 callNextMethod', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nsetMethod("val", "A", function(o) o@x + k)\nsetMethod("val", "B", function(o) callNextMethod() * 2)\nprint(val(new("B", x = 1)))' },
		{ name: 'an S4 method of a class beside a later one', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nsetMethod("val", "A", function(o) o@x + k)\nsetMethod("val", "B", function(o) 2)\nprint(val(new("A", x = 1)))' },
		{ name: 'S4 callNextMethod through a method from getMethod', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nsetMethod("val", "A", function(o) o@x + k)\nsetMethod("val", "B", function(o) callNextMethod() * 2)\nm <- getMethod("val", "B")\nprint(m(new("B", x = 1)))' },
		{ name: 'S4 callNextMethod two classes deep', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetClass("C", contains = "B")\nsetGeneric("val", function(o, ...) standardGeneric("val"))\nk <- 10\nsetMethod("val", "A", function(o, ...) o@x + k)\nsetMethod("val", "B", function(o, ...) callNextMethod() * 2)\nsetMethod("val", "C", function(o, ...) callNextMethod() + 1)\nprint(val(new("C", x = 1)))' },
		{ name: 'an S4 Arith group method', code: 'setClass("A", representation(x = "numeric"))\nk <- 5\nsetMethod("Arith", signature("A", "A"), function(e1, e2) k)\na <- new("A", x = 1)\nprint(a + a)' },
		{ name: 'an S4 Ops group method for a comparison', code: 'setClass("A", representation(x = "numeric"))\nk <- 5\nsetMethod("Ops", signature("A", "A"), function(e1, e2) k)\na <- new("A", x = 1)\nprint(a < a)' },
		{ name: 'S3 operator with side effect', code: 'cnt <- 0\n"+.money" <- function(e1, e2) { cnt <<- cnt + 1; structure(unclass(e1) + unclass(e2), class = "money") }\na <- structure(1, class = "money")\nb <- a + a\nprint(cnt)' },
		{ name: 'S3 print method reading a global', code: 'print.foo <- function(x, ...) cat("foo", k, "\\n")\nk <- 3\nprint(structure(1, class = "foo"))' },
		{ name: 'on.exit replaced', code: 'f <- function() { on.exit(x <<- 1); on.exit(x <<- 2) }\nf()\nprint(x)' },
		{ name: 'on.exit reads a local changed later', code: 'f <- function() { v <- 1; on.exit(r <<- v); v <- 2 }\nf()\nprint(r)' },
		{ name: 'loop over functions', code: 'a <- 1\nb <- 2\nfs <- list(function() a, function() b)\nfor(f in fs) r <- f()\nprint(r)' },
		{ name: 'delayedAssign', code: 'delayedAssign("v", k * 2)\nk <- 3\nprint(v)' },
		{ name: 'eval in parent frame', code: 'f <- function() eval(quote(x <- 5), parent.frame())\nf()\nprint(x)' },
		{ name: 'function lookup skips non functions', code: 'f <- function() 1\ng <- function() { f <- 2; f() }\nprint(g())' },
		{ name: 'rm of a global in a function', code: 'x <- 1\nf <- function() rm("x", envir = .GlobalEnv)\nf()\nprint(exists("x"))' },
		{ name: 'env var set two calls deep', code: 'f <- function() Sys.setenv(FOO = "a")\ng <- function() f()\ng()\nprint(Sys.getenv("FOO"))' },
		{ name: 'seed set two calls deep', code: 'f <- function() set.seed(1)\ng <- function() f()\ng()\nprint(runif(1))' },
		{ name: 'Reduce with init global', code: 'k <- 5\nprint(Reduce(function(a, b) a + b, 1:3, accumulate = TRUE, k)[4])' },
		{ name: 'Vectorize wrapping', code: 'k <- 2\nf <- function(a) a * k\nvf <- Vectorize(f)\nprint(vf(1:2)[2])' },
		{ name: 'Negate', code: 'lim <- 2\nbig <- function(v) v > lim\nprint(Filter(Negate(big), 1:4))' },
		{ name: 'source local in function', code: 'f <- function() { source("lib.R", local = TRUE); v + 1 }\nprint(f())', files: { 'lib.R': 'v <- 9' } },
		{ name: 'sourced function super assigns', code: 'n <- 0\nsource("lib.R")\nup2()\nprint(n)', files: { 'lib.R': 'up <- function() n <<- 3\nup2 <- function() up()' } },
		{ name: 'do.call with a closure argument', code: 'k <- 3\nap <- function(fn, v) fn(v)\nprint(do.call(ap, list(function(v) v * k, 2)))' },
		{ name: 'lapply over a list of closures', code: 'k <- 4\nfs <- list(function() k)\nprint(lapply(fs, function(f) f())[[1]])' },
		{ name: 'sapply with a call to a super assigning function', code: 'acc <- 0\nadd <- function(v) acc <<- acc + v\ninvisible(sapply(1:3, add))\nprint(acc)' },
		{ name: 'Map calling a closure from a factory', code: 'mk <- function(k) function(a) a * k\nm <- mk(3)\nprint(Map(m, 1:2)[[2]])' },
		{ name: 'tryCatch finally reads a value', code: 'r <- 0\nf <- function() { v <- 4; tryCatch(stop("e"), error = function(e) NULL, finally = r <<- v) }\nf()\nprint(r)' },
		{ name: 'a warning handled by a caller two frames up', code: 'n <- 0\nh <- function() warning("w")\ng <- function() h()\ntryCatch(g(), warning = function(w) n <<- 1)\nprint(n)' },
		{ name: 'stop in a callee skips the rest', code: 'x <- 1\nf <- function() { stop("e"); x <<- 2 }\ntry(f(), silent = TRUE)\nprint(x)' },
		{ name: 'repeat with function changed', code: 'f <- function() 1\ni <- 0\nrepeat { i <- i + 1; r <- f(); if(i == 2) break; f <- function() 2 }\nprint(r)' },
		{ name: 'numeric switch', code: 'a <- 1\nb <- 2\nprint(switch(2, a, b))' },
		{ name: 'switch default', code: 'd <- 5\nprint(switch("z", a = 1, d))' },
		{ name: 'recursion over a list', code: 'k <- 1\ndep <- function(l) if(is.list(l)) 1 + max(sapply(l, dep)) else k\nprint(dep(list(list(1))))' },
		{ name: 'mutual recursion through a higher order call', code: 'k <- 1\na <- function(n) if(n == 0) k else sum(sapply(n - 1, b))\nb <- function(n) a(n)\nprint(a(2))' },
		{ name: 'match.arg default', code: 'f <- function(t = c("x", "y")) { t <- match.arg(t); t }\nprint(f())' },
		{ name: 'a function stored in an environment and called', code: 'e <- new.env()\nk <- 2\ne$f <- function() k\nprint(e$f())' },
		{ name: 'assign of a function and call via get', code: 'k <- 6\nassign("g", function() k)\nprint(get("g")())' },
		{ name: 'sys.function recursion', code: 'f <- function(n) if(n == 0) k else sys.function()(n - 1)\nk <- 3\nprint(f(2))' },
		{ name: 'options read in a nested function', code: 'options(myopt = 7)\nf <- function() getOption("myopt")\ng <- function() f()\nprint(g())' },
		{ name: 'option set in function read in function', code: 'set <- function() options(myopt = 8)\nget1 <- function() getOption("myopt")\nset()\nprint(get1())' },
		{ name: 'local function shadowing a global function', code: 'h <- function() 1\nf <- function() { h <- function() 2; g <- function() h(); g() }\nprint(f())', dropped: 'function() 1', imprecise: 'keeps the shadowed global h' },
		{ name: 'closure capturing loop variable', code: 'fs <- list()\nfor(i in 1:2) fs[[i]] <- function() i\nprint(fs[[1]]())' },
		{ name: 'with modifying via super assignment', code: 'n <- 0\nwith(list(a = 3), n <<- a)\nprint(n)' },
		{ name: 'within', code: 'k <- 2\nd <- data.frame(a = 1)\nd <- within(d, b <- a + k)\nprint(d$b)' },
		{ name: 'Recall in an anonymous function', code: 'k <- 1\nprint(sapply(3, function(n) if(n <= 1) k else n * Recall(n - 1)))' },
		{ name: 'R6 inheritance with super', code: 'library(R6)\nk <- 5\nA <- R6Class("A", public = list(get = function() k))\nB <- R6Class("B", inherit = A, public = list(get = function() super$get() * 2))\nprint(B$new()$get())' },
		{ name: 'a callback registered in an environment', code: 'reg <- new.env()\non <- function(f) assign("cb", f, envir = reg)\nk <- 8\non(function() k)\nprint(reg$cb())', red: 'R prints 8, the slice drops k <- 8 the callback stored by assign reads' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
	resolvesLikeR(parser, 'value of promise forced after global change', 'x <- 1\nf <- function(a) { x <<- 2; a }\ny <- f(x)\ncat(y)', '4@y', { imprecise: 'resolves 1 and 2, R forces the promise after x <<- 2' });
	resolvesLikeR(parser, 'value of default reads global changed in body', 'x <- 1\nf <- function(a = x) { x <<- 2; a }\ny <- f()\ncat(y)', '4@y');
	resolvesLikeR(parser, 'value of super assignment hits a parameter', 'x <- 0\nf <- function(x) { g <- function() x <<- 5; g(); x }\nf(1)\ncat(x)', '4@x');
	resolvesLikeR(parser, 'value of assign without envir is local', 'f <- function() assign("x", 2)\nx <- 1\nf()\ncat(x)', '4@x');
	resolvesLikeR(parser, 'value of super assignment in local', 'x <- 1\nlocal({ x <<- 2 })\ncat(x)', '3@x');
	resolvesLikeR(parser, 'value of closure sees later local', 'f <- function() { x <- 1; g <- function() x; x <- 2; g }\nh <- f()\ny <- h()\ncat(y)', '4@y');
	resolvesLikeR(parser, 'value of separate factory frames', 'mk <- function() { v <- 0; function() { v <<- 1; v } }\na <- mk()\nb <- mk()\ny <- b()\ncat(y)', '5@y', { imprecise: 'resolves 0 and 1, the read follows the super assignment in R' });
	resolvesLikeR(parser, 'value of on.exit reads a local changed later', 'f <- function() { v <- 1; on.exit(r <<- v); v <- 2 }\nf()\ncat(r)', '3@r');
	resolvesLikeR(parser, 'value of on.exit replaced', 'f <- function() { on.exit(x <<- 1); on.exit(x <<- 2) }\nf()\ncat(x)', '3@x');
	resolvesLikeR(parser, 'value of stop in a callee skips the rest', 'x <- 1\nf <- function() { stop("e"); x <<- 2 }\ntry(f(), silent = TRUE)\ncat(x)', '4@x');
	resolvesLikeR(parser, 'value of function lookup skips non functions', 'f <- function() 1\ng <- function() { f <- 2; f() }\ny <- g()\ncat(y)', '3@y', { imprecise: 'resolves 1 and unknown, the call skips the local non-function f' });
	resolvesLikeR(parser, 'value of local function shadowing', 'h <- function() 1\nf <- function() { h <- function() 2; g <- function() h(); g() }\ny <- f()\ncat(y)', '3@y', { imprecise: 'resolves 1 and 2, the inner h shadows the global one' });
	resolvesLikeR(parser, 'value of closure capturing loop variable', 'fs <- list()\nfor(i in 1:2) fs[[i]] <- function() i\ny <- fs[[1]]()\ncat(y)', '3@y', { imprecise: 'unknown, R reads i after the loop' });
	resolvesLikeR(parser, 'value of delayedAssign', 'delayedAssign("v", k * 2)\nk <- 3\ncat(v)', '3@v', { imprecise: 'unknown, the delayed binding is not resolved' });
	resolvesLikeR(parser, 'value of numeric switch', 'a <- 1\nb <- 2\ny <- switch(2, a, b)\ncat(y)', '4@y', { imprecise: 'unknown, a numeric switch is not resolved' });
	resolvesLikeR(parser, 'value of Map closure', 'mk <- function(k) function(a) a * k\nm <- mk(3)\ny <- m(2)\ncat(y)', '4@y');
}));
