import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

const R = 'foreign-function-calls';

describe('flowR linter', withTreeSitter(parser => {
	describe('foreign-function-calls', () => {
		const withDesc = (extra: string) => ({ DESCRIPTION: `Package: pkg\nVersion: 1.0\nTitle: A Package\nLicense: MIT\n${extra}` });

		describe('missing PACKAGE', () => {
			assertLinterPackage('.Call with a string routine', parser, 'f <- function(x) .Call("foo", x)', R, [
				{ certainty: LintingResultCertainty.Certain, issue: 'missing-package', call: '.Call', routine: 'foo', message: 'Foreign function call without \'PACKAGE\' argument: .Call("foo", ...)' }
			]);
			for(const fn of ['.C', '.Fortran', '.External']) {
				assertLinterPackage(`${fn} with a string routine`, parser, `f <- function(x) ${fn}("foo", x)`, R, [{ issue: 'missing-package', call: fn }]);
			}
			assertLinterPackage('namespaced base::.Call', parser, 'f <- function(x) base::.Call("foo", x)', R, [{ issue: 'missing-package', call: '.Call' }]);
			assertLinterPackage('calls that are no foreign function calls are skipped', parser, 'f <- function(x) paste("foo", x)', R, []);
			assertLinterPackage('reports the location of the call', parser, 'f <- function(x) {\n  .Call("foo", x)\n}', R, [
				{ loc: [2, 3, 2, 17, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('top-level call', parser, '.C("foo")', R, [{ issue: 'missing-package', routine: 'foo' }]);
			assertLinterPackage('reports every call', parser, 'f <- function() { .Call("a"); .C("b") }', R, [{ routine: 'a' }, { routine: 'b' }]);
			assertLinterPackage('NAMESPACE without useDynLib', parser, 'f <- function(x) .Call("foo", x)', R, [{ issue: 'missing-package' }], { files: { NAMESPACE: 'export(f)\n' } });
			assertLinterPackage('routine named by a named argument', parser, 'f <- function(x) .Call(.NAME = "foo", x)', R, [{ issue: 'missing-package', routine: 'foo' }]);
		});

		describe('no PACKAGE needed', () => {
			assertLinterPackage('useDynLib in the NAMESPACE', parser, 'f <- function(x) .Call("foo", x)', R, [], { files: { NAMESPACE: 'useDynLib(pkg)\n' } });
			assertLinterPackage('useDynLib with registration', parser, 'f <- function(x) .Call("foo", x)', R, [], { files: { NAMESPACE: 'useDynLib(pkg, .registration = TRUE)\n' } });
			assertLinterPackage('useDynLib with symbols', parser, 'f <- function(x) .Call("foo", x)', R, [], { files: { NAMESPACE: 'useDynLib(pkg, foo, bar)\n' } });
			assertLinterPackage('useDynLib with a quoted name', parser, 'f <- function(x) .C("foo", x)', R, [], { files: { NAMESPACE: 'useDynLib("pkg")\n' } });
			assertLinterPackage('routine passed as a symbol', parser, 'f <- function(x) .Call(foo, x)', R, []);
			assertLinterPackage('routine passed as a prefixed symbol', parser, 'f <- function(x) .Call(C_foo, x)', R, []);
			assertLinterPackage('routine passed as a call', parser, 'f <- function(x) .Call(getNativeSymbolInfo("foo"), x)', R, []);
			assertLinterPackage('routine passed as dots', parser, 'f <- function(...) .Call(...)', R, []);
			assertLinterPackage('routine in a variable holding a string, resolution off', parser, 'nm <- "foo"\nf <- function(x) .Call(nm, x)', R, [], { resolveValues: false });
			assertLinterPackage('unresolvable routine variable', parser, 'f <- function(nm, x) .Call(nm, x)', R, []);
			assertLinterPackage('PACKAGE with the package name', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "pkg")', R, []);
			assertLinterPackage('PACKAGE is not partially matched', parser, 'f <- function(x) .Call("foo", x, PACK = "pkg")', R, [{ issue: 'missing-package' }]);
			assertLinterPackage('unresolvable PACKAGE', parser, 'f <- function(p, x) .Call("foo", x, PACKAGE = p)', R, []);
		});

		describe('empty PACKAGE', () => {
			assertLinterPackage('empty string', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "")', R, [{ issue: 'empty-package', call: '.Call', package: '', message: 'Foreign function call with empty \'PACKAGE\' argument: .Call("foo", ...)' }]);
			assertLinterPackage('empty string with useDynLib', parser, 'f <- function(x) .C("foo", x, PACKAGE = "")', R, [{ issue: 'empty-package' }], { files: { NAMESPACE: 'useDynLib(pkg)\n' } });
			assertLinterPackage('empty string through a variable', parser, 'p <- ""\nf <- function(x) .Call("foo", x, PACKAGE = p)', R, [{ issue: 'empty-package' }]);
		});

		describe('PACKAGE naming another package', () => {
			assertLinterPackage('base package', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "stats")', R, [
				{ issue: 'base-package', package: 'stats', message: 'Foreign function call to a base package: .Call("foo", ...)' }
			]);
			assertLinterPackage('non-attached base package', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "tools")', R, [{ issue: 'base-package' }]);
			assertLinterPackage('declared different package', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "other")', R, [
				{ issue: 'different-package', package: 'other', message: 'Foreign function call to a different package: .Call("foo", ...)' }
			], { files: withDesc('Imports: other\n') });
			assertLinterPackage('undeclared different package', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "other")', R, [
				{ issue: 'different-package', package: 'other' },
				{ issue: 'undeclared-package', package: 'other' }
			]);
			assertLinterPackage('undeclared package message', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "other")', R, [
				{ message: 'Foreign function call to a different package: .Call("foo", ...)' },
				{ message: 'Undeclared package "other" in foreign function call: .Call("foo", ...)' }
			]);
			assertLinterPackage('Suggests counts as declared', parser, 'f <- function(x) .C("foo", x, PACKAGE = "other")', R, [{ issue: 'different-package' }], { files: withDesc('Suggests: other\n') });
			assertLinterPackage('LinkingTo does not declare', parser, 'f <- function(x) .C("foo", x, PACKAGE = "other")', R, [{ issue: 'different-package' }, { issue: 'undeclared-package' }], { files: withDesc('LinkingTo: other\n') });
			assertLinterPackage('PACKAGE through a variable', parser, 'p <- "stats"\nf <- function(x) .Call("foo", x, PACKAGE = p)', R, [{ issue: 'base-package', package: 'stats' }]);
			assertLinterPackage('PACKAGE through a variable, resolution off', parser, 'p <- "stats"\nf <- function(x) .Call("foo", x, PACKAGE = p)', R, [], { resolveValues: false });
			assertLinterPackage('DLL of the NAMESPACE is fine', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "mylib")', R, [], { files: { NAMESPACE: 'useDynLib(mylib)\n' } });
			assertLinterPackage('other package than the DLL', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "other")', R, [{ issue: 'different-package' }, { issue: 'undeclared-package' }], { files: { NAMESPACE: 'useDynLib(mylib)\n' } });
			assertLinterPackage('symbol routine with a base PACKAGE', parser, 'f <- function(x) .Call(foo, x, PACKAGE = "stats")', R, [{ issue: 'base-package', call: '.Call' }]);
			assertLinterPackage('no DESCRIPTION, no package to compare with', parser, 'f <- function(x) .Call("foo", x, PACKAGE = "other")', R, [], { files: { DESCRIPTION: null } });
		});

		describe('flowR extensions', () => {
			assertLinterPackage('routine resolved through a variable', parser, 'nm <- "foo"\nf <- function(x) .Call(nm, x)', R, [{ issue: 'missing-package', routine: 'foo' }]);
			assertLinterPackage('redefined .Call', parser, '.Call <- function(...) 1\nf <- function(x) .Call("foo", x)', R, []);
			assertLinterPackage('shadowing local .C', parser, 'f <- function(x) { .C <- function(...) 1; .C("foo", x) }', R, []);
			assertLinterPackage('other native functions are no foreign calls', parser, 'f <- function() dyn.load("foo.so")', R, []);
		});

		describe('files', () => {
			assertLinterPackage('test code is no package code', parser, '.Call("foo")', R, [], { file: 'tests/testthat/test-a.R' });
			assertLinterPackage('inst code is no package code', parser, '.Call("foo")', R, [], { file: 'inst/scripts/run.R' });
		});
	});
}));
