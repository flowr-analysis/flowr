_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 09:20:49 UTC (v2.17.4), do not edit directly._
<h2 id="Dependencies Query">Dependencies Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns all direct dependencies (in- and outputs) of a given R script\
_This query is requested with the type `dependencies`._\
Run in the REPL: `:query @dependencies (<crit>;...) <code | file://path>`

This query extracts all dependencies from an R script, using a combination of a [Call-Context Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Call-Context)
and more advanced tracking in the [Dataflow Graph](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph).
Loaded libraries are resolved against the [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database).

The query reports one list of entries per category, each entry a call and the `value` it reads or writes, like the
file of a `read.csv`:

| Category | Functions known | For example | Value where none is named |
|----------|----------------:|-------------|---------------------------|
| **Inputs** | | | |
| `library` (Libraries) | 22 | `library`, `require`, `loadNamespace`, `requireNamespace` | `unknown` |
| `remote` (Remote Installs) | 10 | `install_github`, `install_gitlab`, `install_bitbucket`, `install_git` | `unknown` |
| `source` (Sourced Files) | 4 | `source`, `sys.source`, `source_url`, `source_gist` | `unknown` |
| `read` (Read Data) | 236 | `dbConnect`, `dbConnect`, `dbConnect`, `dbConnect` | `unknown` |
| **Outputs** | | | |
| `write` (Outputs) | 213 | `dump`, `open`, `seek`, `open.connection` | `stdout` |
| `visualize` (Visualizations) | 579 | `ggplot`, `ggplotly`, `ggMarginal`, `ggcorrplot` |  |
| **What the script does with data** | | | |
| `transform` (Data Transformations) | 140 | `subset`, `transform`, `filter`, `filter_out` |  |
| `statistics` (Statistics) | 74 | `lm`, `glm`, `nls`, `lmer` |  |
| `test` (Tests) | 14 | `test_that`, `describe`, `it`, `test_file` |  |

What the `value` of an entry tells, and the fields that say more:

| Entry | How to tell | Meaning |
|-------|-------------|---------|
| a file, package, or URL | `value` names it | the call reads or writes it, like `"data.csv"` |
| inline data | `value` is `constant` | The value resolved, but to data given inline rather than to a path (`matrix(0, 2, 2)`, `data.frame(a = 1)`). |
| an unknown resource | `value` is `unknown` | The value could not be resolved, e.g. a path assembled at runtime. Such a dependency may be missing or fetchable. |
| console output | `value` is `stdout` or `stderr` | `print` and `cat` write to `stdout`, `message` and `warning` to `stderr` |
| auto-printed output | `implicit` is set | the output is not written by a call asking for it: R echoes the top-level statement on its own |
| through a call of the program | `via` is set | Set on a call of a function of the program that does what this entry reports, transitively: the call of `report()` writes what the `cat()` in its body writes. It names the entry within the called function. The <code>value</code> is the one of this call, `save("a.csv")` writes `a.csv` even if other calls of `save` name other files. |
| part of another output | its id is in another entry's `parts` | The other statements that build this output: for a plot, the addons drawn onto it and, when it lands in a file, the device opener and closer around it. Answers *which statements produce this output* without rebuilding it from <code>linkedIds</code> . A part is reported as an entry of its own as well, so to count plots rather than graphics calls, count the entries no other entry lists in its parts. |

For a script reading `library(x)`, the following query returns the loaded library:

```json
[ { "type": "dependencies" } ]
```

(This can be shortened to `@dependencies` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **dependencies** (3 ms)\
&nbsp;&nbsp;&nbsp;**Libraries** _(1)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**x** _via library (node 3)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"dependencies":{".meta":{},"library":[{"nodeId":3,"functionName":"library","value":"x"}],"remote":[],"source":[],"read":[],"write":[],"visualize":[],"transform":[],"test":[],"statistics":[]},".meta":{}}
```

</details>

The query also handles more complicated scripts and offers information on the loaded _libraries_, _sourced_ files, data which is _read_ and data which is _written_.
For example, consider the following script:

```r

source("sample.R")
foo <- loadNamespace("bar")

data <- read.csv("data.csv")

#' @importFrom ggplot2 ggplot geom_point aes
ggplot(data, aes(x=x, y=y)) + geom_point()

