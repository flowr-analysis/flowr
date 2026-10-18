_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="documentation-mismatch">Documentation Mismatch&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span>

This rule is a `best-effort` rule.
 
Port of the code/documentation consistency checks of `R CMD check`: `checking for missing documentation entries` (exported objects without an Rd `\alias`), `checking for code/documentation mismatches` (formals of a function versus its Rd `\usage`) and `checking Rd \usage sections` (undocumented `\usage` arguments, documented arguments not in `\usage`). Each sub-check can be switched off, default values are only compared if both sides are literals, and the Rd line of a finding is reported.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L323">src/linter/rules/cmd-check/documentation-mismatch.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `documentation-mismatch` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L53"><code><span title="compare the formals of functions with their \\usage (default true)">checkCodoc</span></code></a>\
compare the formals of functions with their `\usage` (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L55"><code><span title="also compare literal default values, not only argument names and order (default true)">checkDefaults</span></code></a>\
also compare literal default values, not only argument names and order (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L59"><code><span title="also demand documented arguments in \\keyword{internal} pages, which R CMD check does not (default false)">checkInternalUsage</span></code></a>\
also demand documented arguments in `\keyword{internal}` pages, which `R CMD check` does not (default `false`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L51"><code><span title="report exported objects no Rd page documents (default true)">checkUndocumented</span></code></a>\
report exported objects no Rd page documents (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L57"><code><span title="check the \\arguments against the \\usage (default true)">checkUsage</span></code></a>\
check the `\arguments` against the `\usage` (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/documentation-mismatch.ts#L61"><code><span title="report the exported objects of a package that has a NAMESPACE but no Rd page at all as undocumented (default true)">requireDocumentation</span></code></a>\
report the exported objects of a package that has a NAMESPACE but no Rd page at all as undocumented (default `true`)

### Examples

```r
f <- function(x, y) x + y
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "documentation-mismatch",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Documentation Mismatch** (documentation-mismatch): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"documentation-mismatch":{"results":[],".meta":{"consideredObjects":0,"consideredPages":0}}},".meta":{}},".meta":{}}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-documentation-mismatch.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-documentation-mismatch.test.ts)

<h4 id="Test_32_Case:_32_name">Test Case: name</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

```ts
expected
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-documentation-mismatch.test.ts#L13) for the test-case implementation.