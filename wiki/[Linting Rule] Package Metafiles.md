_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="package-metafiles">Package Metafiles&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 56–59](https://img.shields.io/badge/cmd--check-56%E2%80%9359-blueviolet) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [56](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-56) | [index information](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L1752) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩 | the vignette index of inst/doc is not checked |
| [57](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-57) | [demos](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4793) ([book](https://r-pkgs.org/R-CMD-check.html#demos)) | 🔷 | the demo index and file names, the demos are not run |
| [58](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-58) | [package subdirectories (CITATION)](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L1796) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🟩⭐ | ⭐ also the superseded citEntry and personList<br>the CITATION file is parsed, not evaluated |
| [59](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-59) | [relative paths in package URLs](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4402) ([book](https://r-pkgs.org/R-CMD-check.html#documentation)) | 🔷⭐ | ⭐ also links in README and NEWS<br>relative URLs in Rd files are not checked |

This rule is a <code>best-effort</code> rule.
 
Finds problems in the demo index, `INDEX`, `inst/CITATION`, and relative links in README, NEWS, and vignettes.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L299">src/linter/rules/cmd-check/package-metafiles.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-metafiles` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L39"><code><span title="check inst/CITATION (its syntax, entry types and required fields) and the location of other CITATION files (default true)">citation</span></code></a>\
check `inst/CITATION` (its syntax, entry types and required fields) and the location of other CITATION files (default `true`)\
_R CMD check [#58](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-58 "checking package subdirectories (CITATION)")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L37"><code><span title="check the INDEX and the demo/00Index of the package (default true)">index</span></code></a>\
check the `INDEX` and the `demo/00Index` of the package (default `true`)\
_R CMD check [#56](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-56 "checking index information"), [#57](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-57 "checking demos")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L43"><code><span title="check that the relative links of the README, NEWS and vignettes point to files of the package (default true)">relativeLinks</span></code></a>\
check that the relative links of the README, NEWS and vignettes point to files of the package (default `true`)\
_R CMD check [#59](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-59 "checking relative paths in package URLs")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L41"><code><span title="report the citation functions superseded by a newer one, which R CMD check accepts (default true)">superseded</span></code></a>\
report the citation functions superseded by a newer one, which `R CMD check` accepts (default `true`)\
_R CMD check [#58](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-58 "checking package subdirectories (CITATION)")_

### Examples

A project with the code `R/code.R`:

```r
f <- function() 1
```

and the files

`DESCRIPTION`:

```text
Package: pkg
Version: 1.0
Title: A Package
License: MIT
```

`demo/a.R`:

```r
f()
```

`demo/b.R`:

```r
f() + 1
```

`demo/00Index`:

```text
a    A first demo
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-metafiles",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Metafiles** (package-metafiles):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ undocumented-demo in demo/b.R at [/pkg/demo/b.R:1.1](file:///pkg/demo/b.R:1:1)

More examples are the test cases in [test/functionality/linter/cmd-check/lint-package-metafiles.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts).