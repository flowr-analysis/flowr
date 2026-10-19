_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="package-data">Package Data&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

R CMD check: [#34](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-34) 🟩, [#48](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-48) 🟩, [#60](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-60) 🟩, [#61](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-61) 🟩, [#62](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-62) 🟩, [#63](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-63) 🟩, [#64](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-64) 🔶

This rule is a `best-effort` rule.
 
Checks `data/` and `R/sysdata.rda`: allowed file types, LazyData, compression, the serialization version R needs, and undocumented data sets.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L97">src/linter/rules/cmd-check/package-data.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-data` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L23"><code>checkCompaction</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L24"><code>checkUndocumented</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L22"><code><span title="an uncompressed or ASCII save above this many bytes is flagged">maxUncompressedSize</span></code></a>\
an uncompressed or ASCII save above this many bytes is flagged

### Examples

```r
f <- function() 1
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-data",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Data** (package-data): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"package-data":{"results":[],".meta":{"inspectedDataFiles":0,"onDisk":false}}},".meta":{}},".meta":{}}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-package-data.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts).