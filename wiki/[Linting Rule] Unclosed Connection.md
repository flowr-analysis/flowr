_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-04, 14:48:48 UTC (v2.15.9), do not edit directly._
<h2 id="unclosed-connection">Unclosed Connection&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a `best-effort` rule.
 
Flags connections that are opened but not closed on every path opening them.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L188">src/linter/rules/unclosed-connection.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unclosed-connection` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L40"><code><span title="functions closing the connection they are handed, besides the ones flowR states SemanticCallTag.Closes for">closeFns</span></code></a>\
functions closing the connection they are handed, besides the ones flowR states
<code>SemanticCallTag.Closes</code>
for
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L38"><code><span title="functions opening a connection, besides the ones flowR states SemanticCallTag.Opens for">openFns</span></code></a>\
functions opening a connection, besides the ones flowR states
<code>SemanticCallTag.Opens</code>
for

### Examples

```r
con <- file("data.csv")
readLines(con)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "unclosed-connection",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unclosed Connection** (unclosed-connection):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Unclosed connection at 1.8-23 (1 quick fix(es) available)\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "unclosed-connection": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 4,
            "loc": [1,8,1,23],
            "quickFix": [{"type":"replace","loc":[2,15,2,14],"description":"Close the connection with `close(con)`","replacement":"\nclose(con)"}]
          }
        ],
        ".meta": {"totalOpened":1,"totalClosed":0}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-unclosed-connection.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts)

<h4 id="Test_32_Case:_32_All_32_closed">Test Case: All closed</h4>

Given the following input:

```r
`a <- textConnection(A)
readLines(a, 2)
file <- file()
b <- textConnection(B)

close(a)
close(b)
close(file)`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L10) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Closed_32_inline">Test Case: Closed inline</h4>

Given the following input:

```r
close(file("x"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L21) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Never_32_closed">Test Case: Never closed</h4>

Given the following input:

```r
a <- file("x")
```

We expect the linter to report the following:

* certain at 1.6-1.14: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Closed_32_after_32_the_32_loop_32_using_32_it">Test Case: Closed after the loop using it</h4>

Given the following input:

```r
con <- file("x")
for(i in 1:3) readLines(con)
```

We expect the linter to report the following:

* certain at 1.8-1.16: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Closed_32_after_32_the_32_last_32_use">Test Case: Closed after the last use</h4>

Given the following input:

```r
`read <- function(){
	con <- file("x")
	readLines(con)
}`
```

We expect the linter to report the following:

* certain at 2.9-2.17: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Only_32_one_32_closed">Test Case: Only one closed</h4>

Given the following input:

```r
`a <- textConnection(AB)
b <- a
if(x){
	b <- textConnection(LETTERS)
	close(b)
	close(b)
}
t <- 2`
```

We expect the linter to report the following:

* certain at 1.6-1.23: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L67) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Closed_32_with_32_new_32_definer">Test Case: Closed with new definer</h4>

Given the following input:

```r
`a <- textConnection(AB)
b <- a
c <- b
close(c)`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L87) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Closed_32_by_32_a_32_wrapper_32_function">Test Case: Closed by a wrapper function</h4>

Given the following input:

```r
`shut <- function(con) close(con)
a <- textConnection(AB)
shut(a)`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L94) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Opened_32_by_32_a_32_wrapper_32_function">Test Case: Opened by a wrapper function</h4>

Given the following input:

```r
`make <- function() textConnection(AB)
a <- make()
close(a)`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L100) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Closed_32_in_32_both_32_branches">Test Case: Closed in both branches</h4>

Given the following input:

```r
`a <- textConnection(AB)
if(x){
	close(a)
} else {
	close(a)
}`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L106) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Closed_32_on_32_exit">Test Case: Closed on exit</h4>

Given the following input:

```r
`read <- function(){
	con <- file("x")
	on.exit(close(con))
	readLines(con)
}
read()`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L115) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Closed_32_by_32_withr">Test Case: Closed by withr</h4>

Given the following input:

```r
`con <- withr::local_connection(file("x"))
readLines(con)`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L124) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Database_32_connection_32_closed">Test Case: Database connection closed</h4>

Given the following input:

```r
`con <- DBI::dbConnect(drv)
DBI::dbDisconnect(con)`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L129) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Database_32_connection_32_left_32_open">Test Case: Database connection left open</h4>

Given the following input:

```r
con <- DBI::dbConnect(drv)
```

We expect the linter to report the following:

* certain at 1.8-1.26: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L134) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Configured_32_functions">Test Case: Configured functions</h4>

Given the following input:

```r
`a <- myOpen("x")
b <- myOpen("y")
myClose(a)`
```

And using the following [configuration](#configuration): 
```ts
{openFns: ['myOpen'], closeFns: ['myClose']}
```

We expect the linter to report the following:

* certain at 2.6-2.16: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L147) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Not_32_necessarily_32_closed">Test Case: Not necessarily closed</h4>

Given the following input:

```r
`a <- textConnection(AB)
b <- textConnection(E)
if(x){
	close(a)
}
t <- 2
close(b)`
```

We expect the linter to report the following:

* uncertain at 1.6-1.23

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L164) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Opened_32_conditionally_44__32_closed_32_unconditionally">Test Case: Opened conditionally, closed unconditionally</h4>

Given the following input:

```r
`if(x){
	a <- textConnection(A)
}
close(a)`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L177) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Openend_32_and_32_closed_32_in_32_different_32_branches">Test Case: Openend and closed in different branches</h4>

Given the following input:

```r
`a <- 4+3
if(x){
	a <- textConnection(A)
	b <- textConnection(B)
}
t <- 34
if(x){
	close(a)
}
if(y){
	close(b)
}`
```

We expect the linter to report the following:

* uncertain at 3.7-3.23
* uncertain at 4.7-4.23

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L184) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Nested_32_branches_32_-_32_not_32_necessarily_32_closed">Test Case: Nested branches - not necessarily closed</h4>

Given the following input:

```r
`a <- 4+3
if(x){
	a <- textConnection(A)
	b <- textConnection(B)
	if(y){
	close(a)
	}
}`
```

We expect the linter to report the following:

* uncertain at 3.7-3.23
* certain at 4.7-4.23: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L206) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Opened_32_and_32_closed_32_within_32_the_32_loop">Test Case: Opened and closed within the loop</h4>

Given the following input:

```r
`for(f in files){
	con <- file(f)
	readLines(con)
	close(con)
}`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L230) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Nested_32_branches_32_-_32_not_32_closed">Test Case: Nested branches - not closed</h4>

Given the following input:

```r
`if(x){
	a <- 4
	while(a > 0){
		b <- textConnection(A)
		readLines(b, 2)
		a <- a - 1
	}
	close(b)
} 
else {
	a <- textConnection(A)
	close(a)
}`
```

We expect the linter to report the following:

* uncertain at 4.8-4.24

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L238) for the test-case implementation.