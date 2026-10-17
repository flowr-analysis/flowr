_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-16, 18:40:42 UTC (v2.16.2), do not edit directly._
<h2 id="network-functions">Network Functions&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <span title="This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures."><a href='#performance'>![performance](https://img.shields.io/badge/performance-teal) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span>

This rule is a `best-effort` rule.
 
Marks network functions that execute network operations, such as downloading files or making HTTP requests.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/network-functions.ts#L96">src/linter/rules/network-functions.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `network-functions` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/network-functions.ts#L22"><code><span title="The list of function names or more detailed NetworkFunction information that should be marked in the given context if their arguments match.">fns</span></code></a>\
The list of function names or more detailed
<code>NetworkFunction</code>
information that should be marked in the given context if their arguments match.

### Examples

```r

read.csv("https://example.com/data.csv")
download.file("https://foo.bar")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "network-functions",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (3 ms)\
&nbsp;&nbsp;&nbsp;╰ **Network Functions** (network-functions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function `utils::read.csv` at 2.1-40\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function `utils::download.file` at 3.1-32\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "network-functions": {
        "results": [
          {"certainty":"certain","involvedId":3,"function":"utils::read.csv","loc":[2,1,2,40]},
          {"certainty":"certain","involvedId":7,"function":"utils::download.file","loc":[3,1,3,32]}
        ],
        ".meta": {"totalCalls":2,"totalFunctionDefinitions":2}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-network-functions.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts)

<h4 id="Test_32_Case:_32_network_32_function_32_nested">Test Case: network function nested</h4>

> Testing the nested use the 'url' function in other function calls

Given the following input:

```r
foo(url("http://example.com"))
```

We expect the linter to report the following:

* certain at 1.5-1.29: function = `'base::url'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L13) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_network_32_funcion_32_with_32_multiple_32_arguments:_32__36__123_prefix_125_">Test Case: network funcion with multiple arguments: ${prefix}</h4>

Given the following input:

```r
download.file("${prefix}foo.org/bar.csv", "local.csv")
```

We expect the linter to report the following:

* certain: function = `'utils::download.file'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L30) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_local_32_data_32_source_32_of_32_an_32_attached_32_package">Test Case: a local data source of an attached package</h4>

Given the following input:

```r
library(rgdal)
x <- readOGR("coastpolygon", "coastpolygon")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L40) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_rvest_32_selectors_32_work_32_on_32_a_32_parsed_32_document">Test Case: rvest selectors work on a parsed document</h4>

Given the following input:

```r
library(rvest)
html_text(html_nodes(doc, "a"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_rvest_32_still_32_fetches_32_a_32_constant_32_URL_32_it_32_is_32_handed_32_to_32_parse">Test Case: rvest still fetches a constant URL it is handed to parse</h4>

Given the following input:

```r
library(rvest)
html_text(html_nodes(read_html("https://x.org"), "a"))
```

We expect the linter to report the following:

* certain at 2.22-2.47: function = `'read_html'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L42) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_native_32_pipe">Test Case: native pipe</h4>

Given the following input:

```r
"https://x.org/a.csv" |> read.csv()
```

We expect the linter to report the following:

* certain at 1.26-1.35: function = `'utils::read.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_library_32_call">Test Case: library call</h4>

Given the following input:

```r
library(httr)
POST("http://example.com")
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('httr', ['GET', 'POST'])}
```

We expect the linter to report the following:

* certain at 2.1-2.26: function = `'httr::POST'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unloaded_32_library_32_call">Test Case: unloaded library call</h4>

Given the following input:

```r
POST("http://example.com")
```

We expect the linter to report the following:

* certain at 1.1-1.26: function = `'POST'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L55) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_mismatched_32_library_32_call">Test Case: mismatched library call</h4>

Given the following input:

```r
httr2::GET("http://example.com")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L60) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_namespace_32_call">Test Case: namespace call</h4>

Given the following input:

```r
library(httr)
httr::GET("http://example.com")
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('httr', ['GET', 'POST'])}
```

We expect the linter to report the following:

* certain at 2.1-2.31: function = `'httr::GET'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_do_32_not_32_trigger_32_without_32_url_32_prefix">Test Case: do not trigger without url prefix</h4>

Given the following input:

```r
read.csv("www.example.com")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_trigger_32_with_32_custom_32_url_32_prefix">Test Case: trigger with custom url prefix</h4>

Given the following input:

```r
read.csv("www.example.com")
```

