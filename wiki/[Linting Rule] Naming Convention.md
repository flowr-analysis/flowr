_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-19, 06:47:02 UTC (v2.16.2), do not edit directly._
<h2 id="naming-convention">Naming Convention&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that are related to the style of the code. For example, inconsistent naming conventions, or missing or incorrect formatting."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#style'>![style](https://img.shields.io/badge/style-blue) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span>

This rule is a `over-approximative` rule.
 
Finds symbols that do not follow the naming convention of the code.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/naming-convention.ts#L199">src/linter/rules/naming-convention.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `naming-convention` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/naming-convention.ts#L34"><code><span title="which casing convention to enforce">caseing</span></code></a>\
which casing convention to enforce
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/naming-convention.ts#L37"><code><span title="if true non alphabetic characters are ignored">ignoreNonAlpha</span></code></a>\
if true non alphabetic characters are ignored

### Examples

```r

testVar <- 5
testVarTwo <- 5
other_var <- 5
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "naming-convention",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Naming Convention** (naming-convention):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Identifier 'other_var' at 4.1-9 (snake_case) (1 quick fix(es) available)

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "naming-convention": {
        "results": [
          {
            "certainty": "certain",
            "detectedCasing": "snake_case",
            "name": "other_var",
            "loc": [4,1,4,9],
            "involvedId": 6,
            "quickFix": [{"type":"replace","replacement":"otherVar","description":"Rename to match naming convention camelCase","loc":[4,1,4,9]}]
          }
        ],
        ".meta": {"numMatches":2,"numBreak":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-naming-convention.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts)

<h4 id="Test_32_Case:_32_simple">Test Case: simple</h4>

> Given a symbol definition `testVar <- 5` the linter checks if it matches the configured casing rule (here we check for PascalCase) and provides a quick fix `TestVar <- 5`

Given the following input:

```r
testVar <- 5
```

And using the following [configuration](#configuration): 
```ts
{caseing: CasingConvention.PascalCase}
```

We expect the linter to report the following:

* certain at 1.1-1.7: name = `'testVar'`, detectedCasing = `CasingConvention.CamelCase`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L126) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_no_32_fix_32_onto_32_a_32_taken_32_name">Test Case: no fix onto a taken name</h4>

> A rename onto a name the program binds already would change what that name refers to, so no fix is offered

Given the following input:

```r
testVar <- 5
TestVar <- 6
```

And using the following [configuration](#configuration): 
```ts
{caseing: CasingConvention.PascalCase}
```

We expect the linter to report the following:

* certain at 1.1-1.7: name = `'testVar'`, detectedCasing = `CasingConvention.CamelCase`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L135) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_only_32_detect_32_definition">Test Case: only detect definition</h4>

> The casing of the definition is checked, and quick fixes for all usages (and the definition) are provided

Given the following input:

```r
testVar <- 5
print(testVar)
```

And using the following [configuration](#configuration): 
```ts
{caseing: CasingConvention.PascalCase}
```

We expect the linter to report the following:

* certain at 1.1-1.7: name = `'testVar'`, detectedCasing = `CasingConvention.CamelCase`, 2 quick fixes

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L144) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_function_32_and_32_call">Test Case: function and call</h4>

> Arguments will be checked for correct casing convention as well

Given the following input:

```r
foo_Bar <- function(arg) arg
foo_Bar()
```

And using the following [configuration](#configuration): 
```ts
{caseing: CasingConvention.PascalCase}
```

We expect the linter to report the following:

* certain at 1.1-1.7: name = `'foo_Bar'`, detectedCasing = `CasingConvention.CamelSnakeCase`, 2 quick fixes
* certain at 1.21-1.23: name = `'arg'`, detectedCasing = `CasingConvention.CamelCase`, 2 quick fixes

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L156) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_detect_32_casing">Test Case: detect casing</h4>

> The rule can be configured to automaticaly detect the most used casing style. The file will be linted according to the detected style

Given the following input:

```r
testVar <- 5
testVarTwo <- 5
test_var <- 5
```

And using the following [configuration](#configuration): 
```ts
{caseing: 'auto'}
```

We expect the linter to report the following:

* certain at 3.1-3.8: name = `'test_var'`, detectedCasing = `CasingConvention.SnakeCase`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L180) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_non_32_alpha_32_identifier_32__40_ignore_41_">Test Case: non alpha identifier (ignore)</h4>

> The rule can be configured to ignore identifier that do not contain any alphabetic characters

Given the following input:

```r
._ <- 4
```

And using the following [configuration](#configuration): 
```ts
{caseing: 'auto', ignoreNonAlpha: true}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L189) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_non_32_alpha_32_identifier_32__40_do_32_not_32_ignore_41_">Test Case: non alpha identifier (do not ignore)</h4>

