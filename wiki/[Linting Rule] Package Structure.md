_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="package-structure">Package Structure&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

R CMD check: [#2](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-2) 🔷, [#3](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-3) 🟩, [#8](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-8) 🟩, [#9](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-9) 🟩, [#10](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-10) 🟩, [#11](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-11) 🟩, [#12](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-12) 🟩, [#13](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-13) 🟩, [#14](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-14) 🟩, [#15](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-15) 🟩, [#16](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-16) 🟩, [#17](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-17) 🟩, [#18](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-18) 🔷, [#19](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-19) 🔷, [#20](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-20) 🟩, [#21](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-21) 🟩, [#22](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-22) 🟩, [#23](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-23) 🔷, [#57](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-57) 🔷, [#87](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-87) 🔷

This rule is a `best-effort` rule.
 
Checks the package files: portable names, hidden files, top-level files, subdirectories, permissions, executables, timestamps, sizes, line endings of scripts, and vignette leftovers.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L326">src/linter/rules/cmd-check/package-structure.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-structure` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L50"><code><span title="whether the package is a built tarball (so inst/doc is expected to hold the vignette outputs)">builtPackage</span></code></a>\
whether the package is a built tarball (so `inst/doc` is expected to hold the vignette outputs)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L40"><code><span title="whether to flag /bin/bash and env bash in configure and cleanup (off in R CMD check by default)">checkBashisms</span></code></a>\
whether to flag `/bin/bash` and `env bash` in `configure` and `cleanup` (off in `R CMD check` by default)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L48"><code><span title="whether to flag files and directories modified in the future (R CMD check does with --as-cran)">checkFutureTimestamps</span></code></a>\
whether to flag files and directories modified in the future (`R CMD check` does with `--as-cran`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L36"><code><span title="whether to check for non-standard top-level files and directories (R CMD check does with --as-cran)">checkTopLevel</span></code></a>\
whether to check for non-standard top-level files and directories (`R CMD check` does with `--as-cran`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L32"><code><span title="names of hidden files and directories the CRAN package checks know about">cranKnownHidden</span></code></a>\
names of hidden files and directories the CRAN package checks know about
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L34"><code><span title="whether to say for each hidden file whether the CRAN package checks know about it">cranPack</span></code></a>\
whether to say for each hidden file whether the CRAN package checks know about it
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L54"><code><span title="the directories of inst/doc that should not be installed">docDirsNotInstalled</span></code></a>\
the directories of `inst/doc` that should not be installed
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L30"><code><span title="hidden files and directories (as paths relative to the package root) that are fine">hiddenAllowed</span></code></a>\
hidden files and directories (as paths relative to the package root) that are fine
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L52"><code><span title="the extensions (without dot) of files that are leftovers when found next to vignettes">leftoverExtensions</span></code></a>\
the extensions (without dot) of files that are leftovers when found next to vignettes
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L44"><code><span title="the installed package size in Mb above which a note is given (default 5)">maxInstalledSizeMb</span></code></a>\
the installed package size in Mb above which a note is given (default `5`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L28"><code><span title="a path of more than this many bytes (with the package name as prefix) is noted (default 100)">maxPathLength</span></code></a>\
a path of more than this many bytes (with the package name as prefix) is noted (default `100`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L46"><code><span title="a PDF in inst/doc of more bytes than this is flagged to be compacted (default 1 MiB)">maxPdfBytes</span></code></a>\
a PDF in `inst/doc` of more bytes than this is flagged to be compacted (default 1 MiB)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L42"><code><span title="the directories of inst that R uses itself">reservedInstDirs</span></code></a>\
the directories of `inst` that R uses itself
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-structure.ts#L38"><code><span title="the files and directories that may be at the top level of a package">standardTopLevel</span></code></a>\
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

Query: **linter** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Structure** (package-structure): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"package-structure":{"results":[],".meta":{"inspectedEntries":0,"onDisk":false}}},".meta":{}},".meta":{}}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-package-structure.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-structure.test.ts).