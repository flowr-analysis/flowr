_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-08-20, 22:53:18 UTC (v2.14.1), please do not edit directly._
<h2 id="Search Query">Search Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Provides access to flowR's search API\
_This query is requested with the type `search`._


With this query you can use the [Search API](https://github.com/flowr-analysis/flowr/wiki/Search-API) to conduct searches on the flowR analysis result.

Using the example code `x + 1`, the following query returns all uses of 'x' in the code:



```json
[
  {
    "type": "search",
    "search": {
      "generator": {
        "type": "generator",
        "name": "get",
        "args": {
          "filter": {
            "name": "x"
          }
        }
      },
      "search": [
        {
          "type": "transformer",
          "name": "filter",
          "args": {
            "filter": "use"
          }
        }
      ]
    }
  }
]
```






_Results (prettified and summarized):_

Query: **search** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ [query](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IExSXG4wKFwiPGI+Z2V0PC9iPihmaWx0ZXI6ICMxMjM7IzM0O25hbWUjMzQ7IzU4OyMzNDt4IzM0OyMxMjU7KTxici8+X2dlbmVyYXRvcl9cIikgLS0+IDFbXCI8Yj5maWx0ZXI8L2I+KGZpbHRlcjogIzM0O3VzZSMzNDspPGJyLz5fdHJhbnNmb3JtZXJfXCJdIiwibWVybWFpZCI6eyJhdXRvU3luYyI6dHJ1ZX19): {0}\
_All queries together required ≈2 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _1.5 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "search": {
    ".meta": {
      "timing": 2
    },
    "results": [
      {
        "ids": [
          0
        ],
        "search": {
          "generator": {
            "type": "generator",
            "name": "get",
            "args": {
              "filter": {
                "name": "x"
              }
            }
          },
          "search": [
            {
              "type": "transformer",
              "name": "filter",
              "args": {
                "filter": "use"
              }
            }
          ]
        }
      }
    ]
  },
  ".meta": {
    "timing": 2
  }
}
```



</details>


<details> <summary style="color:gray">Original Code</summary>




```r
x + 1
```

<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis required _1.2 ms_ (including parse and normalize, using the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment. No [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) is mounted for these generated graphs, so `library()` calls attach no package exports; base-R names are still qualified via the generated base-package store (e.g. `acf` as `stats::acf`). 
We encountered no unknown side effects during the analysis.



```mermaid
flowchart LR
    0(["`*#91;RSymbol#93;* **x**
      *1.1* (**id: 0**)`"])
    1{{"`*#91;RNumber#93;* **1**
      *1.5* (**id: 1**)`"}}
    2[["`*#91;RBinaryOp#93;* base#58;#58;**#43;**
      *1.1-5* (**id: 2**)
    arg: (0, 1)`"]]
    built-in:_["`Built-In:
#43;`"]
    style built-in:_ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    0 -.->|"flow"| 1
    linkStyle 0 stroke:gray,color:gray;
    1 -.->|"flow"| 2
    linkStyle 1 stroke:gray,color:gray;
    2 -->|"reads, arg"| 0
    2 -->|"reads, arg"| 1
    2 -.->|"reads, calls"| built-in:_
    linkStyle 4 stroke:gray;
```

	


</details>



</details>
	



	
		

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Search Query query is `executeSearch` in [`./src/queries/catalog/search-query/search-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/search-query/search-query-executor.ts).

</details>