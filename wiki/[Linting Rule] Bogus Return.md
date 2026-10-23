_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 06:47:02 UTC (v2.16.2), do not edit directly._
<h2 id="bogus-return">Bogus Return&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 37](https://img.shields.io/badge/cmd--check-37-blueviolet) </a> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37) | [R code for possible problems](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2302) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes, deprecated arguments, environments resolved through variables, hooks followed into callees |

This rule is a `<span title="Linting rules that are expected to have both high precision and high recall.">exact</span>` rule.
 
Finds a bare `return` (without `()`), which evaluates to the function `return` instead of returning. Offers `return()` as a quick fix.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/bogus-return.ts#L27">src/linter/rules/cmd-check/bogus-return.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `bogus-return` rule accepts the following configuration options:

### Examples

```r
f <- function(x) {
	if(is.null(x)) return
	x + 1
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "bogus-return",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Bogus Return** (bogus-return):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Bare `return` at 2.17-22 (1 quick fix(es) available)

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "bogus-return": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 9,
            "loc": [2,17,2,22],
            "function": "f",
            "message": "Possibly missing '()' after 'return' in f, a bare return evaluates to the function itself",
            "quickFix": [{"type":"replace","description":"Call `return()`","replacement":"return()","loc":[2,17,2,22]}]
          }
        ],
        ".meta": {}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-bogus-return.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts).