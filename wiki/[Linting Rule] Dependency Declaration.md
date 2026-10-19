_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="dependency-declaration">Dependency Declaration&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span>

R CMD check: [#27](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-27) 🔷, [#28](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-28) 🟩, [#29](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-29) 🟩, [#30](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-30) 🟩, [#31](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-31) 🟩, [#32](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-32) 🔷, [#33](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-33) 🔷, [#53](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-53) 🔷, [#77](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-77) 🔷, [#83](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-83) 🔷, [#85](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-85) 🔷, [#88](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-88) 🔷

This rule is a `best-effort` rule.
 
Finds packages the code, tests, examples, or vignettes use without the DESCRIPTION declaring them, Imports nothing imports from, `library()` calls in package code, own `:::` calls, and undeclared VignetteBuilder or RdMacros packages. Package names are resolved through variables.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L178">src/linter/rules/cmd-check/dependency-declaration.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `dependency-declaration` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L80"><code><span title="report declared packages the signature database does not know or cannot satisfy, which R CMD check asks the repositories about (default true)">checkAvailability</span></code></a>\
report declared packages the signature database does not know or cannot satisfy, which `R CMD check` asks the repositories about (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L78"><code><span title="check the packages the tests, vignettes, and examples use (default true)">checkOtherCode</span></code></a>\
check the packages the tests, vignettes, and examples use (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L82"><code><span title="packages that only provide C/C++ headers and hence belong into LinkingTo, a note R CMD check gives for CRAN submissions (default BH, RcppArmadillo, RcppEigen)">headerOnlyPackages</span></code></a>\
packages that only provide C/C++ headers and hence belong into LinkingTo, a note `R CMD check` gives for CRAN submissions (default `BH`, `RcppArmadillo`, `RcppEigen`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L76"><code><span title="functions whose arguments run elsewhere, so the packages loaded there are no dependency of the package (default clusterEvalQ)">ignoreWithin</span></code></a>\
functions whose arguments run elsewhere, so the packages loaded there are no dependency of the package (default `clusterEvalQ`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L74"><code><span title="report packages in Depends the NAMESPACE imports nothing from, a note R CMD check only gives for CRAN submissions (default false)">reportDependsNotImported</span></code></a>\
report packages in Depends the NAMESPACE imports nothing from, a note `R CMD check` only gives for CRAN submissions (default `false`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L72"><code><span title="report every library/require call in package code, even for declared packages (default true, as R CMD check)">reportLibraryCalls</span></code></a>\
report every `library`/`require` call in package code, even for declared packages (default `true`, as `R CMD check`)

### Examples

```r
f <- function(df) {
	library(dplyr)
	tidyr::drop_na(df)
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "dependency-declaration",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Dependency Declaration** (dependency-declaration): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"dependency-declaration":{"results":[],".meta":{"unresolvedLoads":0}}},".meta":{}},".meta":{}}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts).