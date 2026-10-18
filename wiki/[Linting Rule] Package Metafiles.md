_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="package-metafiles">Package Metafiles&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a `best-effort` rule.
 
Port of the `R CMD check` notes on the metafiles of a package: *"checking index information"* (empty `INDEX` or `demo/00Index`, demos missing from or without a `demo/00Index` entry), *"checking package subdirectories"* (`inst/CITATION` that does not parse, `citEntry()` or `bibentry()` calls with an invalid entry type or missing required fields, CITATION files in a non-standard place), and *"checking relative paths in package URLs"* (relative links of the README and vignettes to files the package does not contain). Unlike `R CMD check`, no R code is run, and it also reports the citation functions superseded by `bibentry()` or `person()`, which `R CMD check` accepts.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L315">src/linter/rules/cmd-check/package-metafiles.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-metafiles` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L42"><code><span title="check inst/CITATION (its syntax, entry types and required fields) and the location of other CITATION files (default true)">citation</span></code></a>\
check `inst/CITATION` (its syntax, entry types and required fields) and the location of other CITATION files (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L40"><code><span title="check the INDEX and the demo/00Index of the package (default true)">index</span></code></a>\
check the `INDEX` and the `demo/00Index` of the package (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L46"><code><span title="check that the relative links of the README, NEWS and vignettes point to files of the package (default true)">relativeLinks</span></code></a>\
check that the relative links of the README, NEWS and vignettes point to files of the package (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-metafiles.ts#L44"><code><span title="report the citation functions superseded by a newer one, which R CMD check accepts (default true)">superseded</span></code></a>\
report the citation functions superseded by a newer one, which `R CMD check` accepts (default `true`)

### Examples

```r
f <- function() 1
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-metafiles",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Metafiles** (package-metafiles): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"package-metafiles":{"results":[],".meta":{"checkedFiles":0}}},".meta":{}},".meta":{}}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-package-metafiles.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts)

<h4 id="Test_32_Case:_32_empty_32_INDEX">Test Case: empty INDEX</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* certain: kind = `'empty-index'`, file = `'INDEX'`, message = `'Empty file \'INDEX\'.'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L12) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_non-empty_32_INDEX">Test Case: non-empty INDEX</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L15) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_demo_32_folder_32_without_32_demo/00Index">Test Case: demo folder without demo/00Index</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'empty-demo-index'`, file = `'demo/00Index'`, message = `'Empty or missing file \'demo/00Index\'.'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L16) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_empty_32_demo/00Index">Test Case: empty demo/00Index</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'empty-demo-index'`, file = `'demo/00Index'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_demo_32_folder_32_needs_32_no_32_demo_32_index">Test Case: no demo folder needs no demo index</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_demo_32_missing_32_from_32_the_32_index">Test Case: demo missing from the index</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'undocumented-demo'`, file = `'demo/b.R'`, message = `'Demos with missing or empty index information: \'b\' (in \'demo/b.R\')'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_demo_32_listed_32_without_32_a_32_description">Test Case: demo listed without a description</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'undocumented-demo'`, file = `'demo/a.R'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_index_32_entry_32_without_32_demo">Test Case: index entry without demo</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'missing-demo'`, file = `'demo/00Index'`, message = `'Demo index entry without corresponding demo: \'ghost\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_index_32_entries_32_without_32_any_32_demo">Test Case: index entries without any demo</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'missing-demo'`, file = `'demo/00Index'`
* reported: kind = `'missing-demo'`, file = `'demo/00Index'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_continued_32_description_32_lines">Test Case: continued description lines</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_demo_32_with_32_a_32_dot_32_in_32_its_32_name">Test Case: demo with a dot in its name</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_lower-case_32_demo_32_extension">Test Case: lower-case demo extension</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_demos_32_in_32_subfolders_32_are_32_no_32_demos">Test Case: demos in subfolders are no demos</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_demos_32_starting_32_with_32_a_32_digit_32_are_32_no_32_demos">Test Case: demos starting with a digit are no demos</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_other_32_file_32_types_32_are_32_no_32_demos">Test Case: other file types are no demos</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_index_32_checks_32_disabled">Test Case: index checks disabled</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_valid_32_bibentry">Test Case: valid bibentry</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_syntax_32_error">Test Case: syntax error</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-syntax'`, file = `'inst/CITATION'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L60) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_syntax_32_error_32_on_32_a_32_later_32_line">Test Case: syntax error on a later line</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-syntax'`, file = `'inst/CITATION'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L63) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_invalid_32_entry_32_type">Test Case: invalid entry type</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-entry-type'`, file = `'inst/CITATION'`, message = `'entry 1: invalid type \'Foo\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L66) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_entry_32_type_32_that_32_is_32_no_32_string">Test Case: entry type that is no string</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-entry-type'`, file = `'inst/CITATION'`, message = `'entry 1: invalid type \'type\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L69) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_entry_32_type_32_is_32_case-insensitive">Test Case: entry type is case-insensitive</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L72) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_missing_32_required_32_fields">Test Case: missing required fields</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-missing-field'`, file = `'inst/CITATION'`, message = `'entry 1 (Article): missing required field(s) \'journal\', \'year\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_alternative_32_fields">Test Case: alternative fields</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L76) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_missing_32_alternative_32_field">Test Case: missing alternative field</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-missing-field'`, file = `'inst/CITATION'`, message = `'entry 1 (Book): missing required field(s) \'author|editor\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L77) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_type_32_without_32_required_32_fields">Test Case: type without required fields</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L80) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_empty_32_and_32_NULL_32_fields_32_do_32_not_32_count">Test Case: empty and NULL fields do not count</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-missing-field'`, file = `'inst/CITATION'`, message = `'entry 1 (Article): missing required field(s) \'year\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L81) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_blank_32_field_32_does_32_not_32_count">Test Case: blank field does not count</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-missing-field'`, file = `'inst/CITATION'`, message = `'entry 1 (Article): missing required field(s) \'year\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L84) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_bibtype_32_given_32_by_32_name">Test Case: bibtype given by name</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L87) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_fields_32_given_32_in_32_a_32_list_32_as_32_other">Test Case: fields given in a list as other</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L88) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_citEntry_32_is_32_checked_32_like_32_bibentry">Test Case: citEntry is checked like bibentry</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-superseded'`, file = `'inst/CITATION'`, message = `'citEntry() is superseded by bibentry(), use that instead'`
* reported: kind = `'citation-missing-field'`, file = `'inst/CITATION'`, message = `'entry 1 (Article): missing required field(s) \'year\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L89) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_entries_32_are_32_numbered">Test Case: entries are numbered</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-entry-type'`, file = `'inst/CITATION'`, message = `'entry 2: invalid type \'Foo\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L93) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_only_32_top-level_32_calls_32_are_32_checked_32_as_32_R_32_does">Test Case: only top-level calls are checked as R does</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L96) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_citation_32_checks_32_disabled">Test Case: citation checks disabled</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L97) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_inst/CITATION_44__32_nothing_32_to_32_check">Test Case: no inst/CITATION, nothing to check</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L98) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_CITATION_32_file_32_at_32_the_32_package_32_root">Test Case: CITATION file at the package root</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-location'`, file = `'CITATION'`, message = `'Found the CITATION file in a non-standard place: \'CITATION\', most likely \'inst/CITATION\' should be used instead'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L102) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_CITATION_32_with_32_an_32_extension_32_in_32_a_32_subfolder">Test Case: CITATION with an extension in a subfolder</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-location'`, file = `'docs/CITATION.R'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L105) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_CITATION_32_location_32_disabled">Test Case: CITATION location disabled</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L108) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_other_32_names_32_are_32_no_32_CITATION_32_file">Test Case: other names are no CITATION file</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L109) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_citHeader_32_is_32_superseded">Test Case: citHeader is superseded</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-superseded'`, file = `'inst/CITATION'`, message = `'citHeader() is superseded by bibentry(), use that instead'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L113) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_personList_32_is_32_superseded_32_by_32_person">Test Case: personList is superseded by person</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-superseded'`, file = `'inst/CITATION'`, message = `'personList() is superseded by person(), use that instead'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L116) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_superseded_32_functions_32_are_32_reported_32_without_32_the_32_other_32_checks">Test Case: superseded functions are reported without the other checks</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'citation-superseded'`, file = `'inst/CITATION'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L119) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_superseded_32_functions_32_disabled">Test Case: superseded functions disabled</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L122) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_link_32_to_32_a_32_file_32_of_32_the_32_package">Test Case: link to a file of the package</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L126) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_link_32_to_32_a_32_missing_32_file">Test Case: link to a missing file</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'relative-link'`, file = `'README.md'`, message = `'Found the (possibly) invalid relative link \'docs/guide.md\' in \'README.md\', no such file in the package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L129) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_link_32_with_32_a_32_title_32_to_32_a_32_missing_32_file">Test Case: link with a title to a missing file</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'relative-link'`, file = `'README.md'`, message = `'Found the (possibly) invalid relative link \'missing.md\' in \'README.md\', no such file in the package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L132) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_anchor_32_of_32_an_32_existing_32_file">Test Case: anchor of an existing file</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L135) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_query_32_of_32_a_32_missing_32_file">Test Case: query of a missing file</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'relative-link'`, file = `'README.md'`, message = `'Found the (possibly) invalid relative link \'gone.md?raw=1\' in \'README.md\', no such file in the package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L136) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_URLs_44__32_anchors_32_and_32_mail_32_addresses_32_are_32_no_32_relative_32_links">Test Case: URLs, anchors and mail addresses are no relative links</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L139) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_html_32_attribute_32_to_32_a_32_missing_32_file">Test Case: html attribute to a missing file</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'relative-link'`, file = `'README.md'`, message = `'Found the (possibly) invalid relative link \'man/x.png\' in \'README.md\', no such file in the package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L142) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_link_32_out_32_of_32_the_32_package">Test Case: link out of the package</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'relative-link'`, file = `'README.md'`, message = `'Found the (possibly) invalid relative link \'../other.md\' in \'README.md\', no such file in the package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L145) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_link_32_of_32_a_32_vignette_32_is_32_relative_32_to_32_the_32_vignette">Test Case: link of a vignette is relative to the vignette</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L148) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vignette_32_link_32_to_32_a_32_missing_32_file">Test Case: vignette link to a missing file</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'relative-link'`, file = `'vignettes/intro.Rmd'`, message = `'Found the (possibly) invalid relative link \'a.png\' in \'vignettes/intro.Rmd\', no such file in the package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L151) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_NEWS_32_links_32_are_32_checked">Test Case: NEWS links are checked</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'relative-link'`, file = `'NEWS.md'`, message = `'Found the (possibly) invalid relative link \'doc/new.md\' in \'NEWS.md\', no such file in the package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L154) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_other_32_markdown_32_files_32_are_32_no_32_package_32_URLs">Test Case: other markdown files are no package URLs</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L157) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_relative_32_links_32_disabled">Test Case: relative links disabled</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L158) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_code_32_without_32_a_32_package_32_checks_32_no_32_metafiles">Test Case: code without a package checks no metafiles</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-metafiles.test.ts#L162) for the test-case implementation.