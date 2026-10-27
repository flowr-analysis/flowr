_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="naming-convention">Naming Convention&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that are related to the style of the code. For example, inconsistent naming conventions, or missing or incorrect formatting."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#style'>![style](https://img.shields.io/badge/style-blue) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span>

This rule is a <code>over-approximative</code> rule.
 
Finds symbols that do not follow the naming convention of the code.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/naming-convention.ts#L199">src/linter/rules/naming-convention.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `naming-convention` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/naming-convention.ts#L34"><code><span title="which casing convention to enforce">caseing</span></code></a>\
which casing convention to enforce
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/naming-convention.ts#L37"><code><span title="if true non alphabetic characters are ignored">ignoreNonAlpha</span></code></a>\
if true non alphabetic characters are ignored

### Examples

```r

testVar <- 5
testVarTwo <- 5
other_var <- 5
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "naming-convention",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Naming Convention** (naming-convention):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Identifier 'other_var' at 4.1-9 (snake_case) (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-naming-convention.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts).