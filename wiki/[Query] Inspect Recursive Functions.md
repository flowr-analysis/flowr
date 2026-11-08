_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 09:20:49 UTC (v2.17.4), do not edit directly._
<h2 id="Inspect Recursive Functions Query">Inspect Recursive Functions Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Determine whether functions are recursive\
_This query is requested with the type `inspect-recursion`._\
Run in the REPL: `:query @inspect-recursion [(<crit>;...)] <code | file://path>`

With this query you can identify which functions in the code are recursive.
Please note, that functions that *may* be recursive due to indirect calls are also considered recursive.

Using the example code `fact <- function(n) { if(n <= 1) 1 else n * fact(n - 1) }` the following query returns the information for all identified function definitions whether they are recursive:

```json
[ { "type": "inspect-recursion" } ]
```

(This can be shortened to `@inspect-recursion` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **inspect-recursion**\
&nbsp;&nbsp;- Function **21** (1.9-57) is recursive

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"inspect-recursion":{".meta":{},"recursive":{"21":true}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
fact <- function(n) { if(n <= 1) 1 else n * fact(n - 1) }
```

</details>
	
This query also supports a slicing criterion based query mode that only returns information for functions matching the given criteria:

```json
[ { "type": "inspect-recursion",   "filter": [ "1@function" ] } ]
```

(This can be shortened to `@inspect-recursion (1@function) "fact <- function(n) { if(n <= 1) 1 else n * fact(n - 1) }"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **inspect-recursion**\
&nbsp;&nbsp;- Function **21** (1.9-57) is recursive

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"inspect-recursion":{".meta":{},"recursive":{"21":true}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
fact <- function(n) { if(n <= 1) 1 else n * fact(n - 1) }
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Inspect Recursive Functions Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/benchmark/slicer.ts#L129"><code>executor</code></a>.

</details>