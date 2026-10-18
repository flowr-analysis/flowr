_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 21:25:13 UTC (v2.16.2), do not edit directly._
<h2 id="dependency-declaration">Dependency Declaration&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span>

R CMD check: [#27](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-27) 🔷, [#28](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-28) 🟩, [#29](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-29) 🟩, [#30](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-30) 🟩, [#31](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-31) 🟩, [#32](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-32) 🔷, [#33](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-33) 🔷, [#53](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-53) 🔷, [#77](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-77) 🔷, [#83](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-83) 🔷, [#85](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-85) 🔷, [#88](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-88) 🔷

This rule is a `best-effort` rule.
 
Finds packages the code, tests, examples, or vignettes use without the DESCRIPTION declaring them, Imports nothing imports from, `library()` calls in package code, own `:::` calls, and undeclared VignetteBuilder or RdMacros packages. Package names are resolved through variables.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L178">src/linter/rules/cmd-check/dependency-declaration.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `dependency-declaration` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L80"><code><span title="report declared packages the signature database does not know or cannot satisfy, which R CMD check asks the repositories about (default true)">checkAvailability</span></code></a>\
report declared packages the signature database does not know or cannot satisfy, which `R CMD check` asks the repositories about (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L78"><code><span title="check the packages the tests, vignettes, and examples use (default true)">checkOtherCode</span></code></a>\
check the packages the tests, vignettes, and examples use (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L82"><code><span title="packages that only provide C/C++ headers and hence belong into LinkingTo, a note R CMD check gives for CRAN submissions (default BH, RcppArmadillo, RcppEigen)">headerOnlyPackages</span></code></a>\
packages that only provide C/C++ headers and hence belong into LinkingTo, a note `R CMD check` gives for CRAN submissions (default `BH`, `RcppArmadillo`, `RcppEigen`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L76"><code><span title="functions whose arguments run elsewhere, so the packages loaded there are no dependency of the package (default clusterEvalQ)">ignoreWithin</span></code></a>\
functions whose arguments run elsewhere, so the packages loaded there are no dependency of the package (default `clusterEvalQ`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L74"><code><span title="report packages in Depends the NAMESPACE imports nothing from, a note R CMD check only gives for CRAN submissions (default false)">reportDependsNotImported</span></code></a>\
report packages in Depends the NAMESPACE imports nothing from, a note `R CMD check` only gives for CRAN submissions (default `false`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/dependency-declaration.ts#L72"><code><span title="report every library/require call in package code, even for declared packages (default true, as R CMD check)">reportLibraryCalls</span></code></a>\
report every `library`/`require` call in package code, even for declared packages (default `true`, as `R CMD check`)

### Examples

```r
f <- function(df) {
	library(dplyr)
	tidyr::drop_na(df)
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "dependency-declaration",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (101 ms)\
&nbsp;&nbsp;&nbsp;╰ **Dependency Declaration** (dependency-declaration): _no findings_\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{"linter":{"results":{"dependency-declaration":{"results":[],".meta":{"unresolvedLoads":0}}},".meta":{}},".meta":{}}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts)

<h4 id="Test_32_Case:_32_undeclared_32_library">Test Case: undeclared library</h4>

Given the following input:

```r
f <- function() library(dplyr)
```

We expect the linter to report the following:

* certain: kind = `'undeclared-attach'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L12) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_an_32_undeclared_32_library_32_is_32_also_32_one_32_in_32_package_32_code_44__32_as_32_R_32_reports_32_both">Test Case: an undeclared library is also one in package code, as R reports both</h4>

Given the following input:

```r
f <- function() library(dplyr)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-attach'`, package = `'dplyr'`
* reported: kind = `'library-in-package'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L15) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_require_32_with_32_a_32_string">Test Case: undeclared require with a string</h4>

Given the following input:

```r
f <- function() require("dplyr")
```

We expect the linter to report the following:

* reported: kind = `'undeclared-attach'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_imports_32_do_32_not_32_attach">Test Case: imports do not attach</h4>

Given the following input:

```r
f <- function() library(dplyr)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-attach'`, package = `'dplyr'`, message = `'\'library\' call not declared from: \'dplyr\' (Imports do not attach a package, use :: instead)'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_suggested_32_package_32_in_32_package_32_code">Test Case: suggested package in package code</h4>

Given the following input:

```r
f <- function() if(require(dplyr)) 1
```

We expect the linter to report the following:

* reported: kind = `'library-in-package'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_library_32_calls_32_can_32_be_32_accepted">Test Case: library calls can be accepted</h4>

Given the following input:

```r
f <- function() if(require(dplyr)) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_enhanced_32_package">Test Case: enhanced package</h4>

Given the following input:

```r
f <- function() library(dplyr)
```

We expect the linter to report the following:

* reported: kind = `'library-in-package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L24) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_already_32_attached_32_by_32_depends">Test Case: already attached by depends</h4>

Given the following input:

```r
f <- function() library(dplyr)
```

We expect the linter to report the following:

* reported: kind = `'attached-by-depends'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_default_32_package_32_needs_32_no_32_declaration">Test Case: default package needs no declaration</h4>

Given the following input:

```r
f <- function() library(stats)
```

We expect the linter to report the following:

* reported: kind = `'library-in-package'`, package = `'stats'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_non-default_32_base_32_package_32_must_32_be_32_declared_32_for_32_library">Test Case: non-default base package must be declared for library</h4>

Given the following input:

```r
f <- function() library(tools)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-attach'`, package = `'tools'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_own_32_package">Test Case: own package</h4>

Given the following input:

```r
f <- function() library(pkg)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_package_32_name_32_through_32_a_32_variable_32__40_flowR_32_extension_41_">Test Case: package name through a variable (flowR extension)</h4>

Given the following input:

```r
p <- "dplyr"
f <- function() library(p, character.only = TRUE)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-attach'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_one_32_of_32_several_32_packages_32_is_32_uncertain">Test Case: one of several packages is uncertain</h4>

Given the following input:

```r
f <- function(a) { p <- if(a) "dplyr" else "tidyr"; library(p, character.only = TRUE) }
```

We expect the linter to report the following:

* uncertain: kind = `'undeclared-attach'`, package = `'tidyr'`
* uncertain: kind = `'undeclared-attach'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L30) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_pacman_32_loads_32__40_flowR_32_extension_41_">Test Case: pacman loads (flowR extension)</h4>

Given the following input:

```r
f <- function() pacman::p_load(dplyr)
```

We expect the linter to report the following:

```ts
[{kind: 'undeclared-namespace', package: 'pacman'}, {kind: 'undeclared-attach', package: 'dplyr'}].reverse()
```

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_within_32_clusterEvalQ">Test Case: within clusterEvalQ</h4>

Given the following input:

```r
f <- function(cl) parallel::clusterEvalQ(cl, library(dplyr))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L37) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefined_32_library">Test Case: redefined library</h4>

Given the following input:

```r
library <- function(...) NULL
f <- function() library(dplyr)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_requireNamespace">Test Case: undeclared requireNamespace</h4>

Given the following input:

```r
f <- function() requireNamespace("dplyr", quietly = TRUE)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-load'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L42) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_loadNamespace">Test Case: undeclared loadNamespace</h4>

Given the following input:

```r
f <- function() loadNamespace("dplyr")
```

We expect the linter to report the following:

* reported: kind = `'undeclared-load'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L43) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_suggested_32_requireNamespace_32_is_32_the_32_recommended_32_way">Test Case: suggested requireNamespace is the recommended way</h4>

Given the following input:

```r
f <- function() if(requireNamespace("dplyr", quietly = TRUE)) dplyr::n()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_imported_32_loadNamespace">Test Case: imported loadNamespace</h4>

Given the following input:

```r
f <- function() loadNamespace("dplyr")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L45) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_base_32_package_32_needs_32_no_32_declaration">Test Case: base package needs no declaration</h4>

Given the following input:

```r
f <- function() requireNamespace("tools")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_methods_32_needs_32_a_32_declaration">Test Case: methods needs a declaration</h4>

Given the following input:

```r
f <- function() requireNamespace("methods")
```

We expect the linter to report the following:

* reported: kind = `'undeclared-load'`, package = `'methods'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_::">Test Case: undeclared ::</h4>

Given the following input:

```r
f <- function(x) dplyr::filter(x)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-namespace'`, package = `'dplyr'`, message = `'\'::\' import not declared from: \'dplyr\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_:::">Test Case: undeclared :::</h4>

Given the following input:

```r
f <- function(x) dplyr:::filter_impl(x)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-namespace'`, message = `'\':::\' import not declared from: \'dplyr\''`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L52) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_::_32_of_32_a_32_variable">Test Case: undeclared :: of a variable</h4>

Given the following input:

```r
f <- function() ggplot2::mpg
```

We expect the linter to report the following:

* reported: kind = `'undeclared-namespace'`, package = `'ggplot2'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_imported_32_::">Test Case: imported ::</h4>

Given the following input:

```r
f <- function(x) dplyr::filter(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L54) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_suggested_32_::">Test Case: suggested ::</h4>

Given the following input:

```r
f <- function(x) dplyr::filter(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L55) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_base_32_packages_32_need_32_no_32_declaration">Test Case: base packages need no declaration</h4>

Given the following input:

```r
f <- function(x) c(stats::median(x), tools::file_ext(x), utils::head(x))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L56) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_stats4_32_needs_32_a_32_declaration">Test Case: stats4 needs a declaration</h4>

Given the following input:

```r
f <- function(x) stats4::mle(x)
```

We expect the linter to report the following:

* reported: kind = `'undeclared-namespace'`, package = `'stats4'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L57) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_own_32_:::_32_is_32_discouraged">Test Case: own ::: is discouraged</h4>

Given the following input:

```r
f <- function(x) pkg:::helper(x)
```

We expect the linter to report the following:

* reported: kind = `'own-triple-colon'`, package = `'pkg'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L58) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_own_32_::_32_is_32_fine">Test Case: own :: is fine</h4>

Given the following input:

```r
f <- function(x) pkg::helper(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_replacement_32_through_32_::">Test Case: replacement through ::</h4>

Given the following input:

```r
f <- function(x) { dplyr::groups(x) <- 1; x }
```

We expect the linter to report the following:

* reported: kind = `'undeclared-namespace'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L60) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_import_32_never_32_used">Test Case: import never used</h4>

Given the following input:

```r
f <- function(x) x
```

We expect the linter to report the following:

* reported: kind = `'unused-import'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L64) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_import_32_used_32_by_32_::">Test Case: import used by ::</h4>

Given the following input:

```r
f <- function(x) dplyr::filter(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L67) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_import_32_used_32_by_32_the_32_NAMESPACE">Test Case: import used by the NAMESPACE</h4>

Given the following input:

```r
f <- function(x) filter(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_import_32_used_32_by_32_a_32_whole-package_32_import">Test Case: import used by a whole-package import</h4>

Given the following input:

```r
f <- function(x) x
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L69) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_only_32_the_32_unused_32_of_32_several_32_imports">Test Case: only the unused of several imports</h4>

Given the following input:

```r
f <- function(x) dplyr::filter(x)
```

We expect the linter to report the following:

* reported: kind = `'unused-import'`, package = `'tidyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L70) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_an_32_unresolved_32_load_32_may_32_use_32_any_32_import">Test Case: an unresolved load may use any import</h4>

Given the following input:

```r
f <- function(p) requireNamespace(p)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L71) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_use_32_in_32_test_32_code_32_does_32_not_32_count">Test Case: use in test code does not count</h4>

Given the following input:

```r
f <- function(x) x
```

We expect the linter to report the following:

* reported: kind = `'unused-import'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L72) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_depends_32_not_32_imported_44__32_on_32_request">Test Case: depends not imported, on request</h4>

Given the following input:

```r
f <- function(x) x
```

We expect the linter to report the following:

* reported: kind = `'depends-not-imported'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L76) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_depends_32_not_32_imported_44__32_off_32_by_32_default">Test Case: depends not imported, off by default</h4>

Given the following input:

```r
f <- function(x) x
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L79) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_depends_32_imported">Test Case: depends imported</h4>

Given the following input:

