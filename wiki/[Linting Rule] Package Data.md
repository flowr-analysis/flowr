_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="package-data">Package Data&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 34, 48, 60–64](https://img.shields.io/badge/cmd--check-34%2C%2048%2C%2060%E2%80%9364-blueviolet) </a>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [34](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-34) | [LazyData](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3037) ([book](https://r-pkgs.org/R-CMD-check.html#data)) | 🟩 | the size of the installed LazyData database is not checked |
| [48](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-48) | [for missing documentation entries](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2694) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 | S4 classes and methods are not checked |
| [60](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-60) | [contents of 'data' directory](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2891) ([book](https://r-pkgs.org/R-CMD-check.html#data)) | 🟩 | data sets are not loaded |
| [61](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-61) | [data for ASCII and uncompressed saves](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3077) ([book](https://r-pkgs.org/R-CMD-check.html#data)) | 🟩 | no recompression to estimate the savings |
| [62](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-62) | [R/sysdata.rda](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3090) ([book](https://r-pkgs.org/R-CMD-check.html#data)) | 🟩 | no recompression to estimate the savings |
| [63](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-63) | [serialization versions](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L988) ([book](https://r-pkgs.org/R-CMD-check.html#data)) | 🟩 | .rds files and xz compressed saves are not read |
| [64](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-64) | [data for non-ASCII characters](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L3002) ([book](https://r-pkgs.org/R-CMD-check.html#data)) | 🔶 | the encodings of saved strings are not read |

This rule is a <code>best-effort</code> rule.
 
Finds problems in `data/` and `R/sysdata.rda`: allowed file types, LazyData, compression, the serialization version R needs, and undocumented data sets.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L98">src/linter/rules/cmd-check/package-data.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-data` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L24"><code><span title="report saves that a stronger compression would make much smaller">checkCompaction</span></code></a>\
report saves that a stronger compression would make much smaller\
_R CMD check [#61](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-61 "checking data for ASCII and uncompressed saves"), [#62](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-62 "checking R/sysdata.rda")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L26"><code><span title="report data sets no Rd page documents">checkUndocumented</span></code></a>\
report data sets no Rd page documents\
_R CMD check [#48](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-48 "checking for missing documentation entries")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L22"><code><span title="an uncompressed or ASCII save above this many bytes is flagged">maxUncompressedSize</span></code></a>\
an uncompressed or ASCII save above this many bytes is flagged\
_R CMD check [#61](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-61 "checking data for ASCII and uncompressed saves"), [#62](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-62 "checking R/sysdata.rda")_

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

`data/notes.md`:

```text
what the data means
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-data",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Data** (package-data):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ 'data/notes.md' is not of a type allowed in a 'data' directory at [/pkg/data/notes.md:1.1](file:///pkg/data/notes.md:1:1)

More examples are the test cases in [test/functionality/linter/cmd-check/lint-package-data.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts).