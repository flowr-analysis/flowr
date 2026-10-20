_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 06:47:02 UTC (v2.16.2), do not edit directly._
<h2 id="call-arguments">Call Arguments&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 37](https://img.shields.io/badge/cmd--check-37-blueviolet) </a> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37) | [R code for possible problems](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2302) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes, deprecated arguments, environments resolved through variables, hooks followed into callees |

This rule is a `best-effort` rule.
 
Finds calls with arguments the called function does not take, names that match a formal only partially or match several formals, `...` used in a function without `...`, and local functions defined twice with different formals. Calls are resolved through the dataflow graph.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/call-arguments.ts#L170">src/linter/rules/cmd-check/call-arguments.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `call-arguments` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/call-arguments.ts#L49"><code><span title="also check calls of functions from other packages, whose formals the signature database states (default true)">checkPackageFunctions</span></code></a>\
also check calls of functions from other packages, whose formals the signature database states (default `true`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/call-arguments.ts#L47"><code><span title="report arguments that only match a formal by a prefix of its name (default true, as R CMD check does)">reportPartialMatches</span></code></a>\
report arguments that only match a formal by a prefix of its name (default `true`, as `R CMD check` does)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_

### Examples

```r
scale_by <- function(x, factor) x * factor
f <- function(x) scale_by(x, fact = 2, center = TRUE)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "call-arguments",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Call Arguments** (call-arguments):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ partial-match in scale_by (fact) at 2.18-53 (1 quick fix(es) available)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ unused-named in scale_by (center) at 2.18-53

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "call-arguments": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 23,
            "loc": [2,18,2,53],
            "kind": "partial-match",
            "function": "scale_by",
            "argument": "fact",
            "message": "possible error in scale_by(): partial argument match of 'fact' to 'factor'",
            "quickFix": [{"type":"replace","loc":[2,30,2,33],"description":"Spell out `factor`","replacement":"factor"}]
          },
          {
            "certainty": "certain",
            "involvedId": 23,
            "loc": [2,18,2,53],
            "kind": "unused-named",
            "function": "scale_by",
            "argument": "center",
            "message": "possible error in scale_by(): unused argument (center = ...)"
          }
        ],
        ".meta": {"checkedCalls":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-call-arguments.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts).