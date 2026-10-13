_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-11, 19:26:41 UTC (v2.15.10), do not edit directly._
<h2 id="file-path-validity">File Path Validity&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a `best-effort` rule.
 
Checks whether file paths used in read and write operations are valid and point to existing files.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L85">src/linter/rules/file-path-validity.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `file-path-validity` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L45"><code><span title="The set of functions that should additionally be considered as reading a file path. Entries in this array use the FunctionInfo format from the dependencies query.">additionalReadFunctions</span></code></a>\
The set of functions that should additionally be considered as reading a file path.
Entries in this array use the
<code>FunctionInfo</code>
format from the dependencies query.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L50"><code><span title="The set of functions that should additionally be considered as writing to a file path. Entries in this array use the FunctionInfo format from the dependencies query.">additionalWriteFunctions</span></code></a>\
The set of functions that should additionally be considered as writing to a file path.
Entries in this array use the
<code>FunctionInfo</code>
format from the dependencies query.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L60"><code><span title="Whether URLs should be validated by checking the endpoint exists. When false (default), URLs are silently ignored. When true, an HTTP HEAD request is made and the URL is reported if unreachable.">checkUrls</span></code></a>\
Whether URLs should be validated by checking the endpoint exists.
When `false` (default), URLs are silently ignored.
When `true`, an HTTP HEAD request is made and the URL is reported if unreachable.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/file-path-validity.ts#L54"><code><span title="Whether unknown file paths should be included as linting results.">includeUnknown</span></code></a>\
Whether unknown file paths should be included as linting results.

### Examples

```r

my_data <- read.csv("C:/Users/me/Documents/My R Scripts/Reproducible.csv")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "file-path-validity",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (8 ms)\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `C:/Users/me/Documents/My R Scripts/Reproducible.csv` at 2.12-74\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "file-path-validity": {
        "results": [{"involvedId":4,"loc":[2,12,2,74],"filePath":"C:/Users/me/Documents/My R Scripts/Reproducible.csv","certainty":"certain"}],
        ".meta": {"totalReads":1,"totalUnknown":0,"totalWritesBeforeAlways":0,"totalValid":0}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-file-path-validity.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts)

<h4 id="Test_32_Case:_32_none">Test Case: none</h4>

> As the script contains no file paths, we expect no issues

Given the following input:

```r
cat("hello")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_data_32_set_32_name_32_is_32_no_32_file">Test Case: a data set name is no file</h4>

Given the following input:

```r
data("rat")
```

We expect the linter to report the following:

* uncertain at 1.1-1.11: filePath = `'data/rat'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_data_32_set_32_in_32_the_32_data_32_directory">Test Case: a data set in the data directory</h4>

Given the following input:

```r
data("rat")
```

And using the following [configuration](#configuration): 
```ts
{addFiles: [new FlowrInlineTextFile('data/rat.rda', '')]}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_base_32_data_32_set">Test Case: a base data set</h4>

Given the following input:

```r
data("iris")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_data_32_set_32_of_32_a_32_named_32_package">Test Case: a data set of a named package</h4>

Given the following input:

```r
data("rat", package = "foo")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L24) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_data_32_set_32_a_32_loaded_32_package_32_may_32_provide">Test Case: a data set a loaded package may provide</h4>

Given the following input:

```r
library(foo)
data("rat")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_package_32_attached_32_only_32_after_32_the_32_data_32_call_32_provides_32_nothing_32_to_32_it">Test Case: a package attached only after the data call provides nothing to it</h4>

Given the following input:

```r
data("Boston")
library(MASS)
```

We expect the linter to report the following:

* uncertain at 1.1-1.14: filePath = `'data/Boston'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_package_32_named_32_for_32_one_32_data_32_call_32_does_32_not_32_cover_32_another">Test Case: a package named for one data call does not cover another</h4>

Given the following input:

```r
data("Boston", package = "MASS")
data("mouse")
```

We expect the linter to report the following:

* uncertain at 2.1-2.13: filePath = `'data/mouse'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_namespaced_32_data_32_call">Test Case: a namespaced data call</h4>

Given the following input:

```r
utils::data("rat")
```

We expect the linter to report the following:

* uncertain at 1.1-1.18: filePath = `'data/rat'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_every_32_data_32_set_32_named">Test Case: every data set named</h4>

