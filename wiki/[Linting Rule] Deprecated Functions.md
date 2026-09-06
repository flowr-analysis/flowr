_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-08-29, 18:14:16 UTC (v2.15.8), please do not edit directly._
<h2 id="deprecated-functions">Deprecated Functions&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This signals the use of deprecated functions or features."><a href='#deprecated'>![deprecated](https://img.shields.io/badge/deprecated-teal) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>


This rule is a `best-effort` rule.
 
Marks deprecated functions and deprecated arguments of still-current functions, offering the replacement as a quick fix where one is known. A call to a bare name whose package the code never attaches is reported as uncertain, as any function of that name would answer to it.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/deprecated-functions.ts#L229">src/linter/rules/deprecated-functions.ts</a>._


### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `deprecated-functions` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/deprecated-functions.ts#L116"><code><span title="Functions to always mark as deprecated">always</span></code></a>\
Functions to always mark as deprecated
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/deprecated-functions.ts#L122"><code><span title="Functions to mark as deprecated for specific argument, argument value or version. Keyed like DeprecatedFunctionsConfig.always : pkg::fn names the package the versions are checked against and matches only that one, a bare name matches any package.">conditionally</span></code></a>\
Functions to mark as deprecated for specific argument, argument value or version. Keyed like
<code>DeprecatedFunctionsConfig.always</code>
: `pkg::fn` names the package the versions are checked against and
matches only that one, a bare name matches any package.

### Examples


```r

first <- data.frame(x = c(1, 2, 3), y = c(1, 2, 3))
second <- data.frame(x = c(1, 3, 2), y = c(1, 3, 2))
dplyr::all_equal(first, second)
```


The linting query can be used to run this rule on the above example:




```json
[ { "type": "linter",   "rules": [ { "name": "deprecated-functions",     "config": {} } ] } ]
```






_Results (prettified and summarized):_

Query: **linter** (12 ms)\
&nbsp;&nbsp;&nbsp;╰ **Deprecated Functions** (deprecated-functions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ function `dplyr::all_equal` at 4.1-31\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: builtin: 1, sigdb: 0, searchTimeMs: 2, processTimeMs: 10\
_All queries together required ≈12 ms (1ms accuracy, total 12 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _12.4 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "linter": {
    "results": {
      "deprecated-functions": {
        "results": [
          {
            "type": "deprecated-function",
            "certainty": "certain",
            "involvedId": 53,
            "loc": [
              4,
              1,
              4,
              31
            ],
            "function": [
              "all_equal",
              "dplyr",
              false
            ]
          }
        ],
        ".meta": {
          "builtin": 1,
          "sigdb": 0,
          "searchTimeMs": 2,
          "processTimeMs": 10
        }
      }
    },
    ".meta": {
      "timing": 12
    }
  },
  ".meta": {
    "timing": 12
  }
}
```



</details>





	

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-deprecated-functions.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts)


<h4 id="Test_Case:_no_function_listed">Test Case: no function listed</h4>

> Here, we expect no deprecated functions to be found, as neither `cat` nor `print` nor `<-` are listed as deprecated, we specifically clean the list of deprecated functions

Given the following input:

```r
cat("hello")
print("hello")
x <- 1
cat(x)
```


And using the following [configuration](#configuration): 
```ts
{ always: [] }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_Case:_cat">Test Case: cat</h4>

> Given that we declare `cat` as deprecated, we expect all uses to be marked!

Given the following input:

```r
cat("hello")
print("hello")
x <- 1
cat(x)
```


And using the following [configuration](#configuration): 
```ts
{ always: ['cat'] }
```


We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: Identifier.from(['cat', PkgName.Base, false]), loc: [1, 1, 1, 12], type: 'deprecated-function' },
{ certainty: LintingResultCertainty.Certain, function: Identifier.from(['cat', PkgName.Base, false]), loc: [4, 1, 4, 6], type: 'deprecated-function' },
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L57) for the test-case implementation.
		
<h4 id="Test_Case:_custom_cat">Test Case: custom cat</h4>

> Overwriting the `cat` function with a user defined implementation (even though it is useless), should cause the linter to not mark calls to the custom `cat` function as deprecated

Given the following input:

```r
cat("hello")
print("hello")
cat <- function(x) { }
x <- 1
cat(x)
```


