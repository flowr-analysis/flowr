_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="package-runtime">Package Runtime&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#4](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-4) 🟩, [#5](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-5) 🟩, [#7](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-7) 🟩, [#33](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-33) 🔷, [#77](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-77) 🔷, [#79](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-79) 🔷, [#80](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-80) 🔷, [#81](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-81) 🔷, [#83](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-83) 🔷, [#84](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-84) 🔷, [#85](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-85) 🔷, [#86](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-86) 🔷, [#87](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-87) 🔷, [#89](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-89) 🔷, [#90](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-90) 🔶, [#91](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-91) 🔶

This rule is a `best-effort` rule.
 
Finds what makes installing, loading, or running the package fail without doing so: undefined exports, S3 methods without a function, bad NAMESPACE imports, a package attaching itself, tests that never run, test or vignette code that does not parse, missing vignette metadata, and files written into the working directory.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-runtime.ts#L283">src/linter/rules/cmd-check/package-runtime.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-runtime` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-runtime.ts#L61"><code><span title="report writes of tests and vignettes into the working directory (default true)">checkWrites</span></code></a>\
report writes of tests and vignettes into the working directory (default `true`)

### Examples

```r
f <- function() library(pkg)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-runtime",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Runtime** (package-runtime): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"package-runtime":{"results":[],".meta":{}}},".meta":{}},".meta":{}}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-package-runtime.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts).