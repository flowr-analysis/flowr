_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="absolute-file-paths">Absolute Paths&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds absolute file paths.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/absolute-path.ts#L128">src/linter/rules/absolute-path.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `absolute-file-paths` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/absolute-path.ts#L42"><code><span title="Extend the built-in absolute path recognition with additional regexes">absolutePathRegex</span></code></a>\
Extend the built-in absolute path recognition with additional regexes
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/absolute-path.ts#L47"><code><span title="The set of functions that should additionally be considered as using a file path. Entries in this array use the FunctionInfo format from the dependencies query.">additionalPathFunctions</span></code></a>\
The set of functions that should additionally be considered as using a file path.
Entries in this array use the
<code>FunctionInfo</code>
format from the dependencies query.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/absolute-path.ts#L54"><code><span title="Automatically ignore URLs (http/https/ftp) so they are not reported as absolute paths.">ignoreUrls</span></code></a>\
Automatically ignore URLs (http/https/ftp) so they are not reported as absolute paths.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/absolute-path.ts#L35"><code><span title="Include paths that are built by functions, e.g., file.path()">include</span></code></a>\
Include paths that are built by functions, e.g., `file.path()`
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/absolute-path.ts#L52"><code><span title="Which path the relative-path quick fix is built against: @project (project root, falling back to the script when there is no root), @script, @home, or a literal directory.">useAsWd</span></code></a>\
Which path the relative-path quick fix is built against: `@project` (project root, falling back to the
script when there is no root), `@script`, `@home`, or a literal directory.

### Examples

```r
read.csv("/home/me/project/data/survey.csv")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "absolute-file-paths",     "config": { "useAsWd": "/home/me/project" } } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Absolute Paths** (absolute-file-paths):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `/home/me/project/data/survey.csv` at 1.1-44 (1 quick fix(es) available)

More examples are the test cases in [test/functionality/linter/lint-absolute-path.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-absolute-path.test.ts).