import type { LintingRuleNames } from '../../linter-rules';

/** How much of an `R CMD check` step the linter covers. */
export enum ConformanceLevel {
	/** everything the step reports, statically */
	Full = 'full',
	/** what can be decided without building, installing, or running the package */
	Static = 'static',
	/** some of what the step reports */
	Partial = 'partial'
}

/** The sections of the `R CMD check` appendix of the R Packages book (https://r-pkgs.org/R-CMD-check.html), by anchor. */
export type RPackagesSection = 'check-metadata' | 'package-structure' | 'description' | 'namespace' | 'r-code' | 'data' | 'documentation' | 'demos' | 'compiled-code' | 'tests' | 'vignettes';

/** One step of `R CMD check` (a `checking ...` line of its log) and the linting rules covering it. */
export interface ConformanceEntry {
	/** the step, as `R CMD check` names it in its log (`checking <step> ...`) */
	readonly check: string
	/** the line of {@link CmdCheckSource} that starts the step */
	readonly line:  number
	/** the section of the R Packages book describing the step */
	readonly book:  RPackagesSection
	readonly rules: readonly LintingRuleNames[]
	readonly level: ConformanceLevel
	/** what is left out, or what flowR adds */
	readonly note?: string
}

/** A group of related `R CMD check` steps. */
export interface ConformanceArea {
	readonly area:    string
	readonly entries: readonly ConformanceEntry[]
}

const { Full, Static, Partial } = ConformanceLevel;

/** the implementation of `R CMD check` the table follows */
export const CmdCheckSource = 'https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R';
/** the description of `R CMD check` in the R Packages book */
export const RPackagesCmdCheck = 'https://r-pkgs.org/R-CMD-check.html';
/** the description of `R CMD check` in Writing R Extensions */
export const WritingRExtensionsCmdCheck = 'https://cran.r-project.org/doc/manuals/r-release/R-exts.html#Checking-packages';

/**
 * Which linting rules port which step of `R CMD check` (R 4.6.1, `tools:::.check_packages`), so the linter page can
 * show how far flowR conforms to it. A step that needs the package built, installed, or run is covered by the
 * static part of what it checks.
 */