And using the following [configuration](#configuration): 
```ts
{ always: ['cat'] }
```


We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: Identifier.from(['cat', PkgName.Base, false]), loc: [1, 1, 1, 12], type: 'deprecated-function'
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L66) for the test-case implementation.
		
<h4 id="Test_Case:_with_defaults">Test Case: with defaults</h4>

> Using the default linter configuration, a function such as `all_equal` should be marked as deprecated.
		   Nothing attaches dplyr here, so the call may be any `all_equal` and the finding is a guess

Given the following input:

```r
all_equal(foo)
```



We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Uncertain, function: 'all_equal', loc: [1, 1, 1, 14], type: 'deprecated-function'
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L75) for the test-case implementation.
		
<h4 id="Test_Case:_with_defaults_nested">Test Case: with defaults nested</h4>

> We should find deprecated functions even if they are nested in other function calls

Given the following input:

```r
foo(all_equal(foo))
```



We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Uncertain, function: 'all_equal', loc: [1, 5, 1, 18], type: 'deprecated-function'
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L82) for the test-case implementation.
		
<h4 id="Test_Case:_with_defaults__package_attached">Test Case: with defaults, package attached</h4>

> attaching the package the name belongs to settles which function it is

Given the following input:

```r
library(dplyr)
all_equal(foo)
```



We expect the linter to report the following:

```ts
 certainty: LintingResultCertainty.Certain, function: 'all_equal', loc: [2, 1, 2, 14], type: 'deprecated-function'
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L89) for the test-case implementation.
		
<h4 id="Test_Case:_with_a__controlled__package_database">Test Case: with a (controlled) package database</h4>

> // regression: the loaded-package export must still count as a built-in call target

Given the following input:

```r
library(dplyr)
recode(x)
```


And using the following [configuration](#configuration): 
```ts
{ always: ['recode'], sigDb: controlledSigDb('dplyr', ['recode', 'filter']) }
```


We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, function: Identifier.make('recode', PkgName.Dplyr), loc: [2, 1, 2, 9], type: 'deprecated-function' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L105) for the test-case implementation.
		
<h4 id="Test_Case:_without_any_package_database">Test Case: without any package database</h4>


Given the following input:

```r
library(dplyr)
recode(x)
```


And using the following [configuration](#configuration): 
```ts
{ always: ['recode'], noSigDb: true }
```


We expect the linter to report the following:

```ts
[{ certainty: LintingResultCertainty.Certain, function: 'recode', loc: [2, 1, 2, 9], type: 'deprecated-function' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L111) for the test-case implementation.
		
<h4 id="Test_Case:_deprecated_arg_but_value_not_set">Test Case: deprecated arg but value not set</h4>


Given the following input:

```r
testFn(badArg="hehe")
```


And using the following [configuration](#configuration): 
```ts
{ always: [], conditionally: { 'testFn': { whenArgs: [{ argName: 'badArg', ifValue: 'not hehe', state: DeprecationState.Deprecated }] } } }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L120) for the test-case implementation.
		
<h4 id="Test_Case:_deprecated_arg_present">Test Case: deprecated arg present</h4>


Given the following input:

```r
testFn(badArg="not hehe")
```


And using the following [configuration](#configuration): 
```ts
{ always: [], conditionally: { 'testFn': { whenArgs: [{ argName: 'badArg', ifValue: 'not hehe', state: DeprecationState.Deprecated }] } } }
```


We expect the linter to report the following:

```ts
					type:         'deprecated-argument',
certainty:    LintingResultCertainty.Certain,
arg:          'badArg',
replacedBy:   undefined,
function:     'testFn',
state:        DeprecationState.Deprecated,
sinceVersion: undefined,
loc:          [1, 8, 1, 13],
quickFix:     undefined
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L127) for the test-case implementation.
		
<h4 id="Test_Case:_deprecated_arg_but_not_present">Test Case: deprecated arg but not present</h4>


Given the following input:

```r
testFn()
```


And using the following [configuration](#configuration): 
```ts
{ always: [], conditionally: { 'testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated }] } } }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L146) for the test-case implementation.
		
<h4 id="Test_Case:_deprecated_arg_present">Test Case: deprecated arg present</h4>


Given the following input:

```r
testFn(badArg=5)
```


And using the following [configuration](#configuration): 
```ts
{ always: [], conditionally: {  'testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo' }] } } }
```


We expect the linter to report the following:

```ts
					type:         'deprecated-argument',
certainty:    LintingResultCertainty.Certain,
arg:          'badArg',
replacedBy:   'foo',
function:     'testFn',
state:        DeprecationState.Deprecated,
sinceVersion: undefined,
loc:          [1, 8, 1, 13],
quickFix:     [{ type: 'replace', description: 'Replace argument `badArg` with `foo`', replacement: 'foo', loc: [1, 8, 1, 13] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L153) for the test-case implementation.
		
<h4 id="Test_Case:__arg__unresolved_version_should_make_result_uncertain">Test Case: (arg) unresolved version should make result uncertain</h4>


Given the following input:

```r
library(testPkg)
testFn(badArg=5)
```


And using the following [configuration](#configuration): 
```ts
{ always: [], conditionally: { 'testPkg::testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo', sinceVersion: RRange.parse('>=1.0.0') }] } } }
```


We expect the linter to report the following:

```ts
					type:         'deprecated-argument',
certainty:    LintingResultCertainty.Uncertain,
arg:          'badArg',
replacedBy:   'foo',
function:     'testFn',
state:        DeprecationState.Deprecated,
sinceVersion: RRange.parse('>=1.0.0'),
loc:          [2, 8, 2, 13],
quickFix:     [{ type: 'replace', description: 'Replace argument `badArg` with `foo`', replacement: 'foo', loc: [2, 8, 2, 13] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L178) for the test-case implementation.
		
<h4 id="Test_Case:__arg__version_resolved_and_constraint_satisfied">Test Case: (arg) version resolved and constraint satisfied</h4>


Given the following input:

```r
library(testPkg)
testFn(badArg=5)
```


And using the following [configuration](#configuration): 
```ts
{
	always:        [],
	conditionally: { 'testPkg::testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo', sinceVersion: RRange.parse('>=1.0.0') }] } },
	sigDb:         db
}
```


We expect the linter to report the following:

```ts
					type:         'deprecated-argument',
