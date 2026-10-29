_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="unclosed-connection">Unclosed Connection&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds connections that are opened but not closed on every path opening them.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L199">src/linter/rules/unclosed-connection.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unclosed-connection` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L44"><code><span title="functions closing the connection they are handed, besides the ones flowR states SemanticCallTag.Closes for">closeFns</span></code></a>\
functions closing the connection they are handed, besides the ones flowR states
<code>SemanticCallTag.Closes</code>
for
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L42"><code><span title="functions opening a connection, besides the ones flowR states SemanticCallTag.Opens for">openFns</span></code></a>\
functions opening a connection, besides the ones flowR states
<code>SemanticCallTag.Opens</code>
for

### Examples

```r
con <- file("data.csv")
readLines(con)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "unclosed-connection",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unclosed Connection** (unclosed-connection):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Unclosed connection at 1.8-23 (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-unclosed-connection.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts).