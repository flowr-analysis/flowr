[![flowR logo](https://raw.githubusercontent.com/wiki/flowr-analysis/flowr/img/flowR.png)](https://github.com/flowr-analysis/flowr/wiki)\
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

* 🐞 **code linting**\
   Analyze your R scripts for common issues and potential bugs (see the [wiki page](https://github.com/flowr-analysis/flowr/wiki/Linter) for more information on the currently supported linters).

	    
    <details><summary>Example: Linting code with flowR</summary>
    
    To lint your code, you can use the [REPL](https://github.com/flowr-analysis/flowr/wiki/Interface#using-the-repl) or the [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr) (see [vscode-flowr#283](https://github.com/flowr-analysis/vscode-flowr/pull/283)).
    	
    
    
    ```shell
    $ docker run -it --rm eagleoutice/flowr # or npm run flowr 
    flowR repl using flowR v2.9.9, R grammar v14 (tree-sitter engine)
    R> :query @linter "read.csv(\"/root/x.txt\")"
    ```
    
    <details>
    <summary style='color:gray'>Output</summary>
    
    
    ```text
    Query: linter (2 ms)
       ╰ Deprecated Functions (deprecated-functions):
           ╰ Metadata: totalCalls: 0, totalFunctionDefinitions: 0, searchTimeMs: 0, processTimeMs: 0
       ╰ File Path Validity (file-path-validity):
           ╰ certain:
               ╰ Path `/root/x.txt` at 1.1-23
           ╰ Metadata: totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0, searchTimeMs: 1, processTimeMs: 0
       ╰ Seeded Randomness (seeded-randomness):
           ╰ Metadata: consumerCalls: 0, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0, searchTimeMs: 0, processTimeMs: 0
       ╰ Absolute Paths (absolute-file-paths):
           ╰ certain:
               ╰ Path `/root/x.txt` at 1.1-23
           ╰ Metadata: totalConsidered: 1, totalUnknown: 0, searchTimeMs: 0, processTimeMs: 0
       ╰ Unused Definitions (unused-definitions):
           ╰ Metadata: totalConsidered: 0, searchTimeMs: 0, processTimeMs: 0
       ╰ Naming Convention (naming-convention):
           ╰ Metadata: numMatches: 0, numBreak: 0, searchTimeMs: 1, processTimeMs: 0
       ╰ Network Functions (network-functions):
           ╰ Metadata: totalCalls: 0, totalFunctionDefinitions: 0, searchTimeMs: 0, processTimeMs: 0
       ╰ Dataframe Access Validation (dataframe-access-validation):
           ╰ Metadata: numOperations: 0, numAccesses: 0, totalAccessed: 0, searchTimeMs: 0, processTimeMs: 0
       ╰ Dead Code (dead-code):
           ╰ Metadata: consideredNodes: 5, searchTimeMs: 0, processTimeMs: 0
       ╰ Useless Loops (useless-loop):
           ╰ Metadata: numOfUselessLoops: 0, searchTimeMs: 0, processTimeMs: 0
    All queries together required ≈2 ms (1ms accuracy, total 3 ms)
    ```
    
    
    
    The linter will analyze the code and return any issues found.
    Formatted more nicely, this returns:
    
    
    
    
    ```json
    [ { "type": "linter" } ]
    ```
    
    
    (This can be shortened to `@linter` when used with the REPL command <span title="Description (Repl Command): Query the given R code, start with 'file://' to indicate a file. The query is to be a valid query in json format (use 'help' to get more information).">`:query`</span>).
    
    
    
    _Results (prettified and summarized):_
    
    Query: **linter** (3 ms)\
    &nbsp;&nbsp;&nbsp;╰ **Deprecated Functions** (deprecated-functions):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>totalCalls: 0, totalFunctionDefinitions: 0, searchTimeMs: 0, processTimeMs: 0</code>\
    &nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `/root/x.txt` at 1.1-23\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0, searchTimeMs: 1, processTimeMs: 0</code>\
    &nbsp;&nbsp;&nbsp;╰ **Seeded Randomness** (seeded-randomness):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>consumerCalls: 0, callsWithFunctionProducers: 0, callsWithAssignmentProducers: 0, callsWithNonConstantProducers: 0, callsWithOtherBranchProducers: 0, searchTimeMs: 0, processTimeMs: 0</code>\
    &nbsp;&nbsp;&nbsp;╰ **Absolute Paths** (absolute-file-paths):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `/root/x.txt` at 1.1-23\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>totalConsidered: 1, totalUnknown: 0, searchTimeMs: 1, processTimeMs: 0</code>\
    &nbsp;&nbsp;&nbsp;╰ **Unused Definitions** (unused-definitions):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>totalConsidered: 0, searchTimeMs: 0, processTimeMs: 0</code>\
    &nbsp;&nbsp;&nbsp;╰ **Naming Convention** (naming-convention):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>numMatches: 0, numBreak: 0, searchTimeMs: 0, processTimeMs: 0</code>\
    &nbsp;&nbsp;&nbsp;╰ **Network Functions** (network-functions):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>totalCalls: 0, totalFunctionDefinitions: 0, searchTimeMs: 0, processTimeMs: 0</code>\
    &nbsp;&nbsp;&nbsp;╰ **Dataframe Access Validation** (dataframe-access-validation):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>numOperations: 0, numAccesses: 0, totalAccessed: 0, searchTimeMs: 0, processTimeMs: 1</code>\
    &nbsp;&nbsp;&nbsp;╰ **Dead Code** (dead-code):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>consideredNodes: 5, searchTimeMs: 0, processTimeMs: 0</code>\
    &nbsp;&nbsp;&nbsp;╰ **Useless Loops** (useless-loop):\
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>numOfUselessLoops: 0, searchTimeMs: 0, processTimeMs: 0</code>\
    _All queries together required ≈3 ms (1ms accuracy, total 3 ms)_
    
    <details> <summary style="color:gray">Show Detailed Results as Json</summary>
    
    The analysis required _3.0 ms_ (including parsing and normalization and the query) within the generation environment.
    
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
              "searchTimeMs": 0,
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
              "processTimeMs": 0
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
              "searchTimeMs": 1,
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
          "naming-convention": {
            "results": [],
            ".meta": {
              "numMatches": 0,
              "numBreak": 0,
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
              "consideredNodes": 5,
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
          }
        },
        ".meta": {
          "timing": 3
        }
      },
      ".meta": {
        "timing": 3
      }
    }
    ```
    
    
    
    </details>
    
    
    
    
    
    	
    		
    
    </details>
    
    
    	   
    	   
    
    </details>
        


* 🍕 **program slicing**\
   Given a point of interest like the visualization of a plot, _flowR_ reduces the program to just the parts which are relevant
   for the computation of the point of interest.

    
    <details><summary>Example: Slicing with flowR</summary>
    
    
    The simplest way to retrieve slices is with flowR's [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr). 
    However, you can slice using the [REPL](https://github.com/flowr-analysis/flowr/wiki/Interface#using-the-repl) as well.
    This can help you if you want to reuse specific parts of an existing analysis within another context or if you want to understand
    what is happening in the code.
    
    For this, let's have a look at the example file, located at [test/testfiles/example.R](https://github.com/flowr-analysis/flowr/tree/main//test/testfiles/example.R):
    
    
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
    flowR repl using flowR v2.9.9, R grammar v14 (tree-sitter engine)
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
    All queries together required ≈2 ms (1ms accuracy, total 3 ms)
    ```
    
    
    
    
    </details>
    
    
       
       
    
    </details>
        

* 📚 **dependency analysis**\
  Given your analysis project, flowR offers a plethora of so-called [queries](https://github.com/flowr-analysis/flowr/wiki/wiki/query-api) to get more information about your code.
  An important query is the [dependencies query](https://github.com/flowr-analysis/flowr/wiki/Query-API#dependencies-query), which shows you the library your project needs,
  the data files it reads, the scripts it sources, and the data it outputs.
  
      
    <details><summary>Example: Dependency Analysis with flowR</summary>
    
    
    The following showcases the dependency view of the [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr):
    
    ![Dependency Analysis](https://raw.githubusercontent.com/flowr-analysis/vscode-flowr/refs/heads/main/media/dependencies.png)
      
      
    
    </details>
         

* 🚀 **fast call-graph, data-, and control-flow graphs**\
  Within just [<i><span title="This measurement is automatically fetched from the latest benchmark!">112.3 ms</span></i> (as of Feb 9, 2026)](https://flowr-analysis.github.io/flowr/wiki/stats/benchmark), 
  _flowR_ can analyze the data- and control-flow of the average real-world R&nbsp;script. See the [benchmarks](https://flowr-analysis.github.io/flowr/wiki/stats/benchmark) for more information,
  and consult the [wiki pages](https://github.com/flowr-analysis/flowr/wiki/wiki/dataflow-graph) for more details on the [dataflow graphs](https://github.com/flowr-analysis/flowr/wiki/wiki/dataflow-graph) as well as [call graphs](https://github.com/flowr-analysis/flowr/wiki/wiki/dataflow-graph#perspectives-cg).

    
    <details><summary>Example: Generating a dataflow graph with flowR</summary>
    
    
    You can investigate flowR's analyses using the [REPL](https://github.com/flowr-analysis/flowr/wiki/Interface#using-the-repl).
    Commands like <span title="Description (Repl Command, starred version): Returns the URL to mermaid.live; Base Command: Get mermaid code for the dataflow graph, start with 'file://' to indicate a file (aliases: :d*, :df*)">`:dataflow*`</span> allow you to view a [dataflow graph](https://github.com/flowr-analysis/flowr/wiki/wiki/dataflow-graph) for a given R script.
    
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
    
    
    To get the [dataflow graph](https://github.com/flowr-analysis/flowr/wiki/wiki/dataflow-graph) for this script, you can use the following command:
    
    
    
    ```shell
    $ docker run -it --rm eagleoutice/flowr # or npm run flowr 
    flowR repl using flowR v2.9.9, R grammar v14 (tree-sitter engine)
    R> :dataflow* test/testfiles/example.R
    ```
    
    <details>
    <summary style='color:gray'>Output</summary>
    
    
    ```text
    https://mermaid.live/view#base64:eyJjb2RlIjoiZmxvd2NoYXJ0IEJUXG4gICAgMChbXCJgIzkxO1JTeW1ib2wjOTM7IHRlc3RcbiAgICAgICgwKVxuICAgICAgKjEuMS00KmBcIl0pXG4gICAgMShbXCJgIzkxO1JTeW1ib2wjOTM7IHRlc3RmaWxlc1xuICAgICAgKDEpXG4gICAgICAqMS42LTE0KmBcIl0pXG4gICAgMltbXCJgIzkxO1JCaW5hcnlPcCM5MzsgL1xuICAgICAgKDIpXG4gICAgICAqMS4xLTE0KlxuICAgICgwLCAxKWBcIl1dXG4gICAgYnVpbHQtaW46X1tcImBCdWlsdC1Jbjpcbi9gXCJdXG4gICAgc3R5bGUgYnVpbHQtaW46XyBzdHJva2U6Z3JheSxmaWxsOmdyYXksc3Ryb2tlLXdpZHRoOjJweCxvcGFjaXR5Oi44O1xuICAgIDMoW1wiYCM5MTtSU3ltYm9sIzkzOyBleGFtcGxlLlJcbiAgICAgICgzKVxuICAgICAgKjEuMTYtMjQqYFwiXSlcbiAgICA0W1tcImAjOTE7UkJpbmFyeU9wIzkzOyAvXG4gICAgICAoNClcbiAgICAgICoxLjEtMjQqXG4gICAgKDIsIDMpYFwiXV1cbiAgICAyIC0tPnxcInJlYWRzLCBhcmd1bWVudFwifCAwXG4gICAgMiAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgMVxuICAgIDIgLS4tPnxcInJlYWRzLCBjYWxsc1wifCBidWlsdC1pbjpfXG4gICAgbGlua1N0eWxlIDIgc3Ryb2tlOmdyYXk7XG4gICAgNCAtLT58XCJyZWFkcywgYXJndW1lbnRcInwgMlxuICAgIDQgLS0+fFwicmVhZHMsIGFyZ3VtZW50XCJ8IDNcbiAgICA0IC0uLT58XCJyZWFkcywgY2FsbHNcInwgYnVpbHQtaW46X1xuICAgIGxpbmtTdHlsZSA1IHN0cm9rZTpncmF5OyIsIm1lcm1haWQiOnsiYXV0b1N5bmMiOnRydWV9fQ==
    ```
    
    
    
    Following the link output should show the following:
    
    
    
    
    ```mermaid
    flowchart LR
        1{{"`#91;RNumber#93; 0
          (1)
          *1.8*`"}}
        0["`#91;RSymbol#93; sum
          (0)
          *1.1-3*`"]
        2[["`#91;RBinaryOp#93; #60;#45;
          (2)
          *1.1-8*
        (0, 1)`"]]
        built-in:_-["`Built-In:
    #60;#45;`"]
        style built-in:_- stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        4{{"`#91;RNumber#93; 1
          (4)
          *2.12*`"}}
        3["`#91;RSymbol#93; product
          (3)
          *2.1-7*`"]
        5[["`#91;RBinaryOp#93; #60;#45;
          (5)
          *2.1-12*
        (3, 4)`"]]
        7{{"`#91;RNumber#93; 7
          (7)
          *3.6*`"}}
        6["`#91;RSymbol#93; w
          (6)
          *3.1*`"]
        8[["`#91;RBinaryOp#93; #60;#45;
          (8)
          *3.1-6*
        (6, 7)`"]]
        10{{"`#91;RNumber#93; 10
          (10)
          *4.6-7*`"}}
        9["`#91;RSymbol#93; N
          (9)
          *4.1*`"]
        11[["`#91;RBinaryOp#93; #60;#45;
          (11)
          *4.1-7*
        (9, 10)`"]]
        12["`#91;RSymbol#93; i
          (12)
          *6.6*`"]
        13{{"`#91;RNumber#93; 1
          (13)
          *6.11*`"}}
        16(["`#91;RSymbol#93; N
          (16)
          *6.14*`"])
        17{{"`#91;RNumber#93; 1
          (17)
          *6.16*`"}}
        18[["`#91;RBinaryOp#93; #45;
          (18)
          *6.14-16*
        (16, 17)`"]]
        built-in:-["`Built-In:
    #45;`"]
        style built-in:- stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        19[["`#91;RExpressionList#93; (
          (19)
          *6.13*
        (18)`"]]
        built-in:_["`Built-In:
    (`"]
        style built-in:_ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        20[["`#91;RBinaryOp#93; #58;
          (20)
          *6.11-17*
        (13, 19)`"]]
        built-in::["`Built-In:
    #58;`"]
        style built-in:: stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        24(["`#91;RSymbol#93; sum
          (24, :may:36+)
          *7.10-12*`"])
        built-in:sum["`Built-In:
    sum`"]
        style built-in:sum stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        25(["`#91;RSymbol#93; i
          (25, :may:36+)
          *7.16*`"])
        26[["`#91;RBinaryOp#93; #43;
          (26, :may:36+)
          *7.10-16*
        (24, 25)`"]]
        27(["`#91;RSymbol#93; w
          (27, :may:36+)
          *7.20*`"])
        28[["`#91;RBinaryOp#93; #43;
          (28, :may:36+)
          *7.10-20*
        (26, 27)`"]]
        23["`#91;RSymbol#93; sum
          (23, :may:36+)
          *7.3-5*`"]
        29[["`#91;RBinaryOp#93; #60;#45;
          (29, :may:36+)
          *7.3-20*
        (23, 28)`"]]
        31(["`#91;RSymbol#93; product
          (31, :may:36+)
          *8.14-20*`"])
        32(["`#91;RSymbol#93; i
          (32, :may:36+)
          *8.24*`"])
        33[["`#91;RBinaryOp#93; #42;
          (33, :may:36+)
          *8.14-24*
        (31, 32)`"]]
        30["`#91;RSymbol#93; product
          (30, :may:36+)
          *8.3-9*`"]
        34[["`#91;RBinaryOp#93; #60;#45;
          (34, :may:36+)
          *8.3-24*
        (30, 33)`"]]
        35[["`#91;RExpressionList#93; #123;
          (35, :may:36+)
          *6.20*
        (29, 34)`"]]
        36[["`#91;RForLoop#93; for
          (36)
          *6.1-9.1*
        (12, 20, 35)`"]]
        built-in:for["`Built-In:
    for`"]
        style built-in:for stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        38{{"`#91;RString#93; #34;Sum#58;#34;
          (38)
          *11.5-10*`"}}
        40(["`#91;RSymbol#93; sum
          (40)
          *11.13-15*`"])
        42{{"`#91;RString#93; #34;
    #34;
          (42)
          *11.18-21*`"}}
        44[["`#91;RFunctionCall#93; cat
          (44)
          *11.1-22*
        (38, 40, 42)`"]]
        built-in:cat["`Built-In:
    cat`"]
        style built-in:cat stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
        46{{"`#91;RString#93; #34;Product#58;#34;
          (46)
          *12.5-14*`"}}
        48(["`#91;RSymbol#93; product
          (48)
          *12.17-23*`"])
        50{{"`#91;RString#93; #34;
    #34;
          (50)
          *12.26-29*`"}}
        52[["`#91;RFunctionCall#93; cat
          (52)
          *12.1-30*
        (46, 48, 50)`"]]
        0 -->|"defined-by"| 1
        0 -->|"defined-by"| 2
        2 -->|"reads, argument"| 1
        2 -->|"returns, argument"| 0
        2 -.->|"reads, calls"| built-in:_-
        linkStyle 4 stroke:gray;
        3 -->|"defined-by"| 4
        3 -->|"defined-by"| 5
        5 -->|"reads, argument"| 4
        5 -->|"returns, argument"| 3
        5 -.->|"reads, calls"| built-in:_-
        linkStyle 9 stroke:gray;
        6 -->|"defined-by"| 7
        6 -->|"defined-by"| 8
        8 -->|"reads, argument"| 7
        8 -->|"returns, argument"| 6
        8 -.->|"reads, calls"| built-in:_-
        linkStyle 14 stroke:gray;
        9 -->|"defined-by"| 10
        9 -->|"defined-by"| 11
        11 -->|"reads, argument"| 10
        11 -->|"returns, argument"| 9
        11 -.->|"reads, calls"| built-in:_-
        linkStyle 19 stroke:gray;
        12 -->|"defined-by"| 20
        16 -->|"reads"| 9
        18 -->|"reads, argument"| 16
        18 -->|"reads, argument"| 17
        18 -.->|"reads, calls"| built-in:-
        linkStyle 24 stroke:gray;
        19 -->|"returns, argument"| 18
        19 -.->|"reads"| built-in:_
        linkStyle 26 stroke:gray;
        20 -->|"reads, argument"| 13
        20 -->|"reads, argument"| 19
        20 -.->|"reads, calls"| built-in::
        linkStyle 29 stroke:gray;
        24 -->|"reads"| 0
        24 -->|"reads"| 23
        24 -.->|"reads"| built-in:sum
        linkStyle 32 stroke:gray;
        24 -->|"CD-True"| 36
        linkStyle 33 stroke:gray,color:gray;
        25 -->|"reads"| 12
        25 -->|"CD-True"| 36
        linkStyle 35 stroke:gray,color:gray;
        26 -->|"reads, argument"| 24
        26 -->|"reads, argument"| 25
        26 -.->|"reads, calls"| built-in:_
        linkStyle 38 stroke:gray;
        26 -->|"CD-True"| 36
        linkStyle 39 stroke:gray,color:gray;
        27 -->|"reads"| 6
        27 -->|"CD-True"| 36
        linkStyle 41 stroke:gray,color:gray;
        28 -->|"reads, argument"| 26
        28 -->|"reads, argument"| 27
        28 -.->|"reads, calls"| built-in:_
        linkStyle 44 stroke:gray;
        28 -->|"CD-True"| 36
        linkStyle 45 stroke:gray,color:gray;
        23 -->|"defined-by"| 28
        23 -->|"defined-by"| 29
        23 -->|"CD-True"| 36
        linkStyle 48 stroke:gray,color:gray;
        29 -->|"reads, argument"| 28
        29 -->|"returns, argument"| 23
        29 -.->|"reads, calls"| built-in:_-
        linkStyle 51 stroke:gray;
        29 -->|"CD-True"| 36
        linkStyle 52 stroke:gray,color:gray;
        31 -->|"reads"| 3
        31 -->|"reads"| 30
        31 -->|"CD-True"| 36
        linkStyle 55 stroke:gray,color:gray;
        32 -->|"reads"| 12
        32 -->|"CD-True"| 36
        linkStyle 57 stroke:gray,color:gray;
        33 -->|"reads, argument"| 31
        33 -->|"reads, argument"| 32
        33 -.->|"reads, calls"| built-in:_
        linkStyle 60 stroke:gray;
        33 -->|"CD-True"| 36
        linkStyle 61 stroke:gray,color:gray;
        30 -->|"defined-by"| 33
        30 -->|"defined-by"| 34
        30 -->|"CD-True"| 36
        linkStyle 64 stroke:gray,color:gray;
        34 -->|"reads, argument"| 33
        34 -->|"returns, argument"| 30
        34 -.->|"reads, calls"| built-in:_-
        linkStyle 67 stroke:gray;
        34 -->|"CD-True"| 36
        linkStyle 68 stroke:gray,color:gray;
        35 -->|"argument"| 29
        35 -->|"returns, argument"| 34
        35 -.->|"reads, calls"| built-in:_
        linkStyle 71 stroke:gray;
        35 -->|"CD-True"| 36
        linkStyle 72 stroke:gray,color:gray;
        36 -->|"argument"| 12
        36 -->|"reads, argument"| 20
        36 -->|"argument, non-standard-evaluation"| 35
        36 -.->|"reads, calls"| built-in:for
        linkStyle 76 stroke:gray;
        40 -->|"reads"| 0
        40 -->|"reads"| 23
        40 -.->|"reads"| built-in:sum
        linkStyle 79 stroke:gray;
        44 -->|"argument"| 38
        44 -->|"reads, argument"| 40
        44 -->|"argument"| 42
        44 -.->|"reads, calls"| built-in:cat
        linkStyle 83 stroke:gray;
        48 -->|"reads"| 3
        48 -->|"reads"| 30
        52 -->|"argument"| 46
        52 -->|"reads, argument"| 48
        52 -->|"argument"| 50
        52 -.->|"reads, calls"| built-in:cat
        linkStyle 89 stroke:gray;
    ```
    
    	
    (The analysis required _1.8 ms_ (including parse and normalize, using the [tree-sitter](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) within the generation environment.)
    
    
    
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

To get started with _flowR_ and its features, please check out the [Overview](https://github.com/flowr-analysis/flowr/wiki/wiki/overview) wiki page. 
The [Setup](https://github.com/flowr-analysis/flowr/wiki/wiki/setup) wiki page explains how you can download and setup _flowR_ on your system. 
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
as well as the deployed [code documentation](https://flowr-analysis.github.io/flowr/docs).
To cite flowR, please check out the publications below. To specifically refer to the source code, 
please check out flowR's [Zenodo archive](https://zenodo.org/doi/10.5281/zenodo.13319290).

## 📃 Publications on flowR

If you are interested in the theoretical background of _flowR_,
please check out the following publications (if you find that a paper is missing here, please open [a new issue](https://github.com/flowr-analysis/flowr/issues/new/choose)):

* [Statically Analyzing the Dataflow of R Programs (OOPSLA '25)](https://doi.org/10.1145/3763087)  
  Please cite this paper if you are using flowR in your research.
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
  This refers to the tool-demonstration of the <a href="https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr">VS Code Extension</a>.
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

We welcome every contribution! Please check out the [developer onboarding](https://github.com/flowr-analysis/flowr/wiki/wiki/onboarding) section in the wiki for all the information you will need.

### Contributors

<a href="https://github.com/flowr-analysis/flowr/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=flowr-analysis/flowr"  alt="flowR Contributors"/>
</a>

----

*flowr* is actively developed by [Florian Sihler](https://eagleoutice.github.io/portfolio/) and (since October 1st 2025) [Oliver Gerstl](https://www.linkedin.com/in/oliver-gerstl) under the
[GPLv3 License](LICENSE).\
It is partially supported by the German Research Foundation (DFG) under the grant [504226141](https://gepris.dfg.de/gepris/projekt/504226141) ("CodeInspector").

----

### Generation Notice

Please notice that this file was generated automatically using the file [src/documentation/doc-readme.ts](https://github.com/flowr-analysis/flowr/tree/main//src/documentation/doc-readme.ts) as a source.\
If you want to make changes please edit the source file (the CI will take care of the rest).
In fact, many files in the [wiki](https://github.com/flowr-analysis/flowr/wiki) are generated, so make sure to check for the source file if you want to make changes.