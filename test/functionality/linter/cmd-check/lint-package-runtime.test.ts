import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { executeLintingRule } from '../../../../src/linter/linter-executor';
import { LintingResults, LintingResultCertainty  } from '../../../../src/linter/linter-format';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';

describe('flowR linter', withTreeSitter(parser => {
	describe('package-runtime', () => {
		const rule = 'package-runtime';
		const desc = (fields = '') => `Package: pkg\nVersion: 1.0\n${fields}`;

		describe('installing and loading the namespace', () => {
			assertLinterPackage('undefined export', parser, 'f <- function() 1', rule, [
				{ kind: 'undefined-export', certainty: LintingResultCertainty.Certain, loc: [2, 1, 2, 1, '/pkg/NAMESPACE'] }
			], { files: { NAMESPACE: 'export(f)\nexport(g)\n' } });
			assertLinterPackage('exports of variables and data are defined', parser, 'f <- function() 1\nversion_info <- "1.0"', rule, [], { files: { NAMESPACE: 'export(f, version_info, mydata)\n', 'data/mydata.rda': '' } });
			assertLinterPackage('generics set by setGeneric are defined', parser, 'setGeneric("area", function(shape) standardGeneric("area"))', rule, [], { files: { NAMESPACE: 'export(area)\n' } });
			assertLinterPackage('dynamic definitions make the finding uncertain', parser, 'for(n in c("a", "b")) assign(paste0("get_", n), function() n)', rule, [
				{ kind: 'undefined-export', certainty: LintingResultCertainty.Uncertain }
			], { files: { NAMESPACE: 'export(get_a)\n' } });
			assertLinterPackage('re-exported import is defined', parser, 'f <- function(x) x %>% sum()', rule, [], { files: { DESCRIPTION: desc('Imports: magrittr\n'), NAMESPACE: 'importFrom(magrittr, "%>%")\nexport("%>%")\n' } });
			assertLinterPackage('whole imports may provide an export', parser, 'f <- function() 1', rule, [], { files: { DESCRIPTION: desc('Imports: rlang\n'), NAMESPACE: 'import(rlang)\nexport(abort)\n' } });
			assertLinterPackage('definitions by other packages are unknown (R.oo)', parser, 'setMethodS3("readMat", "default", function(con, ...) NULL)', rule, [], { files: { NAMESPACE: 'export(readMat)\nS3method(readMat, default)\n' } });
			assertLinterPackage('literal assign defines the name', parser, 'assign("helper", function() 1)', rule, [], { files: { NAMESPACE: 'export(helper)\n' } });
			assertLinterPackage('export patterns are not checked', parser, 'f <- function() 1', rule, [], { files: { NAMESPACE: 'exportPattern("^[^.]")\n' } });
			assertLinterPackage('S3 method without its function', parser, 'print.foo <- function(x, ...) x', rule, [
				{ kind: 'missing-s3-method', loc: [2, 1, 2, 1, '/pkg/NAMESPACE'] }
			], { files: { NAMESPACE: 'S3method(print, foo)\nS3method(format, foo)\n' } });
			assertLinterPackage('S3 method registered under another function name', parser, 'fmt_foo <- function(x, ...) "foo"', rule, [], { files: { NAMESPACE: 'S3method(format, foo, fmt_foo)\n' } });
			assertLinterPackage('import from an undeclared package', parser, 'f <- function(x) filter(x)', rule, [
				{ kind: 'undeclared-namespace-import', loc: [1, 1, 1, 1, '/pkg/NAMESPACE'] }
			], { files: { NAMESPACE: 'importFrom(dplyr, filter)\n' } });
			assertLinterPackage('import from a declared package', parser, 'f <- function(x) filter(x)', rule, [], { files: { DESCRIPTION: desc('Imports: dplyr\n'), NAMESPACE: 'importFrom(dplyr, filter)\n' } });
			assertLinterPackage('import from a base package needs no declaration', parser, 'f <- function(x) median(x)', rule, [], { files: { NAMESPACE: 'importFrom(stats, median)\nimport(utils)\n' } });
			assertLinterPackage('import from methods needs a declaration', parser, 'f <- function(x) is(x)', rule, [{ kind: 'undeclared-namespace-import' }], { files: { NAMESPACE: 'importFrom(methods, is)\n' } });
			assertLinterPackage('no NAMESPACE, nothing to check', parser, 'f <- function() 1', rule, []);
		});

		describe('loading without being on the library search path', () => {
			assertLinterPackage('package attaching itself', parser, 'f <- function() library(pkg)', rule, [{ kind: 'self-attach' }]);
			assertLinterPackage('require of itself as a string', parser, 'f <- function() require("pkg")', rule, [{ kind: 'self-attach' }]);
			assertLinterPackage('attaching another package is not this', parser, 'f <- function() library(stats)', rule, []);
		});

		describe('tests', () => {
			assertLinterPackage('testthat tests without a runner', parser, 'f <- function() 1', rule, [
				{ kind: 'test-runner', loc: [1, 1, 1, 1, '/pkg/tests/testthat/test-f.R'] }
			], { files: { 'tests/testthat/test-f.R': 'test_that("f", expect_equal(f(), 1))' } });
			assertLinterPackage('testthat tests with a runner', parser, 'f <- function() 1', rule, [], { files: { 'tests/testthat/test-f.R': 'test_that("f", expect_equal(f(), 1))', 'tests/testthat.R': 'library(testthat)\nlibrary(pkg)\ntest_check("pkg")' } });
			assertLinterPackage('runner for another package', parser, 'f <- function() 1', rule, [
				{ kind: 'test-runner', loc: [3, 1, 3, 1, '/pkg/tests/testthat.R'] }
			], { files: { 'tests/testthat/test-f.R': '1', 'tests/testthat.R': 'library(testthat)\nlibrary(pkg)\ntest_check("otherpkg")' } });
			assertLinterPackage('test that does not parse', parser, 'f <- function() 1', rule, [
				{ kind: 'syntax', loc: [2, 1, 2, 1, '/pkg/tests/a.R'] }
			], { files: { 'tests/a.R': 'x <- 1\ny <- (2 +\n' } });
			assertLinterPackage('orphaned reference output', parser, 'f <- function() 1', rule, [{ kind: 'orphan-reference-output' }], { files: { 'tests/a.R': '1', 'tests/b.Rout.save': '> 1' } });
			assertLinterPackage('reference output with its test', parser, 'f <- function() 1', rule, [], { files: { 'tests/a.R': '1', 'tests/a.Rout.save': '> 1' } });
			assertLinterPackage('test writing into the working directory', parser, 'f <- function() 1', rule, [
				{ kind: 'check-directory-write', certainty: LintingResultCertainty.Uncertain }
			], { files: { 'tests/a.R': 'write.csv(iris, "out.csv")' } });
			assertLinterPackage('test writing into tempdir', parser, 'f <- function() 1', rule, [], { files: { 'tests/a.R': 'write.csv(iris, file.path(tempdir(), "out.csv"))\nwrite.csv(iris, tempfile())' } });
			assertLinterPackage('writes can be accepted', parser, 'f <- function() 1', rule, [], { files: { 'tests/a.R': 'write.csv(iris, "out.csv")' }, checkWrites: false });
		});

		describe('vignettes', () => {
			const vignette = (header: string, body = '```{r}\n1 + 1\n```') => `---\ntitle: x\n---\n<!--\n${header}\n-->\n${body}\n`;
			assertLinterPackage('complete vignette', parser, 'f <- function() 1', rule, [], { files: { 'vignettes/a.Rmd': vignette('%\\VignetteIndexEntry{A}\n%\\VignetteEngine{knitr::rmarkdown}') } });
			assertLinterPackage('vignette without index entry', parser, 'f <- function() 1', rule, [{ kind: 'vignette-metadata' }], { files: { 'vignettes/a.Rmd': vignette('%\\VignetteEngine{knitr::rmarkdown}') } });
			assertLinterPackage('R Markdown vignette without engine', parser, 'f <- function() 1', rule, [{ kind: 'vignette-metadata' }], { files: { 'vignettes/a.Rmd': vignette('%\\VignetteIndexEntry{A}') } });
			assertLinterPackage('Sweave needs no engine', parser, 'f <- function() 1', rule, [], { files: { 'vignettes/a.Rnw': '%\\VignetteIndexEntry{A}\n<<>>=\n1\n@\n' } });
			assertLinterPackage('vignette chunk that does not parse', parser, 'f <- function() 1', rule, [{ kind: 'syntax' }], { files: { 'vignettes/a.Rmd': vignette('%\\VignetteIndexEntry{A}\n%\\VignetteEngine{knitr::rmarkdown}', '```{r}\nx <- c(1,\n```') } });
		});

		describe('Rust', () => {
			assertLinterPackage('Rust without system requirements', parser, 'f <- function() 1', rule, [{ kind: 'rust-requirements' }], { files: { 'src/rust/Cargo.toml': '[package]\nname = "pkg"\n' } });
			assertLinterPackage('Rust with system requirements', parser, 'f <- function() 1', rule, [], { files: { DESCRIPTION: desc('SystemRequirements: Cargo (Rust\'s package manager), rustc\n'), 'src/rust/Cargo.toml': '[package]\n' } });
		});

		describe('package directory', () => {
			test('missing NAMESPACE, for a package on disk', async() => {
				const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-runtime-'));
				try {
					fs.mkdirSync(path.join(root, 'R'));
					fs.writeFileSync(path.join(root, 'DESCRIPTION'), desc());
					fs.writeFileSync(path.join(root, 'R', 'a.R'), 'f <- function() 1\n');
					const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
					analyzer.addRequest(`file://${root}`);
					const result = LintingResults.unpackSuccess(await executeLintingRule(rule, analyzer));
					assert.deepStrictEqual(result.results.map(r => r.kind), ['missing-namespace']);
				} finally {
					fs.rmSync(root, { recursive: true, force: true });
				}
			});
			assertLinterPackage('translation packages are no packages', parser, 'f <- function() 1', rule, [{ kind: 'extension-type' }], { files: { DESCRIPTION: desc('Type: Translation\n'), NAMESPACE: '' } });
			assertLinterPackage('installed package handed in', parser, 'f <- function() 1', rule, [{ kind: 'not-source-package' }], { files: { NAMESPACE: '', 'Meta/package.rds': '' } });
		});

		describe('scope', () => {
			assertLinterPackage('package without R code still checks its files', parser, '', rule, [{ kind: 'orphan-reference-output' }], { files: { 'tests/b.Rout.save': '> 1' } });
		});
	});
}));
