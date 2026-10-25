_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="dead-code">Dead Code&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds code that is never reached during execution.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/dead-code.ts#L31">src/linter/rules/dead-code.ts</a>._

### Examples

```r

f <- function(x) {
	return(x)
	print("never reached")
}
if(TRUE) 1 else 2
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "dead-code",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (5 ms)\
&nbsp;&nbsp;&nbsp;╰ **Dead Code** (dead-code):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Code at 4.2-23 (1 quick fix(es) available)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Code at 6.17

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-dead-code.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts)

<h4 id="Test_32_Case:_32_always">Test Case: always</h4>

Given the following input:

```r
if(TRUE) 1 else 2
```

We expect the linter to report the following:

* certain at 1.17-1.17

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L12) for the test-case implementation.

<h4 id="Test_32_Case:_32_never">Test Case: never</h4>

Given the following input:

```r
if(FALSE) 1 else 2
```

We expect the linter to report the following:

* certain at 1.11-1.11

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L15) for the test-case implementation.

<h4 id="Test_32_Case:_32_no_32_analysis">Test Case: no analysis</h4>

> The dataflow analysis already resolves a constant condition away, so the branch it drops is gone
from the control flow whether or not the dead code pass runs on top.
/

Given the following input:

```r
if(FALSE) 1 else 2
```

And using the following [configuration](#configuration): 
```ts
{simplificationPasses: DefaultCfgSimplificationOrder}
```

We expect the linter to report the following:

* certain at 1.11-1.11

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L22) for the test-case implementation.

<h4 id="Test_32_Case:_32_stopifnot_32_false">Test Case: stopifnot false</h4>

Given the following input:

```r
if(TRUE) 1; stopifnot(FALSE); 2
```

We expect the linter to report the following:

* certain at 1.31-1.31: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L29) for the test-case implementation.

<h4 id="Test_32_Case:_32_stop_32_condition">Test Case: stop condition</h4>

Given the following input:

```r

x <- 2

if(u) {
  stop(42)
  x <- 3
}

print(2)
```

We expect the linter to report the following:

* certain at 6.3-6.8: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L32) for the test-case implementation.

<h4 id="Test_32_Case:_32_return">Test Case: return</h4>

Given the following input:

```r
function() {
return(); 2}
```

We expect the linter to report the following:

* certain at 2.11-2.11: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L44) for the test-case implementation.

<h4 id="Test_32_Case:_32_try_32_complex">Test Case: try complex</h4>

Given the following input:

```r
f <- function() { try(stop(1)); 2 }; f(); stop(1); 2
```

We expect the linter to report the following:

* certain at 1.52-1.52: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L48) for the test-case implementation.

<h4 id="Test_32_Case:_32_always">Test Case: always</h4>

Given the following input:

```r
x <- TRUE; if(x) 1 else 2
```

We expect the linter to report the following:

* certain at 1.25-1.25

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L54) for the test-case implementation.

<h4 id="Test_32_Case:_32_never">Test Case: never</h4>

Given the following input:

```r
x <- FALSE; if(x) 1 else 2
```

We expect the linter to report the following:

* certain at 1.19-1.19

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L57) for the test-case implementation.

<h4 id="Test_32_Case:_32_TRUE_32_FALSE">Test Case: TRUE FALSE</h4>

Given the following input:

```r
if(TRUE) 1 else if (FALSE) 2 else 3
```

We expect the linter to report the following:

* certain at 1.17-1.35: involvedId = `['1@[2]if', '1@FALSE', '1@2', '1@3', '$5', '$7', '$9']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L63) for the test-case implementation.

<h4 id="Test_32_Case:_32_FALSE_32_FALSE">Test Case: FALSE FALSE</h4>

Given the following input:

```r
if(FALSE) 1 else if (FALSE) 2 else 3
```

We expect the linter to report the following:

* certain at 1.11-1.11: involvedId = `['1@1', '$2']`
* certain at 1.29-1.29: involvedId = `['1@2', '$5']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L66) for the test-case implementation.

<h4 id="Test_32_Case:_32_FALSE_32_TRUE">Test Case: FALSE TRUE</h4>

Given the following input:

```r
if(FALSE) 1 else if (TRUE) 2 else 3
```

We expect the linter to report the following:

* certain at 1.11-1.11: involvedId = `['1@1', '$2']`
* certain at 1.35-1.35: involvedId = `['1@3', '$7']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L70) for the test-case implementation.

<h4 id="Test_32_Case:_32_code_32_after_32_the_32_return_32_inside_32_local_32_is_32_dead">Test Case: code after the return inside local is dead</h4>

Given the following input:

```r
f <- function() {
  local({ return(1); 3 })
  2
}
```

We expect the linter to report the following:

* certain at 2.22-2.22: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L85) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_return_32_after_32_the_32_local_32_still_32_makes_32_the_32_tail_32_dead">Test Case: a return after the local still makes the tail dead</h4>

Given the following input:

```r
f <- function() {
  local({ return(1) })
  return(2)
  3
}
```

We expect the linter to report the following:

* certain at 4.3-4.3: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L88) for the test-case implementation.

<h4 id="Test_32_Case:_32_on.exit_40_return_41__32_does_32_not_32_poison_32_enclosing_32_function">Test Case: on.exit(return) does not poison enclosing function</h4>

> // on.exit(expr) registers expr to run at function exit

Given the following input:

```r
f <- function() {
  on.exit(return(3))
  x <- 1
  x
}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L95) for the test-case implementation.

<h4 id="Test_32_Case:_32_in-arm_32_code_32_after_32_a_32_stop_32_is_32_dead">Test Case: in-arm code after a stop is dead</h4>

Given the following input:

```r
f <- function(k) {
  switch(k, a = { stop("x"); y <- 1 }, b = 2)
}
```

We expect the linter to report the following:

* certain at 2.30-2.35: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L101) for the test-case implementation.

<h4 id="Test_32_Case:_32_all_32_arms_32_return_32_for_32_a_32_string_32_selector_32_makes_32_the_32_tail_32_dead">Test Case: all arms return for a string selector makes the tail dead</h4>

Given the following input:

```r
f <- function() {
  switch("c", a = return(1), return(3))
  after <- 1
  after
}
```

We expect the linter to report the following:

* certain at 3.3-3.12: 1 quick fix
* certain at 4.3-4.7: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L107) for the test-case implementation.

<h4 id="Test_32_Case:_32_constant_32_selector_32_kills_32_the_32_other_32_arms">Test Case: constant selector kills the other arms</h4>

Given the following input:

```r
f <- function() {
  x <- switch("b", a = 1, b = 2, c = 3)
  x
}
```

We expect the linter to report the following:

* certain at 2.20-2.20
* certain at 2.24-2.24
* certain at 2.34-2.34
* certain at 2.38-2.38

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L115) for the test-case implementation.

<h4 id="Test_32_Case:_32_no_32_match_32_no_32_default_32_kills_32_all_32_arms">Test Case: no match no default kills all arms</h4>

Given the following input:

```r
f <- function() {
  switch("z", a = 1, b = 2)
  after <- 1
  after
}
```

We expect the linter to report the following:

* certain at 2.15-2.15
* certain at 2.19-2.19
* certain at 2.22-2.22
* certain at 2.26-2.26

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L121) for the test-case implementation.

<h4 id="Test_32_Case:_32_no_32_match_32_selects_32_the_32_default">Test Case: no match selects the default</h4>

Given the following input:

```r
f <- function() {
  x <- switch("z", a = 1, 99)
  x
}
```

We expect the linter to report the following:

* certain at 2.20-2.20
* certain at 2.24-2.24

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L127) for the test-case implementation.

<h4 id="Test_32_Case:_32_code_32_after_32_an_32_early_32_return">Test Case: code after an early return</h4>

> // leftover statement after the function's own return

Given the following input:

```r
f <- function(x) {
  if (x < 0) return(NA)
  y <- sqrt(x)
  return(y)
  cat("done\
")
}
```

We expect the linter to report the following:

* certain at 5.3-5.15: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L142) for the test-case implementation.

<h4 id="Test_32_Case:_32_live_32_switch_32_but_32_dead_32_tail">Test Case: live switch but dead tail</h4>

Given the following input:

```r
classify <- function(type, value) {
  scale <- switch(type, small = 1, large = 100, stop("unknown"))
  adjusted <- value * scale
  return(adjusted)
  message("unreachable")
}
```

We expect the linter to report the following:

* certain at 5.3-5.24: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L145) for the test-case implementation.

<h4 id="Test_32_Case:_32_after_32_infinite_32_repeat">Test Case: after infinite repeat</h4>

Given the following input:

```r
repeat{ foo }; 2
```

We expect the linter to report the following:

* certain at 1.16-1.16: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L157) for the test-case implementation.

<h4 id="Test_32_Case:_32_after_32_infinite_32_while">Test Case: after infinite while</h4>

Given the following input:

```r
while(TRUE){ foo }; 2
```

We expect the linter to report the following:

* certain at 1.21-1.21: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-dead-code.test.ts#L161) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**none**

```r
x <- 1
```

**stopifnot true**

```r
if(TRUE) 1; stopifnot(TRUE); 2
```

**try**

```r
try(stop(1)); 2
```

**ifelse constant**

```r
ifelse(TRUE, 1, 2)
```

**ifelse non-constant**

```r
x <- 1
ifelse(x > 0, x, -x)
```

**fifelse constant**

```r
fifelse(TRUE, 1, 2)
```

**if_else constant**

```r
if_else(TRUE, 1, 2)
```

**return inside local only leaves local**

```r
f <- function() {
  local({ return(1) })
  2
}
print(f())
```

**sibling arms after a stop arm stay live**

```r
f <- function(k) {
  switch(k, a = stop("x"), b = 2, c = 3)
  after <- 1
  after
}
```

**code after a switch with a stop arm stays live**

```r
f <- function(k) {
  r <- switch(k, a = stop("x"), b = 2)
  r
}
```

**stop in the default arm keeps siblings and after live**

```r
f <- function(k) {
  switch(k, a = 1, b = 2, stop("x"))
  after <- 1
  after
}
```

**a numeric selector past the arms picks none**

```r
f <- function(k) {
  switch(k, a = return(1), b = return(2), return(3))
  after <- 1
  after
}
```

**numeric selector out of range falls through**

```r
f <- function(n) {
  switch(n, a = return(1), stop("bad"))
  9
}
f(3)
```

**empty fall-through arms are not dead**

```r
f <- function(k) {
  switch(k, a =, b = 2, c = 3)
  after <- 1
  after
}
```

**constant selector into an empty fall-through arm**

```r
f <- function() {
  x <- switch("a", a =, b = 2)
  x
}
```

**non-constant selector prunes nothing**

```r
f <- function(k) {
  x <- switch(k, a = 1, b = 2)
  x
}
```

**|| return guard**

```r
f <- function(x) {
  x || return()
  after <- 1
  after
}
```

**&& stop guard**

```r
f <- function(x) {
  x && stop("no")
  after <- 1
  after
}
```

**exists**

```r
x <- 1
if(exists("x")) print(1)
```

**get**

```r
x <- 1
print(get("x"))
```

**get with envir**

```r
e <- new.env()
assign("x", 1, envir = e)
print(get("x", envir = e))
```

**a condition the loop changes for its next iteration**

```r
run <- TRUE
s <- FALSE
while(run) {
  if(s) run <- FALSE
  s <- TRUE
}
print("done")
```