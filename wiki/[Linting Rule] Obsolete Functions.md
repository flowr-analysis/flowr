_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 21:25:13 UTC (v2.16.2), do not edit directly._
<h2 id="obsolete-functions">Obsolete Functions&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This signals the use of deprecated functions or features."><a href='#deprecated'>![deprecated](https://img.shields.io/badge/deprecated-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#37](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-37) 🟩

This rule is a `best-effort` rule.
 
Finds calls of deprecated and defunct base functions and of platform-specific graphics devices (`x11()`, `quartz()`, `windows()`).\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/obsolete-functions.ts#L57">src/linter/rules/cmd-check/obsolete-functions.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `obsolete-functions` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/obsolete-functions.ts#L23"><code><span title="report the functions R CMD check knows of, see BuiltinObsoleteFunctions (default true)">defaults</span></code></a>\
report the functions `R CMD check` knows of, see
<code>BuiltinObsoleteFunctions</code>
(default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/obsolete-functions.ts#L27"><code><span title="further defunct or removed functions to report">defunct</span></code></a>\
further defunct or removed functions to report
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/obsolete-functions.ts#L25"><code><span title="further deprecated functions to report">deprecated</span></code></a>\
further deprecated functions to report
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/obsolete-functions.ts#L29"><code><span title="further platform-specific graphics devices to report">platformDevices</span></code></a>\
further platform-specific graphics devices to report

### Examples

```r
f <- function(x) {
	x11()
	as.real(x)
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "obsolete-functions",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Obsolete Functions** (obsolete-functions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ platform-device x11 at 2.2-6\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ defunct as.real at 3.2-11\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "obsolete-functions": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 6,
            "loc": [2,2,2,6],
            "kind": "platform-device",
            "name": "x11",
            "message": "Found the platform-specific device: x11, dev.new() is the preferred way to open a new device"
          },
          {"certainty":"certain","involvedId":10,"loc":[3,2,3,11],"kind":"defunct","name":"as.real","message":"Found the defunct/removed function: as.real"}
        ],
        ".meta": {"consideredCalls":2}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts)

<h4 id="Test_32_Case:_32_deprecated_32_function">Test Case: deprecated function</h4>

> the R CMD check cases

Given the following input:

```r
f <- function(x) plclust(x)
```

We expect the linter to report the following:

* certain: kind = `'deprecated'`, name = `'plclust'`, message = `'Found the deprecated function: plclust'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L11) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_defunct_32_function">Test Case: defunct function</h4>

Given the following input:

```r
f <- function(x) La.eigen(x)
```

We expect the linter to report the following:

* reported: kind = `'defunct'`, name = `'La.eigen'`, message = `'Found the defunct/removed function: La.eigen'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L14) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_platform-specific_32_device">Test Case: platform-specific device</h4>

Given the following input:

```r
f <- function() x11()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'x11'`, message = `'Found the platform-specific device: x11, dev.new() is the preferred way to open a new device'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_upper-case_32_device">Test Case: upper-case device</h4>

Given the following input:

```r
f <- function() X11()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'X11'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_quartz_32_device">Test Case: quartz device</h4>

Given the following input:

```r
f <- function() quartz()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'quartz'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_windows_32_device">Test Case: windows device</h4>

Given the following input:

```r
f <- function() windows()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'windows'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L24) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_win.graph_32_device">Test Case: win.graph device</h4>

Given the following input:

```r
f <- function() win.graph()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'win.graph'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L25) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_win.metafile_32_device">Test Case: win.metafile device</h4>

Given the following input:

```r
f <- function() win.metafile()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'win.metafile'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_win.print_32_device">Test Case: win.print device</h4>

Given the following input:

```r
f <- function() win.print()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'win.print'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_several_32_devices_32_in_32_one_32_function">Test Case: several devices in one function</h4>

Given the following input:

```r
f <- function() {
  windows()
  win.print()
}
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'windows'`
* reported: kind = `'platform-device'`, name = `'win.print'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_device_32_with_32_arguments">Test Case: device with arguments</h4>

Given the following input:

```r
f <- function() x11(width = 5, display = ":0")
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'x11'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L31) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_defunct_32_.readRDS">Test Case: defunct .readRDS</h4>

Given the following input:

```r
f <- function(x) .readRDS(x)
```

We expect the linter to report the following:

* reported: kind = `'defunct'`, name = `'.readRDS'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_defunct_32_as.real">Test Case: defunct as.real</h4>

Given the following input:

```r
f <- function(x) as.real(x)
```

We expect the linter to report the following:

* reported: kind = `'defunct'`, name = `'as.real'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L33) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_defunct_32_tk_32_functions">Test Case: defunct tk functions</h4>

Given the following input:

```r
f <- function() tkopen()
```

We expect the linter to report the following:

