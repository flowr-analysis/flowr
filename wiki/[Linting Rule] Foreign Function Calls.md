_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-23, 16:00:51 UTC (v2.16.6), do not edit directly._
<h2 id="foreign-function-calls">Foreign Function Calls&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 40](https://img.shields.io/badge/cmd--check-40-blueviolet) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [40](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-40) | [foreign function calls](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2262) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷⭐ | ⭐ also resolves PACKAGE arguments through variables<br>routine registration needs the installed package |

This rule is a <code>best-effort</code> rule.
 
Finds problems in `.Call`, `.C`, `.External`, and `.Fortran` calls: a missing or empty `PACKAGE`, calls into base or other packages, and undeclared packages. Routine and package names are resolved through variables.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/foreign-function-calls.ts#L68">src/linter/rules/cmd-check/foreign-function-calls.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `foreign-function-calls` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/foreign-function-calls.ts#L42"><code><span title="also resolve the routine and PACKAGE through variables, which R CMD check cannot see (default true)">resolveValues</span></code></a>\
also resolve the routine and `PACKAGE` through variables, which `R CMD check` cannot see (default `true`)\
_R CMD check [#40](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-40 "checking foreign function calls")_

### Examples

```r
f <- function(x) .Call("C_mean", x)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "foreign-function-calls",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Foreign Function Calls** (foreign-function-calls):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ .Call("C_mean"): missing-package at 1.18-35

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "foreign-function-calls": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 8,
            "loc": [1,18,1,35],
            "issue": "missing-package",
            "call": ".Call",
            "routine": "C_mean",
            "message": "Foreign function call without 'PACKAGE' argument: .Call(\"C_mean\", ...)"
          }
        ],
        ".meta": {"consideredCalls":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts).