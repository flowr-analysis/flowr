import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('dependency-declaration', () => {
		const rule = 'dependency-declaration';
		const desc = (fields: string) => ({ DESCRIPTION: `Package: pkg\nVersion: 1.0\n${fields}` });

		describe('library and require', () => {
			assertLinterPackage('undeclared library', parser, 'f <- function() library(dplyr)', rule, [
				{ kind: 'undeclared-attach', package: 'dplyr', certainty: LintingResultCertainty.Certain, loc: [1, 17, 1, 30, '/pkg/R/code.R'] }
			], { files: desc(''), reportLibraryCalls: false });
			assertLinterPackage('an undeclared library is also one in package code, as R reports both', parser, 'f <- function() library(dplyr)', rule, [
				{ kind: 'undeclared-attach', package: 'dplyr' }, { kind: 'library-in-package', package: 'dplyr' }
			], { files: desc('') });
			assertLinterPackage('undeclared require with a string', parser, 'f <- function() require("dplyr")', rule, [{ kind: 'undeclared-attach', package: 'dplyr' }], { files: desc(''), reportLibraryCalls: false });
			assertLinterPackage('imports do not attach', parser, 'f <- function() library(dplyr)', rule, [
				{ kind: 'undeclared-attach', package: 'dplyr', message: '\'library\' call not declared from: \'dplyr\' (Imports do not attach a package, use :: instead)' }
			], { files: desc('Imports: dplyr\n'), reportLibraryCalls: false });
			assertLinterPackage('suggested package in package code', parser, 'f <- function() if(require(dplyr)) 1', rule, [{ kind: 'library-in-package', package: 'dplyr' }], { files: desc('Suggests: dplyr\n') });
			assertLinterPackage('library calls can be accepted', parser, 'f <- function() if(require(dplyr)) 1', rule, [], { files: desc('Suggests: dplyr\n'), reportLibraryCalls: false });
			assertLinterPackage('enhanced package', parser, 'f <- function() library(dplyr)', rule, [{ kind: 'library-in-package' }], { files: desc('Enhances: dplyr\n') });
			assertLinterPackage('already attached by depends', parser, 'f <- function() library(dplyr)', rule, [{ kind: 'attached-by-depends', package: 'dplyr' }], { files: desc('Depends: R (>= 4.0), dplyr\n') });
			assertLinterPackage('default package needs no declaration', parser, 'f <- function() library(stats)', rule, [{ kind: 'library-in-package', package: 'stats' }], { files: desc('') });
			assertLinterPackage('non-default base package must be declared for library', parser, 'f <- function() library(tools)', rule, [{ kind: 'undeclared-attach', package: 'tools' }], { files: desc(''), reportLibraryCalls: false });
			assertLinterPackage('own package', parser, 'f <- function() library(pkg)', rule, [], { files: desc('') });
			assertLinterPackage('package name through a variable (flowR extension)', parser, 'p <- "dplyr"\nf <- function() library(p, character.only = TRUE)', rule, [{ kind: 'undeclared-attach', package: 'dplyr' }], { files: desc(''), reportLibraryCalls: false });
			assertLinterPackage('one of several packages is uncertain', parser, 'f <- function(a) { p <- if(a) "dplyr" else "tidyr"; library(p, character.only = TRUE) }', rule, [
				{ kind: 'undeclared-attach', package: 'tidyr', certainty: LintingResultCertainty.Uncertain },
				{ kind: 'undeclared-attach', package: 'dplyr', certainty: LintingResultCertainty.Uncertain }
			], { files: desc(''), reportLibraryCalls: false });
			assertLinterPackage('pacman loads (flowR extension)', parser, 'f <- function() pacman::p_load(dplyr)', rule, [
				{ kind: 'undeclared-namespace', package: 'pacman' }, { kind: 'undeclared-attach', package: 'dplyr' }
			].reverse(), { files: desc(''), reportLibraryCalls: false });
			assertLinterPackage('within clusterEvalQ', parser, 'f <- function(cl) parallel::clusterEvalQ(cl, library(dplyr))', rule, [], { files: desc('') });
			assertLinterPackage('redefined library', parser, 'library <- function(...) NULL\nf <- function() library(dplyr)', rule, [], { files: desc('') });
		});

		describe('namespace loads', () => {
			assertLinterPackage('undeclared requireNamespace', parser, 'f <- function() requireNamespace("dplyr", quietly = TRUE)', rule, [{ kind: 'undeclared-load', package: 'dplyr' }], { files: desc('') });
			assertLinterPackage('undeclared loadNamespace', parser, 'f <- function() loadNamespace("dplyr")', rule, [{ kind: 'undeclared-load', package: 'dplyr' }], { files: desc('') });
			assertLinterPackage('suggested requireNamespace is the recommended way', parser, 'f <- function() if(requireNamespace("dplyr", quietly = TRUE)) dplyr::n()', rule, [], { files: desc('Suggests: dplyr\n') });
			assertLinterPackage('imported loadNamespace', parser, 'f <- function() loadNamespace("dplyr")', rule, [], { files: desc('Imports: dplyr\n') });
			assertLinterPackage('base package needs no declaration', parser, 'f <- function() requireNamespace("tools")', rule, [], { files: desc('') });
			assertLinterPackage('methods needs a declaration', parser, 'f <- function() requireNamespace("methods")', rule, [{ kind: 'undeclared-load', package: 'methods' }], { files: desc('') });
		});

		describe('namespace access', () => {
			assertLinterPackage('undeclared ::', parser, 'f <- function(x) dplyr::filter(x)', rule, [{ kind: 'undeclared-namespace', package: 'dplyr', message: '\'::\' import not declared from: \'dplyr\'' }], { files: desc('') });
			assertLinterPackage('undeclared :::', parser, 'f <- function(x) dplyr:::filter_impl(x)', rule, [{ kind: 'undeclared-namespace', message: '\':::\' import not declared from: \'dplyr\'' }], { files: desc('') });
			assertLinterPackage('undeclared :: of a variable', parser, 'f <- function() ggplot2::mpg', rule, [{ kind: 'undeclared-namespace', package: 'ggplot2' }], { files: desc('') });
			assertLinterPackage('imported ::', parser, 'f <- function(x) dplyr::filter(x)', rule, [], { files: desc('Imports: dplyr\n') });
			assertLinterPackage('suggested ::', parser, 'f <- function(x) dplyr::filter(x)', rule, [], { files: desc('Suggests: dplyr\n') });
			assertLinterPackage('base packages need no declaration', parser, 'f <- function(x) c(stats::median(x), tools::file_ext(x), utils::head(x))', rule, [], { files: desc('') });
			assertLinterPackage('stats4 needs a declaration', parser, 'f <- function(x) stats4::mle(x)', rule, [{ kind: 'undeclared-namespace', package: 'stats4' }], { files: desc('') });
			assertLinterPackage('own ::: is discouraged', parser, 'f <- function(x) pkg:::helper(x)', rule, [{ kind: 'own-triple-colon', package: 'pkg' }], { files: desc('') });
			assertLinterPackage('own :: is fine', parser, 'f <- function(x) pkg::helper(x)', rule, [], { files: desc('') });
			assertLinterPackage('replacement through ::', parser, 'f <- function(x) { dplyr::groups(x) <- 1; x }', rule, [{ kind: 'undeclared-namespace', package: 'dplyr' }], { files: desc('') });
		});

		describe('unused imports', () => {
			assertLinterPackage('import never used', parser, 'f <- function(x) x', rule, [
				{ kind: 'unused-import', package: 'dplyr', loc: [1, 1, 1, 1, '/pkg/DESCRIPTION'] }
			], { files: desc('Imports: dplyr\n') });
			assertLinterPackage('import used by the NAMESPACE', parser, 'f <- function(x) filter(x)', rule, [], { files: { ...desc('Imports: dplyr\n'), NAMESPACE: 'importFrom(dplyr, filter)\n' } });
			assertLinterPackage('import used by a whole-package import', parser, 'f <- function(x) x', rule, [], { files: { ...desc('Imports: dplyr\n'), NAMESPACE: 'import(dplyr)\n' } });
			assertLinterPackage('only the unused of several imports', parser, 'f <- function(x) dplyr::filter(x)', rule, [{ kind: 'unused-import', package: 'tidyr' }], { files: desc('Imports: dplyr, tidyr (>= 1.0)\n') });
			assertLinterPackage('an unresolved load may use any import', parser, 'f <- function(p) requireNamespace(p)', rule, [], { files: desc('Imports: dplyr\n') });
			assertLinterPackage('use in test code does not count', parser, 'f <- function(x) x', rule, [{ kind: 'unused-import' }], { files: { ...desc('Imports: dplyr\n'), 'tests/testthat/test-a.R': 'dplyr::filter(1)' } });
		});

		describe('depends and methods', () => {
			assertLinterPackage('depends not imported, on request', parser, 'f <- function(x) x', rule, [{ kind: 'depends-not-imported', package: 'dplyr' }], {
				files: { ...desc('Depends: dplyr\n'), NAMESPACE: 'export(f)\n' }, reportDependsNotImported: true
			});
			assertLinterPackage('depends not imported, off by default', parser, 'f <- function(x) x', rule, [], { files: { ...desc('Depends: dplyr\n'), NAMESPACE: 'export(f)\n' } });
			assertLinterPackage('depends imported', parser, 'f <- function(x) x', rule, [], {
				files: { ...desc('Depends: dplyr\n'), NAMESPACE: 'import(dplyr)\n' }, reportDependsNotImported: true
			});
			assertLinterPackage('S4 without methods', parser, 'setClass("A", representation(x = "numeric"))', rule, [{ kind: 'undeclared-methods', package: 'methods' }], { files: desc('') });
			assertLinterPackage('S4 with methods imported', parser, 'setClass("A", representation(x = "numeric"))', rule, [], { files: desc('Imports: methods\n') });
		});

		describe('scope', () => {
			assertLinterPackage('no DESCRIPTION, no findings', parser, 'f <- function() library(dplyr)', rule, [], { files: { DESCRIPTION: null } });
			assertLinterPackage('test code may attach suggested packages', parser, 'library(dplyr)', rule, [], { files: desc('Suggests: dplyr\n'), file: 'tests/testthat/test-a.R' });
		});

		describe('tests, vignettes, and examples', () => {
			const f = (fields: string, more: Record<string, string>) => ({ files: { ...desc(fields), ...more } });
			assertLinterPackage('undeclared library in a test', parser, 'f <- function() 1', rule, [
				{ kind: 'undeclared-in-tests', package: 'dplyr', loc: [2, 1, 2, 1, '/pkg/tests/testthat/test-a.R'] }
			], f('', { 'tests/testthat/test-a.R': 'test_that("a", {\nlibrary(dplyr)\n})' }));
			assertLinterPackage('the test framework itself must be declared', parser, 'f <- function() 1', rule, [
				{ kind: 'undeclared-in-tests', package: 'testthat', loc: [1, 1, 1, 1, '/pkg/tests/testthat.R'] }
			], f('', { 'tests/testthat.R': 'library(testthat)\ntest_check("pkg")' }));
			assertLinterPackage('suggested test framework', parser, 'f <- function() 1', rule, [], f('Suggests: testthat\n', { 'tests/testthat.R': 'library(testthat)\ntest_check("pkg")' }));
			assertLinterPackage(':: in a test', parser, 'f <- function() 1', rule, [{ kind: 'undeclared-in-tests', package: 'withr' }], f('', { 'tests/testthat/test-b.R': 'withr::local_tempfile()' }));
			assertLinterPackage('imports count for tests, but tests do not use them for the package', parser, 'f <- function() 1', rule, [{ kind: 'unused-import', package: 'withr' }], f('Imports: withr\n', { 'tests/testthat/test-b.R': 'withr::local_tempfile()' }));
			assertLinterPackage('base packages need no declaration in tests', parser, 'f <- function() 1', rule, [], f('', { 'tests/testthat/test-b.R': 'methods::is(1, "numeric")\nlibrary(tools)' }));
			assertLinterPackage('each package once per file', parser, 'f <- function() 1', rule, [{ kind: 'undeclared-in-tests', package: 'dplyr' }], f('', { 'tests/a.R': 'library(dplyr)\ndplyr::n()' }));
			assertLinterPackage('nested test folders are not run', parser, 'f <- function() 1', rule, [], f('', { 'tests/testthat/fixtures/x.R': 'library(dplyr)' }));
			assertLinterPackage('character.only with a variable is unknown', parser, 'f <- function() 1', rule, [], f('', { 'tests/a.R': 'p <- "x"\nlibrary(p, character.only = TRUE)' }));
			assertLinterPackage('requireNamespace in a vignette chunk', parser, 'f <- function() 1', rule, [
				{ kind: 'undeclared-in-vignettes', package: 'ggplot2', loc: [5, 1, 5, 1, '/pkg/vignettes/intro.Rmd'] }
			], f('', { 'vignettes/intro.Rmd': '---\ntitle: x\n---\n```{r}\nif(requireNamespace("ggplot2")) 1\n```\nText mentioning library(foo)' }));
			assertLinterPackage('chunks that are not evaluated', parser, 'f <- function() 1', rule, [], f('', { 'vignettes/intro.Rmd': '```{r, eval = FALSE}\nlibrary(ggplot2)\n```' }));
			assertLinterPackage('Sweave vignette', parser, 'f <- function() 1', rule, [{ kind: 'undeclared-in-vignettes', package: 'lattice' }], f('', { 'vignettes/a.Rnw': '\\documentclass{article}\n<<setup>>=\nlibrary(lattice)\n@\n' }));
			assertLinterPackage('vignette engine and depends', parser, 'f <- function() 1', rule, [
				{ kind: 'undeclared-vignette-depends', package: 'dplyr' }, { kind: 'undeclared-vignette-depends', package: 'knitr' }
			], f('', { 'vignettes/a.Rmd': '<!--\n%\\VignetteEngine{knitr::rmarkdown}\n%\\VignetteDepends{dplyr}\n-->\n' }));
			assertLinterPackage('declared vignette engine', parser, 'f <- function() 1', rule, [], f('Suggests: knitr, rmarkdown\nVignetteBuilder: knitr\n', { 'vignettes/a.Rmd': '%\\VignetteEngine{knitr::rmarkdown}\n' }));
			assertLinterPackage('undeclared package in examples', parser, 'f <- function() 1', rule, [
				{ kind: 'undeclared-in-examples', package: 'MASS', loc: [4, 1, 4, 1, '/pkg/man/f.Rd'] }
			], f('', { 'man/f.Rd': '\\name{f}\n\\alias{f}\n\\examples{\nlibrary(MASS)\nf()\n}\n' }));
			assertLinterPackage('dontrun examples are not run', parser, 'f <- function() 1', rule, [], f('', { 'man/f.Rd': '\\name{f}\n\\examples{\n\\dontrun{\nlibrary(MASS)\n}\n}\n' }));
			assertLinterPackage('donttest examples are run', parser, 'f <- function() 1', rule, [{ kind: 'undeclared-in-examples', package: 'MASS' }], f('', { 'man/f.Rd': '\\name{f}\n\\examples{\n\\donttest{\nMASS::fractions(0.5)\n}\n}\n' }));
			assertLinterPackage('data(package=) in examples', parser, 'f <- function() 1', rule, [{ kind: 'undeclared-in-examples', package: 'nycflights13' }], f('', { 'man/f.Rd': '\\name{f}\n\\examples{\ndata("flights", package = "nycflights13")\n}\n' }));
			assertLinterPackage('other code checks can be disabled', parser, 'f <- function() 1', rule, [], { ...f('', { 'tests/a.R': 'library(dplyr)' }), checkOtherCode: false });
		});

		describe('DESCRIPTION fields', () => {
			assertLinterPackage('undeclared vignette builder', parser, 'f <- function() 1', rule, [{ kind: 'undeclared-vignette-builder', package: 'knitr' }], { files: desc('VignetteBuilder: knitr\n') });
			assertLinterPackage('rd macros must be imported', parser, 'f <- function() 1', rule, [{ kind: 'undeclared-rd-macros', package: 'mathjaxr' }], { files: desc('Suggests: mathjaxr\nRdMacros: mathjaxr\n') });
			assertLinterPackage('imported rd macros (still an unused import, as for R)', parser, 'f <- function() 1', rule, [{ kind: 'unused-import', package: 'mathjaxr' }], { files: desc('Imports: mathjaxr\nRdMacros: mathjaxr\n'), checkAvailability: false });
			assertLinterPackage('header-only package in imports', parser, 'f <- function() 1', rule, [{ kind: 'unused-import', package: 'BH' }, { kind: 'header-only-import', package: 'BH' }], { files: desc('Imports: BH\n') });
			assertLinterPackage('header-only package in LinkingTo', parser, 'f <- function() 1', rule, [], { files: desc('LinkingTo: BH\n') });
		});
	});
}));
