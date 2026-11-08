_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 09:20:49 UTC (v2.17.4), do not edit directly._
<h2 id="Search Query">Search Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Provides access to flowR's search API\
_This query is requested with the type `search`._

With this query you can use the [Search API](https://github.com/flowr-analysis/flowr/wiki/Search-API) to conduct searches on the flowR analysis result.

Using the example code `x + 1`, the following query returns all uses of 'x' in the code:

```json
[ { "type": "search",   "search": { "generator": { "type": "generator",     "name": "get",     "args": { "filter": { "name": "x" } } },    "search": [ { "type": "transformer",      "name": "filter",      "args": { "filter": "use" } } ] } } ]
```

_Results (prettified and summarized):_

Query: **search** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ [query](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IExSXG4wKFwiPGI+Z2V0PC9iPihmaWx0ZXI6ICMxMjM7IzM0O25hbWUjMzQ7IzU4OyMzNDt4IzM0OyMxMjU7KTxici8+X2dlbmVyYXRvcl9cIikgLS0+IDFbXCI8Yj5maWx0ZXI8L2I+KGZpbHRlcjogIzM0O3VzZSMzNDspPGJyLz5fdHJhbnNmb3JtZXJfXCJdIiwibWVybWFpZCI6eyJhdXRvU3luYyI6dHJ1ZX19): {0}

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"search":{".meta":{},"results":[{"ids":[0],"search":{"generator":{"type":"generator","name":"get","args":{"filter":{"name":"x"}}},"search":[{"type":"transformer","name":"filter","args":{"filter":"use"}}]}}]},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
x + 1
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Search Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/search-query/search-query-executor.ts#L11"><code><span title="Executes the given search queries using the provided analyzer.">executeSearch</span></code></a>.

</details>