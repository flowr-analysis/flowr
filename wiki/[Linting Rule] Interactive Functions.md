_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-11-11, 08:13:04 UTC (v2.17.5), do not edit directly._
<h2 id="interactive-functions">Interactive Functions&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds calls that only do their job in an interactive session, such as `View`, `edit`, `browser`, or `debug`, left in a script, where `Rscript` skips or stops at them. A call in the branch an `interactive()` check takes is fine, one within a function is uncertain, as the function may only be meant for interactive use.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/interactive-functions.ts#L75">src/linter/rules/interactive-functions.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `interactive-functions` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/interactive-functions.ts#L22"><code><span title="The functions that only do their job in an interactive session, by default every built-in tagged SemanticCallTag.Interactive">fns</span></code></a>\
The functions that only do their job in an interactive session, by default every built-in tagged
<code>SemanticCallTag.Interactive</code>

### Examples

```r

p <- penguins
View(p)
if(interactive()) browser()
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "interactive-functions",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (55 ms)\
&nbsp;&nbsp;&nbsp;╰ **Interactive Functions** (interactive-functions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function `utils::View` at 3.1-7

More examples are the test cases in [test/functionality/linter/lint-interactive-functions.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-interactive-functions.test.ts).