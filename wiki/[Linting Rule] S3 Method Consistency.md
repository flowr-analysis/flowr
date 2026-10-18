_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 21:25:13 UTC (v2.16.2), do not edit directly._
<h2 id="s3-method-consistency">S3 Method Consistency&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#38](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-38) 🟩, [#39](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-39) 🟩, [#41](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-41) 🔷

This rule is a `best-effort` rule.
 
Finds S3 methods whose formals do not match their generic, methods not registered in the NAMESPACE, and replacement functions whose last formal is not `value`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L159">src/linter/rules/cmd-check/s-three-method-consistency.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `s3-method-consistency` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L45"><code><span title="also check functions named like a method but not registered in the NAMESPACE, which R CMD check only does on request (default true)">checkApparentMethods</span></code></a>\
also check functions named like a method but not registered in the `NAMESPACE`, which `R CMD check` only does on request (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L43"><code><span title="check that methods take the arguments of their generic (default true)">checkMethods</span></code></a>\
check that methods take the arguments of their generic (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L49"><code><span title="check that replacement functions end in value (default true)">checkReplacementValues</span></code></a>\
check that replacement functions end in `value` (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/s-three-method-consistency.ts#L47"><code><span title="report apparent methods of an exported generic that the NAMESPACE does not register (default true)">checkUnregistered</span></code></a>\
report apparent methods of an exported generic that the `NAMESPACE` does not register (default `true`)

### Examples

```r
print.myclass <- function(obj) cat("myclass")
`size<-` <- function(x, v) { attr(x, "size") <- v; x }
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "s3-method-consistency",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1108 ms)\
&nbsp;&nbsp;&nbsp;╰ **S3 Method Consistency** (s3-method-consistency):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ size<-: replacement-value at 2.1-8\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "s3-method-consistency": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 10,
            "loc": [2,1,2,8],
            "kind": "replacement-value",
            "function": "size<-",
            "message": "Replacement function size<- should have 'value' as its last argument"
          }
        ],
        ".meta": {"consideredMethods":0,"consideredReplacements":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts)

<h4 id="Test_32_Case:_32_missing_32_dots">Test Case: missing dots</h4>

Given the following input:

```r
print.foo <- function(x) 1
```

We expect the linter to report the following:

```ts
[mismatch('print.foo', 'print', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L16) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_renamed_32_first_32_argument">Test Case: renamed first argument</h4>

Given the following input:

```r
print.foo <- function(obj, ...) 1
```

We expect the linter to report the following:

```ts
[mismatch('print.foo', 'print', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_correct_32_method">Test Case: correct method</h4>

Given the following input:

```r
print.foo <- function(x, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_extra_32_named_32_arguments_32_after_32_the_32_dots_32_are_32_fine">Test Case: extra named arguments after the dots are fine</h4>

Given the following input:

```r
print.foo <- function(x, ..., digits = 3) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_extra_32_arguments_32_before_32_the_32_dots_32_are_32_fine_32_with_32_a_32_generic_32_that_32_has_32_dots">Test Case: extra arguments before the dots are fine with a generic that has dots</h4>

Given the following input:

```r
print.foo <- function(x, digits = 3, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dots_32_first_32_are_32_accepted_32_as_32_R_32_does">Test Case: dots first are accepted as R does</h4>

Given the following input:

```r
sort.foo <- function(..., x, decreasing) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L21) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_arguments_32_swapped">Test Case: arguments swapped</h4>

Given the following input:

```r
sort.foo <- function(decreasing, x, ...) 1
```

We expect the linter to report the following:

```ts
[mismatch('sort.foo', 'sort', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_method_32_without_32_a_32_generic_32_argument_32_but_32_with_32_dots">Test Case: method without a generic argument but with dots</h4>

Given the following input:

```r
sort.foo <- function(x, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_generic_32_without_32_dots_44__32_method_32_adds_32_an_32_argument">Test Case: generic without dots, method adds an argument</h4>

Given the following input:

```r
length.foo <- function(x, extra) 1
```

We expect the linter to report the following:

```ts
[mismatch('length.foo', 'length', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L24) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_generic_32_without_32_dots_44__32_method_32_renames_32_the_32_argument">Test Case: generic without dots, method renames the argument</h4>

Given the following input:

```r
length.foo <- function(obj) 1
```

We expect the linter to report the following:

```ts
[mismatch('length.foo', 'length', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_message_32_names_32_both_32_signatures">Test Case: message names both signatures</h4>

Given the following input:

```r
print.foo <- function(x) 1
```

We expect the linter to report the following:

* reported: message = `'S3 generic/method inconsistency:\nprint:\n  function(x, ...)\nprint.foo:\n  function(x)'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_location_32_is_32_the_32_name_32_of_32_the_32_method">Test Case: location is the name of the method</h4>

Given the following input:

```r
a <- 1
print.foo <- function(x) 1
```

We expect the linter to report the following:

* reported

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_quoted_32_method_32_name">Test Case: quoted method name</h4>

Given the following input:

```r
"print.foo" <- function(x) 1
```

We expect the linter to report the following:

```ts
[mismatch('print.foo', 'print', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_registered_32_method_32_not_32_defined_32_in_32_the_32_package_32_is_32_ignored">Test Case: registered method not defined in the package is ignored</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L33) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_method_32_of_32_a_32_class_32_with_32_dots_32_in_32_its_32_name">Test Case: method of a class with dots in its name</h4>

Given the following input:

```r
print.foo.bar <- function(x) 1
```

We expect the linter to report the following:

```ts
[mismatch('print.foo.bar', 'print', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_formula_32_methods_32_ignore_32_the_32_first_32_argument">Test Case: formula methods ignore the first argument</h4>

Given the following input:

```r
sort.formula <- function(formula, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_round_32_methods_32_taking_32_x_32_are_32_fine">Test Case: round methods taking x are fine</h4>

Given the following input:

```r
round.foo <- function(x, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L36) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_round_32_method_32_with_32_a_32_different_32_first_32_argument">Test Case: round method with a different first argument</h4>

Given the following input:

```r
round.foo <- function(y, digits) 1
```

We expect the linter to report the following:

```ts
[mismatch('round.foo', 'round', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L37) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_as.data.frame_32_methods">Test Case: as.data.frame methods</h4>

Given the following input:

```r
as.data.frame.foo <- function(x, row.names = NULL, optional = FALSE, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_as.data.frame_32_method_32_missing_32_arguments">Test Case: as.data.frame method missing arguments</h4>

Given the following input:

```r
as.data.frame.foo <- function(x, optional) 1
```

We expect the linter to report the following:

```ts
[mismatch('as.data.frame.foo', 'as.data.frame', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Ops_32_with_32_the_32_right_32_arguments">Test Case: Ops with the right arguments</h4>

Given the following input:

```r
Ops.foo <- function(e1, e2) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L43) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Ops_32_with_32_renamed_32_arguments">Test Case: Ops with renamed arguments</h4>

Given the following input:

```r
Ops.foo <- function(a, b) 1
```

We expect the linter to report the following:

```ts
[mismatch('Ops.foo', 'Ops', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Math_32_without_32_dots">Test Case: Math without dots</h4>

Given the following input:

```r
Math.foo <- function(x) 1
```

We expect the linter to report the following:

```ts
[mismatch('Math.foo', 'Math', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L45) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Math_32_with_32_dots">Test Case: Math with dots</h4>

Given the following input:

```r
Math.foo <- function(x, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Summary_32_with_32_na.rm">Test Case: Summary with na.rm</h4>

Given the following input:

```r
Summary.foo <- function(..., na.rm = FALSE) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_operator_32_methods_32_only_32_need_32_the_32_right_32_number_32_of_32_arguments">Test Case: operator methods only need the right number of arguments</h4>

Given the following input:

```r
"+.foo" <- function(a, b) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L48) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_operator_32_method_32_with_32_the_32_wrong_32_number_32_of_32_arguments">Test Case: operator method with the wrong number of arguments</h4>

Given the following input:

```r
"+.foo" <- function(a) 1
```

We expect the linter to report the following:

```ts
[mismatch('+.foo', '+', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L49) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_subsetting_32_methods_32_take_32_any_32_arguments">Test Case: subsetting methods take any arguments</h4>

Given the following input:

```r
"[.foo" <- function(x, i, j, drop) 1
"$.foo" <- function(x, nm) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_apparent_32_method_32_of_32_a_32_called_32_generic_32_of_32_base_32_R">Test Case: apparent method of a called generic of base R</h4>

Given the following input:

```r
'print.foo <- function(x) 1' + call('print')
```

We expect the linter to report the following:

```ts
[mismatch('print.foo', 'print')]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L54) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_apparent_32_method_32_of_32_a_32_generic_32_never_32_called_32_is_32_not_32_reported">Test Case: apparent method of a generic never called is not reported</h4>

Given the following input:

```r
print.foo <- function(x) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L55) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_apparent_32_method_44__32_but_32_the_32_NAMESPACE_32_does_32_not_32_register_32_it">Test Case: apparent method, but the NAMESPACE does not register it</h4>

Given the following input:

```r
'print.foo <- function(x) 1' + call('print')
```

We expect the linter to report the following:

```ts
[mismatch('print.foo', 'print')]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L56) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_apparent_32_Ops_32_method_32_counts_32_as_32_called_32_through_32_an_32_operator">Test Case: apparent Ops method counts as called through an operator</h4>

Given the following input:

```r
Ops.foo <- function(a, b) 1
f <- function(x) x + 1
```

We expect the linter to report the following:

```ts
[mismatch('Ops.foo', 'Ops')]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L57) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_apparent_32_methods_32_can_32_be_32_turned_32_off">Test Case: apparent methods can be turned off</h4>

Given the following input:

```r
'print.foo <- function(x) 1' + call('print')
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L58) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_registered_32_methods_32_stay_32_with_32_apparent_32_ones_32_turned_32_off">Test Case: registered methods stay with apparent ones turned off</h4>

Given the following input:

```r
print.foo <- function(x) 1
```

We expect the linter to report the following:

```ts
[mismatch('print.foo', 'print', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_methods_32_can_32_be_32_turned_32_off">Test Case: methods can be turned off</h4>

Given the following input:

```r
print.foo <- function(x) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L60) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_t.test_32_is_32_no_32_method_32_of_32_t">Test Case: t.test is no method of t</h4>

Given the following input:

```r
't.test <- function(a, b) 1' + call('t')
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L61) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_rep.int_32_is_32_no_32_method_32_of_32_rep">Test Case: rep.int is no method of rep</h4>

Given the following input:

```r
'rep.int <- function(a) 1' + call('rep')
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_function_32_of_32_the_32_package_32_hides_32_the_32_generic_32_of_32_base_32_R">Test Case: a function of the package hides the generic of base R</h4>

Given the following input:

```r
print <- function(x) 1
print.foo <- function(x) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L63) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_function_32_without_32_a_32_generic">Test Case: a function without a generic</h4>

Given the following input:

```r
foo.bar <- function(x) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L64) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_generic_32_alone_32_is_32_no_32_method">Test Case: a generic alone is no method</h4>

Given the following input:

```r
print <- function(x, ...) UseMethod("print")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_method_32_missing_32_the_32_dots">Test Case: method missing the dots</h4>

Given the following input:

```r
gen + 'gen.foo <- function(x) 1'
```

We expect the linter to report the following:

```ts
[mismatch('gen.foo', 'gen')]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L70) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_method_32_with_32_matching_32_arguments">Test Case: method with matching arguments</h4>

Given the following input:

```r
gen + 'gen.foo <- function(x, y = 2, ...) 1'
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L71) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_generic_32_without_32_dots">Test Case: generic without dots</h4>

Given the following input:

```r
gen <- function(x, y) UseMethod("gen")
gen.foo <- function(x, y, z) 1
```

We expect the linter to report the following:

```ts
[mismatch('gen.foo', 'gen')]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L72) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_registered_32_method_32_of_32_a_32_local_32_generic_32_is_32_certain">Test Case: registered method of a local generic is certain</h4>

Given the following input:

```r
gen + 'gen.foo <- function(a, ...) 1'
```

We expect the linter to report the following:

```ts
[mismatch('gen.foo', 'gen', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_UseMethod_32_of_32_a_32_nested_32_function_32_does_32_not_32_make_32_a_32_generic">Test Case: UseMethod of a nested function does not make a generic</h4>

Given the following input:

```r
gen <- function(x) { h <- function(y) UseMethod("h"); 1 }
gen.foo <- function(a) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefined_32_UseMethod_32_does_32_not_32_make_32_a_32_generic">Test Case: redefined UseMethod does not make a generic</h4>

Given the following input:

```r
UseMethod <- function(...) 1
gen <- function(x, ...) UseMethod("gen")
gen.foo <- function(a) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L75) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_generic_32_with_32_a_32_longer_32_name_32_wins">Test Case: generic with a longer name wins</h4>

Given the following input:

```r
gen <- function(x, ...) UseMethod("gen")
gen.sub <- function(x, ...) UseMethod("gen.sub")
gen.sub.foo <- function(x, a) 1
```

We expect the linter to report the following:

```ts
[mismatch('gen.sub.foo', 'gen.sub')]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L76) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_exported_32_generic_44__32_unregistered_32_method">Test Case: exported generic, unregistered method</h4>

Given the following input:

```r
gen + 'gen.foo <- function(x, ...) 1'
```

We expect the linter to report the following:

* uncertain: kind = `'unregistered-method'`, function = `'gen.foo'`, generic = `'gen'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L81) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_registered_32_method_32_is_32_fine">Test Case: registered method is fine</h4>

Given the following input:

```r
gen + 'gen.foo <- function(x, ...) 1'
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L84) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_generic_32_not_32_exported">Test Case: generic not exported</h4>

Given the following input:

```r
gen + 'gen.foo <- function(x, ...) 1'
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L85) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_export_32_pattern">Test Case: export pattern</h4>

Given the following input:

```r
gen + 'gen.foo <- function(x, ...) 1'
```

We expect the linter to report the following:

* reported: kind = `'unregistered-method'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L86) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_NAMESPACE_44__32_nothing_32_to_32_compare">Test Case: no NAMESPACE, nothing to compare</h4>

Given the following input:

```r
gen + 'gen.foo <- function(x, ...) 1'
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L87) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_exported_32_method_32_of_32_a_32_generic_32_of_32_base_32_R">Test Case: exported method of a generic of base R</h4>

Given the following input:

```r
print.foo <- function(x, ...) 1
```

We expect the linter to report the following:

* reported: kind = `'unregistered-method'`, generic = `'print'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L88) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unexported_32_method_32_of_32_a_32_generic_32_of_32_base_32_R">Test Case: unexported method of a generic of base R</h4>

Given the following input:

```r
print.foo <- function(x, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L89) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_can_32_be_32_turned_32_off">Test Case: can be turned off</h4>

Given the following input:

```r
gen + 'gen.foo <- function(x, ...) 1'
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L90) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_message_32_names_32_the_32_method_32_and_32_the_32_generic">Test Case: message names the method and the generic</h4>

