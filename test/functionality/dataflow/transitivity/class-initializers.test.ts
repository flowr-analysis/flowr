import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';
/** What `Gen$new()` of an R6 or reference class runs: its `initialize` method and the fields that sets, checked against R. */
describe('Instances run their initializer, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'RC init callSuper', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"), methods = list(initialize = function(...) { v <<- k; callSuper(...) }))\nprint(A$new()$v)' },
		{ name: 'RC init no callSuper', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"), methods = list(initialize = function(...) { v <<- k }))\nprint(A$new()$v)' },
		{ name: 'RC init self', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"), methods = list(initialize = function(...) { .self$v <- k }))\nprint(A$new()$v)' },
		{ name: 'RC method via var', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"), methods = list(set = function() { v <<- k }))\na <- A$new()\na$set()\nprint(a$v)' },
		{ name: 'RC init stored', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"), methods = list(initialize = function(...) { v <<- k }))\na <- A$new()\nprint(a$v)' },
		{ name: 'R6 init not last', code: 'library(R6)\nk <- 4\nC <- R6Class("C", public = list(v = NULL, initialize = function() { self$v <- k; invisible(self) }))\nprint(C$new()$v)', sigdb: true },
		{ name: 'R6 init argument', code: 'library(R6)\nk <- 4\nC <- R6Class("C", public = list(v = NULL, initialize = function(x) { self$v <- x; invisible(self) }))\no <- C$new(k)\nprint(o$v)', sigdb: true },
		{ name: 'RC init callSuper stored', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"), methods = list(initialize = function(...) { v <<- k; callSuper(...) }))\na <- A$new()\nprint(a$v)' },
		{ name: 'RC init argument', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"), methods = list(initialize = function(x, ...) { v <<- x; callSuper(...) }))\nprint(A$new(k)$v)' },
		{ name: 'RC initFields', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"), methods = list(initialize = function(...) { initFields(v = k); invisible(.self) }))\nprint(A$new()$v)' },
		{ name: 'RC methods added later', code: 'k <- 6\nA <- setRefClass("A", fields = list(v = "numeric"))\nA$methods(initialize = function(...) { v <<- k; callSuper(...) })\nprint(A$new()$v)' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
