_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-13, 12:11:51 UTC (v2.17.6), do not edit directly._
<h2 id="Resolve Value Query">Resolve Value Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Provides access to flowR's value tracking (which is configurable)\
_This query is requested with the type `resolve-value`._\
Run in the REPL: `:query @resolve-value (<crit>;...) <code | file://path>`

With this query you can use flowR's value-tracking capabilities to resolve identifiers to all potential values they may have at runtime (if possible).
The extent to which flowR traces values (e.g., built-ins vs. constants) can be configured in flowR's Configuration file (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information).

Using the example code `x <- 1
y <-2
print(x)
print(y)` (with newlines), the following query returns all values of `x` in the code:

```json
[ { "type": "resolve-value",   "criteria": [ "3@x",    "4@y" ] } ]
```

(This can be shortened to `@resolve-value (3@x;4@y) "x <- 1\ny <-2\nprint(x)\nprint(y)"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **resolve-value** (20 ms)\
&nbsp;&nbsp;&nbsp;╰ Values for {3@x, 4@y}\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ [1L, 1L], [2L, 2L]

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"resolve-value":{".meta":{},"results":{"{\"type\":\"resolve-value\",\"criteria\":[\"3@x\",\"4@y\"]}":{"values":[{"type":"set","elements":[{"type":"interval","start":{"type":"number","value":{"markedAsInt":true,"num":1,"complexNumber":false}},"end":{"type":"number","value":{"markedAsInt":true,"num":1,"complexNumber":false}},"startInclusive":true,"endInclusive":true}]},{"type":"set","elements":[{"type":"interval","start":{"type":"number","value":{"markedAsInt":true,"num":2,"complexNumber":false}},"end":{"type":"number","value":{"markedAsInt":true,"num":2,"complexNumber":false}},"startInclusive":true,"endInclusive":true}]}]}}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
x <- 1
y <-2
print(x)
print(y)
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Resolve Value Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/resolve-value-query/resolve-value-query-format.ts#L29"><code><span title="Executes a resolve-value query.">executeResolveValueQuery</span></code></a>.

</details>