certainty:    LintingResultCertainty.Certain,
arg:          'badArg',
replacedBy:   'foo',
function:     Identifier.make('testFn', 'testPkg'),
state:        DeprecationState.Deprecated,
sinceVersion: RRange.parse('>=1.0.0'),
loc:          [2, 8, 2, 13],
quickFix:     [{ type: 'replace', description: 'Replace argument `badArg` with `foo`', replacement: 'foo', loc: [2, 8, 2, 13] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L195) for the test-case implementation.
		
<h4 id="Test_Case:__arg__version_resolved_and_constraint_not_satisfied">Test Case: (arg) version resolved and constraint not satisfied</h4>


Given the following input:

```r
library(testPkg)
testFn(badArg=5)
```


And using the following [configuration](#configuration): 
```ts
{
	always:        [],
	conditionally: { 'testPkg::testFn': { whenArgs: [{ argName: 'badArg', state: DeprecationState.Deprecated, replacedBy: 'foo', sinceVersion: RRange.parse('>=3.0.0') }] } },
	sigDb:         db
}
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L216) for the test-case implementation.
		
<h4 id="Test_Case:__fn__unresolved_version_should_make_result_uncertain">Test Case: (fn) unresolved version should make result uncertain</h4>


Given the following input:

```r
library(testPkg)
testFn()
```


And using the following [configuration](#configuration): 
```ts
{ always: [], conditionally: { 'testPkg::testFn': { sinceVersion: RRange.parse('>=1.0.0'), state: DeprecationState.Defunct } } }
```


We expect the linter to report the following:

```ts
					type:         'deprecated-function',
certainty:    LintingResultCertainty.Uncertain,
function:     'testFn',
state:        DeprecationState.Defunct,
sinceVersion: RRange.parse('>=1.0.0'),
replacedBy:   undefined,
loc:          [2, 1, 2, 8],
quickFix:     undefined
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L227) for the test-case implementation.
		
<h4 id="Test_Case:__fn__version_resolved_and_constraint_satisfied">Test Case: (fn) version resolved and constraint satisfied</h4>


Given the following input:

```r
library(testPkg)
testFn()
```


And using the following [configuration](#configuration): 
```ts
{
	always:        [],
	conditionally: { 'testPkg::testFn': { sinceVersion: RRange.parse('>=1.0.0'), state: DeprecationState.Defunct } },
	sigDb:         db
}
```


We expect the linter to report the following:

```ts
					type:         'deprecated-function',
certainty:    LintingResultCertainty.Certain,
function:     Identifier.make('testFn', 'testPkg'),
state:        DeprecationState.Defunct,
sinceVersion: RRange.parse('>=1.0.0'),
replacedBy:   undefined,
loc:          [2, 1, 2, 8],
quickFix:     undefined
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L243) for the test-case implementation.
		
<h4 id="Test_Case:__fn__version_resolved_and_constraint_not_satisfied">Test Case: (fn) version resolved and constraint not satisfied</h4>


Given the following input:

```r
library(testPkg)
testFn()
```


And using the following [configuration](#configuration): 
```ts
{
	always:        [],
	conditionally: { 'testPkg::testFn': { sinceVersion: RRange.parse('>= 3.0.0'), state: DeprecationState.Defunct } },
	sigDb:         db
}
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L263) for the test-case implementation.
		
<h4 id="Test_Case:_sigdb-deprecated_function_not_in_fns">Test Case: sigdb-deprecated function not in fns</h4>


Given the following input:

```r
library(dplyr)
old_verb(x)
```


And using the following [configuration](#configuration): 
```ts
{ fns: [], sigDb: sigDbWithDeprecatedFn('dplyr', 'old_verb') }
```


We expect the linter to report the following:

```ts
[{ type: 'deprecated-function', certainty: LintingResultCertainty.Certain, function: Identifier.make('old_verb', PkgName.Dplyr), loc: [2, 1, 2, 11] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L276) for the test-case implementation.
		
<h4 id="Test_Case:_not_flagged_without_a_package_database">Test Case: not flagged without a package database</h4>


Given the following input:

```r
library(dplyr)
old_verb(x)
```


And using the following [configuration](#configuration): 
```ts
{ fns: [], noSigDb: true }
```


We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L282) for the test-case implementation.
		
<h4 id="Test_Case:_first_argument">Test Case: first argument</h4>


Given the following input:

```r
testFn(99)
```


And using the following [configuration](#configuration): 
```ts
positional
```


We expect the linter to report the following:

```ts
 type:         'deprecated-argument', certainty:    LintingResultCertainty.Certain, arg:          0, replacedBy:   'newArg',
function:     'testFn', state:        DeprecationState.Deprecated, sinceVersion: undefined, loc:          [1, 8, 1, 9], quickFix:     undefined
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L291) for the test-case implementation.
		
<h4 id="Test_Case:_first_argument_behind_a_named_one">Test Case: first argument behind a named one</h4>

> a name binds its argument wherever it stands, so `99` still fills the first position

Given the following input:

```r
testFn(other = 1, 99)
```


And using the following [configuration](#configuration): 
```ts
positional
```


We expect the linter to report the following:

```ts
 type:         'deprecated-argument', certainty:    LintingResultCertainty.Certain, arg:          0, replacedBy:   'newArg',
function:     'testFn', state:        DeprecationState.Deprecated, sinceVersion: undefined, loc:          [1, 19, 1, 20], quickFix:     undefined
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L298) for the test-case implementation.
		
<h4 id="Test_Case:_the_package_the_entry_names">Test Case: the package the entry names</h4>


Given the following input:

```r
dplyr::all_equal(x)
```



We expect the linter to report the following:

```ts
[{ type: 'deprecated-function', certainty: LintingResultCertainty.Certain, function: Identifier.make('all_equal', PkgName.Dplyr), loc: [1, 1, 1, 19] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L307) for the test-case implementation.
		
<h4 id="Test_Case:_some_other_package">Test Case: some other package</h4>


Given the following input:

```r
someOther::all_equal(x)
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L312) for the test-case implementation.
		
<h4 id="Test_Case:_ggplot2_size_becomes_linewidth">Test Case: ggplot2 size becomes linewidth</h4>


Given the following input:

```r
library(ggplot2)
element_line(size = 1)
```



We expect the linter to report the following:

```ts
 type:         'deprecated-argument', certainty:    LintingResultCertainty.Uncertain, arg:          'size', replacedBy:   'linewidth',
function:     'element_line', state:        DeprecationState.Deprecated, sinceVersion: RRange.parse('>= 3.4.0'), loc:          [2, 14, 2, 17],
quickFix:     [{ type: 'replace', description: 'Replace argument `size` with `linewidth`', replacement: 'linewidth', loc: [2, 14, 2, 17] }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-deprecated-functions.test.ts#L319) for the test-case implementation.