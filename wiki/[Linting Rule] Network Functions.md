_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="network-functions">Network Functions&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#performance'>![performance](https://img.shields.io/badge/performance-teal) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#security'>![security](https://img.shields.io/badge/security-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds functions that execute network operations, such as downloading files or making HTTP requests.\
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

Query: **linter** (14 ms)\
&nbsp;&nbsp;&nbsp;╰ **Network Functions** (network-functions):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function `utils::read.csv` at 2.1-40\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function `utils::download.file` at 3.1-32

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

<h4 id="Test_32_Case:_32_an_32_address_32_built_32_from_32_the_32_strings_32_of_32_a_32_loop_32_is_32_found">Test Case: an address built from the strings of a loop is found</h4>

Given the following input:

```r
for(h in c("a", "b")) x <- read.csv(paste0("https://", h, ".org"))
```

We expect the linter to report the following:

* certain at 1.28-1.66: function = `'utils::read.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L42) for the test-case implementation.

<h4 id="Test_32_Case:_32_rvest_32_still_32_fetches_32_a_32_constant_32_URL_32_it_32_is_32_handed_32_to_32_parse">Test Case: rvest still fetches a constant URL it is handed to parse</h4>

Given the following input:

```r
library(rvest)
html_text(html_nodes(read_html("https://x.org"), "a"))
```

We expect the linter to report the following:

* certain at 2.22-2.47: function = `'read_html'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L46) for the test-case implementation.

<h4 id="Test_32_Case:_32_native_32_pipe">Test Case: native pipe</h4>

Given the following input:

```r
"https://x.org/a.csv" |> read.csv()
```

We expect the linter to report the following:

* certain at 1.26-1.35: function = `'utils::read.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L48) for the test-case implementation.

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

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L51) for the test-case implementation.

<h4 id="Test_32_Case:_32_unloaded_32_library_32_call">Test Case: unloaded library call</h4>

Given the following input:

```r
POST("http://example.com")
```

We expect the linter to report the following:

* certain at 1.1-1.26: function = `'POST'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L59) for the test-case implementation.

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

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L69) for the test-case implementation.

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

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L83) for the test-case implementation.

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

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L89) for the test-case implementation.

<h4 id="Test_32_Case:_32_trigger_32_on_32_web_32_source">Test Case: trigger on web source</h4>

Given the following input:

```r
source("https://foo.com")
```

We expect the linter to report the following:

* certain at 1.1-1.25: function = `'base::source'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L120) for the test-case implementation.

<h4 id="Test_32_Case:_32_Named_32_argument">Test Case: Named argument</h4>

Given the following input:

```r
read.csv(file = "http://example.com/data.csv")
```

We expect the linter to report the following:

* certain at 1.1-1.46: function = `'utils::read.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L129) for the test-case implementation.

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

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L137) for the test-case implementation.

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

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L145) for the test-case implementation.

<h4 id="Test_32_Case:_32_Resolve_32_value">Test Case: Resolve value</h4>

Given the following input:

```r
url <- "http://example.com/data.csv"; read.csv(url)
```

We expect the linter to report the following:

* certain at 1.39-1.51: function = `'utils::read.csv'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L154) for the test-case implementation.

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

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L164) for the test-case implementation.

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

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L170) for the test-case implementation.

<h4 id="Test_32_Case:_32_cat_32_to_32_a_32_url">Test Case: cat to a url</h4>

> R opens urls for reading only, so writing to one fails before it reaches the network

Given the following input:

```r
cat("hello", file = "https://example.com")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-network-functions.test.ts#L184) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**a file name built from the numbers of a loop is local**

```r
for(i in 2000:2002) x <- read.csv(paste0(i, ".csv"))
```

**a file name built from the strings of a loop is local**

```r
for(i in c("a", "b")) x <- read.csv(paste0(i, ".csv"))
```

**a local data source of an attached package**

```r
library(rgdal)
x <- readOGR("coastpolygon", "coastpolygon")
```

**rvest selectors work on a parsed document**

```r
library(rvest)
html_text(html_nodes(doc, "a"))
```

**mismatched library call**

```r
httr2::GET("http://example.com")
```

**do not trigger without url prefix**

```r
read.csv("www.example.com")
```

**do not trigger with multiple arguments**

```r
download.file("data/local.csv", "local.csv")
```

**not in list test**

```r
file("data/local.csv")
```

**nor in list but prefix in string**

```r
print("http://example.com")
```

**do not trigger on known source**

```r
source("tex.R")
```

**cat without file**

```r
cat("hello
")
```

**writeLines without con**

```r
writeLines("x")
```

**cat with an unknown value where its file may go**

```r
cat("n: ", length(x))
```

**cat to a local file**

```r
cat("hello", file = "out.txt")
```

**a device writing to a name the user gives**

```r
name <- readline("File: ")
pdf(name)
```