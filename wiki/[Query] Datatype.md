_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-09-01, 13:22:37 UTC (v2.15.8), please do not edit directly._
<h2 id="Datatype Query">Datatype Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns the inferred data types of the syntactic elements in the code.\
_This query is requested with the type `datatype`._


This query infers the data type of the syntactic elements in the code, either by the subtyping-based inference
(the default) or by the unification-based one (`useSubtyping: false`).

To exemplify its capabilities, consider the following code:


```r
x <- 1
y <- 2
x
```


To see the type inferred for the variable `x`, name it as a criterion:




```json
[ { "type": "datatype",   "criteria": [ "3@x" ] } ]
```






_Results (prettified and summarized):_

Query: **datatype** (3440 ms)\
&nbsp;&nbsp;&nbsp;╰ 3@x: {double}\
_All queries together required ≈3443 ms (1ms accuracy, total 3453 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _3452.6 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "datatype": {
    ".meta": {
      "timing": 3440
    },
    "inferredTypes": {
      "3@x": {
        "tag": "RDoubleType"
      }
    }
  },
  ".meta": {
    "timing": 3443
  }
}
```



</details>





	

Without `criteria` the query answers for every element of the normalized AST.

For functions it has no definition of, the inference draws on corpus-derived signatures. The package a name
refers to is resolved through the [Signature Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Signature) database, so a bare `ad.test` is typed with
what the attached package states rather than with what every package exporting an `ad.test` states together.
Where no package can be pinned down, the types of all packages carrying the name are used.
		

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Datatype Query query is `executeDatatypeQuery` in [`./src/queries/catalog/datatype-query/datatype-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/datatype-query/datatype-query-executor.ts).

</details>