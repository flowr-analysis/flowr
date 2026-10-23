_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 06:47:02 UTC (v2.16.2), do not edit directly._
<h2 id="non-ascii-code">Non-ASCII Code&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 36, 44](https://img.shields.io/badge/cmd--check-36%2C%2044-blueviolet) </a> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [36](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-36) | [code files for non-ASCII characters](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L2133) ([book](https://r-pkgs.org/R-CMD-check.html#r-code)) | 🟩⭐ | ⭐ also reports each token instead of each file, escapes strings as a quick fix |
| [44](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-44) | [package namespace information](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6863) ([book](https://r-pkgs.org/R-CMD-check.html#namespace)) | 🔶 |  |

This rule is a `best-effort` rule.
 
Finds non-ASCII characters in R code and the NAMESPACE outside of comments. Offers `\u` escapes for strings as a quick fix.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/non-ascii-code.ts#L65">src/linter/rules/cmd-check/non-ascii-code.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `non-ascii-code` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/non-ascii-code.ts#L25"><code><span title="report string literals holding non-ASCII characters (default true, as R CMD check does)">checkStrings</span></code></a>\
report string literals holding non-ASCII characters (default `true`, as `R CMD check` does)\
_R CMD check [#36](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-36 "checking code files for non-ASCII characters")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/non-ascii-code.ts#L27"><code><span title="report symbols holding non-ASCII characters (default true, as R CMD check does)">checkSymbols</span></code></a>\
report symbols holding non-ASCII characters (default `true`, as `R CMD check` does)\
_R CMD check [#36](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-36 "checking code files for non-ASCII characters")_

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

Query: **linter** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ **Non-ASCII Code** (non-ascii-code):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ non-ASCII string ["ü","ß"] at 2.31-37 (1 quick fix(es) available)

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

More examples are the test cases in [test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-non-ascii-code.test.ts).