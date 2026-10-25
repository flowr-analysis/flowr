_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="software-has-tests">Software Has Tests&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [24](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-24) | [for code which exercises the package](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L8103) ([book](https://r-pkgs.org/R-CMD-check.html#tests)) | 🟩 | only tests count, examples and vignettes do not |

This rule is a <code>best-effort</code> rule.
 
Finds software projects without tests (test files in a test directory or test function calls in R code).\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/software-has-tests.ts#L23">src/linter/rules/software-has-tests.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `software-has-tests` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/software-has-tests.ts#L15"><code><span title="Additional test function patterns beyond the defaults">additionalTestFunctions</span></code></a>\
Additional test function patterns beyond the defaults\
_R CMD check [#24](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-24 "checking for code which exercises the package")_

### Examples

```r
cat("hello")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "software-has-tests",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Software Has Tests** (software-has-tests):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ No tests found in the project

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-software-has-tests.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-tests.test.ts)

<h4 id="Test_32_Case:_32_no_32_tests_32_at_32_all">Test Case: no tests at all</h4>

Given the following input:

```r
cat("hello")
```

We expect the linter to report the following:

* certain: message = `'No tests found in the project'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-tests.test.ts#L9) for the test-case implementation.

<h4 id="Test_32_Case:_32_standalone_32_expect_true_32_not_32_detected">Test Case: standalone expect_true not detected</h4>

Given the following input:

```r
expect_true(1 == 1)
```

We expect the linter to report the following:

* certain: message = `'No tests found in the project'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-tests.test.ts#L21) for the test-case implementation.

<h4 id="Test_32_Case:_32_test_32_file_32_in_32_tests_32_directory">Test Case: test file in tests directory</h4>

Given the following input:

```r
cat("hello")
```

And using the following [configuration](#configuration): 
```ts
{addFiles: [new FlowrInlineTextFile('/project/tests/test_main.R', '')]}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-tests.test.ts#L27) for the test-case implementation.

<h4 id="Test_32_Case:_32_test_32_file_32_in_32_test_32_directory_32__40_singular_41_">Test Case: test file in test directory (singular)</h4>

Given the following input:

```r
cat("hello")
```

And using the following [configuration](#configuration): 
```ts
{addFiles: [new FlowrInlineTextFile('/project/test/helper.R', '')]}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-tests.test.ts#L34) for the test-case implementation.

<h4 id="Test_32_Case:_32_unrelated_32_file_32_not_32_counted">Test Case: unrelated file not counted</h4>

Given the following input:

```r
cat("hello")
```

And using the following [configuration](#configuration): 
```ts
{addFiles: [new FlowrInlineTextFile('/project/R/main.R', '')]}
```

We expect the linter to report the following:

* certain: message = `'No tests found in the project'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-tests.test.ts#L41) for the test-case implementation.

<h4 id="Test_32_Case:_32_standalone_32_expect_equal_32_not_32_detected">Test Case: standalone expect_equal not detected</h4>

Given the following input:

```r
expect_equal(1 + 1, 2)
```

We expect the linter to report the following:

* certain: message = `'No tests found in the project'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-tests.test.ts#L48) for the test-case implementation.

<h4 id="Test_32_Case:_32_standalone_32_checkEquals_32_not_32_detected">Test Case: standalone checkEquals not detected</h4>

Given the following input:

```r
checkEquals(1 + 1, 2)
```

We expect the linter to report the following:

* certain: message = `'No tests found in the project'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-software-has-tests.test.ts#L60) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**test_that call detected**

```r
test_that("basic", { expect_true(TRUE) })
```

**tinytest runner run_test_dir**

```r
run_test_dir("inst/tinytest")
```