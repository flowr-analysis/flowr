_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 06:47:02 UTC (v2.16.2), do not edit directly._
<h2 id="dependency-declaration">Dependency Declaration&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 27–33, 53, 77, 83, 85, 88](https://img.shields.io/badge/cmd--check-27%E2%80%9333%2C%2053%2C%2077%2C%2083%2C%2085%2C%2088-blueviolet) </a> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [27](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-27) | [package dependencies](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6949) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🔷 | availability and versions asked of the signature database instead of the repositories |
| [28](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-28) | [dependencies in R code](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2169) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🟩⭐ | ⭐ also resolves package names through variables and knows the loaders of other packages |
| [29](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-29) | [for unstated dependencies in tests](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4779) ([book](https://r-pkgs.org/R-CMD-check.html#tests)) | 🟩 |  |
| [30](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-30) | [for unstated dependencies in examples](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2865) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 |  |
| [31](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-31) | [for unstated dependencies in vignettes](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4954) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🟩⭐ | ⭐ also packages named in \VignetteEngine |
| [32](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-32) | [whether the package can be loaded with stated dependencies](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4173) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🔷 |  |
| [33](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-33) | [whether the namespace can be loaded with stated dependencies](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4210) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🔷 |  |
| [53](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-53) | [examples](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4656) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🔷⭐ | ⭐ also T and F in the examples<br>parses the examples and checks what they call, without running them |
| [77](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-77) | [whether package can be installed](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5961) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷⭐ | ⭐ also compiled code never loaded for lack of useDynLib<br>useDynLib and src/ in agreement, headers from LinkingTo, undefined exports |
| [83](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-83) | [tests](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4797) ([book](https://r-pkgs.org/R-CMD-check.html#tests)) | 🔷⭐ | ⭐ also testthat tests without a runner, runners testing another package<br>tests are not run, only checked for runners and syntax |
| [85](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-85) | [running R code from vignettes](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L5255) ([book](https://r-pkgs.org/R-CMD-check.html#vignettes)) | 🔷 | vignette code that does not parse |
| [88](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-88) | [examples with --run-donttest](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4738) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🔷⭐ | ⭐ also T and F in the examples<br>the \donttest code is checked like all examples |

This rule is a `best-effort` rule.
 
Finds packages the code, tests, examples, or vignettes use without the DESCRIPTION declaring them, Imports nothing imports from, `library()` calls in package code, own `:::` calls, and undeclared VignetteBuilder or RdMacros packages. Package names are resolved through variables.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L178">src/linter/rules/cmd-check/dependency-declaration.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `dependency-declaration` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L80"><code><span title="report declared packages the signature database does not know or cannot satisfy, which R CMD check asks the repositories about (default true)">checkAvailability</span></code></a>\
report declared packages the signature database does not know or cannot satisfy, which `R CMD check` asks the repositories about (default `true`)\
_R CMD check [#27](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-27 "checking package dependencies")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L78"><code><span title="check the packages the tests, vignettes, and examples use (default true)">checkOtherCode</span></code></a>\
check the packages the tests, vignettes, and examples use (default `true`)\
_R CMD check [#29](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-29 "checking for unstated dependencies in tests"), [#30](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-30 "checking for unstated dependencies in examples"), [#31](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-31 "checking for unstated dependencies in vignettes")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L82"><code><span title="packages that only provide C/C++ headers and hence belong into LinkingTo, a note R CMD check gives for CRAN submissions (default BH, RcppArmadillo, RcppEigen)">headerOnlyPackages</span></code></a>\
packages that only provide C/C++ headers and hence belong into LinkingTo, a note `R CMD check` gives for CRAN submissions (default `BH`, `RcppArmadillo`, `RcppEigen`)\
_R CMD check [#27](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-27 "checking package dependencies")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L76"><code><span title="functions whose arguments run elsewhere, so the packages loaded there are no dependency of the package (default clusterEvalQ)">ignoreWithin</span></code></a>\
functions whose arguments run elsewhere, so the packages loaded there are no dependency of the package (default `clusterEvalQ`)\
_R CMD check [#28](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-28 "checking dependencies in R code")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L74"><code><span title="report packages in Depends the NAMESPACE imports nothing from, a note R CMD check only gives for CRAN submissions (default false)">reportDependsNotImported</span></code></a>\
report packages in Depends the NAMESPACE imports nothing from, a note `R CMD check` only gives for CRAN submissions (default `false`)\
_R CMD check [#28](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-28 "checking dependencies in R code")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L72"><code><span title="report every library/require call in package code, even for declared packages (default true, as R CMD check)">reportLibraryCalls</span></code></a>\
report every `library`/`require` call in package code, even for declared packages (default `true`, as `R CMD check`)\
_R CMD check [#28](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-28 "checking dependencies in R code")_

### Examples

A project with the code `R/code.R`:

```r
f <- function(df) {
	library(dplyr)
	tidyr::drop_na(df)
}
```

and the files

`DESCRIPTION`:

```text
Package: pkg
Version: 1.0
Title: A Package
License: MIT
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "dependency-declaration",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (10 ms)\
&nbsp;&nbsp;&nbsp;╰ **Dependency Declaration** (dependency-declaration):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ undeclared-attach of dplyr at [/pkg/R/code.R:2.2-15](file:///pkg/R/code.R:2:2)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ library-in-package of dplyr at [/pkg/R/code.R:2.2-15](file:///pkg/R/code.R:2:2)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ undeclared-namespace of tidyr at [/pkg/R/code.R:3.2-19](file:///pkg/R/code.R:3:2)

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "dependency-declaration": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 8,
            "loc": [2,2,2,15,"/pkg/R/code.R"],
            "kind": "undeclared-attach",
            "package": "dplyr",
            "message": "'library' call not declared from: 'dplyr'"
          },
          {
            "certainty": "certain",
            "involvedId": 8,
            "loc": [2,2,2,15,"/pkg/R/code.R"],
            "kind": "library-in-package",
            "package": "dplyr",
            "message": "'library' call to 'dplyr' in package code, please use :: or requireNamespace() instead"
          },
          {
            "certainty": "certain",
            "involvedId": 9,
            "loc": [3,2,3,19,"/pkg/R/code.R"],
            "kind": "undeclared-namespace",
            "package": "tidyr",
            "message": "'::' import not declared from: 'tidyr'"
          }
        ],
        ".meta": {"unresolvedLoads":0}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts).