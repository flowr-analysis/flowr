_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="global-environment-modification">Global Environment Modification&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a `best-effort` rule.
 
Port of the `R CMD check` notes *"Found the following assignments to the global environment"*, *"Found the following calls to data() loading into the global environment"*, *"Found the following calls to attach()"*, and the `codetools` note *"no visible binding for '<<-' assignment"* (all `checking R code for possible problems`). Beyond `R CMD check`, flowR follows variables bound to the global environment, ignores redefined functions, and reports `<<-` assignments to variables of the package namespace, whose bindings are locked at run time.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/global-environment-modification.ts#L203">src/linter/rules/cmd-check/global-environment-modification.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `global-environment-modification` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/global-environment-modification.ts#L53"><code><span title="variables that may be assigned in the global environment (default .Random.seed, as R CMD check allows)">allowedGlobals</span></code></a>\
variables that may be assigned in the global environment (default `.Random.seed`, as `R CMD check` allows)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/global-environment-modification.ts#L51"><code><span title="report <<- assignments that reach the global environment or a locked namespace binding (default true)">checkSuperAssignments</span></code></a>\
report `<<-` assignments that reach the global environment or a locked namespace binding (default `true`)

### Examples

```r
cache <- function(v) assign("cached", v, envir = globalenv())
count <- function() counter <<- counter + 1
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "global-environment-modification",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Global Environment Modification** (global-environment-modification):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ assign of cached at 1.22-61\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ global-superassignment of counter at 2.21-43\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "global-environment-modification": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 12,
            "loc": [1,22,1,61],
            "kind": "assign",
            "variable": "cached",
            "message": "assign() writes 'cached' into the global environment, which belongs to the user"
          },
          {
            "certainty": "certain",
            "involvedId": 21,
            "loc": [2,21,2,43],
            "kind": "global-superassignment",
            "variable": "counter",
            "message": "no visible binding for '<<-' assignment to 'counter', which hence creates a variable in the global environment"
          }
        ],
        ".meta": {"consideredCalls":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts)

<h4 id="Test_32_Case:_32_assign_32_into_32_globalenv_40__41_">Test Case: assign into globalenv()</h4>

Given the following input:

```r
f <- function() assign("x", 1, envir = globalenv())
```

We expect the linter to report the following:

* certain: kind = `'assign'`, variable = `'x'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L10) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assign_32_into_32_.GlobalEnv">Test Case: assign into .GlobalEnv</h4>

Given the following input:

```r
f <- function(v) assign("cache", v, envir = .GlobalEnv)
```

We expect the linter to report the following:

* reported: kind = `'assign'`, variable = `'cache'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L13) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assign_32_by_32_position_32_1">Test Case: assign by position 1</h4>

Given the following input:

```r
f <- function() assign("x", 1, pos = 1)
```

We expect the linter to report the following:

* reported: kind = `'assign'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L14) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assign_32_by_32_as.environment_40_1_41_">Test Case: assign by as.environment(1)</h4>

Given the following input:

```r
f <- function() assign("x", 1, envir = as.environment(1))
```

We expect the linter to report the following:

* reported: kind = `'assign'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L15) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assign_32_by_32_as.environment_40__34_.GlobalEnv_34__41_">Test Case: assign by as.environment(".GlobalEnv")</h4>

Given the following input:

```r
f <- function() assign("x", 1, envir = as.environment(".GlobalEnv"))
```

We expect the linter to report the following:

* reported: kind = `'assign'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L16) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_positional_32_envir">Test Case: positional envir</h4>

Given the following input:

```r
f <- function() assign("x", 1, globalenv())
```

We expect the linter to report the following:

* reported: kind = `'assign'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_computed_32_variable_32_name">Test Case: computed variable name</h4>

Given the following input:

```r
f <- function(n) assign(n, 1, envir = globalenv())
```

We expect the linter to report the following:

* reported: kind = `'assign'`, message = `'assign() writes a variable into the global environment, which belongs to the user'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_through_32_a_32_variable_32_bound_32_to_32_the_32_global_32_environment_32__40_flowR_32_extension_41_">Test Case: through a variable bound to the global environment (flowR extension)</h4>

Given the following input:

```r
f <- function() {
  e <- globalenv()
  assign("x", 1, envir = e)
}
```

We expect the linter to report the following:

* reported: kind = `'assign'`, variable = `'x'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_through_32_two_32_variables">Test Case: through two variables</h4>

Given the following input:

```r
f <- function() { e <- .GlobalEnv; g <- e; assign("x", 1, envir = g) }
```

We expect the linter to report the following:

* reported: kind = `'assign'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_.Random.seed_32_is_32_allowed">Test Case: .Random.seed is allowed</h4>

Given the following input:

```r
f <- function(s) assign(".Random.seed", s, envir = globalenv())
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L21) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_allowed_32_globals_32_are_32_configurable">Test Case: allowed globals are configurable</h4>

Given the following input:

```r
f <- function() assign("x", 1, envir = globalenv())
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assign_32_into_32_a_32_local_32_environment">Test Case: assign into a local environment</h4>

Given the following input:

```r
f <- function() { e <- new.env(); assign("x", 1, envir = e) }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assign_32_into_32_the_32_current_32_frame">Test Case: assign into the current frame</h4>

Given the following input:

```r
f <- function() assign("x", 1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L24) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assign_32_into_32_environment_40__41_">Test Case: assign into environment()</h4>

Given the following input:

```r
f <- function() assign("x", 1, envir = environment())
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_variable_32_sometimes_32_bound_32_to_32_another_32_environment">Test Case: variable sometimes bound to another environment</h4>

Given the following input:

```r
f <- function(a) { e <- new.env(); if(a) e <- globalenv(); assign("x", 1, envir = e) }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefined_32_assign">Test Case: redefined assign</h4>

Given the following input:

```r
assign <- function(...) NULL
f <- function() assign("x", 1, envir = globalenv())
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefined_32_globalenv">Test Case: redefined globalenv</h4>

Given the following input:

```r
globalenv <- function() new.env()
f <- function() assign("x", 1, envir = globalenv())
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_data_32_without_32_envir">Test Case: data without envir</h4>

Given the following input:

```r
f <- function() data("iris")
```

We expect the linter to report the following:

* reported: kind = `'data'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_data_32_with_32_list">Test Case: data with list</h4>

Given the following input:

```r
f <- function() data(list = "iris", package = "datasets")
```

We expect the linter to report the following:

* reported: kind = `'data'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L33) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_data_32_into_32_the_32_global_32_environment">Test Case: data into the global environment</h4>

Given the following input:

```r
f <- function() data(iris, envir = .GlobalEnv)
```

We expect the linter to report the following:

* reported: kind = `'data'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_data_32_into_32_the_32_current_32_environment">Test Case: data into the current environment</h4>

Given the following input:

```r
f <- function() { data(iris, envir = environment()); iris }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_data_32_into_32_a_32_new_32_environment">Test Case: data into a new environment</h4>

Given the following input:

```r
f <- function() { e <- new.env(); data(iris, envir = e) }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L36) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_data_32_listing_32_the_32_data_32_sets_32_loads_32_nothing">Test Case: data listing the data sets loads nothing</h4>

Given the following input:

```r
f <- function() data(package = "datasets")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L37) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_attach_32_a_32_data_32_frame">Test Case: attach a data frame</h4>

Given the following input:

```r
f <- function(d) { attach(d); mean(x) }
```

We expect the linter to report the following:

* reported: kind = `'attach'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefined_32_attach">Test Case: redefined attach</h4>

Given the following input:

```r
attach <- function(x) x
f <- function(d) attach(d)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L42) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_visible_32_binding">Test Case: no visible binding</h4>

Given the following input:

```r
f <- function() counter <<- 1
```

We expect the linter to report the following:

* reported: kind = `'global-superassignment'`, variable = `'counter'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_right_32_super-assignment">Test Case: right super-assignment</h4>

Given the following input:

```r
f <- function() 1 ->> counter
```

We expect the linter to report the following:

* reported: kind = `'global-superassignment'`, variable = `'counter'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L49) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_binding_32_in_32_the_32_enclosing_32_function">Test Case: binding in the enclosing function</h4>

Given the following input:

```r
make <- function() { n <- 0; function() n <<- n + 1 }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_parameter_32_of_32_the_32_enclosing_32_function">Test Case: parameter of the enclosing function</h4>

Given the following input:

```r
make <- function(n) function() n <<- n + 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_binding_32_two_32_functions_32_up">Test Case: binding two functions up</h4>

Given the following input:

```r
make <- function() { n <- 0; function() function() n <<- 1 }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L52) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_binding_32_inside_32_local">Test Case: binding inside local</h4>

Given the following input:

```r
inc <- local({ n <- 0; function() n <<- n + 1 })
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_local_32_binding_32_of_32_the_32_same_32_function_32_does_32_not_32_count">Test Case: a local binding of the same function does not count</h4>

