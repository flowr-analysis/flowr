_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="seeded-randomness">Seeded Randomness&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds randomness-based function calls not preceded by a random seed generation function. For consistent reproducibility, functions that use randomness should only be called after a constant random seed is set using a function like `set.seed`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/seeded-randomness.ts#L62">src/linter/rules/seeded-randomness.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `seeded-randomness` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/seeded-randomness.ts#L51"><code><span title="A set of randomness consumer function names that require a seed to be set prior to invocation.">randomnessConsumers</span></code></a>\
A set of randomness consumer function names that require a seed to be set prior to invocation.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/seeded-randomness.ts#L47"><code><span title="A set of functions and variables whose invocation or assignment causes a random seeded to be set. Each entry has a type, which is either function or assignment, and a name, which is the name of the function or variable. The default value for this is the function set.seed and the variable .Random.seed.">randomnessProducers</span></code></a>\
A set of functions and variables whose invocation or assignment causes a random seeded to be set.
Each entry has a `type`, which is either `function` or `assignment`, and a `name`, which is the name of the function or variable.
The default value for this is the function `set.seed` and the variable `.Random.seed`.

### Examples

```r
runif(1)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "seeded-randomness",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Seeded Randomness** (seeded-randomness):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function `runif` at 1.1-8

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-seeded-randomness.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts)

<h4 id="Test_32_Case:_32_no_32_producer">Test Case: no producer</h4>

Given the following input:

```r
runif(1)
```

We expect the linter to report the following:

* certain at 1.1-1.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L17) for the test-case implementation.

<h4 id="Test_32_Case:_32_with_seed_32_restores_32_the_32_state">Test Case: with_seed restores the state</h4>

Given the following input:

```r
withr::with_seed(1, 1)
runif(1)
```

We expect the linter to report the following:

* certain at 2.1-2.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L20) for the test-case implementation.

<h4 id="Test_32_Case:_32_with_seed_32_does_32_not_32_seed_32_a_32_draw_32_after_32_it">Test Case: with_seed does not seed a draw after it</h4>

Given the following input:

```r
withr::with_seed(1, runif(1))
runif(1)
```

We expect the linter to report the following:

* certain at 2.1-2.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L22) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_namespaced_32_draw">Test Case: a namespaced draw</h4>

Given the following input:

```r
stats::runif(1)
```

We expect the linter to report the following:

* certain at 1.1-1.15: function = `'stats::runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L25) for the test-case implementation.

<h4 id="Test_32_Case:_32_after">Test Case: after</h4>

Given the following input:

```r
runif(1)
set.seed(17)
```

We expect the linter to report the following:

* certain at 1.1-1.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L29) for the test-case implementation.

<h4 id="Test_32_Case:_32_with_32_a_32__40_controlled_41__32_package_32_database">Test Case: with a (controlled) package database</h4>

> // regression: the loaded-package export must still count as a built-in call target

Given the following input:

```r
library(stats)
runif(1)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('stats', ['runif'])}
```

We expect the linter to report the following:

* certain at 2.1-2.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L38) for the test-case implementation.

<h4 id="Test_32_Case:_32_without_32_any_32_package_32_database">Test Case: without any package database</h4>

Given the following input:

```r
library(stats)
runif(1)
```

And using the following [configuration](#configuration): 
```ts
{noSigDb: true}
```

We expect the linter to report the following:

* certain at 2.1-2.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L42) for the test-case implementation.

<h4 id="Test_32_Case:_32_invalid">Test Case: invalid</h4>

Given the following input:

```r
for(i in 1:10) { runif(1); }
```

We expect the linter to report the following:

* certain at 1.18-1.25: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L49) for the test-case implementation.

<h4 id="Test_32_Case:_32_false">Test Case: false</h4>

Given the following input:

```r
if(FALSE) { set.seed(17); }
runif(1);
```

We expect the linter to report the following:

* certain at 2.1-2.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L57) for the test-case implementation.

<h4 id="Test_32_Case:_32_unclear">Test Case: unclear</h4>

Given the following input:

```r
if(u) { set.seed(17); }
runif(1);
```

We expect the linter to report the following:

* uncertain at 2.1-2.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L60) for the test-case implementation.

<h4 id="Test_32_Case:_32_unclear">Test Case: unclear</h4>

Given the following input:

```r
if(u) {} else { set.seed(17); }
runif(1);
```

We expect the linter to report the following:

* uncertain at 2.1-2.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L62) for the test-case implementation.

