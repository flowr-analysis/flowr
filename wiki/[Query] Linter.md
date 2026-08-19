_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-08-19, 15:34:34 UTC (v2.14.1), please do not edit directly._
<h2 id="Linter Query">Linter Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Lints a given R script for common issues.\
_This query is requested with the type `linter`._\
Run in the REPL: `:query @linter [rules:<r1>,<r2>,...] [format:<fmt>] <code | file://path>`


This query lints a given R script for common issues, such as missing files, unused variables, and more.

In other words, if you have a script simply reading: `read.csv("i_do_not_exist.csv")`, the following query returns all smells detected:



```json
[ { "type": "linter" } ]
```


(This can be shortened to `@linter` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

Query: **linter** (17 ms)\
&nbsp;&nbsp;&nbsp;╰ **Deprecated Functions** (deprecated-functions): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `i_do_not_exist.csv` at 1.1-30\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0, searchTimeMs: 0, processTimeMs: 1\
&nbsp;&nbsp;&nbsp;╰ **Seeded Randomness** (seeded-randomness): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Absolute Paths** (absolute-file-paths): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Unused Definitions** (unused-definitions): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Network Functions** (network-functions): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Dataframe Access Validation** (dataframe-access-validation): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Dead Code** (dead-code): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Useless Loops** (useless-loop): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Problematic inputs** (problematic-inputs): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Stop without call.=False argument** (stop-call): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Roxygen Arguments** (roxygen-arguments): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **No Leaked Credentials** (no-leaked-credentials): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Undefined Symbol** (undefined-symbol): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Unused Import** (unused-import): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Unclosed Connection** (unclosed-connection): _no findings_\
_All queries together required ≈17 ms (1ms accuracy, total 18 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _17.8 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "linter": {
    "results": {
      "deprecated-functions": {
        "results": [],
        ".meta": {
          "totalCalls": 0,
          "totalFunctionDefinitions": 0,
          "searchTimeMs": 5,
          "processTimeMs": 4
        }
      },
      "file-path-validity": {
        "results": [
          {
            "involvedId": 3,
            "loc": [
              1,
              1,
              1,
              30
            ],
            "filePath": "i_do_not_exist.csv",
            "certainty": "certain"
          }
        ],
        ".meta": {
          "totalReads": 1,
          "totalUnknown": 0,
          "totalWritesBeforeAlways": 0,
          "totalValid": 0,
          "searchTimeMs": 0,
          "processTimeMs": 1
        }
      },
      "seeded-randomness": {
        "results": [],
        ".meta": {
          "consumerCalls": 0,
          "callsWithFunctionProducers": 0,
          "callsWithAssignmentProducers": 0,
          "callsWithNonConstantProducers": 0,
          "callsWithOtherBranchProducers": 0,
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "absolute-file-paths": {
        "results": [],
        ".meta": {
          "totalConsidered": 1,
          "totalUnknown": 0,
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "unused-definitions": {
        "results": [],
        ".meta": {
          "totalConsidered": 0,
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "network-functions": {
        "results": [],
        ".meta": {
          "totalCalls": 0,
          "totalFunctionDefinitions": 0,
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "dataframe-access-validation": {
        "results": [],
        ".meta": {
          "numOperations": 0,
          "numAccesses": 0,
          "totalAccessed": 0,
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "dead-code": {
        "results": [],
        ".meta": {
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "useless-loop": {
        "results": [],
        ".meta": {
          "numOfUselessLoops": 0,
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "problematic-inputs": {
        "results": [],
        ".meta": {
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "stop-call": {
        "results": [],
        ".meta": {
          "consideredNodes": 0,
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "roxygen-arguments": {
        "results": [],
        ".meta": {
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "no-leaked-credentials": {
        "results": [],
        ".meta": {
          "totalChecked": 0,
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "undefined-symbol": {
        "results": [],
        ".meta": {
          "totalFunctionCalls": 1,
          "totalVariableUses": 0,
          "suppressed": {
            "installed": 0,
            "loadedPackage": 0,
            "enclosingScope": 0,
            "nonStandardEval": 0,
            "subscript": 0
          },
          "searchTimeMs": 0,
          "processTimeMs": 3
        }
      },
      "unused-import": {
        "results": [],
        ".meta": {
          "searchTimeMs": 0,
          "processTimeMs": 0
        }
      },
      "unclosed-connection": {
        "results": [],
        ".meta": {
          "totalOpened": 0,
          "totalClosed": 0,
          "searchTimeMs": 0,
          "processTimeMs": 1
        }
      }
    },
    ".meta": {
      "timing": 17
    }
  },
  ".meta": {
    "timing": 17
  }
}
```



</details>





	

You can also configure which rules to apply and what settings to use for these rules:



```json
[ { "type": "linter",   "rules": [ "file-path-validity" ] } ]
```


(This can be shortened to `@linter rules:file-path-validity "read.csv("i_do_not_exist.csv")"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

Query: **linter** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `i_do_not_exist.csv` at 1.1-30\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0, searchTimeMs: 6, processTimeMs: 0\
_All queries together required ≈6 ms (1ms accuracy, total 8 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _7.8 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "linter": {
    "results": {
      "file-path-validity": {
        "results": [
          {
            "involvedId": 3,
            "loc": [
              1,
              1,
              1,
              30
            ],
            "filePath": "i_do_not_exist.csv",
            "certainty": "certain"
          }
        ],
        ".meta": {
          "totalReads": 1,
          "totalUnknown": 0,
          "totalWritesBeforeAlways": 0,
          "totalValid": 0,
          "searchTimeMs": 6,
          "processTimeMs": 0
        }
      }
    },
    ".meta": {
      "timing": 6
    }
  },
  ".meta": {
    "timing": 6
  }
}
```



</details>





	

We welcome any feedback and suggestions for new rules on this (consider opening a [new issue](https://github.com/flowr-analysis/flowr/issues/new/choose)).
		

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Linter Query query is `executeDependenciesQuery` in [`./src/queries/catalog/linter-query/linter-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/linter-query/linter-query-executor.ts).

</details>