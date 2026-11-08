_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="undefined-symbol">Undefined Symbol&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This marks rules which are currently considered experimental, _not_ that they detect experimental code."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#experimental'>![experimental](https://img.shields.io/badge/experimental-lightgrey) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37) | [R code for possible problems](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2302) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes, deprecated arguments, environments resolved through variables, hooks followed into callees |

This rule is a <code>over-approximative</code> rule.
 
Finds functions and variables that are neither defined locally, a base R builtin, nor exported by a loaded package.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/undefined-symbol.ts#L155">src/linter/rules/undefined-symbol.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `undefined-symbol` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/undefined-symbol.ts#L41"><code><span title="flag names used in a function-call position that cannot be resolved (default true)">checkFunctions</span></code></a>\
flag names used in a function-call position that cannot be resolved (default `true`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/undefined-symbol.ts#L52"><code><span title="flag unresolved symbols used as [/[[ subscripts (default false). Off by default to mute data.table's DT[i, j, by] column masking, which flowR cannot distinguish from ordinary indexing.">checkSubscripts</span></code></a>\
flag unresolved symbols used as `[`/`[[` subscripts (default `false`). Off by default to mute
`data.table`'s `DT[i, j, by]` column masking, which flowR cannot distinguish from ordinary indexing.\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/undefined-symbol.ts#L47"><code><span title="flag names used as a variable read that cannot be resolved (default true). Formulas and data-masking (dplyr/tidyr/ggplot, subset/with) are recognised via flowR's dataflow, so this is precise; residual false positives are possible in dynamic eval/attach.">checkVariables</span></code></a>\
flag names used as a variable read that cannot be resolved (default `true`). Formulas and data-masking
(dplyr/tidyr/ggplot, `subset`/`with`) are recognised via flowR's dataflow, so this is precise; residual
false positives are possible in dynamic `eval`/`attach`.\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_

### Examples

```r
undefined_helper(42)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "undefined-symbol",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (10 ms)\
&nbsp;&nbsp;&nbsp;╰ **Undefined Symbol** (undefined-symbol):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Undefined function `undefined_helper` at 1.1-20

More examples are the test cases in [test/functionality/linter/lint-undefined-symbol.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts).