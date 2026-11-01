_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="package-runtime">Package Runtime&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 4–5, 7, 33, 77, 79–81, 83–87, 89–91](https://img.shields.io/badge/cmd--check-4%E2%80%935%2C%207%2C%2033%2C%2077%2C%2079%E2%80%9381%2C%2083%E2%80%9387%2C%2089%E2%80%9391-blueviolet) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [4](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-4) | [if this is a source package](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L7005) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🟩 | the Built field and object files in src are not checked |
| [5](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-5) | [extension type](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6755) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🟩 |  |
| [7](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-7) | [if there is a namespace](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L7971) ([book](https://r-pkgs.org/R-CMD-check.html#namespace)) | 🟩 | needs the package on disk |
| [33](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-33) | [whether the namespace can be loaded with stated dependencies](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4210) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🔷 |  |
| [77](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-77) | [whether package can be installed](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5961) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷⭐ | ⭐ also compiled code never loaded for lack of useDynLib<br>useDynLib and src/ in agreement, headers from LinkingTo, undefined exports |
| [79](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-79) | [Rust compilation](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4120) ([book](https://r-pkgs.org/R-CMD-check.html#compiled-code)) | 🔷 | Rust sources need Cargo and rustc in SystemRequirements |
| [80](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-80) | [whether the package can be loaded](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4144) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷 | S3 methods registered without a function, imports of unexported names |
| [81](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-81) | [loading without being on the library search path](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4282) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷 | the package attaching itself |
| [83](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-83) | [tests](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4797) ([book](https://r-pkgs.org/R-CMD-check.html#tests)) | 🔷⭐ | ⭐ also testthat tests without a runner, runners testing another package<br>tests are not run, only checked for runners and syntax |
| [84](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-84) | [for differences from example reference output](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4639) ([book](https://r-pkgs.org/R-CMD-check.html#tests)) | 🔷⭐ | ⭐ also reference output without its test<br>example output is not compared with its reference |
| [85](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-85) | [running R code from vignettes](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5255) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🔷 | vignette code that does not parse |
| [86](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-86) | [re-building of vignette outputs](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5400) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🔷 | vignettes without index entry or engine |
| [87](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-87) | [package vignettes](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4944) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🔷 | non-ASCII vignettes without declared encoding are not reported |
| [89](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-89) | [for non-standard things in the check directory](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L8110) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🔷 | files tests, vignettes, and examples write into the working directory |
| [90](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-90) | [for detritus in the temp directory](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L8151) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🔶 | only the files written by name |
| [91](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-91) | [for new files in some other directories](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L8173) ([book](https://r-pkgs.org/R-CMD-check.html#package-structure)) | 🔶 | only the files written by name |

This rule is a <code>best-effort</code> rule.
 
Finds what makes installing, loading, or running the package fail without doing so: undefined exports, export patterns matching nothing, a NAMESPACE exporting nothing, S3 methods without a function, bad NAMESPACE imports, a package attaching itself, tests that never run, test or vignette code that does not parse, missing vignette metadata, and files written into the working directory.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-runtime.ts#L340">src/linter/rules/cmd-check/package-runtime.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-runtime` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-runtime.ts#L72"><code><span title="report exports of undefined names and export patterns matching nothing (default true)">checkExports</span></code></a>\
report exports of undefined names and export patterns matching nothing (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-runtime.ts#L70"><code><span title="report writes of tests and vignettes into the working directory (default true)">checkWrites</span></code></a>\
report writes of tests and vignettes into the working directory (default `true`)\
_R CMD check [#89](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-89 "checking for non-standard things in the check directory")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-runtime.ts#L74"><code><span title="report a NAMESPACE that exports nothing, unless the package ships data (default true)">requireExports</span></code></a>\
report a NAMESPACE that exports nothing, unless the package ships data (default `true`)

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

`NAMESPACE`:

```text
export(f)
export(g)
exportPattern("^api_")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-runtime",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Runtime** (package-runtime):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ empty-export-pattern at /pkg/NAMESPACE:3.1\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ undefined-export at /pkg/NAMESPACE:2.1

More examples are the test cases in [test/functionality/linter/cmd-check/lint-package-runtime.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts).