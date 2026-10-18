_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="bogus-return">Bogus Return&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

This rule is a `<span title="Linting rules that are expected to have both high precision and high recall.">exact</span>` rule.
 
Port of the `R CMD check` note *"Possibly missing '()' after 'return'"* (`checking R code for possible problems`). A bare `return` within a function does not return, it merely evaluates to the function `return`. Unlike `R CMD check`, which reports the enclosing function, flowR reports each bare `return`, offers `return()` as a quick fix, and ignores a `return` the code defines itself.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/bogus-return.ts#L30">src/linter/rules/cmd-check/bogus-return.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `bogus-return` rule accepts the following configuration options:

### Examples

```r
f <- function(x) {
	if(is.null(x)) return
	x + 1
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "bogus-return",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (5 ms)\
&nbsp;&nbsp;&nbsp;╰ **Bogus Return** (bogus-return):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Bare `return` at 2.17-22 (1 quick fix(es) available)\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "bogus-return": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 9,
            "loc": [2,17,2,22],
            "function": "f",
            "message": "Possibly missing '()' after 'return' in f, a bare return evaluates to the function itself",
            "quickFix": [{"type":"replace","description":"Call `return()`","replacement":"return()","loc":[2,17,2,22]}]
          }
        ],
        ".meta": {}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-bogus-return.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts)

<h4 id="Test_32_Case:_32_bare_32_return_32_in_32_a_32_branch">Test Case: bare return in a branch</h4>

Given the following input:

```r
f <- function(x) {
  if(x) return
  2
}
```

We expect the linter to report the following:

* certain: function = `'f'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L8) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_bare_32_return_32_as_32_the_32_last_32_expression">Test Case: bare return as the last expression</h4>

Given the following input:

```r
f <- function(x) {
  x <- x + 1
  return
}
```

We expect the linter to report the following:

* reported: function = `'f'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L14) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_anonymous_32_function_32_names_32_no_32_function">Test Case: anonymous function names no function</h4>

Given the following input:

```r
lapply(1:3, function(i) { if(i > 1) return; i })
```

We expect the linter to report the following:

* reported

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L15) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_several_32_bare_32_returns">Test Case: several bare returns</h4>

Given the following input:

```r
f <- function(a, b) { if(a) return; if(b) return; 1 }
```

We expect the linter to report the following:

* reported: function = `'f'`
* reported: function = `'f'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L16) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_nested_32_function_32_names_32_the_32_innermost_32_binding">Test Case: nested function names the innermost binding</h4>

Given the following input:

```r
f <- function() { g <- function() return; g }
```

We expect the linter to report the following:

* reported: function = `'g'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_return_32_as_32_a_32_value_32_of_32_an_32_assignment">Test Case: return as a value of an assignment</h4>

Given the following input:

```r
f <- function() { r <- return; r }
```

We expect the linter to report the following:

* reported: function = `'f'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_quoted_32_return_32_is_32_data">Test Case: quoted return is data</h4>

Given the following input:

```r
f <- function() quote(return)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L21) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_proper_32_return_32_call">Test Case: proper return call</h4>

Given the following input:

```r
f <- function(x) return(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_empty_32_return_32_call">Test Case: empty return call</h4>

Given the following input:

```r
f <- function(x) { if(x) return(); 1 }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_return_32_with_32_a_32_space_32_before_32_the_32_parenthesis">Test Case: return with a space before the parenthesis</h4>

Given the following input:

```r
f <- function(x) return (x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L24) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_invisible_32_return">Test Case: invisible return</h4>

Given the following input:

```r
f <- function(x) return(invisible(x))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_return_32_redefined_32_locally">Test Case: return redefined locally</h4>

Given the following input:

```r
f <- function() { return <- 5; return }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_return_32_as_32_a_32_string">Test Case: return as a string</h4>

Given the following input:

```r
f <- function() "return"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_return_32_as_32_an_32_argument_32_name">Test Case: return as an argument name</h4>

Given the following input:

```r
f <- function() list(return = 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_bare_32_return_32_at_32_top_32_level_32_is_32_no_32_function">Test Case: bare return at top level is no function</h4>

Given the following input:

```r
x <- return
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_code_32_is_32_no_32_package_32_code">Test Case: test code is no package code</h4>

Given the following input:

```r
f <- function(x) { if(x) return; 1 }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-bogus-return.test.ts#L30) for the test-case implementation.