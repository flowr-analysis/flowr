import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('package-hooks', () => {
		const rule = 'package-hooks';
		describe('argument lists', () => {
			assertLinterPackage('proper startup hook', parser, '.onLoad <- function(libname, pkgname) invisible()', 'package-hooks', []);
			assertLinterPackage('abbreviated names are fine', parser, '.onAttach <- function(lib, pkg) invisible()', 'package-hooks', []);
			assertLinterPackage('dots accept anything', parser, '.onLoad <- function(...) invisible()', 'package-hooks', []);
			assertLinterPackage('startup hook without arguments', parser, '.onLoad <- function() invisible()', 'package-hooks', [
				{ hook: '.onLoad', issue: 'arguments', certainty: LintingResultCertainty.Certain, loc: [1, 12, 1, 33, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('swapped startup arguments', parser, '.onAttach <- function(pkgname, libname) invisible()', 'package-hooks', [{ hook: '.onAttach', issue: 'arguments' }]);
			assertLinterPackage('three startup arguments', parser, '.onLoad <- function(libname, pkgname, x) invisible()', 'package-hooks', [{ issue: 'arguments' }]);
			assertLinterPackage('proper detach hook', parser, '.onDetach <- function(libpath) invisible()', 'package-hooks', []);
			assertLinterPackage('detach hook with two arguments', parser, '.onDetach <- function(libpath, pkg) invisible()', 'package-hooks', [{ hook: '.onDetach', issue: 'arguments' }]);
			assertLinterPackage('onUnload is not checked', parser, '.onUnload <- function() invisible()', 'package-hooks', []);
		});

		describe('calls', () => {
			assertLinterPackage('library in onLoad changes the search path', parser, '.onLoad <- function(libname, pkgname) {\n  library(stats)\n}', 'package-hooks', [
				{ issue: 'search-path', call: 'library', loc: [2, 3, 2, 16, '/pkg/R/code.R'], certainty: LintingResultCertainty.Certain }
			]);
			assertLinterPackage('require in onAttach changes the search path', parser, '.onAttach <- function(libname, pkgname) require(stats)', 'package-hooks', [{ issue: 'search-path', call: 'require' }]);
			assertLinterPackage('library(help = ) does not attach', parser, '.onLoad <- function(libname, pkgname) library(help = "stats")', 'package-hooks', []);
			assertLinterPackage('requireNamespace does not change the search path', parser, '.onLoad <- function(libname, pkgname) requireNamespace("stats", quietly = TRUE)', 'package-hooks', []);
			assertLinterPackage('cat in onAttach', parser, '.onAttach <- function(libname, pkgname) cat("Welcome")', 'package-hooks', [{ issue: 'output', call: 'cat' }]);
			assertLinterPackage('message in onLoad', parser, '.onLoad <- function(libname, pkgname) message("hi")', 'package-hooks', [{ issue: 'output', call: 'message' }]);
			assertLinterPackage('print and writeLines', parser, '.onAttach <- function(libname, pkgname) { print(1); writeLines("x") }', 'package-hooks', [
				{ issue: 'output', call: 'print' }, { issue: 'output', call: 'writeLines' }
			]);
			assertLinterPackage('packageStartupMessage in onAttach is right', parser, '.onAttach <- function(libname, pkgname) packageStartupMessage("Welcome")', 'package-hooks', []);
			assertLinterPackage('packageStartupMessage in onLoad is wrong', parser, '.onLoad <- function(libname, pkgname) packageStartupMessage("Welcome")', 'package-hooks', [
				{ issue: 'output', call: 'packageStartupMessage' }
			]);
			assertLinterPackage('cat to a file is no output', parser, '.onLoad <- function(libname, pkgname) cat("x", file = tempfile())', rule, []);
			assertLinterPackage('writeLines to a connection is no output', parser, '.onLoad <- function(libname, pkgname) { con <- file(tempfile()); writeLines("x", con) }', rule, []);
			assertLinterPackage('write to a file is no output', parser, '.onLoad <- function(libname, pkgname) write(1:3, file = tempfile())', rule, []);
			assertLinterPackage('warning is allowed', parser, '.onLoad <- function(libname, pkgname) warning("old R")', 'package-hooks', []);
			assertLinterPackage('allowed output is configurable', parser, '.onLoad <- function(libname, pkgname) message("hi")', 'package-hooks', [], { allowedOutput: ['warning', 'message'] });
			assertLinterPackage('installed.packages is unsafe', parser, '.onLoad <- function(libname, pkgname) { ip <- installed.packages() }', 'package-hooks', [{ issue: 'unsafe-call', call: 'installed.packages' }]);
			assertLinterPackage('library.dynam belongs into onLoad', parser, '.onAttach <- function(libname, pkgname) library.dynam("pkg", pkgname, libname)', 'package-hooks', [
				{ issue: 'misplaced-call', call: 'library.dynam' }
			]);
			assertLinterPackage('library.dynam in onLoad is right', parser, '.onLoad <- function(libname, pkgname) library.dynam("pkg", pkgname, libname)', 'package-hooks', []);
			assertLinterPackage('library.dynam.unload belongs into onUnload', parser, '.onDetach <- function(libpath) library.dynam.unload("pkg", libpath)', 'package-hooks', [
				{ issue: 'misplaced-call', call: 'library.dynam.unload' }
			]);
			assertLinterPackage('library.dynam.unload in onUnload is right', parser, '.onUnload <- function(libpath) library.dynam.unload("pkg", libpath)', 'package-hooks', []);
			assertLinterPackage('detach hooks may print', parser, '.onDetach <- function(libpath) message("bye")', 'package-hooks', []);
			assertLinterPackage('ordinary functions may do anything', parser, 'f <- function() { library(stats); cat("x") }', 'package-hooks', []);
			assertLinterPackage('redefined cat is no output', parser, 'cat <- function(...) invisible()\n.onAttach <- function(libname, pkgname) cat("x")', 'package-hooks', []);
		});

		describe('calls through package functions (flowR extension)', () => {
			assertLinterPackage('output in a helper', parser, 'welcome <- function() cat("Welcome")\n.onAttach <- function(libname, pkgname) welcome()', 'package-hooks', [
				{ issue: 'output', call: 'cat', certainty: LintingResultCertainty.Uncertain, loc: [2, 41, 2, 49, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('attach in a nested helper', parser, 'a <- function() library(stats)\nb <- function() a()\n.onLoad <- function(libname, pkgname) b()', 'package-hooks', [
				{ issue: 'search-path', call: 'library', certainty: LintingResultCertainty.Uncertain, loc: [3, 39, 3, 41, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('recursive helpers terminate', parser, 'a <- function(n) { cat("x"); if(n > 0) a(n - 1) }\n.onAttach <- function(libname, pkgname) a(3)', 'package-hooks', [{ issue: 'output', call: 'cat' }]);
			assertLinterPackage('conditional output in a helper is no output of the hook', parser, 'register <- function() if(isTRUE(getOption("pkg.verbose"))) message("registered")\n.onLoad <- function(libname, pkgname) register()', rule, []);
			assertLinterPackage('output in a loop of a helper is conditional', parser, 'helper <- function(xs) for(x in xs) cat(x)\n.onAttach <- function(libname, pkgname) helper(1:3)', rule, []);
			assertLinterPackage('nested functions of a helper do not run', parser, 'helper <- function() { cb <- function() cat("x"); invisible(cb) }\n.onAttach <- function(libname, pkgname) helper()', rule, []);
			assertLinterPackage('following calls can be disabled', parser, 'welcome <- function() cat("Welcome")\n.onAttach <- function(libname, pkgname) welcome()', 'package-hooks', [], { followCalls: false });
		});

		describe('obsolete and unexported hooks', () => {
			assertLinterPackage('.First.lib is obsolete', parser, '.First.lib <- function(lib, pkg) invisible()', 'package-hooks', [{ hook: '.First.lib', issue: 'obsolete' }]);
			assertLinterPackage('.Last.lib not exported', parser, '.Last.lib <- function(libpath) invisible()', 'package-hooks', [{ hook: '.Last.lib', issue: 'unexported' }], {
				files: { NAMESPACE: 'export(f)\n' }
			});
			assertLinterPackage('.Last.lib exported', parser, '.Last.lib <- function(libpath) invisible()', 'package-hooks', [], { files: { NAMESPACE: 'export(f, .Last.lib)\n' } });
			assertLinterPackage('.Last.lib exported by pattern', parser, '.Last.lib <- function(libpath) invisible()', 'package-hooks', [], { files: { NAMESPACE: 'exportPattern("^[.]")\n' } });
		});

		describe('scope', () => {
			assertLinterPackage('hooks outside of R/ are ignored', parser, '.onLoad <- function() library(stats)', 'package-hooks', [], { file: 'tests/testthat/helper.R' });
			assertLinterPackage('nested definitions are no hooks', parser, 'f <- function() { .onLoad <- function() 1 }', 'package-hooks', []);
		});
	});
}));
