_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-23, 16:00:51 UTC (v2.16.6), do not edit directly._
<h2 id="package-structure">Package Structure&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 2–3, 8–23, 57, 87](https://img.shields.io/badge/cmd--check-2%E2%80%933%2C%208%E2%80%9323%2C%2057%2C%2087-blueviolet) </a>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [2](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-2) | [whether tarball can be unpacked](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L7820) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🔷 | only the path rules of tarballs |
| [3](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-3) | [package directory](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L508) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 |  |
| [8](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-8) | [for portable file names](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L776) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 |  |
| [9](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-9) | [for sufficient/correct file permissions](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L928) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 | needs the package on disk |
| [10](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-10) | [for executable files](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5798) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 | needs the package on disk, detects ELF, PE, and Mach-O binaries |
| [11](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-11) | [for hidden files and directories](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5874) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 |  |
| [12](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-12) | [for .dll and .exe files](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5840) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 |  |
| [13](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-13) | [for future file timestamps](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L525) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 | needs the package on disk |
| [14](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-14) | [top-level files](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L1371) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 | checkbashisms and autoreconf are not run |
| [15](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-15) | [for left-over files](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L1733) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩 |  |
| [16](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-16) | [package subdirectories](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L1796) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 |  |
| [17](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-17) | ['build' directory](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L1325) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 |  |
| [18](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-18) | [installed package size](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6672) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷 | estimated from the files that would be installed |
| [19](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-19) | [sizes of PDF files under 'inst/doc'](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3356) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🔷 | reports large PDFs, cannot compact them |
| [20](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-20) | [line endings in shell scripts](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3414) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 |  |
| [21](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-21) | [files in 'vignettes'](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3204) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🟩 |  |
| [22](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-22) | [for left-overs from vignette generation](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L696) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🟩 |  |
| [23](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-23) | [installed files from 'inst/doc'](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3106) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🔷 |  |
| [57](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-57) | [demos](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4793) ([book](https://r-pkgs.org/R-CMD-check.html#demos)) | 🔷 | the demo index and file names, the demos are not run |
| [87](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-87) | [package vignettes](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4944) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🔷 | non-ASCII vignettes without declared encoding are not reported |

This rule is a <code>best-effort</code> rule.
 
Finds problems in the package files: portable names, hidden files, top-level files, subdirectories, permissions, executables, timestamps, sizes, line endings of scripts, and vignette leftovers.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L329">src/linter/rules/cmd-check/package-structure.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-structure` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L51"><code><span title="whether the package is a built tarball (so inst/doc is expected to hold the vignette outputs)">builtPackage</span></code></a>\
whether the package is a built tarball (so `inst/doc` is expected to hold the vignette outputs)\
_R CMD check [#21](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-21 "checking files in 'vignettes'")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L41"><code><span title="whether to flag /bin/bash and env bash in configure and cleanup (off in R CMD check by default)">checkBashisms</span></code></a>\
whether to flag `/bin/bash` and `env bash` in `configure` and `cleanup` (off in `R CMD check` by default)\
_R CMD check [#14](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-14 "checking top-level files")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L49"><code><span title="whether to flag files and directories modified in the future (R CMD check does with --as-cran)">checkFutureTimestamps</span></code></a>\
whether to flag files and directories modified in the future (`R CMD check` does with `--as-cran`)\
_R CMD check [#13](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-13 "checking for future file timestamps")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L37"><code><span title="whether to check for non-standard top-level files and directories (R CMD check does with --as-cran)">checkTopLevel</span></code></a>\
whether to check for non-standard top-level files and directories (`R CMD check` does with `--as-cran`)\
_R CMD check [#14](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-14 "checking top-level files")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L33"><code><span title="names of hidden files and directories the CRAN package checks know about">cranKnownHidden</span></code></a>\
names of hidden files and directories the CRAN package checks know about\
_R CMD check [#11](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-11 "checking for hidden files and directories")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L35"><code><span title="whether to say for each hidden file whether the CRAN package checks know about it">cranPack</span></code></a>\
whether to say for each hidden file whether the CRAN package checks know about it\
_R CMD check [#11](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-11 "checking for hidden files and directories")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L55"><code><span title="the directories of inst/doc that should not be installed">docDirsNotInstalled</span></code></a>\
the directories of `inst/doc` that should not be installed\
_R CMD check [#23](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-23 "checking installed files from 'inst/doc'")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L31"><code><span title="hidden files and directories (as paths relative to the package root) that are fine">hiddenAllowed</span></code></a>\
hidden files and directories (as paths relative to the package root) that are fine\
_R CMD check [#11](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-11 "checking for hidden files and directories")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L53"><code><span title="the extensions (without dot) of files that are leftovers when found next to vignettes">leftoverExtensions</span></code></a>\
the extensions (without dot) of files that are leftovers when found next to vignettes\
_R CMD check [#21](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-21 "checking files in 'vignettes'"), [#23](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-23 "checking installed files from 'inst/doc'")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L45"><code><span title="the installed package size in Mb above which a note is given (default 5)">maxInstalledSizeMb</span></code></a>\
the installed package size in Mb above which a note is given (default `5`)\
_R CMD check [#18](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-18 "checking installed package size")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L29"><code><span title="a path of more than this many bytes (with the package name as prefix) is noted (default 100)">maxPathLength</span></code></a>\
a path of more than this many bytes (with the package name as prefix) is noted (default `100`)\
_R CMD check [#8](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-8 "checking for portable file names")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L47"><code><span title="a PDF in inst/doc of more bytes than this is flagged to be compacted (default 1 MiB)">maxPdfBytes</span></code></a>\
a PDF in `inst/doc` of more bytes than this is flagged to be compacted (default 1 MiB)\
_R CMD check [#19](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-19 "checking sizes of PDF files under 'inst/doc'")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L43"><code><span title="the directories of inst that R uses itself">reservedInstDirs</span></code></a>\
the directories of `inst` that R uses itself\
_R CMD check [#16](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-16 "checking package subdirectories")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L39"><code><span title="the files and directories that may be at the top level of a package">standardTopLevel</span></code></a>\
the files and directories that may be at the top level of a package\
_R CMD check [#14](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-14 "checking top-level files")_

### Examples

A project with the code `R/code.R`:

```r
f <- function() 1
```

and the files

`DESCRIPTION`:

```text
Package: pkg
Version: 1.0
Title: A Package
License: MIT
```

`R/a:b.R`:

```r
g <- function() 2
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-structure",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Structure** (package-structure):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Found the following file with a non-portable file name: 'R/a:b.R'. This is not a valid file name on all R platforms; please rename the file. at /pkg/R/a:b.R:1.1

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "package-structure": {
        "results": [
          {
            "certainty": "certain",
            "loc": [1,1,1,1,"/pkg/R/a:b.R"],
            "kind": "non-portable-file-name",
            "file": "R/a:b.R",
            "message": "Found the following file with a non-portable file name: 'R/a:b.R'. This is not a valid file name on all R platforms; please rename the file."
          }
        ],
        ".meta": {"inspectedEntries":4,"onDisk":false}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-package-structure.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-structure.test.ts).