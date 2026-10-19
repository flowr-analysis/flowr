_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 07:43:23 UTC (v2.16.3), do not edit directly._
<h2 id="description-metadata">Description Metadata&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance'>![cmd-check 1, 6, 25–27](https://img.shields.io/badge/cmd--check-1%2C%206%2C%2025%E2%80%9327-blueviolet) </a>

This rule ports the following steps of `R CMD check` (see the [conformance table](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance) for the legend):

| # | Step | Coverage | Note |
|---|------|:--------:|------|
| [1](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-1) | [for file 'DESCRIPTION'](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6706) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🟩⭐ | ⭐ also reports every problem instead of stopping at the first |
| [6](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-6) | [package bundle](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6765) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🔶 |  |
| [25](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-25) | [DESCRIPTION meta-information](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L1008) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🟩 |  |
| [26](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-26) | [CRAN incoming feasibility](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6786) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🔶 | the DESCRIPTION based notes, repository queries are left out |
| [27](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-27) | [package dependencies](https://github.com/wch/r-source/blob/tags/R-4-6-1/src/library/tools/R/check.R#L6949) ([book](https://r-pkgs.org/R-CMD-check.html#description)) | 🔷 | availability and versions asked of the signature database instead of the repositories |

This rule is a `best-effort` rule.
 
Finds problems in the DESCRIPTION: required fields, package name, version, maintainer, dependency fields, license, Authors@R, encoding, and the Title and Description style CRAN asks for.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L199">src/linter/rules/cmd-check/description-metadata.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `description-metadata` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L35"><code><span title="also run the style checks R CMD check --as-cran adds for the Title, Description, and Authors\\@R fields (default true)">cranIncoming</span></code></a>\
also run the style checks `R CMD check --as-cran` adds for the Title, Description, and Authors\@R fields (default `true`)\
_R CMD check [#25](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-25 "checking DESCRIPTION meta-information"), [#26](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-26 "checking CRAN incoming feasibility")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L37"><code><span title="how many non-default packages Depends may list before it is reported, as R CMD check does after five (default 5)">maxDepends</span></code></a>\
how many non-default packages `Depends` may list before it is reported, as `R CMD check` does after five (default `5`)\
_R CMD check [#27](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-27 "checking package dependencies")_
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/description-metadata.ts#L39"><code><span title="how many non-base packages Imports may list before it is reported, 0 for no limit as R CMD check does by default (default 0)">maxImports</span></code></a>\
how many non-base packages `Imports` may list before it is reported, `0` for no limit as `R CMD check` does by default (default `0`)\
_R CMD check [#27](https://github.com/flowr-analysis/flowr/wiki/R-CMD-check-Conformance#cmd-check-27 "checking package dependencies")_

### Examples

A project with the code `R/code.R`:

```r
x <- 1
```

and the files

`DESCRIPTION`:

```text
Package: pkg
Version: 1.0
Title: A Package
License: GPL-3 + file LICENSE
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "description-metadata",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Description Metadata** (description-metadata):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Required field missing or empty: 'Description' at /pkg/DESCRIPTION:1.1\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Required field missing or empty: 'Author' at /pkg/DESCRIPTION:1.1\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Required field missing or empty: 'Maintainer' at /pkg/DESCRIPTION:1.1\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Invalid license file pointers: LICENSE at /pkg/DESCRIPTION:4.1-29\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ The Title field starts with the package name. at /pkg/DESCRIPTION:3.1-16

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "description-metadata": {
        "results": [
          {"certainty":"certain","loc":[1,1,1,1,"/pkg/DESCRIPTION"],"kind":"missing-field","message":"Required field missing or empty: 'Description'"},
          {"certainty":"certain","loc":[1,1,1,1,"/pkg/DESCRIPTION"],"kind":"missing-field","message":"Required field missing or empty: 'Author'"},
          {"certainty":"certain","loc":[1,1,1,1,"/pkg/DESCRIPTION"],"kind":"missing-field","message":"Required field missing or empty: 'Maintainer'"},
          {"certainty":"certain","loc":[4,1,4,29,"/pkg/DESCRIPTION"],"kind":"license","field":"License","message":"Invalid license file pointers: LICENSE"},
          {
            "certainty": "certain",
            "loc": [3,1,3,16,"/pkg/DESCRIPTION"],
            "kind": "title-starts-with-name",
            "field": "Title",
            "message": "The Title field starts with the package name."
          }
        ],
        ".meta": {"hasDescription":true}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-description-metadata.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-description-metadata.test.ts).