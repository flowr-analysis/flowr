_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="unescaped-arguments">Unescaped Arguments&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#security'>![security](https://img.shields.io/badge/security-teal) </a></span> <span title="This rule is used to detect issues that are related to the shiny framework."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#shiny'>![shiny](https://img.shields.io/badge/shiny-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds arguments of critical system, evaluation, database, and HTML/JavaScript calls that are not properly escaped.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L427">src/linter/rules/unescaped-arguments.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unescaped-arguments` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L139"><code><span title="The input types that count as already escaped">acceptedInputs</span></code></a>\
The input types that count as already escaped
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L129"><code><span title="The target, critical functions, critical arguments, sanitizers and quick fixes for each category">categories</span></code></a>\
The target, critical functions, critical arguments, sanitizers and quick fixes for each category
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L134"><code><span title="The categories that should be disabled and not checked">disabledCategories</span></code></a>\
The categories that should be disabled and not checked
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L143"><code><span title="The maximum depth to descent to find unescaped parts of an argument">maxDecentDepth</span></code></a>\
The maximum depth to descent to find unescaped parts of an argument

### Examples

```r
function(dir) {
	system(paste0("ls ", dir))
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "unescaped-arguments",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unescaped Arguments** (unescaped-arguments):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Unescaped system argument of `system` at 2.9-26 (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-unescaped-arguments.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts).