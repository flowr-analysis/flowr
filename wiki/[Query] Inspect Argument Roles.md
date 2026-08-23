_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-08-23, 13:40:42 UTC (v2.14.3), please do not edit directly._
<h2 id="Inspect Argument Roles Query">Inspect Argument Roles Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Determine what functions and their formals do\
_This query is requested with the type `inspect-fn-props`._\
Run in the REPL: `:query @inspect-fn-props [(<crit>;...)] <code | file://path>`


Per function definition this states what each formal is used for, as <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L8"><code><span title="What a single argument of a call is used for, as a bitmask. The signature database stores its parameters with the very same bits, so ArgProp.Forced and ArgProp.NoDefault lead, being the two it can state.">ArgProp</span></code></a> bits, and what the
function itself does, as <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L56"><code><span title="What the call as a whole does, as a bitmask. The resource bits ( CallProp.File and its neighbors) say where the call gets its data from, which is what InputProps collects.">CallProp</span></code></a> bits: the very scheme flowR states its built-ins and the
signature database stores its parameters with.

R hands arguments over as promises, so whether a parameter is evaluated at all is part of the answer:
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L10"><code><span title="evaluated whenever the call happens, even if the result goes unused, like x in force(x)">ArgProp::<b>Forced</b></span></code></a> says every call forces it,
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L48"><code><span title="never evaluated, the definite counterpart of ArgProp.Forced : no path of the body reads it">ArgProp::<b>Lazy</b></span></code></a> that none can, and neither of the two that it depends on the
path taken, on the caller, or on a function flowR could not resolve. A function forcing every one of its
parameters is <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/built-in-props.ts#L131"><code><span title="calling it forces every parameter, so nothing it is handed stays a promise (see strictnessOfFunction )">CallProp::<b>Strict</b></span></code></a> in turn. A read that only hands the parameter
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

Query: **inspect-fn-props** (6ms)\
&nbsp;&nbsp;- Function **32** (1.6-89) x: forced, alias, xs: forced, value, shape, FUN: forced, callee, opt: presence, lazy [prints]\
_All queries together required ≈6 ms (1ms accuracy, total 8 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _7.5 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "inspect-fn-props": {
    ".meta": {
      "timing": 6
    },
    "roles": {
      "32": {
        "1": 5,
        "3": 25,
        "5": 513,
        "7": 17408
      }
    },
    "props": {
      "32": 2097152
    }
  },
  ".meta": {
    "timing": 6
  }
}
```



</details>


<details> <summary style="color:gray">Original Code</summary>




```r
f <- function(x, xs, FUN, opt) { if(missing(opt)) print(length(xs)); lapply(xs, FUN); x }
```

<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis required _3.9 ms_ (including parse and normalize, using the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment. No [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) is mounted for these generated graphs, so `library()` calls attach no package exports; base-R names are still qualified via the generated base-package store (e.g. `acf` as `stats::acf`). 
We encountered unknown side effects (with ids: 21 (linked)) during the analysis.



```mermaid
flowchart LR
    32["`*#91;RFunctionDefinition#93;* **function**
      *1.6-89* (**id: 32**)`"]

subgraph "flow-32" [function 32]
    1["`*#91;RSymbol#93;* **x**
      *1.15* (**id: 1**, v: )`"]
    3["`*#91;RSymbol#93;* **xs**
      *1.18-19* (**id: 3**, v: )`"]
    5["`*#91;RSymbol#93;* **FUN**
      *1.22-24* (**id: 5**, v: )`"]
    7["`*#91;RSymbol#93;* **opt**
      *1.27-29* (**id: 7**, v: )`"]
    12(["`*#91;RSymbol#93;* **opt**
      *1.45-47* (**id: 12**)`"])
    14[["`*#91;RFunctionCall#93;* base#58;#58;**missing**
      *1.37-48* (**id: 14**)
    arg: (12)`"]]
    built-in:missing["`Built-In:
missing`"]
    style built-in:missing stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    17(["`*#91;RSymbol#93;* **xs**
      *1.64-65* (**id: 17**)`"])
    19[["`*#91;RFunctionCall#93;* base#58;#58;**length**
      *1.57-66* (**id: 19**, 23+)
    arg: (17)`"]]
    built-in:length["`Built-In:
length`"]
    style built-in:length stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    21[["`*#91;RFunctionCall#93;* base#58;#58;**print**
      *1.51-67* (**id: 21**, 23+)
    arg: (19)`"]]
    built-in:print["`Built-In:
print`"]
    style built-in:print stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    23[["`*#91;RIfThenElse#93;* base#58;#58;**if**
      *1.34-67* (**id: 23**)
    arg: (14, 21, #91;empty#93;)`"]]
    built-in:if["`Built-In:
if`"]
    style built-in:if stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    25(["`*#91;RSymbol#93;* **xs**
      *1.77-78* (**id: 25**)`"])
    %% Environment of 27 [level: 1]:
    %% Built-in
    %% 1----------------------------------------
    %% 2----------------------------------------
    %%   x:   {**x** (id: 1, type: Parameter, def. @2)}
    %%   xs:  {**xs** (id: 3, type: Parameter, def. @4)}
    %%   FUN: {**FUN** (id: 5, type: Parameter, def. @6)}
    %%   opt: {**opt** (id: 7, type: Parameter, def. @8)}
    27[["`*#91;RSymbol#93;* **FUN**
      *1.81-83* (**id: 27**)
    arg: (25)`"]]
    29[["`*#91;RFunctionCall#93;* base#58;#58;**lapply**
      *1.70-84* (**id: 29**)
    arg: (25, 27)`"]]
    built-in:lapply["`Built-In:
lapply`"]
    style built-in:lapply stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    30(["`*#91;RSymbol#93;* **x**
      *1.87* (**id: 30**)`"])
    31[["`*#91;RExpressionList#93;* base#58;#58;**#123;**
      *1.32* (**id: 31**)
    arg: (23, 29, 30)`"]]
    built-in:_["`Built-In:
#123;`"]
    style built-in:_ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    style 23 stroke:purple,stroke-width:4px; 
    style 14 stroke:purple,stroke-width:4px; 
    style 19 stroke:purple,stroke-width:4px; 
    style 21 stroke:purple,stroke-width:4px; 
    style 29 stroke:purple,stroke-width:4px; 
    style 31 stroke:purple,stroke-width:4px; 
end
    0["`*#91;RSymbol#93;* **f**
      *1.1* (**id: 0**, v: 32)`"]
    33[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
      *1.1-89* (**id: 33**)
    arg: (0, 32)`"]]
    built-in:_-["`Built-In:
#60;#45;`"]
    style built-in:_- stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    1 -.->|"flow"| 3
    linkStyle 0 stroke:gray,color:gray;
    3 -.->|"flow"| 5
    linkStyle 1 stroke:gray,color:gray;
    5 -.->|"flow"| 7
    linkStyle 2 stroke:gray,color:gray;
    7 -.->|"flow"| 12
    linkStyle 3 stroke:gray,color:gray;
    12 -->|"reads"| 7
    12 -.->|"flow"| 14
    linkStyle 5 stroke:gray,color:gray;
    14 -->|"reads, arg"| 12
    14 -.->|"branch (when: true)"| 17
    linkStyle 7 stroke:gray,color:gray;
    14 -.->|"branch (when: false)"| 23
    linkStyle 8 stroke:gray,color:gray;
    14 -.->|"reads, calls"| built-in:missing
    linkStyle 9 stroke:gray;
    17 -->|"reads"| 3
    17 -.->|"flow"| 19
    linkStyle 11 stroke:gray,color:gray;
    19 -->|"reads, arg"| 17
    19 -.->|"reads, calls"| built-in:length
    linkStyle 13 stroke:gray;
    19 -.->|"flow"| 21
    linkStyle 14 stroke:gray,color:gray;
    21 -->|"reads, returns, arg"| 19
    21 -.->|"reads, calls"| built-in:print
    linkStyle 16 stroke:gray;
    21 -.->|"flow"| 23
    linkStyle 17 stroke:gray,color:gray;
    23 -->|"returns, arg"| 21
    23 -->|"reads, arg"| 14
    23 -.->|"reads, calls"| built-in:if
    linkStyle 20 stroke:gray;
    23 -.->|"flow"| 25
    linkStyle 21 stroke:gray,color:gray;
    25 -->|"reads"| 3
    25 -.->|"flow"| 27
    linkStyle 23 stroke:gray,color:gray;
    27 -->|"reads"| 5
    27 -.->|"flow"| 29
    linkStyle 25 stroke:gray,color:gray;
    27 -->|"arg"| 25
    29 -->|"arg"| 25
    29 -->|"reads, arg"| 27
    29 -.->|"reads, calls"| built-in:lapply
    linkStyle 29 stroke:gray;
    29 -.->|"flow"| 30
    linkStyle 30 stroke:gray,color:gray;
    30 -->|"reads"| 1
    30 -.->|"flow"| 31
    linkStyle 32 stroke:gray,color:gray;
    31 -->|"arg"| 23
    31 -->|"arg"| 29
    31 -->|"returns, arg"| 30
    31 -.->|"reads, calls"| built-in:_
    linkStyle 36 stroke:gray;
32 -.-|function| flow-32

    32 -.->|"flow"| 0
    linkStyle 38 stroke:gray,color:gray;
    0 -->|"defined-by, flow"| 33
    0 -->|"defined-by"| 32
    33 -->|"reads, arg"| 32
    33 -->|"returns, arg"| 0
    33 -.->|"reads, calls"| built-in:_-
    linkStyle 43 stroke:gray;
```

	


</details>



</details>
	



	

This query also supports a slicing criterion based query mode that only returns information for functions matching the given criteria:



```json
[
  {
    "type": "inspect-fn-props",
    "filter": [
      "1@function"
    ]
  }
]
```


(This can be shortened to `@inspect-fn-props (1@function) "f <- function(x, xs, FUN, opt) { if(missing(opt)) print(length(xs)); lapply(xs, FUN); x }"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

Query: **inspect-fn-props** (5ms)\
&nbsp;&nbsp;- Function **32** (1.6-89) x: forced, alias, xs: forced, value, shape, FUN: forced, callee, opt: presence, lazy [prints]\
_All queries together required ≈5 ms (1ms accuracy, total 7 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _7.4 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "inspect-fn-props": {
    ".meta": {
      "timing": 5
    },
    "roles": {
      "32": {
        "1": 5,
        "3": 25,
        "5": 513,
        "7": 17408
      }
    },
    "props": {
      "32": 2097152
    }
  },
  ".meta": {
    "timing": 5
  }
}
```



</details>


<details> <summary style="color:gray">Original Code</summary>




```r
f <- function(x, xs, FUN, opt) { if(missing(opt)) print(length(xs)); lapply(xs, FUN); x }
```

<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis required _3.7 ms_ (including parse and normalize, using the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment. No [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) is mounted for these generated graphs, so `library()` calls attach no package exports; base-R names are still qualified via the generated base-package store (e.g. `acf` as `stats::acf`). 
We encountered unknown side effects (with ids: 21 (linked)) during the analysis.



```mermaid
flowchart LR
    32["`*#91;RFunctionDefinition#93;* **function**
      *1.6-89* (**id: 32**)`"]

subgraph "flow-32" [function 32]
    1["`*#91;RSymbol#93;* **x**
      *1.15* (**id: 1**, v: )`"]
    3["`*#91;RSymbol#93;* **xs**
      *1.18-19* (**id: 3**, v: )`"]
    5["`*#91;RSymbol#93;* **FUN**
      *1.22-24* (**id: 5**, v: )`"]
    7["`*#91;RSymbol#93;* **opt**
      *1.27-29* (**id: 7**, v: )`"]
    12(["`*#91;RSymbol#93;* **opt**
      *1.45-47* (**id: 12**)`"])
    14[["`*#91;RFunctionCall#93;* base#58;#58;**missing**
      *1.37-48* (**id: 14**)
    arg: (12)`"]]
    built-in:missing["`Built-In:
missing`"]
    style built-in:missing stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    17(["`*#91;RSymbol#93;* **xs**
      *1.64-65* (**id: 17**)`"])
    19[["`*#91;RFunctionCall#93;* base#58;#58;**length**
      *1.57-66* (**id: 19**, 23+)
    arg: (17)`"]]
    built-in:length["`Built-In:
length`"]
    style built-in:length stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    21[["`*#91;RFunctionCall#93;* base#58;#58;**print**
      *1.51-67* (**id: 21**, 23+)
    arg: (19)`"]]
    built-in:print["`Built-In:
print`"]
    style built-in:print stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    23[["`*#91;RIfThenElse#93;* base#58;#58;**if**
      *1.34-67* (**id: 23**)
    arg: (14, 21, #91;empty#93;)`"]]
    built-in:if["`Built-In:
if`"]
    style built-in:if stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    25(["`*#91;RSymbol#93;* **xs**
      *1.77-78* (**id: 25**)`"])
    %% Environment of 27 [level: 1]:
    %% Built-in
    %% 1----------------------------------------
    %% 2----------------------------------------
    %%   x:   {**x** (id: 1, type: Parameter, def. @2)}
    %%   xs:  {**xs** (id: 3, type: Parameter, def. @4)}
    %%   FUN: {**FUN** (id: 5, type: Parameter, def. @6)}
    %%   opt: {**opt** (id: 7, type: Parameter, def. @8)}
    27[["`*#91;RSymbol#93;* **FUN**
      *1.81-83* (**id: 27**)
    arg: (25)`"]]
    29[["`*#91;RFunctionCall#93;* base#58;#58;**lapply**
      *1.70-84* (**id: 29**)
    arg: (25, 27)`"]]
    built-in:lapply["`Built-In:
lapply`"]
    style built-in:lapply stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    30(["`*#91;RSymbol#93;* **x**
      *1.87* (**id: 30**)`"])
    31[["`*#91;RExpressionList#93;* base#58;#58;**#123;**
      *1.32* (**id: 31**)
    arg: (23, 29, 30)`"]]
    built-in:_["`Built-In:
#123;`"]
    style built-in:_ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    style 23 stroke:purple,stroke-width:4px; 
    style 14 stroke:purple,stroke-width:4px; 
    style 19 stroke:purple,stroke-width:4px; 
    style 21 stroke:purple,stroke-width:4px; 
    style 29 stroke:purple,stroke-width:4px; 
    style 31 stroke:purple,stroke-width:4px; 
end
    0["`*#91;RSymbol#93;* **f**
      *1.1* (**id: 0**, v: 32)`"]
    33[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
      *1.1-89* (**id: 33**)
    arg: (0, 32)`"]]
    built-in:_-["`Built-In:
#60;#45;`"]
    style built-in:_- stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    1 -.->|"flow"| 3
    linkStyle 0 stroke:gray,color:gray;
    3 -.->|"flow"| 5
    linkStyle 1 stroke:gray,color:gray;
    5 -.->|"flow"| 7
    linkStyle 2 stroke:gray,color:gray;
    7 -.->|"flow"| 12
    linkStyle 3 stroke:gray,color:gray;
    12 -->|"reads"| 7
    12 -.->|"flow"| 14
    linkStyle 5 stroke:gray,color:gray;
    14 -->|"reads, arg"| 12
    14 -.->|"branch (when: true)"| 17
    linkStyle 7 stroke:gray,color:gray;
    14 -.->|"branch (when: false)"| 23
    linkStyle 8 stroke:gray,color:gray;
    14 -.->|"reads, calls"| built-in:missing
    linkStyle 9 stroke:gray;
    17 -->|"reads"| 3
    17 -.->|"flow"| 19
    linkStyle 11 stroke:gray,color:gray;
    19 -->|"reads, arg"| 17
    19 -.->|"reads, calls"| built-in:length
    linkStyle 13 stroke:gray;
    19 -.->|"flow"| 21
    linkStyle 14 stroke:gray,color:gray;
    21 -->|"reads, returns, arg"| 19
    21 -.->|"reads, calls"| built-in:print
    linkStyle 16 stroke:gray;
    21 -.->|"flow"| 23
    linkStyle 17 stroke:gray,color:gray;
    23 -->|"returns, arg"| 21
    23 -->|"reads, arg"| 14
    23 -.->|"reads, calls"| built-in:if
    linkStyle 20 stroke:gray;
    23 -.->|"flow"| 25
    linkStyle 21 stroke:gray,color:gray;
    25 -->|"reads"| 3
    25 -.->|"flow"| 27
    linkStyle 23 stroke:gray,color:gray;
    27 -->|"reads"| 5
    27 -.->|"flow"| 29
    linkStyle 25 stroke:gray,color:gray;
    27 -->|"arg"| 25
    29 -->|"arg"| 25
    29 -->|"reads, arg"| 27
    29 -.->|"reads, calls"| built-in:lapply
    linkStyle 29 stroke:gray;
    29 -.->|"flow"| 30
    linkStyle 30 stroke:gray,color:gray;
    30 -->|"reads"| 1
    30 -.->|"flow"| 31
    linkStyle 32 stroke:gray,color:gray;
    31 -->|"arg"| 23
    31 -->|"arg"| 29
    31 -->|"returns, arg"| 30
    31 -.->|"reads, calls"| built-in:_
    linkStyle 36 stroke:gray;
32 -.-|function| flow-32

    32 -.->|"flow"| 0
    linkStyle 38 stroke:gray,color:gray;
    0 -->|"defined-by, flow"| 33
    0 -->|"defined-by"| 32
    33 -->|"reads, arg"| 32
    33 -->|"returns, arg"| 0
    33 -.->|"reads, calls"| built-in:_-
    linkStyle 43 stroke:gray;
```

	


</details>



</details>
	



	
		

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Inspect Argument Roles Query query is `executeFnPropsQuery` in [`./src/queries/catalog/inspect-fn-props-query/inspect-fn-props-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/inspect-fn-props-query/inspect-fn-props-query-executor.ts).

</details>