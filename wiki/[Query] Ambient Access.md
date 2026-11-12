_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-10, 21:10:40 UTC (v2.17.5), do not edit directly._
<h2 id="Ambient Access Query">Ambient Access Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

What code reads and writes of the global state\
_This query is requested with the type `ambient-access`._\
Run in the REPL: `:query @ambient-access [(<crit>;...)] <code | file://path>`

This query reports what code reads and writes of the global state, such as options, environment variables,
the working directory, open devices, or the search path, as the pseudo variables of <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/ambient-state-name.ts#L38"><code><span title="Graphics parameters, options and other global state, tracked as global pseudo variables (#...) so readers link to the calls that set them.">AmbientStateName</span></code></a>
(`#option:digits`, `#env:A`, ...). A call counts with what the functions it calls access, so `f()` above writes `digits`.
It also names the global variables the code binds (`x <<- 1`) and the drawing calls it makes.
The same is available in code as `Dataflow.sideEffects.ambientAccess`.

Without criteria, the query answers for every file and for the whole project (`<project>`):

```json
[ { "type": "ambient-access" } ]
```

(This can be shortened to `@ambient-access` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **ambient-access** (26 ms)\
&nbsp;&nbsp;&nbsp;╰ **<file 1>**: reads: #option:*, #option:digits, #options, #sink writes: #env, #env:A, #option:digits, #options, #sink:output\
&nbsp;&nbsp;&nbsp;╰ **<project>**: reads: #option:*, #option:digits, #options, #sink writes: #env, #env:A, #option:digits, #options, #sink:output

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"ambient-access":{".meta":{},"results":{"<file 1>":{"reads":["#option:*","#option:digits","#options","#sink"],"writes":["#env","#env:A","#option:digits","#options","#sink:output"],"assumed":[],"kills":[],"variables":[],"draws":[]},"<project>":{"reads":["#option:*","#option:digits","#options","#sink"],"writes":["#env","#env:A","#option:digits","#options","#sink:output"],"assumed":[],"kills":[],"variables":[],"draws":[]}}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
f <- function() options(digits = 3)
f()
Sys.setenv(A = "1")
```

</details>
	
With slicing criteria, it answers for each criterion with all the code its node spans, so `3^` asks for the statement on line 3.
Set `functions` to also learn what calling each function accesses:

```json
[ { "type": "ambient-access",   "criteria": [ "2^" ],   "functions": true } ]
```

(This can be shortened to `@ambient-access (2^) "f <- function() options(digits = 3)\nf()\nSys.setenv(A = "1")"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **ambient-access** (13 ms)\
&nbsp;&nbsp;&nbsp;╰ **2^**: reads: #option:*, #option:digits, #options, #sink writes: #option:digits, #options, #sink:output\
&nbsp;&nbsp;&nbsp;╰ **function 7**: reads: #option:*, #option:digits writes: #option:digits, #options

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"ambient-access":{".meta":{},"results":{"2^":{"reads":["#option:*","#option:digits","#options","#sink"],"writes":["#option:digits","#options","#sink:output"],"assumed":[],"kills":[],"variables":[],"draws":[]}},"functions":{"7":{"reads":["#option:*","#option:digits"],"writes":["#option:digits","#options"],"assumed":[],"kills":[],"variables":[],"draws":[]}}},".meta":{}}
```

</details>

<details>

<summary style="color:gray">Implementation Details</summary>

The Ambient Access Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/ambient-access-query/ambient-access-query-executor.ts#L18"><code><span title="Executes AmbientAccessQuery s, sharing one pass over the call graph between all scopes they ask for.">executeAmbientAccessQuery</span></code></a>.

</details>