<h4 id="Test_32_Case:_32_separate">Test Case: separate</h4>

Given the following input:

```r
if (u) { set.seed(17) }; if (u) { runif(1) }
```

We expect the linter to report the following:

* uncertain at 1.35-1.42: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L67) for the test-case implementation.

<h4 id="Test_32_Case:_32_nested_32_producer_32_false">Test Case: nested producer false</h4>

Given the following input:

```r
if(TRUE) { if(FALSE) { set.seed(17); }
runif(1); }
```

We expect the linter to report the following:

* certain at 2.1-2.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L70) for the test-case implementation.

<h4 id="Test_32_Case:_32_set_32_.Random.seed_32_override_32__60_-">Test Case: set .Random.seed override <-</h4>

Given the following input:

```r
`<-`<-function(){}
.Random.seed <- 17
runif(1)
```

We expect the linter to report the following:

* certain at 3.1-3.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L82) for the test-case implementation.

<h4 id="Test_32_Case:_32_non-constant_32_seed">Test Case: non-constant seed</h4>

Given the following input:

```r
num<-as.numeric(Sys.time());
set.seed(num);
runif(1);
```

We expect the linter to report the following:

* certain at 3.1-3.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L89) for the test-case implementation.

<h4 id="Test_32_Case:_32_random_32_seed">Test Case: random seed</h4>

Given the following input:

```r
set.seed(runif(1));
runif(1);
```

We expect the linter to report the following:

```ts
[
	{loc: [1, 10, 1, 17], function: 'runif', certainty: LintingResultCertainty.Certain},
	{loc: [2, 1, 2, 8], function: 'runif', certainty: LintingResultCertainty.Certain} /* the `runif` inside the seed runs before the seed is set,
	so only the one after it has a producer */
]
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L92) for the test-case implementation.

<h4 id="Test_32_Case:_32_custom_32_set.seed">Test Case: custom set.seed</h4>

Given the following input:

```r
set.seed <- function(x) {}
set.seed(17)
runif(1)
```

We expect the linter to report the following:

* certain at 3.1-3.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L98) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_draw_32_before_32_a_32_conditional_32_seed_32_stays_32_unseeded">Test Case: a draw before a conditional seed stays unseeded</h4>

Given the following input:

```r
runif(1)
if(u) set.seed(1)
rnorm(1)
```

We expect the linter to report the following:

* certain at 1.1-1.8: function = `'runif'`
* uncertain at 3.1-3.8: function = `'rnorm'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L103) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_seed_32_at_32_the_32_end_32_of_32_a_32_loop_32_body_32_does_32_not_32_cover_32_the_32_first_32_iteration">Test Case: a seed at the end of a loop body does not cover the first iteration</h4>

Given the following input:

```r
for(i in 1:3) {
  runif(1)
  set.seed(1)
}
```

We expect the linter to report the following:

* uncertain at 2.3-2.10: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L108) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_draw_32_in_32_a_32_function_32_called_32_before_32_seeding">Test Case: a draw in a function called before seeding</h4>

Given the following input:

```r
f <- function() runif(1)
f()
set.seed(1)
rnorm(1)
```

We expect the linter to report the following:

* uncertain at 1.17-1.24: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L114) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_seed_32_in_32_a_32_closure_32_the_32_receiver_32_may_32_not_32_call">Test Case: a seed in a closure the receiver may not call</h4>

> the closure is only called on some paths, so the draw may see the initial state

Given the following input:

```r
g <- function(f) if(runif(1) > 2) f()
g(function() set.seed(1))
rnorm(1)
```

We expect the linter to report the following:

* uncertain at 1.21-1.28: function = `'runif'`
* uncertain at 3.1-3.8: function = `'rnorm'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L120) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_built-in_32_handed_32_to_32_a_32_user_32_function_32_without_32_a_32_seed">Test Case: a built-in handed to a user function without a seed</h4>

Given the following input:

```r
g <- function(f) f(1)
g(runif)
rnorm(1)
```

We expect the linter to report the following:

* uncertain at 1.18-1.21: function = `'runif'`
* certain at 3.1-3.8: function = `'rnorm'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L128) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_seed_32_in_32_a_32_closure_32_handed_32_to_32_a_32_user_32_function_32_only_32_after_32_the_32_draw">Test Case: a seed in a closure handed to a user function only after the draw</h4>

Given the following input:

```r
g <- function(f) f()
runif(1)
g(function() set.seed(1))
```

We expect the linter to report the following:

