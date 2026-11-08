_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 09:20:49 UTC (v2.17.4), do not edit directly._
<h2 id="Call-Graph Query">Call-Graph Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns the call graph of the given code.\
_This query is requested with the type `call-graph`._

This query calculates and returns the [call graph](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph#perspectives-cg) of the given code.

Using the example code `x + 1`, the following query returns the dataflow graph of the code:

```json
[ { "type": "call-graph" } ]
```

(This can be shortened to `@call-graph` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **call-graph** (17 ms)\
&nbsp;&nbsp;&nbsp;╰ [Call Graph](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMltbXCJgKiM5MTtSQmluYXJ5T3AjOTM7KiBiYXNlIzU4OyM1ODsqKiM0MzsqKlxuICAgICAgKjEuMS01KiAoKippZDogMioqKVxuICAgIGFyZzogKDAsIDEpYFwiXV1cbiAgICBidWlsdC1pbjpkW1wiYEJ1aWx0LUluOlxuZGBcIl1cbiAgICBzdHlsZSBidWlsdC1pbjpkIHN0cm9rZTpncmF5LGZpbGw6Z3JheSxzdHJva2Utd2lkdGg6MnB4LG9wYWNpdHk6Ljg7XG4gICAgMiAtLi0+fFwiY2FsbHNcInwgYnVpbHQtaW46ZFxuICAgIGxpbmtTdHlsZSAwIHN0cm9rZTpncmF5OyIsIm1lcm1haWQiOnsiYXV0b1N5bmMiOnRydWV9fQ==)

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"call-graph":{".meta":{},"graph":{"rootVertices":[2],"vertexInformation":[[2,{"tag":"fcall","id":2,"name":"+","onlyBuiltin":true,"args":[{"nodeId":0,"type":32},{"nodeId":1,"type":32}],"origin":["builtin:d"]}]],"edgeInformation":[[2,[["built-in:d",{"types":4}]]]],"_unknownSideEffects":[]}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
x + 1
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Call-Graph Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/call-graph-query/call-graph-query-executor.ts#L11"><code><span title="Executes the given call graph queries.">executeCallGraphQuery</span></code></a>.

</details>