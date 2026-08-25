_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-08-25, 23:19:19 UTC (v2.15.2), please do not edit directly._
<h2 id="Static Slice Query">Static Slice Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Slice the dataflow graph reducing the code to just the parts relevant for the given criteria (backward and forward).\
_This query is requested with the type `static-slice`._\
Run in the REPL: `:query @static-slice (<crit>;...)[fiIcB] <code | file://path>`


To slice, _flowR_ needs one thing from you: a variable or a list of variables (function calls are supported to, referring to the anonymous
return of the call) that you want to slice the dataflow graph for (additionally, you have to tell flowR if you want to have a forward slice).
Given this, the backward slice is essentially the subpart of the program that may influence the value of the variables you are interested in.
To specify a variable of interest, you have to present flowR with a [slicing criterion](https://github.com/flowr-analysis/flowr/wiki/Terminology#slicing-criterion) (or, respectively, an array of them).

To exemplify the capabilities, consider the following code:

```r
x <- 1
y <- 2
z <- 3
x
```

If you are interested in the parts required for the use of `x` in the last line and `z`, you can use the following query:




```json
[
  {
    "type": "static-slice",
    "criteria": [
      "3@z",
      "4@x"
    ]
  }
]
```


(This can be shortened to `@static-slice (3@z;4@x) "x <- 1\ny <- 2\nz <- 3\nx"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

x <- 1\
z <- 3\
x\
_All queries together required ≈4 ms (1ms accuracy, total 5 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _5.2 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "static-slice": {
    ".meta": {
      "timing": 4
    },
    "results": {
      "3@z,4@x": {
        "slice": {
          "timesHitThreshold": 0,
          "result": [
            6,
            9,
            0,
            2,
            1,
            8,
            7
          ],
          "slicedFor": [
            6,
            9
          ],
          "freeNames": [],
          ".meta": {
            "timing": 3
          }
        },
        "reconstruct": {
          "code": "x <- 1\nz <- 3\nx",
          "files": [
            {
              "code": "x <- 1\nz <- 3\nx"
            }
          ],
          "linesWithAutoSelected": 0,
          ".meta": {
            "timing": 1
          }
        }
      }
    }
  },
  ".meta": {
    "timing": 4
  }
}
```



</details>





	

In general, you may be uninterested in seeing the reconstructed version and want to save some computation time, for this,
you can use the `noReconstruction` flag.


<details><summary>No Reconstruction Example</summary>




```json
[
  {
    "type": "static-slice",
    "criteria": [
      "4@x"
    ],
    "noReconstruction": true
  }
]
```






_Results (prettified and summarized):_

Query: **static-slice** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ Slice "4@x" \
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Id List: {9, 0, 2, 1}\
_All queries together required ≈3 ms (1ms accuracy, total 3 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _3.4 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "static-slice": {
    ".meta": {
      "timing": 3
    },
    "results": {
      "4@x": {
        "slice": {
          "timesHitThreshold": 0,
          "result": [
            9,
            0,
            2,
            1
          ],
          "slicedFor": [
            9
          ],
          "freeNames": [],
          ".meta": {
            "timing": 3
          }
        }
      }
    }
  },
  ".meta": {
    "timing": 3
  }
}
```



</details>





	

</details>

Likewise, if you want the forward slice for the first use of `x`, you can do it like this:




```json
[
  {
    "type": "static-slice",
    "criteria": [
      "1@x"
    ],
    "direction": "forward"
  }
]
```


(This can be shortened to `@static-slice (1@x)f "x <- 1\ny <- 2\nz <- 3\nx"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

x <- 1\
x\
_All queries together required ≈2 ms (1ms accuracy, total 4 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _3.7 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "static-slice": {
    ".meta": {
      "timing": 2
    },
    "results": {
      "1@x": {
        "slice": {
          "timesHitThreshold": 0,
          "result": [
            0,
            2,
            9
          ],
          "slicedFor": [
            0
          ],
          "freeNames": [],
          ".meta": {
            "timing": 2
          }
        },
        "reconstruct": {
          "code": "x <- 1\nx",
          "files": [
            {
              "code": "x <- 1\nx"
            }
          ],
          "linesWithAutoSelected": 0,
          ".meta": {
            "timing": 0
          }
        }
      }
    }
  },
  ".meta": {
    "timing": 2
  }
}
```



</details>





	

If your program pulls in other files with `source(...)`, the `inlineSources` flag splices the reconstruction
of each resolvable sourced file into the place of its `source()` call, so the slice becomes a single
self-contained R text (cyclic or unresolvable `source()` calls are kept verbatim and reported via
`reconstruct.inlineWarnings`). With the <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span> REPL command you append an `i` to the
criteria (and may combine it with the forward `f` as `fi`), for example (with a faked `library.R` providing `greeting`):



```json
[
  {
    "type": "static-slice",
    "criteria": [
      "2@print"
    ],
    "inlineSources": true
  }
]
```


(This can be shortened to `@static-slice (2@print)i "source("library.R")\nprint(greeting)"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

greeting <- "hello"\
print(greeting)\
_All queries together required ≈212 ms (1ms accuracy, total 214 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _214.4 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "static-slice": {
    ".meta": {
      "timing": 212
    },
    "results": {
      "2@print": {
        "slice": {
          "timesHitThreshold": 0,
          "result": [
            7,
            5,
            "library.R:1:1-0",
            3,
            "library.R:1:1-2",
            "library.R:1:1-1",
            1
          ],
          "slicedFor": [
            7
          ],
          "freeNames": [],
          ".meta": {
            "timing": 211
          }
        },
        "reconstruct": {
          "code": "greeting <- \"hello\"\nprint(greeting)",
          "linesWithAutoSelected": 0,
          "inlineWarnings": [],
          ".meta": {
            "timing": 1
          }
        }
      }
    }
  },
  ".meta": {
    "timing": 212
  }
}
```



</details>





	

You can disable [magic comments](https://github.com/flowr-analysis/flowr/wiki/Interface#slice-magic-comments) using the `noMagicComments` flag.
This query replaces the old [`request-slice`](https://github.com/flowr-analysis/flowr/wiki/Interface#message-request-slice) message.
		

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Static Slice Query query is `executeStaticSliceQuery` in [`./src/queries/catalog/static-slice-query/static-slice-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/static-slice-query/static-slice-query-executor.ts).

</details>