> Otherwise the linter will always detect non alpha identifiers as following the wrong convention

Given the following input:

```r
._ <- 4
```

And using the following [configuration](#configuration): 
```ts
{caseing: CasingConvention.SnakeCase, ignoreNonAlpha: false}
```

We expect the linter to report the following:

* certain at 1.1-1.2: detectedCasing = `CasingConvention.Unknown`, name = `'._'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L195) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_one-word_32_names_32_cast_32_no_32_vote">Test Case: one-word names cast no vote</h4>

Given the following input:

```r
x <- 1
y <- 2
my_var <- 3
```

And using the following [configuration](#configuration): 
```ts
{caseing: 'auto'}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L206) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_one-word_32_names_32_do_32_not_32_hide_32_a_32_name_32_breaking_32_the_32_multi-word_32_convention">Test Case: one-word names do not hide a name breaking the multi-word convention</h4>

Given the following input:

```r
x <- 1
y <- 2
my_var <- 3
other_var <- 4
myVar <- 5
```

And using the following [configuration](#configuration): 
```ts
{caseing: 'auto'}
```

We expect the linter to report the following:

* certain at 5.1-5.5: detectedCasing = `CasingConvention.CamelCase`, name = `'myVar'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L207) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_quoted_32_names_32_are_32_converted_32_within_32_their_32_quotes">Test Case: quoted names are converted within their quotes</h4>

Given the following input:

```r
my_var <- 1
other_var <- 2
assign("BadName", 1)
```

And using the following [configuration](#configuration): 
```ts
{caseing: 'auto'}
```

We expect the linter to report the following:

* certain at 3.8-3.16: detectedCasing = `CasingConvention.PascalCase`, name = `'BadName'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L214) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_an_32_S3_32_method_32_keeps_32_the_32_name_32_dispatch_32_needs">Test Case: an S3 method keeps the name dispatch needs</h4>

Given the following input:

```r
print.myClass <- function(x, ...) cat("x")
my_var <- 1
other_var <- 2
```

And using the following [configuration](#configuration): 
```ts
{caseing: 'auto'}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L221) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_beside_32_an_32_S3_32_method_32_another_32_name_32_is_32_still_32_checked">Test Case: beside an S3 method another name is still checked</h4>

Given the following input:

```r
print.myClass <- function(x, ...) cat("x")
my_var <- 1
other_var <- 2
anotherVar <- 3
```

And using the following [configuration](#configuration): 
```ts
{caseing: 'auto'}
```

We expect the linter to report the following:

* certain at 4.1-4.10: detectedCasing = `CasingConvention.CamelCase`, name = `'anotherVar'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L222) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_empty_32_string">Test Case: empty string</h4>

Given the following input:

```r

```

And using the following [configuration](#configuration): 
```ts
{caseing: CasingConvention.SnakeCase}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L230) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_empty_32_string_32__40_auto_32_detect_41_">Test Case: empty string (auto detect)</h4>

Given the following input:

```r

```

And using the following [configuration](#configuration): 
```ts
{caseing: 'auto'}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L231) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_ignore_32_leading_32_underscores">Test Case: ignore leading underscores</h4>

Given the following input:

```r
_testVar <- 5
```

And using the following [configuration](#configuration): 
```ts
{caseing: CasingConvention.PascalCase, ignorePrefix: '_'}
```

We expect the linter to report the following:

* certain at 1.1-1.8: name = `'_testVar'`, detectedCasing = `CasingConvention.CamelCase`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-naming-convention.test.ts#L233) for the test-case implementation.