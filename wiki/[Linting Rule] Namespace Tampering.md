_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 21:25:13 UTC (v2.16.2), do not edit directly._
<h2 id="namespace-tampering">Namespace Tampering&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#37](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-37) 🟩

This rule is a `best-effort` rule.
 
Finds `unlockBinding()` and `assignInNamespace()` on other namespaces, `.Internal()` calls, and `library.dynam()` given a file extension.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/namespace-tampering.ts#L112">src/linter/rules/cmd-check/namespace-tampering.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `namespace-tampering` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/namespace-tampering.ts#L42"><code><span title="report .Internal calls (default true)">checkInternal</span></code></a>\
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

Query: **linter** (2 ms)\
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

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts)

<h4 id="Test_32_Case:_32_in_32_another_32_namespace">Test Case: in another namespace</h4>

Given the following input:

```r
f <- function() unlockBinding("mean", asNamespace("base"))
```

We expect the linter to report the following:

* certain: kind = `'unlock-binding'`, namespace = `'base'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L10) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_getNamespace">Test Case: getNamespace</h4>

Given the following input:

```r
f <- function() unlockBinding("x", getNamespace("stats"))
```

We expect the linter to report the following:

* reported: kind = `'unlock-binding'`, namespace = `'stats'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L13) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_package_32_name_32_in_32_a_32_variable_32__40_flowR_32_extension_41_">Test Case: package name in a variable (flowR extension)</h4>

Given the following input:

```r
p <- "stats"
f <- function() unlockBinding("x", asNamespace(p))
```

We expect the linter to report the following:

* reported: kind = `'unlock-binding'`, namespace = `'stats'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L14) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_namespace_32_in_32_a_32_variable_32__40_flowR_32_extension_41_">Test Case: namespace in a variable (flowR extension)</h4>

Given the following input:

```r
f <- function() {
  ns <- asNamespace("base")
  unlockBinding("mean", ns)
}
```

We expect the linter to report the following:

* reported: kind = `'unlock-binding'`, namespace = `'base'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L15) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_own_32_namespace_32_in_32_a_32_variable">Test Case: own namespace in a variable</h4>

Given the following input:

```r
f <- function() { ns <- topenv(); unlockBinding("x", ns) }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L16) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_own_32_namespace">Test Case: own namespace</h4>

Given the following input:

```r
f <- function() unlockBinding("x", asNamespace("pkg"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_own_32_namespace_32_through_32_topenv">Test Case: own namespace through topenv</h4>

Given the following input:

```r
f <- function() unlockBinding("x", topenv())
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unknown_32_environment_32_is_32_uncertain">Test Case: unknown environment is uncertain</h4>

Given the following input:

```r
f <- function(e) unlockBinding("x", e)
```

We expect the linter to report the following:

```ts
[{kind: 'unlock-binding', certainty: LintingResultCertainty.Uncertain, namespace: undefined}].map(({namespace: _, ...r}) => r)
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_other_32_package_32_name">Test Case: other package name</h4>

Given the following input:

```r
f <- function() unlockBinding("x", asNamespace("pkg"))
```

We expect the linter to report the following:

* reported: kind = `'unlock-binding'`, namespace = `'pkg'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_through_32_.Internal">Test Case: through .Internal</h4>

Given the following input:

```r
f <- function(e) .Internal(unlockBinding(quote(x), e))
```

We expect the linter to report the following:

* reported: kind = `'unlock-binding'`, internal = `'unlockBinding'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_into_32_base">Test Case: into base</h4>

Given the following input:

```r
f <- function() assignInNamespace("mean", function(x) 1, "base")
```

We expect the linter to report the following:

* reported: kind = `'assign-in-namespace'`, namespace = `'base'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_namespaced_32_call">Test Case: namespaced call</h4>

Given the following input:

```r
f <- function() utils::assignInNamespace("x", 1, ns = "stats")
```

We expect the linter to report the following:

* reported: kind = `'assign-in-namespace'`, namespace = `'stats'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L30) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_into_32_a_32_namespace_32_object">Test Case: into a namespace object</h4>

Given the following input:

```r
f <- function() assignInNamespace("x", 1, ns = asNamespace("stats"))
```

We expect the linter to report the following:

* reported: kind = `'assign-in-namespace'`, namespace = `'stats'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L31) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_into_32_the_32_own_32_namespace">Test Case: into the own namespace</h4>

Given the following input:

```r
f <- function() assignInNamespace("x", 1, "pkg")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assignInMyNamespace_32_is_32_fine">Test Case: assignInMyNamespace is fine</h4>

Given the following input:

```r
f <- function() assignInMyNamespace("x", 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L33) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefined_32_assignInNamespace">Test Case: redefined assignInNamespace</h4>

Given the following input:

```r
assignInNamespace <- function(...) NULL
f <- function() assignInNamespace("x", 1, "base")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_internal_32_call">Test Case: internal call</h4>

Given the following input:

```r
f <- function(x) .Internal(inspect(x))
```

We expect the linter to report the following:

* reported: kind = `'internal'`, internal = `'inspect'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_internal_32_calls_32_can_32_be_32_muted">Test Case: internal calls can be muted</h4>

Given the following input:

```r
f <- function(x) .Internal(inspect(x))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_top-level_32_internal">Test Case: top-level internal</h4>

Given the following input:

```r
x <- .Internal(Sys.time())
```

We expect the linter to report the following:

* reported: kind = `'internal'`, internal = `'Sys.time'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L40) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_with_32_.so">Test Case: with .so</h4>

Given the following input:

```r
.onLoad <- function(lib, pkg) library.dynam("pkg.so", pkg, lib)
```

We expect the linter to report the following:

* reported: kind = `'shared-object-extension'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_with_32_.dll">Test Case: with .dll</h4>

Given the following input:

```r
.onLoad <- function(lib, pkg) library.dynam("pkg.dll", pkg, lib)
```

We expect the linter to report the following:

* reported: kind = `'shared-object-extension'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L45) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unload_32_with_32_.so">Test Case: unload with .so</h4>

Given the following input:

```r
.onUnload <- function(lib) library.dynam.unload("pkg.so", lib)
```

We expect the linter to report the following:

* reported: kind = `'shared-object-extension'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_name_32_through_32_a_32_variable_32__40_flowR_32_extension_41_">Test Case: name through a variable (flowR extension)</h4>

Given the following input:

```r
so <- "pkg.so"
.onLoad <- function(lib, pkg) library.dynam(so, pkg, lib)
```

We expect the linter to report the following:

* reported: kind = `'shared-object-extension'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_without_32_extension">Test Case: without extension</h4>

Given the following input:

```r
.onLoad <- function(lib, pkg) library.dynam("pkg", pkg, lib)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L48) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_name_32_with_32_a_32_dot_32_but_32_no_32_extension">Test Case: name with a dot but no extension</h4>

Given the following input:

```r
.onLoad <- function(lib, pkg) library.dynam("my.pkg", pkg, lib)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L49) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_code_32_may_32_tamper">Test Case: test code may tamper</h4>

Given the following input:

```r
unlockBinding("mean", asNamespace("base"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-namespace-tampering.test.ts#L53) for the test-case implementation.