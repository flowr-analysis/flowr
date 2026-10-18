_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 21:25:13 UTC (v2.16.2), do not edit directly._
<h2 id="rd-files">Rd Files&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#45](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-45) 🟩, [#46](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-46) 🟩, [#47](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-47) 🔷, [#50](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-50) 🟩, [#51](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-51) 🟩, [#52](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-52) 🟩, [#53](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-53) 🔷, [#54](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-54) 🔷, [#55](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-55) 🔷, [#88](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-88) 🔷, [#89](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-89) 🔷, [#90](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-90) 🔶, [#91](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-91) 🔶, [#92](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-92) 🔷

This rule is a `best-effort` rule.
 
Checks the Rd files: syntax, unknown macros, required and duplicated sections, metadata, cross-references, line widths, contents, and the example code.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L1089">src/linter/rules/cmd-check/rd-files.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `rd-files` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L111"><code><span title="check bibentries cited and shown (default true)">bibentries</span></code></a>\
check bibentries cited and shown (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L101"><code><span title="check the content of the pages (checking Rd contents, default true)">contents</span></code></a>\
check the content of the pages (`checking Rd contents`, default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L91"><code><span title="check the \\link targets (checking Rd cross-references, default true)">crossReferences</span></code></a>\
check the `\link` targets (`checking Rd cross-references`, default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L109"><code><span title="check how \\usage entries are written (checking Rd \\usage sections, default true)">docStyle</span></code></a>\
check how `\usage` entries are written (`checking Rd \usage sections`, default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L113"><code><span title="check the code of \\examples (checking examples, default true)">examples</span></code></a>\
check the code of `\examples` (`checking examples`, default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L99"><code><span title="the widest \\examples line the PDF manual does not truncate (default 100)">examplesWidth</span></code></a>\
the widest `\examples` line the PDF manual does not truncate (default `100`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L115"><code><span title="macros that are defined outside of the package (Rd macro packages) and hence no unknown macros (default none)">extraMacros</span></code></a>\
macros that are defined outside of the package (Rd macro packages) and hence no unknown macros (default none)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L107"><code><span title="the keywords accepted when standardKeywords is on (default: the standard keywords of R)">keywords</span></code></a>\
the keywords accepted when
<code>standardKeywords</code>
is on (default: the standard keywords of R)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L95"><code><span title="check the width of \\usage and \\examples lines (checking Rd line widths, default true)">lineWidths</span></code></a>\
check the width of `\usage` and `\examples` lines (`checking Rd line widths`, default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L89"><code><span title="check names and aliases across pages (checking Rd metadata, default true)">metadata</span></code></a>\
check names and aliases across pages (`checking Rd metadata`, default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L87"><code><span title="report only the checkRd messages of at least this level, as R CMD check does with -1 (default -1, use -Infinity for all)">minLevel</span></code></a>\
report only the `checkRd` messages of at least this level, as `R CMD check` does with `-1` (default `-1`, use `-Infinity` for all)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L85"><code><span title="check the structure and markup of every page (checking Rd files, default true)">parse</span></code></a>\
check the structure and markup of every page (`checking Rd files`, default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L103"><code><span title="also demand a \\value on pages with a \\usage, which R CMD check does only for CRAN (default false)">requireValue</span></code></a>\
also demand a `\value` on pages with a `\usage`, which `R CMD check` does only for CRAN (default `false`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L105"><code><span title="report \\keyword entries that are not in R's KEYWORDS.db (default false, R CMD check does not)">standardKeywords</span></code></a>\
report `\keyword` entries that are not in R's `KEYWORDS.db` (default `false`, `R CMD check` does not)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L93"><code><span title="also report \\link{target} and \\link[pkg]{target} flowR cannot find in the signature database, with lower certainty (default true)">uncertainLinks</span></code></a>\
also report `\link{target}` and `\link[pkg]{target}` flowR cannot find in the signature database, with lower certainty (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L117"><code><span title="the URL schemes \\url and \\href may use (default: the common IANA schemes)">urlSchemes</span></code></a>\
the URL schemes `\url` and `\href` may use (default: the common IANA schemes)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/rd-files.ts#L97"><code><span title="the widest \\usage line the PDF manual does not truncate (default 90)">usageWidth</span></code></a>\
the widest `\usage` line the PDF manual does not truncate (default `90`)

### Examples

```r
f <- function() 1
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "rd-files",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Rd Files** (rd-files): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"rd-files":{"results":[],".meta":{"checkedFiles":0}}},".meta":{}},".meta":{}}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-rd-files.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts)

<h4 id="Test_32_Case:_32_name">Test Case: name</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

```ts
expected.map(kind => ({kind}))
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts#L13) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unbalanced_32_braces:_32_message_32_and_32_line">Test Case: unbalanced braces: message and line</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'rd-syntax'`, message = `'f.Rd:5: unexpected END_OF_INPUT (the \'{\' on line 5 is never closed)'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unknown_32_macro">Test Case: unknown macro</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'rd-unknown-macro'`, message = `'f.Rd:6: unknown macro \'\\foo\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_repeated_32_unique_32_section">Test Case: repeated unique section</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'rd-structure'`, message = `'f.Rd:5: Only one \\description section is allowed: the first will be used'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_duplicated_32_alias:_32_message">Test Case: duplicated alias: message</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'rd-duplicate-alias'`, file = `'man/g.Rd'`, message = `'Rd files with duplicated alias \'f\': f.Rd, g.Rd'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts#L88) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_wrong_32_base_32_package:_32_certainty">Test Case: wrong base package: certainty</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* uncertain: kind = `'rd-missing-link'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts#L110) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_usage_32_line_32_too_32_wide">Test Case: usage line too wide</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'rd-line-width'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts#L119) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_examples_32_that_32_do_32_not_32_parse">Test Case: examples that do not parse</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'rd-example-syntax'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts#L157) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_example_32_finding_32_lines">Test Case: example finding lines</h4>

Given the following input:

```r
code
```

We expect the linter to report the following:

* reported: kind = `'rd-example-quit'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-rd-files.test.ts#L177) for the test-case implementation.