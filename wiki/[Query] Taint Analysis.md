_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-13, 12:11:51 UTC (v2.17.6), do not edit directly._
<h2 id="Taint Analysis Query">Taint Analysis Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns the taint values inferred for every expression.\
_This query is requested with the type `taint`._

This query infers all taints for one or multiple analysis definitions within the code using taint analysis. 
For example, you can use the following query to get the results of the normalization analysis:

```json
[ { "type": "taint",   "defs": [ "normalization-constant" ] } ]
```

_Results (prettified and summarized):_

Query: **taint** (21 ms)\
&nbsp;&nbsp;&nbsp;╰ **normalization-constant**:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ mean calculated on normalized data yields a known result [6.30-36] \
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Known summary statistic calculated on normalized data [6.25] \
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ 12: ⊤\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ 0: ⊤\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ 18: z-Score\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ 14: z-Score\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ 24: ⊥\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ 20: ⊥

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"taint":{"results":[["normalization-constant",{"domains":{"0":"top","12":"top","14":"z-Score","18":"z-Score","20":"bottom","24":"bottom"},"findings":[{"nodeId":24,"loc":[6,30,6,36],"msg":"mean calculated on normalized data yields a known result [6.30-36]"},{"nodeId":20,"loc":[6,25,6,25],"msg":"Known summary statistic calculated on normalized data [6.25]"}]}]],".meta":{}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r

			x <- c(1 , 2 , 3 , 4 , 5)

			y <- scale(x)

			z <- mean(y)
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Taint Analysis Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/taint-query/taint-query-format.ts#L21"><code><span title="Executes the given taint queries using the provided analyzer.">executeTaintQuery</span></code></a>.

</details>