better::write.csv(data, "data2.csv")
print("hello world!")
```

The following query returns the dependencies of the script.

```json
[ { "type": "dependencies" } ]
```

(This can be shortened to `@dependencies` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **dependencies** (8 ms)\
&nbsp;&nbsp;&nbsp;**Libraries** _(2)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**bar** _via loadNamespace (node 8)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**better** _via :: (node 32)_\
&nbsp;&nbsp;&nbsp;**Sourced Files** _(1)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**sample.R** _via source (node 3)_\
&nbsp;&nbsp;&nbsp;**Read Data** _(1)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**data.csv** _via read.csv (node 14)_\
&nbsp;&nbsp;&nbsp;**Outputs** _(1)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**stdout** _via print (node 41)_\
&nbsp;&nbsp;&nbsp;**Visualizations** _(2)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_<unresolved>_ _via ggplot (node 28)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_<unresolved>_ _via geom_point (node 30, linked 28)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"dependencies":{".meta":{},"library":[{"nodeId":8,"functionName":"loadNamespace","value":"bar"},{"nodeId":32,"functionName":"::","value":"better"}],"remote":[],"source":[{"nodeId":3,"functionName":"source","value":"sample.R"}],"read":[{"nodeId":14,"functionName":"read.csv","assignedTo":"data","value":"data.csv"}],"write":[{"nodeId":41,"functionName":"print","value":"stdout"}],"visualize":[{"nodeId":28,"functionName":"ggplot","inputVariables":["data","x","y"],"parts":[30]},{"nodeId":30,"functionName":"geom_point","linkedIds":[28],"inputVariables":["data","x","y"]}],"transform":[],"test":[],"statistics":[]},".meta":{}}
```

</details>

</details>

