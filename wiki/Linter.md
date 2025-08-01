_This document was generated from '[src/documentation/print-linter-wiki.ts](https://github.com/flowr-analysis/flowr/tree/main//src/documentation/print-linter-wiki.ts)' on 2025-08-01, 13:05:54 UTC presenting an overview of flowR's linter (v2.3.0, using R v4.5.0). Please do not edit this file/wiki page directly._

This page describes the flowR linter, which is a tool that utilizes flowR's dataflow analysis to find common issues in R scripts. The linter can currently be used through the linter [query](https://github.com/flowr-analysis/flowr/wiki/Query%20API).
For example:



```shell
$ docker run -it --rm eagleoutice/flowr # or npm run flowr 
flowR repl using flowR v2.3.0, R v4.5.0 (r-shell engine)
R> :query @linter "read.csv(\"/root/x.txt\")"
```

<details>
<summary style='color:gray'>Output</summary>


```text
Query: [;1mlinter[0m (3 ms)
   ╰ **Deprecated Functions** (deprecated-functions):
       ╰ _Metadata_: <code>{"totalDeprecatedCalls":0,"totalDeprecatedFunctionDefinitions":0,"searchTimeMs":0,"processTimeMs":0}</code>
   ╰ **File Path Validity** (file-path-validity):
       ╰ certain:
           ╰ Path `/root/x.txt` at 1.1-23
       ╰ _Metadata_: <code>{"totalReads":1,"totalUnknown":0,"totalWritesBeforeAlways":0,"totalValid":0,"searchTimeMs":0,"processTimeMs":1}</code>
   ╰ **Seeded Randomness** (seeded-randomness):
       ╰ _Metadata_: <code>{"consumerCalls":0,"callsWithFunctionProducers":0,"callsWithAssignmentProducers":0,"callsWithNonConstantProducers":0,"searchTimeMs":0,"processTimeMs":0}</code>
   ╰ **Absolute Paths** (absolute-file-paths):
       ╰ certain:
           ╰ Path `/root/x.txt` at 1.1-23
       ╰ _Metadata_: <code>{"totalConsidered":1,"totalUnknown":0,"searchTimeMs":0,"processTimeMs":0}</code>
   ╰ **Unused Definitions** (unused-definitions):
       ╰ _Metadata_: <code>{"totalConsidered":0,"searchTimeMs":0,"processTimeMs":0}</code>
   ╰ **Naming Convention** (naming-convention):
       ╰ _Metadata_: <code>{"numMatches":0,"numBreak":0,"searchTimeMs":0,"processTimeMs":0}</code>
   ╰ **Dataframe Access Validation** (dataframe-access-validation):
       ╰ _Metadata_: <code>{"numOperations":0,"numAccesses":0,"totalAccessed":0,"searchTimeMs":0,"processTimeMs":1}</code>
   ╰ **Dead Code** (dead-code):
       ╰ _Metadata_: <code>{"consideredNodes":5,"searchTimeMs":0,"processTimeMs":0}</code>
[;3mAll queries together required ≈3 ms (1ms accuracy, total 8 ms)[0m[0m
```



The linter will analyze the code and return any issues found.
Formatted more nicely, this returns:




```json
[ { "type": "linter" } ]
```


(This query can be shortened to `@linter` when used within the REPL command <span title="Description (Repl Command): Query the given R code, start with 'file://' to indicate a file. The query is to be a valid query in json format (use 'help' to get more information).">`:query`</span>).



_Results (prettified and summarized):_

Query: **linter** (14 ms)\
&nbsp;&nbsp;&nbsp;╰ **Deprecated Functions** (deprecated-functions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>{"totalDeprecatedCalls":0,"totalDeprecatedFunctionDefinitions":0,"searchTimeMs":1,"processTimeMs":0}</code>\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `/root/x.txt` at 1.1-23\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>{"totalReads":1,"totalUnknown":0,"totalWritesBeforeAlways":0,"totalValid":0,"searchTimeMs":4,"processTimeMs":1}</code>\
&nbsp;&nbsp;&nbsp;╰ **Seeded Randomness** (seeded-randomness):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>{"consumerCalls":0,"callsWithFunctionProducers":0,"callsWithAssignmentProducers":0,"callsWithNonConstantProducers":0,"searchTimeMs":0,"processTimeMs":1}</code>\
&nbsp;&nbsp;&nbsp;╰ **Absolute Paths** (absolute-file-paths):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `/root/x.txt` at 1.1-23\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>{"totalConsidered":1,"totalUnknown":0,"searchTimeMs":1,"processTimeMs":1}</code>\
&nbsp;&nbsp;&nbsp;╰ **Unused Definitions** (unused-definitions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>{"totalConsidered":0,"searchTimeMs":0,"processTimeMs":0}</code>\
&nbsp;&nbsp;&nbsp;╰ **Naming Convention** (naming-convention):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>{"numMatches":0,"numBreak":0,"searchTimeMs":0,"processTimeMs":0}</code>\
&nbsp;&nbsp;&nbsp;╰ **Dataframe Access Validation** (dataframe-access-validation):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>{"numOperations":0,"numAccesses":0,"totalAccessed":0,"searchTimeMs":0,"processTimeMs":3}</code>\
&nbsp;&nbsp;&nbsp;╰ **Dead Code** (dead-code):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: <code>{"consideredNodes":5,"searchTimeMs":1,"processTimeMs":0}</code>\
_All queries together required ≈15 ms (1ms accuracy, total 24 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _24.4 ms_ (including parsing and normalization and the query) within the generation environment.	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "linter": {
    "results": {
      "deprecated-functions": {
        "results": [],
        ".meta": {
          "totalDeprecatedCalls": 0,
          "totalDeprecatedFunctionDefinitions": 0,
          "searchTimeMs": 1,
          "processTimeMs": 0
        }
      },
      "file-path-validity": {
        "results": [
          {
            "range": [
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
          "searchTimeMs": 0,
          "processTimeMs": 1
        }
      },
      "absolute-file-paths": {
        "results": [
          {
            "certainty": "certain",
            "filePath": "/root/x.txt",
            "range": [
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
      "naming-convention": {
        "results": [],
        ".meta": {
          "numMatches": 0,
          "numBreak": 0,
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
          "processTimeMs": 3
        }
      },
      "dead-code": {
        "results": [],
        ".meta": {
          "consideredNodes": 5,
          "searchTimeMs": 1,
          "processTimeMs": 0
        }
      }
    },
    ".meta": {
      "timing": 14
    }
  },
  ".meta": {
    "timing": 15
  }
}
```



</details>







	
		

</details>



<h2 id="linting-rules">Linting Rules</h2>

The following linting rules are available:



**[Absolute Paths](https://github.com/flowr-analysis/flowr/wiki/lint-absolute-file-paths):** Checks whether file paths are absolute. [see <a href="https://github.com/flowr-analysis/flowr/tree/main//src/linter/rules/absolute-path.ts#L115">src/linter/rules/absolute-path.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span> `best-effort`

**[Dataframe Access Validation](https://github.com/flowr-analysis/flowr/wiki/lint-dataframe-access-validation):** Validates the existance of accessed columns and rows of dataframes. [see <a href="https://github.com/flowr-analysis/flowr/tree/main//src/linter/rules/dataframe-access-validation.ts#L59">src/linter/rules/dataframe-access-validation.ts</a>]\
	<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span> `best-effort`

**[Dead Code](https://github.com/flowr-analysis/flowr/wiki/lint-dead-code):** Marks areas of code that are never reached during execution. [see <a href="https://github.com/flowr-analysis/flowr/tree/main//src/linter/rules/dead-code.ts#L28">src/linter/rules/dead-code.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span> `best-effort`

**[Deprecated Functions](https://github.com/flowr-analysis/flowr/wiki/lint-deprecated-functions):** Marks deprecated functions that should not be used anymore. [see <a href="https://github.com/flowr-analysis/flowr/tree/main//src/linter/rules/deprecated-functions.ts#L29">src/linter/rules/deprecated-functions.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This signals the use of deprecated functions or features."><a href='#deprecated'>![deprecated](https://img.shields.io/badge/deprecated-teal) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span> `best-effort`

**[File Path Validity](https://github.com/flowr-analysis/flowr/wiki/lint-file-path-validity):** Checks whether file paths used in read and write operations are valid and point to existing files. [see <a href="https://github.com/flowr-analysis/flowr/tree/main//src/linter/rules/file-path-validity.ts#L49">src/linter/rules/file-path-validity.ts</a>]\
	<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span> `best-effort`

**[Naming Convention](https://github.com/flowr-analysis/flowr/wiki/lint-naming-convention):** Checks wether the symbols conform to a certain naming convention [see <a href="https://github.com/flowr-analysis/flowr/tree/main//src/linter/rules/naming-convention.ts#L170">src/linter/rules/naming-convention.ts</a>]\
	<span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the style of the code. For example, inconsistent naming conventions, or missing or incorrect formatting."><a href='#style'>![style](https://img.shields.io/badge/style-teal) </a></span> `over-approximative`

**[Seeded Randomness](https://github.com/flowr-analysis/flowr/wiki/lint-seeded-randomness):** Checks whether randomness-based function calls are preceded by a random seed generation function. For consistent reproducibility, functions that use randomness should only be called after a constant random seed is set using a function like `set.seed`. [see <a href="https://github.com/flowr-analysis/flowr/tree/main//src/linter/rules/seeded-randomness.ts#L49">src/linter/rules/seeded-randomness.ts</a>]\
	<span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span> `best-effort`

**[Unused Definitions](https://github.com/flowr-analysis/flowr/wiki/lint-unused-definitions):** Checks for unused definitions. [see <a href="https://github.com/flowr-analysis/flowr/tree/main//src/linter/rules/unused-definition.ts#L96">src/linter/rules/unused-definition.ts</a>]\
	<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span> `best-effort`
	
<h2 id="tags">Tags</h2>

We use tags to categorize linting rules for users. The following tags are available:

| Tag/Badge&emsp;&emsp; | Description |
| --- | :-- |
| <a id="bug"></a> <span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> | This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue. (rules: [file-path-validity](https://github.com/flowr-analysis/flowr/wiki/lint-file-path-validity) and [dataframe-access-validation](https://github.com/flowr-analysis/flowr/wiki/lint-dataframe-access-validation)) | 
| <a id="deprecated"></a> <span title="This signals the use of deprecated functions or features."><a href='#deprecated'>![deprecated](https://img.shields.io/badge/deprecated-teal) </a></span> | This signals the use of deprecated functions or features. (rule: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/lint-deprecated-functions)) | 
| <a id="documentation"></a> <span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span> | This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments. (rules: _none_) | 
| <a id="experimental"></a> <span title="This marks rules which are currently considered experimental, _not_ that they detect experimental code."><a href='#experimental'>![experimental](https://img.shields.io/badge/experimental-teal) </a></span> | This marks rules which are currently considered experimental, _not_ that they detect experimental code. (rules: _none_) | 
| <a id="performance"></a> <span title="This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures."><a href='#performance'>![performance](https://img.shields.io/badge/performance-teal) </a></span> | This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures. (rules: _none_) | 
| <a id="robustness"></a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span> | This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages. (rules: [file-path-validity](https://github.com/flowr-analysis/flowr/wiki/lint-file-path-validity), [seeded-randomness](https://github.com/flowr-analysis/flowr/wiki/lint-seeded-randomness), and [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/lint-absolute-file-paths)) | 
| <a id="rver3"></a> <span title="The rule is specific to R version 3.x."><a href='#rver3'>![rver3](https://img.shields.io/badge/rver3-teal) </a></span> | The rule is specific to R version 3.x. (rules: _none_) | 
| <a id="rver4"></a> <span title="The rule is specific to R version 4.x."><a href='#rver4'>![rver4](https://img.shields.io/badge/rver4-teal) </a></span> | The rule is specific to R version 4.x. (rules: _none_) | 
| <a id="readability"></a> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span> | This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting. (rule: [unused-definitions](https://github.com/flowr-analysis/flowr/wiki/lint-unused-definitions)) | 
| <a id="reproducibility"></a> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> | This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data. (rules: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/lint-deprecated-functions), [file-path-validity](https://github.com/flowr-analysis/flowr/wiki/lint-file-path-validity), [seeded-randomness](https://github.com/flowr-analysis/flowr/wiki/lint-seeded-randomness), [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/lint-absolute-file-paths), [dataframe-access-validation](https://github.com/flowr-analysis/flowr/wiki/lint-dataframe-access-validation), and [dead-code](https://github.com/flowr-analysis/flowr/wiki/lint-dead-code)) | 
| <a id="security"></a> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> | This rule is used to detect security-critical. For example, missing input validation. (rules: _none_) | 
| <a id="shiny"></a> <span title="This rule is used to detect issues that are related to the shiny framework."><a href='#shiny'>![shiny](https://img.shields.io/badge/shiny-teal) </a></span> | This rule is used to detect issues that are related to the shiny framework. (rules: _none_) | 
| <a id="smell"></a> <span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> | This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice. (rules: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/lint-deprecated-functions), [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/lint-absolute-file-paths), [unused-definitions](https://github.com/flowr-analysis/flowr/wiki/lint-unused-definitions), and [dead-code](https://github.com/flowr-analysis/flowr/wiki/lint-dead-code)) | 
| <a id="style"></a> <span title="This rule is used to detect issues that are related to the style of the code. For example, inconsistent naming conventions, or missing or incorrect formatting."><a href='#style'>![style](https://img.shields.io/badge/style-teal) </a></span> | This rule is used to detect issues that are related to the style of the code. For example, inconsistent naming conventions, or missing or incorrect formatting. (rule: [naming-convention](https://github.com/flowr-analysis/flowr/wiki/lint-naming-convention)) | 
| <a id="usability"></a> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span> | This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements. (rules: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/lint-deprecated-functions), [dataframe-access-validation](https://github.com/flowr-analysis/flowr/wiki/lint-dataframe-access-validation), and [dead-code](https://github.com/flowr-analysis/flowr/wiki/lint-dead-code)) | 
| <a id="quickfix"></a> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> | This rule may provide quickfixes to automatically fix the issues it detects. (rules: [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/lint-absolute-file-paths), [unused-definitions](https://github.com/flowr-analysis/flowr/wiki/lint-unused-definitions), and [naming-convention](https://github.com/flowr-analysis/flowr/wiki/lint-naming-convention)) | 

<h2 id="certainty">Certainty</h2>

Both linting rules and their individual results are additionally categorized by how certain the linter is that the results it is returning are valid.

<h3 id="rule-certainty">Rule Certainty</h3>

| Rule Certainty | Description |
| -------------- | :---------- |
| <a id="exact"></a> `exact` | Linting rules that are expected to have both high precision and high recall. (rules: _none_) |
| <a id="best-effort"></a> `best-effort` | Linting rules that are expected to have high precision, but not necessarily high recall. Rules with this certainty generally ensure that the results they return are correct, but may not return all results. (rules: [deprecated-functions](https://github.com/flowr-analysis/flowr/wiki/lint-deprecated-functions), [file-path-validity](https://github.com/flowr-analysis/flowr/wiki/lint-file-path-validity), [seeded-randomness](https://github.com/flowr-analysis/flowr/wiki/lint-seeded-randomness), [absolute-file-paths](https://github.com/flowr-analysis/flowr/wiki/lint-absolute-file-paths), [unused-definitions](https://github.com/flowr-analysis/flowr/wiki/lint-unused-definitions), [dataframe-access-validation](https://github.com/flowr-analysis/flowr/wiki/lint-dataframe-access-validation), and [dead-code](https://github.com/flowr-analysis/flowr/wiki/lint-dead-code)) |
| <a id="over-approximative"></a> `over-approximative` | Linting rules that are expected to have high recall, but not necessarily high precision. Rules with this certainty generally return all relevant results, but may also include some incorrect matches. (rule: [naming-convention](https://github.com/flowr-analysis/flowr/wiki/lint-naming-convention)) |
	
<h3 id="result-certainty">Result Certainty</h3>

| Result Certainty | Description |
| ---------------- | :---------- |
| <a id="uncertain"></a> `uncertain` | The linting rule cannot say for sure whether the result is correct or not. This linting certainty should be used for linting results whose calculations are based on estimations involving unknown side-effects, reflection, etc. |
| <a id="certain"></a> `certain` | The linting rule is certain that the reported lint is real. This linting certainty should be used for linting results whose calculations do not involve estimates or other unknown factors. |
