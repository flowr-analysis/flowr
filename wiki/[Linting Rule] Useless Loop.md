_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-11, 19:26:41 UTC (v2.15.10), do not edit directly._
<h2 id="useless-loop">Useless Loops&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>

This rule is a `best-effort` rule.
 
Detect loops which only iterate once\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/useless-loop.ts#L23">src/linter/rules/useless-loop.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `useless-loop` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/useless-loop.ts#L16"><code><span title="Function origins that are considered loops">loopyFunctions</span></code></a>\
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

Query: **linter** (5 ms)\
&nbsp;&nbsp;&nbsp;╰ **Useless Loops** (useless-loop):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ for-loop at 1.1-27 only loops once\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {"results":{"useless-loop":{"results":[{"certainty":"certain","name":"for","loc":[1,1,1,27],"involvedId":12}],".meta":{"numOfUselessLoops":1}}},".meta":{}},
  ".meta": {}
}
```

</details>

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
		
<h4 id="Test_32_Case:_32_a_32_vector_32_holding_32_a_32_sequence">Test Case: a vector holding a sequence</h4>

Given the following input:

```r
x <- read.csv("a.csv")
for(j in c(1:nrow(x))) print(j)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L30) for the test-case implementation.
		
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
		
<h4 id="Test_32_Case:_32_vector_32_c_40_c_40_1_41__44__32_2_41_">Test Case: vector c(c(1), 2)</h4>

Given the following input:

```r
for(i in c(c(1), 2)) print(i)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vector_32_c_40_1_44__32_2_41_">Test Case: vector c(1, 2)</h4>

Given the following input:

```r
for(i in c(1, 2)) print(i)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L36) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vector_32_c_40_1:3_41_">Test Case: vector c(1:3)</h4>

Given the following input:

```r
for(i in c(1:3)) print(i)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L37) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vector_32_c_40_NULL_41_">Test Case: vector c(NULL)</h4>

Given the following input:

```r
for(i in c(NULL)) print(i)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vector_32_c_40_x_41_">Test Case: vector c(x)</h4>

Given the following input:

```r
for(i in c(x)) print(i)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vector_32_c_40_f_40__41__41_">Test Case: vector c(f())</h4>

Given the following input:

```r
for(i in c(f())) print(i)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L40) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vector_32_c_40_1:n_41_">Test Case: vector c(1:n)</h4>

Given the following input:

```r
for(i in c(1:n)) print(i)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vector_32_c_40_c_40_1:n_41__41_">Test Case: vector c(c(1:n))</h4>

Given the following input:

```r
for(i in c(c(1:n))) print(i)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L42) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vector_32_c_40_-1:-1_41_">Test Case: vector c(-1:-1)</h4>

Given the following input:

```r
for(i in c(-1:-1)) print(i)
```

We expect the linter to report the following:

* certain at 1.1-1.27: name = `'for'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L43) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_repeat_32_with_32_break">Test Case: repeat with break</h4>

Given the following input:

```r
repeat { x <- x + 2; if(u) { break } else {} }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-useless-loop.test.ts#L44) for the test-case implementation.