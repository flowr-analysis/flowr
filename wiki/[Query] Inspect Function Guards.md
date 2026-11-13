_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-13, 12:11:51 UTC (v2.17.6), do not edit directly._
<h2 id="Inspect Function Guards Query">Inspect Function Guards Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Infer what functions ask of the calls they return from\
_This query is requested with the type `inspect-fn-guards`._\
Run in the REPL: `:query @inspect-fn-guards [(<crit>;...)] <code | file://path>`

This query works out the *contract* of every function of a program: what a call has to fulfill to return normally, read off the checks in the body.
In the example below, `f` stops unless `x` is a non-negative number at least `n` long, and `match.arg` only lets `type` be `"a"` or `"b"`.
The query states exactly that: per formal what a call has to give and what holds of it, and what relates several formals, like `length(x) >= n`:

```json
[ { "type": "inspect-fn-guards" } ]
```

(This can be shortened to `@inspect-fn-guards` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **inspect-fn-guards**\
&nbsp;&nbsp;- Function **53** (1.6-6.1) requires succeeds(match.arg(type, c("a", "b"))) && (!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && is.numeric(x) && x >= 0 && (!is.function(n) && !is.environment(n) && !is.symbol(n) && !is.call(n) || is.object(n) || is.object(length(x))) && length(x) >= n\
&nbsp;&nbsp;&nbsp;&nbsp;x (required): integer or double, unless classed, value >= 0\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;checked by: is.numeric(x), x >= 0, length(x) >= n\
&nbsp;&nbsp;&nbsp;&nbsp;n (required): (anything but function, environment, symbol, or language, unless classed) unless is.object(length(x))\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;checked by: length(x) >= n\
&nbsp;&nbsp;&nbsp;&nbsp;between x and n: length(x) >= n\
&nbsp;&nbsp;&nbsp;&nbsp;type: NULL or character, one of a, b (or a prefix)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;checked by: succeeds(match.arg(type, c("a", "b")))

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON, hiding built-in):_

```text
{"inspect-fn-guards":{".meta":{},"guards":{"53":{"requires":"succeeds(match.arg(type, c(\"a\", \"b\"))) && (!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && is.numeric(x) && x >= 0 && (!is.function(n) && !is.environment(n) && !is.symbol(n) && !is.call(n) || is.object(n) || is.object(length(x))) && length(x) >= n","pure":"succeeds(match.arg(type, c(\"a\", \"b\"))) && (!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)) && is.numeric(x) && x >= 0 && (!is.function(n) && !is.environment(n) && !is.symbol(n) && !is.call(n) || is.object(n) || is.object(length(x))) && length(x) >= n","clauses":[{"requires":{"kind":"call","fn":"succeeds","known":true,"args":[{"value":{"kind":"call","fn":"match.arg","args":[{"value":{"kind":"formal","name":"type"}},{"value":{"kind":"call","fn":"c","args":[{"value":{"kind":"constant","lexeme":"\"a\"","value":"a"}},{"value":{"kind":"constant","lexeme":"\"b\"","value":"b"}}],"pkg":"base","known":true}}],"pkg":"base","known":true}}]},"rendered":"succeeds(match.arg(type, c(\"a\", \"b\")))","at":19,"kind":"explicit","pure":true},{"requires":{"kind":"call","fn":"||","known":true,"args":[{"value":{"kind":"call","fn":"&&","known":true,"args":[{"value":{"kind":"call","fn":"&&","known":true,"args":[{"value":{"kind":"call","fn":"&&","known":true,"args":[{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.function","known":true,"args":[{"value":{"kind":"formal","name":"x"}}]}}]}},{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.environment","known":true,"args":[{"value":{"kind":"formal","name":"x"}}]}}]}}]}},{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.symbol","known":true,"args":[{"value":{"kind":"formal","name":"x"}}]}}]}}]}},{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.call","known":true,"args":[{"value":{"kind":"formal","name":"x"}}]}}]}}]}},{"value":{"kind":"call","fn":"is.object","known":true,"args":[{"value":{"kind":"formal","name":"x"}}]}}]},"rendered":"!is.function(x) && !is.environment(x) && !is.symbol(x) && !is.call(x) || is.object(x)","at":28,"kind":"implicit","message":"comparison (<) is possible only for atomic and list types","pure":true,"under":[{"kind":"call","fn":"is.numeric","args":[{"value":{"kind":"formal","name":"x"}}],"pkg":"base","known":true}]},{"requires":{"kind":"call","fn":"is.numeric","args":[{"value":{"kind":"formal","name":"x"}}],"pkg":"base","known":true},"rendered":"is.numeric(x)","at":33,"kind":"explicit","message":"invalid x","pure":true,"under":[{"kind":"call","fn":"||","known":true,"args":[{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.numeric","args":[{"value":{"kind":"formal","name":"x"}}],"pkg":"base","known":true}}]}},{"value":{"kind":"call","fn":"<","args":[{"value":{"kind":"formal","name":"x"}},{"value":{"kind":"constant","lexeme":"0","value":0}}],"pkg":"base","known":true}}]}]},{"requires":{"kind":"call","fn":">=","args":[{"value":{"kind":"formal","name":"x"}},{"value":{"kind":"constant","lexeme":"0","value":0}}],"pkg":"base","known":true},"rendered":"x >= 0","at":33,"kind":"explicit","message":"invalid x","pure":true,"under":[{"kind":"call","fn":"||","known":true,"args":[{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.numeric","args":[{"value":{"kind":"formal","name":"x"}}],"pkg":"base","known":true}}]}},{"value":{"kind":"call","fn":"<","args":[{"value":{"kind":"formal","name":"x"}},{"value":{"kind":"constant","lexeme":"0","value":0}}],"pkg":"base","known":true}}]}]},{"requires":{"kind":"call","fn":"||","known":true,"args":[{"value":{"kind":"call","fn":"||","known":true,"args":[{"value":{"kind":"call","fn":"&&","known":true,"args":[{"value":{"kind":"call","fn":"&&","known":true,"args":[{"value":{"kind":"call","fn":"&&","known":true,"args":[{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.function","known":true,"args":[{"value":{"kind":"formal","name":"n"}}]}}]}},{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.environment","known":true,"args":[{"value":{"kind":"formal","name":"n"}}]}}]}}]}},{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.symbol","known":true,"args":[{"value":{"kind":"formal","name":"n"}}]}}]}}]}},{"value":{"kind":"call","fn":"!","known":true,"args":[{"value":{"kind":"call","fn":"is.call","known":true,"args":[{"value":{"kind":"formal","name":"n"}}]}}]}}]}},{"value":{"kind":"call","fn":"is.object","known":true,"args":[{"value":{"kind":"formal","name":"n"}}]}}]}},{"value":{"kind":"call","fn":"is.object","known":true,"args":[{"value":{"kind":"call","fn":"length","args":[{"value":{"kind":"formal","name":"x"}}],"pkg":"base","known":true}}]}}]},"rendered":"!is.function(n) && !is.environment(n) && !is.symbol(n) && !is.call(n) || is.object(n) || is.object(length(x))","at":41,"kind":"implicit","message":"comparison (<) is possible only for atomic and list types","pure":true},{"requires":{"kind":"call","fn":">=","args":[{"value":{"kind":"call","fn":"length","args":[{"value":{"kind":"formal","name":"x"}}],"pkg":"base","known":true}},{"value":{"kind":"formal","name":"n"}}],"pkg":"base","known":true},"rendered":"length(x) >= n","at":45,"kind":"explicit","message":"x is too short","pure":true,"under":[{"kind":"call","fn":"<","args":[{"value":{"kind":"call","fn":"length","args":[{"value":{"kind":"formal","name":"x"}}],"pkg":"base","known":true}},{"value":{"kind":"formal","name":"n"}}],"pkg":"base","known":true}]}],"conditions":{"type":["succeeds(match.arg(type, c(\"a\", \"b\")))"],"x":["is.numeric(x)","x >= 0","length(x) >= n"],"n":["length(x) >= n"]},"formals":{"x":{"unclassedTypes":["integer","double"],"bounds":{"value":[0,null]}},"type":{"types":["NULL","character"],"values":["a","b"],"partial":true}},"relations":[{"holds":"length(x) >= n","formals":["x","n"]}],"conditional":[{"formal":"n","claim":{"unclassedTypes":["NULL","logical","integer","double","complex","character","raw","list","pairlist","expression","other"]},"unless":"is.object(length(x))"}],"required":["x","n"]}}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
f <- function(x, n, type = c("a", "b")) {
  type <- match.arg(type)
  if(!is.numeric(x) || x < 0) stop("invalid x")
  if(length(x) < n) stop("x is too short")
  sum(x)
}
```

</details>
	
### Where the contracts are used

- the `call-contracts` linting rule reports a call that cannot fulfill the contract of what it calls, like `f(-1)` or `f("a")`
- the [Inspect Argument Roles Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Inspect-Argument-Roles) reports the formals a call has to supply (<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L49"><code><span title="a call leaving it out fails, as the body reads it on every way through; only inferred (see FunctionSemantics.guards )">ArgProp::<b>Required</b></span></code></a>) and those a condition reads (<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L51"><code><span title="a call fails on some of what it could hold, as there are guards on it; only inferred (see FunctionSemantics.guards )">ArgProp::<b>Guarded</b></span></code></a>)
- the [Signature Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Signature) and the [signature browser](https://flowr-analysis.github.io/flowr/wiki/sigdb/) show the contracts of the functions of R and of packages
- the playground shows the contract of the function under the cursor

### Reading the result

Each function the program defines gets <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L79"><code><span title="What a function asks for of the calls it can return from, see guardsOfFunctions .">FunctionGuards</span></code></a>:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L81"><code><span title="every condition found">FunctionGuards::<b>clauses</b></span></code></a>: one <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L59"><code><span title="One condition every normal return of a function has passed; if it does not hold, the call fails.">GuardClause</span></code></a> per check, with the condition as R code and as a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/guard-term.ts#L548"><code><span title="Terms state what a guard asks for, see GuardTerm .">GuardTerm</span></code></a> tree (`succeeds(e)` stands for `e` not raising an error), whether R checks it itself (`implicit`, like `x + 1` for a value that is no number) or the code does (`explicit`, like the `stop` above), and the message of the failure
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L83"><code><span title="per formal, what the conditions say about it">FunctionGuards::<b>formals</b></span></code></a>: what the conditions together claim of each formal, as a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/guard-claims.ts#L17"><code><span title="What a call that returns normally has made sure of one of the formals of a function, each read off the guards. A field left out claims nothing.">FormalClaim</span></code></a>:

| field | a normal return makes sure that |
|---|---|
| `types` | `typeof(x)` is one of these |
| `unclassedTypes` | the same, but only for an `x` without a class (a classed one may bring its own method) |
| `values`, `partial` | `x` is one of these strings, or with `partial` abbreviates one (`match.arg`) |
| `classes` | `x` inherits from one of these |
| `bounds` | `x` (`value`), `length(x)`, `nchar(x)`, `nrow(x)`, ... lie in this range |
| `whole`, `notNA`, `callable` | `trunc(x) == x`, `!anyNA(x)`, `x` is or names a function |
| `resolves` | a name built from `x`, like `paste0("f_", x)`, exists |
| `cases` | what holds in each case a branch on `x` tells apart, like `if(is.logical(center)) ... else ...` |

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L85"><code><span title="what the conditions say of formals relative to each other, like length(x) >= m">FunctionGuards::<b>relations</b></span></code></a>: what relates several formals, like `length(x) >= n`, each with the formals it speaks of and what lets a call through anyway (`unless`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L87"><code><span title="what the conditions say of a formal unless something else lets the call through">FunctionGuards::<b>conditional</b></span></code></a>: what holds of a formal unless something about the others lets the call through, like `m` having to be a number unless `x` is no count
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L97"><code><span title="what holds of the value a call returns normally, said as of a formal">FunctionGuards::<b>returns</b></span></code></a>: what holds of the value a call returns normally
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L89"><code><span title="per formal, the conditions the function checks itself that read it (from stopifnot, if and stop, ...), in R syntax: what FunctionGuards.formals has no words for, like x %% 2 == 0, is here as well">FunctionGuards::<b>conditions</b></span></code></a>: per formal the checks as they read in R, also those no claim has a word for, like `stopifnot(x %% 2 == 0)`
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L91"><code><span title="the formals a call has to supply, as it fails otherwise">FunctionGuards::<b>required</b></span></code></a>: the formals a call has to supply
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/guards/function-guards.ts#L95"><code><span title="the conditions that fail before any side effect in R syntax, an empty string if there are none: the tightest precondition that guarantees a clean failure">FunctionGuards::<b>pure</b></span></code></a>: the checks that fail before the function does anything but compute, so a call failing on them leaves nothing behind

The query takes `kind` (keep only `implicit` or `explicit` conditions), `onlyPure`, `formals` (only these formals), and `builtIns` (also state the contracts of the functions of R and of the packages flowR knows).

### What counts as a check

- `stop`, `rlang::abort`, and every other function that always fails, reached under `if`, `&&`, `||`, and `switch`, taking an earlier `return` into account: `if(a) return(1); if(!is.numeric(x)) stop()` asks `a || is.numeric(x)`
- `stopifnot`, `assertthat::assert_that`, `match.arg`, `rlang::arg_match`, and the `assert_*` functions of `checkmate`
- what R fails on by itself, like `strsplit` for anything but a character vector
- names that have to resolve, like `do.call(paste0("f_", x), list())`, and a `UseMethod` without a default method
- the methods a dispatch may run: a generic asks what its `default` method (or that of an implicit class like `matrix`) asks, unless `is.object(x)`
- the contracts of the functions a body surely calls, in terms of what it hands them, and predicates of the program like `is_count <- function(v) is.numeric(v) && v >= 0`

### Teaching flowR about more functions

A contract can only be as good as what flowR knows about the functions a body calls. There are three places to add that knowledge:

1. **A predicate or check of your own code base, without changing flowR.** Describe it in the configuration of the analyzer (the same `overwriteBuiltIns` works in a configuration file). With this, `f <- function(x) { stopifnot(is_text(x)); x }` claims that `x` is a character vector:

```ts
new FlowrAnalyzerBuilder().amendConfig(c => {
	c.semantics.environment.overwriteBuiltIns.definitions = [{
		type: 'function', names: ['is_text'], processor: BuiltInProcName.DefaultReadAllArgs,
		config: { guards: { is_text: { predicate: { yes: RValueType.Character, exact: true } } } }
	}];
})
```

   Besides `predicate`, the guard facts can state `asks` (what the function fails on per formal), `required` (formals a call has to give), `check` (the function fails unless its argument passes, like `checkmate::assert_numeric`), `asserts` (it fails unless every argument is `TRUE`, like `stopifnot`), and `returns`. All of them are typed in `src/dataflow/environments/guard-facts.ts`.
2. **A function of R or a package that flowR should know for everyone.** Add its guard facts to the built-in configuration: `src/dataflow/environments/default-builtin-config/guards.ts` for functions of base R and packages, `guards-primitive-ops.ts` for the operators and math primitives. For example `'which': { asks: { x: fails(is('is.logical'), 'argument to \'which\' is not logical') } }` makes every `which(x)` ask for a logical `x`.
3. **The closures of the base packages.** Their contracts are read off R itself with `npx ts-node --transpile-only scripts/gen-base-guards.ts`, which writes `src/data/r-base-guards.generated.ts` (currently from R 4.6.1). Rerun it after changing what flowR knows, as the base contracts are built on top of that knowledge.

### Limits

Every condition the query reports is *necessary*: a call that breaks one fails in R. What flowR cannot state exactly (a loop body, a variable with several definitions, a function it does not know) weakens a condition or drops it, it never makes one stronger than what the code asks for.

- A condition speaks of the value at the check, so a formal overwritten before it is read as what it was overwritten with.
- A default value claims nothing: `function(n = 5L)` still takes `n = 1.5`. Only `match.arg` and `rlang::arg_match` read the default, as the values they allow.
- What R fails on depends on the R version flowR assumes (`solver.sigdb.assumedRVersion`, else R 4.6.1): a condition of `if` longer than one only fails since R 4.2.0, an operand of `&&` longer than one since R 4.3.0.
- A missing argument handed on to another function written in R is only required if that function needs it, as R hands it on as a promise: `matpoints(x)` passes its missing `y` to `matplot`, which checks `missing(y)`.
		
<details>

<summary style="color:gray">Implementation Details</summary>

The Inspect Function Guards Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/inspect-fn-guards-query/inspect-fn-guards-query-format.ts#L53"><code><span title="Execute function-guard inspection queries on the given analyzer.">executeFnGuardsQuery</span></code></a>.

</details>