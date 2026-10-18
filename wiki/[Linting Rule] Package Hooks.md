_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 19:24:09 UTC (v2.16.2), do not edit directly._
<h2 id="package-hooks">Package Hooks&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the (re-)usability of the code. For example, missing or incorrect error handling, or missing or incorrect user interface elements."><a href='#usability'>![usability](https://img.shields.io/badge/usability-teal) </a></span>

This rule is a `best-effort` rule.
 
Port of the `R CMD check` notes on package hooks (`checking R code for possible problems`): startup functions (`.onLoad`, `.onAttach`) with a wrong argument list, that change the search path, print messages other than with `packageStartupMessage` (which in turn is out of place in `.onLoad`), or call `installed.packages`; detach functions (`.onDetach`, `.Last.lib`) with a wrong argument list or calling `library.dynam.unload`; `library.dynam` in `.onAttach`; the obsolete `.First.lib`; and an unexported `.Last.lib`. Where `R CMD check` looks for function names, flowR asks which calls attach a package or print, and follows the calls into the package's own functions.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L138">src/linter/rules/cmd-check/package-hooks.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `package-hooks` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L46"><code><span title="functions that may emit output in a startup hook nonetheless, as the user can silence them otherwise (default warning)">allowedOutput</span></code></a>\
functions that may emit output in a startup hook nonetheless, as the user can silence them otherwise (default `warning`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L50"><code><span title="also report what the hook does through functions of the package it calls, which R CMD check does not see (default true)">followCalls</span></code></a>\
also report what the hook does through functions of the package it calls, which `R CMD check` does not see (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L44"><code><span title="functions that print startup messages the way R wants them to, which are only allowed in .onAttach">startupMessageFunctions</span></code></a>\
functions that print startup messages the way R wants them to, which are only allowed in `.onAttach`
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/package-hooks.ts#L48"><code><span title="functions too costly or unsafe to call in a startup hook (default installed.packages)">unsafeCalls</span></code></a>\
functions too costly or unsafe to call in a startup hook (default `installed.packages`)

### Examples

```r
.onLoad <- function(libname, pkgname) {
	library(stats)
	cat("Welcome!")
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "package-hooks",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (9 ms)\
&nbsp;&nbsp;&nbsp;╰ **Package Hooks** (package-hooks):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ .onLoad: search-path (library) at 2.2-15\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ .onLoad: output (cat) at 3.2-16\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "package-hooks": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 10,
            "loc": [2,2,2,15],
            "hook": ".onLoad",
            "issue": "search-path",
            "call": "library",
            "message": "Package startup functions should not change the search path, but .onLoad calls library"
          },
          {
            "certainty": "certain",
            "involvedId": 14,
            "loc": [3,2,3,16],
            "hook": ".onLoad",
            "issue": "output",
            "call": "cat",
            "message": "Package startup functions should use packageStartupMessage to generate messages, but .onLoad calls cat"
          }
        ],
        ".meta": {"hooks":[".onLoad"]}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-package-hooks.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts)

<h4 id="Test_32_Case:_32_proper_32_startup_32_hook">Test Case: proper startup hook</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) invisible()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L10) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_abbreviated_32_names_32_are_32_fine">Test Case: abbreviated names are fine</h4>

Given the following input:

```r
.onAttach <- function(lib, pkg) invisible()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L11) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dots_32_accept_32_anything">Test Case: dots accept anything</h4>

Given the following input:

```r
.onLoad <- function(...) invisible()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L12) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_startup_32_hook_32_without_32_arguments">Test Case: startup hook without arguments</h4>

Given the following input:

```r
.onLoad <- function() invisible()
```

We expect the linter to report the following:

* certain: hook = `'.onLoad'`, issue = `'arguments'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L13) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_swapped_32_startup_32_arguments">Test Case: swapped startup arguments</h4>

Given the following input:

```r
.onAttach <- function(pkgname, libname) invisible()
```

We expect the linter to report the following:

* reported: hook = `'.onAttach'`, issue = `'arguments'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L16) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_three_32_startup_32_arguments">Test Case: three startup arguments</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname, x) invisible()
```

We expect the linter to report the following:

* reported: issue = `'arguments'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_proper_32_detach_32_hook">Test Case: proper detach hook</h4>

Given the following input:

```r
.onDetach <- function(libpath) invisible()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_detach_32_hook_32_with_32_two_32_arguments">Test Case: detach hook with two arguments</h4>

Given the following input:

```r
.onDetach <- function(libpath, pkg) invisible()
```

We expect the linter to report the following:

* reported: hook = `'.onDetach'`, issue = `'arguments'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L19) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_onUnload_32_is_32_not_32_checked">Test Case: onUnload is not checked</h4>

Given the following input:

```r
.onUnload <- function() invisible()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_library_32_in_32_onLoad_32_changes_32_the_32_search_32_path">Test Case: library in onLoad changes the search path</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) {
  library(stats)
}
```

We expect the linter to report the following:

* certain: issue = `'search-path'`, call = `'library'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L24) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_require_32_in_32_onAttach_32_changes_32_the_32_search_32_path">Test Case: require in onAttach changes the search path</h4>

Given the following input:

```r
.onAttach <- function(libname, pkgname) require(stats)
```

We expect the linter to report the following:

* reported: issue = `'search-path'`, call = `'require'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_library_40_help_32__61__32__41__32_does_32_not_32_attach">Test Case: library(help = ) does not attach</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) library(help = "stats")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_requireNamespace_32_does_32_not_32_change_32_the_32_search_32_path">Test Case: requireNamespace does not change the search path</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) requireNamespace("stats", quietly = TRUE)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L29) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_cat_32_in_32_onAttach">Test Case: cat in onAttach</h4>

Given the following input:

```r
.onAttach <- function(libname, pkgname) cat("Welcome")
```

We expect the linter to report the following:

* reported: issue = `'output'`, call = `'cat'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L30) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_message_32_in_32_onLoad">Test Case: message in onLoad</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) message("hi")
```

We expect the linter to report the following:

* reported: issue = `'output'`, call = `'message'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L31) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_print_32_and_32_writeLines">Test Case: print and writeLines</h4>

Given the following input:

```r
.onAttach <- function(libname, pkgname) { print(1); writeLines("x") }
```

We expect the linter to report the following:

* reported: issue = `'output'`, call = `'print'`
* reported: issue = `'output'`, call = `'writeLines'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_packageStartupMessage_32_in_32_onAttach_32_is_32_right">Test Case: packageStartupMessage in onAttach is right</h4>

Given the following input:

```r
.onAttach <- function(libname, pkgname) packageStartupMessage("Welcome")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_packageStartupMessage_32_in_32_onLoad_32_is_32_wrong">Test Case: packageStartupMessage in onLoad is wrong</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) packageStartupMessage("Welcome")
```

We expect the linter to report the following:

* reported: issue = `'output'`, call = `'packageStartupMessage'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L36) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_cat_32_to_32_a_32_file_32_is_32_no_32_output">Test Case: cat to a file is no output</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) cat("x", file = tempfile())
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_writeLines_32_to_32_a_32_connection_32_is_32_no_32_output">Test Case: writeLines to a connection is no output</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) { con <- file(tempfile()); writeLines("x", con) }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L40) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_write_32_to_32_a_32_file_32_is_32_no_32_output">Test Case: write to a file is no output</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) write(1:3, file = tempfile())
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_warning_32_is_32_allowed">Test Case: warning is allowed</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) warning("old R")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L42) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_allowed_32_output_32_is_32_configurable">Test Case: allowed output is configurable</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) message("hi")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L43) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_installed.packages_32_is_32_unsafe">Test Case: installed.packages is unsafe</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) { ip <- installed.packages() }
```

We expect the linter to report the following:

* reported: issue = `'unsafe-call'`, call = `'installed.packages'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_library.dynam_32_belongs_32_into_32_onLoad">Test Case: library.dynam belongs into onLoad</h4>

Given the following input:

```r
.onAttach <- function(libname, pkgname) library.dynam("pkg", pkgname, libname)
```

We expect the linter to report the following:

* reported: issue = `'misplaced-call'`, call = `'library.dynam'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L45) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_library.dynam_32_in_32_onLoad_32_is_32_right">Test Case: library.dynam in onLoad is right</h4>

Given the following input:

```r
.onLoad <- function(libname, pkgname) library.dynam("pkg", pkgname, libname)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L48) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_library.dynam.unload_32_belongs_32_into_32_onUnload">Test Case: library.dynam.unload belongs into onUnload</h4>

Given the following input:

```r
.onDetach <- function(libpath) library.dynam.unload("pkg", libpath)
```

We expect the linter to report the following:

