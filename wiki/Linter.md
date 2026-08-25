_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-08-25, 14:06:34 UTC (v2.14.4, R v4.6.1), please do not edit directly._

This page describes the flowR linter, which is a tool that utilizes flowR's dataflow analysis to find common issues in R scripts. The linter can currently be used through the linter [query](https://github.com/flowr-analysis/flowr/wiki/Query-API).
Some rules also draw on the [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database).
For example:



```shell
$ docker run -it --rm eagleoutice/flowr # or npm run flowr 
flowR repl v2.14.4, R grammar v14 (tree-sitter engine)
R> :query @linter "read.csv(\"/root/x.txt\")"
```

<details>
<summary style='color:gray'>Output</summary>


```text
Query: linter (39 ms)
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
   ╰ Unescaped Arguments (unescaped-arguments): no findings
All queries together required ≈39 ms (1ms accuracy, total 40 ms)
```



The linter will analyze the code and return any issues found.
Formatted more nicely, this returns:




```json
[ { "type": "linter" } ]
```


(This can be shortened to `@linter` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).



_Results (prettified and summarized):_

Query: **linter** (227 ms)\
&nbsp;&nbsp;&nbsp;╰ **Deprecated Functions** (deprecated-functions): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `/root/x.txt` at 1.1-23\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalReads: 1, totalUnknown: 0, totalWritesBeforeAlways: 0, totalValid: 0, searchTimeMs: 4, processTimeMs: 10\
&nbsp;&nbsp;&nbsp;╰ **Seeded Randomness** (seeded-randomness): _no findings_\
&nbsp;&nbsp;&nbsp;╰ **Absolute Paths** (absolute-file-paths):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `/root/x.txt` at 1.1-23\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalConsidered: 1, totalUnknown: 0, searchTimeMs: 1, processTimeMs: 1\
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
_All queries together required ≈227 ms (1ms accuracy, total 228 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _227.7 ms_ (including parsing and normalization and the query) within the generation environment.

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
          "processTimeMs": 162
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
          "searchTimeMs": 4,
          "processTimeMs": 10
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
          "searchTimeMs": 1,
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
          "searchTimeMs": 5,
          "processTimeMs": 1
        }
      },
      "dataframe-access-validation": {
        "results": [],
        ".meta": {
          "numOperations": 0,
          "numAccesses": 0,
          "totalAccessed": 0,
          "searchTimeMs": 0,
          "processTimeMs": 3
        }
      },
      "dead-code": {
        "results": [],
        ".meta": {
          "searchTimeMs": 1,
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
          "processTimeMs": 1
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
          "processTimeMs": 26
        }
      },
      "unused-import": {
        "results": [],
        ".meta": {
          "totalConsidered": 0,
          "totalUnresolved": 0,
          "totalMultiPackage": 0,
          "totalUnused": 0,
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
      },
      "unescaped-arguments": {
        "results": [],
        ".meta": {
          "totalCriticalArguments": 0,
          "totalEscapedArguments": 0,
          "searchTimeMs": 0,
          "processTimeMs": 4
        }
      }
    },
    ".meta": {
      "timing": 227
    }
  },
  ".meta": {
    "timing": 227
  }
}
```



</details>





	
		

</details>



<h2 id="linting-rules">Linting Rules</h2>


> [!NOTE]
> If you want to add a new linting rule, see [Create Linting Rules](https://github.com/flowr-analysis/flowr/wiki/Create-Linting-Rules).


The following linting rules are available:



**[Absolute Paths](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Absolute%20File%20Paths):** Checks whether file paths are absolute. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/absolute-path.ts#L137">src/linter/rules/absolute-path.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

**[Dataframe Access Validation](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Dataframe%20Access%20Validation):** Validates the existence of accessed columns and rows of dataframes. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/dataframe-access-validation.ts#L58">src/linter/rules/dataframe-access-validation.ts</a>]\
	<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

**[Dead Code](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Dead%20Code):** Marks areas of code that are never reached during execution. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/dead-code.ts#L29">src/linter/rules/dead-code.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

**[Deprecated Functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Deprecated%20Functions):** Marks deprecated functions and deprecated arguments of still-current functions, offering the replacement as a quick fix where one is known. A call to a bare name whose package the code never attaches is reported as uncertain, as any function of that name would answer to it. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/deprecated-functions.ts#L228">src/linter/rules/deprecated-functions.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This signals the use of deprecated functions or features."><a href='#deprecated'>![deprecated](https://img.shields.io/badge/deprecated-teal) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

**[File Path Validity](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20File%20Path%20Validity):** Checks whether file paths used in read and write operations are valid and point to existing files. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L63">src/linter/rules/file-path-validity.ts</a>]\
	<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

**[Naming Convention](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Naming%20Convention):** Checks whether the symbols conform to a certain naming convention [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/naming-convention.ts#L213">src/linter/rules/naming-convention.ts</a>]\
	<span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the style of the code. For example, inconsistent naming conventions, or missing or incorrect formatting."><a href='#style'>![style](https://img.shields.io/badge/style-teal) </a></span>

**[Network Functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Network%20Functions):** Marks network functions that execute network operations, such as downloading files or making HTTP requests. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/network-functions.ts#L90">src/linter/rules/network-functions.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <span title="This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures."><a href='#performance'>![performance](https://img.shields.io/badge/performance-teal) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span>

**[No Leaked Credentials](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20No%20Leaked%20Credentials):** Detects hardcoded credentials assigned to variables whose names suggest they hold passwords, tokens, or API keys, or whose values match known credential formats (AWS, GitHub, Slack, Stripe, SSH). [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/no-leaked-credentials.ts#L50">src/linter/rules/no-leaked-credentials.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <span title="This marks rules which are currently considered experimental, _not_ that they detect experimental code."><a href='#experimental'>![experimental](https://img.shields.io/badge/experimental-teal) </a></span>

**[Problematic inputs](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Problematic%20Inputs):** Detects uses of dynamic calls (e.g. eval, system) with non-constant inputs, and graphics-device calls (pdf, postscript) where a filename starts with '|' indicating a pipe command injection. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/problematic-inputs.ts#L120">src/linter/rules/problematic-inputs.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <span title="This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures."><a href='#performance'>![performance](https://img.shields.io/badge/performance-teal) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>

**[Roxygen Arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Roxygen%20Arguments):** Checks whether a function has undocumented or overdocumented parameters [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/roxygen-arguments.ts#L55">src/linter/rules/roxygen-arguments.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span> <span title="This rule is used to detect issues that are related to the style of the code. For example, inconsistent naming conventions, or missing or incorrect formatting."><a href='#style'>![style](https://img.shields.io/badge/style-teal) </a></span>

**[Seeded Randomness](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Seeded%20Randomness):** Checks whether randomness-based function calls are preceded by a random seed generation function. For consistent reproducibility, functions that use randomness should only be called after a constant random seed is set using a function like `set.seed`. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/seeded-randomness.ts#L64">src/linter/rules/seeded-randomness.ts</a>]\
	<span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

**[Software Has License](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Software%20Has%20License):** Checks whether the software project provides a license (via a LICENSE file or the DESCRIPTION file License field). [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/software-has-license.ts#L20">src/linter/rules/software-has-license.ts</a>]\
	<span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

**[Software Has Tests](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Software%20Has%20Tests):** Checks whether the software project has tests (test files in a test directory or test function calls in R code). [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/software-has-tests.ts#L23">src/linter/rules/software-has-tests.ts</a>]\
	<span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

**[Stop without call.=False argument](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Stop%20Call):** Checks whether stop calls without call. argument set to FALSE are used. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/stop-with-call-arg.ts#L30">src/linter/rules/stop-with-call-arg.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span>

**[Syntactically Valid](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Syntactically%20Valid):** Checks whether the code is free of syntax errors, using the configured (error-tolerant) parser, and offers extensible quick-fixes to repair them. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/syntactically-valid.ts#L266">src/linter/rules/syntactically-valid.ts</a>]\
	<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

**[Unclosed Connection](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Unclosed%20Connection):** Flags connections that are opened but not closed on every path opening them. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L177">src/linter/rules/unclosed-connection.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

**[Undefined Symbol](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Undefined%20Symbol):** Flags functions and variables that are neither defined locally, a base R builtin, nor exported by a loaded package. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/undefined-symbol.ts#L102">src/linter/rules/undefined-symbol.ts</a>]\
	<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This marks rules which are currently considered experimental, _not_ that they detect experimental code."><a href='#experimental'>![experimental](https://img.shields.io/badge/experimental-teal) </a></span>

**[Unescaped Arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Unescaped%20Arguments):** Detects arguments of critical system, evaluation, database, and HTML/JavaScript calls that are not properly escaped. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L334">src/linter/rules/unescaped-arguments.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the shiny framework."><a href='#shiny'>![shiny](https://img.shields.io/badge/shiny-teal) </a></span>

**[Unused Definitions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Unused%20Definitions):** Checks for unused definitions. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-definition.ts#L322">src/linter/rules/unused-definition.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>

**[Unused Import](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Unused%20Import):** Highlights packages that are attached but never used, so the code runs just the same without them. Requires a signature database, and packages that only do their work on load should be whitelisted in the configuration. [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-import.ts#L140">src/linter/rules/unused-import.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>

**[Useless Loops](https://github.com/flowr-analysis/flowr/wiki/%5BLinting%20Rule%5D%20Useless%20Loop):** Detect loops which only iterate once [see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/useless-loop.ts#L23">src/linter/rules/useless-loop.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>
	
<h2 id="quick-fixes">Quick Fixes</h2>

Rules tagged <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> attach a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/linter-format.ts#L98"><code>LintQuickFix</code></a> to their results,
describing the edit that resolves the finding. flowR does not only report them, it carries them out:
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/linter-fix.ts#L55"><code><span title="Every quick fix a lint run offers, grouped by the file it changes. Fixes flowR cannot place are left out.">byFile</span></code></a> collects the fixes of a lint run per file and <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/linter-fix.ts#L87"><code><span title="The content of one file with the given fixes carried out, as LintQuickFixes.byFile groups them. Of two overlapping fixes only the one coming first in the file is kept, since the second would be applied to a range that no longer says what it did. What survives is then carried out back to front, so the offsets of the edits still to come stay valid. Fixes naming a file must all name the same one, as ...">apply</span></code></a>
returns that file's content with them applied. Of two overlapping fixes only the one coming first in the file is kept,
and a removal that leaves nothing but whitespace behind takes its line with it.

In <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/linter-output.ts#L27"><code><span title="[SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html), e.g. to upload to GitHub code scanning">LinterOutputFormat::<b>Sarif</b></span></code></a> output the fixes become SARIF `fixes`, which an editor
or code scanner can offer directly. <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/linter-output.ts#L29"><code><span title="[GitHub workflow commands](https://docs.github.com/actions/reference/workflow-commands-for-github-actions), one annotation per finding">LinterOutputFormat::<b>Github</b></span></code></a> annotations carry no
fix of their own, so the descriptions are appended to the message.

<h2 id="tags">Tags</h2>

We use tags to categorize linting rules for users. The following tags are available:

| Tag/Badge&emsp;&emsp; | Description |
| --- | :-- |
| <a id="bug"></a> <span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> | This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue. (rules: [file-path-validity](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-File-Path-Validity), [dataframe-access-validation](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Dataframe-Access-Validation), [undefined-symbol](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Undefined-Symbol), and [syntactically-valid](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Syntactically-Valid)) | 
| <a id="deprecated"></a> <span title="This signals the use of deprecated functions or features."><a href='#deprecated'>![deprecated](https://img.shields.io/badge/deprecated-teal) </a></span> | This signals the use of deprecated functions or features. (rule: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Deprecated-Functions)) | 
| <a id="documentation"></a> <span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span> | This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments. (rules: [roxygen-arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Roxygen-Arguments) and [software-has-license](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Software-Has-License)) | 
| <a id="experimental"></a> <span title="This marks rules which are currently considered experimental, _not_ that they detect experimental code."><a href='#experimental'>![experimental](https://img.shields.io/badge/experimental-teal) </a></span> | This marks rules which are currently considered experimental, _not_ that they detect experimental code. (rules: [no-leaked-credentials](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-No-Leaked-Credentials) and [undefined-symbol](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Undefined-Symbol)) | 
| <a id="performance"></a> <span title="This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures."><a href='#performance'>![performance](https://img.shields.io/badge/performance-teal) </a></span> | This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures. (rules: [network-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Network-Functions) and [problematic-inputs](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Problematic-Inputs)) | 
| <a id="robustness"></a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span> | This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages. (rules: [file-path-validity](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-File-Path-Validity), [seeded-randomness](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Seeded-Randomness), [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Absolute-File-Paths), [syntactically-valid](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Syntactically-Valid), and [unclosed-connection](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unclosed-Connection)) | 
| <a id="rver3"></a> <span title="The rule is specific to R version 3.x."><a href='#rver3'>![rver3](https://img.shields.io/badge/rver3-teal) </a></span> | The rule is specific to R version 3.x. (rules: _none_) | 
| <a id="rver4"></a> <span title="The rule is specific to R version 4.x."><a href='#rver4'>![rver4](https://img.shields.io/badge/rver4-teal) </a></span> | The rule is specific to R version 4.x. (rules: _none_) | 
| <a id="readability"></a> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span> | This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting. (rules: [unused-definitions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unused-Definitions), [useless-loop](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Useless-Loop), [problematic-inputs](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Problematic-Inputs), and [unused-import](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unused-Import)) | 
| <a id="reproducibility"></a> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> | This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data. (rules: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Deprecated-Functions), [file-path-validity](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-File-Path-Validity), [seeded-randomness](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Seeded-Randomness), [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Absolute-File-Paths), [network-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Network-Functions), [dataframe-access-validation](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Dataframe-Access-Validation), [dead-code](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Dead-Code), and [software-has-tests](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Software-Has-Tests)) | 
| <a id="security"></a> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> | This rule is used to detect security-critical. For example, missing input validation. (rules: [network-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Network-Functions), [problematic-inputs](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Problematic-Inputs), [no-leaked-credentials](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-No-Leaked-Credentials), and [unescaped-arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unescaped-Arguments)) | 
| <a id="shiny"></a> <span title="This rule is used to detect issues that are related to the shiny framework."><a href='#shiny'>![shiny](https://img.shields.io/badge/shiny-teal) </a></span> | This rule is used to detect issues that are related to the shiny framework. (rule: [unescaped-arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unescaped-Arguments)) | 
| <a id="smell"></a> <span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> | This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice. (rules: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Deprecated-Functions), [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Absolute-File-Paths), [unused-definitions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unused-Definitions), [network-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Network-Functions), [dead-code](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Dead-Code), [useless-loop](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Useless-Loop), [problematic-inputs](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Problematic-Inputs), [stop-call](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Stop-Call), [roxygen-arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Roxygen-Arguments), [no-leaked-credentials](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-No-Leaked-Credentials), [unused-import](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unused-Import), [unclosed-connection](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unclosed-Connection), and [unescaped-arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unescaped-Arguments)) | 
| <a id="style"></a> <span title="This rule is used to detect issues that are related to the style of the code. For example, inconsistent naming conventions, or missing or incorrect formatting."><a href='#style'>![style](https://img.shields.io/badge/style-teal) </a></span> | This rule is used to detect issues that are related to the style of the code. For example, inconsistent naming conventions, or missing or incorrect formatting. (rules: [naming-convention](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Naming-Convention) and [roxygen-arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Roxygen-Arguments)) | 
| <a id="usability"></a> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span> | This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements. (rules: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Deprecated-Functions), [dataframe-access-validation](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Dataframe-Access-Validation), [dead-code](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Dead-Code), [software-has-license](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Software-Has-License), and [software-has-tests](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Software-Has-Tests)) | 
| <a id="quickfix"></a> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> | This rule may provide quickfixes to automatically fix the issues it detects. (rules: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Deprecated-Functions), [file-path-validity](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-File-Path-Validity), [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Absolute-File-Paths), [unused-definitions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unused-Definitions), [naming-convention](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Naming-Convention), [unused-import](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unused-Import), [syntactically-valid](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Syntactically-Valid), and [unescaped-arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unescaped-Arguments)) | 

<h2 id="certainty">Certainty</h2>

Both linting rules and their individual results are additionally categorized by how certain the linter is that the results it is returning are valid.

<h3 id="rule-certainty">Rule Certainty</h3>

| Rule Certainty | Description |
| -------------- | :---------- |
| <a id="exact"></a> `exact` | Linting rules that are expected to have both high precision and high recall. (rules: _none_) |
| <a id="best-effort"></a> `best-effort` | Linting rules that are expected to have high precision, but not necessarily high recall. Rules with this certainty generally ensure that the results they return are correct, but may not return all results. (rules: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Deprecated-Functions), [file-path-validity](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-File-Path-Validity), [seeded-randomness](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Seeded-Randomness), [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Absolute-File-Paths), [unused-definitions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unused-Definitions), [network-functions](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Network-Functions), [dataframe-access-validation](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Dataframe-Access-Validation), [dead-code](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Dead-Code), [useless-loop](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Useless-Loop), [problematic-inputs](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Problematic-Inputs), [stop-call](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Stop-Call), [roxygen-arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Roxygen-Arguments), [software-has-license](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Software-Has-License), [software-has-tests](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Software-Has-Tests), [no-leaked-credentials](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-No-Leaked-Credentials), [unused-import](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unused-Import), [syntactically-valid](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Syntactically-Valid), [unclosed-connection](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unclosed-Connection), and [unescaped-arguments](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Unescaped-Arguments)) |
| <a id="over-approximative"></a> `over-approximative` | Linting rules that are expected to have high recall, but not necessarily high precision. Rules with this certainty generally return all relevant results, but may also include some incorrect matches. (rules: [naming-convention](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Naming-Convention) and [undefined-symbol](https://github.com/flowr-analysis/flowr/wiki/%5BLinting-Rule%5D-Undefined-Symbol)) |
	
<h3 id="result-certainty">Result Certainty</h3>

| Result Certainty | Description |
| ---------------- | :---------- |
| <a id="uncertain"></a> `uncertain` | The linting rule cannot say for sure whether the result is correct or not. This linting certainty should be used for linting results whose calculations are based on estimations involving unknown side effects, reflection, etc. |
| <a id="certain"></a> `certain` | The linting rule is certain that the reported lint is real. This linting certainty should be used for linting results whose calculations do not involve estimates or other unknown factors. |