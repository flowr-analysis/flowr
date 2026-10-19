_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="description-metadata">Description Metadata&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

R CMD check: [#1](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-1) 🟩, [#6](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-6) 🔶, [#25](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-25) 🟩, [#26](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-26) 🔶, [#27](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-27) 🔷

This rule is a `best-effort` rule.
 
Checks the DESCRIPTION: required fields, package name, version, maintainer, dependency fields, license, Authors@R, encoding, and the Title and Description style CRAN asks for.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L198">src/linter/rules/cmd-check/description-metadata.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `description-metadata` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L34"><code><span title="also run the style checks R CMD check --as-cran adds for the Title, Description, and Authors\\@R fields (default true)">cranIncoming</span></code></a>\
also run the style checks `R CMD check --as-cran` adds for the Title, Description, and Authors\@R fields (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L36"><code><span title="how many non-default packages Depends may list before it is reported, as R CMD check does after five (default 5)">maxDepends</span></code></a>\
how many non-default packages `Depends` may list before it is reported, as `R CMD check` does after five (default `5`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L38"><code><span title="how many non-base packages Imports may list before it is reported, 0 for no limit as R CMD check does by default (default 0)">maxImports</span></code></a>\
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

More examples are the test cases in [test/functionality/linter/cmd-check/lint-description-metadata.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-description-metadata.test.ts).