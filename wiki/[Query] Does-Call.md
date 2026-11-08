_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 09:20:49 UTC (v2.17.4), do not edit directly._
<h2 id="Does-Call Query">Does-Call Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Checks whether a function calls another function matching given constraints.\
_This query is requested with the type `does-call`._\
Run in the REPL: `:query @does-call (<criterion>:$<id>|"<name>") <code | file://path>`

This query checks whether a function calls another function matching given constraints.

Using the example code:

```r
f <- function(x) { eval(x) };
f("1 + 1")
```

the following query checks whether the call to `f` calls `eval`:

```json
[ { "type": "does-call",   "queryId": "calls-eval",   "call": "2@f",   "calls": { "type": "name",    "name": "eval",    "nameExact": true } } ]
```

(This can be shortened to `@does-call (2@f:"eval")` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **does-call**\
&nbsp;&nbsp;- **calls-eval** found:\
&nbsp;&nbsp;&nbsp;&nbsp;- Call with id **15** (2.1)

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"does-call":{".meta":{},"results":{"calls-eval":{"call":15}}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
f <- function(x) { eval(x) };
f("1 + 1")
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Does-Call Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/does-call-query/does-call-query-executor.ts#L15"><code><span title="Execute does call queries on the given analyzer.">executeDoesCallQuery</span></code></a>.

</details>