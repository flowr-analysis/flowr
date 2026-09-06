_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-09-05, 12:44:14 UTC (v2.15.8), do not edit directly._
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

Query: **linter** (604 ms)\
&nbsp;&nbsp;&nbsp;╰ **Deprecated Functions** (deprecated-functions): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `i_do_not_exist.csv` at 1.1-30\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0, searchTimeMs: 9, processTimeMs: 3\
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
&nbsp;&nbsp;&nbsp;╰ **Unescaped Arguments** (unescaped-arguments): _no findings_\
_All queries together required ≈604 ms (1ms accuracy, total 608 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _607.5 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.



```json
{
  "linter": {
    "results": {
      "deprecated-functions": {
        "results": [],
        ".meta": {
          "builtin": 0,
          "sigdb": 0,
          "searchTimeMs": 6,
          "processTimeMs": 260
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
          "searchTimeMs": 9,
          "processTimeMs": 3
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
          "searchTimeMs": 2,
          "processTimeMs": 0
        }
      },
      "absolute-file-paths": {
        "results": [],
        ".meta": {
          "totalConsidered": 1,
          "totalUnknown": 0,
          "searchTimeMs": 2,
          "processTimeMs": 1
        }
      },
      "unused-definitions": {
        "results": [],
        ".meta": {
          "totalConsidered": 0,
          "searchTimeMs": 0,
          "processTimeMs": 1
        }
      },
      "network-functions": {
        "results": [],
        ".meta": {
          "totalCalls": 0,
          "totalFunctionDefinitions": 0,
          "searchTimeMs": 0,
          "processTimeMs": 8
        }
      },
      "dataframe-access-validation": {
        "results": [],
        ".meta": {
          "numOperations": 0,
          "numAccesses": 0,
          "totalAccessed": 0,
          "searchTimeMs": 1,
          "processTimeMs": 5
        }
      },
      "dead-code": {
        "results": [],
        ".meta": {
          "searchTimeMs": 2,
          "processTimeMs": 0
        }
      },
      "useless-loop": {
        "results": [],
        ".meta": {
          "numOfUselessLoops": 0,
          "searchTimeMs": 0,
          "processTimeMs": 1
        }
      },
      "problematic-inputs": {
        "results": [],
        ".meta": {
          "searchTimeMs": 1,
          "processTimeMs": 0
        }
      },
      "stop-call": {
        "results": [],
        ".meta": {
          "consideredNodes": 0,
          "searchTimeMs": 1,
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
          "processTimeMs": 1
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
          "processTimeMs": 248
        }
      },
      "unused-import": {
        "results": [],
        ".meta": {
          "totalConsidered": 0,
          "totalUnresolved": 0,
          "totalMultiPackage": 0,
          "totalUnused": 0,
          "searchTimeMs": 7,
          "processTimeMs": 1
        }
      },
      "unclosed-connection": {
        "results": [],
        ".meta": {
          "totalOpened": 0,
          "totalClosed": 0,
          "searchTimeMs": 1,
          "processTimeMs": 0
        }
      },
      "unescaped-arguments": {
        "results": [],
        ".meta": {
          "totalCriticalArguments": 0,
          "totalEscapedArguments": 0,
          "searchTimeMs": 0,
          "processTimeMs": 9
        }
      }
    },
    ".meta": {
      "timing": 604
    }
  },
  ".meta": {
    "timing": 604
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

Query: **linter** (36 ms)\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `i_do_not_exist.csv` at 1.1-30\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0, searchTimeMs: 31, processTimeMs: 4\
_All queries together required ≈36 ms (1ms accuracy, total 45 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _44.6 ms_ (including parsing and normalization and the query) within the generation environment.

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
          "searchTimeMs": 31,
          "processTimeMs": 4
        }
      }
    },
    ".meta": {
      "timing": 36
    }
  },
  ".meta": {
    "timing": 36
  }
}
```



</details>





	

We welcome any feedback and suggestions for new rules on this (consider opening a [new issue](https://github.com/flowr-analysis/flowr/issues/new/choose)).
		

<details>

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the Linter Query query is `executeDependenciesQuery` in [`./src/queries/catalog/linter-query/linter-query-executor.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/linter-query/linter-query-executor.ts).

</details>