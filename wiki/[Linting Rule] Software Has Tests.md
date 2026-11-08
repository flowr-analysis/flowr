_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="software-has-tests">Software Has Tests&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [24](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-24) | [for code which exercises the package](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L8103) ([book](https://r-pkgs.org/R-CMD-check.html#tests)) | 🟩 | only tests count, examples and vignettes do not |

This rule is a <code>best-effort</code> rule.
 
Finds software projects without tests (test files in a test directory or test function calls in R code).\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/software-has-tests.ts#L23">src/linter/rules/software-has-tests.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `software-has-tests` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/software-has-tests.ts#L15"><code><span title="Additional test function patterns beyond the defaults">additionalTestFunctions</span></code></a>\
Additional test function patterns beyond the defaults\
_R CMD check [#24](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-24 "checking for code which exercises the package")_

### Examples

```r
cat("hello")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "software-has-tests",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Software Has Tests** (software-has-tests):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ No tests found in the project

More examples are the test cases in [test/functionality/linter/lint-software-has-tests.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-tests.test.ts).