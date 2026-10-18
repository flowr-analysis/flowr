_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 21:25:13 UTC (v2.16.2), do not edit directly._
<h2 id="call-arguments">Call Arguments&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#37](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-37) 🟩

This rule is a `best-effort` rule.
 
Finds calls with arguments the called function does not take, names that match a formal only partially or match several formals, `...` used in a function without `...`, and local functions defined twice with different formals. Calls are resolved through the dataflow graph.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/call-arguments.ts#L168">src/linter/rules/cmd-check/call-arguments.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `call-arguments` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/call-arguments.ts#L49"><code><span title="also check calls of functions from other packages, whose formals the signature database states (default true)">checkPackageFunctions</span></code></a>\
also check calls of functions from other packages, whose formals the signature database states (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/call-arguments.ts#L47"><code><span title="report arguments that only match a formal by a prefix of its name (default true, as R CMD check does)">reportPartialMatches</span></code></a>\
report arguments that only match a formal by a prefix of its name (default `true`, as `R CMD check` does)

### Examples

```r
scale_by <- function(x, factor) x * factor
f <- function(x) scale_by(x, fact = 2, center = TRUE)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "call-arguments",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Call Arguments** (call-arguments):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ partial-match in scale_by (fact) at 2.18-53\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ unused-named in scale_by (center) at 2.18-53\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "call-arguments": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 23,
            "loc": [2,18,2,53],
            "kind": "partial-match",
            "function": "scale_by",
            "argument": "fact",
            "message": "possible error in scale_by(): partial argument match of 'fact' to 'factor'"
          },
          {
            "certainty": "certain",
            "involvedId": 23,
            "loc": [2,18,2,53],
            "kind": "unused-named",
            "function": "scale_by",
            "argument": "center",
            "message": "possible error in scale_by(): unused argument (center = ...)"
          }
        ],
        ".meta": {"checkedCalls":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-call-arguments.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts)

<h4 id="Test_32_Case:_32_named_32_argument_32_the_32_function_32_does_32_not_32_take">Test Case: named argument the function does not take</h4>

Given the following input:

```r
f <- function(a) a
g <- function() f(a = 1, b = 2)
```

We expect the linter to report the following:

* certain: kind = `'unused-named'`, function = `'f'`, argument = `'b'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L40) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_too_32_many_32_positional_32_arguments">Test Case: too many positional arguments</h4>

Given the following input:

```r
f <- function(a, b) a + b
g <- function() f(1, 2, 3)
```

We expect the linter to report the following:

```ts
[{kind: 'unused-positional', function: 'f', argument: undefined}].map(({argument: _, ...r}) => r)
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L43) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_positional_32_arguments_32_fill_32_the_32_formals_32_left_32_by_32_named_32_ones">Test Case: positional arguments fill the formals left by named ones</h4>

Given the following input:

```r
f <- function(a, b) a + b
g <- function() f(b = 1, 2, 3)
```

We expect the linter to report the following:

* reported: kind = `'unused-positional'`, function = `'f'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dots_32_take_32_anything">Test Case: dots take anything</h4>

Given the following input:

```r
f <- function(a, ...) a
g <- function() f(1, 2, b = 3)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L45) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_exact_32_number_32_of_32_arguments">Test Case: exact number of arguments</h4>

Given the following input:

```r
f <- function(a, b) a + b
g <- function() f(1, b = 2)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_fewer_32_arguments_32_are_32_fine_32__40_missing_32_is_32_no_32_codetools_32_error_41_">Test Case: fewer arguments are fine (missing is no codetools error)</h4>

Given the following input:

```r
f <- function(a, b) a
g <- function() f(1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_spread_32_dots_32_may_32_be_32_empty">Test Case: spread dots may be empty</h4>

Given the following input:

```r
f <- function(a) a
g <- function(...) f(...)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L48) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_empty_32_argument_32_counts_32_as_32_positional">Test Case: empty argument counts as positional</h4>

Given the following input:

```r
f <- function(a) a
g <- function() f(1, )
```

We expect the linter to report the following:

* reported: kind = `'unused-positional'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L49) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_closure_32_returned_32_by_32_a_32_function">Test Case: closure returned by a function</h4>

Given the following input:

```r
mk <- function() function(x) x
h <- mk()
g <- function() h(y = 1)
```

We expect the linter to report the following:

* uncertain: kind = `'unused-named'`, argument = `'y'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_function_32_bound_32_in_32_a_32_branch_32_is_32_uncertain">Test Case: function bound in a branch is uncertain</h4>

Given the following input:

```r
if(cond) f <- function(a) a else f <- function(a, b) a
g <- function() f(a = 1, b = 2)
```

We expect the linter to report the following:

* uncertain: kind = `'unused-named'`, argument = `'b'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_both_32_branches_32_lack_32_the_32_argument">Test Case: both branches lack the argument</h4>

Given the following input:

```r
if(cond) f <- function(a) a else f <- function(a, c) a
g <- function() f(a = 1, b = 2)
```

We expect the linter to report the following:

* certain: kind = `'unused-named'`, argument = `'b'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L54) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unknown_32_function_32_is_32_not_32_checked">Test Case: unknown function is not checked</h4>

Given the following input:

```r
g <- function(h) h(a = 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L57) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_local_32_function_32_in_32_a_32_function">Test Case: local function in a function</h4>

Given the following input:

```r
g <- function() { h <- function(x) x; h(1, 2) }
```

We expect the linter to report the following:

* reported: kind = `'unused-positional'`, function = `'h'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L58) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_partial_32_name">Test Case: partial name</h4>

Given the following input:

```r
f <- function(value, verbose) value
g <- function() f(val = 1)
```

We expect the linter to report the following:

