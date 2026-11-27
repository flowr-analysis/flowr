_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-27, 07:23:13 UTC (v2.17.13), do not edit directly._
<h2 id="Aliases Query">Aliases Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns all aliases of a given identifier.\
_This query is requested with the type `aliases`._

If the identifier is given as a NodeId the aliases will be returned as NodeId as well. If the identifier uses a slicing criterion the location of the corresponding aliases will be returned.
The following example uses both functionalities:
Given the code 
```r
x <- 1
g <- x
h <- g
```
. Here '2@g' resolves to NodeId 3.
Then the following query will return the location of the aliases of x and the NodeIds of the aliases of g.

```json
[ { "type": "aliases",   "criteria": [ "1@x" ],   "id": [ 3 ] } ]
```

_Results (prettified and summarized):_

Query: **aliases**\
1@x\
&nbsp;&nbsp;&nbsp;╰ has aliases [2,1,2,1], [3,6,3,6], [3,1,3,1]\
3\
&nbsp;&nbsp;&nbsp;╰ has aliases [6]

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"aliases":{".meta":{},"result":[["1@x",[[2,1,2,1],[3,6,3,6],[3,1,3,1]]],[3,[6]]]},".meta":{}}
```

</details>

<details>

<summary style="color:gray">Implementation Details</summary>

The Aliases Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/aliases-query/aliases-query-executor.ts#L80"><code><span title="Executes the given alias queries using the provided analyzer.">executeAliasesQuery</span></code></a>.

</details>