_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="rd-files">Rd Files&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#45](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-45) 🟩, [#46](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-46) 🟩, [#47](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-47) 🔷, [#50](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-50) 🟩, [#51](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-51) 🟩, [#52](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-52) 🟩, [#53](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-53) 🔷, [#54](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-54) 🔷, [#55](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-55) 🔷, [#88](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-88) 🔷, [#89](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-89) 🔷, [#90](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-90) 🔶, [#91](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-91) 🔶, [#92](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-92) 🔷

This rule is a `best-effort` rule.
 
Checks the Rd files: syntax, unknown macros, required and duplicated sections, metadata, cross-references, line widths, contents, and the example code.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L645">src/linter/rules/cmd-check/rd-files.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `rd-files` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L44"><code>bibentries</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L39"><code>contents</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L34"><code>crossReferences</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L43"><code>docStyle</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L45"><code>examples</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L38"><code>examplesWidth</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L46"><code>extraMacros</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L42"><code>keywords</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L36"><code>lineWidths</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L33"><code>metadata</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L32"><code>minLevel</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L31"><code>parse</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L40"><code>requireValue</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L41"><code>standardKeywords</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L35"><code>uncertainLinks</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L37"><code>usageWidth</code></a>\

### Examples

```r
f <- function() 1
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "rd-files",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **Rd Files** (rd-files): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"rd-files":{"results":[],".meta":{"checkedFiles":0}}},".meta":{}},".meta":{}}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-rd-files.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts).