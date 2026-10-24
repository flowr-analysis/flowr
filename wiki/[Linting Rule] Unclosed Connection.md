_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-24, 20:38:50 UTC (v2.16.6), do not edit directly._
<h2 id="unclosed-connection">Unclosed Connection&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds connections that are opened but not closed on every path opening them.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L199">src/linter/rules/unclosed-connection.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unclosed-connection` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L44"><code><span title="functions closing the connection they are handed, besides the ones flowR states SemanticCallTag.Closes for">closeFns</span></code></a>\
functions closing the connection they are handed, besides the ones flowR states
<code>SemanticCallTag.Closes</code>
for
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unclosed-connection.ts#L42"><code><span title="functions opening a connection, besides the ones flowR states SemanticCallTag.Opens for">openFns</span></code></a>\
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

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unclosed Connection** (unclosed-connection):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Unclosed connection at 1.8-23 (1 quick fix(es) available)

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-unclosed-connection.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts)

<h4 id="Test_32_Case:_32_a_32_connection_32_opened_32_explicitly_32_stays_32_open">Test Case: a connection opened explicitly stays open</h4>

Given the following input:

```r
con <- file("a.txt")
open(con)
```

We expect the linter to report the following:

* certain at 1.8-1.20: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L29) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_reader_32_does_32_not_32_close_32_an_32_opened_32_connection">Test Case: a reader does not close an opened connection</h4>

Given the following input:

```r
con <- file("a.txt")
open(con)
x <- readLines(con)
```

We expect the linter to report the following:

* certain at 1.8-1.20: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L33) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_connection_32_opened_32_on_32_creation_32_stays_32_open">Test Case: a connection opened on creation stays open</h4>

Given the following input:

```r
x <- readLines(file("a.txt", open = "r"))
```

We expect the linter to report the following:

* certain at 1.16-1.40

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L37) for the test-case implementation.

<h4 id="Test_32_Case:_32_close.connection_32_of_32_another_32_connection_32_leaves_32_the_32_opened_32_one_32_open">Test Case: close.connection of another connection leaves the opened one open</h4>

Given the following input:

```r
con <- file("a.txt")
open(con)
other <- file("b.txt")
close.connection(other)
```

We expect the linter to report the following:

* certain at 1.8-1.20: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L49) for the test-case implementation.

<h4 id="Test_32_Case:_32_Never_32_closed">Test Case: Never closed</h4>

Given the following input:

```r
a <- file("x")
```

We expect the linter to report the following:

* certain at 1.6-1.14: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L53) for the test-case implementation.

<h4 id="Test_32_Case:_32_Closed_32_after_32_the_32_loop_32_using_32_it">Test Case: Closed after the loop using it</h4>

Given the following input:

```r
con <- file("x")
for(i in 1:3) readLines(con)
```

We expect the linter to report the following:

* certain at 1.8-1.16: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L66) for the test-case implementation.

<h4 id="Test_32_Case:_32_Closed_32_after_32_the_32_last_32_use">Test Case: Closed after the last use</h4>

Given the following input:

```r
read <- function(){
	con <- file("x")
	readLines(con)
}
```

We expect the linter to report the following:

* certain at 2.9-2.17: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L79) for the test-case implementation.

<h4 id="Test_32_Case:_32_Only_32_one_32_closed">Test Case: Only one closed</h4>

Given the following input:

```r
a <- textConnection(AB)
b <- a
if(x){
	b <- textConnection(LETTERS)
	close(b)
	close(b)
}
t <- 2
```

We expect the linter to report the following:

* certain at 1.6-1.23: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L95) for the test-case implementation.

<h4 id="Test_32_Case:_32_Database_32_connection_32_left_32_open">Test Case: Database connection left open</h4>

Given the following input:

```r
con <- DBI::dbConnect(drv)
```

We expect the linter to report the following:

* certain at 1.8-1.26: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L162) for the test-case implementation.

<h4 id="Test_32_Case:_32_Configured_32_functions">Test Case: Configured functions</h4>

Given the following input:

```r
a <- myOpen("x")
b <- myOpen("y")
myClose(a)
```

And using the following [configuration](#configuration): 
```ts
{openFns: ['myOpen'], closeFns: ['myClose']}
```

We expect the linter to report the following:

* certain at 2.6-2.16: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L175) for the test-case implementation.

<h4 id="Test_32_Case:_32_Not_32_necessarily_32_closed">Test Case: Not necessarily closed</h4>

Given the following input:

```r
a <- textConnection(AB)
b <- textConnection(E)
if(x){
	close(a)
}
t <- 2
close(b)
```

We expect the linter to report the following:

* uncertain at 1.6-1.23

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L192) for the test-case implementation.

<h4 id="Test_32_Case:_32_Openend_32_and_32_closed_32_in_32_different_32_branches">Test Case: Openend and closed in different branches</h4>

Given the following input:

```r
a <- 4+3
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
}
```

We expect the linter to report the following:

* uncertain at 3.7-3.23
* uncertain at 4.7-4.23

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L212) for the test-case implementation.

<h4 id="Test_32_Case:_32_Nested_32_branches_32_-_32_not_32_necessarily_32_closed">Test Case: Nested branches - not necessarily closed</h4>

Given the following input:

```r
a <- 4+3
if(x){
	a <- textConnection(A)
	b <- textConnection(B)
	if(y){
	close(a)
	}
}
```

We expect the linter to report the following:

* uncertain at 3.7-3.23
* certain at 4.7-4.23: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L234) for the test-case implementation.

<h4 id="Test_32_Case:_32_Nested_32_branches_32_-_32_not_32_closed">Test Case: Nested branches - not closed</h4>

Given the following input:

```r
if(x){
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
}
```

We expect the linter to report the following:

* uncertain at 4.8-4.24

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unclosed-connection.test.ts#L266) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**All closed**

```r
a <- textConnection(A)
readLines(a, 2)
file <- file()
b <- textConnection(B)

close(a)
close(b)
close(file)
```

**Closed inline**

```r
close(file("x"))
```

**an unopened connection handed to a reader is opened and closed by it**

```r
x <- readLines(file("a.txt"))
```

**an unopened connection handed to a writer is opened and closed by it**

```r
writeLines("a", file("o.txt"))
write.table(data.frame(a = 1), file = pipe("cat"))
```

**close.connection closes**

```r
con <- file("a.txt")
x <- readLines(con)
close.connection(con)
```

**Closed with new definer**

```r
a <- textConnection(AB)
b <- a
c <- b
close(c)
```

**Closed by a wrapper function**

```r
shut <- function(con) close(con)
a <- textConnection(AB)
shut(a)
```

**Opened by a wrapper function**

```r
make <- function() textConnection(AB)
a <- make()
close(a)
```

**Closed in both branches**

```r
a <- textConnection(AB)
if(x){
	close(a)
} else {
	close(a)
}
```

**Closed on exit**

```r
read <- function(){
	con <- file("x")
	on.exit(close(con))
	readLines(con)
}
read()
```

**Closed by withr**

```r
con <- withr::local_connection(file("x"))
readLines(con)
```

**Database connection closed**

```r
con <- DBI::dbConnect(drv)
DBI::dbDisconnect(con)
```

**Opened conditionally, closed unconditionally**

```r
if(x){
	a <- textConnection(A)
}
close(a)
```

**Opened and closed within the loop**

```r
for(f in files){
	con <- file(f)
	readLines(con)
	close(con)
}
```