```r
f <- function(x) x
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L80) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_S4_32_without_32_methods">Test Case: S4 without methods</h4>

Given the following input:

```r
setClass("A", representation(x = "numeric"))
```

We expect the linter to report the following:

* reported: kind = `'undeclared-methods'`, package = `'methods'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L83) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_S4_32_with_32_methods_32_imported">Test Case: S4 with methods imported</h4>

Given the following input:

```r
setClass("A", representation(x = "numeric"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L84) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_DESCRIPTION_44__32_no_32_findings">Test Case: no DESCRIPTION, no findings</h4>

Given the following input:

```r
f <- function() library(dplyr)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L88) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_code_32_may_32_attach_32_suggested_32_packages">Test Case: test code may attach suggested packages</h4>

Given the following input:

```r
library(dplyr)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L89) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_library_32_in_32_a_32_test">Test Case: undeclared library in a test</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-in-tests'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L94) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_the_32_test_32_framework_32_itself_32_must_32_be_32_declared">Test Case: the test framework itself must be declared</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-in-tests'`, package = `'testthat'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L97) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_suggested_32_test_32_framework">Test Case: suggested test framework</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L100) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_::_32_in_32_a_32_test">Test Case: :: in a test</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-in-tests'`, package = `'withr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L101) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_imports_32_count_32_for_32_tests_44__32_but_32_tests_32_do_32_not_32_use_32_them_32_for_32_the_32_package">Test Case: imports count for tests, but tests do not use them for the package</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'unused-import'`, package = `'withr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L102) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_base_32_packages_32_need_32_no_32_declaration_32_in_32_tests">Test Case: base packages need no declaration in tests</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L103) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_each_32_package_32_once_32_per_32_file">Test Case: each package once per file</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-in-tests'`, package = `'dplyr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L104) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_nested_32_test_32_folders_32_are_32_not_32_run">Test Case: nested test folders are not run</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L105) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_character.only_32_with_32_a_32_variable_32_is_32_unknown">Test Case: character.only with a variable is unknown</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L106) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_requireNamespace_32_in_32_a_32_vignette_32_chunk">Test Case: requireNamespace in a vignette chunk</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-in-vignettes'`, package = `'ggplot2'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L107) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_chunks_32_that_32_are_32_not_32_evaluated">Test Case: chunks that are not evaluated</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L110) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Sweave_32_vignette">Test Case: Sweave vignette</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-in-vignettes'`, package = `'lattice'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L111) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vignette_32_engine_32_and_32_depends">Test Case: vignette engine and depends</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-vignette-depends'`, package = `'dplyr'`
* reported: kind = `'undeclared-vignette-depends'`, package = `'knitr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L112) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_declared_32_vignette_32_engine">Test Case: declared vignette engine</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L115) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_package_32_in_32_examples">Test Case: undeclared package in examples</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-in-examples'`, package = `'MASS'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L116) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dontrun_32_examples_32_are_32_not_32_run">Test Case: dontrun examples are not run</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L119) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_donttest_32_examples_32_are_32_run">Test Case: donttest examples are run</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-in-examples'`, package = `'MASS'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L120) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_data_40_package_61__41__32_in_32_examples">Test Case: data(package=) in examples</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-in-examples'`, package = `'nycflights13'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L121) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_other_32_code_32_checks_32_can_32_be_32_disabled">Test Case: other code checks can be disabled</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L122) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_undeclared_32_vignette_32_builder">Test Case: undeclared vignette builder</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-vignette-builder'`, package = `'knitr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L126) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_rd_32_macros_32_must_32_be_32_imported">Test Case: rd macros must be imported</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'undeclared-rd-macros'`, package = `'mathjaxr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L127) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_imported_32_rd_32_macros_32__40_still_32_an_32_unused_32_import_44__32_as_32_for_32_R_41_">Test Case: imported rd macros (still an unused import, as for R)</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'unused-import'`, package = `'mathjaxr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L128) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_header-only_32_package_32_in_32_imports">Test Case: header-only package in imports</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* reported: kind = `'unused-import'`, package = `'BH'`
* reported: kind = `'header-only-import'`, package = `'BH'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L129) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_header-only_32_package_32_in_32_LinkingTo">Test Case: header-only package in LinkingTo</h4>

Given the following input:

```r
f <- function() 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-dependency-declaration.test.ts#L130) for the test-case implementation.