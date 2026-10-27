_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="unused-definitions">Unused Definitions&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds definitions that are never used.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-definition.ts#L343">src/linter/rules/unused-definition.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unused-definitions` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-definition.ts#L54"><code><span title="Whether to suppress definitions that the analyzed project exports via its NAMESPACE (the package's public API). flowR cannot observe external callers, so exported names would otherwise be reported as (uncertain) false positives.">excludeExportedDefinitions</span></code></a>\
Whether to suppress definitions that the analyzed project exports via its `NAMESPACE` (the package's public API).
flowR cannot observe external callers, so exported names would otherwise be reported as (uncertain) false positives.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-definition.ts#L49"><code><span title="Whether to include (potentially anonymous) function definitions in the search (e.g., should we report uncalled anonymous functions?).">includeFunctionDefinitions</span></code></a>\
Whether to include (potentially anonymous) function definitions in the search (e.g., should we report uncalled anonymous functions?).

### Examples

```r

x <- 42
y <- 3
print(x)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "unused-definitions",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unused Definitions** (unused-definitions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Definition of `y` at 3.1 (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-unused-definition.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-definition.test.ts).