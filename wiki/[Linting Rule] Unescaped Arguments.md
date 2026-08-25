_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-08-25, 08:35:40 UTC (v2.14.4), please do not edit directly._
<h2 id="unescaped-arguments">Unescaped Arguments&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the shiny framework."><a href='#shiny'>![shiny](https://img.shields.io/badge/shiny-teal) </a></span>


This rule is a `best-effort` rule.
 
Detects arguments of critical system, evaluation, database, and HTML/JavaScript calls that are not properly escaped.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L334">src/linter/rules/unescaped-arguments.ts</a>._


### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unescaped-arguments` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L121"><code><span title="The input types that count as already escaped">acceptedInputs</span></code></a>\
The input types that count as already escaped
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L111"><code><span title="The target, critical functions, critical arguments, sanitizers and quick fixes for each category">categories</span></code></a>\
The target, critical functions, critical arguments, sanitizers and quick fixes for each category
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L116"><code><span title="The categories that should be disabled and not checked">disabledCategories</span></code></a>\
The categories that should be disabled and not checked
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L125"><code><span title="The maximum depth to descent to find unescaped parts of an argument">maxDecentDepth</span></code></a>\
The maximum depth to descent to find unescaped parts of an argument

### Examples


```r
function(dir) {
	system(paste0("ls ", dir))
}
```


The linting query can be used to run this rule on the above example:




```json
[ { "type": "linter",   "rules": [ { "name": "unescaped-arguments",     "config": {} } ] } ]
```






_Results (prettified and summarized):_

