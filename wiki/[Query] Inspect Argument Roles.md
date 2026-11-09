_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 20:46:01 UTC (v2.17.5), do not edit directly._
<h2 id="Inspect Argument Roles Query">Inspect Argument Roles Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Determine what functions and their formals do\
_This query is requested with the type `inspect-fn-props`._\
Run in the REPL: `:query @inspect-fn-props [(<crit>;...)] <code | file://path>`

Per function definition this states what each formal is used for, as <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L9"><code><span title="What a single argument of a call is used for, as a bitmask ( ArgProp.Forced / ArgProp.NoDefault lead, being the two bits the signature database can also state).">ArgProp</span></code></a> bits, and what the
function itself does, as <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L53"><code><span title="The properties of the behavior of a call, as a bitmask.">CallProp</span></code></a> bits: the very scheme flowR states its built-ins and the
signature database stores its parameters with.

R hands arguments over as promises, so whether a parameter is evaluated at all is part of the answer:
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L11"><code><span title="evaluated whenever the call happens, even if the result goes unused, like x in force(x)">ArgProp::<b>Forced</b></span></code></a> says every call forces it,
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L39"><code><span title="never evaluated, the definite counterpart of ArgProp.Forced : no path of the body reads it">ArgProp::<b>Lazy</b></span></code></a> that none can, and neither of the two that it depends on the
path taken, on the caller, or on a function flowR could not resolve. A function forcing every one of its
parameters is <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L78"><code>CallProp::<b>Strict</b></code></a> in turn. A read that only hands the parameter
on is decided by the function receiving it, resolved through the call graph, while a read in a nested
definition, in a loop, or under a condition leaves it open.

A formal is an alias only if the function *always* returns it (`return(x)` under an `if` does not count),
every other bit is the one the calls in the body state for what they are handed, and a formal carrying none at
all is left out. A body reading its own call or frame (`match.call()`, `nargs()`,
`as.list(environment())`) reaches every formal without naming one, so they all carry `nse`.
What the function itself does is read off its body: what its calls do it does too, a dispatching body is a
generic, and one whose result always comes from a call returning invisibly returns invisibly in turn.

With `only` the query infers just one half (`arguments` or `function`, skipping the other walk
entirely), `formals` keeps the parameters written as one of the given names, and `props` keeps the
properties named as the `ArgProp`/`CallProp` members they are.

Using the example code `f <- function(x, xs, FUN, opt) { if(missing(opt)) print(length(xs)); lapply(xs, FUN); x }` the following query returns what every identified function and formal does:

```json
[ { "type": "inspect-fn-props" } ]
```

(This can be shortened to `@inspect-fn-props` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **inspect-fn-props**\
&nbsp;&nbsp;- Function **32** (1.6-89) x: forced, alias, required, xs: forced, value, shape, FUN: forced, callee, guarded, opt: presence, lazy [prints]

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"inspect-fn-props":{".meta":{},"roles":{"32":{"1":262149,"3":25,"5":524801,"7":17408}},"props":{"32":{"props":0,"tags":["prints"]}}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
f <- function(x, xs, FUN, opt) { if(missing(opt)) print(length(xs)); lapply(xs, FUN); x }
```

</details>
	
This query also supports a slicing criterion based query mode that only returns information for functions matching the given criteria:

```json
[ { "type": "inspect-fn-props",   "filter": [ "1@function" ] } ]
```

(This can be shortened to `@inspect-fn-props (1@function) "f <- function(x, xs, FUN, opt) { if(missing(opt)) print(length(xs)); lapply(xs, FUN); x }"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **inspect-fn-props**\
&nbsp;&nbsp;- Function **32** (1.6-89) x: forced, alias, required, xs: forced, value, shape, FUN: forced, callee, guarded, opt: presence, lazy [prints]

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"inspect-fn-props":{".meta":{},"roles":{"32":{"1":262149,"3":25,"5":524801,"7":17408}},"props":{"32":{"props":0,"tags":["prints"]}}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
f <- function(x, xs, FUN, opt) { if(missing(opt)) print(length(xs)); lapply(xs, FUN); x }
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Inspect Argument Roles Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/inspect-fn-props-query/inspect-fn-props-query-executor.ts#L52"><code><span title="Execute function-property inspection queries on the given analyzer.">executeFnPropsQuery</span></code></a>.

</details>