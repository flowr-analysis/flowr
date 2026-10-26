_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 20:08:08 UTC (v2.16.6), do not edit directly._
<h2 id="overwritten-file">Overwritten File&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds files the script writes more than once, so the later write replaces what the earlier one wrote, as two figures saved under the same name.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/overwritten-file.ts#L83">src/linter/rules/overwritten-file.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `overwritten-file` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/overwritten-file.ts#L30"><code><span title="functions that write a file, besides the ones the dependencies query knows">additionalWriteFunctions</span></code></a>\
functions that write a file, besides the ones the dependencies query knows

### Examples

```r
write.csv(cars, "out.csv")
write.csv(iris, "out.csv")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "overwritten-file",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ **Overwritten File** (overwritten-file):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ `out.csv` is written again, replacing what line 1 wrote to it

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-overwritten-file.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts)

<h4 id="Test_32_Case:_32_the_32_same_32_file_32_written_32_twice">Test Case: the same file written twice</h4>

Given the following input:

```r
write.csv(d, "a.csv")
write.csv(e, "a.csv")
```

We expect the linter to report the following:

* certain at 2.1-2.21: file = `'a.csv'`, firstLine = `1`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts#L8) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_write_32_only_32_in_32_one_32_branch_32_may_32_overwrite">Test Case: a write only in one branch may overwrite</h4>

Given the following input:

```r
write.csv(d, "a.csv")
if(u) write.csv(e, "a.csv")
```

We expect the linter to report the following:

* uncertain at 2.7-2.27: file = `'a.csv'`, firstLine = `1`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts#L14) for the test-case implementation.

<h4 id="Test_32_Case:_32_two_32_calls_32_of_32_a_32_function_32_writing_32_the_32_same_32_file">Test Case: two calls of a function writing the same file</h4>

Given the following input:

```r
f <- function(n) write.csv(d, n)
f("a.csv")
f("a.csv")
```

We expect the linter to report the following:

* certain at 3.1-3.10: file = `'a.csv'`, firstLine = `2`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts#L17) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_mode_32_that_32_only_32_reads_32_like_32_append_32_is_32_no_32_append">Test Case: a mode that only reads like append is no append</h4>

Given the following input:

```r
write.csv(d, "a")
write.csv(e, "a")
```

We expect the linter to report the following:

* certain at 2.1-2.17: file = `'a'`, firstLine = `1`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts#L21) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_helper_32_building_32_the_32_path_32_saves_32_under_32_a_32_name_32_used_32_before">Test Case: a helper building the path saves under a name used before</h4>

Given the following input:

```r
save_figure <- function(name) ggplot2::ggsave(file.path("out", paste0(name, ".pdf")))
save_figure("a")
save_figure("b")
save_figure("a")
```

We expect the linter to report the following:

* certain at 4.1-4.16: file = `'out/a.pdf'`, firstLine = `2`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts#L25) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_helper_32_called_32_through_32_another_32_helper">Test Case: a helper called through another helper</h4>

Given the following input:

```r
inner <- function(k) write.csv(d, k)
outer <- function(n) inner(paste0("x-", n, ".csv"))
outer("a")
outer("b")
outer("a")
```

We expect the linter to report the following:

* certain at 5.1-5.10: file = `'x-a.csv'`, firstLine = `3`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts#L29) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_call_32_relying_32_on_32_the_32_default_32_and_32_one_32_naming_32_it">Test Case: a call relying on the default and one naming it</h4>

Given the following input:

```r
save_it <- function(n = "a.csv") write.csv(d, n)
save_it()
save_it("a.csv")
```

We expect the linter to report the following:

* certain at 3.1-3.16: file = `'a.csv'`, firstLine = `2`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts#L32) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_write_32_in_32_the_32_helper_32_and_32_one_32_at_32_the_32_top">Test Case: a write in the helper and one at the top</h4>

Given the following input:

```r
save_it <- function(n) write.csv(d, n)
write.csv(e, "a.csv")
save_it("a.csv")
```

We expect the linter to report the following:

* certain at 3.1-3.16: file = `'a.csv'`, firstLine = `2`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts#L36) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_helper_32_writing_32_its_32_file_32_twice">Test Case: a helper writing its file twice</h4>

Given the following input:

```r
save_it <- function(n) {
  write.csv(d, n)
  write.csv(e, n)
}
save_it("a.csv")
```

We expect the linter to report the following:

* certain at 3.3-3.17: file = `'a.csv'`, firstLine = `2`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-overwritten-file.test.ts#L40) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**different files are fine**

```r
write.csv(d, "a.csv")
write.csv(e, "b.csv")
```

**appending is no overwrite**

```r
cat("a", file = "l.txt")
cat("b", file = "l.txt", append = TRUE)
```

**writes into one connection are no overwrite**

```r
con <- file("o.txt", "w")
writeLines("a", con)
writeLines("b", con)
close(con)
```

**two plots on one device are two pages of one file**

```r
pdf("x.pdf")
plot(1)
plot(2)
dev.off()
```

**a connection opened to append is no overwrite**

```r
writeLines("a", "l.txt")
con <- file("l.txt", "a")
writeLines("b", con)
close(con)
```

**a helper building the path under distinct names**

```r
save_figure <- function(name) ggplot2::ggsave(file.path("out", paste0(name, ".pdf")))
save_figure("a")
save_figure("b")
```

**a call relying on the default and one naming another file**

```r
save_it <- function(n = "a.csv") write.csv(d, n)
save_it()
save_it("b.csv")
```

**a helper never called writes nothing twice**

```r
save_it <- function(n) { write.csv(d, n); write.csv(e, n) }
```

**two calls of a function writing different files**

```r
f <- function(n) write.csv(d, n)
f("a.csv")
f("b.csv")
```