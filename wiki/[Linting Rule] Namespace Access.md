_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-09-10, 07:04:46 UTC (v2.15.8), do not edit directly._
<h2 id="namespace-access">Namespace Access Validity&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span>

This rule is a `best-effort` rule.
 
Flags `pkg:::name` where `name` is actually exported by `pkg` (so `::` would do), and `pkg::name` where the signature database knows `name` is not exported (which fails at runtime in R). Stays silent whenever the database has no definite answer for the name.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/namespace-access.ts#L35">src/linter/rules/namespace-access.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `namespace-access` rule accepts the following configuration options:

### Examples

```r
dplyr:::filter(df, x > 1)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "namespace-access",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Namespace Access Validity** (namespace-access):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ `dplyr:::filter` at 1.1-25\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "namespace-access": {"results":[{"certainty":"certain","involvedId":0,"loc":[1,1,1,25],"pkg":"dplyr","name":"filter","kind":"unnecessary-internal"}],".meta":{"unresolved":0}}
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-namespace-access.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts)

<h4 id="Test_Case:_unnecessary__:::__on_an_exported_name">Test Case: unnecessary `:::` on an exported name</h4>

Given the following input:

```r
stats:::median
```

And using the following [configuration](#configuration): 
```ts
{sigDb: sigDbWithNames('stats', {median: true})}
```

We expect the linter to report the following:

* certain at 1.1-1.14: pkg = `'stats'`, name = `'median'`, kind = `'unnecessary-internal'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_Case:__::__on_a_name_that_is_not_exported">Test Case: `::` on a name that is not exported</h4>

Given the following input:

```r
stats::C_cor
```

And using the following [configuration](#configuration): 
```ts
{sigDb: sigDbWithNames('stats', {C_cor: false})}
```

We expect the linter to report the following:

* certain at 1.1-1.12: pkg = `'stats'`, name = `'C_cor'`, kind = `'not-exported'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L45) for the test-case implementation.
		
<h4 id="Test_Case:_unnecessary__:::__in_a_call">Test Case: unnecessary `:::` in a call</h4>

Given the following input:

```r
stats:::median(1:3)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: sigDbWithNames('stats', {median: true})}
```

We expect the linter to report the following:

* certain at 1.1-1.19: pkg = `'stats'`, name = `'median'`, kind = `'unnecessary-internal'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L49) for the test-case implementation.
		
<h4 id="Test_Case:__::__on_a_non-exported_name_in_a_call">Test Case: `::` on a non-exported name in a call</h4>

Given the following input:

```r
stats::C_cor(1:3)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: sigDbWithNames('stats', {C_cor: false})}
```

We expect the linter to report the following:

* certain at 1.1-1.17: pkg = `'stats'`, name = `'C_cor'`, kind = `'not-exported'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_Case:__::__on_an_exported_name_is_fine">Test Case: `::` on an exported name is fine</h4>

Given the following input:

```r
stats::median
```

And using the following [configuration](#configuration): 
```ts
{sigDb: sigDbWithNames('stats', {median: true})}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_Case:__:::__on_a_genuinely_internal_name_is_fine">Test Case: `:::` on a genuinely internal name is fine</h4>

Given the following input:

```r
stats:::C_cor
```

And using the following [configuration](#configuration): 
```ts
{sigDb: sigDbWithNames('stats', {C_cor: false})}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_package_is_not_flagged">Test Case: unknown package is not flagged</h4>

Given the following input:

```r
notAPackage:::secret
```

And using the following [configuration](#configuration): 
```ts
{sigDb: sigDbWithNames('stats', {median: true})}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L67) for the test-case implementation.
		
<h4 id="Test_Case:_name_absent_from_the_database_is_not_flagged">Test Case: name absent from the database is not flagged</h4>

Given the following input:

```r
stats:::undocumentedInternal
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('stats', ['median'])}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L70) for the test-case implementation.
		
<h4 id="Test_Case:__::__on_a_name_absent_from_the_database_is_not_flagged_either">Test Case: `::` on a name absent from the database is not flagged either</h4>

Given the following input:

```r
stats::undocumentedInternal
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('stats', ['median'])}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_Case:_no_signature_database_mounted">Test Case: no signature database mounted</h4>

Given the following input:

```r
stats:::median
```

And using the following [configuration](#configuration): 
```ts
{noSigDb: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-namespace-access.test.ts#L76) for the test-case implementation.