Query: **linter** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unescaped Arguments** (unescaped-arguments):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Unescaped system argument of `system` at 2.9-26 (1 quick fix(es) available)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: totalCriticalArguments: 1, totalEscapedArguments: 0, searchTimeMs: 1, processTimeMs: 4\
_All queries together required ≈6 ms (1ms accuracy, total 6 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _6.1 ms_ (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.




```json
{
  "linter": {
    "results": {
      "unescaped-arguments": {
        "results": [
          {
            "certainty": "uncertain",
            "involvedId": [
              12,
              10
            ],
            "loc": [
              2,
              9,
              2,
              26
            ],
            "category": "system",
            "function": "system",
            "sources": [
              {
                "id": 8,
                "types": [
                  "param"
                ],
                "trace": "pure"
              }
            ],
            "input": [
              "param"
            ],
            "quickFix": [
              {
                "type": "replace",
                "loc": [
                  2,
                  23,
                  2,
                  25
                ],
                "description": "Escape the value with `shQuote`",
                "replacement": "shQuote(dir)"
              }
            ]
          }
        ],
        ".meta": {
          "totalCriticalArguments": 1,
          "totalEscapedArguments": 0,
          "searchTimeMs": 1,
          "processTimeMs": 4
        }
      }
    },
    ".meta": {
      "timing": 6
    }
  },
  ".meta": {
    "timing": 6
  }
}
```



</details>





	

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-unescaped-arguments.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts)


<h4 id="Test_Case:_constant_command">Test Case: constant command</h4>


Given the following input:

```r
system("ls")
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L16) for the test-case implementation.
		
<h4 id="Test_Case:_escaped_command">Test Case: escaped command</h4>


Given the following input:

```r
system(shQuote(x))
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_command">Test Case: unknown command</h4>


Given the following input:

```r
system(x)
```



We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Uncertain,
category:  UnescapedArgumentCategory.System,
function:  'system',
loc:       SourceRange.from(1, 8, 1, 8),
sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }],
input:     [InputType.Unknown],
quickFix:  [{
	type:        'replace',
	loc:         SourceRange.from(1, 8, 1, 8),
	description: 'Escape the value with `shQuote`',
	replacement: 'shQuote(x)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_parameter">Test Case: pasted parameter</h4>


Given the following input:

```r
f <- function(dir) system(paste0("ls ", dir))
```



We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Uncertain,
category:  UnescapedArgumentCategory.System,
function:  'system',
loc:       SourceRange.from(1, 27, 1, 44),
sources:   [{ id: 7, trace: InputTraceType.Pure, types: [InputType.Parameter] }],
input:     [InputType.Parameter],
quickFix:  [{
	type:        'replace',
	loc:         SourceRange.from(1, 41, 1, 43),
	description: 'Escape the value with `shQuote`',
	replacement: 'shQuote(dir)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_escaped_parameter">Test Case: pasted escaped parameter</h4>


Given the following input:

```r
f <- function(dir) system(paste0("ls ", shQuote(dir)))
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_Case:_partly_escaped_command">Test Case: partly escaped command</h4>


Given the following input:

```r
f <- function(a, b) system(paste0("cp ", shQuote(a), " ", b))
```



We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Uncertain,
category:  UnescapedArgumentCategory.System,
function:  'system',
loc:       SourceRange.from(1, 28, 1, 60),
sources:   [{ id: 16, trace: InputTraceType.Pure, types: [InputType.Parameter] }],
input:     [InputType.Parameter],
quickFix:  [{
	type:        'replace',
	loc:         SourceRange.from(1, 59, 1, 59),
	description: 'Escape the value with `shQuote`',
	replacement: 'shQuote(b)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L47) for the test-case implementation.
		
<h4 id="Test_Case:_user_input_as_command">Test Case: user input as command</h4>


Given the following input:

```r
shinyServer('system(input$cmd)')
```



We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Certain,
category:  UnescapedArgumentCategory.System,
function:  'system',
loc:       SourceRange.from(3, 9, 3, 17),
sources:   [{ id: 15, trace: InputTraceType.Unknown, types: [InputType.User], name: 'cmd' }],
input:     [InputType.User],
quickFix:  [{
	type:        'replace',
	loc:         SourceRange.from(3, 9, 3, 17),
	description: 'Escape the value with `shQuote`',
	replacement: 'shQuote(input$cmd)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L61) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_arguments">Test Case: unknown arguments</h4>


Given the following input:

```r
system2("ls", args = x)
```



We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Uncertain,
category:  UnescapedArgumentCategory.System,
function:  'system2',
loc:       SourceRange.from(1, 22, 1, 22),
sources:   [{ id: 4, trace: InputTraceType.Unknown, types: [InputType.Unknown], name: 'args' }],
input:     [InputType.Unknown],
quickFix:  [{
	type:        'replace',
	loc:         SourceRange.from(1, 22, 1, 22),
	description: 'Escape the value with `shQuote`',
	replacement: 'shQuote(x)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L75) for the test-case implementation.
		
<h4 id="Test_Case:_redefined_function">Test Case: redefined function</h4>


Given the following input:

```r
system <- function(command) invisible(command)
system(x)
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L89) for the test-case implementation.
		
<h4 id="Test_Case:_constant_evaluation">Test Case: constant evaluation</h4>


Given the following input:

```r
eval(parse(text = "1+1"))
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L93) for the test-case implementation.
		
<h4 id="Test_Case:_bounded_evaluation">Test Case: bounded evaluation</h4>


Given the following input:

```r
eval(parse(text = match.arg(x, c("a", "b"))))
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L94) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_evaluation">Test Case: unknown evaluation</h4>


Given the following input:

```r
eval(parse(text = x))
```



We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Uncertain,
category:  UnescapedArgumentCategory.Eval,
function:  'eval',
loc:       SourceRange.from(1, 6, 1, 20),
sources:   [{ id: 3, trace: InputTraceType.Unknown, types: [InputType.Unknown], name: 'text' }],
input:     [InputType.Unknown]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L95) for the test-case implementation.
		
<h4 id="Test_Case:_constant_statement">Test Case: constant statement</h4>


Given the following input:

```r
dbGetQuery(con, "SELECT * FROM t")
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L106) for the test-case implementation.
		
<h4 id="Test_Case:_interpolated_statement">Test Case: interpolated statement</h4>


Given the following input:

```r
shinyServer('dbGetQuery(con, DBI::sqlInterpolate(con, "SELECT * FROM t WHERE x = ?x", x = input$x))')
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L107) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_user_input">Test Case: pasted user input</h4>


