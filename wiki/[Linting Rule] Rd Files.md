_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-24, 20:38:50 UTC (v2.16.6), do not edit directly._
<h2 id="rd-files">Rd Files&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 45–47, 50–55, 88–92](https://img.shields.io/badge/cmd--check-45%E2%80%9347%2C%2050%E2%80%9355%2C%2088%E2%80%9392-blueviolet) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [45](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-45) | [Rd files](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2514) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 | \Sexpr macros are not evaluated |
| [46](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-46) | [Rd metadata](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2570) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩⭐ | ⭐ also Rd names that differ only by case |
| [47](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-47) | [Rd cross-references](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2615) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🔷 | targets in other packages are asked of the signature database |
| [50](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-50) | [Rd \usage sections](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2788) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 |  |
| [51](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-51) | [Rd contents](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2849) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 |  |
| [52](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-52) | [Rd line widths](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2594) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 |  |
| [53](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-53) | [examples](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4656) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🔷⭐ | ⭐ also T and F in the examples<br>parses the examples and checks what they call, without running them |
| [54](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-54) | [PDF version of manual](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5540) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🔷 | the Rd constructs that break the LaTeX rendering |
| [55](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-55) | [PDF version of manual without index](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5579) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🔷 | the Rd constructs that break the LaTeX rendering |
| [88](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-88) | [examples with --run-donttest](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4738) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🔷⭐ | ⭐ also T and F in the examples<br>the \donttest code is checked like all examples |
| [89](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-89) | [for non-standard things in the check directory](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L8110) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🔷 | files tests, vignettes, and examples write into the working directory |
| [90](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-90) | [for detritus in the temp directory](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L8151) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🔶 | only the files written by name |
| [91](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-91) | [for new files in some other directories](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L8173) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🔶 | only the files written by name |
| [92](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-92) | [HTML version of manual](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5641) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🔷 | the Rd files that would not render |

This rule is a <code>best-effort</code> rule.
 
Finds problems in the Rd files: syntax, unknown macros, required and duplicated sections, metadata, cross-references, line widths, contents, and the example code.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L662">src/linter/rules/cmd-check/rd-files.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `rd-files` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L59"><code><span title="report bibentries a page cites but does not show">bibentries</span></code></a>\
report bibentries a page cites but does not show\
_R CMD check [#45](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-45 "checking Rd files")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L49"><code><span title="report missing descriptions and values, argument items without text, and generated boilerplate">contents</span></code></a>\
report missing descriptions and values, argument items without text, and generated boilerplate\
_R CMD check [#51](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-51 "checking Rd contents")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L39"><code><span title="report links to topics no page or package provides">crossReferences</span></code></a>\
report links to topics no page or package provides\
_R CMD check [#47](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-47 "checking Rd cross-references")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L57"><code><span title="report S3 methods a \\usage calls by their full name instead of with \\method">docStyle</span></code></a>\
report S3 methods a `\usage` calls by their full name instead of with `\method`\
_R CMD check [#50](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-50 "checking Rd \usage sections")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L61"><code><span title="parse the examples and report their syntax errors, undefined calls, T and F, q(), and the files they write">examples</span></code></a>\
parse the examples and report their syntax errors, undefined calls, `T` and `F`, `q()`, and the files they write\
_R CMD check [#53](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-53 "checking examples"), [#88](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-88 "checking examples with --run-donttest")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L47"><code><span title="the widest line an \\examples section may have">examplesWidth</span></code></a>\
the widest line an `\examples` section may have\
_R CMD check [#52](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-52 "checking Rd line widths")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L63"><code><span title="Rd macro files to load besides those of the package">extraMacros</span></code></a>\
Rd macro files to load besides those of the package\
_R CMD check [#45](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-45 "checking Rd files")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L55"><code><span title="the keywords besides the standard ones a page may use">keywords</span></code></a>\
the keywords besides the standard ones a page may use\
_R CMD check [#45](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-45 "checking Rd files")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L43"><code><span title="report lines in \\usage and \\examples wider than RdFilesConfig#usageWidth and RdFilesConfig#examplesWidth">lineWidths</span></code></a>\
report lines in `\usage` and `\examples` wider than
<code>RdFilesConfig#usageWidth</code>
and
<code>RdFilesConfig#examplesWidth</code>\
_R CMD check [#52](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-52 "checking Rd line widths")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L37"><code><span title="report duplicate names and aliases, names that differ only by case, and pages without any alias">metadata</span></code></a>\
report duplicate names and aliases, names that differ only by case, and pages without any alias\
_R CMD check [#46](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-46 "checking Rd metadata")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L35"><code><span title="drop parser diagnostics below this checkRd level, the messages of prepare_Rd are always kept">minLevel</span></code></a>\
drop parser diagnostics below this `checkRd` level, the messages of `prepare_Rd` are always kept\
_R CMD check [#45](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-45 "checking Rd files")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L33"><code><span title="report what the Rd parser of R reports: syntax errors, unknown macros, and unexpected sections">parse</span></code></a>\
report what the Rd parser of R reports: syntax errors, unknown macros, and unexpected sections\
_R CMD check [#45](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-45 "checking Rd files")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L51"><code><span title="report functions documented without a \\value section">requireValue</span></code></a>\
report functions documented without a `\value` section\
_R CMD check [#51](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-51 "checking Rd contents")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L53"><code><span title="report keywords that are neither standard nor in RdFilesConfig#keywords">standardKeywords</span></code></a>\
report keywords that are neither standard nor in
<code>RdFilesConfig#keywords</code>\
_R CMD check [#45](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-45 "checking Rd files")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L41"><code><span title="also report links whose target flowR cannot decide">uncertainLinks</span></code></a>\
also report links whose target flowR cannot decide\
_R CMD check [#47](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-47 "checking Rd cross-references")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L45"><code><span title="the widest line a \\usage section may have">usageWidth</span></code></a>\
the widest line a `\usage` section may have\
_R CMD check [#52](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-52 "checking Rd line widths")_

### Examples

A project with the code `R/code.R`:

```r
f <- function(x) x
```

and the files

`DESCRIPTION`:

```text
Package: pkg
Version: 1.0
Title: A Package
License: MIT
```

`man/f.Rd`:

```text
\name{f}
\alias{f}
\title{F}
\description{D}
\details{
  a \foo{x}}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "rd-files",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Rd Files** (rd-files):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ rd-unknown-macro in man/f.Rd at [/pkg/man/f.Rd:6.1](file:///pkg/man/f.Rd:6:1)

More examples are the test cases in [test/functionality/linter/cmd-check/lint-rd-files.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts).