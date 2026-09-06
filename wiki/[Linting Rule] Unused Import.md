_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-08-29, 14:26:35 UTC (v2.15.8), please do not edit directly._
<h2 id="unused-import">Unused Import&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>


This rule is a `best-effort` rule.
 
Highlights packages that are attached but never used, so the code runs just the same without them. Requires a signature database, and packages that only do their work on load should be whitelisted in the configuration.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-import.ts#L132">src/linter/rules/unused-import.ts</a>._


### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unused-import` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unused-import.ts#L32"><code><span title="packages that do their work on load and hence should never be reported, however unused they look">whitelist</span></code></a>\
packages that do their work on load and hence should never be reported, however unused they look

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
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Import of stats at 1.1-14 (1 quick fix(es) available)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalConsidered: 1, totalUnresolved: 0, totalMultiPackage: 0, totalUnused: 1, searchTimeMs: 6, processTimeMs: 1\
_All queries together required ≈7 ms (1ms accuracy, total 7 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _7.2 ms_ (including parsing and normalization and the query) within the generation environment.

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
            "package": "stats",
            "version": "4.5.3",
            "quickFix": [
              {
                "type": "remove",
                "description": "Remove the unused import of stats",
                "loc": [
                  1,
                  1,
                  1,
                  14
                ]
              }
            ]
          }
        ],
        ".meta": {
          "totalConsidered": 1,
          "totalUnresolved": 0,
          "totalMultiPackage": 0,
          "totalUnused": 1,
          "searchTimeMs": 6,
          "processTimeMs": 1
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


<h4 id="Test_Case:_a_lone_import_is_unused">Test Case: a lone import is unused</h4>


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
[unused('ggplot2', [1, 1, 1, 16])]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_Case:_character.only_resolves_the_package_from_the_variable">Test Case: character.only resolves the package from the variable</h4>


Given the following input:

```r
pkg <- "ggplot2"
library(pkg, character.only = TRUE)
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
[unused('ggplot2', [2, 1, 2, 35])]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L54) for the test-case implementation.
		
<h4 id="Test_Case:_a_called_export_keeps_the_import">Test Case: a called export keeps the import</h4>


Given the following input:

```r
library(ggplot2)
ggplot()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L58) for the test-case implementation.
		
<h4 id="Test_Case:_require_counts_just_like_library">Test Case: require counts just like library</h4>


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
[unused('random1', [2, 1, 2, 16])]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L61) for the test-case implementation.
		
<h4 id="Test_Case:_only_the_unused_ones_are_reported">Test Case: only the unused ones are reported</h4>


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
[unused('p', [1, 1, 1, 10]), unused('random1', [3, 1, 3, 16])]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L64) for the test-case implementation.
		
<h4 id="Test_Case:_a_namespaced_call_keeps_the_import">Test Case: a namespaced call keeps the import</h4>


Given the following input:

```r
library(ggplot2)
ggplot2::ggplot()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L69) for the test-case implementation.
		
<h4 id="Test_Case:_a_use_inside_a_function_body_keeps_the_import">Test Case: a use inside a function body keeps the import</h4>


Given the following input:

```r
library(ggplot2)
f <- function() aes()
f()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L72) for the test-case implementation.
		
<h4 id="Test_Case:_a_use_inside_a_branch_keeps_the_import">Test Case: a use inside a branch keeps the import</h4>


Given the following input:

```r
library(ggplot2)
if(x) { ggplot() }
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L75) for the test-case implementation.
		
<h4 id="Test_Case:_a_shadowed_export_does_not_keep_the_import">Test Case: a shadowed export does not keep the import</h4>


Given the following input:

```r
library(ggplot2)
aes <- function() 1
aes()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
[unused('ggplot2', [1, 1, 1, 16])]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L78) for the test-case implementation.
		
<h4 id="Test_Case:_using_one_package_does_not_excuse_the_others">Test Case: using one package does not excuse the others</h4>


Given the following input:

```r
library(p)
library(ggplot2)
library(random1)
p::f()
test1()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
[unused('ggplot2', [2, 1, 2, 16])]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L81) for the test-case implementation.
		
<h4 id="Test_Case:_a_braced_branch_can_be_emptied">Test Case: a braced branch can be emptied</h4>


Given the following input:

```r
library(ggplot2)
if(x) { print(1) }
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
[unused('ggplot2', [1, 1, 1, 16])]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L87) for the test-case implementation.
		
<h4 id="Test_Case:_an_unbraced_branch_offers_no_removal">Test Case: an unbraced branch offers no removal</h4>


Given the following input:

```r
if(x) library(ggplot2)
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
[unused('ggplot2', [1, 7, 1, 22], false)]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L90) for the test-case implementation.
		
<h4 id="Test_Case:_an_unbraced_function_body_offers_no_removal">Test Case: an unbraced function body offers no removal</h4>


Given the following input:

```r
f <- function() library(ggplot2)
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
[unused('ggplot2', [1, 17, 1, 32], false)]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L93) for the test-case implementation.
		
<h4 id="Test_Case:_a_package_the_database_does_not_know_is_skipped">Test Case: a package the database does not know is skipped</h4>


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
[unused('random1', [2, 1, 2, 16])]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L98) for the test-case implementation.
		
<h4 id="Test_Case:_a_whitelisted_package_is_never_reported">Test Case: a whitelisted package is never reported</h4>


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
[unused('p', [1, 1, 1, 10])]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L102) for the test-case implementation.
		
<h4 id="Test_Case:_nothing_is_reported_without_a_signature_database">Test Case: nothing is reported without a signature database</h4>


Given the following input:

```r
library(ggplot2)
```


And using the following [configuration](#configuration): 
```ts
{ noSigDb: true }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L106) for the test-case implementation.
		
<h4 id="Test_Case:_requireNamespace_is_not_an_import">Test Case: requireNamespace is not an import</h4>


Given the following input:

```r
if(!requireNamespace("ggplot2", quietly = TRUE)) stop("need it")
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L109) for the test-case implementation.
		
<h4 id="Test_Case:_loadNamespace_is_not_an_import">Test Case: loadNamespace is not an import</h4>


Given the following input:

```r
loadNamespace("ggplot2")
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L113) for the test-case implementation.
		
<h4 id="Test_Case:_a_qualified_call_is_not_an_import_of_its_own">Test Case: a qualified call is not an import of its own</h4>


Given the following input:

```r
p::f()
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L116) for the test-case implementation.
		
<h4 id="Test_Case:_an_attach_naming_several_packages_at_once_is_skipped">Test Case: an attach naming several packages at once is skipped</h4>


Given the following input:

```r
for(pkg in c("ggplot2", "p")) library(pkg, character.only = TRUE)
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L119) for the test-case implementation.
		
<h4 id="Test_Case:_an_attach_whose_package_cannot_be_resolved_is_skipped">Test Case: an attach whose package cannot be resolved is skipped</h4>


Given the following input:

```r
library(pkg, character.only = TRUE)
```


And using the following [configuration](#configuration): 
```ts
{ sigDb }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unused-import.test.ts#L123) for the test-case implementation.