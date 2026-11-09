_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-09, 05:32:52 UTC (v2.17.5), do not edit directly._
<h2 id="Inspect Function Guards Query">Inspect Function Guards Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Infer what functions ask of the calls they return from\
_This query is requested with the type `inspect-fn-guards`._\
Run in the REPL: `:query @inspect-fn-guards [(<crit>;...)] <code | file://path>`

This query works out the *preconditions* of the functions of a program from the guards in their bodies, which <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/function-semantics.ts#L23"><code><span title="The one helper to ask what a function *does*: what it makes of its arguments, what it may raise, which formals it forces, and what it declares as a class.">FunctionSemantics</span></code></a> answers as well.
A call returning normally has passed every condition reported for it, so each of them is a *necessary* condition, and a call breaking one fails.
flowR only states what it can be sure of: whatever it cannot state exactly (a loop body, a variable with several definitions, an unknown function a condition depends on)
weakens the condition or drops it, it never makes one stronger than what the code asks for.

What counts as a guard:

- `stop`, `rlang::abort`, and the other functions always failing, reached under any combination of `if`, `&&`, `||`, and `switch`, with what an earlier `return` skips being taken into account (`a || is.numeric(x)` for `if(a) return(1); if(!is.numeric(x)) stop()`)
- `stopifnot`, `assertthat::assert_that`, `match.arg`, `rlang::arg_match`, and the `assert_*` functions of `checkmate`
- what R itself fails on (the `implicit` kind), like `strsplit` for anything but a character vector, or `x + 1` for a value without a class that is no number
- what a name has to resolve to: `do.call(paste0("f_", x), list())` needs `exists(paste0("f_", x), mode = "function")`, and `UseMethod` without a default needs a method
- the conditions of the functions a body calls for sure, in terms of what was handed to them, as well as the single expression of predicates like `is_count <- function(v) is.numeric(v) && v >= 0`

