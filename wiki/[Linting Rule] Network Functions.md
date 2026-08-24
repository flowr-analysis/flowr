_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-08-20, 12:07:44 UTC (v2.14.1), please do not edit directly._
<h2 id="network-functions">Network Functions&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <span title="This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures."><a href='#performance'>![performance](https://img.shields.io/badge/performance-teal) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span>


This rule is a `best-effort` rule.
 
Marks network functions that execute network operations, such as downloading files or making HTTP requests.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/network-functions.ts#L41">src/linter/rules/network-functions.ts</a>._


### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `network-functions` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/network-functions.ts#L20"><code><span title="The list of function names or more detailed NetworkFunction information that should be marked in the given context if their arguments match.">fns</span></code></a>\
The list of function names or more detailed
<code>NetworkFunction</code>
information that should be marked in the given context if their arguments match.

### Examples


```r

read.csv("https://example.com/data.csv")
download.file("https://foo.bar")
```


The linting query can be used to run this rule on the above example:




```json
[ { "type": "linter",   "rules": [ { "name": "network-functions",     "config": {} } ] } ]
```






_Results (prettified and summarized):_

Query: **linter** (15 ms)\
&nbsp;&nbsp;&nbsp;╰ **Network Functions** (network-functions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function `utils::read.csv` at 2.1-40\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function `utils::download.file` at 3.1-32\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalCalls: 2, totalFunctionDefinitions: 2, searchTimeMs: 4, processTimeMs: 0\
_All queries together required ≈15 ms (1ms accuracy, total 22 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _21.9 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "linter": {
    "results": {
      "network-functions": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 3,
            "function": "utils::read.csv",
            "loc": [
              2,
              1,
              2,
              40
            ]
          },
          {
            "certainty": "certain",
            "involvedId": 7,
            "function": "utils::download.file",
            "loc": [
              3,
              1,
              3,
              32
            ]
          }
        ],
        ".meta": {
          "totalCalls": 2,
          "totalFunctionDefinitions": 2,
          "searchTimeMs": 4,
          "processTimeMs": 0
        }
      }
    },
    ".meta": {
      "timing": 15
    }
  },
  ".meta": {
    "timing": 15
  }
}
```



</details>





	

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-network-functions.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts)


<h4 id="Test_Case:_network_function_nested">Test Case: network function nested</h4>

> Testing the nested use the 'url' function in other function calls

Given the following input:

```r
foo(url("http://example.com"))
```



We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'base::url', loc: [1, 5, 1, 29]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L12) for the test-case implementation.
		
<h4 id="Test_Case:__network_funcion_with_multiple_arguments:___prefix__">Test Case: `network funcion with multiple arguments: ${prefix}`</h4>


Given the following input:

```r
`download.file("${prefix}foo.org/bar.csv", "local.csv")`
```



We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'utils::download.file', loc: [1, 1, 1, prefix.length + 45]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_Case:_library_call">Test Case: library call</h4>


Given the following input:

```r
library(httr)
POST("http://example.com")
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: controlledSigDb('httr', ['GET', 'POST']) }
```


We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'httr::POST', loc: [2, 1, 2, 26]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_Case:_unloaded_library_call">Test Case: unloaded library call</h4>


Given the following input:

```r
POST("http://example.com")
```



We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, function: 'POST', loc: [1, 1, 1, 26] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_Case:_mismatched_library_call">Test Case: mismatched library call</h4>


Given the following input:

```r
httr2::GET("http://example.com")
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L52) for the test-case implementation.
		
<h4 id="Test_Case:_namespace_call">Test Case: namespace call</h4>


Given the following input:

```r
library(httr)
httr::GET("http://example.com")
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: controlledSigDb('httr', ['GET', 'POST']) }
```


We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'httr::GET', loc: [2, 1, 2, 31]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L57) for the test-case implementation.
		
<h4 id="Test_Case:_do_not_trigger_without_url_prefix">Test Case: do not trigger without url prefix</h4>


Given the following input:

```r
read.csv("www.example.com")
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L66) for the test-case implementation.
		
<h4 id="Test_Case:_trigger_with_custom_url_prefix">Test Case: trigger with custom url prefix</h4>


Given the following input:

```r
read.csv("www.example.com")
```


And using the following [configuration](#configuration): 
```ts
{ fns: [{ name: Identifier.make('read.csv', 'utils'), onlyTriggerWithArgument: /^www\./ }] }
```


We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 1, 1, 27] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L71) for the test-case implementation.
		
<h4 id="Test_Case:_do_not_trigger_with_custom_url_prefix">Test Case: do not trigger with custom url prefix</h4>


Given the following input:

```r
read.csv("https://example.com")
```


And using the following [configuration](#configuration): 
```ts
{ fns: [{ name: Identifier.make('read.csv', 'utils'), onlyTriggerWithArgument: /^www\./ }] }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L77) for the test-case implementation.
		
<h4 id="Test_Case:_do_not_trigger_with_multiple_arguments">Test Case: do not trigger with multiple arguments</h4>


Given the following input:

```r
download.file("data/local.csv", "local.csv")
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L84) for the test-case implementation.
		
<h4 id="Test_Case:_not_in_list_test">Test Case: not in list test</h4>


Given the following input:

```r
file("data/local.csv")
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L90) for the test-case implementation.
		
<h4 id="Test_Case:_nor_in_list_but_prefix_in_string">Test Case: nor in list but prefix in string</h4>


Given the following input:

```r
print("http://example.com")
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L96) for the test-case implementation.
		
<h4 id="Test_Case:_do_not_trigger_on_known_source">Test Case: do not trigger on known source</h4>


Given the following input:

```r
source("tex.R")
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L102) for the test-case implementation.
		
<h4 id="Test_Case:_trigger_on_web_source">Test Case: trigger on web source</h4>


Given the following input:

```r
source("https://foo.com")
```



We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'base::source', loc: [1, 1, 1, 25]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L108) for the test-case implementation.
		
<h4 id="Test_Case:_Named_argument">Test Case: Named argument</h4>


Given the following input:

```r
read.csv(file = "http://example.com/data.csv")
```



We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 1, 1, 46]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L117) for the test-case implementation.
		
<h4 id="Test_Case:_Positional_argument_with_custom_config">Test Case: Positional argument with custom config</h4>


Given the following input:

```r
test.me(x, "http://example.com/data.csv")
```


And using the following [configuration](#configuration): 
```ts
{ fns: [{ name: 'test.me', onlyTriggerWithArgument: /^(https?|ftps?):\/\//, info: { argIdx: 1 } }] }
```


We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'test.me', loc: [1, 1, 1, 41]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L125) for the test-case implementation.
		
<h4 id="Test_Case:_Named_argument_with_custom_config">Test Case: Named argument with custom config</h4>


Given the following input:

```r
test.me(foo = "http://example.com/data.csv")
```


And using the following [configuration](#configuration): 
```ts
{ fns: [{ name: 'test.me', onlyTriggerWithArgument: /^(https?|ftps?):\/\//, info: { argName: 'foo' } }] }
```


We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'test.me', loc: [1, 1, 1, 44]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L133) for the test-case implementation.
		
<h4 id="Test_Case:_Resolve_value">Test Case: Resolve value</h4>


Given the following input:

```r
url <- "http://example.com/data.csv"; read.csv(url)
```



We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 39, 1, 51]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L142) for the test-case implementation.
		
<h4 id="Test_Case:_with_a__controlled__package_database">Test Case: with a (controlled) package database</h4>

> // regression: the loaded-package export must still count as a built-in call target

Given the following input:

```r
library(httr)
GET("http://example.com")
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: controlledSigDb('httr', ['GET', 'POST']) }
```


We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, function: 'httr::GET', loc: [2, 1, 2, 25] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L152) for the test-case implementation.
		
<h4 id="Test_Case:_without_any_package_database">Test Case: without any package database</h4>


Given the following input:

```r
library(httr)
GET("http://example.com")
```


And using the following [configuration](#configuration): 
```ts
{ noSigDb: true }
```


We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, function: 'GET', loc: [2, 1, 2, 25] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L158) for the test-case implementation.