Currently, the dependency extraction may fail as it is essentially a set of heuristics guessing the dependencies.
We welcome any feedback on this (consider opening a [new issue](https://github.com/flowr-analysis/flowr/issues/new/choose)).

In the meantime we offer several properties to overwrite the default behavior (e.g., function names that should be collected)

```json
[ { "type": "dependencies",   "ignoreDefaultFunctions": true,   "enabledCategories": [ "library" ],   "libraryFunctions": [ { "package": "base",     "name": "print",     "argIdx": 0,     "argName": "library",     "resolveValue": true } ] } ]
```

 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **dependencies** (1 ms)\
&nbsp;&nbsp;&nbsp;**Libraries** _(1)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**hello world!** _via print (node 41)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"dependencies":{".meta":{},"library":[{"nodeId":41,"functionName":"print","value":"hello world!"}],"remote":[],"source":[],"read":[],"write":[],"visualize":[],"transform":[],"test":[],"statistics":[]},".meta":{}}
```

</details>

</details>

Here, `resolveValue` tells the dependency query to resolve the value of this argument in case it is not a constant.

By default the query reports only the dependencies the code names itself. Yet R attaches a handful of base packages
to the search path on startup, so a bare `sd(x)` genuinely depends on `stats` without any `library` call saying so.
Set `assumedPackages` to have those reported as well, as `library` entries marked `implicit` and carrying no
`nodeId` (no single call stands for "R attached this"), with the calls that pulled the package in listed as
`linkedIds`:

```json
[ { "type": "dependencies",   "assumedPackages": true,   "enabledCategories": [ "library" ] } ]
```

_Results (prettified and summarized):_

Query: **dependencies** (1 ms)\
&nbsp;&nbsp;&nbsp;**Libraries** _(2)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**base** _always attached by R, used at 8_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**stats** _attached by R at startup, used at 10_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"dependencies":{".meta":{},"library":[{"functionName":"<attached>","value":"base","implicit":true,"alwaysAttached":true,"linkedIds":[8]},{"functionName":"<attached>","value":"stats","implicit":true,"linkedIds":[10]}],"remote":[],"source":[],"read":[],"write":[],"visualize":[],"transform":[],"test":[],"statistics":[]},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
sd(c(1, 2, 3))
```

</details>
	
`base` is reported alongside the others but additionally marked `alwaysAttached`. The other six are attached by
convention and `R_DEFAULT_PACKAGES` (or `options(defaultPackages=)`) can drop any of them, whereas `base` is always
there and cannot be detached -- so it is never something the script could have asked for, and never something to
suggest a `library` call for.

To see what takes part in a dependency, ask the query to `focus` on it: `.meta.focus` then lists every node the
dependency depends on and every node that depends on it, so a client can gray out the rest. In the REPL, the
criteria go in parentheses, as with <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span> `@dependencies (3@read.csv)`, which prints the lines taking part:

```json
[ { "type": "dependencies",   "focus": [ "3@read.csv" ],   "enabledCategories": [ "read" ] } ]
```

 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **dependencies** (3 ms)\
&nbsp;&nbsp;&nbsp;**Read Data** _(1)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**a.csv** _via read.csv (node 10)_\
&nbsp;&nbsp;&nbsp;**focus** _the lines taking part:_ 1, 3, 5

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"dependencies":{".meta":{"focus":[10,8,0,2,1,11,6,18,20]},"library":[],"remote":[],"source":[],"read":[{"nodeId":10,"functionName":"read.csv","assignedTo":"d","value":"a.csv"}],"write":[],"visualize":[],"transform":[],"test":[],"statistics":[]},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
f <- "a.csv"
g <- 2
d <- read.csv(f)
h <- g + 1
print(d)
```

</details>
	
</details>

Beyond libraries, files and outputs, the query knows the `visualize` category (plots) and the `transform` category
(`Data Transformations`): the calls that reshape, filter, join or aggregate data, like `dplyr::filter`, `tidyr::pivot_longer`,
`merge`, `aggregate` or `data.table::setDT`. The category is read from the built-in configuration: every built-in labeled
`SemanticCallTag.Transforms` belongs to it. Every such built-in names its package, so `filter` is only a transformation when it
resolves to `dplyr` and never for the time-series `stats::filter`.

The `read`, `write`, `visualize`, and `transform` entries additionally state how data flows through the call,
resolved with the [dataflow graph](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph) instead of the syntax:
* `inputVariables` (for `write`, `visualize`, and `transform`) are the variables the result is computed from, through every call
  in between. What an argument's role in the signature excludes (a file, a flag, a callee) is no input, nor is what a call quotes or
  looks up in a data mask: `df` for `df |> filter(x > 1)`, both `a` and `b` for `left_join(a, b)`. An addon to a plot draws its data.
* `assignedTo` (for `read`, `visualize`, and `transform`) is the variable the result is stored in, following every call that hands
  it on (a pipe into a call, parentheses, a `+` adding to a plot) up to `<-`, `=` or `->`: `small` for `small <- filter(df, x > 1)`, and
  nothing for `f(filter(df, x > 1))`.
* Every plot additionally carries its `title` (from `ggtitle`, `labs(title = )` or `main =`) and the file it is written to as `savedTo`
  (by `ggsave`, which names its `plot` or saves `last_plot()`, or by the graphics device open when it is drawn).

```json
[ { "type": "dependencies",   "enabledCategories": [ "transform",    "visualize" ] } ]
```

_Results (prettified and summarized):_

Query: **dependencies** (3 ms)\
&nbsp;&nbsp;&nbsp;**Visualizations** _(3)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_<unresolved>_ _via ggplot (node 38)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_<unresolved>_ _via geom_point (node 40, linked 38)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_<unresolved>_ _via ggtitle (node 45, linked 38)_\
&nbsp;&nbsp;&nbsp;**Data Transformations** _(2)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_<unresolved>_ _via filter (node 16)_\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_<unresolved>_ _via select (node 24)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"dependencies":{".meta":{},"library":[],"remote":[],"source":[],"read":[],"write":[],"visualize":[{"nodeId":38,"functionName":["ggplot","ggplot2",false],"inputVariables":["small"],"assignedTo":"p","parts":[40,45],"title":"Small"},{"nodeId":40,"functionName":["geom_point","ggplot2",false],"linkedIds":[38],"assignedTo":"p","inputVariables":["small"]},{"nodeId":45,"functionName":["ggtitle","ggplot2",false],"linkedIds":[38],"assignedTo":"p","inputVariables":["small"]}],"transform":[{"nodeId":16,"functionName":["filter","dplyr",false],"inputVariables":["measurements"]},{"nodeId":24,"functionName":["select","dplyr",false],"inputVariables":["measurements"],"assignedTo":"small"}],"test":[],"statistics":[]},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r

library(dplyr)
library(ggplot2)
small <- measurements |> filter(x > 1) |> select(x, y)
p <- ggplot(small, aes(x, y)) + geom_point() + ggtitle("Small")
ggsave("small.png", plot = p)
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Dependencies Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/dependencies-query/dependencies-query-executor.ts#L43"><code><span title="Executes a dependencies query.">executeDependenciesQuery</span></code></a>.

</details>