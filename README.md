[![flowR logo](https://raw.githubusercontent.com/wiki/flowr-analysis/flowr/img/flowR.png)](https://flowr-analysis.github.io/flowr/)\
[![QA (and potentially deploy)](https://github.com/flowr-analysis/flowr/actions/workflows/qa.yaml/badge.svg)](https://github.com/flowr-analysis/flowr/actions/workflows/qa.yaml)
[![codecov](https://codecov.io/gh/flowr-analysis/flowr/graph/badge.svg)](https://codecov.io/gh/flowr-analysis/flowr)
[![Docker Image Version (latest semver)](https://img.shields.io/docker/v/eagleoutice/flowr?logo=docker&logoColor=white&label=dockerhub)](https://hub.docker.com/r/eagleoutice/flowr)
[![latest tag](https://badgen.net/github/tag/flowr-analysis/flowr?label=latest&color=purple)](https://github.com/flowr-analysis/flowr/releases/latest)
[![Marketplace](https://badgen.net/vs-marketplace/v/code-inspect.vscode-flowr)](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr)
[![Marketplace](https://badgen.net/open-vsx/version/code-inspect/vscode-flowr?label=Positron/Open%20VSX)](https://open-vsx.org/extension/code-inspect/vscode-flowr)
[![DOI](https://zenodo.org/badge/624819038.svg)](https://zenodo.org/doi/10.5281/zenodo.13319290)

_flowR_ is a sophisticated, static [dataflow analyzer](https://en.wikipedia.org/wiki/Data-flow_analysis) for the [R programming language](https://www.r-project.org/),
available for [VSCode](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr), [Positron](https://open-vsx.org/extension/code-inspect/vscode-flowr), [RStudio](https://github.com/flowr-analysis/rstudio-addin-flowr),
and [Docker](https://hub.docker.com/r/eagleoutice/flowr).
It offers a wide variety of features, for example:

* 📚 **dependency analysis**\
  Given your analysis project, flowR offers a plethora of so-called [queries](https://github.com/flowr-analysis/flowr/wiki/Query-API) to get more information about your code.
  An important query is the [dependencies query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Dependencies), which shows you the library your project needs,
  the data files it reads, the scripts it sources, and the data it outputs.
  Building on it, the [guess dependency versions query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Guess-Dependency-Versions) narrows down the version range each
  of these libraries has to have, by combining the constraints your project declares with the functions your code actually calls.
  (&nbsp;[▶&nbsp;Explore in Browser](https://flowr-analysis.github.io/flowr/wiki/playground/#c=zDYSwRgTghhCeAUATADsWECUAoLBnAxlMAKYD6ALgPakC2UAHgAQA8AtIwGYCuAdvuSEo949DIyYB6RnXojsWaAHdGKlW0aIo5KADoO0GsXghEjALyMAjAC4AbABpGANyJdi5xvngBmRwA5HAHZHACZHAE5HABYMbHwSKB5VdQ4QYHJiCHglRxdgN0YAPkYQuISeABICImJTdWqSCmoZeHjiRIq8t3lcLho6OFJcbXJcFnZe-pgQXCM2xMdDRI8l4Qba2KxeLlnEJu1gNQm%2B7KhFTtdieUUIEAydfFwneEmB2CGR3EcAIleYWAeT2%2B2FQlHIrXKVUIJEQIMoIB4owh7UqJgwQA&h=deps&p=12:1 "run the dependency example in flowR's playground, no setup")&nbsp;)

  
      
    <details><summary>Example: Dependency Analysis with flowR</summary>
    
    
    The following showcases the dependency view of the [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr):
    
    ![Dependency Analysis](https://raw.githubusercontent.com/flowr-analysis/vscode-flowr/refs/heads/main/media/dependencies.png)
      
      
    
    </details> 

* 🐞 **code linting**\
   Analyze your R scripts for common issues and potential bugs (see the [wiki page](https://github.com/flowr-analysis/flowr/wiki/Linter) for more information on the currently supported linters).
   (&nbsp;[▶&nbsp;Explore in Browser](https://flowr-analysis.github.io/flowr/wiki/playground/#c=zDYSwRgTghhCeAUATADsWECUAoLBnAxlMAKYD6ALgPakC2UAHgAQA8AtIwGYCuAdvuSEo949DIyYB6RnXojsWaAHdGKlW0aIo5KADoO0GsXghEjALyMAjAC4AbABpGANyJdi5xvngBmRwA5HAHZHACZHAE5HABYMbHwSKB5VdQ4QYHJiCHglRxdgN0YAPkYQuISeABICImJTdWqSCmoZeHjiRIq8t3lcLho6OFJcbXJcFnZe-pgQXCM2xMdDRI8l4Qba2KxeLlnEJu1gNQm%2B7KhFTtdieUUIEAydfFwneEmB2CGR3EcAIleYWAeT2%2B2FQlHIrXKVUIJEQIMoIB4owh7UqJgwQA&h=lint:unused-definitions&f=deps&p=10:1 "run the linter example in flowR's playground, no setup")&nbsp;)


	    
    <details><summary>Example: Linting code with flowR</summary>
    
    To lint your code, you can use the [REPL](https://github.com/flowr-analysis/flowr/wiki/Interface#using-the-repl) or the [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr) (see [vscode-flowr#283](https://github.com/flowr-analysis/vscode-flowr/pull/283)).
    	
    
    
    ```shell
    $ docker run -it --rm eagleoutice/flowr # or npm run flowr 
    flowR repl v2.14.3, R grammar v14 (tree-sitter engine)
    R> :query @linter "read.csv(\"/root/x.txt\")"
    ```
    
    <details>
    <summary style='color:gray'>Output</summary>
    
    
    ```text
    Query: linter (14 ms)
       ╰ Deprecated Functions (deprecated-functions): no findings
       ╰ File Path Validity (file-path-validity): no findings
       ╰ Seeded Randomness (seeded-randomness): no findings
       ╰ Absolute Paths (absolute-file-paths): no findings
       ╰ Unused Definitions (unused-definitions): no findings
       ╰ Network Functions (network-functions): no findings
       ╰ Dataframe Access Validation (dataframe-access-validation): no findings
       ╰ Dead Code (dead-code): no findings
       ╰ Useless Loops (useless-loop): no findings
       ╰ Problematic inputs (problematic-inputs): no findings
       ╰ Stop without call.=False argument (stop-call): no findings
       ╰ Roxygen Arguments (roxygen-arguments): no findings
       ╰ No Leaked Credentials (no-leaked-credentials): no findings
       ╰ Undefined Symbol (undefined-symbol): no findings
       ╰ Unused Import (unused-import): no findings
       ╰ Unclosed Connection (unclosed-connection): no findings
    All queries together required ≈14 ms (1ms accuracy, total 14 ms)
    ```
    
    
    
    The linter will analyze the code and return any issues found.
    Formatted more nicely, this returns:
    
    
    
    
    ```json
    [ { "type": "linter" } ]
    ```
    
    
    (This can be shortened to `@linter` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).
    
    
    
    _Results (prettified and summarized):_
    
    Query: **linter** (9 ms)\
    &nbsp;&nbsp;&nbsp;╰ **Deprecated Functions** (deprecated-functions): _no findings_\
    &nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `/root/x.txt` at 1.1-23\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0, searchTimeMs: 1, processTimeMs: 1\
    &nbsp;&nbsp;&nbsp;╰ **Seeded Randomness** (seeded-randomness): _no findings_\
    &nbsp;&nbsp;&nbsp;╰ **Absolute Paths** (absolute-file-paths):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `/root/x.txt` at 1.1-23\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalConsidered: 1, totalUnknown: 0, searchTimeMs: 0, processTimeMs: 1\
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
    _All queries together required ≈9 ms (1ms accuracy, total 10 ms)_
    
    <details> <summary style="color:gray">Show Detailed Results as Json</summary>
    
    The analysis required _10.2 ms_ (including parsing and normalization and the query) within the generation environment.
    
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
              "searchTimeMs": 2,
              "processTimeMs": 0
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
                  23
                ],
                "filePath": "/root/x.txt",
                "certainty": "certain"
              }
            ],
            ".meta": {
              "totalReads": 1,
              "totalUnknown": 0,
              "totalWritesBeforeAlways": 0,
              "totalValid": 0,
              "searchTimeMs": 1,
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
            "results": [
              {
                "certainty": "certain",
                "filePath": "/root/x.txt",
                "loc": [
                  1,
                  1,
                  1,
                  23
                ]
              }
            ],
            ".meta": {
              "totalConsidered": 1,
              "totalUnknown": 0,
              "searchTimeMs": 0,
              "processTimeMs": 1
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
              "processTimeMs": 1
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
              "processTimeMs": 2
            }
          },
          "unused-import": {
            "results": [],
            ".meta": {
              "totalConsidered": 0,
              "totalUnresolved": 0,
              "totalMultiPackage": 0,
              "totalUnused": 0,
              "searchTimeMs": 1,
              "processTimeMs": 0
            }
          },
          "unclosed-connection": {
            "results": [],
            ".meta": {
              "totalOpened": 0,
              "totalClosed": 0,
              "searchTimeMs": 0,
              "processTimeMs": 0
            }
          }
        },
        ".meta": {
          "timing": 9
        }
      },
      ".meta": {
        "timing": 9
      }
    }
    ```
    
    
    
    </details>
    
    
    
    
    
    	
    		
    
    </details>
    
    
    	   
    	   
    
    </details>


* 🍕 **program slicing**\
   Given a point of interest like the visualization of a plot, _flowR_ reduces the program to just the parts which are relevant
   for the computation of the point of interest.
   (&nbsp;[▶&nbsp;Explore in Browser](https://flowr-analysis.github.io/flowr/wiki/playground/#c=zM4VwtgBAPAtBAMAoADgJwPYBMQGMAu0cAjIgO6EQDsiAchUUogGbqoQAUAlhJwHYREAXOxowiASnEQA3oggRQkWAvAQA1D3URSciGiy4Cy-dnwQAVD0QBfRIhwBDPOwBEAZXCCXAGhVhfLgA6vC7i9k6uAAoYpnheviaGAcGhiEA&h=slice&f=deps&v=,,d&p=11:13 "run the slicing example in flowR's playground, no setup")&nbsp;)


    
    <details><summary>Example: Slicing with flowR</summary>
    
    
    The simplest way to retrieve slices is with flowR's [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr).
    However, you can slice using the [REPL](https://github.com/flowr-analysis/flowr/wiki/Interface#using-the-repl) as well.
    This can help you if you want to reuse specific parts of an existing analysis within another context or if you want to understand
    what is happening in the code.
    
    For this, let's have a look at the example file, located at [test/testfiles/example.R](https://github.com/flowr-analysis/flowr/tree/main/test/testfiles/example.R):
    
    
    ```r
    sum <- 0
    product <- 1
    w <- 7
    N <- 10
    
    for (i in 1:(N-1)) {
      sum <- sum + i + w
      product <- product * i
    }
    
    cat("Sum:", sum, "\n")
    cat("Product:", product, "\n")
    ```
    
    
    Let's suppose we are interested only in the `sum` which is printed in line 11.
    To get a slice for this, you can use the following command:
    
    
    
    ```shell
    $ docker run -it --rm eagleoutice/flowr # or npm run flowr 
    flowR repl v2.14.3, R grammar v14 (tree-sitter engine)
    R> :query @static-slice (11@sum) file://test/testfiles/example.R
    ```
    
    <details>
    <summary style='color:gray'>Output</summary>
    
    
    ```text
    sum <- 0
    w <- 7
    N <- 10
    for(i in 1:(N-1)) sum <- sum + i + w
    sum
    All queries together required ≈6 ms (1ms accuracy, total 7 ms)
    ```
    
    
    
    
    </details>
    
    
       
       
    
    </details>

* 🚀 **fast call-graph, data-, and control-flow graphs**\
  Within just [<i><span title="This measurement is automatically fetched from the latest benchmark!">109.6 ms</span></i> (as of Aug 23, 2026)](https://flowr-analysis.github.io/flowr/wiki/stats/benchmark),
  _flowR_ can analyze the data- and control-flow of the average real-world R&nbsp;script. See the [benchmarks](https://flowr-analysis.github.io/flowr/wiki/stats/benchmark) for more information,
  and consult the [wiki pages](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph) for more details on the [dataflow graphs](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph) as well as [call graphs](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph#perspectives-cg).
  (&nbsp;[▶&nbsp;Explore in Browser](https://flowr-analysis.github.io/flowr/wiki/playground/#c=zDYSwRgTghhCeAUATADsWECUAoLBnAxlMAKYD6ALgPakC2UAHgAQA8AtIwGYCuAdvuSEo949DIyYB6RnXojsWaAHdGKlW0aIo5KADoO0GsXghEjALyMAjAC4AbABpGANyJdi5xvngBmRwA5HAHZHACZHAE5HABYMbHwSKB5VdQ4QYHJiCHglRxdgN0YAPkYQuISeABICImJTdWqSCmoZeHjiRIq8t3lcLho6OFJcbXJcFnZe-pgQXCM2xMdDRI8l4Qba2KxeLlnEJu1gNQm%2B7KhFTtdieUUIEAydfFwneEmB2CGR3EcAIleYWAeT2%2B2FQlHIrXKVUIJEQIMoIB4owh7UqJgwQA&p=13:1 "run this script in flowR's playground, no setup")&nbsp;)


    
    <details><summary>Example: Generating a dataflow graph with flowR</summary>
    
    
    You can investigate flowR's analyses using the [REPL](https://github.com/flowr-analysis/flowr/wiki/Interface#using-the-repl).
    Commands like <span title="Description (Repl Command, starred version): Returns the URL to mermaid.live; Base Command: Get mermaid code for the dataflow graph (aliases: :d*, :df*)">`:dataflow*`</span> allow you to view a [dataflow graph](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph) for a given R script.
    
    Let's have a look at the following example:
    
    
    ```r
    sum <- 0
    product <- 1
    w <- 7
    N <- 10
    
    for (i in 1:(N-1)) {
      sum <- sum + i + w
      product <- product * i
    }
    
    cat("Sum:", sum, "\n")
    cat("Product:", product, "\n")
    ```
    
    
    To get the [dataflow graph](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph) for this script, you can use the following command:
    
    
    
    ```shell
    $ docker run -it --rm eagleoutice/flowr # or npm run flowr 
    flowR repl v2.14.3, R grammar v14 (tree-sitter engine)
    R> :dataflow* test/testfiles/example.R
    ```
    
    <details>
    <summary style='color:gray'>Output</summary>
    
    
    ```text
    'test/testfiles/example.R' looks like a path, analyzing file://test/testfiles/example.R (repl.autoUseFileProtocol is set).
    https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IFREXG4gICAgMXt7XCJgKiM5MTtSTnVtYmVyIzkzOyogKiowKipcbiAgICAgICoxLjgqICgqKmlkOiAxKiopYFwifX1cbiAgICAwW1wiYCojOTE7UlN5bWJvbCM5MzsqICoqc3VtKipcbiAgICAgICoxLjEtMyogKCoqaWQ6IDAqKiwgdjogMSlgXCJdXG4gICAgMltbXCJgKiM5MTtSQmluYXJ5T3AjOTM7KiBiYXNlIzU4OyM1ODsqKiM2MDsjNDU7KipcbiAgICAgICoxLjEtOCogKCoqaWQ6IDIqKilcbiAgICBhcmc6ICgwLCAxKWBcIl1dXG4gICAgYnVpbHQtaW46Xy1bXCJgQnVpbHQtSW46XG4jNjA7IzQ1O2BcIl1cbiAgICBzdHlsZSBidWlsdC1pbjpfLSBzdHJva2U6Z3JheSxmaWxsOmdyYXksc3Ryb2tlLXdpZHRoOjJweCxvcGFjaXR5Oi44O1xuICAgIDR7e1wiYCojOTE7Uk51bWJlciM5MzsqICoqMSoqXG4gICAgICAqMi4xMiogKCoqaWQ6IDQqKilgXCJ9fVxuICAgIDNbXCJgKiM5MTtSU3ltYm9sIzkzOyogKipwcm9kdWN0KipcbiAgICAgICoyLjEtNyogKCoqaWQ6IDMqKiwgdjogNClgXCJdXG4gICAgNVtbXCJgKiM5MTtSQmluYXJ5T3AjOTM7KiBiYXNlIzU4OyM1ODsqKiM2MDsjNDU7KipcbiAgICAgICoyLjEtMTIqICgqKmlkOiA1KiopXG4gICAgYXJnOiAoMywgNClgXCJdXVxuICAgIDd7e1wiYCojOTE7Uk51bWJlciM5MzsqICoqNyoqXG4gICAgICAqMy42KiAoKippZDogNyoqKWBcIn19XG4gICAgNltcImAqIzkxO1JTeW1ib2wjOTM7KiAqKncqKlxuICAgICAgKjMuMSogKCoqaWQ6IDYqKiwgdjogNylgXCJdXG4gICAgOFtbXCJgKiM5MTtSQmluYXJ5T3AjOTM7KiBiYXNlIzU4OyM1ODsqKiM2MDsjNDU7KipcbiAgICAgICozLjEtNiogKCoqaWQ6IDgqKilcbiAgICBhcmc6ICg2LCA3KWBcIl1dXG4gICAgMTB7e1wiYCojOTE7Uk51bWJlciM5MzsqICoqMTAqKlxuICAgICAgKjQuNi03KiAoKippZDogMTAqKilgXCJ9fVxuICAgIDlbXCJgKiM5MTtSU3ltYm9sIzkzOyogKipOKipcbiAgICAgICo0LjEqICgqKmlkOiA5KiosIHY6IDEwKWBcIl1cbiAgICAxMVtbXCJgKiM5MTtSQmluYXJ5T3AjOTM7KiBiYXNlIzU4OyM1ODsqKiM2MDsjNDU7KipcbiAgICAgICo0LjEtNyogKCoqaWQ6IDExKiopXG4gICAgYXJnOiAoOSwgMTApYFwiXV1cbiAgICAxMltcImAqIzkxO1JTeW1ib2wjOTM7KiAqKmkqKlxuICAgICAgKjYuNiogKCoqaWQ6IDEyKiosIHY6IDIwKWBcIl1cbiAgICAxM3t7XCJgKiM5MTtSTnVtYmVyIzkzOyogKioxKipcbiAgICAgICo2LjExKiAoKippZDogMTMqKilgXCJ9fVxuICAgIDE2KFtcImAqIzkxO1JTeW1ib2wjOTM7KiAqKk4qKlxuICAgICAgKjYuMTQqICgqKmlkOiAxNioqKWBcIl0pXG4gICAgMTd7e1wiYCojOTE7Uk51bWJlciM5MzsqICoqMSoqXG4gICAgICAqNi4xNiogKCoqaWQ6IDE3KiopYFwifX1cbiAgICAxOFtbXCJgKiM5MTtSQmluYXJ5T3AjOTM7KiBiYXNlIzU4OyM1ODsqKiM0NTsqKlxuICAgICAgKjYuMTQtMTYqICgqKmlkOiAxOCoqKVxuICAgIGFyZzogKDE2LCAxNylgXCJdXVxuICAgIGJ1aWx0LWluOi1bXCJgQnVpbHQtSW46XG4jNDU7YFwiXVxuICAgIHN0eWxlIGJ1aWx0LWluOi0gc3Ryb2tlOmdyYXksZmlsbDpncmF5LHN0cm9rZS13aWR0aDoycHgsb3BhY2l0eTouODtcbiAgICAxOVtbXCJgKiM5MTtSRXhwcmVzc2lvbkxpc3QjOTM7KiBiYXNlIzU4OyM1ODsqKigqKlxuICAgICAgKjYuMTMqICgqKmlkOiAxOSoqKVxuICAgIGFyZzogKDE4KWBcIl1dXG4gICAgYnVpbHQtaW46X1tcImBCdWlsdC1JbjpcbihgXCJdXG4gICAgc3R5bGUgYnVpbHQtaW46XyBzdHJva2U6Z3JheSxmaWxsOmdyYXksc3Ryb2tlLXdpZHRoOjJweCxvcGFjaXR5Oi44O1xuICAgIDIwW1tcImAqIzkxO1JCaW5hcnlPcCM5MzsqIGJhc2UjNTg7IzU4OyoqIzU4OyoqXG4gICAgICAqNi4xMS0xNyogKCoqaWQ6IDIwKiopXG4gICAgYXJnOiAoMTMsIDE5KWBcIl1dXG4gICAgYnVpbHQtaW46OltcImBCdWlsdC1JbjpcbiM1ODtgXCJdXG4gICAgc3R5bGUgYnVpbHQtaW46OiBzdHJva2U6Z3JheSxmaWxsOmdyYXksc3Ryb2tlLXdpZHRoOjJweCxvcGFjaXR5Oi44O1xuICAgIDI0KFtcImAqIzkxO1JTeW1ib2wjOTM7KiAqKnN1bSoqXG4gICAgICAqNy4xMC0xMiogKCoqaWQ6IDI0KiosIDM2KylgXCJdKVxuICAgIDI1KFtcImAqIzkxO1JTeW1ib2wjOTM7KiAqKmkqKlxuICAgICAgKjcuMTYqICgqKmlkOiAyNSoqLCAzNispYFwiXSlcbiAgICAyNltbXCJgKiM5MTtSQmluYXJ5T3AjOTM7KiBiYXNlIzU4OyM1ODsqKiM0MzsqKlxuICAgICAgKjcuMTAtMTYqICgqKmlkOiAyNioqLCAzNispXG4gICAgYXJnOiAoMjQsIDI1KWBcIl1dXG4gICAgMjcoW1wiYCojOTE7UlN5bWJvbCM5MzsqICoqdyoqXG4gICAgICAqNy4yMCogKCoqaWQ6IDI3KiosIDM2KylgXCJdKVxuICAgIDI4W1tcImAqIzkxO1JCaW5hcnlPcCM5MzsqIGJhc2UjNTg7IzU4OyoqIzQzOyoqXG4gICAgICAqNy4xMC0yMCogKCoqaWQ6IDI4KiosIDM2KylcbiAgICBhcmc6ICgyNiwgMjcpYFwiXV1cbiAgICAyM1tcImAqIzkxO1JTeW1ib2wjOTM7KiAqKnN1bSoqXG4gICAgICAqNy4zLTUqICgqKmlkOiAyMyoqLCAzNissIHY6IDI4KWBcIl1cbiAgICAyOVtbXCJgKiM5MTtSQmluYXJ5T3AjOTM7KiBiYXNlIzU4OyM1ODsqKiM2MDsjNDU7KipcbiAgICAgICo3LjMtMjAqICgqKmlkOiAyOSoqLCAzNispXG4gICAgYXJnOiAoMjMsIDI4KWBcIl1dXG4gICAgMzEoW1wiYCojOTE7UlN5bWJvbCM5MzsqICoqcHJvZHVjdCoqXG4gICAgICAqOC4xNC0yMCogKCoqaWQ6IDMxKiosIDM2KylgXCJdKVxuICAgIDMyKFtcImAqIzkxO1JTeW1ib2wjOTM7KiAqKmkqKlxuICAgICAgKjguMjQqICgqKmlkOiAzMioqLCAzNispYFwiXSlcbiAgICAzM1tbXCJgKiM5MTtSQmluYXJ5T3AjOTM7KiBiYXNlIzU4OyM1ODsqKiM0MjsqKlxuICAgICAgKjguMTQtMjQqICgqKmlkOiAzMyoqLCAzNispXG4gICAgYXJnOiAoMzEsIDMyKWBcIl1dXG4gICAgMzBbXCJgKiM5MTtSU3ltYm9sIzkzOyogKipwcm9kdWN0KipcbiAgICAgICo4LjMtOSogKCoqaWQ6IDMwKiosIDM2KywgdjogMzMpYFwiXVxuICAgIDM0W1tcImAqIzkxO1JCaW5hcnlPcCM5MzsqIGJhc2UjNTg7IzU4OyoqIzYwOyM0NTsqKlxuICAgICAgKjguMy0yNCogKCoqaWQ6IDM0KiosIDM2KylcbiAgICBhcmc6ICgzMCwgMzMpYFwiXV1cbiAgICAzNVtbXCJgKiM5MTtSRXhwcmVzc2lvbkxpc3QjOTM7KiBiYXNlIzU4OyM1ODsqKiMxMjM7KipcbiAgICAgICo2LjIwKiAoKippZDogMzUqKiwgMzYrKVxuICAgIGFyZzogKDI5LCAzNClgXCJdXVxuICAgIDM2W1tcImAqIzkxO1JGb3JMb29wIzkzOyogYmFzZSM1ODsjNTg7Kipmb3IqKlxuICAgICAgKjYuMS05LjEqICgqKmlkOiAzNioqKVxuICAgIGFyZzogKDEyLCAyMCwgMzUpYFwiXV1cbiAgICBidWlsdC1pbjpmb3JbXCJgQnVpbHQtSW46XG5mb3JgXCJdXG4gICAgc3R5bGUgYnVpbHQtaW46Zm9yIHN0cm9rZTpncmF5LGZpbGw6Z3JheSxzdHJva2Utd2lkdGg6MnB4LG9wYWNpdHk6Ljg7XG4gICAgMzh7e1wiYCojOTE7UlN0cmluZyM5MzsqICoqIzM0O1N1bSM1ODsjMzQ7KipcbiAgICAgICoxMS41LTEwKiAoKippZDogMzgqKilgXCJ9fVxuICAgIDQwKFtcImAqIzkxO1JTeW1ib2wjOTM7KiAqKnN1bSoqXG4gICAgICAqMTEuMTMtMTUqICgqKmlkOiA0MCoqKWBcIl0pXG4gICAgYnVpbHQtaW46c3VtW1wiYEJ1aWx0LUluOlxuc3VtYFwiXVxuICAgIHN0eWxlIGJ1aWx0LWluOnN1bSBzdHJva2U6Z3JheSxmaWxsOmdyYXksc3Ryb2tlLXdpZHRoOjJweCxvcGFjaXR5Oi44O1xuICAgIDQye3tcImAqIzkxO1JTdHJpbmcjOTM7KiAqKiMzNDtcbiMzNDsqKlxuICAgICAgKjExLjE4LTIxKiAoKippZDogNDIqKilgXCJ9fVxuICAgIDQ0W1tcImAqIzkxO1JGdW5jdGlvbkNhbGwjOTM7KiBiYXNlIzU4OyM1ODsqKmNhdCoqXG4gICAgICAqMTEuMS0yMiogKCoqaWQ6IDQ0KiopXG4gICAgYXJnOiAoMzgsIDQwLCA0MilgXCJdXVxuICAgIGJ1aWx0LWluOmNhdFtcImBCdWlsdC1JbjpcbmNhdGBcIl1cbiAgICBzdHlsZSBidWlsdC1pbjpjYXQgc3Ryb2tlOmdyYXksZmlsbDpncmF5LHN0cm9rZS13aWR0aDoycHgsb3BhY2l0eTouODtcbiAgICA0Nnt7XCJgKiM5MTtSU3RyaW5nIzkzOyogKiojMzQ7UHJvZHVjdCM1ODsjMzQ7KipcbiAgICAgICoxMi41LTE0KiAoKippZDogNDYqKilgXCJ9fVxuICAgIDQ4KFtcImAqIzkxO1JTeW1ib2wjOTM7KiAqKnByb2R1Y3QqKlxuICAgICAgKjEyLjE3LTIzKiAoKippZDogNDgqKilgXCJdKVxuICAgIDUwe3tcImAqIzkxO1JTdHJpbmcjOTM7KiAqKiMzNDtcbiMzNDsqKlxuICAgICAgKjEyLjI2LTI5KiAoKippZDogNTAqKilgXCJ9fVxuICAgIDUyW1tcImAqIzkxO1JGdW5jdGlvbkNhbGwjOTM7KiBiYXNlIzU4OyM1ODsqKmNhdCoqXG4gICAgICAqMTIuMS0zMCogKCoqaWQ6IDUyKiopXG4gICAgYXJnOiAoNDYsIDQ4LCA1MClgXCJdXVxuICAgIDEgLS4tPnxcImZsb3dcInwgMFxuICAgIGxpbmtTdHlsZSAwIHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMCAtLT58XCJkZWZpbmVkLWJ5LCBmbG93XCJ8IDJcbiAgICAwIC0tPnxcImRlZmluZWQtYnlcInwgMVxuICAgIDIgLS0+fFwicmVhZHMsIGFyZ1wifCAxXG4gICAgMiAtLT58XCJyZXR1cm5zLCBhcmdcInwgMFxuICAgIDIgLS4tPnxcInJlYWRzLCBjYWxsc1wifCBidWlsdC1pbjpfLVxuICAgIGxpbmtTdHlsZSA1IHN0cm9rZTpncmF5O1xuICAgIDIgLS4tPnxcImZsb3dcInwgNFxuICAgIGxpbmtTdHlsZSA2IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgNCAtLi0+fFwiZmxvd1wifCAzXG4gICAgbGlua1N0eWxlIDcgc3Ryb2tlOmdyYXksY29sb3I6Z3JheTtcbiAgICAzIC0tPnxcImRlZmluZWQtYnksIGZsb3dcInwgNVxuICAgIDMgLS0+fFwiZGVmaW5lZC1ieVwifCA0XG4gICAgNSAtLT58XCJyZWFkcywgYXJnXCJ8IDRcbiAgICA1IC0tPnxcInJldHVybnMsIGFyZ1wifCAzXG4gICAgNSAtLi0+fFwicmVhZHMsIGNhbGxzXCJ8IGJ1aWx0LWluOl8tXG4gICAgbGlua1N0eWxlIDEyIHN0cm9rZTpncmF5O1xuICAgIDUgLS4tPnxcImZsb3dcInwgN1xuICAgIGxpbmtTdHlsZSAxMyBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDcgLS4tPnxcImZsb3dcInwgNlxuICAgIGxpbmtTdHlsZSAxNCBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDYgLS0+fFwiZGVmaW5lZC1ieSwgZmxvd1wifCA4XG4gICAgNiAtLT58XCJkZWZpbmVkLWJ5XCJ8IDdcbiAgICA4IC0tPnxcInJlYWRzLCBhcmdcInwgN1xuICAgIDggLS0+fFwicmV0dXJucywgYXJnXCJ8IDZcbiAgICA4IC0uLT58XCJyZWFkcywgY2FsbHNcInwgYnVpbHQtaW46Xy1cbiAgICBsaW5rU3R5bGUgMTkgc3Ryb2tlOmdyYXk7XG4gICAgOCAtLi0+fFwiZmxvd1wifCAxMFxuICAgIGxpbmtTdHlsZSAyMCBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDEwIC0uLT58XCJmbG93XCJ8IDlcbiAgICBsaW5rU3R5bGUgMjEgc3Ryb2tlOmdyYXksY29sb3I6Z3JheTtcbiAgICA5IC0tPnxcImRlZmluZWQtYnksIGZsb3dcInwgMTFcbiAgICA5IC0tPnxcImRlZmluZWQtYnlcInwgMTBcbiAgICAxMSAtLT58XCJyZWFkcywgYXJnXCJ8IDEwXG4gICAgMTEgLS0+fFwicmV0dXJucywgYXJnXCJ8IDlcbiAgICAxMSAtLi0+fFwicmVhZHMsIGNhbGxzXCJ8IGJ1aWx0LWluOl8tXG4gICAgbGlua1N0eWxlIDI2IHN0cm9rZTpncmF5O1xuICAgIDExIC0uLT58XCJmbG93XCJ8IDEzXG4gICAgbGlua1N0eWxlIDI3IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMTIgLS0+fFwiZGVmaW5lZC1ieVwifCAyMFxuICAgIDEyIC0uLT58XCJicmFuY2ggKHdoZW46IHRydWUpXCJ8IDI0XG4gICAgbGlua1N0eWxlIDI5IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMTIgLS4tPnxcImJyYW5jaCAod2hlbjogZmFsc2UpXCJ8IDM2XG4gICAgbGlua1N0eWxlIDMwIHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMTMgLS4tPnxcImZsb3dcInwgMTZcbiAgICBsaW5rU3R5bGUgMzEgc3Ryb2tlOmdyYXksY29sb3I6Z3JheTtcbiAgICAxNiAtLT58XCJyZWFkc1wifCA5XG4gICAgMTYgLS4tPnxcImZsb3dcInwgMTdcbiAgICBsaW5rU3R5bGUgMzMgc3Ryb2tlOmdyYXksY29sb3I6Z3JheTtcbiAgICAxNyAtLi0+fFwiZmxvd1wifCAxOFxuICAgIGxpbmtTdHlsZSAzNCBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDE4IC0tPnxcInJlYWRzLCBhcmdcInwgMTZcbiAgICAxOCAtLT58XCJyZWFkcywgYXJnXCJ8IDE3XG4gICAgMTggLS4tPnxcImZsb3dcInwgMTlcbiAgICBsaW5rU3R5bGUgMzcgc3Ryb2tlOmdyYXksY29sb3I6Z3JheTtcbiAgICAxOCAtLi0+fFwicmVhZHMsIGNhbGxzXCJ8IGJ1aWx0LWluOi1cbiAgICBsaW5rU3R5bGUgMzggc3Ryb2tlOmdyYXk7XG4gICAgMTkgLS0+fFwicmV0dXJucywgYXJnXCJ8IDE4XG4gICAgMTkgLS4tPnxcInJlYWRzXCJ8IGJ1aWx0LWluOl9cbiAgICBsaW5rU3R5bGUgNDAgc3Ryb2tlOmdyYXk7XG4gICAgMTkgLS4tPnxcImZsb3dcInwgMjBcbiAgICBsaW5rU3R5bGUgNDEgc3Ryb2tlOmdyYXksY29sb3I6Z3JheTtcbiAgICAyMCAtLT58XCJyZWFkcywgYXJnXCJ8IDEzXG4gICAgMjAgLS0+fFwicmVhZHMsIGFyZ1wifCAxOVxuICAgIDIwIC0uLT58XCJmbG93XCJ8IDEyXG4gICAgbGlua1N0eWxlIDQ0IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMjAgLS4tPnxcInJlYWRzLCBjYWxsc1wifCBidWlsdC1pbjo6XG4gICAgbGlua1N0eWxlIDQ1IHN0cm9rZTpncmF5O1xuICAgIDI0IC0tPnxcInJlYWRzXCJ8IDBcbiAgICAyNCAtLi0+fFwiZmxvd1wifCAyNVxuICAgIGxpbmtTdHlsZSA0NyBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDI0IC0tPnxcInJlYWRzXCJ8IDIzXG4gICAgMjUgLS0+fFwicmVhZHNcInwgMTJcbiAgICAyNSAtLi0+fFwiZmxvd1wifCAyNlxuICAgIGxpbmtTdHlsZSA1MCBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDI2IC0tPnxcInJlYWRzLCBhcmdcInwgMjRcbiAgICAyNiAtLT58XCJyZWFkcywgYXJnXCJ8IDI1XG4gICAgMjYgLS4tPnxcInJlYWRzLCBjYWxsc1wifCBidWlsdC1pbjpfXG4gICAgbGlua1N0eWxlIDUzIHN0cm9rZTpncmF5O1xuICAgIDI2IC0uLT58XCJmbG93XCJ8IDI3XG4gICAgbGlua1N0eWxlIDU0IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMjcgLS0+fFwicmVhZHNcInwgNlxuICAgIDI3IC0uLT58XCJmbG93XCJ8IDI4XG4gICAgbGlua1N0eWxlIDU2IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMjggLS0+fFwicmVhZHMsIGFyZ1wifCAyNlxuICAgIDI4IC0tPnxcInJlYWRzLCBhcmdcInwgMjdcbiAgICAyOCAtLi0+fFwiZmxvd1wifCAyM1xuICAgIGxpbmtTdHlsZSA1OSBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDI4IC0uLT58XCJyZWFkcywgY2FsbHNcInwgYnVpbHQtaW46X1xuICAgIGxpbmtTdHlsZSA2MCBzdHJva2U6Z3JheTtcbiAgICAyMyAtLT58XCJkZWZpbmVkLWJ5LCBmbG93XCJ8IDI5XG4gICAgMjMgLS0+fFwiZGVmaW5lZC1ieVwifCAyOFxuICAgIDI5IC0tPnxcInJlYWRzLCBhcmdcInwgMjhcbiAgICAyOSAtLT58XCJyZXR1cm5zLCBhcmdcInwgMjNcbiAgICAyOSAtLi0+fFwicmVhZHMsIGNhbGxzXCJ8IGJ1aWx0LWluOl8tXG4gICAgbGlua1N0eWxlIDY1IHN0cm9rZTpncmF5O1xuICAgIDI5IC0uLT58XCJmbG93XCJ8IDMxXG4gICAgbGlua1N0eWxlIDY2IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMzEgLS0+fFwicmVhZHNcInwgM1xuICAgIDMxIC0uLT58XCJmbG93XCJ8IDMyXG4gICAgbGlua1N0eWxlIDY4IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMzEgLS0+fFwicmVhZHNcInwgMzBcbiAgICAzMiAtLT58XCJyZWFkc1wifCAxMlxuICAgIDMyIC0uLT58XCJmbG93XCJ8IDMzXG4gICAgbGlua1N0eWxlIDcxIHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMzMgLS0+fFwicmVhZHMsIGFyZ1wifCAzMVxuICAgIDMzIC0tPnxcInJlYWRzLCBhcmdcInwgMzJcbiAgICAzMyAtLi0+fFwiZmxvd1wifCAzMFxuICAgIGxpbmtTdHlsZSA3NCBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDMzIC0uLT58XCJyZWFkcywgY2FsbHNcInwgYnVpbHQtaW46X1xuICAgIGxpbmtTdHlsZSA3NSBzdHJva2U6Z3JheTtcbiAgICAzMCAtLT58XCJkZWZpbmVkLWJ5LCBmbG93XCJ8IDM0XG4gICAgMzAgLS0+fFwiZGVmaW5lZC1ieVwifCAzM1xuICAgIDM0IC0tPnxcInJlYWRzLCBhcmdcInwgMzNcbiAgICAzNCAtLT58XCJyZXR1cm5zLCBhcmdcInwgMzBcbiAgICAzNCAtLi0+fFwicmVhZHMsIGNhbGxzXCJ8IGJ1aWx0LWluOl8tXG4gICAgbGlua1N0eWxlIDgwIHN0cm9rZTpncmF5O1xuICAgIDM0IC0uLT58XCJmbG93XCJ8IDM1XG4gICAgbGlua1N0eWxlIDgxIHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMzUgLS0+fFwiYXJnXCJ8IDI5XG4gICAgMzUgLS0+fFwicmV0dXJucywgYXJnXCJ8IDM0XG4gICAgMzUgLS4tPnxcInJlYWRzLCBjYWxsc1wifCBidWlsdC1pbjpfXG4gICAgbGlua1N0eWxlIDg0IHN0cm9rZTpncmF5O1xuICAgIDM1IC0uLT58XCJmbG93XCJ8IDEyXG4gICAgbGlua1N0eWxlIDg1IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgMzYgLS0+fFwiYXJnXCJ8IDEyXG4gICAgMzYgLS0+fFwicmVhZHMsIGFyZ1wifCAyMFxuICAgIDM2IC0tPnxcImFyZywgbm9uLXN0YW5kYXJkLWV2YWx1YXRpb25cInwgMzVcbiAgICAzNiAtLi0+fFwicmVhZHMsIGNhbGxzXCJ8IGJ1aWx0LWluOmZvclxuICAgIGxpbmtTdHlsZSA4OSBzdHJva2U6Z3JheTtcbiAgICAzNiAtLi0+fFwiZmxvd1wifCAzOFxuICAgIGxpbmtTdHlsZSA5MCBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDM4IC0uLT58XCJmbG93XCJ8IDQwXG4gICAgbGlua1N0eWxlIDkxIHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgNDAgLS0+fFwicmVhZHNcInwgMFxuICAgIDQwIC0tPnxcInJlYWRzXCJ8IDIzXG4gICAgNDAgLS4tPnxcInJlYWRzXCJ8IGJ1aWx0LWluOnN1bVxuICAgIGxpbmtTdHlsZSA5NCBzdHJva2U6Z3JheTtcbiAgICA0MCAtLi0+fFwiZmxvd1wifCA0MlxuICAgIGxpbmtTdHlsZSA5NSBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDQyIC0uLT58XCJmbG93XCJ8IDQ0XG4gICAgbGlua1N0eWxlIDk2IHN0cm9rZTpncmF5LGNvbG9yOmdyYXk7XG4gICAgNDQgLS0+fFwicmVhZHMsIGFyZ1wifCAzOFxuICAgIDQ0IC0tPnxcInJlYWRzLCBhcmdcInwgNDBcbiAgICA0NCAtLT58XCJyZWFkcywgYXJnXCJ8IDQyXG4gICAgNDQgLS4tPnxcInJlYWRzLCBjYWxsc1wifCBidWlsdC1pbjpjYXRcbiAgICBsaW5rU3R5bGUgMTAwIHN0cm9rZTpncmF5O1xuICAgIDQ0IC0uLT58XCJmbG93XCJ8IDQ2XG4gICAgbGlua1N0eWxlIDEwMSBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDQ2IC0uLT58XCJmbG93XCJ8IDQ4XG4gICAgbGlua1N0eWxlIDEwMiBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDQ4IC0tPnxcInJlYWRzXCJ8IDNcbiAgICA0OCAtLT58XCJyZWFkc1wifCAzMFxuICAgIDQ4IC0uLT58XCJmbG93XCJ8IDUwXG4gICAgbGlua1N0eWxlIDEwNSBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDUwIC0uLT58XCJmbG93XCJ8IDUyXG4gICAgbGlua1N0eWxlIDEwNiBzdHJva2U6Z3JheSxjb2xvcjpncmF5O1xuICAgIDUyIC0tPnxcInJlYWRzLCBhcmdcInwgNDZcbiAgICA1MiAtLT58XCJyZWFkcywgYXJnXCJ8IDQ4XG4gICAgNTIgLS0+fFwicmVhZHMsIGFyZ1wifCA1MFxuICAgIDUyIC0uLT58XCJyZWFkcywgY2FsbHNcInwgYnVpbHQtaW46Y2F0XG4gICAgbGlua1N0eWxlIDExMCBzdHJva2U6Z3JheTsiLCJtZXJtYWlkIjp7ImF1dG9TeW5jIjp0cnVlfX0=
    ```
    
    
    
    Following the link output should show the following:
    
    
    
    
    ```mermaid
    flowchart LR
        1{{"`*#91;RNumber#93;* **0**
          *1.8* (**id: 1**)`"}}
        0["`*#91;RSymbol#93;* **sum**
          *1.1-3* (**id: 0**, v: 1)`"]
        2[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
          *1.1-8* (**id: 2**)
        arg: (0, 1)`"]]
        built-in:_-["`Built-In:
    #60;#45;`"]
        style built-in:_- stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        4{{"`*#91;RNumber#93;* **1**
          *2.12* (**id: 4**)`"}}
        3["`*#91;RSymbol#93;* **product**
          *2.1-7* (**id: 3**, v: 4)`"]
        5[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
          *2.1-12* (**id: 5**)
        arg: (3, 4)`"]]
        7{{"`*#91;RNumber#93;* **7**
          *3.6* (**id: 7**)`"}}
        6["`*#91;RSymbol#93;* **w**
          *3.1* (**id: 6**, v: 7)`"]
        8[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
          *3.1-6* (**id: 8**)
        arg: (6, 7)`"]]
        10{{"`*#91;RNumber#93;* **10**
          *4.6-7* (**id: 10**)`"}}
        9["`*#91;RSymbol#93;* **N**
          *4.1* (**id: 9**, v: 10)`"]
        11[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
          *4.1-7* (**id: 11**)
        arg: (9, 10)`"]]
        12["`*#91;RSymbol#93;* **i**
          *6.6* (**id: 12**, v: 20)`"]
        13{{"`*#91;RNumber#93;* **1**
          *6.11* (**id: 13**)`"}}
        16(["`*#91;RSymbol#93;* **N**
          *6.14* (**id: 16**)`"])
        17{{"`*#91;RNumber#93;* **1**
          *6.16* (**id: 17**)`"}}
        18[["`*#91;RBinaryOp#93;* base#58;#58;**#45;**
          *6.14-16* (**id: 18**)
        arg: (16, 17)`"]]
        built-in:-["`Built-In:
    #45;`"]
        style built-in:- stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        19[["`*#91;RExpressionList#93;* base#58;#58;**(**
          *6.13* (**id: 19**)
        arg: (18)`"]]
        built-in:_["`Built-In:
    (`"]
        style built-in:_ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        20[["`*#91;RBinaryOp#93;* base#58;#58;**#58;**
          *6.11-17* (**id: 20**)
        arg: (13, 19)`"]]
        built-in::["`Built-In:
    #58;`"]
        style built-in:: stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        24(["`*#91;RSymbol#93;* **sum**
          *7.10-12* (**id: 24**, 36+)`"])
        25(["`*#91;RSymbol#93;* **i**
          *7.16* (**id: 25**, 36+)`"])
        26[["`*#91;RBinaryOp#93;* base#58;#58;**#43;**
          *7.10-16* (**id: 26**, 36+)
        arg: (24, 25)`"]]
        27(["`*#91;RSymbol#93;* **w**
          *7.20* (**id: 27**, 36+)`"])
        28[["`*#91;RBinaryOp#93;* base#58;#58;**#43;**
          *7.10-20* (**id: 28**, 36+)
        arg: (26, 27)`"]]
        23["`*#91;RSymbol#93;* **sum**
          *7.3-5* (**id: 23**, 36+, v: 28)`"]
        29[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
          *7.3-20* (**id: 29**, 36+)
        arg: (23, 28)`"]]
        31(["`*#91;RSymbol#93;* **product**
          *8.14-20* (**id: 31**, 36+)`"])
        32(["`*#91;RSymbol#93;* **i**
          *8.24* (**id: 32**, 36+)`"])
        33[["`*#91;RBinaryOp#93;* base#58;#58;**#42;**
          *8.14-24* (**id: 33**, 36+)
        arg: (31, 32)`"]]
        30["`*#91;RSymbol#93;* **product**
          *8.3-9* (**id: 30**, 36+, v: 33)`"]
        34[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
          *8.3-24* (**id: 34**, 36+)
        arg: (30, 33)`"]]
        35[["`*#91;RExpressionList#93;* base#58;#58;**#123;**
          *6.20* (**id: 35**, 36+)
        arg: (29, 34)`"]]
        36[["`*#91;RForLoop#93;* base#58;#58;**for**
          *6.1-9.1* (**id: 36**)
        arg: (12, 20, 35)`"]]
        built-in:for["`Built-In:
    for`"]
        style built-in:for stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        38{{"`*#91;RString#93;* **#34;Sum#58;#34;**
          *11.5-10* (**id: 38**)`"}}
        40(["`*#91;RSymbol#93;* **sum**
          *11.13-15* (**id: 40**)`"])
        built-in:sum["`Built-In:
    sum`"]
        style built-in:sum stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        42{{"`*#91;RString#93;* **#34;
    #34;**
          *11.18-21* (**id: 42**)`"}}
        44[["`*#91;RFunctionCall#93;* base#58;#58;**cat**
          *11.1-22* (**id: 44**)
        arg: (38, 40, 42)`"]]
        built-in:cat["`Built-In:
    cat`"]
        style built-in:cat stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        46{{"`*#91;RString#93;* **#34;Product#58;#34;**
          *12.5-14* (**id: 46**)`"}}
        48(["`*#91;RSymbol#93;* **product**
          *12.17-23* (**id: 48**)`"])
        50{{"`*#91;RString#93;* **#34;
    #34;**
          *12.26-29* (**id: 50**)`"}}
        52[["`*#91;RFunctionCall#93;* base#58;#58;**cat**
          *12.1-30* (**id: 52**)
        arg: (46, 48, 50)`"]]
        1 -.->|"flow"| 0
        linkStyle 0 stroke:gray,color:gray;
        0 -->|"defined-by, flow"| 2
        0 -->|"defined-by"| 1
        2 -->|"reads, arg"| 1
        2 -->|"returns, arg"| 0
        2 -.->|"reads, calls"| built-in:_-
        linkStyle 5 stroke:gray;
        2 -.->|"flow"| 4
        linkStyle 6 stroke:gray,color:gray;
        4 -.->|"flow"| 3
        linkStyle 7 stroke:gray,color:gray;
        3 -->|"defined-by, flow"| 5
        3 -->|"defined-by"| 4
        5 -->|"reads, arg"| 4
        5 -->|"returns, arg"| 3
        5 -.->|"reads, calls"| built-in:_-
        linkStyle 12 stroke:gray;
        5 -.->|"flow"| 7
        linkStyle 13 stroke:gray,color:gray;
        7 -.->|"flow"| 6
        linkStyle 14 stroke:gray,color:gray;
        6 -->|"defined-by, flow"| 8
        6 -->|"defined-by"| 7
        8 -->|"reads, arg"| 7
        8 -->|"returns, arg"| 6
        8 -.->|"reads, calls"| built-in:_-
        linkStyle 19 stroke:gray;
        8 -.->|"flow"| 10
        linkStyle 20 stroke:gray,color:gray;
        10 -.->|"flow"| 9
        linkStyle 21 stroke:gray,color:gray;
        9 -->|"defined-by, flow"| 11
        9 -->|"defined-by"| 10
        11 -->|"reads, arg"| 10
        11 -->|"returns, arg"| 9
        11 -.->|"reads, calls"| built-in:_-
        linkStyle 26 stroke:gray;
        11 -.->|"flow"| 13
        linkStyle 27 stroke:gray,color:gray;
        12 -->|"defined-by"| 20
        12 -.->|"branch (when: true)"| 24
        linkStyle 29 stroke:gray,color:gray;
        12 -.->|"branch (when: false)"| 36
        linkStyle 30 stroke:gray,color:gray;
        13 -.->|"flow"| 16
        linkStyle 31 stroke:gray,color:gray;
        16 -->|"reads"| 9
        16 -.->|"flow"| 17
        linkStyle 33 stroke:gray,color:gray;
        17 -.->|"flow"| 18
        linkStyle 34 stroke:gray,color:gray;
        18 -->|"reads, arg"| 16
        18 -->|"reads, arg"| 17
        18 -.->|"flow"| 19
        linkStyle 37 stroke:gray,color:gray;
        18 -.->|"reads, calls"| built-in:-
        linkStyle 38 stroke:gray;
        19 -->|"returns, arg"| 18
        19 -.->|"reads"| built-in:_
        linkStyle 40 stroke:gray;
        19 -.->|"flow"| 20
        linkStyle 41 stroke:gray,color:gray;
        20 -->|"reads, arg"| 13
        20 -->|"reads, arg"| 19
        20 -.->|"flow"| 12
        linkStyle 44 stroke:gray,color:gray;
        20 -.->|"reads, calls"| built-in::
        linkStyle 45 stroke:gray;
        24 -->|"reads"| 0
        24 -.->|"flow"| 25
        linkStyle 47 stroke:gray,color:gray;
        24 -->|"reads"| 23
        25 -->|"reads"| 12
        25 -.->|"flow"| 26
        linkStyle 50 stroke:gray,color:gray;
        26 -->|"reads, arg"| 24
        26 -->|"reads, arg"| 25
        26 -.->|"reads, calls"| built-in:_
        linkStyle 53 stroke:gray;
        26 -.->|"flow"| 27
        linkStyle 54 stroke:gray,color:gray;
        27 -->|"reads"| 6
        27 -.->|"flow"| 28
        linkStyle 56 stroke:gray,color:gray;
        28 -->|"reads, arg"| 26
        28 -->|"reads, arg"| 27
        28 -.->|"flow"| 23
        linkStyle 59 stroke:gray,color:gray;
        28 -.->|"reads, calls"| built-in:_
        linkStyle 60 stroke:gray;
        23 -->|"defined-by, flow"| 29
        23 -->|"defined-by"| 28
        29 -->|"reads, arg"| 28
        29 -->|"returns, arg"| 23
        29 -.->|"reads, calls"| built-in:_-
        linkStyle 65 stroke:gray;
        29 -.->|"flow"| 31
        linkStyle 66 stroke:gray,color:gray;
        31 -->|"reads"| 3
        31 -.->|"flow"| 32
        linkStyle 68 stroke:gray,color:gray;
        31 -->|"reads"| 30
        32 -->|"reads"| 12
        32 -.->|"flow"| 33
        linkStyle 71 stroke:gray,color:gray;
        33 -->|"reads, arg"| 31
        33 -->|"reads, arg"| 32
        33 -.->|"flow"| 30
        linkStyle 74 stroke:gray,color:gray;
        33 -.->|"reads, calls"| built-in:_
        linkStyle 75 stroke:gray;
        30 -->|"defined-by, flow"| 34
        30 -->|"defined-by"| 33
        34 -->|"reads, arg"| 33
        34 -->|"returns, arg"| 30
        34 -.->|"reads, calls"| built-in:_-
        linkStyle 80 stroke:gray;
        34 -.->|"flow"| 35
        linkStyle 81 stroke:gray,color:gray;
        35 -->|"arg"| 29
        35 -->|"returns, arg"| 34
        35 -.->|"reads, calls"| built-in:_
        linkStyle 84 stroke:gray;
        35 -.->|"flow"| 12
        linkStyle 85 stroke:gray,color:gray;
        36 -->|"arg"| 12
        36 -->|"reads, arg"| 20
        36 -->|"arg, non-standard-evaluation"| 35
        36 -.->|"reads, calls"| built-in:for
        linkStyle 89 stroke:gray;
        36 -.->|"flow"| 38
        linkStyle 90 stroke:gray,color:gray;
        38 -.->|"flow"| 40
        linkStyle 91 stroke:gray,color:gray;
        40 -->|"reads"| 0
        40 -->|"reads"| 23
        40 -.->|"reads"| built-in:sum
        linkStyle 94 stroke:gray;
        40 -.->|"flow"| 42
        linkStyle 95 stroke:gray,color:gray;
        42 -.->|"flow"| 44
        linkStyle 96 stroke:gray,color:gray;
        44 -->|"reads, arg"| 38
        44 -->|"reads, arg"| 40
        44 -->|"reads, arg"| 42
        44 -.->|"reads, calls"| built-in:cat
        linkStyle 100 stroke:gray;
        44 -.->|"flow"| 46
        linkStyle 101 stroke:gray,color:gray;
        46 -.->|"flow"| 48
        linkStyle 102 stroke:gray,color:gray;
        48 -->|"reads"| 3
        48 -->|"reads"| 30
        48 -.->|"flow"| 50
        linkStyle 105 stroke:gray,color:gray;
        50 -.->|"flow"| 52
        linkStyle 106 stroke:gray,color:gray;
        52 -->|"reads, arg"| 46
        52 -->|"reads, arg"| 48
        52 -->|"reads, arg"| 50
        52 -.->|"reads, calls"| built-in:cat
        linkStyle 110 stroke:gray;
    ```
    
    	
    (The analysis required _4.8 ms_ (including parse and normalize, using the [tree-sitter](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment. No [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) is mounted for these generated graphs, so `library()` calls attach no package exports; base-R names are still qualified via the generated base-package store (e.g. `acf` as `stats::acf`).)
    
    
    
    </details>
    
    
       
       
    
    </details>

If you want to use flowR and the features it provides, feel free to check out the:

- [Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr)/[Positron](https://open-vsx.org/extension/code-inspect/vscode-flowr): provides access to flowR directly in VS Code and Positron (or [vscode.dev](https://vscode.dev/))
- [RStudio Addin](https://github.com/flowr-analysis/rstudio-addin-flowr): integrates flowR into [RStudio](https://posit.co/downloads/)
- [R package](https://github.com/flowr-analysis/flowr-r-adapter): use flowR in your R scripts
- [Docker image](https://hub.docker.com/r/eagleoutice/flowr): run flowR in a container, this also includes [flowR's server](https://github.com/flowr-analysis/flowr/wiki/Interface#communicating-with-the-server)
- [NPM package](https://www.npmjs.com/package/@eagleoutice/flowr): include flowR in your TypeScript and JavaScript projects
 

If you are already using flowR and want to give feedback, please consider filling out our [feedback form](https://docs.google.com/forms/d/e/1FAIpQLScKFhgnh9LGVU7QzqLvFwZe1oiv_5jNhkIO-G-zND0ppqsMxQ/viewform).

 
## ⭐ Getting Started

To get started with _flowR_ and its features, please check out the [Overview](https://github.com/flowr-analysis/flowr/wiki/Overview) wiki page. 
The [Setup](https://github.com/flowr-analysis/flowr/wiki/Setup) wiki page explains how you can download and setup _flowR_ on your system. 
With docker&nbsp;🐳️, the following line should be enough (and drop you directly into the read-eval-print loop):


```shell
docker run -it --rm eagleoutice/flowr
```


You can enter <span title="Description (Repl Command): Show help information (aliases: :h, :?)">`:help`</span> to gain more information on its capabilities.

<details>

<summary>Example REPL session</summary>

![Example of a simple REPL session](wiki/gif/repl-demo-opt.gif)

If you want to use the same commands:

1. First this runs `docker run -it --rm eagleoutice/flowr` in a terminal to start the REPL.
2. In the REPL, it runs `:slicer -c '11@prod' demo.R --diff` to slice the example file `demo.R` for the print statement in line 11.
   Please note that the `11` refers to the 11th line number to slice for!

</details>

## 📜 More Information

For more details on how to use _flowR_ please refer to the [wiki pages](https://github.com/flowr-analysis/flowr/wiki),
as well as the deployed [code documentation](https://flowr-analysis.github.io/flowr/doc/).
To cite flowR, please check out the publications below. To specifically refer to the source code, 
please check out flowR's [Zenodo archive](https://zenodo.org/doi/10.5281/zenodo.13319290).

## 📃 Publications on flowR

If you are interested in the theoretical background of _flowR_,
please check out the following publications (if you find that a paper is missing here, please open [a new issue](https://github.com/flowr-analysis/flowr/issues/new/choose)):

* [Supporting the Comprehension of Data Analysis Scripts (FSE '25, Tool)](https://doi.org/10.1145/3803437.3806402)  
  This refers to an updated tool demonstration of the framework. Preprint available at <a href="https://doi.org/10.48550/arXiv.2604.15963" target="_blank">arXiv:2604.15963</a>.
  <details><summary>BibTeX</summary>
  
   
   ```bibtex
   @article{10.1145/3803437.3806402,
   	author = {Sihler, Florian and Gerstl, Oliver and Pfrenger, Lars and Schubert, Julian and Tichy, Matthias},
   	title = {Supporting the Comprehension of Data Analysis Scripts},
   	year = {2026},
   	doi = {10.1145/3803437.3806402}
   }
   ```
   
  
  </details>

* [Statically Analyzing the Dataflow of R Programs (OOPSLA '25)](https://doi.org/10.1145/3763087)  
  **Please cite this paper if you are using flowR in your research.**
  <details><summary>BibTeX</summary>
  
   
   ```bibtex
   @article{10.1145/3763087,
   	author = {Sihler, Florian and Tichy, Matthias},
   	title = {Statically Analyzing the Dataflow of R Programs},
   	year = {2025},
   	issue_date = {October 2025},
   	publisher = {Association for Computing Machinery},
   	address = {New York, NY, USA},
   	volume = {9},
   	number = {OOPSLA2},
   	url = {https://doi.org/10.1145/3763087},
   	doi = {10.1145/3763087},
   	abstract = {The R programming language is primarily designed for statistical computing and mostly used by researchers without a background in computer science. R provides a wide range of dynamic features and peculiarities that are difficult to analyze statically like dynamic scoping and lazy evaluation with dynamic side effects. At the same time, the R ecosystem lacks sophisticated analysis tools that support researchers in understanding and improving their code.   In this paper, we present a novel static dataflow analysis framework for the R programming language that is capable of handling the dynamic nature of R programs and produces the dataflow graph of given R programs. This graph can be essential in a range of analyses, including program slicing, which we implement as a proof of concept. The core analysis works as a stateful fold over a normalized version of the abstract syntax tree of the R program, which tracks (re-)definitions, values, function calls, side effects, external files, and a dynamic control flow to produce one dataflow graph per program.   We evaluate the correctness of our analysis using output equivalence testing on a manually curated dataset of 779 sensible slicing points from executable real-world R scripts. Additionally, we use a set of systematic test cases based on the capabilities of the R language and the implementation of the R interpreter and measure the runtimes well as the memory consumption on a set of 4,230 real-world R scripts and 20,815 packages available on R’s package manager CRAN.   Furthermore, we evaluate the recall of our program slicer, its accuracy using shrinking, and its improvement over the state of the art. We correctly analyze almost all programs in our equivalence test suite, preserving the identical output for 99.7\% of the manually curated slicing points. On average, we require 576ms to analyze the dataflow and around 213kB to store the graph of a research script.   This shows that our analysis is capable of analyzing real-world sources quickly and correctly. Our slicer achieves an average reduction of 84.8\% of tokens indicating its potential to improve program comprehension.},
   	journal = {Proc. ACM Program. Lang.},
   	month = oct,
   	articleno = {309},
   	numpages = {29},
   	keywords = {Dataflow Analysis, R Programming Language, Static Analysis}
   }
   ```
   
  
  </details>

* [flowR: A Static Program Slicer for R (ASE '24, Tool)](https://doi.org/10.1145/3691620.3695359)  
  This refers to the tool-demonstration of the <a href="https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr" target="_blank">VS Code Extension</a>.
  <details><summary>BibTeX</summary>
  
   
   ```bibtex
   @inproceedings{DBLP:conf/kbse/SihlerT24,
     author       = {Florian Sihler and
                     Matthias Tichy},
     editor       = {Vladimir Filkov and
                     Baishakhi Ray and
                     Minghui Zhou},
     title        = {flowR: {A} Static Program Slicer for {R}},
     booktitle    = {Proceedings of the 39th {IEEE/ACM} International Conference on Automated
                     Software Engineering, {ASE} 2024, Sacramento, CA, USA, October 27
                     - November 1, 2024},
     pages        = {2390--2393},
     publisher    = {{ACM}},
     year         = {2024},
     url          = {https://doi.org/10.1145/3691620.3695359},
     doi          = {10.1145/3691620.3695359},
     timestamp    = {Mon, 03 Mar 2025 21:16:51 +0100},
     biburl       = {https://dblp.org/rec/conf/kbse/SihlerT24.bib},
     bibsource    = {dblp computer science bibliography, https://dblp.org}
   }
   ```
   
  
  </details>

* [On the Anatomy of Real-World R Code for Static Analysis (MSR '24)](https://doi.org/10.1145/3643991.3644911)  
  This paper lays the foundation for flowR by analyzing the characteristics of real-world R code.
  <details><summary>BibTeX</summary>
  
   
   ```bibtex
   
   
   @inproceedings{DBLP:conf/msr/SihlerPSTDD24,
     author       = {Florian Sihler and
                     Lukas Pietzschmann and
                     Raphael Straub and
                     Matthias Tichy and
                     Andor Diera and
                     Abdelhalim Hafedh Dahou},
     editor       = {Diomidis Spinellis and
                     Alberto Bacchelli and
                     Eleni Constantinou},
     title        = {On the Anatomy of Real-World {R} Code for Static Analysis},
     booktitle    = {21st {IEEE/ACM} International Conference on Mining Software Repositories,
                     {MSR} 2024, Lisbon, Portugal, April 15-16, 2024},
     pages        = {619--630},
     publisher    = {{ACM}},
     year         = {2024},
     url          = {https://doi.org/10.1145/3643991.3644911},
     doi          = {10.1145/3643991.3644911},
     timestamp    = {Sun, 19 Jan 2025 13:31:27 +0100},
     biburl       = {https://dblp.org/rec/conf/msr/SihlerPSTDD24.bib},
     bibsource    = {dblp computer science bibliography, https://dblp.org}
   }
   ```
   
  
  </details>

 Works using flowR include:
[Computational Reproducibility of R Code Supplements on OSF](https://doi.org/10.36190/2025.49) and [Multi-View Structural Graph Summaries](https://doi.org/10.1109/WI-IAT62293.2024.00037).


## 🚀 Contributing

We welcome every contribution! The [developer onboarding](https://github.com/flowr-analysis/flowr/wiki/Onboarding) page has everything you need to get started.
With **R** and **Node.js** installed, `npm run setup:dev` checks your prerequisites, installs the dependencies, and configures the git hooks.
The [contributing guidelines](https://github.com/flowr-analysis/flowr/tree/main/.github/CONTRIBUTING.md) explain our commit conventions,
and [Linting and Testing](https://github.com/flowr-analysis/flowr/wiki/Linting-and-Testing) shows how to run the tests.

### Contributors

<a href="https://github.com/flowr-analysis/flowr/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=flowr-analysis/flowr"  alt="flowR Contributors"/>
</a>

----

*flowr* is actively developed by [Florian Sihler](https://eagleoutice.github.io/portfolio/) and (since October 1st 2025) [Oliver Gerstl](https://www.linkedin.com/in/oliver-gerstl) under the
[GPLv3 License](LICENSE).\
It is partially supported by the German Research Foundation (DFG) under the grant [504226141](https://gepris.dfg.de/gepris/projekt/504226141) ("CodeInspector")
and received an unrestricted gift from [Posit](https://posit.co/), the open-source data science company. 

----

### Generation Notice

Please notice that this file was generated automatically using the file [doc-readme.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/doc-readme.ts "src/documentation/doc-readme.ts") as a source.\
If you want to make changes please edit the source file (the CI will take care of the rest).
In fact, many files in the [wiki](https://github.com/flowr-analysis/flowr/wiki) are generated, so make sure to check for the source file if you want to make changes.