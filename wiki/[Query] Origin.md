_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-13, 12:11:51 UTC (v2.17.6), do not edit directly._
<h2 id="Origin Query">Origin Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Retrieve the origin of a variable, function call, ...\
_This query is requested with the type `origin`._\
Run in the REPL: `:query @origin (<criterion>) <code | file://path>`

With this query you can use flowR's origin tracking to find out the read origins of a variable,
the functions called by a call, and more.

Using the example code `x <- 1
print(x)` (with the `print(x)` in the second line), the following query returns the origins of `x` in the code:

```json
[ { "type": "origin",   "criterion": "2@x" } ]
```

(This can be shortened to `@origin (2@x) "x <- 1\nprint(x)"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **origin** (10 ms)\
&nbsp;&nbsp;&nbsp;╰ Origins for {2@x}\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ {"type":0,"id":0}

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"origin":{".meta":{},"results":{"2@x":[{"type":0,"id":0}]}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
x <- 1
print(x)
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Origin Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/origin-query/origin-query-format.ts#L18"><code><span title="Execute origin queries, catching duplicates with the same fingerprint">executeOriginQuery</span></code></a>.

</details>