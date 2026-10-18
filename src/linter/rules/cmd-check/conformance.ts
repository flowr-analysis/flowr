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

/** One step of `R CMD check` (a `checking ...` line of its log) and the linting rules covering it. */
export interface ConformanceEntry {
	/** the step, as `R CMD check` names it in its log (`checking <step> ...`) */
	readonly check: string
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

/**
 * Which linting rules port which step of `R CMD check` (R 4.6.1, `tools:::.check_packages`), so the linter page can
 * show how far flowR conforms to it. A step that needs the package built, installed, or run is covered by the
 * static part of what it checks.
 */
export const CmdCheckConformance: readonly ConformanceArea[] = [
	{
		area:    'The package as a whole',
		entries: [
			{ check: "for file 'DESCRIPTION'", rules: ['description-metadata'], level: Full, note: 'without a DESCRIPTION, flowR does not see a package' },
			{ check: 'whether tarball can be unpacked', rules: ['package-structure'], level: Static, note: 'a source folder needs no unpacking, the path rules of tarballs are checked' },
			{ check: 'package directory', rules: ['package-structure'], level: Full },
			{ check: 'if this is a source package', rules: ['package-runtime'], level: Full },
			{ check: 'extension type', rules: ['package-runtime'], level: Full },
			{ check: 'package bundle', rules: ['description-metadata'], level: Partial, note: 'bundles are defunct since R 2.11' },
			{ check: 'if there is a namespace', rules: ['package-runtime'], level: Full, note: 'needs the package on disk' }
		]
	},
	{
		area:    'Package structure and files',
		entries: [
			{ check: 'for portable file names', rules: ['package-structure'], level: Full },
			{ check: 'for sufficient/correct file permissions', rules: ['package-structure'], level: Full, note: 'needs the package on disk' },
			{ check: 'for executable files', rules: ['package-structure'], level: Full, note: 'needs the package on disk' },
			{ check: 'for hidden files and directories', rules: ['package-structure'], level: Full },
			{ check: 'for .dll and .exe files', rules: ['package-structure'], level: Full },
			{ check: 'for future file timestamps', rules: ['package-structure'], level: Full, note: 'needs the package on disk' },
			{ check: 'top-level files', rules: ['package-structure'], level: Full },
			{ check: 'for left-over files', rules: ['package-structure'], level: Full },
			{ check: 'package subdirectories', rules: ['package-structure'], level: Full },
			{ check: "'build' directory", rules: ['package-structure'], level: Full },
			{ check: 'installed package size', rules: ['package-structure'], level: Static, note: 'estimated from the files that would be installed' },
			{ check: "sizes of PDF files under 'inst/doc'", rules: ['package-structure'], level: Static, note: 'reports large PDFs, cannot compact them' },
			{ check: 'line endings in shell scripts', rules: ['package-structure', 'compiled-code'], level: Full },
			{ check: "files in 'vignettes'", rules: ['package-structure'], level: Full },
			{ check: 'for left-overs from vignette generation', rules: ['package-structure'], level: Full },
			{ check: "installed files from 'inst/doc'", rules: ['package-structure'], level: Static },
			{ check: 'for code which exercises the package', rules: ['software-has-tests'], level: Full }
		]
	},
	{
		area:    'DESCRIPTION and dependencies',
		entries: [
			{ check: 'DESCRIPTION meta-information', rules: ['description-metadata', 'software-has-license'], level: Full },
			{ check: 'CRAN incoming feasibility', rules: ['description-metadata'], level: Partial, note: 'the DESCRIPTION based notes; repository queries are left out' },
			{ check: 'package dependencies', rules: ['dependency-declaration', 'description-metadata'], level: Static, note: 'availability and versions asked of the signature database instead of the repositories' },
			{ check: 'dependencies in R code', rules: ['dependency-declaration', 'namespace-access'], level: Full, note: 'resolves package names through variables, knows the loaders of other packages' },
			{ check: 'for unstated dependencies in tests', rules: ['dependency-declaration'], level: Full },
			{ check: 'for unstated dependencies in examples', rules: ['dependency-declaration'], level: Full },
			{ check: 'for unstated dependencies in vignettes', rules: ['dependency-declaration'], level: Full, note: 'including \\VignetteDepends, \\VignetteEngine, VignetteBuilder' },
			{ check: 'whether the package can be loaded with stated dependencies', rules: ['dependency-declaration'], level: Static },
			{ check: 'whether the namespace can be loaded with stated dependencies', rules: ['dependency-declaration', 'package-runtime'], level: Static },
			{ check: 'LazyData', rules: ['package-data'], level: Full }
		]
	},
	{
		area:    'R code',
		entries: [
			{ check: 'R files for syntax errors', rules: ['syntactically-valid'], level: Full },
			{ check: 'code files for non-ASCII characters', rules: ['non-ascii-code'], level: Full, note: 'reports each token, escapes strings as a quick fix' },
			{ check: 'R code for possible problems', rules: ['undefined-symbol', 'call-arguments', 'global-environment-modification', 'class-string-comparison', 'bogus-return', 'package-hooks', 'namespace-tampering', 'obsolete-functions', 'true-false-abbreviation'], level: Full, note: 'codetools usage checks and the tools:::.check_package_code_* notes; resolves calls through the dataflow graph' },
			{ check: 'S3 generic/method consistency', rules: ['s3-method-consistency'], level: Full },
			{ check: 'replacement functions', rules: ['s3-method-consistency'], level: Full },
			{ check: 'foreign function calls', rules: ['foreign-function-calls'], level: Static, note: 'the routine registration needs the installed package' },
			{ check: 'use of S3 registration', rules: ['s3-method-consistency'], level: Static },
			{ check: 'whether startup messages can be suppressed', rules: ['package-hooks'], level: Static, note: 'output in package hooks not sent through packageStartupMessage' },
			{ check: 'whether the namespace can be unloaded cleanly', rules: ['package-hooks'], level: Static },
			{ check: 'package namespace information', rules: ['documentation-mismatch', 'non-ascii-code', 'package-hooks'], level: Partial }
		]
	},
	{
		area:    'Documentation',
		entries: [
			{ check: 'Rd files', rules: ['rd-files'], level: Full },
			{ check: 'Rd metadata', rules: ['rd-files'], level: Full },
			{ check: 'Rd cross-references', rules: ['rd-files'], level: Static, note: 'targets in other packages are asked of the signature database' },
			{ check: 'for missing documentation entries', rules: ['documentation-mismatch', 'package-data'], level: Full },
			{ check: 'for code/documentation mismatches', rules: ['documentation-mismatch'], level: Full },
			{ check: 'Rd \\usage sections', rules: ['documentation-mismatch', 'rd-files'], level: Full },
			{ check: 'Rd contents', rules: ['rd-files'], level: Full },
			{ check: 'Rd line widths', rules: ['rd-files'], level: Full },
			{ check: 'examples', rules: ['rd-files', 'dependency-declaration'], level: Static, note: 'parses the examples and checks what they call, without running them' },
			{ check: 'PDF version of manual', rules: ['rd-files'], level: Static, note: 'the Rd constructs that break the LaTeX rendering' },
			{ check: 'PDF version of manual without index', rules: ['rd-files'], level: Static },
			{ check: 'index information', rules: ['package-metafiles'], level: Full },
			{ check: 'demos', rules: ['package-metafiles', 'package-structure'], level: Static, note: 'the demo index and file names, the demos are not run' },
			{ check: 'package subdirectories (CITATION)', rules: ['package-metafiles'], level: Full },
			{ check: 'relative paths in package URLs', rules: ['package-metafiles'], level: Static }
		]
	},
	{
		area:    'Data',
		entries: [
			{ check: "contents of 'data' directory", rules: ['package-data'], level: Full },
			{ check: 'data for ASCII and uncompressed saves', rules: ['package-data'], level: Full },
			{ check: 'R/sysdata.rda', rules: ['package-data'], level: Full },
			{ check: 'serialization versions', rules: ['package-data'], level: Full },
			{ check: 'data for non-ASCII characters', rules: ['package-data'], level: Partial, note: 'the encodings of saved strings are not read' }
		]
	},
	{
		area:    'Compiled code',
		entries: [
			{ check: 'compilation flags in Makevars', rules: ['compiled-code'], level: Full },
			{ check: 'use of PKG_*FLAGS in Makefiles', rules: ['compiled-code'], level: Full },
			{ check: 'use of SHLIB_OPENMP_*FLAGS in Makefiles', rules: ['compiled-code'], level: Full },
			{ check: 'for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)', rules: ['compiled-code'], level: Full },
			{ check: 'for GNU extensions in Makefiles', rules: ['compiled-code'], level: Full },
			{ check: 'include directives in Makefiles', rules: ['compiled-code'], level: Full },
			{ check: 'line endings in Makefiles', rules: ['compiled-code'], level: Full },
			{ check: 'line endings in C/C++/Fortran sources/headers', rules: ['compiled-code'], level: Full },
			{ check: 'pragmas in C/C++ headers and code', rules: ['compiled-code'], level: Full },
			{ check: 'usage of KIND in Fortran files', rules: ['compiled-code'], level: Full },
			{ check: 'C++ specification', rules: ['compiled-code'], level: Full },
			{ check: 'compiled code', rules: ['compiled-code'], level: Static, note: 'the calls the shared object would import, read off the sources' },
			{ check: 'whether package can be installed', rules: ['compiled-code', 'dependency-declaration', 'package-runtime'], level: Static, note: 'useDynLib and src/ in agreement, headers from LinkingTo, undefined exports' },
			{ check: 'compilation flags used', rules: ['compiled-code'], level: Static, note: 'the flags the Makevars state, not the ones the toolchain was called with' },
			{ check: 'Rust compilation', rules: ['package-runtime'], level: Static, note: 'Rust sources need Cargo and rustc in SystemRequirements' }
		]
	},
	{
		area:    'Installing, loading, and running',
		entries: [
			{ check: 'whether the package can be loaded', rules: ['package-runtime'], level: Static, note: 'S3 methods registered without a function, imports of unexported names' },
			{ check: 'loading without being on the library search path', rules: ['package-runtime'], level: Static, note: 'the package attaching itself' },
			{ check: 'whether the package can be unloaded cleanly', rules: ['package-hooks'], level: Static },
			{ check: 'tests', rules: ['package-runtime', 'dependency-declaration'], level: Static, note: 'tests that never run, run another package, or do not parse' },
			{ check: 'for differences from example reference output', rules: ['package-runtime'], level: Static, note: 'reference output without its test' },
			{ check: 'running R code from vignettes', rules: ['package-runtime', 'dependency-declaration'], level: Static, note: 'vignette code that does not parse' },
			{ check: 're-building of vignette outputs', rules: ['package-runtime'], level: Static, note: 'vignettes without index entry or engine' },
			{ check: 'package vignettes', rules: ['package-runtime', 'package-structure'], level: Static },
			{ check: 'examples with --run-donttest', rules: ['rd-files', 'dependency-declaration'], level: Static, note: 'the \\donttest code is checked like all examples' },
			{ check: 'for non-standard things in the check directory', rules: ['package-runtime', 'rd-files'], level: Static, note: 'files tests, vignettes, and examples write into the working directory' },
			{ check: 'for detritus in the temp directory', rules: ['package-runtime', 'rd-files'], level: Partial, note: 'only the files written by name' },
			{ check: 'for new files in some other directories', rules: ['package-runtime', 'rd-files'], level: Partial, note: 'only the files written by name' },
			{ check: 'HTML version of manual', rules: ['rd-files'], level: Static, note: 'the Rd files that would not render' }
		]
	}
];
