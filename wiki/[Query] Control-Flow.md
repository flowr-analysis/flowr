_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-08-20, 23:37:24 UTC (v2.14.1), please do not edit directly._
<h2 id="Control-Flow Query">Control-Flow Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Provides the control-flow of the program.\
_This query is requested with the type `control-flow`._


This control-flow query provides you access to the control flow graph.

In other words, if you have a script simply reading: `if(TRUE) 1 else 2`, the following query returns the CFG:



```json
[ { "type": "control-flow" } ]
```


(This can be shortened to `@control-flow` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **control-flow** (2ms)\
&nbsp;&nbsp;&nbsp;╰ CFG: https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgbjAoW1wiYFJMb2dpY2FsICgwKVxuKipUUlVFKipgXCJdKVxuICAgIG4xW1wiYFJOdW1iZXIgKDEpXG4qKjEqKmBcIl1cbiAgICBuNVtcImBSSWZUaGVuRWxzZSAoNSlcbioqaWYoVFJVRSkgMSBlbHNlIDIqKmBcIl1cbiAgICBuMCAtLT58XCJmbG93cyB0b1wifCBuMVxuICAgIG4xIC0tPnxcImZsb3dzIHRvXCJ8IG41XG4gICAgc3R5bGUgbjAgc3Ryb2tlOmN5YW4sc3Ryb2tlLXdpZHRoOjYuNXB4OyAgICBzdHlsZSBuNSBzdHJva2U6Z3JlZW4sc3Ryb2tlLXdpZHRoOjYuNXB4OyIsIm1lcm1haWQiOnsiYXV0b1N5bmMiOnRydWV9fQ==\
_All queries together required ≈2 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _2.2 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "control-flow": {
    ".meta": {
      "timing": 2
    },
    "controlFlow": {
      "graph": {
        "roots": [
          0,
          1,
          5
        ],
        "vtxInfos": [
          [
            0,
            [
              2,
              0
            ]
          ],
          [
            1,
            [
              1,
              1
            ]
          ],
          [
            5,
            [
              1,
              5
            ]
          ]
        ],
        "bbChildren": [],
        "edgeInfos": [
          [
            0,
            [
              [
                1,
                0
              ]
            ]
          ],
          [
            1,
            [
              [
                5,
                0
              ]
            ]
          ]
        ],
        "mayHaveBasicBlocks": false
      },
      "entryPoints": [
        0
      ],
      "exitPoints": [
        5
      ],
      "returns": [],
      "breaks": [],
      "nexts": []
    }
  },
  ".meta": {
    "timing": 2
  }
}
```



</details>



</details>

	

You can also overwrite the simplification passes to tune the perspective. for example, if you want to have basic blocks:



```json
[
  {
    "type": "control-flow",
    "config": {
      "simplificationPasses": [
        "unique-cf-sets",
        "to-basic-blocks"
      ]
    }
  }
]
```




 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **control-flow** (1ms)\
&nbsp;&nbsp;&nbsp;╰ CFG: https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgc3ViZ3JhcGggbmJiLTAgW0Jsb2NrIGJiLTBdXG4gICAgICAgIGRpcmVjdGlvbiBURFxuICAgIG4wKFtcImBSTG9naWNhbCAoMClcbioqVFJVRSoqYFwiXSlcbiAgICBuMVtcImBSTnVtYmVyICgxKVxuKioxKipgXCJdXG4gICAgbjAgLS0+IG4xXG4gICAgbjVbXCJgUklmVGhlbkVsc2UgKDUpXG4qKmlmKFRSVUUpIDEgZWxzZSAyKipgXCJdXG4gICAgbjEgLS0+IG41XG4gICAgZW5kXG4gICAgc3R5bGUgbmJiLTAgc3Ryb2tlOmN5YW4sc3Ryb2tlLXdpZHRoOjYuNXB4OyAgICBzdHlsZSBuYmItMCBzdHJva2U6Z3JlZW4sc3Ryb2tlLXdpZHRoOjYuNXB4OyIsIm1lcm1haWQiOnsiYXV0b1N5bmMiOnRydWV9fQ==\
_All queries together required ≈1 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _1.9 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "control-flow": {
    ".meta": {
      "timing": 1
    },
    "controlFlow": {
      "returns": [],
      "entryPoints": [
        "bb-0"
      ],
      "exitPoints": [
        "bb-0"
      ],
      "breaks": [],
      "nexts": [],
      "graph": {
        "roots": [
          "bb-0"
        ],
        "vtxInfos": [
          [
            "bb-0",
            [
              3,
              "bb-0",
              [
                [
                  2,
                  0
                ],
                [
                  1,
                  1
                ],
                [
                  1,
                  5
                ]
              ]
            ]
          ]
        ],
        "bbChildren": [
          [
            0,
            "bb-0"
          ],
          [
            1,
            "bb-0"
          ],
          [
            5,
            "bb-0"
          ]
        ],
        "edgeInfos": [],
        "mayHaveBasicBlocks": true
      }
    }
  },
  ".meta": {
    "timing": 1
  }
}
```



</details>



</details>

	

this produces: 





```mermaid
flowchart LR
    subgraph nbb-0 [Block bb-0]
        direction LR
    n0(["`RLogical (0)
**TRUE**`"])
    n1["`RNumber (1)
**1**`"]
    n0 --> n1
    n5["`RIfThenElse (5)
**if(TRUE) 1 else 2**`"]
    n1 --> n5
    end
    style nbb-0 stroke:cyan,stroke-width:6.5px;    style nbb-0 stroke:green,stroke-width:6.5px;
```

	
_(The analysis required _2.0 ms_ (including the dataflow analysis, normalization, and parsing with the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment.
We used the following simplifications: `unique-cf-sets`, `to-basic-blocks` .
	)_




If, on the other hand, you want to prune dead code edges:



```json
[
  {
    "type": "control-flow",
    "config": {
      "simplificationPasses": [
        "unique-cf-sets",
        "analyze-dead-code"
      ]
    }
  }
]
```




 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **control-flow** (2ms)\
&nbsp;&nbsp;&nbsp;╰ CFG: https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgbjAoW1wiYFJMb2dpY2FsICgwKVxuKipUUlVFKipgXCJdKVxuICAgIG4xW1wiYFJOdW1iZXIgKDEpXG4qKjEqKmBcIl1cbiAgICBuNVtcImBSSWZUaGVuRWxzZSAoNSlcbioqaWYoVFJVRSkgMSBlbHNlIDIqKmBcIl1cbiAgICBuMCAtLT58XCJmbG93cyB0b1wifCBuMVxuICAgIG4xIC0tPnxcImZsb3dzIHRvXCJ8IG41XG4gICAgc3R5bGUgbjAgc3Ryb2tlOmN5YW4sc3Ryb2tlLXdpZHRoOjYuNXB4OyAgICBzdHlsZSBuNSBzdHJva2U6Z3JlZW4sc3Ryb2tlLXdpZHRoOjYuNXB4OyIsIm1lcm1haWQiOnsiYXV0b1N5bmMiOnRydWV9fQ==\
_All queries together required ≈2 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _2.1 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "control-flow": {
    ".meta": {
      "timing": 2
    },
    "controlFlow": {
      "returns": [],
      "entryPoints": [
        0
      ],
      "exitPoints": [
        5
      ],
      "breaks": [],
      "nexts": [],
      "graph": {
        "roots": [
          0,
          1,
          5
        ],
        "vtxInfos": [
          [
            0,
            [
              2,
              0
            ]
          ],
          [
            1,
            [
              1,
              1
            ]
          ],
          [
            5,
            [
              1,
              5
            ]
          ]
        ],
        "bbChildren": [],
        "edgeInfos": [
          [
            0,
            [
              [
                1,
                0
              ]
            ]
          ],
          [
            1,
            [
              [
                5,
                0
              ]
            ]
          ]
        ],
        "mayHaveBasicBlocks": false
      }
    }
  },
  ".meta": {
    "timing": 2
  }
}
```



</details>



</details>

	

this produces:





```mermaid
flowchart LR
    n0(["`RLogical (0)
**TRUE**`"])
    n1["`RNumber (1)
**1**`"]
    n5["`RIfThenElse (5)
**if(TRUE) 1 else 2**`"]
    n0 -->|"flows to"| n1
    n1 -->|"flows to"| n5
    style n0 stroke:cyan,stroke-width:6.5px;    style n5 stroke:green,stroke-width:6.5px;
```

	
_(The analysis required _1.3 ms_ (including the dataflow analysis, normalization, and parsing with the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment.
We used the following simplifications: `unique-cf-sets`, `analyze-dead-code` .
	)_




Or, completely remove dead code:



```json
[
  {
    "type": "control-flow",
    "config": {
      "simplificationPasses": [
        "unique-cf-sets",
        "analyze-dead-code",
        "remove-dead-code"
      ]
    }
  }
]
```




 <details> <summary style="color:gray">Show Results</summary>

_Results (prettified and summarized):_

Query: **control-flow** (1ms)\
&nbsp;&nbsp;&nbsp;╰ CFG: https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgbjAoW1wiYFJMb2dpY2FsICgwKVxuKipUUlVFKipgXCJdKVxuICAgIG4xW1wiYFJOdW1iZXIgKDEpXG4qKjEqKmBcIl1cbiAgICBuNVtcImBSSWZUaGVuRWxzZSAoNSlcbioqaWYoVFJVRSkgMSBlbHNlIDIqKmBcIl1cbiAgICBuMCAtLT58XCJmbG93cyB0b1wifCBuMVxuICAgIG4xIC0tPnxcImZsb3dzIHRvXCJ8IG41XG4gICAgc3R5bGUgbjAgc3Ryb2tlOmN5YW4sc3Ryb2tlLXdpZHRoOjYuNXB4OyAgICBzdHlsZSBuNSBzdHJva2U6Z3JlZW4sc3Ryb2tlLXdpZHRoOjYuNXB4OyIsIm1lcm1haWQiOnsiYXV0b1N5bmMiOnRydWV9fQ==\
_All queries together required ≈1 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _1.8 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "control-flow": {
    ".meta": {
      "timing": 1
    },
    "controlFlow": {
      "returns": [],
      "entryPoints": [
        0
      ],
      "exitPoints": [
        5
      ],
      "breaks": [],
      "nexts": [],
      "graph": {
        "roots": [
          0,
          1,
          5
        ],
        "vtxInfos": [
          [
            0,
            [
              2,
              0
            ]
          ],
          [
            1,
            [
              1,
              1
            ]
          ],
          [
            5,
            [
              1,
              5
            ]
          ]
        ],
        "bbChildren": [],
        "edgeInfos": [
          [
            0,
            [
              [
                1,
                0
              ]
            ]
          ],
          [
            1,
            [
              [
                5,
                0
              ]
            ]
          ]
        ],
        "mayHaveBasicBlocks": false
      }
    }
  },
  ".meta": {
    "timing": 1
  }
}
```



</details>



</details>

	

this produces:





```mermaid
flowchart LR
    n0(["`RLogical (0)
**TRUE**`"])
    n1["`RNumber (1)
**1**`"]
    n5["`RIfThenElse (5)
**if(TRUE) 1 else 2**`"]
    n0 -->|"flows to"| n1
    n1 -->|"flows to"| n5
    style n0 stroke:cyan,stroke-width:6.5px;    style n5 stroke:green,stroke-width:6.5px;
```

	
_(The analysis required _1.6 ms_ (including the dataflow analysis, normalization, and parsing with the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment.
We used the following simplifications: `unique-cf-sets`, `analyze-dead-code`, `remove-dead-code` .
	)_



		

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Control-Flow Query query is `executeControlFlowQuery` in [`./src/queries/catalog/control-flow-query/control-flow-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/control-flow-query/control-flow-query-executor.ts).

</details>