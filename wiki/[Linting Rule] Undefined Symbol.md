_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-13, 23:21:10 UTC (v2.15.10), do not edit directly._
<h2 id="undefined-symbol">Undefined Symbol&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This marks rules which are currently considered experimental, _not_ that they detect experimental code."><a href='#experimental'>![experimental](https://img.shields.io/badge/experimental-teal) </a></span>

This rule is a `over-approximative` rule.
 
Flags functions and variables that are neither defined locally, a base R builtin, nor exported by a loaded package.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/undefined-symbol.ts#L96">src/linter/rules/undefined-symbol.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `undefined-symbol` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/undefined-symbol.ts#L34"><code><span title="flag names used in a function-call position that cannot be resolved (default true)">checkFunctions</span></code></a>\
flag names used in a function-call position that cannot be resolved (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/undefined-symbol.ts#L45"><code><span title="flag unresolved symbols used as [/[[ subscripts (default false). Off by default to mute data.table's DT[i, j, by] column masking, which flowR cannot distinguish from ordinary indexing.">checkSubscripts</span></code></a>\
flag unresolved symbols used as `[`/`[[` subscripts (default `false`). Off by default to mute
`data.table`'s `DT[i, j, by]` column masking, which flowR cannot distinguish from ordinary indexing.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/undefined-symbol.ts#L40"><code><span title="flag names used as a variable read that cannot be resolved (default true). Formulas and data-masking (dplyr/tidyr/ggplot, subset/with) are recognised via flowR's dataflow, so this is precise; residual false positives are possible in dynamic eval/attach.">checkVariables</span></code></a>\
flag names used as a variable read that cannot be resolved (default `true`). Formulas and data-masking
(dplyr/tidyr/ggplot, `subset`/`with`) are recognised via flowR's dataflow, so this is precise; residual
false positives are possible in dynamic `eval`/`attach`.

### Examples

```r
undefined_helper(42)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "undefined-symbol",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Undefined Symbol** (undefined-symbol):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Undefined function `undefined_helper` at 1.1-20\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "undefined-symbol": {
        "results": [{"certainty":"uncertain","name":"undefined_helper","kind":"function","involvedId":3,"loc":[1,1,1,20]}],
        ".meta": {
          "totalFunctionCalls": 1,
          "totalVariableUses": 0,
          "suppressed": {"installed":0,"loadedPackage":0,"enclosingScope":0,"nonStandardEval":0,"subscript":0,"unresolvedLibrary":0}
        }
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-undefined-symbol.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts)

<h4 id="Test_32_Case:_32_undefined_32_function_32_is_32_flagged">Test Case: undefined function is flagged</h4>

Given the following input:

```r
foo()
```

We expect the linter to report the following:

* uncertain at 1.1-1.5: name = `'foo'`, kind = `'function'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_locally_32_defined_32_function_32_is_32_not_32_flagged">Test Case: locally defined function is not flagged</h4>

Given the following input:

```r
foo <- function() 1
foo()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_builtin_32_is_32_not_32_flagged">Test Case: builtin is not flagged</h4>

Given the following input:

```r
print("hi")
c(1, 2)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_only_32_the_32_undefined_32_call_32_is_32_flagged">Test Case: only the undefined call is flagged</h4>

Given the following input:

```r
g <- function() 1
g()
h()
```

We expect the linter to report the following:

* uncertain at 3.1-3.3: name = `'h'`, kind = `'function'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_not_32_flagged_32_when_32_an_32_unknown_32_library_32_is_32_loaded">Test Case: not flagged when an unknown library is loaded</h4>

> // an unresolved library could export any bare name, so nothing is guessed

Given the following input:

```r
library(somePkg)
foo()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L33) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_data_32_set_32_of_32_datasets_32_is_32_defined">Test Case: a data set of datasets is defined</h4>

Given the following input:

```r
summary(iris)
head(mtcars)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_namespaced_32_name_32_is_32_still_32_checked">Test Case: a namespaced name is still checked</h4>

Given the following input:

```r
library(somePkg)
foo()
base::fooo()
```

We expect the linter to report the following:

* uncertain at 3.1-3.12: name = `'fooo'`, kind = `'function'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_default-attached_32_base_32_functions_32_are_32_not_32_flagged">Test Case: default-attached base functions are not flagged</h4>

Given the following input:

```r
sd(x)
format(y)
match.arg(z)
colnames(m)
deparse(q)
person("a")
bibentry()
NCOL(d)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: baseSigDb, checkVariables: false}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_namespace-qualified_32_base_32_function_32_is_32_not_32_flagged">Test Case: namespace-qualified base function is not flagged</h4>

Given the following input:

```r
stats::sd(x)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: baseSigDb, checkVariables: false}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L43) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_namespace-qualified_32_base_32_function_32_is_32_not_32_flagged">Test Case: namespace-qualified base function is not flagged</h4>

