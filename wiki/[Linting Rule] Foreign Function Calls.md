_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="foreign-function-calls">Foreign Function Calls&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a `best-effort` rule.
 
Port of the `R CMD check` notes of `checking foreign function calls`: calls of `.C`, `.Fortran`, `.Call` or `.External` naming a routine by a string without a `PACKAGE` argument in a package that loads no DLL with `useDynLib`, with an empty `PACKAGE`, or with a `PACKAGE` naming a base package, a different package, or a package the DESCRIPTION does not declare. Unlike `R CMD check`, it recognizes the calls by what flowR knows about them (ignoring a redefined `.Call`), resolves routine and `PACKAGE` through variables, and accepts any DLL the NAMESPACE loads. It does not check the registration of the routines, which needs the installed package.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/foreign-function-calls.ts#L68">src/linter/rules/cmd-check/foreign-function-calls.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `foreign-function-calls` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/foreign-function-calls.ts#L42"><code><span title="also resolve the routine and PACKAGE through variables, which R CMD check cannot see (default true)">resolveValues</span></code></a>\
also resolve the routine and `PACKAGE` through variables, which `R CMD check` cannot see (default `true`)

### Examples

```r
f <- function(x) .Call("C_mean", x)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "foreign-function-calls",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (5 ms)\
&nbsp;&nbsp;&nbsp;╰ **Foreign Function Calls** (foreign-function-calls):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ .Call("C_mean"): missing-package at 1.18-35\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "foreign-function-calls": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 8,
            "loc": [1,18,1,35],
            "issue": "missing-package",
            "call": ".Call",
            "routine": "C_mean",
            "message": "Foreign function call without 'PACKAGE' argument: .Call(\"C_mean\", ...)"
          }
        ],
        ".meta": {"consideredCalls":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts)

<h4 id="Test_32_Case:_32_.Call_32_with_32_a_32_string_32_routine">Test Case: .Call with a string routine</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x)
```

We expect the linter to report the following:

* certain: issue = `'missing-package'`, call = `'.Call'`, routine = `'foo'`, message = `'Foreign function call without \'PACKAGE\' argument: .Call("foo", ...)'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L13) for the test-case implementation.
		
<h4 id="Test_32_Case:_32__36__123_fn_125__32_with_32_a_32_string_32_routine">Test Case: ${fn} with a string routine</h4>

Given the following input:

```r
f <- function(x) ${fn}("foo", x)
```

We expect the linter to report the following:

* reported: issue = `'missing-package'`, call = `fn`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_namespaced_32_base::.Call">Test Case: namespaced base::.Call</h4>

Given the following input:

```r
f <- function(x) base::.Call("foo", x)
```

We expect the linter to report the following:

* reported: issue = `'missing-package'`, call = `'.Call'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_calls_32_that_32_are_32_no_32_foreign_32_function_32_calls_32_are_32_skipped">Test Case: calls that are no foreign function calls are skipped</h4>

Given the following input:

```r
f <- function(x) paste("foo", x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_reports_32_the_32_location_32_of_32_the_32_call">Test Case: reports the location of the call</h4>

Given the following input:

```r
f <- function(x) {
  .Call("foo", x)
}
```

We expect the linter to report the following:

* reported

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L21) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_top-level_32_call">Test Case: top-level call</h4>

Given the following input:

```r
.C("foo")
```

We expect the linter to report the following:

* reported: issue = `'missing-package'`, routine = `'foo'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L24) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_reports_32_every_32_call">Test Case: reports every call</h4>

Given the following input:

```r
f <- function() { .Call("a"); .C("b") }
```

We expect the linter to report the following:

* reported: routine = `'a'`
* reported: routine = `'b'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_NAMESPACE_32_without_32_useDynLib">Test Case: NAMESPACE without useDynLib</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x)
```

We expect the linter to report the following:

* reported: issue = `'missing-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_routine_32_named_32_by_32_a_32_named_32_argument">Test Case: routine named by a named argument</h4>

Given the following input:

```r
f <- function(x) .Call(.NAME = "foo", x)
```

We expect the linter to report the following:

* reported: issue = `'missing-package'`, routine = `'foo'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_useDynLib_32_in_32_the_32_NAMESPACE">Test Case: useDynLib in the NAMESPACE</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L31) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_useDynLib_32_with_32_registration">Test Case: useDynLib with registration</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_useDynLib_32_with_32_symbols">Test Case: useDynLib with symbols</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L33) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_useDynLib_32_with_32_a_32_quoted_32_name">Test Case: useDynLib with a quoted name</h4>

Given the following input:

```r
f <- function(x) .C("foo", x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_routine_32_passed_32_as_32_a_32_symbol">Test Case: routine passed as a symbol</h4>

Given the following input:

```r
f <- function(x) .Call(foo, x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_routine_32_passed_32_as_32_a_32_prefixed_32_symbol">Test Case: routine passed as a prefixed symbol</h4>

Given the following input:

```r
f <- function(x) .Call(C_foo, x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L36) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_routine_32_passed_32_as_32_a_32_call">Test Case: routine passed as a call</h4>

Given the following input:

```r
f <- function(x) .Call(getNativeSymbolInfo("foo"), x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L37) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_routine_32_passed_32_as_32_dots">Test Case: routine passed as dots</h4>

Given the following input:

```r
f <- function(...) .Call(...)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_routine_32_in_32_a_32_variable_32_holding_32_a_32_string_44__32_resolution_32_off">Test Case: routine in a variable holding a string, resolution off</h4>

Given the following input:

```r
nm <- "foo"
f <- function(x) .Call(nm, x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unresolvable_32_routine_32_variable">Test Case: unresolvable routine variable</h4>

Given the following input:

```r
f <- function(nm, x) .Call(nm, x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L40) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_PACKAGE_32_with_32_the_32_package_32_name">Test Case: PACKAGE with the package name</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "pkg")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_PACKAGE_32_is_32_not_32_partially_32_matched">Test Case: PACKAGE is not partially matched</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACK = "pkg")
```

We expect the linter to report the following:

* reported: issue = `'missing-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L42) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unresolvable_32_PACKAGE">Test Case: unresolvable PACKAGE</h4>

Given the following input:

```r
f <- function(p, x) .Call("foo", x, PACKAGE = p)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L43) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_empty_32_string">Test Case: empty string</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "")
```

We expect the linter to report the following:

* reported: issue = `'empty-package'`, call = `'.Call'`, package = `''`, message = `'Foreign function call with empty \'PACKAGE\' argument: .Call("foo", ...)'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_empty_32_string_32_with_32_useDynLib">Test Case: empty string with useDynLib</h4>

Given the following input:

```r
f <- function(x) .C("foo", x, PACKAGE = "")
```

We expect the linter to report the following:

* reported: issue = `'empty-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L48) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_empty_32_string_32_through_32_a_32_variable">Test Case: empty string through a variable</h4>

Given the following input:

```r
p <- ""
f <- function(x) .Call("foo", x, PACKAGE = p)
```

We expect the linter to report the following:

* reported: issue = `'empty-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L49) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_base_32_package">Test Case: base package</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "stats")
```

We expect the linter to report the following:

* reported: issue = `'base-package'`, package = `'stats'`, message = `'Foreign function call to a base package: .Call("foo", ...)'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_non-attached_32_base_32_package">Test Case: non-attached base package</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "tools")
```

We expect the linter to report the following:

* reported: issue = `'base-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L56) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_declared_32_different_32_package">Test Case: declared different package</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "other")
```

We expect the linter to report the following:

* reported: issue = `'different-package'`, package = `'other'`, message = `'Foreign function call to a different package: .Call("foo", ...)'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L57) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_different_32_package">Test Case: undeclared different package</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "other")
```

We expect the linter to report the following:

* reported: issue = `'different-package'`, package = `'other'`
* reported: issue = `'undeclared-package'`, package = `'other'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L60) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_package_32_message">Test Case: undeclared package message</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "other")
```

We expect the linter to report the following:

* reported: message = `'Foreign function call to a different package: .Call("foo", ...)'`
* reported: message = `'Undeclared package "other" in foreign function call: .Call("foo", ...)'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L64) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Suggests_32_counts_32_as_32_declared">Test Case: Suggests counts as declared</h4>

Given the following input:

```r
f <- function(x) .C("foo", x, PACKAGE = "other")
```

We expect the linter to report the following:

* reported: issue = `'different-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_LinkingTo_32_does_32_not_32_declare">Test Case: LinkingTo does not declare</h4>

Given the following input:

```r
f <- function(x) .C("foo", x, PACKAGE = "other")
```

We expect the linter to report the following:

* reported: issue = `'different-package'`
* reported: issue = `'undeclared-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L69) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_PACKAGE_32_through_32_a_32_variable">Test Case: PACKAGE through a variable</h4>

Given the following input:

```r
p <- "stats"
f <- function(x) .Call("foo", x, PACKAGE = p)
```

We expect the linter to report the following:

* reported: issue = `'base-package'`, package = `'stats'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L70) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_PACKAGE_32_through_32_a_32_variable_44__32_resolution_32_off">Test Case: PACKAGE through a variable, resolution off</h4>

Given the following input:

```r
p <- "stats"
f <- function(x) .Call("foo", x, PACKAGE = p)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L71) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_DLL_32_of_32_the_32_NAMESPACE_32_is_32_fine">Test Case: DLL of the NAMESPACE is fine</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "mylib")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L72) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_other_32_package_32_than_32_the_32_DLL">Test Case: other package than the DLL</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "other")
```

We expect the linter to report the following:

* reported: issue = `'different-package'`
* reported: issue = `'undeclared-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_symbol_32_routine_32_with_32_a_32_base_32_PACKAGE">Test Case: symbol routine with a base PACKAGE</h4>

Given the following input:

```r
f <- function(x) .Call(foo, x, PACKAGE = "stats")
```

We expect the linter to report the following:

* reported: issue = `'base-package'`, call = `'.Call'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_DESCRIPTION_44__32_no_32_package_32_to_32_compare_32_with">Test Case: no DESCRIPTION, no package to compare with</h4>

Given the following input:

```r
f <- function(x) .Call("foo", x, PACKAGE = "other")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L75) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_routine_32_resolved_32_through_32_a_32_variable">Test Case: routine resolved through a variable</h4>

Given the following input:

```r
nm <- "foo"
f <- function(x) .Call(nm, x)
```

We expect the linter to report the following:

* reported: issue = `'missing-package'`, routine = `'foo'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L79) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefined_32_.Call">Test Case: redefined .Call</h4>

Given the following input:

```r
.Call <- function(...) 1
f <- function(x) .Call("foo", x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L80) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_shadowing_32_local_32_.C">Test Case: shadowing local .C</h4>

Given the following input:

```r
f <- function(x) { .C <- function(...) 1; .C("foo", x) }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L81) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_other_32_native_32_functions_32_are_32_no_32_foreign_32_calls">Test Case: other native functions are no foreign calls</h4>

Given the following input:

```r
f <- function() dyn.load("foo.so")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L82) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_code_32_is_32_no_32_package_32_code">Test Case: test code is no package code</h4>

Given the following input:

```r
.Call("foo")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L86) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_inst_32_code_32_is_32_no_32_package_32_code">Test Case: inst code is no package code</h4>

Given the following input:

```r
.Call("foo")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-foreign-function-calls.test.ts#L87) for the test-case implementation.