* reported: kind = `'partial-match'`, argument = `'val'`, message = `'possible error in f(): partial argument match of \'val\' to \'value\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_ambiguous_32_partial_32_name">Test Case: ambiguous partial name</h4>

Given the following input:

```r
f <- function(value, verbose) value
g <- function() f(v = 1)
```

We expect the linter to report the following:

* reported: kind = `'ambiguous-match'`, argument = `'v'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_partial_32_matching_32_after_32_dots">Test Case: no partial matching after dots</h4>

Given the following input:

```r
f <- function(..., value) value
g <- function() f(val = 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L66) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_partial_32_match_32_before_32_dots">Test Case: partial match before dots</h4>

Given the following input:

```r
f <- function(value, ...) value
g <- function() f(val = 1)
```

We expect the linter to report the following:

* reported: kind = `'partial-match'`, argument = `'val'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L67) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_exact_32_match_32_wins_32_over_32_partial">Test Case: exact match wins over partial</h4>

Given the following input:

```r
f <- function(val, value) val
g <- function() f(val = 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_partial_32_matches_32_can_32_be_32_accepted">Test Case: partial matches can be accepted</h4>

Given the following input:

```r
f <- function(value) value
g <- function() f(val = 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L69) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_partial_32_match_32_of_32_a_32_package_32_function_32__40_signature_32_database_41_">Test Case: partial match of a package function (signature database)</h4>

Given the following input:

```r
g <- function(x) foo::bar(x, verb = TRUE)
```

We expect the linter to report the following:

* reported: kind = `'partial-match'`, argument = `'verb'`, function = `'foo::bar'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L70) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unused_32_argument_32_of_32_a_32_package_32_function">Test Case: unused argument of a package function</h4>

Given the following input:

```r
g <- function(x) foo::bar(x, colour = TRUE)
```

We expect the linter to report the following:

* reported: kind = `'unused-named'`, argument = `'colour'`, function = `'foo::bar'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L71) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_package_32_function_32_checks_32_can_32_be_32_disabled">Test Case: package function checks can be disabled</h4>

Given the following input:

```r
g <- function(x) foo::bar(x, verb = TRUE)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L72) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_base_32_function_32_with_32_dots">Test Case: base function with dots</h4>

Given the following input:

```r
g <- function(x) paste(x, foo = 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dots_32_without_32_the_32_formal">Test Case: dots without the formal</h4>

Given the following input:

```r
f <- function(x) g(x, ...)
```

We expect the linter to report the following:

* reported: kind = `'dots-out-of-context'`, function = `'f'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L77) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_..1_32_without_32_the_32_formal">Test Case: ..1 without the formal</h4>

Given the following input:

```r
f <- function(x) ..1 + x
```

We expect the linter to report the following:

* reported: kind = `'dots-out-of-context'`, function = `'f'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L78) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dots_32_with_32_the_32_formal">Test Case: dots with the formal</h4>

Given the following input:

```r
f <- function(x, ...) list(...)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L79) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dots_32_of_32_an_32_enclosing_32_function">Test Case: dots of an enclosing function</h4>

Given the following input:

```r
f <- function(...) lapply(1:3, function(i) list(i, ...))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L80) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dots_32_in_32_an_32_anonymous_32_function">Test Case: dots in an anonymous function</h4>

Given the following input:

```r
f <- function(x) lapply(x, function(i) c(i, ...))
```

We expect the linter to report the following:

```ts
[{kind: 'dots-out-of-context', function: undefined}].map(({function: _, ...r}) => r)
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L81) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_two_32_local_32_definitions">Test Case: two local definitions</h4>

Given the following input:

```r
g <- function(a) {
  h <- function(x) x
  if(a) h <- function(x, y) y
  h(1)
}
```

We expect the linter to report the following:

* reported: kind = `'conflicting-definitions'`, function = `'h'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L85) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_same_32_formals_32_are_32_fine">Test Case: same formals are fine</h4>

Given the following input:

```r
g <- function(a) { h <- function(x) x; if(a) h <- function(x) -x; h(1) }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L86) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_in_32_different_32_functions">Test Case: in different functions</h4>

Given the following input:

```r
g <- function() { h <- function(x) x }
k <- function() { h <- function(y) y }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L87) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dots_32_as_32_an_32_argument_32_name">Test Case: dots as an argument name</h4>

Given the following input:

```r
f <- function(type) switch(type, ... = "dots", "other")
g <- function() alist(x = , ... = )
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L91) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_quoted_32_calls_32_are_32_data">Test Case: quoted calls are data</h4>

Given the following input:

```r
f <- function(a) a
g <- function() quote(f(1, 2, 3))
h <- function() quote(list(...))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L92) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_formals_32_rewritten_32_by_32_a_32_factory">Test Case: formals rewritten by a factory</h4>

Given the following input:

```r
gen <- function(x) { formals(x) <- append(formals(x), alist(callback = )); x }
base_read <- function(file) file
read_chunked <- gen(base_read)
g <- function() read_chunked("a", callback = print)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L93) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_closure_32_from_32_a_32_factory_32_is_32_uncertain">Test Case: closure from a factory is uncertain</h4>

Given the following input:

```r
mk <- function() function(x) x
h <- mk()
g <- function() h(1, 2)
```

We expect the linter to report the following:

* uncertain: kind = `'unused-positional'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L94) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_signature_32_database_32_formals_32_are_32_uncertain">Test Case: signature database formals are uncertain</h4>

Given the following input:

```r
g <- function(x) foo::bar(x, colour = TRUE)
```

We expect the linter to report the following:

* uncertain: kind = `'unused-named'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L95) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_code_32_is_32_not_32_checked">Test Case: test code is not checked</h4>

Given the following input:

```r
f <- function(a) a
f(b = 2)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-call-arguments.test.ts#L99) for the test-case implementation.