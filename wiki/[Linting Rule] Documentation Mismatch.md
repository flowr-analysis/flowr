_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="documentation-mismatch">Documentation Mismatch&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span>

R CMD check: [#44](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-44) 🔶, [#48](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-48) 🟩, [#49](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-49) 🟩, [#50](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-50) 🟩

This rule is a `best-effort` rule.
 
Finds exported objects without documentation, functions whose formals differ from their `\usage`, and arguments missing from or extra in `\arguments`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L293">src/linter/rules/cmd-check/documentation-mismatch.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `documentation-mismatch` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L42"><code>checkCodoc</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L43"><code>checkDefaults</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L45"><code>checkInternalUsage</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L41"><code>checkUndocumented</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L44"><code>checkUsage</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L46"><code>requireDocumentation</code></a>\

### Examples

```r
f <- function(x, y) x + y
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "documentation-mismatch",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Documentation Mismatch** (documentation-mismatch): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"documentation-mismatch":{"results":[],".meta":{"consideredObjects":0,"consideredPages":0}}},".meta":{}},".meta":{}}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-documentation-mismatch.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-documentation-mismatch.test.ts).