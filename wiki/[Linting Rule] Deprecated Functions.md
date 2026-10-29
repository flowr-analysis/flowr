_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="deprecated-functions">Deprecated Functions&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This signals the use of deprecated functions or features."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#deprecated'>![deprecated](https://img.shields.io/badge/deprecated-teal) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37) | [R code for possible problems](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2302) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes, deprecated arguments, environments resolved through variables, hooks followed into callees |

This rule is a <code>best-effort</code> rule.
 
Finds deprecated functions and deprecated arguments of still-current functions, offering the replacement as a quick fix where one is known. A call to a bare name whose package the code never attaches is reported as uncertain, as any function of that name would answer to it.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/deprecated-functions.ts#L179">src/linter/rules/deprecated-functions.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `deprecated-functions` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/deprecated-functions.ts#L68"><code><span title="Functions to always mark as deprecated">always</span></code></a>\
Functions to always mark as deprecated\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/deprecated-functions.ts#L74"><code><span title="Functions to mark as deprecated for specific argument, argument value or version. Keyed like DeprecatedFunctionsConfig.always : pkg::fn names the package the versions are checked against and matches only that one, a bare name matches any package.">conditionally</span></code></a>\
Functions to mark as deprecated for specific argument, argument value or version. Keyed like
<code>DeprecatedFunctionsConfig.always</code>
: `pkg::fn` names the package the versions are checked against and
matches only that one, a bare name matches any package.\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_

### Examples

```r

first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)

library(ggplot2)
theme(panel.grid = element_line(size = 1))
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "deprecated-functions",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (830 ms)\
&nbsp;&nbsp;&nbsp;╰ **Deprecated Functions** (deprecated-functions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ function `dplyr::all_equal` at 4.1-31\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Argument `size` of function `ggplot2::element_line` at 7.33-36 (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-deprecated-functions.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts).