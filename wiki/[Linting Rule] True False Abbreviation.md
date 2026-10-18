_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="true-false-abbreviation">TRUE/FALSE Abbreviation&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a `<span title="Linting rules that are expected to have both high precision and high recall.">exact</span>` rule.
 
Port of `tools::checkTnF` (*"found T/F in"*), which `R CMD check` only runs for packages without a NAMESPACE, hence off by default. `T` and `F` are ordinary variables that merely default to `TRUE` and `FALSE` and may be rebound by any code. Where `R CMD check` flags every syntactic `T`/`F`, flowR only flags those that resolve to the built-in constants (with a quick fix), reports the top-level definitions that rebind them instead of their (then intended) uses, leaves local ones (parameters, function variables) alone, and leaves `x$T` alone.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/true-false-abbreviation.ts#L79">src/linter/rules/cmd-check/true-false-abbreviation.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `true-false-abbreviation` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/true-false-abbreviation.ts#L30"><code><span title="report definitions of T or F, which change what every later abbreviation means (default true)">reportRedefinitions</span></code></a>\
report definitions of `T` or `F`, which change what every later abbreviation means (default `true`)

### Examples

```r
f <- function(x) mean(x, na.rm = T)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "true-false-abbreviation",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (5 ms)\
&nbsp;&nbsp;&nbsp;╰ **TRUE/FALSE Abbreviation** (true-false-abbreviation):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Use of `T` at 1.34 (1 quick fix(es) available)\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "true-false-abbreviation": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 7,
            "loc": [1,34,1,34],
            "name": "T",
            "kind": "use",
            "message": "T is used as an abbreviation of TRUE",
            "quickFix": [{"type":"replace","description":"Replace `T` with `TRUE`","replacement":"TRUE","loc":[1,34,1,34]}]
          }
        ],
        ".meta": {"locallyDefined":0}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts)

<h4 id="Test_32_Case:_32_T_32_as_32_an_32_argument">Test Case: T as an argument</h4>

Given the following input:

```r
f <- function(x) mean(x, na.rm = T)
```

We expect the linter to report the following:

```ts
[use('T', [1, 34])]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L16) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_F_32_as_32_an_32_argument">Test Case: F as an argument</h4>

Given the following input:

```r
f <- function(x) sort(x, decreasing = F)
```

We expect the linter to report the following:

```ts
[use('F', [1, 39])]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_T_32_as_32_a_32_default_32_value">Test Case: T as a default value</h4>

Given the following input:

```r
f <- function(x, verbose = T) x
```

We expect the linter to report the following:

```ts
[use('T', [1, 28])]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_T_32_in_32_a_32_condition">Test Case: T in a condition</h4>

Given the following input:

```r
f <- function(x) if(T) x
```

We expect the linter to report the following:

```ts
[use('T', [1, 21])]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_T_32_and_32_F_32_in_32_one_32_call">Test Case: T and F in one call</h4>

Given the following input:

```r
g <- function() c(T, F)
```

We expect the linter to report the following:

```ts
[use('T', [1, 19]), use('F', [1, 22])]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_top-level_32_use">Test Case: top-level use</h4>

Given the following input:

```r
x <- T
```

We expect the linter to report the following:

```ts
[use('T', [1, 6])]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L21) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_nested_32_function">Test Case: nested function</h4>

Given the following input:

```r
f <- function() function(y) isTRUE(F)
```

We expect the linter to report the following:

```ts
[use('F', [1, 36])]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assignment_32_to_32_T_32_is_32_reported_32_instead_32_of_32_its_32_use">Test Case: assignment to T is reported instead of its use</h4>

Given the following input:

```r
T <- 0
f <- function() T + 1
```

We expect the linter to report the following:

* reported: kind = `'redefinition'`, name = `'T'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_parameter_32_named_32_F_32_only_32_shadows_32_locally">Test Case: parameter named F only shadows locally</h4>

Given the following input:

```r
f <- function(F) F * 2
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_local_32_variable_32_named_32_T_32_only_32_shadows_32_locally">Test Case: local variable named T only shadows locally</h4>

Given the following input:

```r
f <- function(x) { T <- nrow(x); T * 2 }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefinitions_32_can_32_be_32_muted">Test Case: redefinitions can be muted</h4>

Given the following input:

```r
T <- 0
f <- function() T + 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L30) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_use_32_before_32_a_32_later_32_local_32_redefinition_32_in_32_a_32_function">Test Case: use before a later local redefinition in a function</h4>

Given the following input:

```r
f <- function() { a <- T; T <- 2; a }
```

We expect the linter to report the following:

* reported: kind = `'use'`, name = `'T'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L31) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_conditional_32_local_32_redefinition_32_makes_32_the_32_use_32_uncertain">Test Case: conditional local redefinition makes the use uncertain</h4>

Given the following input:

```r
f <- function(a) { if(a) T <- 0; T }
```

We expect the linter to report the following:

* uncertain: kind = `'use'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_TRUE_32_and_32_FALSE">Test Case: TRUE and FALSE</h4>

Given the following input:

```r
f <- function(x) mean(x, na.rm = TRUE) || FALSE
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L36) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_argument_32_named_32_T">Test Case: argument named T</h4>

Given the following input:

```r
f <- function() g(T = 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L37) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_list_32_element_32_named_32_T">Test Case: list element named T</h4>

Given the following input:

```r
f <- function(x) x$T
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_string_32__34_T_34_">Test Case: string "T"</h4>

Given the following input:

```r
f <- function() "T"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_other_32_single_32_letters">Test Case: other single letters</h4>

Given the following input:

```r
f <- function(x, N) x + N
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L40) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_namespaced_32_symbol">Test Case: namespaced symbol</h4>

Given the following input:

```r
f <- function() base::T
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_code_32_is_32_no_32_package_32_code">Test Case: test code is no package code</h4>

Given the following input:

```r
x <- T
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L42) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vignette-like_32_inst_32_code_32_is_32_no_32_package_32_code">Test Case: vignette-like inst code is no package code</h4>

Given the following input:

```r
x <- T
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-true-false-abbreviation.test.ts#L43) for the test-case implementation.