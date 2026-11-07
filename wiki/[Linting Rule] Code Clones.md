_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-11-07, 22:50:29 UTC (v2.17.3), do not edit directly._
<h2 id="code-clones">Code Clones&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This marks rules which are currently considered experimental, _not_ that they detect experimental code."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#experimental'>![experimental](https://img.shields.io/badge/experimental-lightgrey) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds duplicated code (code clones) with a configurable selection of AST, token, fingerprint, and dependence-graph based algorithms.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/code-clones.ts#L43">src/linter/rules/code-clones.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `code-clones` rule accepts the following configuration options:

- 

- 

- 

- 

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/code-clones.ts#L21"><code>perspective</code></a>

- 

- 

- 

### Examples

```r

normalize <- function(v) {
	m <- mean(v)
	(v - m) / sd(v)
}
scale_it <- function(values) {
	mu <- mean(values)
	(values - mu) / sd(values)
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "code-clones",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Code Clones** (code-clones):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Code is a clone of scale_it at <input 0>:6.13-9.1 (gst, similarity 1.00)

More examples are the test cases in [test/functionality/linter/lint-code-clones.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-code-clones.test.ts).