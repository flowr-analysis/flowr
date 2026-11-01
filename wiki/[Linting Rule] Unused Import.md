_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="unused-import">Unused Import&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds packages that are attached but never used, so the code runs just the same without them. Requires a signature database, and packages that only do their work on load should be whitelisted in the configuration.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-import.ts#L124">src/linter/rules/unused-import.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unused-import` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-import.ts#L34"><code><span title="packages that do their work on load and hence should never be reported, however unused they look">whitelist</span></code></a>\
packages that do their work on load and hence should never be reported, however unused they look

### Examples

```r
library(stats)
print("no stats function is used")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "unused-import",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1300 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unused Import** (unused-import):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Import of stats at 1.1-14 (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-unused-import.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts).