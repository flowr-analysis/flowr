_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-24, 20:38:50 UTC (v2.16.6), do not edit directly._
<h2 id="s3-method-consistency">S3 Method Consistency&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 38–39, 41](https://img.shields.io/badge/cmd--check-38%E2%80%9339%2C%2041-blueviolet) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [38](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-38) | [S3 generic/method consistency](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2198) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also apparent and unregistered methods without setting an environment variable |
| [39](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-39) | [replacement functions](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2235) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also apparent replacement methods |
| [41](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-41) | [use of S3 registration](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4333) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷 | overwriting registered methods of standard packages is not checked |

This rule is a <code>best-effort</code> rule.
 
Finds S3 methods whose formals do not match their generic, methods not registered in the NAMESPACE, and replacement functions whose last formal is not `value`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L156">src/linter/rules/cmd-check/s-three-method-consistency.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `s3-method-consistency` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L43"><code><span title="also check functions named like a method but not registered in the NAMESPACE, which R CMD check only does on request (default true)">checkApparentMethods</span></code></a>\
also check functions named like a method but not registered in the `NAMESPACE`, which `R CMD check` only does on request (default `true`)\
_R CMD check [#38](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-38 "checking S3 generic/method consistency")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L41"><code><span title="check that methods take the arguments of their generic (default true)">checkMethods</span></code></a>\
check that methods take the arguments of their generic (default `true`)\
_R CMD check [#38](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-38 "checking S3 generic/method consistency")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L47"><code><span title="check that replacement functions end in value (default true)">checkReplacementValues</span></code></a>\
check that replacement functions end in `value` (default `true`)\
_R CMD check [#39](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-39 "checking replacement functions")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L45"><code><span title="report apparent methods of an exported generic that the NAMESPACE does not register (default true)">checkUnregistered</span></code></a>\
report apparent methods of an exported generic that the `NAMESPACE` does not register (default `true`)\
_R CMD check [#41](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-41 "checking use of S3 registration")_

### Examples

```r
print.myclass <- function(obj) cat("myclass")
`size<-` <- function(x, v) { attr(x, "size") <- v; x }
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "s3-method-consistency",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (109 ms)\
&nbsp;&nbsp;&nbsp;╰ **S3 Method Consistency** (s3-method-consistency):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ size<-: replacement-value at 2.1-8

More examples are the test cases in [test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts).