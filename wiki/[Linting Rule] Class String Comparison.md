_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 06:47:02 UTC (v2.16.2), do not edit directly._
<h2 id="class-string-comparison">Class String Comparison&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 37](https://img.shields.io/badge/cmd--check-37-blueviolet) </a> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37) | [R code for possible problems](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2302) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes, deprecated arguments, environments resolved through variables, hooks followed into callees |

This rule is a `best-effort` rule.
 
Finds `if`/`while` conditions comparing `class(x)` with a string, which fail for objects with several classes. Offers `inherits(x, ...)` as a quick fix.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/class-string-comparison.ts#L125">src/linter/rules/cmd-check/class-string-comparison.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `class-string-comparison` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/class-string-comparison.ts#L30"><code><span title="also check the conditions of while loops, which R CMD check does not (default true)">checkWhile</span></code></a>\
also check the conditions of `while` loops, which `R CMD check` does not (default `true`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/class-string-comparison.ts#L32"><code><span title="also flag a comparison with a variable flowR resolves to a string, which R CMD check cannot see (default true)">resolveStrings</span></code></a>\
also flag a comparison with a variable flowR resolves to a string, which `R CMD check` cannot see (default `true`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_

### Examples

```r
f <- function(x) if(class(x) == "data.frame") nrow(x) else length(x)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "class-string-comparison",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Class String Comparison** (class-string-comparison):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ class() compared to "data.frame" at 1.21-44 (1 quick fix(es) available)

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "class-string-comparison": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 8,
            "loc": [1,21,1,44],
            "classes": ["data.frame"],
            "message": "if() condition compares class() to a string, use inherits() instead",
            "quickFix": [{"type":"replace","description":"Replace with `inherits(x, \"data.frame\")`","replacement":"inherits(x, \"data.frame\")","loc":[1,21,1,44]}]
          }
        ],
        ".meta": {"consideredConditions":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts).