_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-13, 12:11:51 UTC (v2.17.6), do not edit directly._
<h2 id="Inspect Exceptions of Functions Query">Inspect Exceptions of Functions Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Determine whether functions throw exceptions (known to flowR)\
_This query is requested with the type `inspect-exception`._\
Run in the REPL: `:query @inspect-exception [(<crit>;...)] <code | file://path>`

With this query you can identify which functions in the code throw exceptions (known to flowR).

Using the following example code:

```r
mayFail <- function(x) {
  if(x < 0) stop("Negative value!")
  else sqrt(x)
}
safeFail <- function(x) {
  tryCatch(
    mayFail(x),
    error = function(e) { NA }
  )
}
```

the following query returns the information for all identified function definitions whether they throw exceptions:

```json
[ { "type": "inspect-exception" } ]
```

(This can be shortened to `@inspect-exception` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **inspect-exception**\
&nbsp;&nbsp;- Function **20** (1.12-4.1) throws exceptions:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Exception maybe thrown at id **11** "stop" (2.13-35, cds: true:2.3-3.14)\
&nbsp;&nbsp;- Function **40** (8.13-30) does not throw exceptions.\
&nbsp;&nbsp;- Function **44** (5.13-10.1) does not throw exceptions.

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"inspect-exception":{".meta":{},"exceptions":{"20":[{"id":11,"cds":[{"id":18,"when":true}]}],"40":[],"44":[]}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
mayFail <- function(x) {
  if(x < 0) stop("Negative value!")
  else sqrt(x)
}
safeFail <- function(x) {
  tryCatch(
    mayFail(x),
    error = function(e) { NA }
  )
}
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Inspect Exceptions of Functions Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/inspect-exceptions-query/inspect-exception-query-format.ts#L19"><code><span title="Execute exception function inspection queries on the given analyzer.">executeExceptionQuery</span></code></a>.

</details>