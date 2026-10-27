_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="roxygen-arguments">Roxygen Arguments&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds function parameters the roxygen documentation leaves out, and documented parameters the function does not have.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/roxygen-arguments.ts#L46">src/linter/rules/roxygen-arguments.ts</a>._

### Examples

```r
#' A function with two parameters, but only only one documented
#' @param a A variable
f = function(a, b){return a;}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "roxygen-arguments",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Roxygen Arguments** (roxygen-arguments):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function at 3.5-29 has undocumented argument 'b'

More examples are the test cases in [test/functionality/linter/lint-roxygen-arguments.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts).