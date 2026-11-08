_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 09:20:49 UTC (v2.17.4), do not edit directly._
<h2 id="Abstract Interpretation Query">Abstract Interpretation Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns the abstract values inferred for every expression or at specific locations.\
_This query is requested with the type `absint`._\
Run in the REPL: `:query @absint <inference> [(<crit>;...)] <code | file://path>`

This query infers all shapes of dataframes within the code using abstract interpretation. For example, you can use:

```json
[ { "type": "absint",   "inference": "df-shape" } ]
```

_Results (prettified and summarized):_

Query: **absint** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ $7: (colnames: [{"id"}, {}], cols: [1, 1], rows: [3, 3])\
&nbsp;&nbsp;&nbsp;╰ $14: (colnames: [{"id"}, {}], cols: [1, 1], rows: [0, 3])\
&nbsp;&nbsp;&nbsp;╰ $0: (colnames: [{"id"}, {}], cols: [1, 1], rows: [0, 3])

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"absint":{".meta":{},"result":{"domain":{"colnames":{"must":[],"may":"top"},"cols":[0,null],"rows":[0,null]}}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
df <- data.frame(id = 1:3) |>
  filter(df, FALSE)
```

</details>
	
The query optionally also accepts slice criteria to narrow the results to specific nodes. For example:

```json
[ { "type": "absint",   "inference": "df-shape",   "criteria": [ "1@df",    "1@data.frame" ] } ]
```

(This can be shortened to `@absint (1@df;1@data.frame) "df <- data.frame(id = 1:3) |>\n  filter(df, FALSE)"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **absint** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ 1@df: (colnames: [{"id"}, {}], cols: [1, 1], rows: [0, 3])\
&nbsp;&nbsp;&nbsp;╰ 1@data.frame: (colnames: [{"id"}, {}], cols: [1, 1], rows: [3, 3])

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"absint":{".meta":{},"result":[["1@df",{"colnames":{"must":["id"],"may":[]},"cols":[1,1],"rows":[0,3]}],["1@data.frame",{"colnames":{"must":["id"],"may":[]},"cols":[1,1],"rows":[3,3]}]]},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
df <- data.frame(id = 1:3) |>
  filter(df, FALSE)
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Abstract Interpretation Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/absint-query/absint-query-executor.ts#L11"><code><span title="Executes the given abstract interpretation queries using the provided analyzer.">executeAbsintQuery</span></code></a>.

</details>