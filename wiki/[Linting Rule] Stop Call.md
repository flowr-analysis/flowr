_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-24, 20:38:50 UTC (v2.16.6), do not edit directly._
<h2 id="stop-call">Stop Without Call&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds `stop()` calls that do not set `call.` to `FALSE`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/stop-with-call-arg.ts#L61">src/linter/rules/stop-with-call-arg.ts</a>._

### Examples

```r
f <- function(x) stop(x)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "stop-call",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Stop Without Call** (stop-call):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ `stop()` without `call. = FALSE` at 1.18-24 (1 quick fix(es) available)

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-stop-call.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts)

<h4 id="Test_32_Case:_32_single_32_stop">Test Case: single stop</h4>

Given the following input:

```r
f <- function(x) stop(x)
```

We expect the linter to report the following:

* uncertain: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L11) for the test-case implementation.

<h4 id="Test_32_Case:_32_stop_32_with_32_set_32_to_32_true">Test Case: stop with set to true</h4>

Given the following input:

```r
f <- function(y) stop(y, call.=TRUE)
```

We expect the linter to report the following:

* uncertain: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-stop-call.test.ts#L20) for the test-case implementation.

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

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**none**

```r
x <- 1
```

**a top-level stop has no call to append**

```r
stop(x)
```

**single stop with arg**

```r
f <- function(x) stop(x, call.=FALSE)
```

**shadow call.**

```r
stop <- function(x, call.){return 0}
f <- function() stop(3, call.=TRUE)
```

**resolve flag in stop**

```r
f <- function(y) { x <- FALSE; stop(y, call.=x) }
```

**a condition object carries its own call**

```r
f <- function() stop(simpleError("x"))
```

**a condition object built with structure**

```r
f <- function() stop(structure(class = c("myError", "error", "condition"), list(message = "m", call = NULL)))
```

**stop handed to do.call states its arguments there**

```r
f <- function() { args <- list("m", call. = FALSE); do.call(stop, args) }
```