Every entry of <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L56"><code><span title="every condition found">FunctionGuards::<b>clauses</b></span></code></a> is a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L36"><code><span title="One condition every normal return of a function has passed; if it does not hold, the call fails.">GuardClause</span></code></a> with the condition both as R code and as a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/guard-term.ts#L276"><code><span title="Terms state what a guard asks for, see GuardTerm .">GuardTerm</span></code></a> tree, in which `succeeds(e)` stands for `e` not raising an error.
A clause is `pure` if the failure comes before anything other than computing a value, so a call failing on it leaves nothing behind, and <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L66"><code><span title="the conditions that fail before any side effect in R syntax, an empty string if there are none: the tightest precondition that guarantees a clean failure">FunctionGuards::<b>pure</b></span></code></a> is the conjunction of those clauses.
On top of that <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L58"><code><span title="per formal, what the conditions say about it">FunctionGuards::<b>formals</b></span></code></a> holds what the conditions together claim about each formal, as a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/guard-claims.ts#L13"><code><span title="What a call that returns normally has made sure of one of the formals of a function, each read off the guards. A field left out claims nothing.">FormalClaim</span></code></a>: its types, the values it can take, its bounds, the classes it inherits from, and so on.
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L60"><code><span title="per formal, the conditions the function checks itself that read it (from stopifnot, if and stop, ...), in R syntax: what FunctionGuards.formals has no words for, like x %% 2 == 0, is here as well">FunctionGuards::<b>conditions</b></span></code></a> holds, per formal, the conditions the function checks itself as they read in R, so a `stopifnot(x %% 2 == 0)` is there even though no claim has words for it.
A default value of a formal claims nothing, as it only fills in what a call leaves out: `function(n = 5L)` still takes `n = 1.5`, and only `match.arg` and `rlang::arg_match` read the default, namely as the values they allow.
With a wrapper handing on dots, an argument given by position only stays in place if the dots name nothing, which is why `f <- function(x, ...) g(x, ...)` asks for `!is.null(...names()) || is.list(x)` unless the formals of `g` leave no room for anything else.
With `builtIns` the query states the same for functions of R: what their closures check, read off R 4.6.1 by `scripts/gen-base-guards.ts`, and what is known of those written in C. The signature query and the [signature browser](https://flowr-analysis.github.io/flowr/wiki/sigdb/) show these as well.
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L62"><code><span title="the formals a call has to supply, as it fails otherwise">FunctionGuards::<b>required</b></span></code></a> names the formals a call has to supply, which the `inspect-fn-props` query reports as <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L47"><code><span title="a call leaving it out fails, as the body reads it on every way through; only inferred (see FunctionSemantics.guards )">ArgProp::<b>Required</b></span></code></a>, next to <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L49"><code><span title="a call fails on some of what it could hold, as there are guards on it; only inferred (see FunctionSemantics.guards )">ArgProp::<b>Guarded</b></span></code></a> for every formal a condition reads.

Conditions speak about the values at the guard, so a formal that has been overwritten by then is read as what it was overwritten with.
R 4.3 is assumed, as with older versions a condition of length two does not fail, and S3 methods for `length` and `is.numeric` are assumed to keep their contract.
With `kind` the query keeps the conditions of one kind, `onlyPure` keeps the clean failures, and `formals` narrows the answer to the named formals.

Using the example code the following query returns the guards of the function:

```json
[ { "type": "inspect-fn-guards" } ]
```

(This can be shortened to `@inspect-fn-guards` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **inspect-fn-guards**\
&nbsp;&nbsp;- Function **43** (1.6-6.1) requires succeeds(match.arg(type, c("a", "b"))) && is.numeric(x) && x >= 0\
&nbsp;&nbsp;&nbsp;&nbsp;a call has to supply: x\
&nbsp;&nbsp;&nbsp;&nbsp;x: integer|double, value >= 0\
&nbsp;&nbsp;&nbsp;&nbsp;type: NULL|character, one of a, b (or a prefix)\
&nbsp;&nbsp;&nbsp;&nbsp;type is checked by: succeeds(match.arg(type, c("a", "b")))\
&nbsp;&nbsp;&nbsp;&nbsp;x is checked by: is.numeric(x), x >= 0

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"inspect-fn-guards":{".meta":{},"guards":{"43":{"requires":"succeeds(match.arg(type, c(\"a\", \"b\"))) && is.numeric(x) && x >= 0","pure":"succeeds(match.arg(type, c(\"a\", \"b\"))) && is.numeric(x) && x >= 0","clauses":[{"requires":{"kind":"call","fn":"succeeds","known":true,"args":[{"value":{"kind":"call","fn":"match.arg","args":[{"value":{"kind":"formal","name":"type"}},{"value":{"kind":"call","fn":"c","args":[{"value":{"kind":"constant","lexeme":"\"a\"","value":"a"}},{"value":{"kind":"constant","lexeme":"\"b\"","value":"b"}}],"known":true}}],"known":true}}]},"rendered":"succeeds(match.arg(type, c(\"a\", \"b\")))","at":17,"kind":"explicit","pure":true},{"requires":{"kind":"call","fn":"is.numeric","args":[{"value":{"kind":"formal","name":"x"}}],"known":true},"rendered":"is.numeric(x)","at":31,"kind":"explicit","message":"invalid x","pure":true},{"requires":{"kind":"call","fn":">=","args":[{"value":{"kind":"formal","name":"x"}},{"value":{"kind":"constant","lexeme":"0","value":0}}],"known":true},"rendered":"x >= 0","at":31,"kind":"explicit","message":"invalid x","pure":true}],"conditions":{"type":["succeeds(match.arg(type, c(\"a\", \"b\")))"],"x":["is.numeric(x)","x >= 0"]},"formals":{"x":{"types":["integer","double"],"bounds":{"value":[0,null]}},"type":{"types":["NULL","character"],"values":["a","b"],"partial":true}},"required":["x"]}}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
f <- function(x, type = c("a", "b")) {
  type <- match.arg(type)
  if(!is.numeric(x) || x < 0) stop("invalid x")
  print(type)
  sum(x)
}
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Inspect Function Guards Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/inspect-fn-guards-query/inspect-fn-guards-query-executor.ts#L39"><code><span title="Execute function-guard inspection queries on the given analyzer.">executeFnGuardsQuery</span></code></a>.

</details>