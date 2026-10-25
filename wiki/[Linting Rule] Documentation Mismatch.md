_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="documentation-mismatch">Documentation Mismatch&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 44, 48–50](https://img.shields.io/badge/cmd--check-44%2C%2048%E2%80%9350-blueviolet) </a> <span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [44](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-44) | [package namespace information](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6863) ([book](https://r-pkgs.org/R-CMD-check.html#namespace)) | 🔶 |  |
| [48](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-48) | [for missing documentation entries](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2694) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 | S4 classes and methods are not checked |
| [49](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-49) | [for code/documentation mismatches](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2737) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 | data sets and S4 classes are not compared |
| [50](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-50) | [Rd \usage sections](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2788) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 |  |

This rule is a <code>best-effort</code> rule.
 
Finds exported objects without documentation, functions whose formals differ from their `\usage`, and arguments missing from or extra in `\arguments`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L299">src/linter/rules/cmd-check/documentation-mismatch.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `documentation-mismatch` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L44"><code><span title="report functions whose formals differ from their \\usage">checkCodoc</span></code></a>\
report functions whose formals differ from their `\usage`\
_R CMD check [#49](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-49 "checking for code/documentation mismatches")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L46"><code><span title="also report default values that differ between the code and its \\usage">checkDefaults</span></code></a>\
also report default values that differ between the code and its `\usage`\
_R CMD check [#49](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-49 "checking for code/documentation mismatches")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L50"><code><span title="also check the \\usage of pages with the keyword internal">checkInternalUsage</span></code></a>\
also check the `\usage` of pages with the keyword `internal`\
_R CMD check [#50](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-50 "checking Rd \usage sections")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L42"><code><span title="report exported objects no Rd page documents">checkUndocumented</span></code></a>\
report exported objects no Rd page documents\
_R CMD check [#48](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-48 "checking for missing documentation entries")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L48"><code><span title="report arguments of a \\usage that its \\arguments do not document, and documented arguments no \\usage has">checkUsage</span></code></a>\
report arguments of a `\usage` that its `\arguments` do not document, and documented arguments no `\usage` has\
_R CMD check [#50](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-50 "checking Rd \usage sections")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L52"><code><span title="report undocumented objects even when the package has no Rd pages at all">requireDocumentation</span></code></a>\
report undocumented objects even when the package has no Rd pages at all\
_R CMD check [#48](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-48 "checking for missing documentation entries")_

### Examples

A project with the code `R/code.R`:

```r
f <- function(x, y) x + y
```

and the files

`DESCRIPTION`:

```text
Package: pkg
Version: 1.0
Title: A Package
License: MIT
```

`NAMESPACE`:

```text
export(f)
```

`man/f.Rd`:

```text
\name{f}
\alias{f}
\title{Add}
\usage{f(x)}
\arguments{\item{x}{a number}}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "documentation-mismatch",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (5 ms)\
&nbsp;&nbsp;&nbsp;╰ **Documentation Mismatch** (documentation-mismatch):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Codoc mismatches from Rd file 'f.Rd': f(x) in the docs, but f(x, y) in the code at [/pkg/man/f.Rd:4.8](file:///pkg/man/f.Rd:4:8)

More examples are the test cases in [test/functionality/linter/cmd-check/lint-documentation-mismatch.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-documentation-mismatch.test.ts).