* reported: issue = `'misplaced-call'`, call = `'library.dynam.unload'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L49) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_library.dynam.unload_32_in_32_onUnload_32_is_32_right">Test Case: library.dynam.unload in onUnload is right</h4>

Given the following input:

```r
.onUnload <- function(libpath) library.dynam.unload("pkg", libpath)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L52) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_detach_32_hooks_32_may_32_print">Test Case: detach hooks may print</h4>

Given the following input:

```r
.onDetach <- function(libpath) message("bye")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_ordinary_32_functions_32_may_32_do_32_anything">Test Case: ordinary functions may do anything</h4>

Given the following input:

```r
f <- function() { library(stats); cat("x") }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L54) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefined_32_cat_32_is_32_no_32_output">Test Case: redefined cat is no output</h4>

Given the following input:

```r
cat <- function(...) invisible()
.onAttach <- function(libname, pkgname) cat("x")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L55) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_output_32_in_32_a_32_helper">Test Case: output in a helper</h4>

Given the following input:

```r
welcome <- function() cat("Welcome")
.onAttach <- function(libname, pkgname) welcome()
```

We expect the linter to report the following:

* uncertain: issue = `'output'`, call = `'cat'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_attach_32_in_32_a_32_nested_32_helper">Test Case: attach in a nested helper</h4>

Given the following input:

```r
a <- function() library(stats)
b <- function() a()
.onLoad <- function(libname, pkgname) b()
```

We expect the linter to report the following:

* uncertain: issue = `'search-path'`, call = `'library'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_recursive_32_helpers_32_terminate">Test Case: recursive helpers terminate</h4>

Given the following input:

```r
a <- function(n) { cat("x"); if(n > 0) a(n - 1) }
.onAttach <- function(libname, pkgname) a(3)
```

We expect the linter to report the following:

* reported: issue = `'output'`, call = `'cat'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_conditional_32_output_32_in_32_a_32_helper_32_is_32_no_32_output_32_of_32_the_32_hook">Test Case: conditional output in a helper is no output of the hook</h4>

Given the following input:

```r
register <- function() if(isTRUE(getOption("pkg.verbose"))) message("registered")
.onLoad <- function(libname, pkgname) register()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L66) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_output_32_in_32_a_32_loop_32_of_32_a_32_helper_32_is_32_conditional">Test Case: output in a loop of a helper is conditional</h4>

Given the following input:

```r
helper <- function(xs) for(x in xs) cat(x)
.onAttach <- function(libname, pkgname) helper(1:3)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L67) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_nested_32_functions_32_of_32_a_32_helper_32_do_32_not_32_run">Test Case: nested functions of a helper do not run</h4>

Given the following input:

```r
helper <- function() { cb <- function() cat("x"); invisible(cb) }
.onAttach <- function(libname, pkgname) helper()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_following_32_calls_32_can_32_be_32_disabled">Test Case: following calls can be disabled</h4>

Given the following input:

```r
welcome <- function() cat("Welcome")
.onAttach <- function(libname, pkgname) welcome()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L69) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_.First.lib_32_is_32_obsolete">Test Case: .First.lib is obsolete</h4>

Given the following input:

```r
.First.lib <- function(lib, pkg) invisible()
```

We expect the linter to report the following:

* reported: hook = `'.First.lib'`, issue = `'obsolete'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_.Last.lib_32_not_32_exported">Test Case: .Last.lib not exported</h4>

Given the following input:

```r
.Last.lib <- function(libpath) invisible()
```

We expect the linter to report the following:

* reported: hook = `'.Last.lib'`, issue = `'unexported'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_.Last.lib_32_exported">Test Case: .Last.lib exported</h4>

Given the following input:

```r
.Last.lib <- function(libpath) invisible()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L77) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_.Last.lib_32_exported_32_by_32_pattern">Test Case: .Last.lib exported by pattern</h4>

Given the following input:

```r
.Last.lib <- function(libpath) invisible()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L78) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_hooks_32_outside_32_of_32_R/_32_are_32_ignored">Test Case: hooks outside of R/ are ignored</h4>

Given the following input:

```r
.onLoad <- function() library(stats)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L82) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_nested_32_definitions_32_are_32_no_32_hooks">Test Case: nested definitions are no hooks</h4>

Given the following input:

```r
f <- function() { .onLoad <- function() 1 }
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-package-hooks.test.ts#L83) for the test-case implementation.