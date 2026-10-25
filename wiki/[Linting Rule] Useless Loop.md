_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="useless-loop">Useless Loops&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds loops that iterate only once.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/useless-loop.ts#L24">src/linter/rules/useless-loop.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `useless-loop` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/useless-loop.ts#L17"><code><span title="Function origins that are considered loops">loopyFunctions</span></code></a>\
Function origins that are considered loops

### Examples

```r
for(i in c(1)) { print(i) }
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "useless-loop",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Useless Loops** (useless-loop):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ for-loop at 1.1-27 only loops once

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-useless-loop.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts)

<h4 id="Test_32_Case:_32_i_32_in_32_c_40_1_41_">Test Case: i in c(1)</h4>

> Given a for-loop the linter checks, if the vector only contains one element

Given the following input:

```r
for(i in c(1)) { print(i) }
```

We expect the linter to report the following:

* certain at 1.1-1.27: name = `'for'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L9) for the test-case implementation.

<h4 id="Test_32_Case:_32_i_32_in_32_a_32_scalar">Test Case: i in a scalar</h4>

Given the following input:

```r
for(i in 1) { print(i) }
```

We expect the linter to report the following:

* certain at 1.1-1.24: name = `'for'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L15) for the test-case implementation.

<h4 id="Test_32_Case:_32_always_32_break">Test Case: always break</h4>

> Given a loop the linter checks, if the loop is always stopped after the first iteration

Given the following input:

```r
for(i in c(1,2,3)) { print(i); break }
```

We expect the linter to report the following:

* certain at 1.1-1.38: name = `'for'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L22) for the test-case implementation.

<h4 id="Test_32_Case:_32_vector_32_c_40_c_40_1_41__41_">Test Case: vector c(c(1))</h4>

Given the following input:

```r
for(i in c(c(1))) print(i)
```

We expect the linter to report the following:

* certain at 1.1-1.26: name = `'for'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L31) for the test-case implementation.

<h4 id="Test_32_Case:_32_vector_32_c_40_1:1_41_">Test Case: vector c(1:1)</h4>

Given the following input:

```r
for(i in c(1:1)) print(i)
```

We expect the linter to report the following:

* certain at 1.1-1.25: name = `'for'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L32) for the test-case implementation.

<h4 id="Test_32_Case:_32_vector_32_c_40__34_a_34__41_">Test Case: vector c("a")</h4>

Given the following input:

```r
for(i in c("a")) print(i)
```

We expect the linter to report the following:

* certain at 1.1-1.25: name = `'for'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L33) for the test-case implementation.

<h4 id="Test_32_Case:_32_vector_32_c_40_TRUE_41_">Test Case: vector c(TRUE)</h4>

Given the following input:

```r
for(i in c(TRUE)) print(i)
```

We expect the linter to report the following:

* certain at 1.1-1.26: name = `'for'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L34) for the test-case implementation.

<h4 id="Test_32_Case:_32_vector_32_c_40_-1:-1_41_">Test Case: vector c(-1:-1)</h4>

Given the following input:

```r
for(i in c(-1:-1)) print(i)
```

We expect the linter to report the following:

* certain at 1.1-1.27: name = `'for'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L43) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**a vector holding a sequence**

```r
x <- read.csv("a.csv")
for(j in c(1:nrow(x))) print(j)
```

**vector c(c(1), 2)**

```r
for(i in c(c(1), 2)) print(i)
```

**vector c(1, 2)**

```r
for(i in c(1, 2)) print(i)
```

**vector c(1:3)**

```r
for(i in c(1:3)) print(i)
```

**vector c(NULL)**

```r
for(i in c(NULL)) print(i)
```

**vector c(x)**

```r
for(i in c(x)) print(i)
```

**vector c(f())**

```r
for(i in c(f())) print(i)
```

**vector c(1:n)**

```r
for(i in c(1:n)) print(i)
```

**vector c(c(1:n))**

```r
for(i in c(c(1:n))) print(i)
```

**repeat with break**

```r
repeat { x <- x + 2; if(u) { break } else {} }
```