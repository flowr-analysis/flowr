_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-10-24, 20:38:50 UTC (v2.16.6), do not edit directly._
<h2 id="Files Query">Files Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns the files matching the given criteria.\
_This query is requested with the type `files`._\
Run in the REPL: `:query @files [role:<r1>,<r2>,...] <code | file://path>`

This query returns the files that match the given criteria.

```json
[ { "type": "files" } ]
```

(This can be shortened to `@files` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **files**\
&nbsp;&nbsp;&nbsp;╰ Found 0 files

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"files":{".meta":{},"files":[]},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r

```

<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis ran (parse and normalize with the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) in the generation environment. No [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) is mounted, so `library()` attaches no exports (base-R names are still qualified, e.g., `stats::acf`). 
We encountered no unknown side effects during the analysis.

```mermaid
flowchart LR
```

</details>

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Files Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/files-query/files-query-executor.ts#L12"><code><span title="Executes the given files queries using the provided analyzer.">executeFileQuery</span></code></a>.

</details>