Given the following input:

```r
shinyServer('dbGetQuery(con, paste0("SELECT * FROM t WHERE x = \'", input$x, "\'"))')
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
category:  UnescapedArgumentCategory.Database,
function:  'dbGetQuery',
loc:       SourceRange.from(3, 18, 3, 68),
sources:   [{ id: 20, trace: InputTraceType.Unknown, types: [InputType.User], name: 'x' }],
input:     [InputType.User],
quickFix:  [{
	type:        'replace',
	loc:         SourceRange.from(3, 56, 3, 62),
	description: 'Escape the value with `DBI::dbQuoteLiteral`',
	replacement: 'DBI::dbQuoteLiteral(con, input$x)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L109) for the test-case implementation.
		
<h4 id="Test_Case:_statement_built_elsewhere">Test Case: statement built elsewhere</h4>


Given the following input:

```r
q <- paste0("SELECT * FROM t WHERE x = ", user)
dbGetQuery(con, q)
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Uncertain,
category:  UnescapedArgumentCategory.Database,
function:  'dbGetQuery',
loc:       SourceRange.from(2, 17, 2, 17),
sources:   [{ id: 11, trace: InputTraceType.Alias, types: [InputType.Constant, InputType.Unknown, InputType.DerivedConstant] }],
input:     [InputType.Unknown]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L124) for the test-case implementation.
		
<h4 id="Test_Case:_constant_value">Test Case: constant value</h4>


Given the following input:

```r
shinyServer('HTML("<b>hi</b>")')
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L136) for the test-case implementation.
		
<h4 id="Test_Case:_escaped_user_input">Test Case: escaped user input</h4>


Given the following input:

```r
shinyServer('HTML(htmltools::htmlEscape(input$name))')
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L137) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_user_input">Test Case: pasted user input</h4>


Given the following input:

```r
shinyServer('HTML(paste0("<b>", input$name, "</b>"))')
```



We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Certain,
category:  UnescapedArgumentCategory.Html,
function:  'HTML',
loc:       SourceRange.from(3, 7, 3, 39),
sources:   [{ id: 18, trace: InputTraceType.Unknown, types: [InputType.User], name: 'name' }],
input:     [InputType.User],
quickFix:  [{
	type:        'replace',
	loc:         SourceRange.from(3, 21, 3, 30),
	description: 'Escape the value with `htmltools::htmlEscape`',
	replacement: 'htmltools::htmlEscape(input$name)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L138) for the test-case implementation.
		
<h4 id="Test_Case:_constant_code">Test Case: constant code</h4>


Given the following input:

```r
shinyServer('shinyjs::runjs("alert(1)")')
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L155) for the test-case implementation.
		
<h4 id="Test_Case:_serialized_user_input">Test Case: serialized user input</h4>


Given the following input:

```r
shinyServer('shinyjs::runjs(paste0("alert(", jsonlite::toJSON(input$name), ")"))')
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L156) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_user_input">Test Case: pasted user input</h4>


Given the following input:

```r
shinyServer('shinyjs::runjs(paste0("alert(\'", input$name, "\')"))')
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
category:  UnescapedArgumentCategory.JavaScript,
function:  'shinyjs::runjs',
loc:       SourceRange.from(3, 17, 3, 51),
sources:   [{ id: 18, trace: InputTraceType.Unknown, types: [InputType.User], name: 'name' }],
input:     [InputType.User],
quickFix:  [{
	type:        'replace',
	loc:         SourceRange.from(3, 35, 3, 44),
	description: 'Escape the value with `jsonlite::toJSON`',
	replacement: 'jsonlite::toJSON(input$name)'
}]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L158) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_code">Test Case: unknown code</h4>


Given the following input:

```r
shinyjs::runjs(x)
```



We expect the linter to report the following:

```ts
			certainty: LintingResultCertainty.Uncertain,
category:  UnescapedArgumentCategory.JavaScript,
function:  'shinyjs::runjs',
loc:       SourceRange.from(1, 16, 1, 16),
sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }],
input:     [InputType.Unknown]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L173) for the test-case implementation.