Given the following input:

```r
data("iris", "rat")
```

We expect the linter to report the following:

* uncertain at 1.1-1.19: filePath = `'data/rat'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_data_32_set_32_named_32_by_32_list">Test Case: a data set named by list</h4>

Given the following input:

```r
data(list = "rat")
```

We expect the linter to report the following:

* uncertain at 1.1-1.18: filePath = `'data/rat'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_data_32_set_32_after_32_setwd">Test Case: a data set after setwd</h4>

Given the following input:

```r
setwd("sub")
data("rat")
```

And using the following [configuration](#configuration): 
```ts
{addFiles: [new FlowrInlineTextFile('data/rat.rda', '')]}
```

We expect the linter to report the following:

* uncertain at 2.1-2.11: filePath = `'data/rat'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_the_32_native_32_pipe_32_hands_32_the_32_file_32_over">Test Case: the native pipe hands the file over</h4>

Given the following input:

```r
"missing.csv" |> read.csv()
```

We expect the linter to report the following:

* certain at 1.18-1.27: filePath = `'missing.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_named_32_argument_32_is_32_no_32_positional_32_file_44__32_the_32_piped_32_one_32_is">Test Case: a named argument is no positional file, the piped one is</h4>

Given the following input:

```r
library(magrittr)
"a.csv" %>% read.csv(stringsAsFactors = FALSE)
```

We expect the linter to report the following:

* certain at 2.13-2.46: filePath = `'a.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_read_32_guarded_32_by_32_an_32_existence_32_check_32_of_32_the_32_same_32_file">Test Case: a read guarded by an existence check of the same file</h4>

Given the following input:

```r
if(file.exists("cfg.yml")) readLines("cfg.yml")
```

We expect the linter to report the following:

* uncertain at 1.28-1.47: filePath = `'cfg.yml'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_check_32_of_32_another_32_file_32_is_32_no_32_guard">Test Case: a check of another file is no guard</h4>

Given the following input:

```r
if(file.exists("other.yml")) readLines("cfg.yml")
```

We expect the linter to report the following:

* certain at 1.30-1.49: filePath = `'cfg.yml'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_check_32_whose_32_branch_32_does_32_not_32_hold_32_the_32_read_32_is_32_no_32_guard">Test Case: a check whose branch does not hold the read is no guard</h4>

Given the following input:

```r
if(file.exists("cfg.yml")) 1
readLines("cfg.yml")
```

We expect the linter to report the following:

* certain at 2.1-2.20: filePath = `'cfg.yml'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L56) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_data_32_built_32_from_32_constants_32_reads_32_no_32_file">Test Case: data built from constants reads no file</h4>

Given the following input:

