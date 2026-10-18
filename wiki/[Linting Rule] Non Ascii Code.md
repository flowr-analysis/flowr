_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="non-ascii-code">Non-ASCII Code&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a>

This rule is a `best-effort` rule.
 
Port of the `R CMD check` note *"Found the following file with non-ASCII characters"* (`checking code files for non-ASCII characters`). Portable packages must use only ASCII in their R code outside of comments, and `R CMD check` does not exempt string literals. Unlike the check, which names only the file, this reports each string literal and symbol (function, variable or parameter name) holding non-ASCII characters, lists those characters, and offers to escape string literals as `\uxxxx` (`\U{xxxxx}` above U+FFFF). Comments are ignored, and the `NAMESPACE` file is checked line by line like the code.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/non-ascii-code.ts#L65">src/linter/rules/cmd-check/non-ascii-code.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `non-ascii-code` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/non-ascii-code.ts#L25"><code><span title="report string literals holding non-ASCII characters (default true, as R CMD check does)">checkStrings</span></code></a>\
report string literals holding non-ASCII characters (default `true`, as `R CMD check` does)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/non-ascii-code.ts#L27"><code><span title="report symbols holding non-ASCII characters (default true, as R CMD check does)">checkSymbols</span></code></a>\
report symbols holding non-ASCII characters (default `true`, as `R CMD check` does)

### Examples

```r
escaped <- function() message("Gr\u00fc\u00dfe")
literal <- function() message("Grüße")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "non-ascii-code",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Non-ASCII Code** (non-ascii-code):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ non-ASCII string ["ü","ß"] at 2.31-37 (1 quick fix(es) available)\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "non-ascii-code": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 10,
            "loc": [2,31,2,37],
            "kind": "string",
            "characters": ["ü","ß"],
            "message": "Non-ASCII characters in string literal (ü, ß), use \\uxxxx escapes instead",
            "quickFix": [{"type":"replace","description":"Escape the non-ASCII characters","replacement":"\"Gr\\u00fc\\u00dfe\"","loc":[2,31,2,37]}]
          }
        ],
        ".meta": {"consideredTokens":6}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts)

<h4 id="Test_32_Case:_32_umlaut_32_in_32_a_32_string">Test Case: umlaut in a string</h4>

Given the following input:

```r
f <- function() "ü"
```

We expect the linter to report the following:

* certain: kind = `'string'`, characters = `['ü']`, message = `'Non-ASCII characters in string literal (ü), use \\uxxxx escapes instead'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L11) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_emoji_32_outside_32_the_32_BMP">Test Case: emoji outside the BMP</h4>

Given the following input:

```r
f <- function() "😀"
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['😀']`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L14) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_CJK_32_characters">Test Case: CJK characters</h4>

Given the following input:

```r
f <- function() "中文"
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['中', '文']`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_single_32_quotes_32_are_32_kept_32_in_32_the_32_fix">Test Case: single quotes are kept in the fix</h4>

Given the following input:

```r
f <- function() 'é'
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['é']`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_mixed_32_ASCII_32_and_32_non-ASCII_32_characters">Test Case: mixed ASCII and non-ASCII characters</h4>

Given the following input:

```r
f <- function() "naïve text"
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['ï']`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_distinct_32_characters_32_are_32_listed_32_once">Test Case: distinct characters are listed once</h4>

Given the following input:

```r
f <- function() "éé"
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['é']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_escaped_32_quotes_32_are_32_kept_32_in_32_the_32_fix">Test Case: escaped quotes are kept in the fix</h4>

Given the following input:

```r
f <- function() "\\"é\\""
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['é']`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_raw_32_string_32_gets_32_no_32_quick_32_fix">Test Case: raw string gets no quick fix</h4>

Given the following input:

```r
f <- function() r"(é)"
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['é']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_hash_32_inside_32_a_32_string_32_is_32_no_32_comment">Test Case: hash inside a string is no comment</h4>

Given the following input:

```r
f <- function() "# é"
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['é']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_string_32_as_32_argument_32_name_32_is_32_a_32_symbol">Test Case: string as argument name is a symbol</h4>

Given the following input:

```r
x <- c("ö" = 1)
```

We expect the linter to report the following:

* reported: kind = `'symbol'`, characters = `['ö']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_location_32_of_32_a_32_string_32_in_32_a_32_multi-line_32_function">Test Case: location of a string in a multi-line function</h4>

Given the following input:

```r
f <- function() {
  "ü"
}
```

We expect the linter to report the following:

* reported

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_each_32_string_32_is_32_reported">Test Case: each string is reported</h4>

Given the following input:

