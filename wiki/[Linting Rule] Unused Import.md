_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-08-19, 15:25:00 UTC (v2.14.1), please do not edit directly._
<h2 id="unused-import">Unused Import&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>


This rule is a `best-effort` rule.
 
Flags imported packages that are not required for the code to run. Packages that are only used on load might be mistaken as such and should therefore be added to the whitelist in the configuration.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-import.ts#L36">src/linter/rules/unused-import.ts</a>._


### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unused-import` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-import.ts#L27"><code>whitelist</code></a>\


### Examples


```r
library(stats)
print("no stats function is used")
```


The linting query can be used to run this rule on the above example:




```json
[ { "type": "linter",   "rules": [ { "name": "unused-import",     "config": {} } ] } ]
```






_Results (prettified and summarized):_

Query: **linter** (7 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unused Import** (unused-import):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Import at 1.1-14\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: searchTimeMs: 7, processTimeMs: 0\
_All queries together required ≈7 ms (1ms accuracy, total 8 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _7.8 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "linter": {
    "results": {
      "unused-import": {
        "results": [
          {
            "certainty": "uncertain",
            "involvedId": 3,
            "loc": [
              1,
              1,
              1,
              14
            ],
            "version": [
              "stats",
              "4.5.3"
            ]
          }
        ],
        ".meta": {
          "searchTimeMs": 7,
          "processTimeMs": 0
        }
      }
    },
    ".meta": {
      "timing": 7
    }
  },
  ".meta": {
    "timing": 7
  }
}
```



</details>





	

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-unused-import.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts)


<h4 id="Test_Case:_Unused_Import">Test Case: Unused Import</h4>


Given the following input:

```r
library(ggplot2)
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Uncertain,
	loc:       [1, 1, 1, 16],
	version:   ['ggplot2', '1.0.0']
},
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L15) for the test-case implementation.
		
<h4 id="Test_Case:_Used_and_unused_imports">Test Case: Used and unused imports</h4>


Given the following input:

```r
library(p)
library(ggplot2)
library(random1)
ggplot()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Uncertain,
	loc:       [1, 1, 1, 10],
	version:   ['p', '1.0.0']
},
{
	certainty: LintingResultCertainty.Uncertain,
	loc:       [3, 1, 3, 16],
	version:   ['random1', '1.0.0']
},
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_Case:_Used_and_unused_imports_with_require">Test Case: Used and unused imports with require</h4>


Given the following input:

```r
require(ggplot2)
require(random1)
aes()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Uncertain,
	loc:       [2, 1, 2, 16],
	version:   ['random1', '1.0.0']
},
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_Case:_Not_in_package_database">Test Case: Not in package database</h4>


Given the following input:

```r
library(ggplot2)
library(random1)
library(notInDb)
aes()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Uncertain,
loc:       [2, 1, 2, 16],
version:   ['random1', '1.0.0']
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_Case:_Whitelisted_package">Test Case: Whitelisted package</h4>


Given the following input:

```r
require(p)
require(ggplot2)
require(random1)
aes()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb, whitelist: ['random1'] }
```


We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Uncertain,
	loc:       [1, 1, 1, 10],
	version:   ['p', '1.0.0']
},
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L48) for the test-case implementation.