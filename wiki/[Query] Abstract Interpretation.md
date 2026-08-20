_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-08-20, 22:53:36 UTC (v2.14.1), please do not edit directly._
<h2 id="Abstract Interpretation Query">Abstract Interpretation Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Returns the abstract values inferred for every expression or at specific locations.\
_This query is requested with the type `absint`._\
Run in the REPL: `:query @absint <inference-type> [(<criteria>)] <code | file://path>`


This query infers all shapes of dataframes within the code using abstract interpretaion. For example, you can use:



```json
[ { "type": "absint",   "inference": "df-shape" } ]
```






_Results (prettified and summarized):_

Query: **absint** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ $7: (colnames: [{"id"}, {}], cols: [1, 1], rows: [3, 3])\
&nbsp;&nbsp;&nbsp;╰ $14: (colnames: [{"id"}, {}], cols: [1, 1], rows: [0, 3])\
&nbsp;&nbsp;&nbsp;╰ $0: (colnames: [{"id"}, {}], cols: [1, 1], rows: [0, 3])\
_All queries together required ≈5 ms (1ms accuracy, total 5 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _4.6 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "absint": {
    ".meta": {
      "timing": 2
    },
    "result": {
      "0": {
        "colnames": {
          "must": [
            "id"
          ],
          "may": []
        },
        "cols": [
          1,
          1
        ],
        "rows": [
          0,
          3
        ]
      },
      "7": {
        "colnames": {
          "must": [
            "id"
          ],
          "may": []
        },
        "cols": [
          1,
          1
        ],
        "rows": [
          3,
          3
        ]
      },
      "14": {
        "colnames": {
          "must": [
            "id"
          ],
          "may": []
        },
        "cols": [
          1,
          1
        ],
        "rows": [
          0,
          3
        ]
      }
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
df <- data.frame(id = 1:3) |>
  filter(df, FALSE)
```

<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis required _2.0 ms_ (including parse and normalize, using the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment. No [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) is mounted for these generated graphs, so `library()` calls attach no package exports; base-R names are still qualified via the generated base-package store (e.g. `acf` as `stats::acf`). 
We encountered no unknown side effects during the analysis.



```mermaid
flowchart LR
    3{{"`*#91;RNumber#93;* **1**
      *1.23* (**id: 3**)`"}}
    4{{"`*#91;RNumber#93;* **3**
      *1.25* (**id: 4**)`"}}
    5[["`*#91;RBinaryOp#93;* base#58;#58;**#58;**
      *1.23-25* (**id: 5**)
    arg: (3, 4)`"]]
    built-in::["`Built-In:
#58;`"]
    style built-in:: stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    6(["`*#91;RArgument#93;* **id**
      *1.18-19* (**id: 6**)`"])
    7[["`*#91;RFunctionCall#93;* base#58;#58;**data.frame**
      *1.7-26* (**id: 7**)
    arg: (id (6))`"]]
    built-in:data.frame["`Built-In:
data.frame`"]
    style built-in:data.frame stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    10(["`*#91;RSymbol#93;* **df**
      *2.10-11* (**id: 10**)`"])
    12{{"`*#91;RLogical#93;* **FALSE**
      *2.14-18* (**id: 12**)`"}}
    14[["`*#91;RFunctionCall#93;* stats#58;#58;**filter**
      *2.3-19* (**id: 14**)
    arg: (7, 10, 12)`"]]
    built-in:filter["`Built-In:
filter`"]
    style built-in:filter stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    15[["`*#91;RPipe#93;* **|#62;**
      *1.7-2.19* (**id: 15**)
    arg: (7, 14)`"]]
    built-in:__["`Built-In:
|#62;`"]
    style built-in:__ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    0["`*#91;RSymbol#93;* **df**
      *1.1-2* (**id: 0**, v: 15)`"]
    16[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
      *1.1-2.19* (**id: 16**)
    arg: (0, 15)`"]]
    built-in:_-["`Built-In:
#60;#45;`"]
    style built-in:_- stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    3 -.->|"flow"| 4
    linkStyle 0 stroke:gray,color:gray;
    4 -.->|"flow"| 5
    linkStyle 1 stroke:gray,color:gray;
    5 -->|"reads, arg"| 3
    5 -->|"reads, arg"| 4
    5 -.->|"flow"| 6
    linkStyle 4 stroke:gray,color:gray;
    5 -.->|"reads, calls"| built-in::
    linkStyle 5 stroke:gray;
    6 -->|"reads"| 5
    6 -.->|"flow"| 7
    linkStyle 7 stroke:gray,color:gray;
    7 -->|"reads, arg"| 6
    7 -.->|"flow"| 10
    linkStyle 9 stroke:gray,color:gray;
    7 -.->|"reads, calls"| built-in:data.frame
    linkStyle 10 stroke:gray;
    10 -.->|"flow"| 12
    linkStyle 11 stroke:gray,color:gray;
    10 -->|"reads"| 7
    12 -.->|"flow"| 14
    linkStyle 13 stroke:gray,color:gray;
    14 -->|"reads, arg, non-standard-evaluation"| 10
    14 -->|"reads, arg"| 12
    14 -.->|"flow"| 15
    linkStyle 16 stroke:gray,color:gray;
    14 -->|"reads, arg"| 7
    14 -.->|"reads, calls"| built-in:filter
    linkStyle 18 stroke:gray;
    15 -->|"arg"| 7
    15 -->|"returns, arg"| 14
    15 -.->|"flow"| 0
    linkStyle 21 stroke:gray,color:gray;
    15 -.->|"reads, calls"| built-in:__
    linkStyle 22 stroke:gray;
    0 -->|"defined-by, flow"| 16
    0 -->|"defined-by"| 15
    16 -->|"reads, arg"| 15
    16 -->|"returns, arg"| 0
    16 -.->|"reads, calls"| built-in:_-
    linkStyle 27 stroke:gray;
```

	


</details>



</details>
	



	

The query optionally also accepts slice criteria to narrow the results to specific nodes. For example:



```json
[ { "type": "absint",   "inference": "df-shape",   "criteria": [ "1@df",    "1@data.frame" ] } ]
```


(This can be shortened to `@absint (1@df;1@data.frame) "df <- data.frame(id = 1:3) |>\n  filter(df, FALSE)"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

Query: **absint** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ 1@df: (colnames: [{"id"}, {}], cols: [1, 1], rows: [0, 3])\
&nbsp;&nbsp;&nbsp;╰ 1@data.frame: (colnames: [{"id"}, {}], cols: [1, 1], rows: [3, 3])\
_All queries together required ≈4 ms (1ms accuracy, total 4 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _4.3 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "absint": {
    ".meta": {
      "timing": 1
    },
    "result": [
      [
        "1@df",
        {
          "colnames": {
            "must": [
              "id"
            ],
            "may": []
          },
          "cols": [
            1,
            1
          ],
          "rows": [
            0,
            3
          ]
        }
      ],
      [
        "1@data.frame",
        {
          "colnames": {
            "must": [
              "id"
            ],
            "may": []
          },
          "cols": [
            1,
            1
          ],
          "rows": [
            3,
            3
          ]
        }
      ]
    ]
  },
  ".meta": {
    "timing": 4
  }
}
```



</details>


<details> <summary style="color:gray">Original Code</summary>




```r
df <- data.frame(id = 1:3) |>
  filter(df, FALSE)
```

<details>

<summary style="color:gray">Dataflow Graph of the R Code</summary>

The analysis required _2.1 ms_ (including parse and normalize, using the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment. No [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) is mounted for these generated graphs, so `library()` calls attach no package exports; base-R names are still qualified via the generated base-package store (e.g. `acf` as `stats::acf`). 
We encountered no unknown side effects during the analysis.



```mermaid
flowchart LR
    3{{"`*#91;RNumber#93;* **1**
      *1.23* (**id: 3**)`"}}
    4{{"`*#91;RNumber#93;* **3**
      *1.25* (**id: 4**)`"}}
    5[["`*#91;RBinaryOp#93;* base#58;#58;**#58;**
      *1.23-25* (**id: 5**)
    arg: (3, 4)`"]]
    built-in::["`Built-In:
#58;`"]
    style built-in:: stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    6(["`*#91;RArgument#93;* **id**
      *1.18-19* (**id: 6**)`"])
    7[["`*#91;RFunctionCall#93;* base#58;#58;**data.frame**
      *1.7-26* (**id: 7**)
    arg: (id (6))`"]]
    built-in:data.frame["`Built-In:
data.frame`"]
    style built-in:data.frame stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    10(["`*#91;RSymbol#93;* **df**
      *2.10-11* (**id: 10**)`"])
    12{{"`*#91;RLogical#93;* **FALSE**
      *2.14-18* (**id: 12**)`"}}
    14[["`*#91;RFunctionCall#93;* stats#58;#58;**filter**
      *2.3-19* (**id: 14**)
    arg: (7, 10, 12)`"]]
    built-in:filter["`Built-In:
filter`"]
    style built-in:filter stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    15[["`*#91;RPipe#93;* **|#62;**
      *1.7-2.19* (**id: 15**)
    arg: (7, 14)`"]]
    built-in:__["`Built-In:
|#62;`"]
    style built-in:__ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    0["`*#91;RSymbol#93;* **df**
      *1.1-2* (**id: 0**, v: 15)`"]
    16[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
      *1.1-2.19* (**id: 16**)
    arg: (0, 15)`"]]
    built-in:_-["`Built-In:
#60;#45;`"]
    style built-in:_- stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    3 -.->|"flow"| 4
    linkStyle 0 stroke:gray,color:gray;
    4 -.->|"flow"| 5
    linkStyle 1 stroke:gray,color:gray;
    5 -->|"reads, arg"| 3
    5 -->|"reads, arg"| 4
    5 -.->|"flow"| 6
    linkStyle 4 stroke:gray,color:gray;
    5 -.->|"reads, calls"| built-in::
    linkStyle 5 stroke:gray;
    6 -->|"reads"| 5
    6 -.->|"flow"| 7
    linkStyle 7 stroke:gray,color:gray;
    7 -->|"reads, arg"| 6
    7 -.->|"flow"| 10
    linkStyle 9 stroke:gray,color:gray;
    7 -.->|"reads, calls"| built-in:data.frame
    linkStyle 10 stroke:gray;
    10 -.->|"flow"| 12
    linkStyle 11 stroke:gray,color:gray;
    10 -->|"reads"| 7
    12 -.->|"flow"| 14
    linkStyle 13 stroke:gray,color:gray;
    14 -->|"reads, arg, non-standard-evaluation"| 10
    14 -->|"reads, arg"| 12
    14 -.->|"flow"| 15
    linkStyle 16 stroke:gray,color:gray;
    14 -->|"reads, arg"| 7
    14 -.->|"reads, calls"| built-in:filter
    linkStyle 18 stroke:gray;
    15 -->|"arg"| 7
    15 -->|"returns, arg"| 14
    15 -.->|"flow"| 0
    linkStyle 21 stroke:gray,color:gray;
    15 -.->|"reads, calls"| built-in:__
    linkStyle 22 stroke:gray;
    0 -->|"defined-by, flow"| 16
    0 -->|"defined-by"| 15
    16 -->|"reads, arg"| 15
    16 -->|"returns, arg"| 0
    16 -.->|"reads, calls"| built-in:_-
    linkStyle 27 stroke:gray;
```

	


</details>



</details>
	



	


<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Abstract Interpretation Query query is `executeAbsintQuery` in [`./src/queries/catalog/absint-query/absint-query-format.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/absint-query/absint-query-format.ts).

</details>