Given the following input:

```r
gen + 'gen.foo <- function(x, ...) 1'
```

We expect the linter to report the following:

* reported: message = `'Apparent S3 method gen.foo for exported generic gen is not registered in the NAMESPACE'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L91) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_value_32_is_32_not_32_last">Test Case: value is not last</h4>

Given the following input:

```r
"foo<-" <- function(value, x) x
```

We expect the linter to report the following:

```ts
[repl('foo<-')]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L98) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_value_32_is_32_missing">Test Case: value is missing</h4>

Given the following input:

```r
"foo<-" <- function(x, val) x
```

We expect the linter to report the following:

```ts
[repl('foo<-')]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L99) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_value_32_last_32_is_32_fine">Test Case: value last is fine</h4>

Given the following input:

```r
"foo<-" <- function(x, i, value) x
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L100) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_backtick_32_name">Test Case: backtick name</h4>

Given the following input:

```r
`foo<-` <- function(x, v) x
```

We expect the linter to report the following:

```ts
[repl('foo<-')]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L101) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_arguments_32_is_32_fine">Test Case: no arguments is fine</h4>

Given the following input:

```r
"foo<-" <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L102) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_percent_32_operators_32_are_32_no_32_replacement_32_functions">Test Case: percent operators are no replacement functions</h4>

Given the following input:

```r
`%in<-%` <- function(a, b) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L103) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_message">Test Case: message</h4>

Given the following input:

```r
"foo<-" <- function(x, val) x
```

We expect the linter to report the following:

* reported: message = `"Replacement function foo<- should have 'value' as its last argument"`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L104) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_location_32_is_32_the_32_name">Test Case: location is the name</h4>

Given the following input:

```r
a <- 1
"foo<-" <- function(x, val) x
```

We expect the linter to report the following:

* reported

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L105) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_registered_32_replacement_32_method">Test Case: registered replacement method</h4>

Given the following input:

```r
"[<-.foo" <- function(x, i, val) x
```

We expect the linter to report the following:

```ts
[{...repl('[<-.foo'), generic: '[<-'}]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L106) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_registered_32_replacement_32_method_44__32_correct">Test Case: registered replacement method, correct</h4>

Given the following input:

```r
"$<-.foo" <- function(x, name, value) x
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L107) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_apparent_32_replacement_32_method_32_of_32_a_32_subsetting_32_generic">Test Case: apparent replacement method of a subsetting generic</h4>

Given the following input:

```r
"[<-.foo" <- function(x, i, val) x
```

We expect the linter to report the following:

```ts
[repl('[<-.foo', Uncertain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L108) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_replacement_32_method_32_of_32_a_32_generic_32_of_32_the_32_package">Test Case: replacement method of a generic of the package</h4>

Given the following input:

```r
"gen<-" <- function(x, value) UseMethod("gen<-")
"gen<-.foo" <- function(x, v) x
```

We expect the linter to report the following:

```ts
[mismatch('gen<-.foo', 'gen<-'), repl('gen<-.foo', Uncertain)].map(r => ({kind: r.kind, certainty: r.certainty}))
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L109) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_dot_32_name_32_that_32_is_32_no_32_replacement_32_generic">Test Case: a dot name that is no replacement generic</h4>

Given the following input:

```r
"foo<-.bar" <- function(x, v) x
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L110) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_can_32_be_32_turned_32_off">Test Case: can be turned off</h4>

Given the following input:

```r
"foo<-" <- function(x, val) x
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L111) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_t_32_takes_32_no_32_dots">Test Case: t takes no dots</h4>

Given the following input:

```r
t.foo <- function(x) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L115) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_rev_32_takes_32_no_32_dots">Test Case: rev takes no dots</h4>

Given the following input:

```r
rev.foo <- function(x) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L116) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_t_32_method_32_with_32_other_32_arguments">Test Case: t method with other arguments</h4>

Given the following input:

```r
t.foo <- function(y) 1
```

We expect the linter to report the following:

```ts
[mismatch('t.foo', 't', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L117) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_transform_32_takes_32__data">Test Case: transform takes _data</h4>

Given the following input:

```r
transform.foo <- function(`_data`, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L118) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_trunc_32_takes_32_dots">Test Case: trunc takes dots</h4>

Given the following input:

```r
trunc.foo <- function(x, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L119) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_cumsum_32_takes_32_no_32_dots">Test Case: cumsum takes no dots</h4>

Given the following input:

```r
cumsum.foo <- function(x) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L120) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_plot_32_methods_32_are_32_fine">Test Case: plot methods are fine</h4>

Given the following input:

```r
plot.foo <- function(x, y, ...) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L121) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dim.def.nc_32_of_32_RNetCDF_32_is_32_no_32_method">Test Case: dim.def.nc of RNetCDF is no method</h4>

