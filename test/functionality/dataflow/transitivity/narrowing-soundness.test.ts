import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, testing, type TransitivityCase } from './transitivity';

describe('Transitivity where precise answers once dropped what R runs, checked against R', withTreeSitter(parser => {
	describe('exit hooks registered and cleared', () => testing(['hooks', 'functions-with-global-side-effects'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an on.exit without an expression clears the hooks', code: 'k <- 0\nf <- function() { on.exit(k <<- 5); on.exit() }\nf()\nprint(k)' },
			{ name: 'a conditional on.exit without an expression may clear the hooks', code: 'k <- 0\nf <- function(b) { on.exit(k <<- 5); if(b) on.exit() }\nf(TRUE)\nprint(k)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
	describe('loops running calls that write', () => testing(['closures', 'for-loop', 'while-loop', 'repeat-loop', 'functions-with-global-side-effects'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a loop calling a function a callee rebinds by a super assignment', code: 'g <- function() 1\ns <- 0\ni <- 0\nch <- function() g <<- function() 100\nwhile(i < 2) { s <- s + g(); ch(); i <- i + 1 }\nprint(s)' },
			{ name: 'a closure in a loop reading what a callee writes in the run before', code: 'g <- 1\nch <- function() g <<- 100\nh <- function() g\ns <- 0\nfor(i in 1:2) { s <- s + h(); ch() }\nprint(s)' },
			{ name: 'a loop reading what a callee writes in the run before', code: 'g <- 1\nch <- function() g <<- 100\ns <- 0\nfor(i in 1:2) { s <- s + g; ch() }\nprint(s)' },
			{ name: 'a loop reading what a callee assigns globally in the run before', code: 'g <- 1\nch <- function() assign("g", 100, envir = globalenv())\ns <- 0\nfor(i in 1:2) { s <- s + g; ch() }\nprint(s)' },
			{ name: 'a loop in a function reading what a local callee writes in the run before', code: 'f <- function() { g <- 1; ch <- function() g <<- 100; s <- 0; for(i in 1:2) { s <- s + g; ch() }; s }\nprint(f())' },
			{ name: 'a loop condition a callee in the body changes', code: 'g <- TRUE\nch <- function() g <<- FALSE\nn <- 0\nwhile(g) { n <- n + 1; ch() }\nprint(n)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
	describe('dots read by closures', () => testing(['formals-dot-dot-dot', 'closures', 'formals-promises'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a returned closure forcing dots by position', code: 'n <- 0\nf <- function(...) function() ..1\ng <- f(n <- 5)\nr <- g()\nprint(n)' },
			{ name: 'a returned closure forcing dots by ...elt', code: 'n <- 0\nf <- function(...) function() ...elt(1)\ng <- f(n <- 5)\nr <- g()\nprint(n)' },
			{ name: 'a closure forcing dots handed on twice', code: 'n <- 0\nmk <- function(...) function() sum(...)\nf <- function(...) mk(...)\ng <- f(n <- 5)\nr <- g()\nprint(n)' },
			{ name: 'a closure in a list forcing dots by position', code: 'n <- 0\nf <- function(...) list(get = function() ..1)\no <- f(n <- 5)\nr <- o$get()\nprint(n)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
	describe('dispatch where the generic is called', () => testing(['oop-s3-dispatch', 'oop-s4-dispatch'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an S3 method the caller of the generic defines', code: 'f <- function(o) UseMethod("f")\nf.a <- function(o) k\nk <- 6\nj <- 7\nh <- function() { f.b <- function(o) j; f(structure(1, class = "b")) }\nprint(h())' },
			{ name: 'an S3 method a frame enclosing the caller of the generic defines', code: 'f <- function(o) UseMethod("f")\nj <- 7\nh <- function() { f.b <- function(o) j; w <- function() f(structure(1, class = "b")); w() }\nprint(h())' },
			{ name: 'a print method a function defines for its own print call', code: 'j <- 7\nh <- function() { print.b <- function(x, ...) cat("b", j, "\\n"); print(structure(1, class = "b")) }\nh()', criterion: '3@h' },
			{ name: 'a generic changing the class of its object before UseMethod', code: 'f <- function(x) { class(x) <- "b"; UseMethod("f") }\nf.a <- function(x) k\nf.b <- function(x) j\nk <- 6\nj <- 7\nprint(f(structure(1, class = "a")))' },
			{ name: 'a generic changing oldClass of its object before UseMethod', code: 'f <- function(x) { oldClass(x) <- "b"; UseMethod("f") }\nf.a <- function(x) k\nf.b <- function(x) j\nk <- 6\nj <- 7\nprint(f(structure(1, class = "a")))' },
			{ name: 'a $<- method of the class of the target', code: '`$<-.zz` <- function(x, name, value) { attr(x, "v") <- k; x }\nk <- 9\no <- structure(list(), class = "zz")\no$a <- 1\nprint(attr(o, "v"))' },
			{ name: 'a show method run by autoprint', code: 'setClass("P", representation(w = "numeric"))\nk <- 4\nsetMethod("show", "P", function(object) cat("P", k, "\\n"))\nnew("P", w = 1)', criterion: '4@new' },
			{ name: 'a show method run by autoprinting a variable', code: 'setClass("P", representation(w = "numeric"))\nk <- 4\nsetMethod("show", "P", function(object) cat("P", k, "\\n"))\np <- new("P", w = 1)\np', criterion: '5@p' },
			{ name: 'an S4 ANY method for a class that is no subclass of the other signature', code: 'setGeneric("ar", function(o) standardGeneric("ar"))\nk <- 2\nj <- 3\nsetMethod("ar", "numeric", function(o) k)\nsetMethod("ar", "ANY", function(o) j)\nprint(ar(TRUE))' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
	describe('methods registered within a function call', () => testing(['oop-s3-dispatch', 'oop-s4-dispatch', 'functions-with-global-side-effects'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an S4 method a function call replaces', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) j)\nreg <- function() setMethod("val", "A", function(o) k)\nreg()\nprint(val(new("A")))' },
			{ name: 'an S4 method a function registers', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nreg <- function() setMethod("val", "A", function(o) k)\nreg()\nprint(val(new("A")))' },
			{ name: 'an S4 method a function two calls deep replaces', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) j)\ninner <- function() setMethod("val", "A", function(o) k)\nreg <- function() inner()\nreg()\nprint(val(new("A")))' },
			{ name: 'an S4 method a function registers from its argument', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) j)\nreg <- function(fn) setMethod("val", "A", fn)\nreg(function(o) k)\nprint(val(new("A")))' },
			{ name: 'an S4 method local replaces', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) j)\nlocal(setMethod("val", "A", function(o) k))\nprint(val(new("A")))' },
			{ name: 'an S4 method a function replaces only maybe', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetMethod("val", "A", function(o) j)\nreg <- function() setMethod("val", "A", function(o) k)\nif(runif(1) < 2) reg()\nprint(val(new("A")))' },
			{ name: 'an S4 replacement method a function registers', code: 'setClass("A", representation(x = "numeric"))\nsetGeneric("val", function(o) standardGeneric("val"))\nk <- 10\nj <- 3\nsetGeneric("v<-", function(o, value) standardGeneric("v<-"))\nreg <- function() setReplaceMethod("v", "A", function(o, value) { o@x <- k; o })\nreg()\na <- new("A", x = 1)\nv(a) <- 2\nprint(a@x)' },
			{ name: 'an S3 method a function registers by .S3method', code: 'f <- function(o) UseMethod("f")\nj <- 7\nreg <- function() .S3method("f", "b", function(o) j)\nreg()\nprint(f(structure(1, class = "b")))' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
	describe('show methods run by print', () => testing(['oop-s4-dispatch'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a show method run by print', code: 'setClass("P", representation(w = "numeric"))\nk <- 4\nsetMethod("show", "P", function(object) cat("P", k, "\\n"))\nprint(new("P", w = 1))' },
			{ name: 'a show method run by print of a variable', code: 'setClass("P", representation(w = "numeric"))\nk <- 4\nsetMethod("show", "P", function(object) cat("P", k, "\\n"))\nx <- new("P", w = 1)\nprint(x)' },
			{ name: 'a show method run by print in a function', code: 'setClass("P", representation(w = "numeric"))\nk <- 4\nsetMethod("show", "P", function(object) cat("P", k, "\\n"))\np <- function(o) print(o)\np(new("P", w = 1))', criterion: '5@p' },
			{ name: 'a show method of the superclass run by print', code: 'setClass("P", representation(w = "numeric"))\nk <- 4\nsetClass("Q", contains = "P")\nsetMethod("show", "P", function(object) cat("P", k, "\\n"))\nprint(new("Q", w = 1))' },
			{ name: 'a show method run by print beside a print method', code: 'print.zz <- function(x, ...) cat("zz\\n")\nsetClass("P", representation(w = "numeric"))\nk <- 4\nsetMethod("show", "P", function(object) cat("P", k, "\\n"))\nprint(new("P", w = 1))' },
			{ name: 'a show method a function registers run by print', code: 'setClass("P", representation(w = "numeric"))\nk <- 4\nreg <- function() setMethod("show", "P", function(object) cat("P", k, "\\n"))\nreg()\nprint(new("P", w = 1))' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
	describe('S3 methods registered by name', () => testing(['oop-s3-dispatch'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an S3 method registered by .S3method', code: 'f <- function(o) UseMethod("f")\nf.a <- function(o) k\nmb <- function(o) j\n.S3method("f", "b", mb)\nk <- 6\nj <- 7\nprint(f(structure(1, class = "b")))' },
			{ name: 'an S3 method registered by .S3method with named arguments', code: 'f <- function(o) UseMethod("f")\nf.a <- function(o) k\nk <- 6\nj <- 7\n.S3method(class = "b", method = function(o) j, generic = "f")\nprint(f(structure(1, class = "b")))' },
			{ name: 'an S3 method registered by .S3method for a class in a variable', code: 'f <- function(o) UseMethod("f")\nf.a <- function(o) k\nk <- 6\nj <- 7\ncls <- "b"\n.S3method("f", cls, function(o) j)\nprint(f(structure(1, class = "b")))' },
			{ name: 'an S3 method registered by .S3method for a generic in a variable', code: 'f <- function(o) UseMethod("f")\nf.a <- function(o) k\nk <- 6\nj <- 7\ng <- "f"\n.S3method(g, "b", function(o) j)\nprint(f(structure(1, class = "b")))' },
			{ name: 'an S3 method registered by registerS3method', code: 'f <- function(o) UseMethod("f")\nf.a <- function(o) k\nk <- 6\nj <- 7\nregisterS3method("f", "b", function(o) j)\nprint(f(structure(1, class = "b")))' },
			{ name: 'a print method registered by .S3method', code: 'j <- 7\n.S3method("print", "b", function(x, ...) cat("b", j, "\\n"))\nprint(structure(1, class = "b"))' },
			{ name: 'a print method registered by .S3method run by autoprint', code: 'j <- 7\n.S3method("print", "b", function(x, ...) cat("b", j, "\\n"))\nstructure(1, class = "b")', criterion: '3@structure' },
			{ name: 'a bound S3 method beats one .S3method registers', code: 'f <- function(o) UseMethod("f")\nf.a <- function(o) k\nk <- 6\nj <- 7\nf.b <- function(o) j\n.S3method("f", "b", function(o) k)\nprint(f(structure(1, class = "b")))' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
	describe('generics built-ins dispatch to on their own', () => testing(['oop-s3-dispatch'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'an as.character method run by paste', code: 'as.character.zz <- function(x, ...) k\nk <- "six"\na <- structure(list(), class = "zz")\nprint(paste(a))' },
			{ name: 'an as.character method run by paste0 on a second argument', code: 'as.character.zz <- function(x, ...) k\nk <- "six"\na <- structure(1, class = "zz")\nprint(paste0("v", a))' },
			{ name: 'an as.character method run by paste in a function', code: 'as.character.zz <- function(x, ...) k\nk <- "six"\na <- structure(1, class = "zz")\nf <- function(v) paste(v, "!")\nprint(f(a))' },
			{ name: 'an as.character method run by sprintf', code: 'as.character.zz <- function(x, ...) k\nk <- "six"\na <- structure(1, class = "zz")\nprint(sprintf("%s", a))' },
			{ name: 'an as.character method run by file.path', code: 'as.character.zz <- function(x, ...) k\nk <- "six"\na <- structure(1, class = "zz")\nprint(file.path(a, "x"))' },
			{ name: 'a format method of a column run by printing a data frame', code: 'format.zz <- function(x, ...) rep(k, length(x))\nk <- "six"\nd <- data.frame(a = 1)\nd$a <- structure(1, class = "zz")\nprint(d)' },
			{ name: 'a format method of a column run by autoprinting a data frame', code: 'format.zz <- function(x, ...) rep(k, length(x))\nk <- "six"\nd <- data.frame(a = 1)\nd$a <- structure(1, class = "zz")\nd', criterion: '5@d' },
			{ name: 'a format method of a column run by printing a data frame in a function', code: 'format.zz <- function(x, ...) rep(k, length(x))\nk <- "six"\nd <- data.frame(a = 1)\nd$a <- structure(1, class = "zz")\nshow_it <- function(v) print(v)\nshow_it(d)', criterion: '6@show_it' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
	describe('writes into the frame of the caller', () => testing(['environment-sharing', 'name-created'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'assign into parent.frame of a function called by another', code: 'f <- function() assign("x", 5, envir = parent.frame())\nh <- function() { x <- 1; f(); x }\nprint(h())' },
			{ name: 'assign of a parameter name into parent.frame', code: 'f <- function(n) assign(n, 5, envir = parent.frame())\nh <- function() { x <- 1; f("x"); x }\nprint(h())' },
			{ name: 'assign into a variable holding parent.frame', code: 'f <- function() { p <- parent.frame(); assign("x", 5, envir = p) }\nh <- function() { x <- 1; f(); x }\nprint(h())' },
			{ name: 'a dollar replacement in a variable holding parent.frame', code: 'f <- function() { p <- parent.frame(); p$x <- 5 }\nh <- function() { x <- 1; f(); x }\nprint(h())' },
			{ name: 'evalq into parent.frame', code: 'f <- function() evalq(x <- 5, parent.frame())\nh <- function() { x <- 1; f(); x }\nprint(h())' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
	describe('closures reading what their caller wrote', () => testing(['closures', 'functions-with-global-side-effects', 'higher-order-functions'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a global closure reading what its caller super assigned before', code: 'k <- 1\ng <- function(i) i + k\nh <- function() { k <<- 100; g(1) }\nprint(h())' },
			{ name: 'a global closure run by Map reading what its caller super assigned before', code: 'k <- 1\ng <- function(i) i + k\nh <- function() { k <<- 100; Map(g, 1)[[1]] }\nprint(h())' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));
}));