export const CmdCheckConformance: readonly ConformanceArea[] = [
	{
		area:    'The package as a whole',
		entries: [
			{ check: "for file 'DESCRIPTION'", line: 6706, book: 'description', rules: ['description-metadata'], level: Full, note: 'without a DESCRIPTION, flowR does not see a package' },
			{ check: 'whether tarball can be unpacked', line: 7820, book: 'package-structure', rules: ['package-structure'], level: Static, note: 'a source folder needs no unpacking, the path rules of tarballs are checked' },
			{ check: 'package directory', line: 508, book: 'package-structure', rules: ['package-structure'], level: Full },
			{ check: 'if this is a source package', line: 7005, book: 'package-structure', rules: ['package-runtime'], level: Full },
			{ check: 'extension type', line: 6755, book: 'description', rules: ['package-runtime'], level: Full },
			{ check: 'package bundle', line: 6765, book: 'description', rules: ['description-metadata'], level: Partial, note: 'bundles are defunct since R 2.11' },
			{ check: 'if there is a namespace', line: 7971, book: 'namespace', rules: ['package-runtime'], level: Full, note: 'needs the package on disk' }
		]
	},
	{
		area:    'Package structure and files',
		entries: [
			{ check: 'for portable file names', line: 776, book: 'package-structure', rules: ['package-structure'], level: Full },
			{ check: 'for sufficient/correct file permissions', line: 928, book: 'package-structure', rules: ['package-structure'], level: Full, note: 'needs the package on disk' },
			{ check: 'for executable files', line: 5798, book: 'package-structure', rules: ['package-structure'], level: Full, note: 'needs the package on disk' },
			{ check: 'for hidden files and directories', line: 5874, book: 'package-structure', rules: ['package-structure'], level: Full },
			{ check: 'for .dll and .exe files', line: 5840, book: 'package-structure', rules: ['package-structure'], level: Full },
			{ check: 'for future file timestamps', line: 525, book: 'package-structure', rules: ['package-structure'], level: Full, note: 'needs the package on disk' },
			{ check: 'top-level files', line: 1371, book: 'package-structure', rules: ['package-structure'], level: Full },
			{ check: 'for left-over files', line: 1733, book: 'r-code', rules: ['package-structure'], level: Full },
			{ check: 'package subdirectories', line: 1796, book: 'package-structure', rules: ['package-structure'], level: Full },
			{ check: "'build' directory", line: 1325, book: 'package-structure', rules: ['package-structure'], level: Full },
			{ check: 'installed package size', line: 6672, book: 'r-code', rules: ['package-structure'], level: Static, note: 'estimated from the files that would be installed' },
			{ check: "sizes of PDF files under 'inst/doc'", line: 3356, book: 'vignettes', rules: ['package-structure'], level: Static, note: 'reports large PDFs, cannot compact them' },
			{ check: 'line endings in shell scripts', line: 3414, book: 'package-structure', rules: ['package-structure', 'compiled-code'], level: Full },
			{ check: "files in 'vignettes'", line: 3204, book: 'vignettes', rules: ['package-structure'], level: Full },
			{ check: 'for left-overs from vignette generation', line: 696, book: 'vignettes', rules: ['package-structure'], level: Full },
			{ check: "installed files from 'inst/doc'", line: 3106, book: 'vignettes', rules: ['package-structure'], level: Static },
			{ check: 'for code which exercises the package', line: 8103, book: 'tests', rules: ['software-has-tests'], level: Full }
		]
	},
	{
		area:    'DESCRIPTION and dependencies',
		entries: [
			{ check: 'DESCRIPTION meta-information', line: 1008, book: 'description', rules: ['description-metadata', 'software-has-license'], level: Full },
			{ check: 'CRAN incoming feasibility', line: 6786, book: 'description', rules: ['description-metadata'], level: Partial, note: 'the DESCRIPTION based notes; repository queries are left out' },
			{ check: 'package dependencies', line: 6949, book: 'description', rules: ['dependency-declaration', 'description-metadata'], level: Static, note: 'availability and versions asked of the signature database instead of the repositories' },
			{ check: 'dependencies in R code', line: 2169, book: 'description', rules: ['dependency-declaration', 'namespace-access'], level: Full, note: 'resolves package names through variables, knows the loaders of other packages' },
			{ check: 'for unstated dependencies in tests', line: 4779, book: 'tests', rules: ['dependency-declaration'], level: Full },
			{ check: 'for unstated dependencies in examples', line: 2865, book: 'documentation', rules: ['dependency-declaration'], level: Full },
			{ check: 'for unstated dependencies in vignettes', line: 4954, book: 'vignettes', rules: ['dependency-declaration'], level: Full, note: 'including \\VignetteDepends, \\VignetteEngine, VignetteBuilder' },
			{ check: 'whether the package can be loaded with stated dependencies', line: 4173, book: 'description', rules: ['dependency-declaration'], level: Static },
			{ check: 'whether the namespace can be loaded with stated dependencies', line: 4210, book: 'description', rules: ['dependency-declaration', 'package-runtime'], level: Static },
			{ check: 'LazyData', line: 3037, book: 'data', rules: ['package-data'], level: Full }
		]
	},
	{
		area:    'R code',
		entries: [
			{ check: 'R files for syntax errors', line: 2154, book: 'r-code', rules: ['syntactically-valid'], level: Full },
			{ check: 'code files for non-ASCII characters', line: 2133, book: 'r-code', rules: ['non-ascii-code'], level: Full, note: 'reports each token, escapes strings as a quick fix' },
			{ check: 'R code for possible problems', line: 2302, book: 'r-code', rules: ['undefined-symbol', 'call-arguments', 'global-environment-modification', 'class-string-comparison', 'bogus-return', 'package-hooks', 'namespace-tampering', 'deprecated-functions', 'true-false-abbreviation'], level: Full, note: 'codetools usage checks and the tools:::.check_package_code_* notes; resolves calls through the dataflow graph' },
			{ check: 'S3 generic/method consistency', line: 2198, book: 'r-code', rules: ['s3-method-consistency'], level: Full },
			{ check: 'replacement functions', line: 2235, book: 'r-code', rules: ['s3-method-consistency'], level: Full },
			{ check: 'foreign function calls', line: 2262, book: 'r-code', rules: ['foreign-function-calls'], level: Static, note: 'the routine registration needs the installed package' },
			{ check: 'use of S3 registration', line: 4333, book: 'r-code', rules: ['s3-method-consistency'], level: Static },
			{ check: 'whether startup messages can be suppressed', line: 4306, book: 'r-code', rules: ['package-hooks'], level: Static, note: 'output in package hooks not sent through packageStartupMessage' },
			{ check: 'whether the namespace can be unloaded cleanly', line: 4258, book: 'r-code', rules: ['package-hooks'], level: Static },
			{ check: 'package namespace information', line: 6863, book: 'namespace', rules: ['documentation-mismatch', 'non-ascii-code', 'package-hooks'], level: Partial }
		]
	},
	{
		area:    'Documentation',
		entries: [
			{ check: 'Rd files', line: 2514, book: 'documentation', rules: ['rd-files'], level: Full },
			{ check: 'Rd metadata', line: 2570, book: 'documentation', rules: ['rd-files'], level: Full },
			{ check: 'Rd cross-references', line: 2615, book: 'documentation', rules: ['rd-files'], level: Static, note: 'targets in other packages are asked of the signature database' },
			{ check: 'for missing documentation entries', line: 2694, book: 'documentation', rules: ['documentation-mismatch', 'package-data'], level: Full },
			{ check: 'for code/documentation mismatches', line: 2737, book: 'documentation', rules: ['documentation-mismatch'], level: Full },
			{ check: 'Rd \\usage sections', line: 2788, book: 'documentation', rules: ['documentation-mismatch', 'rd-files'], level: Full },
			{ check: 'Rd contents', line: 2849, book: 'documentation', rules: ['rd-files'], level: Full },
			{ check: 'Rd line widths', line: 2594, book: 'documentation', rules: ['rd-files'], level: Full },
			{ check: 'examples', line: 4656, book: 'documentation', rules: ['rd-files', 'dependency-declaration'], level: Static, note: 'parses the examples and checks what they call, without running them' },
			{ check: 'PDF version of manual', line: 5540, book: 'documentation', rules: ['rd-files'], level: Static, note: 'the Rd constructs that break the LaTeX rendering' },
			{ check: 'PDF version of manual without index', line: 5579, book: 'documentation', rules: ['rd-files'], level: Static },
			{ check: 'index information', line: 1752, book: 'documentation', rules: ['package-metafiles'], level: Full },
			{ check: 'demos', line: 4793, book: 'demos', rules: ['package-metafiles', 'package-structure'], level: Static, note: 'the demo index and file names, the demos are not run' },
			{ check: 'package subdirectories (CITATION)', line: 1796, book: 'documentation', rules: ['package-metafiles'], level: Full },
			{ check: 'relative paths in package URLs', line: 4402, book: 'documentation', rules: ['package-metafiles'], level: Static }
		]
	},
	{
		area:    'Data',
		entries: [
			{ check: "contents of 'data' directory", line: 2891, book: 'data', rules: ['package-data'], level: Full },
			{ check: 'data for ASCII and uncompressed saves', line: 3077, book: 'data', rules: ['package-data'], level: Full },
			{ check: 'R/sysdata.rda', line: 3090, book: 'data', rules: ['package-data'], level: Full },
			{ check: 'serialization versions', line: 988, book: 'data', rules: ['package-data'], level: Full },
			{ check: 'data for non-ASCII characters', line: 3002, book: 'data', rules: ['package-data'], level: Partial, note: 'the encodings of saved strings are not read' }
		]
	},
	{
		area:    'Compiled code',
		entries: [
			{ check: 'compilation flags in Makevars', line: 3501, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'use of PKG_*FLAGS in Makefiles', line: 3611, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'use of SHLIB_OPENMP_*FLAGS in Makefiles', line: 3643, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)', line: 3559, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'for GNU extensions in Makefiles', line: 3514, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'include directives in Makefiles', line: 3848, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'line endings in Makefiles', line: 3479, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'line endings in C/C++/Fortran sources/headers', line: 3436, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'pragmas in C/C++ headers and code', line: 3882, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'usage of KIND in Fortran files', line: 656, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'C++ specification', line: 6642, book: 'compiled-code', rules: ['compiled-code'], level: Full },
			{ check: 'compiled code', line: 4010, book: 'compiled-code', rules: ['compiled-code'], level: Static, note: 'the calls the shared object would import, read off the sources' },
			{ check: 'whether package can be installed', line: 5961, book: 'r-code', rules: ['compiled-code', 'dependency-declaration', 'package-runtime'], level: Static, note: 'useDynLib and src/ in agreement, headers from LinkingTo, undefined exports' },
			{ check: 'compilation flags used', line: 3934, book: 'compiled-code', rules: ['compiled-code'], level: Static, note: 'the flags the Makevars state, not the ones the toolchain was called with' },
			{ check: 'Rust compilation', line: 4120, book: 'compiled-code', rules: ['package-runtime'], level: Static, note: 'Rust sources need Cargo and rustc in SystemRequirements' }
		]
	},
	{
		area:    'Installing, loading, and running',
		entries: [
			{ check: 'whether the package can be loaded', line: 4144, book: 'r-code', rules: ['package-runtime'], level: Static, note: 'S3 methods registered without a function, imports of unexported names' },
			{ check: 'loading without being on the library search path', line: 4282, book: 'r-code', rules: ['package-runtime'], level: Static, note: 'the package attaching itself' },
			{ check: 'whether the package can be unloaded cleanly', line: 4189, book: 'r-code', rules: ['package-hooks'], level: Static },
			{ check: 'tests', line: 4797, book: 'tests', rules: ['package-runtime', 'dependency-declaration'], level: Static, note: 'tests that never run, run another package, or do not parse' },
			{ check: 'for differences from example reference output', line: 4639, book: 'tests', rules: ['package-runtime'], level: Static, note: 'reference output without its test' },
			{ check: 'running R code from vignettes', line: 5255, book: 'vignettes', rules: ['package-runtime', 'dependency-declaration'], level: Static, note: 'vignette code that does not parse' },
			{ check: 're-building of vignette outputs', line: 5400, book: 'vignettes', rules: ['package-runtime'], level: Static, note: 'vignettes without index entry or engine' },
			{ check: 'package vignettes', line: 4944, book: 'vignettes', rules: ['package-runtime', 'package-structure'], level: Static },
			{ check: 'examples with --run-donttest', line: 4738, book: 'documentation', rules: ['rd-files', 'dependency-declaration'], level: Static, note: 'the \\donttest code is checked like all examples' },
			{ check: 'for non-standard things in the check directory', line: 8110, book: 'package-structure', rules: ['package-runtime', 'rd-files'], level: Static, note: 'files tests, vignettes, and examples write into the working directory' },
			{ check: 'for detritus in the temp directory', line: 8151, book: 'package-structure', rules: ['package-runtime', 'rd-files'], level: Partial, note: 'only the files written by name' },
			{ check: 'for new files in some other directories', line: 8173, book: 'package-structure', rules: ['package-runtime', 'rd-files'], level: Partial, note: 'only the files written by name' },
			{ check: 'HTML version of manual', line: 5641, book: 'documentation', rules: ['rd-files'], level: Static, note: 'the Rd files that would not render' }
		]
	}
];

/** The steps of {@link CmdCheckConformance} numbered in the order the table lists them, which is how the wiki refers to them. */
export function numberedConformance(): readonly (ConformanceEntry & { readonly number: number, readonly area: string })[] {
	let number = 0;
	return CmdCheckConformance.flatMap(({ area, entries }) => entries.map(e => ({ ...e, area, number: ++number })));
}