Given the following input:

```r
dim.def.nc <- function(ncfile, name) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L126) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dim.inq.nc_32_of_32_RNetCDF_32_is_32_no_32_method">Test Case: dim.inq.nc of RNetCDF is no method</h4>

Given the following input:

```r
dim.inq.nc <- function(ncfile, name) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L127) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_the_32_same_32_name_32_in_32_another_32_package_32_is_32_checked">Test Case: the same name in another package is checked</h4>

Given the following input:

```r
dim.def.nc <- function(ncfile, name) 1
```

We expect the linter to report the following:

```ts
[mismatch('dim.def.nc', 'dim', Certain)]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L128) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_nested_32_functions_32_are_32_no_32_package-level_32_methods">Test Case: nested functions are no package-level methods</h4>

Given the following input:

```r
f <- function() { print.foo <- function(x) 1 }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L132) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_functions_32_outside_32_of_32_R/_32_are_32_ignored">Test Case: functions outside of R/ are ignored</h4>

Given the following input:

```r
print.foo <- function(x) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L133) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_replacement_32_functions_32_outside_32_of_32_R/_32_are_32_ignored">Test Case: replacement functions outside of R/ are ignored</h4>

Given the following input:

```r
"foo<-" <- function(x, val) x
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L134) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_several_32_problems_32_at_32_once">Test Case: several problems at once</h4>

Given the following input:

```r
print.foo <- function(x) 1
"foo<-" <- function(x, v) x
```

We expect the linter to report the following:

* reported: kind = `'argument-mismatch'`, function = `'print.foo'`
* reported: kind = `'replacement-value'`, function = `'foo<-'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-s-three-method-consistency.test.ts#L135) for the test-case implementation.