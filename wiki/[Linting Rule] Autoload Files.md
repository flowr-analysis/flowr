_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-11-21, 15:29:25 UTC (v2.17.9), do not edit directly._
<h2 id="autoload-files">Autoload Files&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#security'>![security](https://img.shields.io/badge/security-teal) </a></span>

This rule is a <code>over-approximative</code> rule.
 
Finds code in a project that will be executed automatically through autoload files like .RProfile\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/autoload-files.ts#L18">src/linter/rules/autoload-files.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `autoload-files` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/autoload-files.ts#L13"><code>allowEmptyFiles</code></a>

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/autoload-files.ts#L14"><code>allowInvalidFiles</code></a>

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/autoload-files.ts#L15"><code>allowedFilePatterns</code></a>

### Examples

A project with the code `R/code.R`:

```r
f <- function() 1
```

and the files

`.RProfile`:

```text
system("rm -rf /")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "autoload-files",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (12 ms)\
&nbsp;&nbsp;&nbsp;╰ **Autoload Files** (autoload-files):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ File `/pkg/.RProfile`

More examples are the test cases in [test/functionality/linter/lint-autoload-files.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-autoload-files.test.ts).