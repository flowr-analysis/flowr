import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { singlePackageSigDb } from '../../_helper/sigdb';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';
import type { PackageSignatureSource } from '../../../../src/project/sigdb/reader';

/** a signature source knowing one exported function of one package, with the given formals */
function sigDbWithFunction(pkg: string, fn: string, formals: readonly string[]): PackageSignatureSource {
	return singlePackageSigDb(pkg, [{ name: fn, line: 1, exported: true, props: [], signature: formals.map(name => ({ name, props: 0 })), callees: [] }]);
}

describe('flowR linter', withTreeSitter(parser => {
	describe('call-arguments', () => {
		const rule = 'call-arguments';
		const withFoo = { sigDb: sigDbWithFunction('foo', 'bar', ['value', 'verbose']), files: { DESCRIPTION: 'Package: pkg\nVersion: 1.0\nImports: foo\n' } };
		describe('unused arguments', () => {
			assertLinterPackage('named argument the function does not take', parser, 'f <- function(a) a\ng <- function() f(a = 1, b = 2)', rule, [
				{ kind: 'unused-named', function: 'f', argument: 'b', certainty: LintingResultCertainty.Certain, loc: [2, 17, 2, 31, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('too many positional arguments', parser, 'f <- function(a, b) a + b\ng <- function() f(1, 2, 3)', rule, [{ kind: 'unused-positional', function: 'f', argument: undefined }].map(({ argument: _, ...r }) => r));
			assertLinterPackage('positional arguments fill the formals left by named ones', parser, 'f <- function(a, b) a + b\ng <- function() f(b = 1, 2, 3)', rule, [{ kind: 'unused-positional', function: 'f' }]);
			assertLinterPackage('dots take anything', parser, 'f <- function(a, ...) a\ng <- function() f(1, 2, b = 3)', rule, []);
			assertLinterPackage('exact number of arguments', parser, 'f <- function(a, b) a + b\ng <- function() f(1, b = 2)', rule, []);
			assertLinterPackage('fewer arguments are fine (missing is no codetools error)', parser, 'f <- function(a, b) a\ng <- function() f(1)', rule, []);
			assertLinterPackage('spread dots may be empty', parser, 'f <- function(a) a\ng <- function(...) f(...)', rule, []);
			assertLinterPackage('empty argument counts as positional', parser, 'f <- function(a) a\ng <- function() f(1, )', rule, [{ kind: 'unused-positional' }]);
			assertLinterPackage('closure returned by a function', parser, 'mk <- function() function(x) x\nh <- mk()\ng <- function() h(y = 1)', rule, [{ kind: 'unused-named', argument: 'y', certainty: LintingResultCertainty.Uncertain }]);
			assertLinterPackage('function bound in a branch is uncertain', parser, 'if(cond) f <- function(a) a else f <- function(a, b) a\ng <- function() f(a = 1, b = 2)', rule, [
				{ kind: 'unused-named', argument: 'b', certainty: LintingResultCertainty.Uncertain }
			]);
			assertLinterPackage('both branches lack the argument', parser, 'if(cond) f <- function(a) a else f <- function(a, c) a\ng <- function() f(a = 1, b = 2)', rule, [
				{ kind: 'unused-named', argument: 'b', certainty: LintingResultCertainty.Certain }
			]);
			assertLinterPackage('unknown function is not checked', parser, 'g <- function(h) h(a = 1)', rule, []);
			assertLinterPackage('local function in a function', parser, 'g <- function() { h <- function(x) x; h(1, 2) }', rule, [{ kind: 'unused-positional', function: 'h' }]);
		});

		describe('partial matching', () => {
			assertLinterPackage('partial name', parser, 'f <- function(value, verbose) value\ng <- function() f(val = 1)', rule, [
				{ kind: 'partial-match', argument: 'val', message: 'possible error in f(): partial argument match of \'val\' to \'value\'' }
			]);
			assertLinterPackage('a partial name is spelled out', parser, 'f <- function(value, verbose) value\ng <- function() f(val = 1)', rule, [
				{ kind: 'partial-match', quickFix: [{ type: 'replace', loc: [2, 19, 2, 21, '/pkg/R/code.R'], description: 'Spell out `value`', replacement: 'value' }] }
			]);
			assertLinterPackage('ambiguous partial name', parser, 'f <- function(value, verbose) value\ng <- function() f(v = 1)', rule, [{ kind: 'ambiguous-match', argument: 'v' }]);
			assertLinterPackage('no partial matching after dots', parser, 'f <- function(..., value) value\ng <- function() f(val = 1)', rule, []);
			assertLinterPackage('partial match before dots', parser, 'f <- function(value, ...) value\ng <- function() f(val = 1)', rule, [{ kind: 'partial-match', argument: 'val' }]);
			assertLinterPackage('exact match wins over partial', parser, 'f <- function(val, value) val\ng <- function() f(val = 1)', rule, []);
			assertLinterPackage('partial matches can be accepted', parser, 'f <- function(value) value\ng <- function() f(val = 1)', rule, [], { reportPartialMatches: false });
			assertLinterPackage('partial match of a package function (signature database)', parser, 'g <- function(x) foo::bar(x, verb = TRUE)', rule, [{ kind: 'partial-match', argument: 'verb', function: 'foo::bar' }], withFoo);
			assertLinterPackage('unused argument of a package function', parser, 'g <- function(x) foo::bar(x, colour = TRUE)', rule, [{ kind: 'unused-named', argument: 'colour', function: 'foo::bar' }], withFoo);
			assertLinterPackage('package function checks can be disabled', parser, 'g <- function(x) foo::bar(x, verb = TRUE)', rule, [], { ...withFoo, checkPackageFunctions: false });
			assertLinterPackage('base function with dots', parser, 'g <- function(x) paste(x, foo = 1)', rule, []);
		});

		describe('dots', () => {
			assertLinterPackage('dots without the formal', parser, 'f <- function(x) g(x, ...)', rule, [{ kind: 'dots-out-of-context', function: 'f' }]);
			assertLinterPackage('..1 without the formal', parser, 'f <- function(x) ..1 + x', rule, [{ kind: 'dots-out-of-context', function: 'f' }]);
			assertLinterPackage('dots with the formal', parser, 'f <- function(x, ...) list(...)', rule, []);
			assertLinterPackage('dots of an enclosing function', parser, 'f <- function(...) lapply(1:3, function(i) list(i, ...))', rule, []);
			assertLinterPackage('dots in an anonymous function', parser, 'f <- function(x) lapply(x, function(i) c(i, ...))', rule, [{ kind: 'dots-out-of-context', function: undefined }].map(({ function: _, ...r }) => r));
		});

		describe('conflicting local definitions', () => {
			assertLinterPackage('two local definitions', parser, 'g <- function(a) {\n  h <- function(x) x\n  if(a) h <- function(x, y) y\n  h(1)\n}', rule, [{ kind: 'conflicting-definitions', function: 'h' }]);
			assertLinterPackage('same formals are fine', parser, 'g <- function(a) { h <- function(x) x; if(a) h <- function(x) -x; h(1) }', rule, []);
			assertLinterPackage('in different functions', parser, 'g <- function() { h <- function(x) x }\nk <- function() { h <- function(y) y }', rule, []);
		});

		describe('false positives the review found', () => {
			assertLinterPackage('dots as an argument name', parser, 'f <- function(type) switch(type, ... = "dots", "other")\ng <- function() alist(x = , ... = )', rule, []);
			assertLinterPackage('quoted calls are data', parser, 'f <- function(a) a\ng <- function() quote(f(1, 2, 3))\nh <- function() quote(list(...))', rule, []);
			assertLinterPackage('formals rewritten by a factory', parser, 'gen <- function(x) { formals(x) <- append(formals(x), alist(callback = )); x }\nbase_read <- function(file) file\nread_chunked <- gen(base_read)\ng <- function() read_chunked("a", callback = print)', rule, []);
			assertLinterPackage('closure from a factory is uncertain', parser, 'mk <- function() function(x) x\nh <- mk()\ng <- function() h(1, 2)', rule, [{ kind: 'unused-positional', certainty: LintingResultCertainty.Uncertain }]);
			assertLinterPackage('signature database formals are uncertain', parser, 'g <- function(x) foo::bar(x, colour = TRUE)', rule, [{ kind: 'unused-named', certainty: LintingResultCertainty.Uncertain }], withFoo);
		});

		describe('scope', () => {
			assertLinterPackage('test code is not checked', parser, 'f <- function(a) a\nf(b = 2)', rule, [], { file: 'tests/testthat/test-f.R' });
		});
	});
}));
