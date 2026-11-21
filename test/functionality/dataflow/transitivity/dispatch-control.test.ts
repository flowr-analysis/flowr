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

	describe('S3 dispatch narrowed by the class of the object', () => testing(['oop-s3-dispatch', 'oop-s3-inheritance'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an S3 method of another class is not run', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\nk <- 6\nj <- 7\nprint(dsc(structure(1, class = "a")))', dropped: 'j <- 7' },
			{ name: 'NextMethod skips a class the vector does not hold', code: 'f <- function(x) UseMethod("f")\nf.c <- function(x) NextMethod()\nf.b <- function(x) j\nf.a <- function(x) k\nk <- 6\nj <- 7\nprint(f(structure(1, class = c("c", "a"))))', dropped: 'j <- 7' },
			{ name: 'an S3 class set by class<- replaces the implicit one', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.double <- function(o) j\nk <- 6\nj <- 7\nx <- 1\nclass(x) <- "a"\nprint(dsc(x))', dropped: 'j <- 7' },
			{ name: 'an S3 object from a constructor handed down two calls', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\nk <- 6\nj <- 7\nmk <- function() structure(list(), class = "a")\nwrap <- function(v) dsc(v)\nouter <- function(w) wrap(w)\nprint(outer(mk()))', dropped: 'j <- 7' },
			{ name: 'a conditional class<- keeps both methods', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\nk <- 6\nj <- 7\nx <- structure(1, class = "a")\nif(runif(1) > 2) class(x) <- "b"\nprint(dsc(x))' },
			{ name: 'an S3 group method of the class of an operand', code: 'Ops.money <- function(e1, e2) k\nOps.other <- function(e1, e2) j\nk <- 6\nj <- 7\na <- structure(1, class = "money")\nprint(a + a)', dropped: 'j <- 7' },
			{ name: 'a print method handing on with NextMethod', code: 'print.zz <- function(x, ...) { cat("zz", k, "\\n"); NextMethod() }\nprint.yy <- function(x, ...) cat("yy", j, "\\n")\nprint.ww <- function(x, ...) cat("ww", m, "\\n")\nk <- 1\nj <- 2\nm <- 3\nprint(structure(1, class = c("zz", "yy")))', dropped: 'm <- 3' },
			{ name: 'NextMethod of objects of two class vectors', code: 'f <- function(x) UseMethod("f")\nf.c <- function(x) NextMethod()\nf.b <- function(x) j\nf.a <- function(x) k\nf.default <- function(x) m\nk <- 6\nj <- 7\nm <- 8\nr <- f(structure(1, class = c("c", "a")))\nprint(r + f(structure(1, class = "c")))', dropped: 'j <- 7' },
			{ name: 'a generic called for another class at another call', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\nk <- 6\nj <- 7\nr <- dsc(structure(1, class = "b"))\nprint(dsc(structure(1, class = "a")))', dropped: 'dsc.b' },
			{ name: 'a generic called for two classes in one expression', code: 'f <- function(x) UseMethod("f")\nf.a <- function(x) k\nf.b <- function(x) j\nk <- 6\nj <- 7\nr <- f(structure(1, class = "b"))\nprint(r + f(structure(1, class = "a")))' },
			{ name: 'methods with side effects run per call', code: 'n <- 0\nf <- function(x) UseMethod("f")\nf.a <- function(x) n <<- n + 1\nf.b <- function(x) n <<- n + 100\nf(structure(1, class = "b"))\nf(structure(1, class = "a"))\nprint(n)' },
			{ name: 'a generic handed on as a value keeps every method', code: 'f <- function(x) UseMethod("f")\nf.a <- function(x) k\nf.b <- function(x) j\nk <- 6\nj <- 7\nh <- f\nr <- f(structure(1, class = "a"))\nprint(h(structure(1, class = "b")) + r)' },
			{ name: 'a generic applied by sapply keeps every method', code: 'f <- function(x) UseMethod("f")\nf.a <- function(x) k\nf.b <- function(x) j\nk <- 6\nj <- 7\nr <- f(structure(1, class = "a"))\ns <- sapply(list(structure(1, class = "b")), f)\nprint(s + r)' },
			{ name: 'a recursive method of another class is not run', code: 'sz <- function(o) UseMethod("sz")\nsz.leaf <- function(o) k\nsz.node <- function(o) sz(o$child) + j\nk <- 1\nj <- 10\nleaf <- structure(list(), class = "leaf")\nr <- sz(structure(list(child = leaf), class = "node"))\nprint(sz(leaf))', dropped: 'j <- 10' },
			{ name: 'a built-in generic in a function called for two classes', code: 'print.zz <- function(x, ...) cat("zz", k, "\\n")\nprint.yy <- function(x, ...) cat("yy", j, "\\n")\nk <- 1\nj <- 2\nshow_it <- function(v) print(v)\nr <- show_it(structure(1, class = "yy"))\ninvisible(show_it(structure(1, class = "zz")))', dropped: 'j <- 2' },
			{ name: 'a generic bound to two names, one handed on', code: 'f.a <- function(x) k\nf.b <- function(x) j\nk <- 6\nj <- 7\nf <- g <- function(x) UseMethod("f")\nh <- f\nr <- g(structure(1, class = "a"))\nprint(h(structure(1, class = "b")) + r)' },
			{ name: 'a generic called by do.call keeps every method', code: 'f <- function(x) UseMethod("f")\nf.a <- function(x) k\nf.b <- function(x) j\nk <- 6\nj <- 7\nr <- f(structure(1, class = "a"))\nprint(do.call("f", list(structure(1, class = "b"))) + r)' },
			{ name: 'a generic found by get keeps every method', code: 'f <- function(x) UseMethod("f")\nf.a <- function(x) k\nf.b <- function(x) j\nk <- 6\nj <- 7\nr <- f(structure(1, class = "a"))\nprint(get("f")(structure(1, class = "b")) + r)' },
			{ name: 'NextMethod decided per call of the generic', code: 'f <- function(x) UseMethod("f")\nf.c <- function(x) NextMethod()\nf.b <- function(x) j\nf.a <- function(x) k\nk <- 6\nj <- 7\nr <- f(structure(1, class = c("c", "b")))\nprint(f(structure(1, class = c("c", "a"))))', dropped: 'j <- 7' },
			{ name: 'NextMethod decided per call of a function calling the generic', code: 'f <- function(x) UseMethod("f")\nf.c <- function(x) NextMethod()\nf.b <- function(x) j\nf.a <- function(x) k\nk <- 6\nj <- 7\nw <- function(v) f(v)\nr <- w(structure(1, class = c("c", "b")))\nprint(w(structure(1, class = c("c", "a"))))', dropped: 'j <- 7' },
			{ name: 'a NextMethod chain decided per call', code: 'f <- function(x) UseMethod("f")\nf.c <- function(x) NextMethod()\nf.b <- function(x) NextMethod()\nf.a <- function(x) k\nf.d <- function(x) j\nk <- 6\nj <- 7\nr <- f(structure(1, class = c("c", "b", "d")))\nprint(f(structure(1, class = c("c", "b", "a"))))', dropped: 'j <- 7' },
			{ name: 'a NextMethod chain for two class vectors', code: 'f <- function(x) UseMethod("f")\nf.c <- function(x) NextMethod()\nf.b <- function(x) NextMethod()\nf.a <- function(x) k\nf.d <- function(x) j\nk <- 6\nj <- 7\nr <- f(structure(1, class = c("c", "b", "d")))\nprint(r + f(structure(1, class = c("c", "b", "a"))))' },
			{ name: 'a generic called through a function for two classes', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\nk <- 6\nj <- 7\ng <- function(v) dsc(v)\nr <- g(structure(1, class = "b"))\nprint(g(structure(1, class = "a")))', dropped: 'j <- 7' },
			{ name: 'a generic called through two functions for two classes', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\nk <- 6\nj <- 7\ng <- function(v) dsc(v)\nh <- function(w) g(w)\nr <- h(structure(1, class = "b"))\nprint(h(structure(1, class = "a")))', dropped: 'j <- 7' },
			{ name: 'a generic called through three functions for two classes keeps both', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\nk <- 6\nj <- 7\ng <- function(v) dsc(v)\nh <- function(w) g(w)\ni <- function(u) h(u)\nr <- i(structure(1, class = "b"))\nprint(i(structure(1, class = "a")))' },
			{ name: 'methods with side effects run per call three calls deep', code: 'n <- 0\ndsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) n <<- n + 1\ndsc.b <- function(o) n <<- n + 10\ng <- function(v) dsc(v)\nh <- function(w) g(w)\ni <- function(u) h(u)\ni(structure(1, class = "b"))\ni(structure(1, class = "a"))\ncat(n)' },
			{ name: 'a generic called through a recursive function keeps both', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\nk <- 6\nj <- 7\ng <- function(v, d) if(d > 0) g(v, d - 1) else dsc(v)\nr <- g(structure(1, class = "b"), 2)\nprint(g(structure(1, class = "a"), 2))' },
			{ name: 'a generic called through a function both values reach', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\nk <- 6\nj <- 7\ng <- function(v) dsc(v)\nr <- g(structure(1, class = "b"))\nprint(r + g(structure(1, class = "a")))' },
			{ name: 'a generic called through functions for three classes', code: 'dsc <- function(o) UseMethod("dsc")\ndsc.a <- function(o) k\ndsc.b <- function(o) j\ndsc.c <- function(o) m\nk <- 6\nj <- 7\nm <- 8\ng <- function(v) dsc(v)\nh <- function(w) g(w)\nr <- g(structure(1, class = "c"))\ns <- h(structure(1, class = "b"))\nprint(h(structure(1, class = "a")))', dropped: 'm <- 8' },
			{ name: 'UseMethod dispatching on another argument', code: 'f <- function(x, y) UseMethod("f", y)\nf.a <- function(x, y) k\nf.b <- function(x, y) j\nk <- 6\nj <- 7\nprint(f(structure(1, class = "b"), structure(1, class = "a")))', dropped: 'j <- 7' },
			{ name: 'UseMethod dispatching on a named object', code: 'f <- function(x, y) UseMethod(object = y, generic = "f")\nf.a <- function(x, y) k\nf.b <- function(x, y) j\nk <- 6\nj <- 7\nprint(f(structure(1, class = "b"), structure(1, class = "a")))', dropped: 'j <- 7' },
			{ name: 'UseMethod dispatching on another argument per call', code: 'f <- function(x, y) UseMethod("f", y)\nf.a <- function(x, y) k\nf.b <- function(x, y) j\nk <- 6\nj <- 7\nr <- f(1, structure(1, class = "b"))\nprint(f(structure(1, class = "b"), structure(1, class = "a")))', dropped: 'j <- 7' },
			{ name: 'a replacement function of the program dispatching', code: '`lab<-` <- function(x, value) UseMethod("lab<-")\n`lab<-.a` <- function(x, value) { attr(x, "l") <- k; x }\n`lab<-.b` <- function(x, value) { attr(x, "l") <- j; x }\nk <- 6\nj <- 7\na <- structure(1, class = "a")\nlab(a) <- 1\nprint(attr(a, "l"))', dropped: 'j <- 7' },
			{ name: 'a replacement function dispatching per call', code: '`lab<-` <- function(x, value) UseMethod("lab<-")\n`lab<-.a` <- function(x, value) { attr(x, "l") <- k; x }\n`lab<-.b` <- function(x, value) { attr(x, "l") <- j; x }\nk <- 6\nj <- 7\nb <- structure(1, class = "b")\nlab(b) <- 2\na <- structure(1, class = "a")\nlab(a) <- 1\nprint(attr(a, "l"))', dropped: 'j <- 7' },
			{ name: 'a replacement method changing the class', code: '`lab<-` <- function(x, value) UseMethod("lab<-")\n`lab<-.a` <- function(x, value) { attr(x, "l") <- k; x }\n`lab<-.b` <- function(x, value) { attr(x, "l") <- j; class(x) <- "a"; x }\nk <- 6\nj <- 7\na <- structure(1, class = "b")\nlab(a) <- 1\nlab(a) <- 2\nprint(attr(a, "l"))' },
			{ name: 'a built-in replacement dispatching to a method', code: '`names<-.zz` <- function(x, value) { attr(x, "l") <- k; x }\n`names<-.yy` <- function(x, value) { attr(x, "l") <- j; x }\nk <- 6\nj <- 7\na <- structure(1, class = "zz")\nnames(a) <- "q"\nprint(attr(a, "l"))', dropped: 'j <- 7' },
			{ name: 'autoprint running the print method of the class', code: 'n <- 0\nprint.zz <- function(x, ...) { n <<- 1; invisible(x) }\nprint.yy <- function(x, ...) { n <<- 5; invisible(x) }\nstructure(1, class = "zz")\ncat(n)', dropped: 'n <<- 5' },
			{ name: 'autoprint of a value of two classes', code: 'n <- 0\nprint.zz <- function(x, ...) { n <<- n + 1; invisible(x) }\nprint.yy <- function(x, ...) { n <<- n + 5; invisible(x) }\na <- if(runif(1) > 2) structure(1, class = "yy") else structure(1, class = "zz")\na\ncat(n)' },
			{ name: 'autoprint handing on with NextMethod', code: 'n <- 0\nprint.zz <- function(x, ...) { n <<- n + 1; NextMethod() }\nprint.yy <- function(x, ...) { n <<- n + 5; invisible(x) }\nprint.ww <- function(x, ...) { n <<- n + 50; invisible(x) }\nstructure(1, class = c("zz", "yy"))\ncat(n)', dropped: 'n + 50' },
			{ name: 'autoprint of a value of an unknown class', code: 'n <- 0\nprint.zz <- function(x, ...) { n <<- 1; invisible(x) }\nprint.yy <- function(x, ...) { n <<- 5; invisible(x) }\nmk <- function(c) structure(1, class = c)\nmk(sample(c("yy", "yy"), 1))\ncat(n)' },
			{ name: 'a replacement dispatching per call of a function', code: '`lab<-` <- function(x, value) UseMethod("lab<-")\n`lab<-.x` <- function(x, value) { attr(x, "l") <- k; x }\n`lab<-.y` <- function(x, value) { attr(x, "l") <- j; x }\nk <- 6\nj <- 7\nsetl <- function(a) { lab(a) <- 1; a }\nr <- setl(structure(1, class = "y"))\nprint(attr(setl(structure(1, class = "x")), "l"))', dropped: 'j <- 7' },
			{ name: 'a replacement dispatching per call of a function on variables', code: '`lab<-` <- function(x, value) UseMethod("lab<-")\n`lab<-.x` <- function(x, value) { attr(x, "l") <- k; x }\n`lab<-.y` <- function(x, value) { attr(x, "l") <- j; x }\nk <- 6\nj <- 7\nsetl <- function(a) { lab(a) <- 1; a }\no <- structure(1, class = "y")\nr <- setl(o)\np <- structure(1, class = "x")\nprint(attr(setl(p), "l"))', dropped: 'j <- 7' },
			{ name: 'a replacement dispatching per call two functions deep', code: '`lab<-` <- function(x, value) UseMethod("lab<-")\n`lab<-.x` <- function(x, value) { attr(x, "l") <- k; x }\n`lab<-.y` <- function(x, value) { attr(x, "l") <- j; x }\nk <- 6\nj <- 7\nsetl <- function(a) { lab(a) <- 1; a }\nouter <- function(b) setl(b)\nr <- outer(structure(1, class = "y"))\nprint(attr(outer(structure(1, class = "x")), "l"))', dropped: 'j <- 7' },
			{ name: 'a built-in replacement dispatching per call of a function', code: '`names<-.zz` <- function(x, value) { attr(x, "l") <- k; x }\n`names<-.yy` <- function(x, value) { attr(x, "l") <- j; x }\nk <- 6\nj <- 7\nsetn <- function(a) { names(a) <- "q"; a }\nr <- setn(structure(1, class = "yy"))\nprint(attr(setn(structure(1, class = "zz")), "l"))', dropped: 'j <- 7' },
			{ name: 'a replacement per call of a function, both results used', code: '`lab<-` <- function(x, value) UseMethod("lab<-")\n`lab<-.x` <- function(x, value) { attr(x, "l") <- k; x }\n`lab<-.y` <- function(x, value) { attr(x, "l") <- j; x }\nk <- 6\nj <- 7\nsetl <- function(a) { lab(a) <- 1; a }\nr <- setl(structure(1, class = "y"))\nprint(attr(r, "l") + attr(setl(structure(1, class = "x")), "l"))' },
			{ name: 'replacement methods with side effects per call of a function', code: 'n <- 0\n`lab<-` <- function(x, value) UseMethod("lab<-")\n`lab<-.x` <- function(x, value) { n <<- n + 1; x }\n`lab<-.y` <- function(x, value) { n <<- n + 10; x }\nsetl <- function(a) { lab(a) <- 1; a }\nr <- setl(structure(1, class = "x"))\nr <- setl(structure(1, class = "y"))\nprint(n)' },
			{ name: 'the output of an autoprinted value', code: 'print.zz <- function(x, ...) cat("zz", k, "\\n")\nprint.yy <- function(x, ...) cat("yy", j, "\\n")\nk <- 1\nj <- 2\nstructure(1, class = "zz")', dropped: 'print.yy' },
			{ name: 'the output of an autoprinted variable', code: 'print.zz <- function(x, ...) cat("zz", k, "\\n")\nprint.yy <- function(x, ...) cat("yy", j, "\\n")\nk <- 1\nj <- 2\nx <- structure(1, class = "zz")\nx', criterion: '6@x', dropped: 'print.yy' },
			{ name: 'the output of an autoprinted call', code: 'print.zz <- function(x, ...) cat("zz", k, "\\n")\nprint.yy <- function(x, ...) cat("yy", j, "\\n")\nk <- 1\nj <- 2\nmk <- function() structure(1, class = "zz")\nmk()', criterion: '6@mk', dropped: 'print.yy' },
			{ name: 'the output of an autoprinted value handing on', code: 'print.zz <- function(x, ...) { cat("zz", k, "\\n"); NextMethod() }\nprint.yy <- function(x, ...) cat("yy", j, "\\n")\nprint.ww <- function(x, ...) cat("ww", m, "\\n")\nk <- 1\nj <- 2\nm <- 3\nstructure(1, class = c("zz", "yy"))', dropped: 'm <- 3' },
			{ name: 'the output of an autoprinted value of two classes', code: 'print.zz <- function(x, ...) cat("zz", k, "\\n")\nprint.yy <- function(x, ...) cat("yy", j, "\\n")\nk <- 1\nj <- 2\na <- if(runif(1) > 2) structure(1, class = "yy") else structure(1, class = "zz")\na', criterion: '6@a' },
			{ name: 'the output of an autoprinted value read before a change', code: 'print.zz <- function(x, ...) cat("zz", k, "\\n")\nk <- 3\nx <- structure(1, class = "zz")\nx\nk <- 5\ninvisible(x)', criterion: '4@x', dropped: 'k <- 5' },
			{ name: 'NextMethod naming the generic and the object', code: 'f <- function(x, ...) UseMethod("f")\nf.c <- function(x, ...) NextMethod("f", x)\nf.b <- function(x, ...) j\nf.a <- function(x, ...) k\nk <- 6\nj <- 7\nprint(f(structure(1, class = c("c", "a"))))', dropped: 'j <- 7' },
			{ name: 'NextMethod naming an object of another class', code: 'f <- function(x, y) UseMethod("f")\nf.c <- function(x, y) NextMethod("f", y)\nf.b <- function(x, y) j\nf.a <- function(x, y) k\nk <- 6\nj <- 7\nprint(f(structure(1, class = c("c", "a")), structure(1, class = "b")))', dropped: 'j <- 7' },
			{ name: 'NextMethod handing on a further argument', code: 'f <- function(x, ...) UseMethod("f")\nf.c <- function(x, ...) NextMethod(generic = "f", object = x, y = m)\nf.b <- function(x, ...) j\nf.a <- function(x, ..., y) k + y\nk <- 6\nj <- 7\nm <- 100\nprint(f(structure(1, class = c("c", "a"))))', dropped: 'j <- 7' },
			{ name: 'a NextMethod chain naming the generic', code: 'f <- function(x, ...) UseMethod("f")\nf.c <- function(x, ...) NextMethod("f", x)\nf.b <- function(x, ...) NextMethod("f")\nf.a <- function(x, ...) k\nf.d <- function(x, ...) j\nk <- 6\nj <- 7\nr <- f(structure(1, class = c("c", "b", "d")))\nprint(f(structure(1, class = c("c", "b", "a"))))', dropped: 'j <- 7' },
			{ name: 'NextMethod naming the generic with side effects', code: 'n <- 0\nf <- function(x, ...) UseMethod("f")\nf.c <- function(x, ...) { n <<- n + 1; NextMethod("f", x) }\nf.a <- function(x, ...) n <<- n + 10\nf.b <- function(x, ...) n <<- n + 100\nf(structure(1, class = c("c", "a")))\nprint(n)', dropped: 'n + 100' },
			{ name: 'NextMethod in a method called directly', code: 'f.c <- function(x, ...) NextMethod("f")\nf.b <- function(x, ...) j\nf.a <- function(x, ...) k\nk <- 6\nj <- 7\nprint(f.c(structure(1, class = c("c", "a"))))', dropped: 'j <- 7' },
			{ name: 'NextMethod naming another generic in a method called directly', code: 'g.c <- function(x) NextMethod("h")\nh.a <- function(x) k\ng.a <- function(x) j\nk <- 6\nj <- 7\nprint(g.c(structure(1, class = c("c", "a"))))', dropped: 'j <- 7' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('S4 dispatch narrowed by the classes of the arguments', () => testing(['oop-s4-dispatch', 'oop-s4-inheritance'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an S4 method of another class is not run', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) o@x + k)\nsetMethod("val", "B", function(o) j)\nprint(val(new("A", x = 1)))', dropped: 'j <- 3' },
			{ name: 'callNextMethod reaches the nearest superclass method', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetClass("C", contains = "B")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) o@x + k)\nsetMethod("val", "B", function(o) j)\nsetMethod("val", "C", function(o) callNextMethod() + 1)\nprint(val(new("C", x = 1)))', dropped: 'k <- 10' },
			{ name: 'a callNextMethod chain does not reach ANY', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetClass("C", contains = "B")\nsetGeneric("val", function(o, ...) standardGeneric("val"))\nk <- 10\nj <- 4\nsetMethod("val", "A", function(o, ...) o@x + k)\nsetMethod("val", "B", function(o, ...) callNextMethod() * 2)\nsetMethod("val", "C", function(o, ...) callNextMethod() + 1)\nsetMethod("val", "ANY", function(o, ...) j)\nprint(val(new("C", x = 1)))', dropped: 'j <- 4' },
			{ name: 'an S4 class union beats ANY for a constant', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("h", function(o) standardGeneric("h"))\nk <- 1\nj <- 2\nm <- 3\nsetClassUnion("NC", c("numeric", "character"))\nsetMethod("h", "NC", function(o) k)\nsetMethod("h", "ANY", function(o) j)\nsetMethod("h", "A", function(o) m)\nprint(h(1L))', dropped: 'j <- 2' },
			{ name: 'S4 multiple dispatch picks the closest signature', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("p", function(a, b) standardGeneric("p"))\nk <- 1\nj <- 2\nm <- 3\nsetMethod("p", c("A", "ANY"), function(a, b) k)\nsetMethod("p", c("ANY", "B"), function(a, b) j)\nsetMethod("p", c("B", "missing"), function(a, b) m)\nprint(suppressMessages(p(new("B"), new("B"))))', dropped: 'k <- 1' },
			{ name: 'an S4 method for a missing argument', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("p", function(a, b) standardGeneric("p"))\nk <- 6\nj <- 7\nsetMethod("p", c("A", "missing"), function(a, b) k)\nsetMethod("p", c("A", "A"), function(a, b) j)\nprint(p(new("A")))', dropped: 'j <- 7' },
			{ name: 'an S4 method per class a value may have', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", representation(y = "numeric"))\nsetClass("C", representation(z = "numeric"))\nsetGeneric("p", function(a) standardGeneric("p"))\nk <- 6\nj <- 7\nm <- 8\nsetMethod("p", "A", function(a) k)\nsetMethod("p", "B", function(a) j)\nsetMethod("p", "C", function(a) m)\nx <- if(runif(1) < 2) new("A") else new("B")\nprint(p(x))', dropped: 'm <- 8' },
			{ name: 'an S4 method registered after the call', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) k)\nr <- val(new("B"))\nsetMethod("val", "B", function(o) j)\nprint(r)', dropped: 'j <- 3' },
			{ name: 'an S4 method of a generic called from a function for two classes', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) k)\nsetMethod("val", "B", function(o) j)\nf <- function(o) val(o)\nr <- f(new("A"))\nprint(r + f(new("B")))' },
			{ name: 'an S4 group method beats ANY of the operator', code: 'setClass("A", representation(x = "numeric"))\nk <- 5\nj <- 6\nsetMethod("Arith", signature("A", "A"), function(e1, e2) k)\nsetMethod("+", signature("ANY", "A"), function(e1, e2) j)\na <- new("A", x = 1)\nprint(a + a)', dropped: 'j <- 6' },
			{ name: 'an S4 method of a generic of base R', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", representation(y = "numeric"))\nk <- 6\nj <- 7\nsetMethod("length", "A", function(x) k)\nsetMethod("length", "B", function(x) j)\nprint(length(new("A", x = 1)))', dropped: 'j <- 7' },
			{ name: 'an S4 generic called in a function for another class at another call', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", representation(y = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) k)\nsetMethod("val", "B", function(o) j)\nuse <- function(o) val(o)\nr <- use(new("B"))\nprint(use(new("A")))', dropped: 'j <- 3' },
			{ name: 'an S4 method registered before the selected one', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", representation(y = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "B", function(o) j)\nsetMethod("val", "A", function(o) k)\nprint(val(new("A")))', dropped: 'setMethod("val", "B"' },
			{ name: 'S4 methods of other signatures registered before', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", representation(y = "numeric"))\nsetGeneric("p", function(a, b) standardGeneric("p"))\nk <- 10\nj <- 3\nm <- 4\nsetMethod("p", c("A", "B"), function(a, b) j)\nsetMethod("p", signature(a = "B", b = "A"), function(a, b) m)\nsetMethod("p", c("A", "A"), function(a, b) k)\nprint(p(new("A"), new("A")))', dropped: 'setMethod("p", c("A", "B")' },
			{ name: 'an S4 method replacing one of the same signature', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", signature(o = "A"), function(o) j)\nsetMethod("val", "A", function(o) k)\nprint(val(new("A")))', dropped: 'j <- 3' },
			{ name: 'a setGeneric resetting the methods before it', code: 'setClass("A", representation(x = "numeric"))\nk <- 10\nj <- 3\nsetGeneric("val", function(o) standardGeneric("val"))\nsetMethod("val", "A", function(o) j)\nsetGeneric("val", function(o) standardGeneric("val"))\nsetMethod("val", "numeric", function(o) k)\nprint(tryCatch(val(new("A")), error = function(e) "none"))', dropped: 'j <- 3' },
			{ name: 'an S4 method replaced before a call in a function', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) j)\nuse <- function(o) val(o)\nsetMethod("val", "A", function(o) k)\nprint(use(new("A")))', dropped: 'j <- 3' },
			{ name: 'an S4 method replaced between two calls', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) j)\nuse <- function(o) val(o)\nr <- use(new("A"))\nsetMethod("val", "A", function(o) k)\nprint(r + use(new("A")))' },
			{ name: 'an S4 method replaced only maybe', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) j)\nif(runif(1) > 2) setMethod("val", "A", function(o) k)\nprint(val(new("A")))' },
			{ name: 'an S4 method replaced below a callNextMethod', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) j)\nsetMethod("val", "B", function(o) callNextMethod() + 1)\nsetMethod("val", "A", function(o) k)\nprint(val(new("B")))', dropped: 'j <- 3' },
			{ name: 'an S4 generic called through two functions for two classes', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", representation(y = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) k)\nsetMethod("val", "B", function(o) j)\nfwd <- function(o) val(o)\nw <- function(p) fwd(p)\nr <- w(new("B"))\nprint(w(new("A")))', dropped: 'j <- 3' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('S4 initializers and S3 classes narrowed by class', () => testing(['oop-s4-construction', 'oop-s4-dispatch', 'oop-s4-inheritance'], () => {
		const init = (cls: string, body: string) => `setMethod("initialize", "${cls}", function(.Object, ...) { .Object <- callNextMethod(.Object, ...); ${body}; .Object })`;
		const cases: readonly TransitivityCase[] = [
			{ name: 'the initialize method of another class is not run', code: `setClass("A", representation(x = "numeric"))\nsetClass("B", representation(y = "numeric"))\nk <- 5\nj <- 6\n${init('A', '.Object@x <- k')}\n${init('B', '.Object@y <- j')}\na <- new("A")\nprint(a@x)`, dropped: 'j <- 6' },
			{ name: 'initialize of a superclass through callNextMethod', code: `setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetClass("C", representation(z = "numeric"))\nk <- 5\nj <- 6\nm <- 7\n${init('A', '.Object@x <- k')}\n${init('B', '.Object@x <- .Object@x + j')}\n${init('C', '.Object@z <- m')}\nb <- new("B")\nprint(b@x)`, dropped: 'm <- 7' },
			{ name: 'the initialize method a subclass inherits', code: 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetClass("C", representation(z = "numeric"))\nk <- 5\nm <- 7\nsetMethod("initialize", "A", function(.Object, ...) { .Object@x <- k; .Object })\nsetMethod("initialize", "C", function(.Object, ...) { .Object@z <- m; .Object })\nb <- new("B")\nprint(b@x)', dropped: 'm <- 7' },
			{ name: 'initialize for a class named by a variable', code: 'setClass("P", representation(x = "numeric"))\nsetClass("Q", representation(y = "numeric"))\nk <- 5\nj <- 6\nsetMethod("initialize", signature(.Object = "Q"), function(.Object, ...) { .Object@y <- j; .Object })\nsetMethod("initialize", signature(.Object = "P"), function(.Object, ...) { .Object@x <- k; .Object })\ncls <- "P"\np <- new(cls)\nprint(p@x)', dropped: 'j <- 6' },
			{ name: 'initialize for an instantiation in a function', code: 'setClass("A", representation(x = "numeric"))\nsetClass("C", representation(z = "numeric"))\nk <- 5\nm <- 7\nsetMethod("initialize", "A", function(.Object, ...) { .Object@x <- k; .Object })\nsetMethod("initialize", "C", function(.Object, ...) { .Object@z <- m; .Object })\nmake <- function() new("A")\nprint(make()@x)', dropped: 'm <- 7' },
			{ name: 'S4 dispatch on an S3 class setOldClass registers', code: 'setOldClass("money")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 6\nj <- 7\nsetMethod("val", "money", function(o) k)\nsetMethod("val", "numeric", function(o) j)\nprint(val(structure(1, class = "money")))', dropped: 'j <- 7' },
			{ name: 'S4 dispatch on the superclass of a registered S3 class', code: 'setOldClass(c("a", "b"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 6\nj <- 7\nm <- 8\nsetMethod("val", "b", function(o) k)\nsetMethod("val", "ANY", function(o) j)\nsetMethod("val", "numeric", function(o) m)\nx <- structure(1, class = c("a", "b"))\nprint(val(x))', dropped: 'j <- 7' },
			{ name: 'S4 dispatch on oldClass for a registered S3 class', code: 'setOldClass("z")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 6\nj <- 7\nm <- 8\nsetMethod("val", "oldClass", function(o) k)\nsetMethod("val", "ANY", function(o) j)\nsetMethod("val", "numeric", function(o) m)\nprint(val(structure(1, class = "z")))', dropped: 'j <- 7' },
			{ name: 'S4 dispatch on a registered S3 class in a function', code: 'setOldClass(c("money", "amount"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 6\nj <- 7\nsetMethod("val", "amount", function(o) k)\nsetMethod("val", "character", function(o) j)\nshow_val <- function(o) val(o)\nr <- show_val("x")\nprint(show_val(structure(1, class = c("money", "amount"))))', dropped: 'j <- 7' },
			{ name: 'an S3 class registered after a dispatch R keeps', code: 'setGeneric("val", function(o) standardGeneric("val"))\nk <- 6\nj <- 7\nsetMethod("val", "ANY", function(o) j)\nsetMethod("val", "b", function(o) k)\nr <- val(structure(1, class = c("a", "b")))\nsetOldClass(c("a", "b"))\nprint(val(structure(1, class = c("a", "b"))))' },
			{ name: 'an S3 class registered only maybe', code: 'if(runif(1) > 2) setOldClass(c("a", "b"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 6\nj <- 7\nsetMethod("val", "b", function(o) k)\nsetMethod("val", "ANY", function(o) j)\nprint(val(structure(1, class = c("a", "b"))))' },
			{ name: 'an S3 class registered to test each object', code: 'setOldClass(c("a", "b"), test = TRUE)\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 6\nj <- 7\nsetMethod("val", "b", function(o) k)\nsetMethod("val", "ANY", function(o) j)\nprint(val(structure(1, class = c("a", "x"))))' },
			{ name: 'S4 dispatch on a registered S3 class beside an unknown one', code: 'setOldClass("z")\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 6\nj <- 7\nsetMethod("val", "oldClass", function(o) k)\nsetMethod("val", "ANY", function(o) j)\nwrap <- function(o) val(o)\nq <- "x"\nr <- wrap(get("q"))\nprint(wrap(structure(1, class = "z")))', dropped: 'j <- 7' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('R6 and Reference Class instances found through value flow', () => testing(['oop-r6', 'oop-rc'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an R6 method beside a global named self', code: 'library(R6)\nself <- list(v = 7)\nC <- R6Class("C", public = list(v = 1, inc = function() self$v <- 3))\no <- C$new()\no$inc()\nprint(o$v)', dropped: 'self <- list' },
			{ name: 'an R6 method reading self beside a global named self', code: 'library(R6)\nself <- list(v = 9)\nC <- R6Class("C", public = list(v = 1, get = function() self$v))\no <- C$new()\nprint(o$get())', dropped: 'self <- list' },
			{ name: 'an R6 method beside a global named private', code: 'library(R6)\nprivate <- list(v = 9)\nC <- R6Class("C", public = list(set = function() private$v <- 3, get = function() private$v), private = list(v = 1))\no <- C$new()\np <- o\np$set()\nprint(o$get())', dropped: 'private <- list' },
			{ name: 'an R6 method on an instance two aliases away', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, inc = function() self$v <- 3))\no <- C$new()\np <- o\nq <- p\nq$inc()\nprint(o$v)' },
			{ name: 'an R6 method on an instance a function returns', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, inc = function() self$v <- 3))\nget_o <- function() o\no <- C$new()\nget_o()$inc()\nprint(o$v)' },
			{ name: 'an R6 method on an instance in a list', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, inc = function() self$v <- 3))\nl <- list(a = C$new())\nl$a$inc()\nprint(l$a$v)' },
			{ name: 'an R6 method on an instance in a field of another', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, inc = function() self$v <- 3))\nD <- R6Class("D", public = list(child = NULL, initialize = function() self$child <- C$new()))\nd <- D$new()\nd$child$inc()\nprint(d$child$v)' },
			{ name: 'an R6 method on the instance an earlier method returned', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, inc = function() { self$v <- self$v + 1; invisible(self) }))\no <- C$new()\np <- o$inc()\np$inc()\nprint(o$v)' },
			{ name: 'an R6 method on an instance handed to a function', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, inc = function() self$v <- 3))\nbump <- function(x) x$inc()\no <- C$new()\nbump(o)\nprint(o$v)' },
			{ name: 'a Reference Class method through an alias beside a global named .self', code: '.self <- list(v = 7)\nC <- setRefClass("C", fields = list(v = "numeric"), methods = list(inc = function() .self$v <- 3))\no <- C$new(v = 1)\np <- o\np$inc()\nprint(o$v)', dropped: '.self <- list' }
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
			{ name: 'a handler that never runs', code: 'n <- 0\nr <- tryCatch(1, error = function(e) n <<- 5)\nprint(n)', dropped: 'n <<- 5' },
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
			{ name: 'a calling handler by name that never runs', code: 'n <- 0\nh <- function(w) n <<- 5\nr <- withCallingHandlers(1, warning = h)\nprint(n)', dropped: 'n <<- 5' },
			{ name: 'an exiting handler by name', code: `n <- 0\nh <- function(w) n <<- 1\n${warns}\nr <- tryCatch(f(), warning = h)\nprint(n)` },
			{ name: 'an exiting handler from a list', code: `n <- 0\nhs <- list(w = function(w) n <<- 1)\n${warns}\nr <- tryCatch(f(), warning = hs[["w"]])\nprint(n)` },
			{ name: 'an exiting handler from a factory', code: `n <- 0\nmk <- function() function(w) n <<- 1\n${warns}\nr <- tryCatch(f(), warning = mk())\nprint(n)` },
			{ name: 'an exiting handler through a parameter', code: `n <- 0\n${warns}\nrun <- function(h) tryCatch(f(), warning = h)\nr <- run(function(w) n <<- 1)\nprint(n)` },
			{ name: 'an exiting handler by name that never runs', code: 'n <- 0\nh <- function(w) n <<- 5\nr <- tryCatch(1, warning = h)\nprint(n)', dropped: 'n <<- 5' },
			{ name: 'an error handler by name that never runs', code: 'n <- 0\nh <- function(e) n <<- 5\nr <- tryCatch(1, error = h)\nprint(n)', dropped: 'n <<- 5' },
			{ name: 'an error handler from a factory', code: 'n <- 0\nmk <- function() function(e) n <<- 1\nr <- tryCatch(stop("x"), error = mk())\nprint(n)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('handlers by the class of the condition', () => testing(['exceptions-and-errors'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a warning handler for a message', code: 'n <- 0\nr <- tryCatch(message("m"), warning = function(w) n <<- 5, message = function(m) 1)\nprint(n)', dropped: 'n <<- 5' },
			{ name: 'a warning handler for an error', code: 'n <- 0\nr <- tryCatch(stop("e"), warning = function(w) n <<- 5, error = function(e) 2)\nprint(n)', dropped: 'n <<- 5' },
			{ name: 'a warning handler for a message in a function', code: 'n <- 0\nf <- function() message("hi")\nr <- withCallingHandlers(f(), warning = function(w) n <<- 5, message = function(m) invokeRestart("muffleMessage"))\nprint(n)', dropped: 'n <<- 5' },
			{ name: 'an error handler for a warning', code: 'n <- 0\nr <- tryCatch(warning("w"), error = function(e) n <<- 5, warning = function(w) 1)\nprint(n)', dropped: 'n <<- 5' },
			{ name: 'an error handler for a warning made an error', code: 'n <- 0\noptions(warn = 2)\nr <- tryCatch(warning("w"), error = function(e) n <<- 5)\nprint(n)' },
			{ name: 'an error handler for a variable', code: 'n <- 0\nx <- 3\nr <- tryCatch(x, error = function(e) n <<- 5)\nprint(n)', dropped: 'n <<- 5' },
			{ name: 'an error handler for a promise', code: 'n <- 0\nf <- function(a) tryCatch(a, error = function(e) n <<- 5)\nf(stop("x"))\nprint(n)' },
			{ name: 'an error handler for a missing variable', code: 'n <- 0\nr <- tryCatch(undefined_thing, error = function(e) n <<- 5)\nprint(n)' },
			{ name: 'an error handler for a branch on NA', code: 'n <- 0\nv <- NA\nr <- tryCatch(if(v) 1, error = function(e) n <<- 5)\nprint(n)' },
			{ name: 'an error handler for an unused argument', code: 'n <- 0\ng <- function() 1\nr <- tryCatch(g(2), error = function(e) n <<- 5)\nprint(n)' },
			{ name: 'an error handler for a closure that cannot fail', code: 'n <- 0\ng <- function() 1\nr <- tryCatch(g(), error = function(e) n <<- 5)\nprint(n)', dropped: 'n <<- 5' },
			{ name: 'an error handler for a missing variable in a called closure', code: 'n <- 0\nf <- function() undefined_thing\nr <- tryCatch(f(), error = function(e) n <<- 5)\nprint(n)' },
			{ name: 'a condition handler for a signaled condition', code: 'n <- 0\nr <- tryCatch(signalCondition(simpleCondition("m")), condition = function(c) n <<- 5)\nprint(n)' }
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
			{ name: 'a global calling handler that never runs', code: 'n <- 0\nglobalCallingHandlers(warning = function(w) n <<- 5)\nprint(n)', dropped: 'n <<- 5', imprecise: 'keeps the handler, print is a built-in flowR cannot tell never warns, so it may run the handler' },
			{ name: 'a global calling handler registered after the warning', code: `n <- 0\n${warns}\nr <- suppressWarnings(f())\nglobalCallingHandlers(warning = function(w) n <<- 5)\nprint(n)`, dropped: 'n <<- 5', imprecise: 'keeps the handler, print is a built-in flowR cannot tell never warns, so it may run the handler' }
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
		resolvesLikeR(parser, 'switch selecting a global', 'f <- function(t) switch(t, a = x, b = y)\nx <- 1\ny <- 2\nz <- f("b")\ncat(z)', '5@z');
		resolvesLikeR(parser, 'a for loop accumulating', 'x <- 0\nfor(i in 1:3) x <- x + i\ncat(x)', '3@x');
		resolvesLikeR(parser, 'a value carried to the next iteration', 'a <- 1\nb <- 0\nfor(i in 1:2) { b <- a; a <- 5 }\ncat(b)', '4@b');
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
