_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-08-25, 11:40:12 UTC (v2.14.4), please do not edit directly._
<h2 id="unclosed-connection">Unclosed Connection&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>


This rule is a `best-effort` rule.
 
Flags connections that are opened but not closed on every path opening them.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L178">src/linter/rules/unclosed-connection.ts</a>._


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
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalOpened: 1, totalClosed: 0, searchTimeMs: 1, processTimeMs: 1\
_All queries together required ≈2 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _2.0 ms_ (including parsing and normalization and the query) within the generation environment.

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
            "loc": [
              1,
              8,
              1,
              23
            ],
            "quickFix": [
              {
                "type": "replace",
                "loc": [
                  2,
                  15,
                  2,
                  14
                ],
                "description": "Close the connection with `close(con)`",
                "replacement": "\nclose(con)"
              }
            ]
          }
        ],
        ".meta": {
          "totalOpened": 1,
          "totalClosed": 0,
          "searchTimeMs": 1,
          "processTimeMs": 1
        }
      }
    },
    ".meta": {
      "timing": 2
    }
  },
  ".meta": {
    "timing": 2
  }
}
```



</details>





	

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-unclosed-connection.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts)


<h4 id="Test_Case:_All_closed">Test Case: All closed</h4>


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

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L10) for the test-case implementation.
		
<h4 id="Test_Case:_Closed_inline">Test Case: Closed inline</h4>


Given the following input:

```r
close(file("x"))
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L21) for the test-case implementation.
		
<h4 id="Test_Case:_Never_closed">Test Case: Never closed</h4>


Given the following input:

```r
a <- file("x")
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
loc:       [1, 6, 1, 14],
quickFix:  [{
	type:        'replace',
	loc:         [1, 15, 1, 14],
	description: 'Close the connection with `close(a)`',
	replacement: '\nclose(a)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_Case:_Closed_after_the_last_use">Test Case: Closed after the last use</h4>


Given the following input:

```r
`read <- function(){
	con <- file("x")
	readLines(con)
}`
```



We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Certain,
loc:       [2, 9, 2, 17],
quickFix:  [{
	type:        'replace',
	loc:         [3, 16, 3, 15],
	description: 'Close the connection with `close(con)`',
	replacement: '\n close(con)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_Case:_Only_one_closed">Test Case: Only one closed</h4>


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

```ts
			certainty: LintingResultCertainty.Certain,
loc:       [1, 6, 1, 23],
quickFix:  [{
	type:        'replace',
	loc:         [2, 7, 2, 6],
	description: 'Close the connection with `close(a)`',
	replacement: '\nclose(a)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L54) for the test-case implementation.
		
<h4 id="Test_Case:_Closed_with_new_definer">Test Case: Closed with new definer</h4>


Given the following input:

```r
`a <- textConnection(AB)
b <- a
c <- b
close(c)`
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_Case:_Closed_by_a_wrapper_function">Test Case: Closed by a wrapper function</h4>


Given the following input:

```r
`shut <- function(con) close(con)
a <- textConnection(AB)
shut(a)`
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L81) for the test-case implementation.
		
<h4 id="Test_Case:_Opened_by_a_wrapper_function">Test Case: Opened by a wrapper function</h4>


Given the following input:

```r
`make <- function() textConnection(AB)
a <- make()
close(a)`
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L87) for the test-case implementation.
		
<h4 id="Test_Case:_Closed_in_both_branches">Test Case: Closed in both branches</h4>


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

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L93) for the test-case implementation.
		
<h4 id="Test_Case:_Closed_on_exit">Test Case: Closed on exit</h4>


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

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L102) for the test-case implementation.
		
<h4 id="Test_Case:_Closed_by_withr">Test Case: Closed by withr</h4>


Given the following input:

```r
`con <- withr::local_connection(file("x"))
readLines(con)`
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L111) for the test-case implementation.
		
<h4 id="Test_Case:_Database_connection_closed">Test Case: Database connection closed</h4>


Given the following input:

```r
`con <- DBI::dbConnect(drv)
DBI::dbDisconnect(con)`
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L116) for the test-case implementation.
		
<h4 id="Test_Case:_Database_connection_left_open">Test Case: Database connection left open</h4>


Given the following input:

```r
con <- DBI::dbConnect(drv)
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
loc:       [1, 8, 1, 26],
quickFix:  [{
	type:        'replace',
	loc:         [1, 27, 1, 26],
	description: 'Close the connection with `close(con)`',
	replacement: '\nclose(con)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L121) for the test-case implementation.
		
<h4 id="Test_Case:_Configured_functions">Test Case: Configured functions</h4>


Given the following input:

```r
`a <- myOpen("x")
b <- myOpen("y")
myClose(a)`
```


And using the following [configuration](#configuration): 
```ts
{ openFns: ['myOpen'], closeFns: ['myClose'] }
```


We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Certain,
loc:       [2, 6, 2, 16],
quickFix:  [{
	type:        'replace',
	loc:         [2, 17, 2, 16],
	description: 'Close the connection with `close(b)`',
	replacement: '\nclose(b)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L134) for the test-case implementation.
		
<h4 id="Test_Case:_Not_necessarily_closed">Test Case: Not necessarily closed</h4>


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

```ts
			certainty: LintingResultCertainty.Uncertain,
loc:       [1, 6, 1, 23]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L151) for the test-case implementation.
		
<h4 id="Test_Case:_Opened_conditionally__closed_unconditionally">Test Case: Opened conditionally, closed unconditionally</h4>


Given the following input:

```r
`if(x){
	a <- textConnection(A)
}
close(a)`
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L164) for the test-case implementation.
		
<h4 id="Test_Case:_Openend_and_closed_in_different_branches">Test Case: Openend and closed in different branches</h4>


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

```ts
			certainty: LintingResultCertainty.Uncertain,
loc:       [3, 7, 3, 23]
		},
		{
certainty: LintingResultCertainty.Uncertain,
loc:       [4, 7, 4, 23]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L171) for the test-case implementation.
		
<h4 id="Test_Case:_Nested_branches_-_not_necessarily_closed">Test Case: Nested branches - not necessarily closed</h4>


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

```ts
			certainty: LintingResultCertainty.Uncertain,
loc:       [3, 7, 3, 23]
		},
		{
certainty: LintingResultCertainty.Certain,
loc:       [4, 7, 4, 23],
quickFix:  [{
	type:        'replace',
	loc:         [4, 24, 4, 23],
	description: 'Close the connection with `close(b)`',
	replacement: '\n close(b)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L193) for the test-case implementation.
		
<h4 id="Test_Case:_Opened_and_closed_within_the_loop">Test Case: Opened and closed within the loop</h4>


Given the following input:

```r
`for(f in files){
	con <- file(f)
	readLines(con)
	close(con)
}`
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L217) for the test-case implementation.
		
<h4 id="Test_Case:_Nested_branches_-_not_closed">Test Case: Nested branches - not closed</h4>


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

```ts
			certainty: LintingResultCertainty.Uncertain,
loc:       [4, 8, 4, 24]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L225) for the test-case implementation.