Given the following input:

```r
stats::sd
```

And using the following [configuration](#configuration): 
```ts
{sigDb: baseSigDb, checkVariables: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_base_32_primitives_32_and_32_constants_32_are_32_not_32_flagged">Test Case: base primitives and constants are not flagged</h4>

> // primitives/internals (`is.na`) and base data constants (`.Machine`) are absent from the sigdb
> // export list but must still be recognised as defined base-R names (both calls and variable reads)

Given the following input:

```r
x <- 1
is.na(x)
is.finite(x)
tcrossprod(x)
unclass(x)
range(x)
cumsum(x)
y <- .Machine$double.eps
```

And using the following [configuration](#configuration): 
```ts
{sigDb: baseSigDb}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_non-attached_32_base_32_package_32_function_32_is_32_flagged_32_with_32_a_32_hint">Test Case: non-attached base package function is flagged with a hint</h4>

> // parallel is base-priority but not attached by default -> flagged, with a hint from the database

Given the following input:

```r
mclapply(x, f)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('parallel', ['mclapply']), checkVariables: false}
```

We expect the linter to report the following:

* uncertain at 1.1-1.14: name = `'mclapply'`, kind = `'function'`, availableInPackages = `['parallel']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L56) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_an_32_export_32_named_32_like_32_a_32_primitive_32_keeps_32_its_32_semantics">Test Case: an export named like a primitive keeps its semantics</h4>

Given the following input:

```r
library(lubridate)
d <- data.frame(a = 1)
print(d$a)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb({lubridate: ['$', 'ymd']})}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_namespaced_32_read_32_may_32_be_32_lazy_32_data_32_the_32_database_32_does_32_not_32_record">Test Case: a namespaced read may be lazy data the database does not record</h4>

Given the following input:

```r
x <- MASS::birthwt
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb({MASS: ['lda']})}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L64) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_name_32_the_32_package_32_may_32_re-export_32_from_32_its_32_imports">Test Case: a name the package may re-export from its imports</h4>

Given the following input:

```r
library(dplyr)
as_tibble(data.frame(a = 1))
```

And using the following [configuration](#configuration): 
```ts
{sigDb: {...controlledSigDb({dplyr: ['mutate'], tibble: ['as_tibble']}), dependencies: (pkg: string) => pkg === 'dplyr' ? [{name: 'tibble', type: DepType.Imports}] : undefined}}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L66) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_name_32_neither_32_the_32_package_32_nor_32_its_32_imports_32_export_32_is_32_flagged">Test Case: a name neither the package nor its imports export is flagged</h4>

Given the following input:

```r
library(dplyr)
not_in_dplyr(data.frame(a = 1))
```

And using the following [configuration](#configuration): 
```ts
{sigDb: {...controlledSigDb({dplyr: ['mutate'], tibble: ['as_tibble']}), dependencies: (pkg: string) => pkg === 'dplyr' ? [{name: 'tibble', type: DepType.Imports}] : undefined}}
```

We expect the linter to report the following:

* uncertain at 2.1-2.31: name = `'not_in_dplyr'`, kind = `'function'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_suggests_32_loading_32_a_32_package_32_that_32_exports_32_the_32_symbol">Test Case: suggests loading a package that exports the symbol</h4>

Given the following input:

```r
ggahh()
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('ggPkg', ['ggahh'])}
```

We expect the linter to report the following:

* uncertain at 1.1-1.7: name = `'ggahh'`, kind = `'function'`, availableInPackages = `['ggPkg']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_resolves_32_a_32_loaded_32_dotted_32_export_32_yet_32_still_32_flags_32_a_32_typo">Test Case: resolves a loaded dotted export yet still flags a typo</h4>

> // a loaded package's (dotted) export resolves, but a typo is still flagged

Given the following input:

```r
library(quadprog)
solve.QP(a, b)
sol.QP(a, b)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('quadprog', ['solve.QP']), checkVariables: false}
```

We expect the linter to report the following:

* uncertain at 3.1-3.12: name = `'sol.QP'`, kind = `'function'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L78) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_testthat_32_export_32_is_32_not_32_flagged_32_inside_32_a_32_test_32_file">Test Case: a testthat export is not flagged inside a test file</h4>

> // a test file runs under its framework's attached namespace, so its exports need no explicit library() there

Given the following input:

```r
expect_equal(1, 1)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('testthat', ['expect_equal']), checkVariables: false, useAsFilePath: 'tests/testthat/test-x.R'}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L86) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_the_32_same_32_testthat_32_export_32_is_32_flagged_32_outside_32_a_32_test_32_file">Test Case: the same testthat export is flagged outside a test file</h4>

