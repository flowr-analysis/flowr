_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 06:47:02 UTC (v2.16.2), do not edit directly._
<h2 id="stop-call">Stop Without Call&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span>

This rule is a `best-effort` rule.
 
Finds `stop()` calls that do not set `call.` to `FALSE`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/stop-with-call-arg.ts#L62">src/linter/rules/stop-with-call-arg.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `stop-call` rule accepts the following configuration options:

### Examples

```r
f <- function(x) stop(x)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "stop-call",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Stop Without Call** (stop-call):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ `stop()` without `call. = FALSE` at 1.18-24 (1 quick fix(es) available)

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "stop-call": {
        "results": [
          {
            "certainty": "uncertain",
            "involvedId": 6,
            "loc": [1,18,1,24],
            "quickFix": [{"type":"replace","loc":[1,24,1,23],"description":"Add `call. = FALSE`","replacement":", call. = FALSE"}]
          }
        ],
        ".meta": {"consideredNodes":0}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-stop-call.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts)

<h4 id="Test_32_Case:_32_none">Test Case: none</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L9) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_top-level_32_stop_32_has_32_no_32_call_32_to_32_append">Test Case: a top-level stop has no call to append</h4>

Given the following input:

```r
stop(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L10) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_single_32_stop">Test Case: single stop</h4>

Given the following input:

```r
f <- function(x) stop(x)
```

We expect the linter to report the following:

* uncertain: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L11) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_single_32_stop_32_with_32_arg">Test Case: single stop with arg</h4>

Given the following input:

```r
f <- function(x) stop(x, call.=FALSE)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_shadow_32_call.">Test Case: shadow call.</h4>

Given the following input:

```r
stop <- function(x, call.){return 0}
f <- function() stop(3, call.=TRUE)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_stop_32_with_32_set_32_to_32_true">Test Case: stop with set to true</h4>

Given the following input:

```r
f <- function(y) stop(y, call.=TRUE)
```

We expect the linter to report the following:

* uncertain: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_resolve_32_flag_32_in_32_stop">Test Case: resolve flag in stop</h4>

Given the following input:

```r
f <- function(y) { x <- FALSE; stop(y, call.=x) }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_condition_32_object_32_carries_32_its_32_own_32_call">Test Case: a condition object carries its own call</h4>

Given the following input:

```r
f <- function() stop(simpleError("x"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_condition_32_object_32_built_32_with_32_structure">Test Case: a condition object built with structure</h4>

Given the following input:

```r
f <- function() stop(structure(class = c("myError", "error", "condition"), list(message = "m", call = NULL)))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_stop_32_handed_32_to_32_do.call_32_states_32_its_32_arguments_32_there">Test Case: stop handed to do.call states its arguments there</h4>

Given the following input:

```r
f <- function() { args <- list("m", call. = FALSE); do.call(stop, args) }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L30) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_direct_32_stop_32_beside_32_one_32_handed_32_to_32_do.call_32_is_32_still_32_reported">Test Case: a direct stop beside one handed to do.call is still reported</h4>

Given the following input:

```r
f <- function() { args <- list("m", call. = FALSE); do.call(stop, args); stop("y") }
```

We expect the linter to report the following:

* uncertain: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L31) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_an_32_object_32_built_32_with_32_structure_32_but_32_no_32_condition_32_class_32_is_32_reported">Test Case: an object built with structure but no condition class is reported</h4>

Given the following input:

```r
f <- function() stop(structure(class = "myError", list(message = "m", call = NULL)))
```

We expect the linter to report the following:

* uncertain: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_qualified_32_base::stop">Test Case: a qualified base::stop</h4>

Given the following input:

```r
f <- function() base::stop("x")
```

We expect the linter to report the following:

* uncertain: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L37) for the test-case implementation.