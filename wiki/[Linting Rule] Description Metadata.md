_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="description-metadata">Description Metadata&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

This rule is a `best-effort` rule.
 
Port of the DESCRIPTION checks of `R CMD check`: `checking DESCRIPTION meta-information` (required fields, package name, version, maintainer, dependency fields, `VignetteBuilder`, Title and Description endings, non-ASCII fields, encoding), the duplicate dependency and unused `LinkingTo` notes, the license check, the `Authors@R` checks, the excessive `Depends` check, and the DESCRIPTION style checks of `--as-cran` (title case, Title and Description starts). Every finding names its sub-check in `kind` and points to the lines of the field in the DESCRIPTION file; without a DESCRIPTION there are no findings.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L206">src/linter/rules/cmd-check/description-metadata.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `description-metadata` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L33"><code><span title="also run the style checks R CMD check --as-cran adds for the Title, Description, and Authors\\@R fields (default true)">cranIncoming</span></code></a>\
also run the style checks `R CMD check --as-cran` adds for the Title, Description, and Authors\@R fields (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L35"><code><span title="how many non-default packages Depends may list before it is reported, as R CMD check does after five (default 5)">maxDepends</span></code></a>\
how many non-default packages `Depends` may list before it is reported, as `R CMD check` does after five (default `5`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L37"><code><span title="how many non-base packages Imports may list before it is reported, 0 for no limit as R CMD check does by default (default 0)">maxImports</span></code></a>\
how many non-base packages `Imports` may list before it is reported, `0` for no limit as `R CMD check` does by default (default `0`)

### Examples

```r
cat("a package with a malformed DESCRIPTION")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "description-metadata",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Description Metadata** (description-metadata): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"description-metadata":{"results":[],".meta":{"hasDescription":false}}},".meta":{}},".meta":{}}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-description-metadata.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-description-metadata.test.ts)

<h4 id="Test_32_Case:_32_name">Test Case: name</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

```ts
expected
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-description-metadata.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_DESCRIPTION_44__32_no_32_results">Test Case: no DESCRIPTION, no results</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-description-metadata.test.ts#L31) for the test-case implementation.