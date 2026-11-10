_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 09:20:49 UTC (v2.17.4), do not edit directly._
<h2 id="Inspect Higher-Order Functions Query">Inspect Higher-Order Functions Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Determine whether functions are higher-order functions\
_This query is requested with the type `inspect-higher-order`._\
Run in the REPL: `:query @inspect-higher-order [(<crit>;...)] <code | file://path>`

With this query you can identify which functions in the code are higher-order functions, i.e., either take a function as an argument or return a function.
A parameter the body itself calls (`function(g) g()`, `function(g) lapply(x, g)`) counts as well, without any call site having to hand a function over.
Please note, that functions that are just identities (e.g., `function(x) x`) are not considered higher-order if they do not take a function as an argument.

Using the example code `f <- function() function(x) x; f()` the following query returns the information for all identified function definitions whether they are higher-order functions:

```json
[ { "type": "inspect-higher-order" } ]
```

(This can be shortened to `@inspect-higher-order` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **inspect-higher-order**\
&nbsp;&nbsp;- Function **5** (1.17-29) is not a higher-order function\
&nbsp;&nbsp;- Function **7** (1.6-29) is a higher-order function

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"inspect-higher-order":{".meta":{},"higherOrder":{"5":false,"7":true}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
f <- function() function(x) x; f()
```

</details>
	
This query also supports a slicing criterion based query mode that only returns information for functions matching the given criteria:

```json
[ { "type": "inspect-higher-order",   "filter": [ "1@function" ] } ]
```

(This can be shortened to `@inspect-higher-order (1@function) "f <- function() function(x) x; f()"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **inspect-higher-order**\
&nbsp;&nbsp;- Function **7** (1.6-29) is a higher-order function

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"inspect-higher-order":{".meta":{},"higherOrder":{"7":true}},".meta":{}}
```

</details>

<details>

<summary style="color:gray">Implementation Details</summary>

The Inspect Higher-Order Functions Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/benchmark/slicer.ts#L129"><code>executor</code></a>.

</details>