_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 21:25:13 UTC (v2.16.2), do not edit directly._
<h2 id="package-runtime">Package Runtime&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#4](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-4) 🟩, [#5](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-5) 🟩, [#7](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-7) 🟩, [#33](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-33) 🔷, [#77](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-77) 🔷, [#79](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-79) 🔷, [#80](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-80) 🔷, [#81](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-81) 🔷, [#83](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-83) 🔷, [#84](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-84) 🔷, [#85](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-85) 🔷, [#86](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-86) 🔷, [#87](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-87) 🔷, [#89](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-89) 🔷, [#90](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-90) 🔶, [#91](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-91) 🔶

This rule is a `best-effort` rule.
 
Finds what makes installing, loading, or running the package fail without doing so: undefined exports, S3 methods without a function, bad NAMESPACE imports, a package attaching itself, tests that never run, test or vignette code that does not parse, missing vignette metadata, and files written into the working directory.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-runtime.ts#L283">src/linter/rules/cmd-check/package-runtime.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-runtime` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-runtime.ts#L61"><code><span title="report writes of tests and vignettes into the working directory (default true)">checkWrites</span></code></a>\
report writes of tests and vignettes into the working directory (default `true`)

### Examples

```r
f <- function() library(pkg)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-runtime",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Runtime** (package-runtime): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"package-runtime":{"results":[],".meta":{}}},".meta":{}},".meta":{}}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-package-runtime.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts)

<h4 id="Test_32_Case:_32_undefined_32_export">Test Case: undefined export</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* certain: kind = `'undefined-export'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_exports_32_of_32_variables_32_and_32_data_32_are_32_defined">Test Case: exports of variables and data are defined</h4>

Given the following input:

```r
f <- function() 1
version_info <- "1.0"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_generics_32_set_32_by_32_setGeneric_32_are_32_defined">Test Case: generics set by setGeneric are defined</h4>

Given the following input:

```r
setGeneric("area", function(shape) standardGeneric("area"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L21) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dynamic_32_definitions_32_make_32_the_32_finding_32_uncertain">Test Case: dynamic definitions make the finding uncertain</h4>

Given the following input:

```r
for(n in c("a", "b")) assign(paste0("get_", n), function() n)
```

We expect the linter to report the following:

* uncertain: kind = `'undefined-export'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_re-exported_32_import_32_is_32_defined">Test Case: re-exported import is defined</h4>

Given the following input:

```r
f <- function(x) x %>% sum()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_whole_32_imports_32_may_32_provide_32_an_32_export">Test Case: whole imports may provide an export</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_definitions_32_by_32_other_32_packages_32_are_32_unknown_32__40_R.oo_41_">Test Case: definitions by other packages are unknown (R.oo)</h4>

Given the following input:

```r
setMethodS3("readMat", "default", function(con, ...) NULL)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_literal_32_assign_32_defines_32_the_32_name">Test Case: literal assign defines the name</h4>

Given the following input:

```r
assign("helper", function() 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_export_32_patterns_32_are_32_not_32_checked">Test Case: export patterns are not checked</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_S3_32_method_32_without_32_its_32_function">Test Case: S3 method without its function</h4>

Given the following input:

```r
print.foo <- function(x, ...) x
```

We expect the linter to report the following:

* reported: kind = `'missing-s3-method'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L30) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_S3_32_method_32_registered_32_under_32_another_32_function_32_name">Test Case: S3 method registered under another function name</h4>

Given the following input:

```r
fmt_foo <- function(x, ...) "foo"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L33) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_import_32_from_32_an_32_undeclared_32_package">Test Case: import from an undeclared package</h4>

Given the following input:

```r
f <- function(x) filter(x)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-namespace-import'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_import_32_from_32_a_32_declared_32_package">Test Case: import from a declared package</h4>

Given the following input:

```r
f <- function(x) filter(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L37) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_import_32_from_32_a_32_base_32_package_32_needs_32_no_32_declaration">Test Case: import from a base package needs no declaration</h4>

Given the following input:

```r
f <- function(x) median(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_import_32_from_32_methods_32_needs_32_a_32_declaration">Test Case: import from methods needs a declaration</h4>

Given the following input:

```r
f <- function(x) is(x)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-namespace-import'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_NAMESPACE_44__32_nothing_32_to_32_check">Test Case: no NAMESPACE, nothing to check</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L40) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_package_32_attaching_32_itself">Test Case: package attaching itself</h4>

Given the following input:

```r
f <- function() library(pkg)
```

We expect the linter to report the following:

* reported: kind = `'self-attach'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_require_32_of_32_itself_32_as_32_a_32_string">Test Case: require of itself as a string</h4>

Given the following input:

```r
f <- function() require("pkg")
```

We expect the linter to report the following:

* reported: kind = `'self-attach'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L45) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_attaching_32_another_32_package_32_is_32_not_32_this">Test Case: attaching another package is not this</h4>

Given the following input:

```r
f <- function() library(stats)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_testthat_32_tests_32_without_32_a_32_runner">Test Case: testthat tests without a runner</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'test-runner'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_testthat_32_tests_32_with_32_a_32_runner">Test Case: testthat tests with a runner</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_runner_32_for_32_another_32_package">Test Case: runner for another package</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'test-runner'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L54) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_that_32_does_32_not_32_parse">Test Case: test that does not parse</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'syntax'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L57) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_orphaned_32_reference_32_output">Test Case: orphaned reference output</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'orphan-reference-output'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L60) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_reference_32_output_32_with_32_its_32_test">Test Case: reference output with its test</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L61) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_writing_32_into_32_the_32_working_32_directory">Test Case: test writing into the working directory</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* uncertain: kind = `'check-directory-write'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_writing_32_into_32_tempdir">Test Case: test writing into tempdir</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_writes_32_can_32_be_32_accepted">Test Case: writes can be accepted</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L66) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_complete_32_vignette">Test Case: complete vignette</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L71) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vignette_32_without_32_index_32_entry">Test Case: vignette without index entry</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'vignette-metadata'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L72) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_R_32_Markdown_32_vignette_32_without_32_engine">Test Case: R Markdown vignette without engine</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'vignette-metadata'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Sweave_32_needs_32_no_32_engine">Test Case: Sweave needs no engine</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vignette_32_chunk_32_that_32_does_32_not_32_parse">Test Case: vignette chunk that does not parse</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'syntax'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L75) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Rust_32_without_32_system_32_requirements">Test Case: Rust without system requirements</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'rust-requirements'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L79) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Rust_32_with_32_system_32_requirements">Test Case: Rust with system requirements</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L80) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_translation_32_packages_32_are_32_no_32_packages">Test Case: translation packages are no packages</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'extension-type'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L98) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_installed_32_package_32_handed_32_in">Test Case: installed package handed in</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'not-source-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L99) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_package_32_without_32_R_32_code_32_still_32_checks_32_its_32_files">Test Case: package without R code still checks its files</h4>

Given the following input:

```r

```

We expect the linter to report the following:

* reported: kind = `'orphan-reference-output'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-runtime.test.ts#L103) for the test-case implementation.