* certain at 2.1-2.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L132) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_local_32_.Random.seed_32_does_32_not">Test Case: a local .Random.seed does not</h4>

Given the following input:

```r
f <- function() {
  .Random.seed <- 1
  1
}
f()
runif(1)
```

We expect the linter to report the following:

* certain at 6.1-6.8: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L135) for the test-case implementation.

<h4 id="Test_32_Case:_32_set_32_in_32_function_32_call">Test Case: set in function call</h4>

> R evaluates the argument, and with it the seed, before it draws

Given the following input:

```r
runif(set.seed(17))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L140) for the test-case implementation.

<h4 id="Test_32_Case:_32_get_32_in_32_function_32_call">Test Case: get in function call</h4>

Given the following input:

```r
runif(runif(1))
```

We expect the linter to report the following:

* certain at 1.7-1.14: function = `'runif'`
* certain at 1.1-1.15: function = `'runif'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L141) for the test-case implementation.

<h4 id="Test_32_Case:_32_with_seed_32_seeds">Test Case: with_seed seeds</h4>

> R: withr::with_seed(1, runif(1)) yields the same value every time

Given the following input:

```r
withr::with_seed(1, runif(1))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts#L179) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**none**

```r
cat("hello")
```

**with_seed seeds its code**

```r
withr::with_seed(1, runif(1))
```

**with_seed keeps an earlier seed for a draw after it**

```r
set.seed(1)
withr::with_seed(2, runif(1))
runif(1)
```

**no consumer**

```r
set.seed(17)
```

**both**

```r
set.seed(17)
runif(1)
```

**multiple seeds**

```r
set.seed(1);
set.seed(2);
runif(1);
```

**multiple consumers**

```r
set.seed(1);
set.seed(2);
runif(1);
runif(1);
```

**valid**

```r
for(i in 1:10) { set.seed(17); runif(1); }
```

**both false**

```r
if(FALSE) { set.seed(17); 
runif(1); }
```

**both true**

```r
if(TRUE) { set.seed(17); 
runif(1); }
```

**true**

```r
if(TRUE) { set.seed(17); }
runif(1);
```

**unclear after definite seed**

```r
set.seed(17); if(u) { set.seed(17); }
runif(1);
```

**exhaustive**

```r
if(u) { set.seed(17); } else { set.seed(18); }
runif(1);
```

**reversed**

```r
set.seed(17);
if(u) { runif(1) }
```

**nested true**

```r
if(TRUE) { if(TRUE) { set.seed(17); }
runif(1); }
```

**nested consumer**

```r
if(a) {set.seed(17); if(b) { runif(1); } }
```

**set .Random.seed**

```r
.Random.seed <- 17
runif(1)
```

**set .Random.seed with assignment inbetween**

```r
.Random.seed <- 17
x <- 7 
runif(1)
```

**set .Random.seed reverse**

```r
17 -> .Random.seed
runif(1)
```

**seed a local folds to**

```r
num<-1 + 7;
set.seed(num);
runif(1);
```

**draws pass the seed on**

```r
set.seed(1)
runif(1)
rnorm(1)
```

**a draw within a function the program calls after seeding**

```r
f <- function() runif(1)
set.seed(1)
f()
```

**a seed before a loop covers every iteration**

```r
set.seed(1)
for(i in 1:3) {
  runif(1)
}
```

**a draw in a closure handed to sapply after seeding**

```r
set.seed(1)
sapply(1:3, function(i) runif(1))
rnorm(1)
```

**a draw in a recursive function the program calls after seeding**

```r
f <- function(n) if(n > 0) { runif(1); f(n - 1) }
set.seed(1)
f(3)
rnorm(1)
```

**a seed in a closure handed to a user function**

```r
g <- function(f) f()
g(function() set.seed(1))
runif(1)
```

**a seed in a closure handed down twice**

```r
g <- function(f) f()
k <- function(f) g(f)
k(function() set.seed(1))
runif(1)
```

**a seed in a closure handed to lapply**

```r
x <- lapply(1, function(i) set.seed(1))
runif(1)
```

**a seed in a function called within a function**

```r
s <- function() set.seed(1)
w <- function() s()
w()
runif(1)
```

**a draw in a closure handed to a user function after seeding**

```r
set.seed(1)
g <- function(f) f(1)
g(function(n) runif(n))
rnorm(1)
```

**a built-in handed to a user function after seeding**

```r
set.seed(1)
g <- function(f) f(1)
g(runif)
rnorm(1)
```

**some is not a randomness consumer**

```r
some(1:3, is.numeric)
```