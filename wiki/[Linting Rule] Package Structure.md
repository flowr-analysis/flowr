_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="package-structure">Package Structure&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

This rule is a `best-effort` rule.
 
Port of the file structure checks of `R CMD check`: `checking for portable file names`, `checking for hidden files and directories`, `checking top-level files`, `checking for left-over files`, `checking package subdirectories`, `checking 'build' directory`, `checking for .dll and .exe files`, `checking for executable files`, `checking for sufficient/correct file permissions`, `checking for future file timestamps`, `checking installed package size`, `checking sizes of PDF files under 'inst/doc'`, `checking line endings in shell scripts`, `checking for left-overs from vignette generation`, `checking files in 'vignettes'` and `checking installed files from 'inst/doc'`. Works on the files `R CMD build` keeps (after `.Rbuildignore`); checks that need file system information only run for packages on disk. Unlike `R CMD check`, every finding names the offending file, thresholds and lists are configurable, executables are recognized by their magic bytes, and the installed size is estimated without installing.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L657">src/linter/rules/cmd-check/package-structure.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-structure` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L63"><code><span title="whether the package is a built tarball (so inst/doc is expected to hold the vignette outputs)">builtPackage</span></code></a>\
whether the package is a built tarball (so `inst/doc` is expected to hold the vignette outputs)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L47"><code><span title="whether to flag /bin/bash and env bash in configure and cleanup (off in R CMD check by default)">checkBashisms</span></code></a>\
whether to flag `/bin/bash` and `env bash` in `configure` and `cleanup` (off in `R CMD check` by default)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L57"><code><span title="whether to flag files and directories modified in the future (R CMD check does with --as-cran)">checkFutureTimestamps</span></code></a>\
whether to flag files and directories modified in the future (`R CMD check` does with `--as-cran`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L43"><code><span title="whether to check for non-standard top-level files and directories (R CMD check does with --as-cran)">checkTopLevel</span></code></a>\
whether to check for non-standard top-level files and directories (`R CMD check` does with `--as-cran`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L39"><code><span title="names of hidden files and directories the CRAN package checks know about">cranKnownHidden</span></code></a>\
names of hidden files and directories the CRAN package checks know about
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L41"><code><span title="whether to say for each hidden file whether the CRAN package checks know about it">cranPack</span></code></a>\
whether to say for each hidden file whether the CRAN package checks know about it
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L69"><code><span title="the directories of inst/doc that should not be installed">docDirsNotInstalled</span></code></a>\
the directories of `inst/doc` that should not be installed
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L61"><code><span title="how many seconds a vignette may be newer than its build in inst/doc (default 10)">fileTimeTolerance</span></code></a>\
how many seconds a vignette may be newer than its build in `inst/doc` (default `10`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L67"><code><span title="files that ship with R, which a package should not carry in vignettes or inst/doc">filesAlreadyInR</span></code></a>\
files that ship with R, which a package should not carry in `vignettes` or `inst/doc`
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L59"><code><span title="how many seconds a modification time may be in the future (default 300)">futureLeewaySeconds</span></code></a>\
how many seconds a modification time may be in the future (default `300`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L37"><code><span title="hidden files and directories (as paths relative to the package root) that are fine">hiddenAllowed</span></code></a>\
hidden files and directories (as paths relative to the package root) that are fine
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L65"><code><span title="the extensions (without dot) of files that are leftovers when found next to vignettes">leftoverExtensions</span></code></a>\
the extensions (without dot) of files that are leftovers when found next to vignettes
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L51"><code><span title="the installed package size in Mb above which a note is given (default 5)">maxInstalledSizeMb</span></code></a>\
the installed package size in Mb above which a note is given (default `5`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L33"><code><span title="a path of more than this many bytes (with the package name as prefix) is noted (default 100)">maxPathLength</span></code></a>\
a path of more than this many bytes (with the package name as prefix) is noted (default `100`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L55"><code><span title="a PDF in inst/doc of more bytes than this is flagged to be compacted (default 1 MiB)">maxPdfBytes</span></code></a>\
a PDF in `inst/doc` of more bytes than this is flagged to be compacted (default 1 MiB)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L53"><code><span title="the size in Mb a sub-directory of the installation is listed from (default 1)">maxSubdirSizeMb</span></code></a>\
the size in Mb a sub-directory of the installation is listed from (default `1`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L35"><code><span title="a path of more than this many bytes cannot be stored in a tarball (default 256)">maxTarPathLength</span></code></a>\
a path of more than this many bytes cannot be stored in a tarball (default `256`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L49"><code><span title="the directories of inst that R uses itself">reservedInstDirs</span></code></a>\
the directories of `inst` that R uses itself
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L45"><code><span title="the files and directories that may be at the top level of a package">standardTopLevel</span></code></a>\
the files and directories that may be at the top level of a package

### Examples

```r
f <- function() 1
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-structure",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Structure** (package-structure): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"package-structure":{"results":[],".meta":{"inspectedEntries":0,"onDisk":false}}},".meta":{}},".meta":{}}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-package-structure.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-structure.test.ts)

<h4 id="Test_32_Case:_32_name">Test Case: name</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

```ts
expected.map(([kind, file]) => ({kind, file}))
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-structure.test.ts#L12) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_CRAN-pack_32_does_32_not_32_know_32_the_32_file">Test Case: CRAN-pack does not know the file</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: message = `"Found the following hidden file: 'inst/.foo'. These were most likely included in error. CRAN-pack does not know about this."`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-structure.test.ts#L82) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_CRAN-pack_32_knows_32_the_32_file">Test Case: CRAN-pack knows the file</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: message = `"Found the following hidden file: 'inst/.foo'. These were most likely included in error. CRAN-pack knows about this."`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-structure.test.ts#L83) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_CRAN-pack_32_remark_32_when_32_disabled">Test Case: no CRAN-pack remark when disabled</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: message = `"Found the following hidden file: 'inst/.foo'. These were most likely included in error."`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-structure.test.ts#L84) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_copyright_32_hint">Test Case: copyright hint</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: message = `"Non-standard file found at top level: 'Copyright.txt'. Copyright information should be in file inst/COPYRIGHTS"`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-structure.test.ts#L95) for the test-case implementation.