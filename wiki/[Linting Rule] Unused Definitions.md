_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-09-08, 07:17:50 UTC (v2.15.8), do not edit directly._
<h2 id="unused-definitions">Unused Definitions&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>


This rule is a `best-effort` rule.
 
Checks for unused definitions.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-definition.ts#L370">src/linter/rules/unused-definition.ts</a>._


### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unused-definitions` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-definition.ts#L44"><code><span title="Whether to suppress definitions that the analyzed project exports via its NAMESPACE (the package's public API). flowR cannot observe external callers, so exported names would otherwise be reported as (uncertain) false positives.">excludeExportedDefinitions</span></code></a>\
Whether to suppress definitions that the analyzed project exports via its `NAMESPACE` (the package's public API).
flowR cannot observe external callers, so exported names would otherwise be reported as (uncertain) false positives.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-definition.ts#L39"><code><span title="Whether to include (potentially anonymous) function definitions in the search (e.g., should we report uncalled anonymous functions?).">includeFunctionDefinitions</span></code></a>\
Whether to include (potentially anonymous) function definitions in the search (e.g., should we report uncalled anonymous functions?).

### Examples


```r

x <- 42
y <- 3
print(x)
```


The linting query can be used to run this rule on the above example:




```json
[ { "type": "linter",   "rules": [ { "name": "unused-definitions",     "config": {} } ] } ]
```






_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unused Definitions** (unused-definitions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Definition of `y` at 3.1 (1 quick fix(es) available)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalConsidered: 2, searchTimeMs: 2, processTimeMs: 0\
_All queries together required ≈2 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _2.0 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.



```json
{
  "linter": {
    "results": {
      "unused-definitions": {
        "results": [
          {
            "certainty": "uncertain",
            "variableName": "y",
            "involvedId": 3,
            "loc": [
              3,
              1,
              3,
              1
            ],
            "quickFix": [
              {
                "type": "remove",
                "loc": [
                  3,
                  1,
                  3,
                  6
                ],
                "description": "Remove unused definition of `y`"
              }
            ]
          }
        ],
        ".meta": {
          "totalConsidered": 2,
          "searchTimeMs": 2,
          "processTimeMs": 0
        }
      }
    },
    ".meta": {
      "timing": 2
    }
  },
  ".meta": {
    "timing": 2
  }
}
```



</details>





	

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-unused-definition.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-definition.test.ts)


<h4 id="Test_Case:_exported_package_function_is_not_unused">Test Case: exported package function is not unused</h4>

> a package export (via NAMESPACE) is the public API and must not be reported even without a local caller

Given the following input:

```r
arma <- function(x) { x + 1 }
```


And using the following [configuration](#configuration): 
```ts
{ addFiles: [new FlowrInlineTextFile('NAMESPACE', 'export("arma")')] }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-definition.test.ts#L63) for the test-case implementation.
		
<h4 id="Test_Case:_call_with_a_super-assignment_offers_no_fix">Test Case: call with a super-assignment offers no fix</h4>

> removing `r <- bump()` would drop the `<<-` the call performs, so it is reported without a fix

Given the following input:

```r
counter <- 0
bump <- function() { counter <<- counter + 1; counter }
r <- bump()
print(counter)
```



We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Uncertain, variableName: 'r', loc: [3, 1, 3, 1], quickFix: undefined }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-definition.test.ts#L110) for the test-case implementation.
		
<h4 id="Test_Case:_assignment_nested_in_a_call_argument_keeps_its_value">Test Case: assignment nested in a call argument keeps its value</h4>

> removing the whole assignment here would leave `print()`, which is not the same program (and errors)

Given the following input:

```r
`my var` <- 1
`my var` + 1
print(x <- get("my var"))
```



We expect the linter to report the following:

```ts
					certainty:    LintingResultCertainty.Uncertain,
variableName: 'x',
loc:          [3, 7, 3, 7],
quickFix:     [{ type: 'replace', loc: [3, 7, 3, 24], replacement: 'get("my var")', description: 'Remove unused definition of `x`' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-definition.test.ts#L119) for the test-case implementation.
		
<h4 id="Test_Case:_assignment_as_a_function_argument_keeps_its_value">Test Case: assignment as a function argument keeps its value</h4>


Given the following input:

```r
foo(x <- 1)
```



We expect the linter to report the following:

```ts
					certainty:    LintingResultCertainty.Uncertain,
variableName: 'x',
loc:          [1, 5, 1, 5],
quickFix:     [{ type: 'replace', loc: [1, 5, 1, 10], replacement: '1', description: 'Remove unused definition of `x`' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-definition.test.ts#L129) for the test-case implementation.
		
<h4 id="Test_Case:_assignment_in_an_if-condition_keeps_its_value">Test Case: assignment in an if-condition keeps its value</h4>


Given the following input:

```r
if((x <- 1) > 0) { 42 }
```



We expect the linter to report the following:

```ts
					certainty:    LintingResultCertainty.Uncertain,
variableName: 'x',
loc:          [1, 5, 1, 5],
quickFix:     [{ type: 'replace', loc: [1, 5, 1, 10], replacement: '1', description: 'Remove unused definition of `x`' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-definition.test.ts#L139) for the test-case implementation.
		
<h4 id="Test_Case:_assignment_on_the_right_of_another_assignment_keeps_its_value">Test Case: assignment on the right of another assignment keeps its value</h4>


Given the following input:

```r
y <- (x <- 1)
print(y)
```



We expect the linter to report the following:

```ts
					certainty:    LintingResultCertainty.Uncertain,
variableName: 'x',
loc:          [1, 7, 1, 7],
quickFix:     [{ type: 'replace', loc: [1, 7, 1, 12], replacement: '1', description: 'Remove unused definition of `x`' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-definition.test.ts#L149) for the test-case implementation.
		
<h4 id="Test_Case:_assignment_as_the_sole_statement_of_a_block_is_still_fully_removed">Test Case: assignment as the sole statement of a block is still fully removed</h4>


Given the following input:

```r
{
 x <- 1
}
```



We expect the linter to report the following:

```ts
					certainty:    LintingResultCertainty.Uncertain,
variableName: 'x',
loc:          [2, 2, 2, 2],
quickFix:     [{ type: 'remove', loc: [2, 2, 2, 7], description: 'Remove unused definition of `x`' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-definition.test.ts#L159) for the test-case implementation.