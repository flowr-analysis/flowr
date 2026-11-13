_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-13, 12:11:51 UTC (v2.17.6), do not edit directly._
<h2 id="Data Columns Query">Data Columns Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns the columns of a data frame that can be written at a position, as an editor offers them to complete.\
_This query is requested with the type `data-columns`._\
Run in the REPL: `:query @data-columns (<line:col>;...) <code | file://path>`

Editors complete names, and within code that works on a data frame the names worth offering are often its columns:
after `df$`, but also in every argument a call evaluates within its data, as `filter`, `mutate`, `subset`, `with`, or `aes` do.
flowR knows which arguments a call evaluates that way (they are _quoted_ in the dataflow graph), so this works for every such call,
not just for a fixed list of them. The data frame is another argument of that call, the left side of a pipe into it, or, for a layer
like `geom_point(aes(...))`, an argument of what it is added to. Its columns come from the [Abstract Interpretation Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Abstract-Interpretation) of data frame shapes,
which also knows the data sets R finds as lazy data, like `penguins` of `datasets` or `starwars` of `dplyr` (once loaded, or as `dplyr::starwars`).

Consider the following code, with the cursor just after the `bi` (line 2, column 34):

```r
library(dplyr)
penguins |> filter(year > 2008, bi)
```

The query asks for the columns at that position:

```json
[ { "type": "data-columns",   "positions": [ "2:34" ] } ]
```

(This can be shortened to `@data-columns (2:34) "library(dplyr)\npenguins |> filter(year > 2008, bi)"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **data-columns** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **2:34** (masked of penguins): species, island, bill_len, bill_dep, flipper_len, body_mass, sex, year

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"data-columns":{".meta":{},"results":{"2:34":{"context":"masked","columns":["species","island","bill_len","bill_dep","flipper_len","body_mass","sex","year"],"frames":[{"id":5,"lexeme":"penguins","must":["species","island","bill_len","bill_dep","flipper_len","body_mass","sex","year"],"may":[],"exact":true}]}}},".meta":{}}
```

</details>

The position has to fall within a node. An editor completing a name not typed yet, as in `filter(penguins, )`, inserts a placeholder name at the cursor first.
		
<details>

<summary style="color:gray">Implementation Details</summary>

The Data Columns Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/data-columns-query/data-columns-query-format.ts#L144"><code><span title="Executes data columns queries: the data frame shape inference runs once for all of them.">executeDataColumnsQuery</span></code></a>.

</details>