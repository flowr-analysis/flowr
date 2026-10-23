_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-23, 16:00:51 UTC (v2.16.6), do not edit directly._
<h2 id="true-false-abbreviation">TRUE/FALSE Abbreviation&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 37](https://img.shields.io/badge/cmd--check-37-blueviolet) </a> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37) | [R code for possible problems](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2302) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes, deprecated arguments, environments resolved through variables, hooks followed into callees |

This rule is a <span title="Linting rules that are expected to have both high precision and high recall."><code>exact</code></span> rule.
 
Finds `T` and `F` used for `TRUE` and `FALSE`, and top-level definitions of `T` or `F`. Off by default, as R only checks this for packages without a NAMESPACE.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/true-false-abbreviation.ts#L79">src/linter/rules/cmd-check/true-false-abbreviation.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `true-false-abbreviation` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/true-false-abbreviation.ts#L30"><code><span title="report definitions of T or F, which change what every later abbreviation means (default true)">reportRedefinitions</span></code></a>\
report definitions of `T` or `F`, which change what every later abbreviation means (default `true`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_

### Examples

```r
f <- function(x) mean(x, na.rm = T)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "true-false-abbreviation",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **TRUE/FALSE Abbreviation** (true-false-abbreviation):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Use of `T` at 1.34 (1 quick fix(es) available)

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "true-false-abbreviation": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 7,
            "loc": [1,34,1,34],
            "name": "T",
            "kind": "use",
            "message": "T is used as an abbreviation of TRUE",
            "quickFix": [{"type":"replace","description":"Replace `T` with `TRUE`","replacement":"TRUE","loc":[1,34,1,34]}]
          }
        ],
        ".meta": {"locallyDefined":0}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts).