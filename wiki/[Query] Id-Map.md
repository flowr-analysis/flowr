_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-08, 09:20:49 UTC (v2.17.4), do not edit directly._
<h2 id="Id-Map Query">Id-Map Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns the id-map of the normalized AST of the given code.\
_This query is requested with the type `id-map`._

This query provides access to all nodes in the [normalized AST](https://github.com/flowr-analysis/flowr/wiki/Normalized-AST) as a mapping from their id to the node itself.

Using the example code `x + 1`, the following query returns all nodes from the code:

```json
[ { "type": "id-map" } ]
```

(This can be shortened to `@id-map` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **id-map** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ Id List: {0, 1, 2, 3}

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"id-map":{".meta":{},"idMap":{"k2v":[[0,{"type":"RSymbol","location":[1,1,1,1],"content":"x","lexeme":"x","info":{"fullRange":[1,1,1,1],"adToks":[],"id":0,"parent":2,"role":"bin-l","index":0,"nest":0}}],[1,{"location":[1,5,1,5],"lexeme":"1","info":{"fullRange":[1,5,1,5],"adToks":[],"id":1,"parent":2,"role":"bin-r","index":1,"nest":0},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}}],[2,{"type":"RBinaryOp","location":[1,3,1,3],"lhs":{"type":"RSymbol","location":[1,1,1,1],"content":"x","lexeme":"x","info":{"fullRange":[1,1,1,1],"adToks":[],"id":0,"parent":2,"role":"bin-l","index":0,"nest":0}},"rhs":{"location":[1,5,1,5],"lexeme":"1","info":{"fullRange":[1,5,1,5],"adToks":[],"id":1,"parent":2,"role":"bin-r","index":1,"nest":0},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}},"operator":"+","lexeme":"+","info":{"fullRange":[1,1,1,5],"adToks":[],"id":2,"parent":3,"nest":0,"index":0,"role":"el-c"}}],[3,{"type":"RExpressionList","children":[{"type":"RBinaryOp","location":[1,3,1,3],"lhs":{"type":"RSymbol","location":[1,1,1,1],"content":"x","lexeme":"x","info":{"fullRange":[1,1,1,1],"adToks":[],"id":0,"parent":2,"role":"bin-l","index":0,"nest":0}},"rhs":{"location":[1,5,1,5],"lexeme":"1","info":{"fullRange":[1,5,1,5],"adToks":[],"id":1,"parent":2,"role":"bin-r","index":1,"nest":0},"type":"RNumber","content":{"num":1,"complexNumber":false,"markedAsInt":false}},"operator":"+","lexeme":"+","info":{"fullRange":[1,1,1,5],"adToks":[],"id":2,"parent":3,"nest":0,"index":0,"role":"el-c"}}],"info":{"adToks":[],"id":3,"nest":0,"role":"root","index":0}}]],"eager":false}},".meta":{}}
```

</details>

<details> <summary style="color:gray">Original Code</summary>

```r
x + 1
```

</details>
	
<details>

<summary style="color:gray">Implementation Details</summary>

The Id-Map Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/id-map-query/id-map-query-executor.ts#L9"><code><span title="Executes the given ID map queries using the provided analyzer.">executeIdMapQuery</span></code></a>.

</details>