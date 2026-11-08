_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="file-path-validity">File Path Validity&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds file paths used in read and write operations that are invalid or do not point to existing files.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L87">src/linter/rules/file-path-validity.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `file-path-validity` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L49"><code><span title="The set of functions that should additionally be considered as reading a file path. Entries in this array use the FunctionInfo format from the dependencies query.">additionalReadFunctions</span></code></a>\
The set of functions that should additionally be considered as reading a file path.
Entries in this array use the
<code>FunctionInfo</code>
format from the dependencies query.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L54"><code><span title="The set of functions that should additionally be considered as writing to a file path. Entries in this array use the FunctionInfo format from the dependencies query.">additionalWriteFunctions</span></code></a>\
The set of functions that should additionally be considered as writing to a file path.
Entries in this array use the
<code>FunctionInfo</code>
format from the dependencies query.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L64"><code><span title="Whether URLs should be validated by checking the endpoint exists. When false (default), URLs are silently ignored. When true, an HTTP HEAD request is made and the URL is reported if unreachable.">checkUrls</span></code></a>\
Whether URLs should be validated by checking the endpoint exists.
When `false` (default), URLs are silently ignored.
When `true`, an HTTP HEAD request is made and the URL is reported if unreachable.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L58"><code><span title="Whether unknown file paths should be included as linting results.">includeUnknown</span></code></a>\
Whether unknown file paths should be included as linting results.

### Examples

A project with the code `R/code.R`:

```r
survey <- read.csv("data/Survey.csv")
```

and the files

`R/survey.csv`:

```text
id,value
1,2
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "file-path-validity",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `data/Survey.csv` at [/pkg/R/code.R:1.11-37](file:///pkg/R/code.R:1:11) (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-file-path-validity.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts).