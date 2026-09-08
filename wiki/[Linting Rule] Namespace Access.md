_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-09-08, 07:17:50 UTC (v2.15.8), do not edit directly._
<h2 id="namespace-access">Namespace Access Validity&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span>


This rule is a `best-effort` rule.
 
Flags `pkg:::name` where `name` is actually exported by `pkg` (so `::` would do), and `pkg::name` where the signature database knows `name` is not exported (which fails at runtime in R). Stays silent whenever the database has no definite answer for the name.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/namespace-access.ts#L37">src/linter/rules/namespace-access.ts</a>._


### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `namespace-access` rule accepts the following configuration options:



### Examples


```r
dplyr:::filter(df, x > 1)
```


The linting query can be used to run this rule on the above example:




```json
[ { "type": "linter",   "rules": [ { "name": "namespace-access",     "config": {} } ] } ]
```






_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Namespace Access Validity** (namespace-access):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ `dplyr:::filter` at 1.1-25\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: unresolved: 0, searchTimeMs: 1, processTimeMs: 0\
_All queries together required ≈1 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _1.7 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.



```json
{
  "linter": {
    "results": {
      "namespace-access": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 0,
            "loc": [
              1,
              1,
              1,
              25
            ],
            "pkg": "dplyr",
            "name": "filter",
            "kind": "unnecessary-internal"
          }
        ],
        ".meta": {
          "unresolved": 0,
          "searchTimeMs": 1,
          "processTimeMs": 0
        }
      }
    },
    ".meta": {
      "timing": 1
    }
  },
  ".meta": {
    "timing": 1
  }
}
```



</details>





	

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-namespace-access.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts)


<h4 id="Test_Case:_unnecessary__:::__on_an_exported_name">Test Case: unnecessary `:::` on an exported name</h4>


Given the following input:

```r
stats:::median
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: sigDbWithNames('stats', { median: true }) }
```


We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'median', kind: 'unnecessary-internal', loc: [1, 1, 1, 14] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L42) for the test-case implementation.
		
<h4 id="Test_Case:__::__on_a_name_that_is_not_exported">Test Case: `::` on a name that is not exported</h4>


Given the following input:

```r
stats::C_cor
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: sigDbWithNames('stats', { C_cor: false }) }
```


We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'C_cor', kind: 'not-exported', loc: [1, 1, 1, 12] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_Case:_unnecessary__:::__in_a_call">Test Case: unnecessary `:::` in a call</h4>

> // the same mismatches inside a call, not just a plain value read

Given the following input:

```r
stats:::median(1:3)
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: sigDbWithNames('stats', { median: true }) }
```


We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'median', kind: 'unnecessary-internal', loc: [1, 1, 1, 19] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_Case:__::__on_a_non-exported_name_in_a_call">Test Case: `::` on a non-exported name in a call</h4>


Given the following input:

```r
stats::C_cor(1:3)
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: sigDbWithNames('stats', { C_cor: false }) }
```


We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, pkg: 'stats', name: 'C_cor', kind: 'not-exported', loc: [1, 1, 1, 17] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L55) for the test-case implementation.
		
<h4 id="Test_Case:__::__on_an_exported_name_is_fine">Test Case: `::` on an exported name is fine</h4>


Given the following input:

```r
stats::median
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: sigDbWithNames('stats', { median: true }) }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L61) for the test-case implementation.
		
<h4 id="Test_Case:__:::__on_a_genuinely_internal_name_is_fine">Test Case: `:::` on a genuinely internal name is fine</h4>


Given the following input:

```r
stats:::C_cor
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: sigDbWithNames('stats', { C_cor: false }) }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L64) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_package_is_not_flagged">Test Case: unknown package is not flagged</h4>

> // the package is not in the database at all

Given the following input:

```r
notAPackage:::secret
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: sigDbWithNames('stats', { median: true }) }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L70) for the test-case implementation.
		
<h4 id="Test_Case:_name_absent_from_the_database_is_not_flagged">Test Case: name absent from the database is not flagged</h4>

> // package is known, but controlledSigDb never stored this name: functionByName answers undefined

Given the following input:

```r
stats:::undocumentedInternal
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: controlledSigDb('stats', ['median']) }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_Case:__::__on_a_name_absent_from_the_database_is_not_flagged_either">Test Case: `::` on a name absent from the database is not flagged either</h4>


Given the following input:

```r
stats::undocumentedInternal
```


And using the following [configuration](#configuration): 
```ts
{ sigDb: controlledSigDb('stats', ['median']) }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L77) for the test-case implementation.
		
<h4 id="Test_Case:_no_signature_database_mounted">Test Case: no signature database mounted</h4>

> // no signature database mounted at all

Given the following input:

```r
stats:::median
```


And using the following [configuration](#configuration): 
```ts
{ noSigDb: true }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L81) for the test-case implementation.