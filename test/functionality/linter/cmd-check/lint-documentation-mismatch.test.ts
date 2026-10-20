import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

const rd = (name: string, usage: string, args: readonly string[] = [], extra = '', aliases: readonly string[] = [name]) =>
	`\\name{${name}}\n${aliases.map(a => `\\alias{${a}}`).join('\n')}\n${extra}\\title{T}\n\\usage{\n${usage}\n}\n` +
	(args.length > 0 ? `\\arguments{\n${args.map(a => `  \\item{${a}}{desc}`).join('\n')}\n}\n` : '');

describe('flowR linter', withTreeSitter(parser => {
	describe('documentation-mismatch', () => {
		const lint = (name: string, code: string, files: Record<string, string | null>, expected: Record<string, unknown>[], cfg: Record<string, unknown> = {}) =>
			assertLinterPackage(name, parser, code, 'documentation-mismatch', expected, { files, ...cfg });

		describe('literal defaults', () => {
			lint('infinite default', 'f <- function(n = Inf) n', { 'NAMESPACE': 'export(f)', 'man/f.Rd': rd('f', 'f(n = Inf)', ['n']) }, []);
			lint('negative infinite default', 'f <- function(n = -Inf) n', { 'NAMESPACE': 'export(f)', 'man/f.Rd': rd('f', 'f(n = -Inf)', ['n']) }, []);
			lint('infinite default differing from the docs', 'f <- function(n = Inf) n', { 'NAMESPACE': 'export(f)', 'man/f.Rd': rd('f', 'f(n = -Inf)', ['n']) }, [{ kind: 'default-mismatch', name: 'n' }]);
			lint('escaped quote default', 'g <- function(quote = \'"\') NULL', { 'NAMESPACE': 'export(g)', 'man/g.Rd': rd('g', 'g(quote = "\\\\"")', ['quote']) }, []);
			lint('quote style does not matter', 'g <- function(x = \'a\') NULL', { 'NAMESPACE': 'export(g)', 'man/g.Rd': rd('g', 'g(x = "a")', ['x']) }, []);
			lint('different strings still mismatch', 'g <- function(x = \'a\') NULL', { 'NAMESPACE': 'export(g)', 'man/g.Rd': rd('g', 'g(x = "b")', ['x']) }, [{ kind: 'default-mismatch', name: 'x' }]);
		});

		describe('nested packages', () => {
			lint('Rd pages below tests are ignored', 'f <- function(x) x', { 'NAMESPACE': 'export(f)', 'man/f.Rd': rd('f', 'f(x)', ['x']), 'tests/testthat/fixtures/pkg/man/k.Rd': rd('k', 'k(a, b)', ['a']) }, []);
			lint('Rd pages below inst are ignored', 'f <- function(x) x', { 'NAMESPACE': 'export(f)', 'man/f.Rd': rd('f', 'f(x)', ['x']), 'inst/testpkg/man/k.Rd': rd('k', 'k(a, b)', ['a']) }, []);
			lint('the own man directory is still checked', 'f <- function(x) x', { 'NAMESPACE': 'export(f)', 'man/f.Rd': rd('f', 'f(x, y)', ['x', 'y']) }, [{ kind: 'argument-mismatch' }]);
		});

		describe('undocumented objects', () => {
			lint('exported object without alias', 'f <- function(x) x\ng <- function(y) y', { 'NAMESPACE': 'export(f)\nexport(g)', 'man/f.Rd': rd('f', 'f(x)', ['x']) }, [
				{ kind: 'undocumented-object', name: 'g', certainty: LintingResultCertainty.Certain, message: 'Undocumented code object: \'g\'', loc: [2, 1, 2, 1, '/pkg/R/code.R'] }
			]);
			lint('without NAMESPACE all objects count', 'f <- function(x) x\ng <- 1', { 'man/f.Rd': rd('f', 'f(x)', ['x']) }, [{ kind: 'undocumented-object', name: 'g' }]);
			lint('non-exported object is fine', 'f <- function(x) x\ng <- 1', { 'NAMESPACE': 'export(f)', 'man/f.Rd': rd('f', 'f(x)', ['x']) }, []);
			lint('exportPattern', 'pub_a <- 1\npub_b <- 2\nother <- 3', { 'NAMESPACE': 'exportPattern("^pub")', 'man/a.Rd': '\\name{a}\n\\alias{pub_a}\n\\title{T}' }, [{ name: 'pub_b' }]);
			lint('dot-prefixed objects are skipped', '.hidden <- 1', { 'man/x.Rd': '\\name{x}\n\\alias{x}\n\\title{T}' }, []);
			lint('documented via a secondary alias', 'f <- function(x) x', { 'man/p.Rd': '\\name{p}\n\\alias{p}\n\\alias{f}\n\\title{T}' }, []);
			lint('internal pages still document', 'f <- function(x) x', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\keyword{internal}\n\\title{T}' }, []);
			lint('no documentation at all with a NAMESPACE', 'f <- function(x) x', { 'NAMESPACE': 'export(f)' }, [{ kind: 'undocumented-object', name: 'f' }]);
			lint('no documentation at all, not required', 'f <- function(x) x', { 'NAMESPACE': 'export(f)' }, [], { requireDocumentation: false });
			lint('no documentation and no NAMESPACE', 'f <- function(x) x', {}, []);
			lint('disabled', 'g <- 1', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{T}' }, [], { checkUndocumented: false });
			lint('only the first definition is reported', 'g <- 1\ng <- 2', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{T}' }, [{ name: 'g', loc: [1, 1, 1, 1, '/pkg/R/code.R'] }]);
			lint('non-function objects count', 'g <- 1', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{T}' }, [{ kind: 'undocumented-object', name: 'g' }]);
			lint('nested definitions are no objects', 'f <- function(x) { h <- 1; h }', { 'man/f.Rd': rd('f', 'f(x)', ['x']) }, []);
			lint('code outside R/ is no package code', 'g <- 1', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{T}' }, [], { file: 'tests/testthat/helper.R' });
			lint('S3method registrations are no exports', 'print.foo <- function(x, ...) x', { 'NAMESPACE': 'S3method(print, foo)', 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{T}' }, []);
		});

		describe('code/documentation mismatches', () => {
			lint('same arguments', 'f <- function(x, y = 1) x', { 'man/f.Rd': rd('f', 'f(x, y = 1)', ['x', 'y']) }, []);
			lint('argument renamed', 'f <- function(x, y) x', { 'man/f.Rd': rd('f', 'f(x, z)', ['x', 'z']) }, [
				{ kind: 'argument-mismatch', name: 'f', rdFile: 'f.Rd', function: 'f', message: 'Codoc mismatches from Rd file \'f.Rd\': f(x, z) in the docs, but f(x, y) in the code', loc: [5, 1, 5, 1, '/pkg/man/f.Rd'] }
			]);
			lint('argument missing in the docs', 'f <- function(x, y) x', { 'man/f.Rd': rd('f', 'f(x)', ['x']) }, [{ kind: 'argument-mismatch' }]);
			lint('argument order', 'f <- function(x, y) x', { 'man/f.Rd': rd('f', 'f(y, x)', ['x', 'y']) }, [{ kind: 'argument-mismatch' }]);
			lint('dots', 'f <- function(x, ...) x', { 'man/f.Rd': rd('f', 'f(x, \\dots)', ['x', '\\dots']) }, []);
			lint('dots missing in the docs', 'f <- function(x, ...) x', { 'man/f.Rd': rd('f', 'f(x)', ['x']) }, [{ kind: 'argument-mismatch' }]);
			lint('S3 method usage', 'print.foo <- function(x, ...) x', { 'man/p.Rd': rd('p', '\\method{print}{foo}(x, ...)', ['x', '...'], '', ['print.foo']) }, []);
			lint('S3 method usage mismatch', 'print.foo <- function(x, ...) x', { 'man/p.Rd': rd('p', '\\method{print}{foo}(y, ...)', ['y', '...'], '', ['print.foo']) }, [{ kind: 'argument-mismatch', name: 'print.foo' }]);
			lint('replacement function', '`foo<-` <- function(x, value) x', { 'man/p.Rd': rd('p', 'foo(x) <- value', ['x', 'value'], '', ['foo<-']) }, []);
			lint('replacement function mismatch', '`foo<-` <- function(x, value) x', { 'man/p.Rd': rd('p', 'foo(x) <- val', ['x', 'val'], '', ['foo<-']) }, [{ kind: 'argument-mismatch' }]);
			lint('function not in code is not checked', 'g <- 1', { 'man/f.Rd': rd('f', 'f(x)', ['x']) }, [{ kind: 'undocumented-object', name: 'g' }]);
			lint('nested functions are not top-level code', 'g <- function() { f <- function(a) a }', { 'man/f.Rd': rd('f', 'f(x)', ['x']) }, [{ name: 'g' }]);
			lint('last definition wins', 'f <- function(x) x\nf <- function(y) y', { 'man/f.Rd': rd('f', 'f(y)', ['y']) }, []);
			lint('disabled', 'f <- function(x, y) x', { 'man/f.Rd': rd('f', 'f(x)', ['x']) }, [], { checkCodoc: false });
			lint('defunct pages are skipped', 'f <- function(x, y) x', { 'man/pkg-defunct.Rd': rd('pkg-defunct', 'f(x)', ['x'], '', ['pkg-defunct', 'f']) }, [], {});

			describe('default values', () => {
				lint('different number', 'f <- function(x = 1) x', { 'man/f.Rd': rd('f', 'f(x = 2)', ['x']) }, [{ kind: 'default-mismatch', name: 'x', message: 'Mismatches in argument default values for \'f\' in Rd file \'f.Rd\': argument \'x\' has 1 in the code, but 2 in the docs' }]);
				lint('different string', 'f <- function(x = "a") x', { 'man/f.Rd': rd('f', 'f(x = "b")', ['x']) }, [{ kind: 'default-mismatch', name: 'x' }]);
				lint('single quotes are the same string', 'f <- function(x = "a") x', { 'man/f.Rd': rd('f', 'f(x = \'a\')', ['x']) }, []);
				lint('different logical', 'f <- function(x = TRUE) x', { 'man/f.Rd': rd('f', 'f(x = FALSE)', ['x']) }, [{ kind: 'default-mismatch' }]);
				lint('docs default but none in code', 'f <- function(x) x', { 'man/f.Rd': rd('f', 'f(x = 1)', ['x']) }, [{ kind: 'default-mismatch', message: 'Mismatches in argument default values for \'f\' in Rd file \'f.Rd\': argument \'x\' has no default in the code, but 1 in the docs' }]);
				lint('no default in docs is fine', 'f <- function(x = 1) x', { 'man/f.Rd': rd('f', 'f(x)', ['x']) }, []);
				lint('non-literal defaults are not compared', 'f <- function(x = c(1, 2)) x', { 'man/f.Rd': rd('f', 'f(x = c(2, 1))', ['x']) }, []);
				lint('literal against non-literal is not compared', 'f <- function(x = 1) x', { 'man/f.Rd': rd('f', 'f(x = a + b)', ['x']) }, []);
				lint('negative number', 'f <- function(x = -1) x', { 'man/f.Rd': rd('f', 'f(x = -1)', ['x']) }, []);
				lint('NULL default', 'f <- function(x = NULL) x', { 'man/f.Rd': rd('f', 'f(x = NULL)', ['x']) }, []);
				lint('disabled', 'f <- function(x = 1) x', { 'man/f.Rd': rd('f', 'f(x = 2)', ['x']) }, [], { checkDefaults: false });
				lint('names mismatch takes precedence', 'f <- function(x = 1) x', { 'man/f.Rd': rd('f', 'f(y = 2)', ['y']) }, [{ kind: 'argument-mismatch' }]);
			});
		});

		describe('Rd usage sections', () => {
			lint('undocumented argument', 'f <- function(x, y) x', { 'man/f.Rd': rd('f', 'f(x, y)', ['x']) }, [
				{ kind: 'undocumented-argument', name: 'y', function: 'f', rdFile: 'f.Rd', message: 'Undocumented arguments in Rd file \'f.Rd\': \'y\'', loc: [5, 1, 5, 1, '/pkg/man/f.Rd'] }
			]);
			lint('undocumented dots', 'f <- function(x, ...) x', { 'man/f.Rd': rd('f', 'f(x, \\dots)', ['x']) }, [{ kind: 'undocumented-argument', name: '...' }]);
			lint('comma separated item documents several', 'f <- function(x, y) x', { 'man/f.Rd': rd('f', 'f(x, y)', ['x, y']) }, []);
			lint('documented argument not in usage', 'f <- function(x) x', { 'man/f.Rd': rd('f', 'f(x)', ['x', 'z']) }, [
				{ kind: 'documented-argument-not-in-usage', name: 'z', rdFile: 'f.Rd', message: 'Documented arguments not in \\usage in Rd file \'f.Rd\': \'z\'', loc: [9, 3, 9, 10, '/pkg/man/f.Rd'] }
			]);
			lint('argument named in a default expression counts as used', 'f <- function(x, n = length(y)) x', { 'man/f.Rd': rd('f', 'f(x, n = length(y))', ['x', 'n', 'y']) }, []);
			lint('internal page may skip arguments', 'f <- function(x) x', { 'man/f.Rd': rd('f', 'f(x)', [], '\\keyword{internal}\n') }, []);
			lint('internal page demanded on request', 'f <- function(x) x', { 'man/f.Rd': rd('f', 'f(x)', [], '\\keyword{internal}\n') }, [{ kind: 'undocumented-argument', name: 'x' }], { checkInternalUsage: true });
			lint('internal page still checks documented arguments', 'f <- function(x) x', { 'man/f.Rd': rd('f', 'f(x)', ['x', 'q'], '\\keyword{internal}\n') }, [{ kind: 'documented-argument-not-in-usage', name: 'q' }]);
			lint('usage function without alias', 'f <- function(x) x', { 'man/f.Rd': rd('f', 'f(x)', ['x'], '', ['other']) }, [{ kind: 'undocumented-object', name: 'f', message: 'Undocumented code object: \'f\'' }, { kind: 'usage-without-alias', name: 'f', message: 'Objects in \\usage without \\alias in Rd file \'f.Rd\': \'f\'' }]);
			lint('replacement function alias', '`foo<-` <- function(x, value) x', { 'man/p.Rd': rd('p', 'foo(x) <- value', ['x', 'value'], '', ['p']) }, [{ kind: 'undocumented-object', name: 'foo<-' }, { kind: 'usage-without-alias', name: 'foo<-' }]);
			lint('usage of several functions', 'f <- function(x) x\ng <- function(y) y', { 'man/f.Rd': rd('f', 'f(x)\ng(y)', ['x', 'y'], '', ['f', 'g']) }, []);
			lint('multi-line usage', 'f <- function(x, y) x', { 'man/f.Rd': rd('f', 'f(x,\n  y)', ['x', 'y']) }, []);
			lint('operator usage disables the argument checks', 'f <- function(x) x', { 'man/f.Rd': rd('f', 'f(x)\nx %op% y', ['x', 'y', 'w'], '', ['f', '%op%']) }, []);
			lint('pages without usage are skipped', 'f <- function(x) x', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\title{T}\n\\arguments{\\item{q}{d}}' }, []);
			lint('disabled', 'f <- function(x, y) x', { 'man/f.Rd': rd('f', 'f(x, y)', ['x']) }, [], { checkUsage: false });
			lint('works for usage of functions that are not in the code', 'g <- 1', { 'man/f.Rd': rd('f', 'f(x)', []) }, [{ kind: 'undocumented-object', name: 'g' }, { kind: 'undocumented-argument', name: 'x' }]);
			lint('each argument is reported once', 'f <- function(x) x\ng <- function(x) x', { 'man/f.Rd': rd('f', 'f(x)\ng(x)', [], '', ['f', 'g']) }, [{ kind: 'undocumented-argument', name: 'x' }]);
		});

		describe('combined', () => {
			lint('mismatch and undocumented argument', 'f <- function(x, y) x', { 'man/f.Rd': rd('f', 'f(x, z)', ['x']) }, [{ kind: 'argument-mismatch', name: 'f' }, { kind: 'undocumented-argument', name: 'z' }]);
			lint('fully consistent package', 'f <- function(x, ...) x\ng <- 1', { 'NAMESPACE': 'export(f)', 'man/f.Rd': rd('f', 'f(x, \\dots)', ['x', '\\dots']) }, []);
		});
	});
}));
