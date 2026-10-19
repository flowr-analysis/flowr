_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 04:36:32 UTC (v2.16.2), do not edit directly._
<h2 id="namespace-tampering">Namespace Tampering&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#37](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-37) 🟩

This rule is a `best-effort` rule.
 
Finds `unlockBinding()` and `assignInNamespace()` on other namespaces, `.Internal()` calls, and `library.dynam()` given a file extension.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/namespace-tampering.ts#L110">src/linter/rules/cmd-check/namespace-tampering.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `namespace-tampering` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/namespace-tampering.ts#L40"><code><span title="report .Internal calls (default true)">checkInternal</span></code></a>\
report `.Internal` calls (default `true`)

### Examples

```r
patch <- function() assignInNamespace("mean", function(x, ...) 42, "base")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "namespace-tampering",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Namespace Tampering** (namespace-tampering):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ assign-in-namespace of base at 1.21-74\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "namespace-tampering": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 14,
            "loc": [1,21,1,74],
            "kind": "assign-in-namespace",
            "namespace": "base",
            "message": "assignInNamespace() into the namespace of 'base' changes code the package does not own"
          }
        ],
        ".meta": {}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

More examples are the test cases in [test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts).