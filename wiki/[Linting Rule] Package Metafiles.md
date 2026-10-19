_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="package-metafiles">Package Metafiles&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#56](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-56) 🟩, [#57](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-57) 🔷, [#58](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-58) 🟩, [#59](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-59) 🔷

This rule is a `best-effort` rule.
 
Checks the demo index, `INDEX`, `inst/CITATION`, and relative links in README, NEWS, and vignettes.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L299">src/linter/rules/cmd-check/package-metafiles.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-metafiles` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L39"><code><span title="check inst/CITATION (its syntax, entry types and required fields) and the location of other CITATION files (default true)">citation</span></code></a>\
check `inst/CITATION` (its syntax, entry types and required fields) and the location of other CITATION files (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L37"><code><span title="check the INDEX and the demo/00Index of the package (default true)">index</span></code></a>\
check the `INDEX` and the `demo/00Index` of the package (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L43"><code><span title="check that the relative links of the README, NEWS and vignettes point to files of the package (default true)">relativeLinks</span></code></a>\
check that the relative links of the README, NEWS and vignettes point to files of the package (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L41"><code><span title="report the citation functions superseded by a newer one, which R CMD check accepts (default true)">superseded</span></code></a>\
report the citation functions superseded by a newer one, which `R CMD check` accepts (default `true`)

### Examples

```r
f <- function() 1
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-metafiles",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Metafiles** (package-metafiles): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"package-metafiles":{"results":[],".meta":{"checkedFiles":0}}},".meta":{}},".meta":{}}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-package-metafiles.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts).