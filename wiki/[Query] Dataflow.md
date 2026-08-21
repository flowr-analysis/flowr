_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-08-20, 22:53:18 UTC (v2.14.1), please do not edit directly._
<h2 id="Dataflow Query">Dataflow Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns the dataflow graph of the given code.\
_This query is requested with the type `dataflow`._


Maybe you want to handle only the result of the query execution, or you just need the [dataflow graph](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph) again.
This query type does exactly that!

Using the example code `x + 1`, the following query returns the dataflow graph of the code:



```json
[ { "type": "dataflow" } ]
```


(This can be shortened to `@dataflow` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

Query: **dataflow** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ [Dataflow Graph](https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMChbXCJgKiM5MTtSU3ltYm9sIzkzOyogKip4KipcbiAgICAgICoxLjEqICgqKmlkOiAwKiopYFwiXSlcbiAgICAxe3tcImAqIzkxO1JOdW1iZXIjOTM7KiAqKjEqKlxuICAgICAgKjEuNSogKCoqaWQ6IDEqKilgXCJ9fVxuICAgIDJbW1wiYCojOTE7UkJpbmFyeU9wIzkzOyogYmFzZSM1ODsjNTg7KiojNDM7KipcbiAgICAgICoxLjEtNSogKCoqaWQ6IDIqKilcbiAgICBhcmc6ICgwLCAxKWBcIl1dXG4gICAgYnVpbHQtaW46X1tcImBCdWlsdC1JbjpcbiM0MztgXCJdXG4gICAgc3R5bGUgYnVpbHQtaW46XyBzdHJva2U6Z3JheSxmaWxsOmdyYXksc3Ryb2tlLXdpZHRoOjJweCxvcGFjaXR5Oi44O1xuICAgIDAgLS4tPnxcImZsb3dcInwgMVxuICAgIGxpbmtTdHlsZSAwIHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMSAtLi0+fFwiZmxvd1wifCAyXG4gICAgbGlua1N0eWxlIDEgc3Ryb2tlOmdyYXksY29sb3I6Z3JheTtcbiAgICAyIC0tPnxcInJlYWRzLCBhcmdcInwgMFxuICAgIDIgLS0+fFwicmVhZHMsIGFyZ1wifCAxXG4gICAgMiAtLi0+fFwicmVhZHMsIGNhbGxzXCJ8IGJ1aWx0LWluOl9cbiAgICBsaW5rU3R5bGUgNCBzdHJva2U6Z3JheTsiLCJtZXJtYWlkIjp7ImF1dG9TeW5jIjp0cnVlfX0=)\
_All queries together required ≈2 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _2.1 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "dataflow": {
    ".meta": {
      "timing": 2
    },
    "graph": {
      "rootVertices": [
        0,
        1,
        2
      ],
      "vertexInformation": [
        [
          0,
          {
            "tag": "use",
            "id": 0
          }
        ],
        [
          1,
          {
            "tag": "value",
            "id": 1
          }
        ],
        [
          2,
          {
            "tag": "fcall",
            "id": 2,
            "name": "+",
            "onlyBuiltin": true,
            "args": [
              {
                "nodeId": 0,
                "type": 32
              },
              {
                "nodeId": 1,
                "type": 32
              }
            ],
            "origin": [
              "builtin:d"
            ]
          }
        ]
      ],
      "edgeInformation": [
        [
          2,
          [
            [
              0,
              {
                "types": 65
              }
            ],
            [
              1,
              {
                "types": 65
              }
            ],
            [
              "built-in:+",
              {
                "types": 5
              }
            ]
          ]
        ],
        [
          0,
          [
            [
              1,
              {
                "types": 4096
              }
            ]
          ]
        ],
        [
          1,
          [
            [
              2,
              {
                "types": 4096
              }
            ]
          ]
        ]
      ],
      "_unknownSideEffects": []
    }
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

The analysis required _1.1 ms_ (including parse and normalize, using the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment. No [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) is mounted for these generated graphs, so `library()` calls attach no package exports; base-R names are still qualified via the generated base-package store (e.g. `acf` as `stats::acf`). 
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

Responsible for the execution of the Dataflow Query query is `executeDataflowQuery` in [`./src/queries/catalog/dataflow-query/dataflow-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/dataflow-query/dataflow-query-executor.ts).

</details>