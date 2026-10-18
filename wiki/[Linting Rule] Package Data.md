_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 21:25:13 UTC (v2.16.2), do not edit directly._
<h2 id="package-data">Package Data&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

R CMD check: [#34](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-34) 🟩, [#48](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-48) 🟩, [#60](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-60) 🟩, [#61](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-61) 🟩, [#62](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-62) 🟩, [#63](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-63) 🟩, [#64](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-64) 🔶

This rule is a `best-effort` rule.
 
Checks `data/` and `R/sysdata.rda`: allowed file types, LazyData, compression, the serialization version R needs, and undocumented data sets.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L128">src/linter/rules/cmd-check/package-data.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-data` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L32"><code><span title="whether to check that saves are compressed (R CMD check does with _R_CHECK_COMPACT_DATA_, default true)">checkCompaction</span></code></a>\
whether to check that saves are compressed (`R CMD check` does with `_R_CHECK_COMPACT_DATA_`, default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L34"><code><span title="whether to check that the data sets are documented in man (default true)">checkUndocumented</span></code></a>\
whether to check that the data sets are documented in `man` (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L28"><code><span title="the extensions (without the leading dot) a file in data may have, R CMD check default">dataExtensions</span></code></a>\
the extensions (without the leading dot) a file in `data` may have, `R CMD check` default
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-data.ts#L30"><code><span title="an uncompressed or ASCII save above this many bytes is flagged (default 100000)">maxUncompressedSize</span></code></a>\
an uncompressed or ASCII save above this many bytes is flagged (default `100000`)

### Examples

```r
f <- function() 1
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-data",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Data** (package-data): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"package-data":{"results":[],".meta":{"inspectedDataFiles":0,"onDisk":false}}},".meta":{}},".meta":{}}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-package-data.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts)

<h4 id="Test_32_Case:_32_allowed_32_data_32_files_32_are_32_fine">Test Case: allowed data files are fine</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_file_32_type_32_R_32_does_32_not_32_read_32_as_32_data">Test Case: file type R does not read as data</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: kind = `'data-directory'`, file = `'data/notes.md'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_upper-case_32_RDA_32_extension_32_is_32_not_32_allowed">Test Case: upper-case RDA extension is not allowed</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: kind = `'data-directory'`, file = `'data/x.RDA'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L56) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_subdirectory_32_in_32_data">Test Case: subdirectory in data</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: kind = `'data-directory'`, file = `'data/sub'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_hidden_32_files_32_are_32_not_32_listed_32_by_32_R">Test Case: hidden files are not listed by R</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_datalist_32_with_32_a_32_malformed_32_line">Test Case: datalist with a malformed line</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: kind = `'data-directory'`, file = `'data/datalist'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_datalist_32_entries_32_are_32_fine">Test Case: datalist entries are fine</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_LazyData_32_without_32_data_32_directory">Test Case: LazyData without data directory</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: kind = `'lazydata'`, file = `'DESCRIPTION'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_LazyData_32_with_32_data_32_directory">Test Case: LazyData with data directory</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L77) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_LazyData_32_off_44__32_compression_32_stated">Test Case: LazyData off, compression stated</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: kind = `'lazydata'`, file = `'DESCRIPTION'`, message = `'\'LazyDataCompression\' is specified without \'LazyData\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L80) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_LazyData_32_off_44__32_nothing_32_stated">Test Case: LazyData off, nothing stated</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L83) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_LazyDataCompression_32_without_32_data_32_directory">Test Case: LazyDataCompression without data directory</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: kind = `'lazydata'`, file = `'DESCRIPTION'`, message = `'\'LazyData\' is specified without a \'data\' directory'`
* reported: kind = `'lazydata'`, file = `'DESCRIPTION'`, message = `'\'LazyDataCompression\' is specified without a \'data\' directory'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L86) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_LazyDataCompression_32_without_32_LazyData">Test Case: LazyDataCompression without LazyData</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: kind = `'lazydata'`, file = `'DESCRIPTION'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L90) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undocumented_32_LazyDataCompression_32_value">Test Case: undocumented LazyDataCompression value</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* reported: kind = `'lazydata'`, file = `'DESCRIPTION'`, message = `'undocumented value \'lz4\' of field \'LazyDataCompression\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L93) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_documented_32_LazyDataCompression_32_values">Test Case: documented LazyDataCompression values</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L96) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_saves_32_are_32_only_32_read_32_from_32_disk">Test Case: saves are only read from disk</h4>

Given the following input:

```r
x <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-data.test.ts#L102) for the test-case implementation.