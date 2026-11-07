import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';
/** Objects with reference semantics (environments, R6, reference classes) and package code changing them, checked against R. */
describe('Objects with reference semantics, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'R6 field set by method', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, set = function(x) { self$v <- x; invisible(self) }))\no <- C$new()\no$set(5)\nprint(o$v)', sigdb: true },
		{ name: 'R6 chained', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, add = function(x) { self$v <- self$v + x; invisible(self) }))\no <- C$new()\no$add(2)$add(3)\nprint(o$v)', sigdb: true },
		{ name: 'R6 reference semantics alias', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1))\no <- C$new()\np <- o\np$v <- 9\nprint(o$v)', sigdb: true },
		{ name: 'R6 initialize', code: 'library(R6)\nk <- 4\nC <- R6Class("C", public = list(v = NULL, initialize = function() self$v <- k))\no <- C$new()\nprint(o$v)', sigdb: true },
		{ name: 'R6 inheritance super', code: 'library(R6)\nA <- R6Class("A", public = list(f = function() 1))\nB <- R6Class("B", inherit = A, public = list(f = function() super$f() + 10))\nprint(B$new()$f())', sigdb: true },
		{ name: 'R6 private', code: 'library(R6)\nC <- R6Class("C", public = list(get = function() private$s, set = function(x) private$s <- x), private = list(s = 0))\no <- C$new()\no$set(7)\nprint(o$get())', sigdb: true },
		{ name: 'R6 active binding', code: 'library(R6)\nn <- 3\nC <- R6Class("C", active = list(a = function() n * 2))\no <- C$new()\nprint(o$a)', sigdb: true },
		{ name: 'R6 object passed to function', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1))\nbump <- function(obj) obj$v <- obj$v + 1\no <- C$new()\nbump(o)\nprint(o$v)', sigdb: true },
		{ name: 'R6 method stored then called', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1, set = function() self$v <- 4))\no <- C$new()\nm <- o$set\nm()\nprint(o$v)', sigdb: true },
		{ name: 'R6 clone independent', code: 'library(R6)\nC <- R6Class("C", public = list(v = 1))\no <- C$new()\np <- o$clone()\np$v <- 9\nprint(o$v)', sigdb: true },
		{ name: 'RC field set', code: 'A <- setRefClass("A", fields = list(v = "numeric"), methods = list(set = function(x) v <<- x))\na <- A$new(v = 1)\na$set(5)\nprint(a$v)' },
		{ name: 'RC alias', code: 'A <- setRefClass("A", fields = list(v = "numeric"))\na <- A$new(v = 1)\nb <- a\nb$v <- 8\nprint(a$v)' },
		{ name: 'RC callSuper', code: 'A <- setRefClass("A", methods = list(f = function() 1))\nB <- setRefClass("B", contains = "A", methods = list(f = function() callSuper() + 5))\nprint(B$new()$f())' },
		{ name: 'RC initialize', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"), methods = list(initialize = function(...) { v <<- k; callSuper(...) }))\nprint(A$new()$v)' },
		{ name: 'env alias', code: 'e <- new.env()\ne$v <- 1\np <- e\np$v <- 9\nprint(e$v)' },
		{ name: 'env passed to fn', code: 'e <- new.env()\ne$v <- 1\nbump <- function(x) x$v <- x$v + 1\nbump(e)\nprint(e$v)' },
		{ name: 'unknown object alias', code: 'mk <- function() { r <- new.env(); r$v <- 1; r }\no <- mk()\np <- o\np$v <- 9\nprint(o$v)' },
		{ name: 'environment as object', code: 'mk <- function() { e <- new.env(); e$v <- 1; e }\no <- mk()\nset <- function(x) x$v <- 5\nset(o)\nprint(o$v)' },
		{ name: 'dplyr mutate', code: 'library(dplyr)\nk <- 3\nd <- data.frame(a = 1:2)\nd <- d %>% mutate(b = a * k)\nprint(d$b)', sigdb: true },
		{ name: 'dplyr filter', code: 'library(dplyr)\nt <- 1\nd <- data.frame(a = 1:3)\nr <- filter(d, a > t)\nprint(nrow(r))', sigdb: true },
		{ name: 'data.table update by ref', code: 'library(data.table)\nk <- 5\nd <- data.table(a = 1:2)\nd[, b := a + k]\nprint(d$b)', sigdb: true },
		{ name: 'purrr map side effect', code: 'library(purrr)\nn <- 0\ninvisible(map(1:3, function(i) n <<- n + i))\nprint(n)', sigdb: true }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