Given the following input:

```r
f <- function() { x <- 1; x <<- 2 }
```

We expect the linter to report the following:

* reported: kind = `'global-superassignment'`, variable = `'x'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L54) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_binding_32_in_32_a_32_sibling_32_function_32_does_32_not_32_count">Test Case: a binding in a sibling function does not count</h4>

Given the following input:

```r
make <- function() { g <- function() n <- 0; function() n <<- 1 }
```

We expect the linter to report the following:

* reported: kind = `'global-superassignment'`, variable = `'n'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L55) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_package_32_variable_32_is_32_locked_32__40_flowR_32_extension_41_">Test Case: package variable is locked (flowR extension)</h4>

Given the following input:

```r
cache <- NULL
set_cache <- function(v) cache <<- v
```

We expect the linter to report the following:

* reported: kind = `'locked-superassignment'`, variable = `'cache'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L56) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_replacement_32_through_32_a_32_super-assignment">Test Case: replacement through a super-assignment</h4>

Given the following input:

```r
opts <- list()
set <- function(v) opts$a <<- v
```

We expect the linter to report the following:

* reported: kind = `'locked-superassignment'`, variable = `'opts'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_names_40__41__32_replacement_32_through_32_a_32_super-assignment">Test Case: names() replacement through a super-assignment</h4>

Given the following input:

```r
f <- function(v) names(lst) <<- v
```

We expect the linter to report the following:

* reported: kind = `'global-superassignment'`, variable = `'lst'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L60) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_top-level_32_super-assignment_32_is_32_not_32_within_32_a_32_function">Test Case: top-level super-assignment is not within a function</h4>

Given the following input:

```r
x <<- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L61) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_onLoad_32_runs_32_before_32_the_32_namespace_32_is_32_locked_32__40_reticulate_32_idiom_41_">Test Case: onLoad runs before the namespace is locked (reticulate idiom)</h4>

Given the following input:

```r
np <- NULL
.onLoad <- function(libname, pkgname) np <<- reticulate::import("numpy", delay_load = TRUE)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_helper_32_of_32_onLoad_32_is_32_still_32_locked_32_when_32_called_32_later">Test Case: helper of onLoad is still locked when called later</h4>

Given the following input:

```r
np <- NULL
set_np <- function() np <<- 1
```

We expect the linter to report the following:

* reported: kind = `'locked-superassignment'`, variable = `'np'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L63) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_top-level_32_local_32_runs_32_at_32_install_32_time">Test Case: top-level local runs at install time</h4>

Given the following input:

```r
cache <- NULL
local({
  cache <<- function() 1
})
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L64) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_for_32_variable_32_of_32_the_32_enclosing_32_function">Test Case: for variable of the enclosing function</h4>

Given the following input:

```r
f <- function() { for(i in 1:3) NULL; h <- function() i <<- 0; h() }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_assigned_32_name_32_of_32_the_32_enclosing_32_function">Test Case: assigned name of the enclosing function</h4>

Given the following input:

```r
f <- function() { assign("z", 0); g <- function() z <<- 1; g() }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L66) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_binding_32_of_32_the_32_same_32_function_32_in_32_a_32_nested_32_scope_32_does_32_not_32_count">Test Case: a binding of the same function in a nested scope does not count</h4>

Given the following input:

```r
outer <- function() { inner <- function() { x <- 1; x <<- 2 }; inner() }
```

We expect the linter to report the following:

* reported: kind = `'global-superassignment'`, variable = `'x'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L67) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_state_32_kept_32_in_32_an_32_environment_32_is_32_fine">Test Case: state kept in an environment is fine</h4>

Given the following input:

```r
pkg_env <- new.env()
set <- function(v) pkg_env$x <- v
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_super-assignments_32_can_32_be_32_muted">Test Case: super-assignments can be muted</h4>

Given the following input:

```r
f <- function() counter <<- 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L69) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_code_32_may_32_change_32_the_32_global_32_environment">Test Case: test code may change the global environment</h4>

Given the following input:

```r
assign("x", 1, envir = globalenv())
attach(d)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_several_32_findings_32_in_32_one_32_function">Test Case: several findings in one function</h4>

Given the following input:

```r
f <- function(d) { attach(d); assign("x", 1, envir = globalenv()); y <<- 2 }
```

We expect the linter to report the following:

* reported: kind = `'attach'`
* reported: kind = `'assign'`
* reported: kind = `'global-superassignment'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-global-environment-modification.test.ts#L74) for the test-case implementation.