And using the following [configuration](#configuration): 
```ts
{fns: [{name: Identifier.make('read.csv', 'utils'), onlyTriggerWithArgument: /^www\./}]}
```

We expect the linter to report the following:

* certain at 1.1-1.27: function = `'utils::read.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L79) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_do_32_not_32_trigger_32_with_32_custom_32_url_32_prefix">Test Case: do not trigger with custom url prefix</h4>

Given the following input:

```r
read.csv("https://example.com")
```

And using the following [configuration](#configuration): 
```ts
{fns: [{name: Identifier.make('read.csv', 'utils'), onlyTriggerWithArgument: /^www\./}]}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L85) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_do_32_not_32_trigger_32_with_32_multiple_32_arguments">Test Case: do not trigger with multiple arguments</h4>

Given the following input:

```r
download.file("data/local.csv", "local.csv")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L92) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_not_32_in_32_list_32_test">Test Case: not in list test</h4>

Given the following input:

```r
file("data/local.csv")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L98) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_nor_32_in_32_list_32_but_32_prefix_32_in_32_string">Test Case: nor in list but prefix in string</h4>

Given the following input:

```r
print("http://example.com")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L104) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_do_32_not_32_trigger_32_on_32_known_32_source">Test Case: do not trigger on known source</h4>

Given the following input:

```r
source("tex.R")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L110) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_trigger_32_on_32_web_32_source">Test Case: trigger on web source</h4>

Given the following input:

```r
source("https://foo.com")
```

We expect the linter to report the following:

* certain at 1.1-1.25: function = `'base::source'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L116) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Named_32_argument">Test Case: Named argument</h4>

Given the following input:

```r
read.csv(file = "http://example.com/data.csv")
```

We expect the linter to report the following:

* certain at 1.1-1.46: function = `'utils::read.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L125) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Positional_32_argument_32_with_32_custom_32_config">Test Case: Positional argument with custom config</h4>

Given the following input:

```r
test.me(x, "http://example.com/data.csv")
```

And using the following [configuration](#configuration): 
```ts
{fns: [{name: 'test.me', onlyTriggerWithArgument: /^(https?|ftps?):\/\//, info: {argIdx: 1}}]}
```

We expect the linter to report the following:

* certain at 1.1-1.41: function = `'test.me'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L133) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Named_32_argument_32_with_32_custom_32_config">Test Case: Named argument with custom config</h4>

Given the following input:

```r
test.me(foo = "http://example.com/data.csv")
```

And using the following [configuration](#configuration): 
```ts
{fns: [{name: 'test.me', onlyTriggerWithArgument: /^(https?|ftps?):\/\//, info: {argName: 'foo'}}]}
```

We expect the linter to report the following:

* certain at 1.1-1.44: function = `'test.me'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L141) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_Resolve_32_value">Test Case: Resolve value</h4>

Given the following input:

```r
url <- "http://example.com/data.csv"; read.csv(url)
```

We expect the linter to report the following:

* certain at 1.39-1.51: function = `'utils::read.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L150) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_with_32_a_32__40_controlled_41__32_package_32_database">Test Case: with a (controlled) package database</h4>

> // regression: the loaded-package export must still count as a built-in call target

Given the following input:

```r
library(httr)
GET("http://example.com")
```

And using the following [configuration](#configuration): 
```ts
{sigDb: controlledSigDb('httr', ['GET', 'POST'])}
```

We expect the linter to report the following:

* certain at 2.1-2.25: function = `'httr::GET'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L160) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_without_32_any_32_package_32_database">Test Case: without any package database</h4>

Given the following input:

```r
library(httr)
GET("http://example.com")
```

And using the following [configuration](#configuration): 
```ts
{noSigDb: true}
```

We expect the linter to report the following:

* certain at 2.1-2.25: function = `'GET'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L166) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_cat_32_without_32_file">Test Case: cat without file</h4>

Given the following input:

```r
cat("hello
")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L175) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_writeLines_32_without_32_con">Test Case: writeLines without con</h4>

Given the following input:

```r
writeLines("x")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L176) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_cat_32_with_32_an_32_unknown_32_value_32_where_32_its_32_file_32_may_32_go">Test Case: cat with an unknown value where its file may go</h4>

Given the following input:

```r
cat("n: ", length(x))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L177) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_cat_32_to_32_a_32_local_32_file">Test Case: cat to a local file</h4>

Given the following input:

```r
cat("hello", file = "out.txt")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L178) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_cat_32_to_32_a_32_url">Test Case: cat to a url</h4>

> R opens urls for reading only, so writing to one fails before it reaches the network

Given the following input:

```r
cat("hello", file = "https://example.com")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L180) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_device_32_writing_32_to_32_a_32_name_32_the_32_user_32_gives">Test Case: a device writing to a name the user gives</h4>

Given the following input:

```r
name <- readline("File: ")
pdf(name)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L181) for the test-case implementation.