_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-24, 20:38:50 UTC (v2.16.6), do not edit directly._
<h2 id="namespace-tampering">Namespace Tampering&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 37](https://img.shields.io/badge/cmd--check-37-blueviolet) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#security'>![security](https://img.shields.io/badge/security-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37) | [R code for possible problems](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2302) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes, deprecated arguments, environments resolved through variables, hooks followed into callees |

This rule is a <code>best-effort</code> rule.
 
Finds `unlockBinding()` and `assignInNamespace()` on other namespaces, `.Internal()` calls, and `library.dynam()` given a file extension.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/namespace-tampering.ts#L110">src/linter/rules/cmd-check/namespace-tampering.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `namespace-tampering` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/namespace-tampering.ts#L42"><code><span title="report .Internal calls (default true)">checkInternal</span></code></a>\
report `.Internal` calls (default `true`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_

### Examples

```r
patch <- function() assignInNamespace("mean", function(x, ...) 42, "base")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "namespace-tampering",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Namespace Tampering** (namespace-tampering):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ assign-in-namespace of base at 1.21-74

More examples are the test cases in [test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts).