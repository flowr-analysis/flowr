import { assert, describe, test } from 'vitest';
import { CmdCheckConformance } from '../../../../src/linter/rules/cmd-check/conformance';
import { type LintingRuleNames, LintingRules } from '../../../../src/linter/linter-rules';
import { LintingRuleTag } from '../../../../src/linter/linter-tags';

/** every `checkingLog(Log, "...")` title of `tools:::.check_packages` in R 4.6.1 (with the variable parts dropped) */
const CmdCheckSteps = [
	"'build' directory", 'code files for non-ASCII characters', 'compilation flags in Makevars', 'compilation flags used', 'compiled code',
	"contents of 'data' directory", 'CRAN incoming feasibility', 'C++ specification', 'data for ASCII and uncompressed saves',
	'data for non-ASCII characters', 'demos', 'dependencies in R code', 'DESCRIPTION meta-information', 'examples', 'examples with --run-donttest',
	'extension type', 'files in \'vignettes\'', 'for code/documentation mismatches', 'for code which exercises the package',
	'for detritus in the temp directory', 'for differences from example reference output', 'for .dll and .exe files', 'foreign function calls',
	'for executable files', "for file 'DESCRIPTION'", 'for future file timestamps', 'for GNU extensions in Makefiles', 'for hidden files and directories',
	'for left-over files', 'for left-overs from vignette generation', 'for missing documentation entries', 'for new files in some other directories',
	'for non-standard things in the check directory', 'for portable file names', 'for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)',
	'for sufficient/correct file permissions', 'for unstated dependencies in tests', 'for unstated dependencies in examples',
	'for unstated dependencies in vignettes', 'HTML version of manual', 'if there is a namespace', 'if this is a source package',
	'include directives in Makefiles', 'index information', "installed files from 'inst/doc'", 'installed package size', 'LazyData',
	'line endings in C/C++/Fortran sources/headers', 'line endings in Makefiles', 'line endings in shell scripts',
	'loading without being on the library search path', 'package bundle', 'package dependencies', 'package directory',
	'package namespace information', 'package subdirectories', 'package vignettes', 'PDF version of manual', 'PDF version of manual without index',
	'pragmas in C/C++ headers and code', 'R code for possible problems', 'Rd contents', 'Rd cross-references', 'Rd files', 'Rd line widths',
	'Rd metadata', 'Rd \\usage sections', 're-building of vignette outputs', 'relative paths in package URLs', 'replacement functions',
	'R files for syntax errors', 'R/sysdata.rda', 'running R code from vignettes', 'Rust compilation', 'S3 generic/method consistency',
	'serialization versions', "sizes of PDF files under 'inst/doc'", 'tests', 'top-level files', 'usage of KIND in Fortran files',
	'use of PKG_*FLAGS in Makefiles', 'use of S3 registration', 'use of SHLIB_OPENMP_*FLAGS in Makefiles', 'whether package can be installed',
	'whether startup messages can be suppressed', 'whether tarball can be unpacked', 'whether the namespace can be loaded with stated dependencies',
	'whether the namespace can be unloaded cleanly', 'whether the package can be loaded', 'whether the package can be loaded with stated dependencies',
	'whether the package can be unloaded cleanly'
];

describe('R CMD check conformance', () => {
	const entries = CmdCheckConformance.flatMap(a => a.entries);
	const covered = new Set(entries.map(e => e.check));
	test('every step of R CMD check is covered', () => {
		const missing = CmdCheckSteps.filter(step => !covered.has(step));
		assert.deepStrictEqual(missing, [], 'steps without a rule');
	});
	test('every R CMD check rule is listed', () => {
		const listed = new Set(entries.flatMap(e => e.rules));
		const cmdCheck = (Object.keys(LintingRules) as LintingRuleNames[]).filter(r => (LintingRules[r].info.tags as readonly LintingRuleTag[]).includes(LintingRuleTag.CmdCheck));
		assert.deepStrictEqual(cmdCheck.filter(r => !listed.has(r)), []);
	});
	test('no step is listed twice', () => {
		assert.strictEqual(covered.size, entries.length);
	});
	test('every entry names at least one rule', () => {
		assert.deepStrictEqual(entries.filter(e => e.rules.length === 0).map(e => e.check), []);
	});
});
