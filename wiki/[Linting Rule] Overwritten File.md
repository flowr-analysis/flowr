_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="overwritten-file">Overwritten File&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds files the script writes more than once, so the later write replaces what the earlier one wrote, as two figures saved under the same name.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/overwritten-file.ts#L83">src/linter/rules/overwritten-file.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `overwritten-file` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/overwritten-file.ts#L30"><code><span title="functions that write a file, besides the ones the dependencies query knows">additionalWriteFunctions</span></code></a>\
functions that write a file, besides the ones the dependencies query knows

### Examples

```r
write.csv(cars, "out.csv")
write.csv(iris, "out.csv")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "overwritten-file",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Overwritten File** (overwritten-file):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ `out.csv` is written again, replacing what line 1 wrote to it

More examples are the test cases in [test/functionality/linter/lint-overwritten-file.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts).