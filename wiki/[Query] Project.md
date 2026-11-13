_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-13, 12:11:51 UTC (v2.17.6), do not edit directly._
<h2 id="Project Query">Project Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns information about the analyzed project\
_This query is requested with the type `project`._

This query returns the information about the analyzed project.
If present, it will incorporate plugins to, e.g., extract author and license information from R package DESCRIPTION files.

```json
[ { "type": "project" } ]
```

(This can be shortened to `@project` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **project** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ Kind: unknown\
&nbsp;&nbsp;&nbsp;╰ Dataflow not performed (run `:df#`, then re-run this query, or pass "withDf": true)

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"project":{".meta":{},"files":[],"roleCounts":{"description":0,"namespace":0,"news":0,"vignette":0,"test":0,"install":0,"data":0,"documentation":0,"license":0,"virtual-env":0,"manifest":0,"startup":0,"environment":0,"source":0,"other":0},"kind":"unknown","dfaPerformed":false},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
x + 1
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Project Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/project-query/project-query-format.ts#L67"><code><span title="Executes the given project queries.">executeProjectQuery</span></code></a>.

</details>