* reported: kind = `'defunct'`, name = `'tkopen'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L34) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_defunct_32_.find.package">Test Case: defunct .find.package</h4>

Given the following input:

```r
f <- function(p) .find.package(p)
```

We expect the linter to report the following:

* reported: kind = `'defunct'`, name = `'.find.package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L35) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_reports_32_the_32_location_32_of_32_the_32_call">Test Case: reports the location of the call</h4>

Given the following input:

```r
f <- function(x) {
  y <- 1
  plclust(x)
}
```

We expect the linter to report the following:

* reported

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_calls_32_in_32_nested_32_functions">Test Case: calls in nested functions</h4>

Given the following input:

```r
f <- function() {
  g <- function() La.eigen(1)
  g()
}
```

We expect the linter to report the following:

* reported: kind = `'defunct'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_calls_32_at_32_the_32_top_32_level_32_of_32_a_32_package_32_file">Test Case: calls at the top level of a package file</h4>

Given the following input:

```r
x <- X11()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'X11'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_namespaced_32_device">Test Case: namespaced device</h4>

Given the following input:

```r
f <- function() grDevices::x11()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'x11'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L48) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_namespaced_32_defunct_32_function">Test Case: namespaced defunct function</h4>

Given the following input:

```r
f <- function(x) base::.find.package(x)
```

We expect the linter to report the following:

* reported: kind = `'defunct'`, name = `'.find.package'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L49) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_internal_32_namespace_32_access">Test Case: internal namespace access</h4>

Given the following input:

```r
f <- function(x) stats:::tetragamma(x)
```

We expect the linter to report the following:

* reported: kind = `'defunct'`, name = `'tetragamma'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_function_32_defined_32_in_32_the_32_same_32_file">Test Case: function defined in the same file</h4>

Given the following input:

```r
x11 <- function() 1
f <- function() x11()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L54) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_local_32_function_32_shadowing_32_the_32_name">Test Case: local function shadowing the name</h4>

Given the following input:

```r
f <- function() {
  plclust <- function(x) x
  plclust(1)
}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L55) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_additional_32_deprecated_32_function">Test Case: additional deprecated function</h4>

Given the following input:

```r
f <- function(x) foo(x)
g <- function(x) plclust(x)
```

We expect the linter to report the following:

* reported: kind = `'deprecated'`, name = `'foo'`
* reported: kind = `'deprecated'`, name = `'plclust'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_only_32_the_32_given_32_functions">Test Case: only the given functions</h4>

Given the following input:

```r
f <- function(x) foo(x)
g <- function(x) plclust(x)
```

We expect the linter to report the following:

* reported: kind = `'deprecated'`, name = `'foo'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_built-in_32_functions">Test Case: no built-in functions</h4>

Given the following input:

```r
f <- function(x) plclust(x)
g <- function() x11()
h <- function(x) La.eigen(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_additional_32_defunct_32_function">Test Case: additional defunct function</h4>

Given the following input:

```r
f <- function(x) old_fn(x)
```

We expect the linter to report the following:

* reported: kind = `'defunct'`, name = `'old_fn'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L66) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_additional_32_platform_32_device">Test Case: additional platform device</h4>

Given the following input:

```r
f <- function() myDevice()
```

We expect the linter to report the following:

* reported: kind = `'platform-device'`, name = `'myDevice'`, message = `'Found the platform-specific device: myDevice, dev.new() is the preferred way to open a new device'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L67) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_built-in_32_platform_32_device_32_disabled">Test Case: built-in platform device disabled</h4>

Given the following input:

```r
f <- function() x11()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dev.new_32_is_32_the_32_preferred_32_way">Test Case: dev.new is the preferred way</h4>

Given the following input:

```r
f <- function() dev.new()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L72) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_similar_32_names_32_are_32_no_32_match">Test Case: similar names are no match</h4>

Given the following input:

```r
f <- function() x11mod() + plclusters()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L73) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_plain_32_function_32_call">Test Case: a plain function call</h4>

Given the following input:

```r
f <- function(x) sum(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_obsolete_32_name_32_not_32_called">Test Case: obsolete name not called</h4>

Given the following input:

```r
f <- function(x) x$plclust
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L75) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_code_32_is_32_no_32_package_32_code">Test Case: test code is no package code</h4>

Given the following input:

```r
plclust(1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L76) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_inst_32_code_32_is_32_no_32_package_32_code">Test Case: inst code is no package code</h4>

Given the following input:

```r
plclust(1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L77) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_vignette_32_code_32_is_32_no_32_package_32_code">Test Case: vignette code is no package code</h4>

Given the following input:

```r
x11()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L78) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_code_32_without_32_a_32_package_32_is_32_package_32_code">Test Case: code without a package is package code</h4>

Given the following input:

```r
plclust(1)
```

We expect the linter to report the following:

* reported: kind = `'deprecated'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-obsolete-functions.test.ts#L82) for the test-case implementation.