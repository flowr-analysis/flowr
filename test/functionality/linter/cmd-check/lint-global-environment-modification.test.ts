import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('global-environment-modification', () => {
		const rule = 'global-environment-modification';
		describe('assign', () => {
			assertLinterPackage('assign into globalenv()', parser, 'f <- function() assign("x", 1, envir = globalenv())', rule, [
				{ kind: 'assign', variable: 'x', certainty: LintingResultCertainty.Certain, loc: [1, 17, 1, 51, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('assign into .GlobalEnv', parser, 'f <- function(v) assign("cache", v, envir = .GlobalEnv)', rule, [{ kind: 'assign', variable: 'cache' }]);
			assertLinterPackage('assign by position 1', parser, 'f <- function() assign("x", 1, pos = 1)', rule, [{ kind: 'assign' }]);
			assertLinterPackage('assign by as.environment(1)', parser, 'f <- function() assign("x", 1, envir = as.environment(1))', rule, [{ kind: 'assign' }]);
			assertLinterPackage('assign by as.environment(".GlobalEnv")', parser, 'f <- function() assign("x", 1, envir = as.environment(".GlobalEnv"))', rule, [{ kind: 'assign' }]);
			assertLinterPackage('positional envir', parser, 'f <- function() assign("x", 1, globalenv())', rule, [{ kind: 'assign' }]);
			assertLinterPackage('computed variable name', parser, 'f <- function(n) assign(n, 1, envir = globalenv())', rule, [{ kind: 'assign', message: 'assign() writes a variable into the global environment, which belongs to the user' }]);
			assertLinterPackage('through a variable bound to the global environment (flowR extension)', parser, 'f <- function() {\n  e <- globalenv()\n  assign("x", 1, envir = e)\n}', rule, [{ kind: 'assign', variable: 'x' }]);
			assertLinterPackage('through two variables', parser, 'f <- function() { e <- .GlobalEnv; g <- e; assign("x", 1, envir = g) }', rule, [{ kind: 'assign' }]);
			assertLinterPackage('.Random.seed is allowed', parser, 'f <- function(s) assign(".Random.seed", s, envir = globalenv())', rule, []);
			assertLinterPackage('allowed globals are configurable', parser, 'f <- function() assign("x", 1, envir = globalenv())', rule, [], { allowedGlobals: ['x'] });
			assertLinterPackage('assign into a local environment', parser, 'f <- function() { e <- new.env(); assign("x", 1, envir = e) }', rule, []);
			assertLinterPackage('assign into the current frame', parser, 'f <- function() assign("x", 1)', rule, []);
			assertLinterPackage('assign into environment()', parser, 'f <- function() assign("x", 1, envir = environment())', rule, []);
			assertLinterPackage('variable sometimes bound to another environment', parser, 'f <- function(a) { e <- new.env(); if(a) e <- globalenv(); assign("x", 1, envir = e) }', rule, []);
			assertLinterPackage('redefined assign', parser, 'assign <- function(...) NULL\nf <- function() assign("x", 1, envir = globalenv())', rule, []);
			assertLinterPackage('redefined globalenv', parser, 'globalenv <- function() new.env()\nf <- function() assign("x", 1, envir = globalenv())', rule, []);
		});

		describe('data', () => {
			assertLinterPackage('data without envir', parser, 'f <- function() data("iris")', rule, [{ kind: 'data' }]);
			assertLinterPackage('data with list', parser, 'f <- function() data(list = "iris", package = "datasets")', rule, [{ kind: 'data' }]);
			assertLinterPackage('data into the global environment', parser, 'f <- function() data(iris, envir = .GlobalEnv)', rule, [{ kind: 'data' }]);
			assertLinterPackage('data into the current environment', parser, 'f <- function() { data(iris, envir = environment()); iris }', rule, []);
			assertLinterPackage('data into a new environment', parser, 'f <- function() { e <- new.env(); data(iris, envir = e) }', rule, []);
			assertLinterPackage('data listing the data sets loads nothing', parser, 'f <- function() data(package = "datasets")', rule, []);
		});

		describe('attach', () => {
			assertLinterPackage('attach a data frame', parser, 'f <- function(d) { attach(d); mean(x) }', rule, [{ kind: 'attach' }]);
			assertLinterPackage('redefined attach', parser, 'attach <- function(x) x\nf <- function(d) attach(d)', rule, []);
		});

		describe('super-assignments', () => {
			assertLinterPackage('no visible binding', parser, 'f <- function() counter <<- 1', rule, [
				{ kind: 'global-superassignment', variable: 'counter', loc: [1, 17, 1, 29, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('right super-assignment', parser, 'f <- function() 1 ->> counter', rule, [{ kind: 'global-superassignment', variable: 'counter' }]);
			assertLinterPackage('binding in the enclosing function', parser, 'make <- function() { n <- 0; function() n <<- n + 1 }', rule, []);
			assertLinterPackage('parameter of the enclosing function', parser, 'make <- function(n) function() n <<- n + 1', rule, []);
			assertLinterPackage('binding two functions up', parser, 'make <- function() { n <- 0; function() function() n <<- 1 }', rule, []);
			assertLinterPackage('binding inside local', parser, 'inc <- local({ n <- 0; function() n <<- n + 1 })', rule, []);
			assertLinterPackage('a local binding of the same function does not count', parser, 'f <- function() { x <- 1; x <<- 2 }', rule, [{ kind: 'global-superassignment', variable: 'x' }]);
			assertLinterPackage('a binding in a sibling function does not count', parser, 'make <- function() { g <- function() n <- 0; function() n <<- 1 }', rule, [{ kind: 'global-superassignment', variable: 'n' }]);
			assertLinterPackage('package variable is locked (flowR extension)', parser, 'cache <- NULL\nset_cache <- function(v) cache <<- v', rule, [
				{ kind: 'locked-superassignment', variable: 'cache' }
			]);
			assertLinterPackage('replacement through a super-assignment', parser, 'opts <- list()\nset <- function(v) opts$a <<- v', rule, [{ kind: 'locked-superassignment', variable: 'opts' }]);
			assertLinterPackage('names() replacement through a super-assignment', parser, 'f <- function(v) names(lst) <<- v', rule, [{ kind: 'global-superassignment', variable: 'lst' }]);
			assertLinterPackage('top-level super-assignment is not within a function', parser, 'x <<- 1', rule, []);
			assertLinterPackage('onLoad runs before the namespace is locked (reticulate idiom)', parser, 'np <- NULL\n.onLoad <- function(libname, pkgname) np <<- reticulate::import("numpy", delay_load = TRUE)', rule, []);
			assertLinterPackage('helper of onLoad is still locked when called later', parser, 'np <- NULL\nset_np <- function() np <<- 1', rule, [{ kind: 'locked-superassignment', variable: 'np' }]);
			assertLinterPackage('top-level local runs at install time', parser, 'cache <- NULL\nlocal({\n  cache <<- function() 1\n})', rule, []);
			assertLinterPackage('for variable of the enclosing function', parser, 'f <- function() { for(i in 1:3) NULL; h <- function() i <<- 0; h() }', rule, []);
			assertLinterPackage('assigned name of the enclosing function', parser, 'f <- function() { assign("z", 0); g <- function() z <<- 1; g() }', rule, []);
			assertLinterPackage('a binding of the same function in a nested scope does not count', parser, 'outer <- function() { inner <- function() { x <- 1; x <<- 2 }; inner() }', rule, [{ kind: 'global-superassignment', variable: 'x' }]);
			assertLinterPackage('state kept in an environment is fine', parser, 'pkg_env <- new.env()\nset <- function(v) pkg_env$x <- v', rule, []);
			assertLinterPackage('super-assignments can be muted', parser, 'f <- function() counter <<- 1', rule, [], { checkSuperAssignments: false });
		});

		describe('scope', () => {
			assertLinterPackage('test code may change the global environment', parser, 'assign("x", 1, envir = globalenv())\nattach(d)', rule, [], { file: 'tests/testthat/test-a.R' });
			assertLinterPackage('several findings in one function', parser, 'f <- function(d) { attach(d); assign("x", 1, envir = globalenv()); y <<- 2 }', rule, [
				{ kind: 'attach' }, { kind: 'assign' }, { kind: 'global-superassignment' }
			]);
		});
	});
}));
