_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="global-environment-modification">Global Environment Modification&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 37](https://img.shields.io/badge/cmd--check-37-blueviolet) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37) | [R code for possible problems](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2302) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes, deprecated arguments, environments resolved through variables, hooks followed into callees |

This rule is a <code>best-effort</code> rule.
 
Finds code that changes the global environment: `assign()` or `data()` into it, `attach()`, `<<-` without a binding in an enclosing function, and `<<-` to a package variable, whose binding is locked at run time.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/global-environment-modification.ts#L204">src/linter/rules/cmd-check/global-environment-modification.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `global-environment-modification` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/global-environment-modification.ts#L52"><code><span title="variables that may be assigned in the global environment (default .Random.seed, as R CMD check allows)">allowedGlobals</span></code></a>\
variables that may be assigned in the global environment (default `.Random.seed`, as `R CMD check` allows)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/global-environment-modification.ts#L50"><code><span title="report <<- assignments that reach the global environment or a locked namespace binding (default true)">checkSuperAssignments</span></code></a>\
report `<<-` assignments that reach the global environment or a locked namespace binding (default `true`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_

### Examples

```r
cache <- function(v) assign("cached", v, envir = globalenv())
count <- function() counter <<- counter + 1
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "global-environment-modification",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Global Environment Modification** (global-environment-modification):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ assign of cached at 1.22-61\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ global-superassignment of counter at 2.21-43

More examples are the test cases in [test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts).