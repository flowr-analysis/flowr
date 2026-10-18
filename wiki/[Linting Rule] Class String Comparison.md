_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-18, 21:25:13 UTC (v2.16.2), do not edit directly._
<h2 id="class-string-comparison">Class String Comparison&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <a href='#cmd-check'>![cmd-check](https://img.shields.io/badge/cmd-check-teal) </a> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

R CMD check: [#37](https://github.com/flowr-analysis/flowr/wiki/Linter#cmd-check-37) 🟩

This rule is a `best-effort` rule.
 
Finds `if`/`while` conditions comparing `class(x)` with a string, which fail for objects with several classes. Offers `inherits(x, ...)` as a quick fix.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/class-string-comparison.ts#L125">src/linter/rules/cmd-check/class-string-comparison.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `class-string-comparison` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/class-string-comparison.ts#L30"><code><span title="also check the conditions of while loops, which R CMD check does not (default true)">checkWhile</span></code></a>\
also check the conditions of `while` loops, which `R CMD check` does not (default `true`)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/cmd-check/class-string-comparison.ts#L32"><code><span title="also flag a comparison with a variable flowR resolves to a string, which R CMD check cannot see (default true)">resolveStrings</span></code></a>\
also flag a comparison with a variable flowR resolves to a string, which `R CMD check` cannot see (default `true`)

### Examples

```r
f <- function(x) if(class(x) == "data.frame") nrow(x) else length(x)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "class-string-comparison",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (4 ms)\
&nbsp;&nbsp;&nbsp;╰ **Class String Comparison** (class-string-comparison):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ class() compared to "data.frame" at 1.21-44 (1 quick fix(es) available)\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "class-string-comparison": {
        "results": [
          {
            "certainty": "certain",
            "involvedId": 8,
            "loc": [1,21,1,44],
            "classes": ["data.frame"],
            "message": "if() condition compares class() to a string, use inherits() instead",
            "quickFix": [{"type":"replace","description":"Replace with `inherits(x, \"data.frame\")`","replacement":"inherits(x, \"data.frame\")","loc":[1,21,1,44]}]
          }
        ],
        ".meta": {"consideredConditions":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts)

<h4 id="Test_32_Case:_32_class_32_compared_32_to_32_a_32_string_32_in_32_if">Test Case: class compared to a string in if</h4>

> the R CMD check case

Given the following input:

```r
f <- function(x) if(class(x) == "foo") 1 else 2
```

We expect the linter to report the following:

* certain: classes = `['foo']`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L11) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_inequality_32_turns_32_into_32_a_32_negated_32_inherits">Test Case: inequality turns into a negated inherits</h4>

Given the following input:

```r
f <- function(x) if(class(x) != "foo") 1
```

We expect the linter to report the following:

* reported: classes = `['foo']`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L14) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_mirrored_32_comparison_32__40_missed_32_by_32_R_32_CMD_32_check_41_">Test Case: mirrored comparison (missed by R CMD check)</h4>

Given the following input:

```r
f <- function(x) if("foo" == class(x)) 1
```

We expect the linter to report the following:

* reported: classes = `['foo']`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_looks_32_through_32_parentheses">Test Case: looks through parentheses</h4>

Given the following input:

```r
f <- function(x) if(((class(x) == "a"))) 1
```

We expect the linter to report the following:

* reported: classes = `['a']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_looks_32_through_32_negation">Test Case: looks through negation</h4>

Given the following input:

```r
f <- function(x) if(!(class(x) == "a")) 1
```

We expect the linter to report the following:

* reported: classes = `['a']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L21) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_looks_32_through_32_logical_32_operators">Test Case: looks through logical operators</h4>

Given the following input:

```r
f <- function(x) if(is.list(x) && class(x) == "a") 1
```

We expect the linter to report the following:

* reported: classes = `['a']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L22) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_reports_32_every_32_comparison_32_of_32_a_32_condition">Test Case: reports every comparison of a condition</h4>

Given the following input:

```r
f <- function(x) if(class(x) == "a" || class(x) == "b") 1
```

We expect the linter to report the following:

* reported: classes = `['a']`
* reported: classes = `['b']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L23) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_else-if_32_chain">Test Case: else-if chain</h4>

Given the following input:

```r
f <- function(x, a) if(a) 1 else if(class(x) == "b") 2
```

We expect the linter to report the following:

* reported: classes = `['b']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_top-level_32_code_32_of_32_a_32_package_32_file">Test Case: top-level code of a package file</h4>

Given the following input:

```r
if(class(x) == "a") print(1)
```

We expect the linter to report the following:

* reported: classes = `['a']`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_complex_32_object_32_keeps_32_its_32_text_32_in_32_the_32_fix">Test Case: complex object keeps its text in the fix</h4>

Given the following input:

```r
f <- function(obj) if(class(obj$a) == "b") 1
```

We expect the linter to report the following:

* reported: 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L28) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_reports_32_the_32_location_32_of_32_the_32_comparison">Test Case: reports the location of the comparison</h4>

Given the following input:

```r
f <- function(x) {
  if(class(x) == "a") 1
}
```

We expect the linter to report the following:

* reported

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L31) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_while_32_condition">Test Case: while condition</h4>

Given the following input:

```r
f <- function(x) while(class(x) == "a") x <- unclass(x)
```

We expect the linter to report the following:

* reported: message = `'while() condition compares class() to a string, use inherits() instead'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L36) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_while_32_condition_44__32_disabled">Test Case: while condition, disabled</h4>

Given the following input:

```r
f <- function(x) while(class(x) == "a") x <- unclass(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L37) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_string_32_resolved_32_through_32_a_32_variable">Test Case: string resolved through a variable</h4>

Given the following input:

```r
cls <- "a"
f <- function(x) if(class(x) == cls) 1
```

We expect the linter to report the following:

* reported: classes = `['a']`, message = `'if() condition compares class() to a string variable, use inherits() instead'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_string_32_resolution_32_disabled">Test Case: string resolution disabled</h4>

Given the following input:

```r
cls <- "a"
f <- function(x) if(class(x) == cls) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L41) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_redefined_32_class_32_function">Test Case: redefined class function</h4>

Given the following input:

```r
class <- function(x) "a"
f <- function(x) if(class(x) == "a") 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L45) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_comparison_32_outside_32_a_32_condition">Test Case: comparison outside a condition</h4>

Given the following input:

```r
f <- function(x) class(x) == "a"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_comparing_32_two_32_classes">Test Case: comparing two classes</h4>

Given the following input:

```r
f <- function(x, y) if(class(x) == class(y)) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_first_32_class_32_only">Test Case: first class only</h4>

Given the following input:

```r
f <- function(x) if(class(x)[1] == "a") 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L48) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_inherits_32_is_32_fine">Test Case: inherits is fine</h4>

Given the following input:

```r
f <- function(x) if(inherits(x, "a")) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L49) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_membership_32_test_32_is_32_not_32_reported">Test Case: membership test is not reported</h4>

Given the following input:

```r
f <- function(x) if("a" %in% class(x)) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_arithmetic_32_on_32_a_32_class_32_comparison_32_is_32_no_32_condition_32_of_32_its_32_own">Test Case: arithmetic on a class comparison is no condition of its own</h4>

Given the following input:

```r
f <- function(x) if(sum(class(x) == "a") > 0) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unresolvable_32_variable">Test Case: unresolvable variable</h4>

Given the following input:

```r
f <- function(x, cls) if(class(x) == cls) 1
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L52) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_test_32_code_32_is_32_no_32_package_32_code">Test Case: test code is no package code</h4>

Given the following input:

```r
if(class(x) == "a") print(1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L53) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_inst_32_code_32_is_32_no_32_package_32_code">Test Case: inst code is no package code</h4>

Given the following input:

```r
if(class(x) == "a") print(1)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/cmd-check/lint-class-string-comparison.test.ts#L54) for the test-case implementation.