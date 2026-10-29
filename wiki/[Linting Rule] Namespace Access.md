_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="namespace-access">Namespace Access Validity&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [28](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-28) | [dependencies in R code](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2169) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🟩⭐ | ⭐ also resolves package names through variables and knows the loaders of other packages |

This rule is a <code>best-effort</code> rule.
 
Finds `pkg:::name` where `name` is actually exported by `pkg` (so `::` would do), and `pkg::name` where the signature database knows `name` is not exported (which fails at runtime in R). Stays silent whenever the database has no definite answer for the name.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/namespace-access.ts#L38">src/linter/rules/namespace-access.ts</a>._

### Examples

```r
dplyr:::filter(df, x > 1)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "namespace-access",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Namespace Access Validity** (namespace-access):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ `dplyr:::filter` at 1.1-25 (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-namespace-access.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts).