_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="syntactically-valid">Syntactically Valid&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [35](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-35) | [R files for syntax errors](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2154) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also quick fixes repairing the syntax error |

This rule is a <code>best-effort</code> rule.
 
Finds syntax errors with the configured (error-tolerant) parser. Offers extensible quick fixes to repair them.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/syntactically-valid.ts#L290">src/linter/rules/syntactically-valid.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `syntactically-valid` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/syntactically-valid.ts#L25"><code><span title="Names of auto-fix patterns to disable (default none).">disabledFixes</span></code></a>\
Names of
<code>auto-fix patterns</code>
to disable (default none).\
_R CMD check [#35](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-35 "checking R files for syntax errors")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/syntactically-valid.ts#L27"><code><span title="Preferred FixDirection ; each error gets a single fix, favouring a candidate of this direction.">preferFix</span></code></a>\
Preferred
<code>FixDirection</code>
; each error gets a single fix, favouring a candidate of this direction.\
_R CMD check [#35](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-35 "checking R files for syntax errors")_

### Examples

```r
x <- c(1, 2
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "syntactically-valid",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Syntactically Valid** (syntactically-valid):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Missing `)` at 1.12-11 (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-syntactically-valid.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts).