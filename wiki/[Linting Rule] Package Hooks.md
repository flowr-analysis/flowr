_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="package-hooks">Package Hooks&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 37, 42–44, 82](https://img.shields.io/badge/cmd--check-37%2C%2042%E2%80%9344%2C%2082-blueviolet) </a> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37) | [R code for possible problems](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2302) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes, deprecated arguments, environments resolved through variables, hooks followed into callees |
| [42](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-42) | [whether startup messages can be suppressed](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4306) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷⭐ | ⭐ also follows the hooks into the package functions they call<br>output in package hooks not sent through packageStartupMessage |
| [43](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-43) | [whether the namespace can be unloaded cleanly](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4258) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷 | only hook arguments and misplaced library.dynam.unload calls |
| [44](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-44) | [package namespace information](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6863) ([book](https://r-pkgs.org/R-CMD-check.html#namespace)) | 🔶 |  |
| [82](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-82) | [whether the package can be unloaded cleanly](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L4189) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🔷 | only hook arguments and misplaced library.dynam.unload calls |

This rule is a <code>best-effort</code> rule.
 
Finds problems in `.onLoad`, `.onAttach`, `.onDetach`, and `.Last.lib`: argument lists, attaching packages, output other than `packageStartupMessage()`, `installed.packages()`, misplaced `library.dynam()` calls, and the obsolete `.First.lib`. Follows calls into the package's own functions.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L150">src/linter/rules/cmd-check/package-hooks.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-hooks` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L48"><code><span title="functions that may emit output in a startup hook nonetheless, as the user can silence them otherwise (default warning)">allowedOutput</span></code></a>\
functions that may emit output in a startup hook nonetheless, as the user can silence them otherwise (default `warning`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems"), [#42](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-42 "checking whether startup messages can be suppressed")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L52"><code><span title="also report what the hook does through functions of the package it calls, which R CMD check does not see (default true)">followCalls</span></code></a>\
also report what the hook does through functions of the package it calls, which `R CMD check` does not see (default `true`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems"), [#42](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-42 "checking whether startup messages can be suppressed")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L46"><code><span title="functions that print startup messages the way R wants them to, which are only allowed in .onAttach">startupMessageFunctions</span></code></a>\
functions that print startup messages the way R wants them to, which are only allowed in `.onAttach`\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems"), [#42](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-42 "checking whether startup messages can be suppressed")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L50"><code><span title="functions too costly or unsafe to call in a startup hook (default installed.packages)">unsafeCalls</span></code></a>\
functions too costly or unsafe to call in a startup hook (default `installed.packages`)\
_R CMD check [#37](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-37 "checking R code for possible problems")_

### Examples

```r
.onLoad <- function(libname, pkgname) {
	library(stats)
	cat("Loading")
}
.onAttach <- function(libname, pkgname) message("Welcome!")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-hooks",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Hooks** (package-hooks):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ .onLoad: search-path (library) at 2.2-15\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ .onLoad: output (cat) at 3.2-15\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ .onAttach: output (message) at 5.41-59 (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/cmd-check/lint-package-hooks.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts).