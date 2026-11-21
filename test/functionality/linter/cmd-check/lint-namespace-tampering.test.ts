import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('namespace-tampering', () => {
		const rule = 'namespace-tampering';
		describe('unlockBinding', () => {
			assertLinterPackage('in another namespace', parser, 'f <- function() unlockBinding("mean", asNamespace("base"))', rule, [
				{ kind: 'unlock-binding', namespace: 'base', certainty: LintingResultCertainty.Certain, loc: [1, 17, 1, 58, '/pkg/R/code.R'] }
			]);
			assertLinterPackage('getNamespace', parser, 'f <- function() unlockBinding("x", getNamespace("stats"))', rule, [{ kind: 'unlock-binding', namespace: 'stats' }]);
			assertLinterPackage('package name in a variable (flowR extension)', parser, 'p <- "stats"\nf <- function() unlockBinding("x", asNamespace(p))', rule, [{ kind: 'unlock-binding', namespace: 'stats' }]);
			assertLinterPackage('namespace in a variable (flowR extension)', parser, 'f <- function() {\n  ns <- asNamespace("base")\n  unlockBinding("mean", ns)\n}', rule, [{ kind: 'unlock-binding', namespace: 'base' }]);
			assertLinterPackage('own namespace in a variable', parser, 'f <- function() { ns <- topenv(); unlockBinding("x", ns) }', rule, []);
			assertLinterPackage('own namespace', parser, 'f <- function() unlockBinding("x", asNamespace("pkg"))', rule, []);
			assertLinterPackage('own namespace through topenv', parser, 'f <- function() unlockBinding("x", topenv())', rule, []);
			assertLinterPackage('unknown environment is uncertain', parser, 'f <- function(e) unlockBinding("x", e)', rule, [
				{ kind: 'unlock-binding', certainty: LintingResultCertainty.Uncertain, namespace: undefined }
			].map(({ namespace: _, ...r }) => r));
			assertLinterPackage('other package name', parser, 'f <- function() unlockBinding("x", asNamespace("pkg"))', rule, [{ kind: 'unlock-binding', namespace: 'pkg' }], {
				files: { DESCRIPTION: 'Package: other\nVersion: 1.0\n' }
			});
			assertLinterPackage('through .Internal', parser, 'f <- function(e) .Internal(unlockBinding(quote(x), e))', rule, [{ kind: 'unlock-binding', internal: 'unlockBinding' }]);
		});

		describe('assignInNamespace', () => {
			assertLinterPackage('into base', parser, 'f <- function() assignInNamespace("mean", function(x) 1, "base")', rule, [{ kind: 'assign-in-namespace', namespace: 'base' }]);
			assertLinterPackage('namespaced call', parser, 'f <- function() utils::assignInNamespace("x", 1, ns = "stats")', rule, [{ kind: 'assign-in-namespace', namespace: 'stats' }]);
			assertLinterPackage('into a namespace object', parser, 'f <- function() assignInNamespace("x", 1, ns = asNamespace("stats"))', rule, [{ kind: 'assign-in-namespace', namespace: 'stats' }]);
			assertLinterPackage('into the own namespace', parser, 'f <- function() assignInNamespace("x", 1, "pkg")', rule, []);
			assertLinterPackage('assignInMyNamespace is fine', parser, 'f <- function() assignInMyNamespace("x", 1)', rule, []);
			assertLinterPackage('redefined assignInNamespace', parser, 'assignInNamespace <- function(...) NULL\nf <- function() assignInNamespace("x", 1, "base")', rule, []);
		});

		describe('.Internal', () => {
			assertLinterPackage('internal call', parser, 'f <- function(x) .Internal(inspect(x))', rule, [{ kind: 'internal', internal: 'inspect' }]);
			assertLinterPackage('internal calls can be muted', parser, 'f <- function(x) .Internal(inspect(x))', rule, [], { checkInternal: false });
			assertLinterPackage('top-level internal', parser, 'x <- .Internal(Sys.time())', rule, [{ kind: 'internal', internal: 'Sys.time' }]);
		});

		describe('library.dynam', () => {
			assertLinterPackage('with .so', parser, '.onLoad <- function(lib, pkg) library.dynam("pkg.so", pkg, lib)', rule, [{ kind: 'shared-object-extension' }]);
			assertLinterPackage('with .dll', parser, '.onLoad <- function(lib, pkg) library.dynam("pkg.dll", pkg, lib)', rule, [{ kind: 'shared-object-extension' }]);
			assertLinterPackage('unload with .so', parser, '.onUnload <- function(lib) library.dynam.unload("pkg.so", lib)', rule, [{ kind: 'shared-object-extension' }]);
			assertLinterPackage('name through a variable (flowR extension)', parser, 'so <- "pkg.so"\n.onLoad <- function(lib, pkg) library.dynam(so, pkg, lib)', rule, [{ kind: 'shared-object-extension' }]);
			assertLinterPackage('without extension', parser, '.onLoad <- function(lib, pkg) library.dynam("pkg", pkg, lib)', rule, []);
			assertLinterPackage('name with a dot but no extension', parser, '.onLoad <- function(lib, pkg) library.dynam("my.pkg", pkg, lib)', rule, []);
		});

		describe('scope', () => {
			assertLinterPackage('test code may tamper', parser, 'unlockBinding("mean", asNamespace("base"))', rule, [], { file: 'tests/testthat/test-x.R' });
		});
	});
}));
