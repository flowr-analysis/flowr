_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="roxygen-arguments">Roxygen Arguments&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the documentation of the code. For example, missing or misleading comments."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#documentation'>![documentation](https://img.shields.io/badge/documentation-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds function parameters the roxygen documentation leaves out, and documented parameters the function does not have.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/roxygen-arguments.ts#L46">src/linter/rules/roxygen-arguments.ts</a>._

### Examples

```r
#' A function with two parameters, but only only one documented
#' @param a A variable
f = function(a, b){return a;}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "roxygen-arguments",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Roxygen Arguments** (roxygen-arguments):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function at 3.5-29 has undocumented argument 'b'

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-roxygen-arguments.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts)

<h4 id="Test_32_Case:_32_More_32__64_param_32_documented_32_than_32_implemented">Test Case: More @param documented than implemented</h4>

Given the following input:

```r
#' This is a function.
#' An interesting function.
#' @param a some variable
#' @param b does not exist
f = function(a){return a;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `['b']`, underDocumented = `[]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L9) for the test-case implementation.

<h4 id="Test_32_Case:_32_Less_32__64_param_32_documented_32_than_32_implemented">Test Case: Less @param documented than implemented</h4>

Given the following input:

```r
#' This is a function.
#' An interesting function.
#' @param a some variable
f = function(a, b){return a;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `[]`, underDocumented = `['b']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L21) for the test-case implementation.

<h4 id="Test_32_Case:_32_A_32_backticked_32__64_param_32_naming_32_another_32_parameter">Test Case: A backticked @param naming another parameter</h4>

Given the following input:

```r
#\' @param `a b` x
f <- function(`a c`) 1
```

We expect the linter to report the following:

* uncertain: overDocumented = `['a b']`, underDocumented = `['a c']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L34) for the test-case implementation.

<h4 id="Test_32_Case:_32_A_32__35__35__92__39__32_block_32_documents">Test Case: A ##\' block documents</h4>

Given the following input:

```r
##\' @param b x
f <- function(a) a
```

We expect the linter to report the following:

* uncertain: overDocumented = `['b']`, underDocumented = `['a']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L40) for the test-case implementation.

<h4 id="Test_32_Case:_32_Different_32__64_param_32_documented_32_than_32_implemented">Test Case: Different @param documented than implemented</h4>

Given the following input:

```r
#\' @param a some variable
f = function(b){return b;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `['a']`, underDocumented = `['b']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L48) for the test-case implementation.

<h4 id="Test_32_Case:_32__64_param_32_documented_44__32_but_32_function_32_not_32_parameterized">Test Case: @param documented, but function not parameterized</h4>

Given the following input:

```r
#\' @param a some variable
f = function(){return 42;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `['a']`, underDocumented = `[]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L56) for the test-case implementation.

<h4 id="Test_32_Case:_32_Parameterized_32_function_44__32__64_param_32_not_32_documented">Test Case: Parameterized function, @param not documented</h4>

Given the following input:

```r
#\' Just a comment
f = function(a){return 42;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `[]`, underDocumented = `['a']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L64) for the test-case implementation.

<h4 id="Test_32_Case:_32_Function_32_inherits_44__32_but_32_still_32_missing_32__64_param">Test Case: Function inherits, but still missing @param</h4>

Given the following input:

```r
#\' @param h this is a param
#\' @param k this is a param
f <- function(h, k){return h-k;}
#\' @inheritParams f
#\' @param t
g <- function(t,h,i){return h+t+i;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `[]`, underDocumented = `['i']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L75) for the test-case implementation.

<h4 id="Test_32_Case:_32_Inheriting_32_param_32_from_32_different_32_functions">Test Case: Inheriting param from different functions</h4>

Given the following input:

```r
#\' @param a this is a param
#\' @param b this is a param
f1 <- function(a, b){return a-b;}
#\' @param c this is a param
#\' @inheritParams f1
f2 <- function(c, a){return c*a;}
#\' @inheritParams f1
#\' @inheritParams f2
#\' @param t is a param
#\' @param l is a param
f3 <- function(a,h,t,k){return h+t+i-k;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `['l']`, underDocumented = `['h', 'k']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L83) for the test-case implementation.

<h4 id="Test_32_Case:_32_Inheriting_32_param_32_from_32_different_32_functions_44__32_mistakes_32_from_32_several_32_func">Test Case: Inheriting param from different functions, mistakes from several func</h4>

Given the following input:

```r
#\' @param a this is a param
#\' @param b this is a param
f1 <- function(a, b, h){return a-b+h;}
#\' @param c this is a param
#\' @inheritParams f1
f2 <- function(c, a){return c*a;}
#\' @inheritParams f1
#\' @inheritParams f2
#\' @param t is a param
#\' @param l is a param
f3 <- function(a,h,t,k){return h+t+i-k;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `[]`, underDocumented = `['h']`
* uncertain: overDocumented = `['l']`, underDocumented = `['h', 'k']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L91) for the test-case implementation.

<h4 id="Test_32_Case:_32_...">Test Case: ...</h4>

Given the following input:

```r
#\' @param h this is a param
f <- function(h, a,...){return h;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `[]`, underDocumented = `['a', '...']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L106) for the test-case implementation.

<h4 id="Test_32_Case:_32_Inheriting_32_param_32__43__32__92__39_..._92__39_">Test Case: Inheriting param + \'...\'</h4>

Given the following input:

```r
#\' @param a this is a param
#\' @param b this is a param
f1 <- function(a, b, h){return a-b-h;}
#\' @inheritParams f1
#\' @param c this is a param
f2 <- function(c, ...){return c;}
```

We expect the linter to report the following:

* uncertain: overDocumented = `[]`, underDocumented = `['h']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L114) for the test-case implementation.

<h4 id="Test_32_Case:_32_backticked_32_param">Test Case: backticked param</h4>

> roxygen2::parse_text gives the param name `a b`

Given the following input:

```r
#\' @param `a b` x
f <- function(`a b`) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-roxygen-arguments.test.ts#L129) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**Same @param documented as implemented**

```r
#\' This is a function.
#\' An interesting function.
#\' @param a some variable
#\' @param b does exist
f = function(a,b){return a;}
```

**A backticked @param**

```r
#\' @param `a b` x
f <- function(`a b`) 1
```

**Parameterized function, not commented**

```r
f = function(a){return a;}
```

**Unparameterized function, not commented**

```r
f = function(){return 42;}
```

**Unparameterized function, no @param documented**

```r
#\' This is a function
f = function(){return 42;}
```

**Function inherits all @param needed**

```r
#\' @param h this is a param
f <- function(h){return h;}
#\' @inheritParams f
#\' @param t is random placeholder
g <- function(h,t){return h+t;}
```

**More @param inherited (from 2) than used**

```r
#\' @param h this is a param
@param i another one
f <- function(h, i){return h;}
@param n another one
m <- function(h, i){return h;}
#\' @inheritParams f
#\' @inheritParams m
#\' @param t is random placeholder
g <- function(h,t){return h+t;}
```

**...**

```r
#\' @param h this is a param
#\' @param k another one
#\' @param l another one
f <- function(h, ...){return h;}
```

**Inheriting param + \'...\'**

```r
#\' @param ... this is a param
#\' @param a this is a param
f1 <- function(a, ...){return a;}
#\' @param b this is a param
#\' @inheritParams f1
f2 <- function(...){return 4;}
```

**comma-separated @param documents each name**

```r
#' This is a function.
#' @param x,y numeric values
add <- function(x, y) x + y
```