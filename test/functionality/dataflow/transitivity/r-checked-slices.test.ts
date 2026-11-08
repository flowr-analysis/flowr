import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';

/** Slices of programs whose output depends on what flowR must follow, grouped by topic, each checked against what R prints. */
const groups: Readonly<Record<string, readonly TransitivityCase[]>> = {
	'Objects with reference semantics': [
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
		{ name: 'env alias', code: 'e <- new.env()\ne$v <- 1\np <- e\np$v <- 9\nprint(e$v)' },
		{ name: 'env passed to fn', code: 'e <- new.env()\ne$v <- 1\nbump <- function(x) x$v <- x$v + 1\nbump(e)\nprint(e$v)' },
		{ name: 'unknown object alias', code: 'mk <- function() { r <- new.env(); r$v <- 1; r }\no <- mk()\np <- o\np$v <- 9\nprint(o$v)' },
		{ name: 'environment as object', code: 'mk <- function() { e <- new.env(); e$v <- 1; e }\no <- mk()\nset <- function(x) x$v <- 5\nset(o)\nprint(o$v)' },
		{ name: 'dplyr mutate', code: 'library(dplyr)\nk <- 3\nd <- data.frame(a = 1:2)\nd <- d %>% mutate(b = a * k)\nprint(d$b)', sigdb: true },
		{ name: 'dplyr filter', code: 'library(dplyr)\nt <- 1\nd <- data.frame(a = 1:3)\nr <- filter(d, a > t)\nprint(nrow(r))', sigdb: true },
		{ name: 'data.table update by ref', code: 'library(data.table)\nk <- 5\nd <- data.table(a = 1:2)\nd[, b := a + k]\nprint(d$b)', sigdb: true },
		{ name: 'purrr map side effect', code: 'library(purrr)\nn <- 0\ninvisible(map(1:3, function(i) n <<- n + i))\nprint(n)', sigdb: true },
		{ name: 'data.table alias by ref', code: 'library(data.table)\nd <- data.table(a = 1:2)\ne <- d\ne[, a := 9L]\nprint(d$a)', sigdb: true },
		{ name: 'data.table alias reverse', code: 'library(data.table)\nd <- data.table(a = 1:2)\ne <- d\nd[, a := 9L]\nprint(e$a)', sigdb: true },
		{ name: 'data.table alias chain', code: 'library(data.table)\nd <- data.table(a = 1:2)\ne <- d\nf <- e\nf[, a := 9L]\nprint(d$a)', sigdb: true },
		{ name: 'data.table copy is independent', code: 'library(data.table)\nd <- data.table(a = 1:2)\ne <- copy(d)\ne[, a := 9L]\nprint(d$a)', sigdb: true },
		{ name: 'data.table changed in function', code: 'library(data.table)\nd <- data.table(a = 1:2)\nupd <- function(t) t[, a := 9L]\nupd(d)\nprint(d$a)', sigdb: true },
		{ name: 'data.table changed in function, alias read', code: 'library(data.table)\nd <- data.table(a = 1:2)\ne <- d\nupd <- function(t) t[, a := 9L]\nupd(d)\nprint(e$a)', sigdb: true },
		{ name: 'data.table changed in function, named arg', code: 'library(data.table)\nd <- data.table(a = 1:2)\nupd <- function(x, t) t[, a := x]\nupd(t = d, x = 9L)\nprint(d$a)', sigdb: true },
		{ name: 'data.table changed in function defined later', code: 'library(data.table)\nupd <- function(t) { t[, a := 9L]; invisible(NULL) }\nd <- data.table(a = 1:2)\nupd(d)\nprint(d$a)', sigdb: true },
		{ name: 'data.table copy passed', code: 'library(data.table)\nd <- data.table(a = 1:2)\nupd <- function(t) t[, a := 9L]\nupd(copy(d))\nprint(d$a)', sigdb: true }
	],
	'Slices through replacements, evaluation, and files': [
		{ name: 'mget loop names', code: 'v1 <- 1\nv2 <- 2\nprint(unlist(mget(paste0("v", 1:2))))' }
	],
	'Lookups of names known only at runtime': [
		{ name: 'mget of computed names', code: 'v1 <- 1\nv2 <- 2\nprint(unlist(mget(paste0("v", 1:2))))' },
		{ name: 'get of a random name', code: 'v1 <- 1\nprint(get(sample(c("v1"), 1)))' },
		{ name: 'get of a random name in a function', code: 'f <- function() { a <- 3; get(sample(c("a"), 1)) }\nprint(f())' },
		{ name: 'get of a random global name in a function', code: 'a <- 4\nf <- function() get(sample(c("a"), 1))\nprint(f())' },
		{ name: 'get0 of a random name', code: 'v1 <- 5\nprint(get0(sample(c("v1"), 1)))' },
		{ name: 'get of a random name from an environment', code: 'e <- new.env()\nassign("v", 6, envir = e)\nprint(get(sample(c("v"), 1), envir = e))' },
		{ name: 'mget of a random name from an environment', code: 'e <- new.env()\nassign("v", 7, envir = e)\nprint(unlist(mget(sample(c("v"), 1), envir = e)))' },
		{ name: 'get of a runtime name, called', code: 'k <- 3\nh <- function() k\nprint(get(sample(c("h"), 1))())' },
		{ name: 'get of a runtime name, called through an alias', code: 'k <- 3\nh <- function() k\nf <- get(sample(c("h"), 1))\nprint(f())' },
		{ name: 'get of a runtime name, called with a side effect', code: 'n <- 0\nh <- function() n <<- 5\nget(sample(c("h"), 1))()\nprint(n)' },
		{ name: 'get of a runtime name, called in a function', code: 'k <- 3\nh <- function() k\nf <- function() get(sample(c("h"), 1))()\nprint(f())' }
	],
	'Writes into the frames of callers': [
		{ name: 'parent.frame(2)', code: 'f <- function() g()\ng <- function() assign("y", 5, envir = parent.frame(2))\nh <- function() { y <- 1; f(); y }\nprint(h())' },
		{ name: 'parent.frame(3)', code: 'a <- function() b()\nb <- function() c2()\nc2 <- function() assign("y", 5, envir = parent.frame(3))\nh <- function() { y <- 1; a(); y }\nprint(h())' },
		{ name: 'parent.frame(2) reverse order', code: 'h <- function() { y <- 1; f(); y }\ng <- function() assign("y", 5, envir = parent.frame(2))\nf <- function() g()\nprint(h())' },
		{ name: 'parent.frame(2) to global', code: 'y <- 1\nf <- function() g()\ng <- function() assign("y", 5, envir = parent.frame(2))\nf()\nprint(y)' },
		{ name: 'parent.frame(2) evalq', code: 'f <- function() g()\ng <- function() evalq(y <- 5, parent.frame(2))\nh <- function() { y <- 1; f(); y }\nprint(h())' },
		{ name: 'parent.frame(2) dollar', code: 'f <- function() g()\ng <- function() { p <- parent.frame(2); p$y <- 5 }\nh <- function() { y <- 1; f(); y }\nprint(h())' },
		{ name: 'parent.frame(1) explicit', code: 'g <- function() assign("y", 5, envir = parent.frame(1))\nh <- function() { y <- 1; g(); y }\nprint(h())' }
	],
	'Reading the global frame through the environment of a function': [
		{ name: 'environment(g)$f()', code: 'f <- function() k\ng <- function() NULL\nk <- 22\nprint(environment(g)$f())' },
		{ name: 'environment(g)[[f]]()', code: 'f <- function() k\ng <- function() NULL\nk <- 22\nprint(environment(g)[["f"]]())' },
		{ name: 'env held in a variable', code: 'f <- function() k\ng <- function() NULL\nk <- 22\ne <- environment(g)\nprint(e$f())' },
		{ name: 'get from environment(g)', code: 'f <- function() k\ng <- function() NULL\nk <- 22\nprint(get("f", envir = environment(g))())' },
		{ name: 'value from environment(g)', code: 'g <- function() NULL\nk <- 22\nprint(environment(g)$k)' }
	],
	'Quoted code handed on by do.call': [
		{ name: 'do.call quote never forced', code: 'n <- 0\nf <- function(a) 1\nr <- do.call(f, list(quote(n <- 5)))\nprint(n)' },
		{ name: 'do.call quote named', code: 'n <- 0\nf <- function(a) a\nr <- do.call(f, list(a = quote(n <- 5)))\nprint(n)' },
		{ name: 'do.call quote in variable', code: 'n <- 0\nq <- quote(n <- 5)\nf <- function(a) a\nr <- do.call(f, list(q))\nprint(n)' },
		{ name: 'do.call two quotes', code: 'n <- 0\nm <- 0\nf <- function(a, b) a + b\nr <- do.call(f, list(quote(n <- 5), quote(m <- 2)))\nprint(n + m)' },
		{ name: 'do.call quote', code: 'n <- 0\nf <- function(a) a\nr <- do.call(f, list(quote(n <- 5)))\nprint(n)' }
	]
};

describe('Slices checked against R', withTreeSitter(parser => {
	for(const [topic, cases] of Object.entries(groups)) {
		describe(topic, () => cases.forEach(c => sliceMatchesR(parser, c)));
	}
}));