> // the same call outside a test file has no attached framework, so it is still flagged (with a hint)

Given the following input:

```r
expect_equal(1, 1)
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('testthat', ['expect_equal']), checkVariables: false}
```

We expect the linter to report the following:

* uncertain at 1.1-1.18: name = `'expect_equal'`, kind = `'function'`, availableInPackages = `['testthat']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L91) for the test-case implementation.
		
<h4 id="Test_32_Case:_32__96__36__123_load_125__32_defines_32_the_32_data_32_set_96_">Test Case: `${load} defines the data set`</h4>

Given the following input:

```r
`${load}
print(rat)`
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L98) for the test-case implementation.
		
<h4 id="Test_32_Case:_32__96__36__123_load_125__32_defines_32_no_32_other_32_data_32_set_96_">Test Case: `${load} defines no other data set`</h4>

Given the following input:

```r
`${load}
print(mouse)`
```

We expect the linter to report the following:

* uncertain at 2.7-2.11: name = `'mouse'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L99) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undefined_32_variable_32_read_32_is_32_flagged_32__40_checked_32_by_32_default_41_">Test Case: undefined variable read is flagged (checked by default)</h4>

Given the following input:

```r
f <- function() undefinedVar
```

We expect the linter to report the following:

* uncertain at 1.17-1.28: name = `'undefinedVar'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L101) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_read_32_before_32_the_32_write_32_in_32_the_32_same_32_frame_32_is_32_flagged">Test Case: a read before the write in the same frame is flagged</h4>

Given the following input:

```r
f <- function() { print(v); v <- 1 }
```

We expect the linter to report the following:

* uncertain at 1.25-1.25: name = `'v'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L103) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_variable_32_checking_32_can_32_be_32_disabled">Test Case: variable checking can be disabled</h4>

Given the following input:

```r
f <- function() undefinedVar
```

And using the following [configuration](#configuration): 
```ts
{checkVariables: false}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L106) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_parameters_32_and_32_locals_32_are_32_not_32_flagged">Test Case: parameters and locals are not flagged</h4>

Given the following input:

```r
f <- function(a, b) { c <- a + b
  c }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L109) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_builtin_32_constants_32_are_32_not_32_flagged">Test Case: builtin constants are not flagged</h4>

Given the following input:

```r
print(pi)
print(T)
print(LETTERS)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L112) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_quoted_32_symbols_32_are_32_not_32_flagged">Test Case: quoted symbols are not flagged</h4>

> // quoting (non-standard evaluation) is recognised via flowR's dataflow

Given the following input:

```r
quote(someSymbol)
substitute(other)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L116) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_braceless_32_for-loop_32_body_32_is_32_still_32_flagged">Test Case: a braceless for-loop body is still flagged</h4>

> // a loop marks its body as nse too, but the body is evaluated, so its symbols are ordinary reads

Given the following input:

```r
for(i in 1:2) undefinedVar
```

We expect the linter to report the following:

* uncertain at 1.15-1.26: name = `'undefinedVar'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L120) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_braceless_32_while-loop_32_body_32_is_32_still_32_flagged">Test Case: a braceless while-loop body is still flagged</h4>

Given the following input:

```r
while(TRUE) undefinedVar
```

We expect the linter to report the following:

* uncertain at 1.13-1.24: name = `'undefinedVar'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L123) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_braceless_32_repeat_32_body_32_is_32_still_32_flagged">Test Case: a braceless repeat body is still flagged</h4>

Given the following input:

```r
repeat undefinedVar
```

We expect the linter to report the following:

* uncertain at 1.8-1.19: name = `'undefinedVar'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L126) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_quotation_32_within_32_a_32_loop_32_body_32_is_32_still_32_not_32_flagged">Test Case: a quotation within a loop body is still not flagged</h4>

Given the following input:

```r
for(i in 1:2) quote(someSymbol)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L129) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_variable_32_defined_32_nowhere_32_is_32_still_32_flagged">Test Case: a variable defined nowhere is still flagged</h4>

> // recall: a variable defined nowhere is still flagged even next to a defined one

Given the following input:

```r
f <- function() {
  known <- 1
  known + reallyUndefined
}
```

We expect the linter to report the following:

* uncertain at 3.11-3.25: name = `'reallyUndefined'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L133) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_binding_32_from_32_a_32_sibling_32_scope_32_does_32_not_32_suppress_32_the_32_use">Test Case: a binding from a sibling scope does not suppress the use</h4>

> // the scope fallback is *scoped*: a binding in a sibling function does not resolve here

Given the following input:

```r
f <- function() { onlyInF <- 1 }
g <- function() onlyInF
```

We expect the linter to report the following:

* uncertain at 2.17-2.23: name = `'onlyInF'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L138) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_formula_32_operands">Test Case: formula operands</h4>

Given the following input:

```r
y ~ x + z
```

And using the following [configuration](#configuration): 
```ts
{checkVariables: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L148) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_subset_32_data-masked_32_columns">Test Case: subset data-masked columns</h4>

Given the following input:

```r
d <- data.frame()
subset(d, col > 1)
```

And using the following [configuration](#configuration): 
```ts
{checkVariables: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L151) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_with_32_data-masked_32_columns">Test Case: with data-masked columns</h4>

Given the following input:

```r
d <- data.frame()
with(d, aa + bb)
```

And using the following [configuration](#configuration): 
```ts
{checkVariables: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L154) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_quoted_32_symbols">Test Case: quoted symbols</h4>

Given the following input:

```r
quote(someSymbol)
substitute(other)
```

And using the following [configuration](#configuration): 
```ts
{checkVariables: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L157) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dplyr_32_/_32_tidyr_32_data-masked_32_columns">Test Case: dplyr / tidyr data-masked columns</h4>

Given the following input:

```r
d <- data.frame()
mutate(d, z = revenue * 2)
select(d, id, name)
```

And using the following [configuration](#configuration): 
```ts
{checkVariables: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L160) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_ggplot_32_aes_32_columns">Test Case: ggplot aes columns</h4>

Given the following input:

```r
d <- data.frame()
ggplot(d, aes(x = revenue, y = cost))
```

And using the following [configuration](#configuration): 
```ts
{checkVariables: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L163) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_piped_32_dplyr_32_columns">Test Case: piped dplyr columns</h4>

> // piped data-masking: the data is injected by `%>%`/`|>`, so all explicit args are columns

Given the following input:

```r
d <- data.frame()
d %>% filter(cost > 1) %>% mutate(z = revenue) %>% select(id)
```

And using the following [configuration](#configuration): 
```ts
{checkVariables: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L167) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_data.table_32_subscript_32_columns_32_are_32_muted">Test Case: data.table subscript columns are muted</h4>

> // `data.table`'s `DT[i, j, by]` masks subscript symbols; muted by default (indistinguishable from indexing)

Given the following input:

```r
dt <- data.frame()
dt[revenue > 1, sum(sales), by = grp]
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L171) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_the_32_accessed_32_object_32_is_32_still_32_flagged">Test Case: the accessed object is still flagged</h4>

> // ... but the accessed object itself is still checked, and `checkSubscripts` re-enables subscripts

Given the following input:

```r
undefinedDT[, 1]
```

We expect the linter to report the following:

* uncertain at 1.1-1.11: name = `'undefinedDT'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L175) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_subscript_32_checking_32_can_32_be_32_enabled">Test Case: subscript checking can be enabled</h4>

Given the following input:

```r
dt <- data.frame()
dt[, sales]
```

And using the following [configuration](#configuration): 
```ts
{checkSubscripts: true}
```

We expect the linter to report the following:

* uncertain at 2.6-2.10: name = `'sales'`, kind = `'variable'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L178) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undefined_32_call_32_in_32_an_32_inst/_32_file_32_is_32_not_32_flagged">Test Case: undefined call in an inst/ file is not flagged</h4>

Given the following input:

```r
notARealFunction()
```

And using the following [configuration](#configuration): 
```ts
{useAsFilePath: 'inst/REFERENCES.R'}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L184) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_the_32_same_32_call_32_in_32_an_32_R/_32_file_32_is_32_flagged">Test Case: the same call in an R/ file is flagged</h4>

Given the following input:

```r
notARealFunction()
```

And using the following [configuration](#configuration): 
```ts
{useAsFilePath: 'R/foo.R'}
```

We expect the linter to report the following:

* uncertain: name = `'notARealFunction'`, kind = `'function'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L187) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_parser">Test Case: parser</h4>

> R: data("rat") and data(list = "rat") define rat just like data(rat)

Given the following input:

```r
undefined-symbol
```

We expect the linter to report the following:

```ts
['data/rat.R']
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L194) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_parser">Test Case: parser</h4>

Given the following input:

```r
undefined-symbol
```

We expect the linter to report the following:

```ts
['data/rat.R']
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-undefined-symbol.test.ts#L195) for the test-case implementation.