_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="dataframe-access-validation">Dataframe Access Validation&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds accesses to columns and rows a data frame does not have.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/dataframe-access-validation.ts#L61">src/linter/rules/dataframe-access-validation.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `dataframe-access-validation` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/dataframe-access-validation.ts#L49"><code><span title="Whether data frame shapes should be extracted from loaded external data files, such as CSV files (defaults to the option in the flowR config if undefined)">readLoadedData</span></code></a>\
Whether data frame shapes should be extracted from loaded external data files, such as CSV files (defaults to the option in the flowR config if `undefined`)

### Examples

```r

df <- data.frame(id = 1:5, name = 6:10)
df[6, "value"]
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "dataframe-access-validation",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Dataframe Access Validation** (dataframe-access-validation):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Access of row 6 of `df` at 3.1-14\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Access of column "value" of `df` at 3.1-14

More examples are the test cases in [test/functionality/linter/lint-dataframe-access-validation.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dataframe-access-validation.test.ts).