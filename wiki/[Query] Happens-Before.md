_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 09:20:49 UTC (v2.17.4), do not edit directly._
<h2 id="Happens-Before Query">Happens-Before Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Check whether one normalized AST node happens before another in the CFG.\
_This query is requested with the type `happens-before`._

With this query you can analyze the control flow graph:

Using the example code:

```r
x <- 1
y <- 2
```

the following query returns that the first assignment happens always before the other:

```json
[ { "type": "happens-before",   "a": "1@x",   "b": "2@y" } ]
```

_Results (prettified and summarized):_

Query: **happens-before** (5 ms)\
&nbsp;&nbsp;&nbsp;╰ **1@x** happens before **2@y**: always

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"happens-before":{".meta":{},"results":{"1@x<2@y":"always"}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
x <- 1
y <- 2
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Happens-Before Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/happens-before-query/happens-before-query-executor.ts#L14"><code><span title="Execute happens-before queries on the given analyzer. This checks, whether for two given slicing criteria a and b, a happens before b in the control flow graph.">executeHappensBefore</span></code></a>.

</details>