```r
m <- matrix(1:6, nrow = 2)
t(m) %*% m
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_simple">Test Case: simple</h4>

> Assuming, that `file.csv` exists, we expect the linter to not report any issues, but to report an invalid file path for `file-missing.csv`

Given the following input:

```r
cat("hello")
read.csv("file.csv")
read.csv("file-missing.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* certain at 3.1-3.28: filePath = `'file-missing.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L61) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_simple_32_ignore_32_case">Test Case: simple ignore case</h4>

> If we configure the linter to ignore capitalization, we expect the linter to not report an issue for `file.csv`, but still report an issue for `file-missing.csv`

Given the following input:

```r
cat("hello")
read.csv("FiLe.csv")
read.csv("FiLe-missing.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* certain at 3.1-3.28: filePath = `'FiLe-missing.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_deep">Test Case: deep</h4>

> Linting should also work for relative paths, as long as the file exists, we assume `path/to/deep-file.csv` to exist

Given the following input:

```r
cat("hello")
read.csv("path/to/deep-file.csv")
read.csv("path/to/deep-file-missing.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* certain at 3.1-3.41: filePath = `'path/to/deep-file-missing.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L69) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_deep_32_lax">Test Case: deep lax</h4>

> If we use a relative path that is not valid (we expect there to be no `invalid/` folder), we expect the linter to report an issue too

Given the following input:

```r
cat("hello")
read.csv("invalid/path/to/deep-file.csv")
read.csv("invalid/path/to/deep-file-missing.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* certain at 3.1-3.49: filePath = `'invalid/path/to/deep-file-missing.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_setwd_32_relative_32_valid">Test Case: setwd relative valid</h4>

Given the following input:

```r
setwd("sub")
read.csv("only-here.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles: wdFiles}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L78) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_setwd_32_hides_32_the_32_old_32_root">Test Case: setwd hides the old root</h4>

Given the following input:

```r
setwd("sub")
read.csv("only-here.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles: [new FlowrInlineTextFile('only-here.csv', '')]}
```

We expect the linter to report the following:

* certain at 2.1-2.25: filePath = `'only-here.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L80) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_setwd_32_relative_32_missing">Test Case: no setwd relative missing</h4>

> without the setwd the same relative path is missing (guards the case above against a false pass)

Given the following input:

```r
read.csv("only-here.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles: wdFiles}
```

We expect the linter to report the following:

* certain at 1.1-1.25: filePath = `'only-here.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L84) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_write_32_before">Test Case: write before</h4>

> If we use a relative path that is not valid, but we create a file of such a name within the script, we expect the linter to not report an issue

Given the following input:

```r
write.csv("hello", "file-missing.csv")
read.csv("file-missing.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L88) for the test-case implementation.
		
<h4 id="Test_32_Case:_32__96_created_32_by_32__36__123_create_125__96_">Test Case: `created by ${create}`</h4>

Given the following input:

```r
`${create}
read.csv("file-missing.csv")`
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L90) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_creating_32_another_32_file_32_does_32_not_32_create_32_the_32_one_32_read">Test Case: creating another file does not create the one read</h4>

Given the following input:

```r
file.create("other.csv")
read.csv("file-missing.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* certain at 2.1-2.28: filePath = `'file-missing.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L92) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_write_32_before_32_ignore_32_case">Test Case: write before ignore case</h4>

> If we use a relative path that is not valid, but we create a file of such a name within the script, and ignore case, we expect the linter to not report an issue

Given the following input:

```r
write.csv("hello", "FiLe-missing.csv")
read.csv("file-missing.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L96) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_write_32_before_32_never">Test Case: write before never</h4>

> If the code that is supposed to write the file is never executed, we expect the linter to report an issue for the missing file

Given the following input:

```r
if(FALSE) { write.csv("hello", "file-missing.csv") }
read.csv("file-missing.csv")
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* certain at 2.1-2.28: filePath = `'file-missing.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L98) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_const">Test Case: const</h4>

> We should be able to recognize file paths that are bound to variables

Given the following input:

```r
path <- "file.csv"; read.csv(path)
```

And using the following [configuration](#configuration): 
```ts
{includeUnknown: true, addFiles}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L102) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unknown_32_off">Test Case: unknown off</h4>

> If we configure the linter to do nothing for unknown file paths, we expect it to not report an issue for the unknown file path

Given the following input:

```r
path <- "file" + runif(1) + ".csv"; read.csv(path)
```

And using the following [configuration](#configuration): 
```ts
{includeUnknown: false, addFiles}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L105) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unknown_32_on">Test Case: unknown on</h4>

> If we configure the linter to report unknown file paths, we expect it to report an issue for the unknown file path

Given the following input:

```r
path <- "file" + runif(1) + ".csv"; read.csv(path)
```

And using the following [configuration](#configuration): 
```ts
{includeUnknown: true, addFiles}
```

We expect the linter to report the following:

* uncertain at 1.37-1.50: filePath = `Unknown`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L108) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_url_32_and_32_missing_32_file">Test Case: url and missing file</h4>

Given the following input:

```r
`read.csv("${remoteUrls[0]}")
read.csv("missing.csv")`
```

We expect the linter to report the following:

* certain at 2.1-2.23: filePath = `'missing.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L128) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_url_32_and_32_existing_32_file">Test Case: url and existing file</h4>

Given the following input:

```r
`read.csv("${remoteUrls[0]}")
read.csv("file.csv")`
```

And using the following [configuration](#configuration): 
```ts
{addFiles}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L131) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_file://_32_missing">Test Case: file:// missing</h4>

Given the following input:

```r
read.csv("file:///missing/file.csv")
```

We expect the linter to report the following:

* certain at 1.1-1.36: filePath = `'/missing/file.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-file-path-validity.test.ts#L136) for the test-case implementation.