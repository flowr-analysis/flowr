_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="software-has-license">Software Has License&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [25](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-25) | [DESCRIPTION meta-information](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L1008) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🟩 |  |

This rule is a <code>best-effort</code> rule.
 
Finds software projects without a license (a LICENSE file or the License field of the DESCRIPTION).\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/software-has-license.ts#L20">src/linter/rules/software-has-license.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `software-has-license` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/software-has-license.ts#L15"><code><span title="Whether to also inspect the DESCRIPTION file for a License field">checkDescriptionFile</span></code></a>\
Whether to also inspect the DESCRIPTION file for a License field\
_R CMD check [#25](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-25 "checking DESCRIPTION meta-information")_

### Examples

```r
cat("a project without a license")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "software-has-license",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **Software Has License** (software-has-license):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ No license found in the project

More examples are the test cases in [test/functionality/linter/lint-software-has-license.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-license.test.ts).