```r
x <- "ä"
y <- "ö"
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['ä']`
* reported: kind = `'string'`, characters = `['ö']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_umlaut_32_in_32_a_32_symbol_32_name">Test Case: umlaut in a symbol name</h4>

Given the following input:

```r
café <- 1
```

We expect the linter to report the following:

* certain: kind = `'symbol'`, characters = `['é']`, message = `'Non-ASCII characters in symbol name (é), use ASCII only'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_backtick_32_name">Test Case: backtick name</h4>

Given the following input:

```r
`naïve` <- 1
```

We expect the linter to report the following:

* reported: kind = `'symbol'`, characters = `['ï']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_function_32_name">Test Case: function name</h4>

Given the following input:

```r
fü <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'symbol'`, characters = `['ü']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L56) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_call_32_of_32_a_32_function_32_with_32_a_32_non-ASCII_32_name">Test Case: call of a function with a non-ASCII name</h4>

Given the following input:

```r
fü()
```

We expect the linter to report the following:

* reported: kind = `'symbol'`, characters = `['ü']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_function_32_parameter_32_name">Test Case: function parameter name</h4>

Given the following input:

```r
f <- function(ü) 1
```

We expect the linter to report the following:

* reported: kind = `'symbol'`, characters = `['ü']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_argument_32_name_32_of_32_a_32_call">Test Case: argument name of a call</h4>

Given the following input:

```r
x <- list(é = 1)
```

We expect the linter to report the following:

* reported: kind = `'symbol'`, characters = `['é']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dollar_32_access_32_to_32_a_32_non-ASCII_32_field">Test Case: dollar access to a non-ASCII field</h4>

Given the following input:

```r
x$é
```

We expect the linter to report the following:

* reported: kind = `'symbol'`, characters = `['é']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_symbols_32_with_32_several_32_non-ASCII_32_characters">Test Case: symbols with several non-ASCII characters</h4>

Given the following input:

```r
ñáé <- 1
```

We expect the linter to report the following:

* reported: kind = `'symbol'`, characters = `['ñ', 'á', 'é']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L71) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_symbol_32_and_32_string_32_in_32_one_32_line">Test Case: symbol and string in one line</h4>

Given the following input:

```r
é <- "ü"
```

We expect the linter to report the following:

* reported: kind = `'symbol'`, characters = `['é']`
* reported: kind = `'string'`, characters = `['ü']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L77) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_strings_32_can_32_be_32_ignored">Test Case: strings can be ignored</h4>

Given the following input:

```r
f <- function() "ü"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L83) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_symbols_32_can_32_be_32_ignored">Test Case: symbols can be ignored</h4>

Given the following input:

```r
café <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L84) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_ignoring_32_symbols_32_keeps_32_strings">Test Case: ignoring symbols keeps strings</h4>

Given the following input:

```r
é <- "ü"
```

We expect the linter to report the following:

* reported: kind = `'string'`, characters = `['ü']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L85) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_non-ASCII_32_export">Test Case: non-ASCII export</h4>

Given the following input:

```r
f <- 1
```

We expect the linter to report the following:

* reported: kind = `'namespace'`, characters = `['ü']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L91) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_one_32_finding_32_per_32_line">Test Case: one finding per line</h4>

Given the following input:

```r
f <- 1
```

We expect the linter to report the following:

* reported: kind = `'namespace'`, characters = `['é']`
* reported: kind = `'namespace'`, characters = `['ö']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L92) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_comments_32_are_32_ignored">Test Case: comments are ignored</h4>

Given the following input:

```r
f <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L93) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_ASCII_32_NAMESPACE">Test Case: ASCII NAMESPACE</h4>

Given the following input:

```r
f <- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L94) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_non-ASCII_32_only_32_in_32_a_32_comment">Test Case: non-ASCII only in a comment</h4>

Given the following input:

```r
# café
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L98) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_roxygen_32_comment">Test Case: roxygen comment</h4>

Given the following input:

```r
#' Returns the café
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L99) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_trailing_32_comment">Test Case: trailing comment</h4>

Given the following input:

```r
x <- 1 # é
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L100) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unicode_32_escape_32_already_32_used">Test Case: unicode escape already used</h4>

Given the following input:

```r
f <- function() "\\u00e9"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L101) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_ASCII_32_only_32_code">Test Case: ASCII only code</h4>

Given the following input:

```r
f <- function(x) "abc"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L102) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_file_32_is_32_no_32_package_32_code">Test Case: test file is no package code</h4>

Given the following input:

```r
x <- "ü"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L103) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_inst_32_file_32_is_32_no_32_package_32_code">Test Case: inst file is no package code</h4>

Given the following input:

```r
x <- "ü"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts#L104) for the test-case implementation.