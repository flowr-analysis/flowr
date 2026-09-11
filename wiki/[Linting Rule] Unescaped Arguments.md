_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-09-10, 07:04:46 UTC (v2.15.8), do not edit directly._
<h2 id="unescaped-arguments">Unescaped Arguments&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the shiny framework."><a href='#shiny'>![shiny](https://img.shields.io/badge/shiny-teal) </a></span>

This rule is a `best-effort` rule.
 
Detects arguments of critical system, evaluation, database, and HTML/JavaScript calls that are not properly escaped.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L378">src/linter/rules/unescaped-arguments.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unescaped-arguments` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L126"><code><span title="The input types that count as already escaped">acceptedInputs</span></code></a>\
The input types that count as already escaped
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L116"><code><span title="The target, critical functions, critical arguments, sanitizers and quick fixes for each category">categories</span></code></a>\
The target, critical functions, critical arguments, sanitizers and quick fixes for each category
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L121"><code><span title="The categories that should be disabled and not checked">disabledCategories</span></code></a>\
The categories that should be disabled and not checked
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L130"><code><span title="The maximum depth to descent to find unescaped parts of an argument">maxDecentDepth</span></code></a>\
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

Query: **linter** (9 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unescaped Arguments** (unescaped-arguments):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Unescaped system argument of `system` at 2.9-26 (1 quick fix(es) available)\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

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
            "involvedId": [12,10],
            "loc": [2,9,2,26],
            "category": "system",
            "function": "system",
            "sources": [{"id":8,"types":["param"],"trace":"pure"}],
            "input": ["param"],
            "quickFix": [{"type":"replace","loc":[2,23,2,25],"description":"Escape the value with `shQuote`","replacement":"shQuote(dir)"}]
          }
        ],
        ".meta": {"totalCriticalArguments":1,"totalEscapedArguments":0}
      }
    },
    ".meta": {}
  },
  ".meta": {}
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

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L16) for the test-case implementation.
		
<h4 id="Test_Case:_escaped_command">Test Case: escaped command</h4>

Given the following input:

```r
system(shQuote(x))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L17) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_command">Test Case: unknown command</h4>

Given the following input:

```r
system(x)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown]}]`, input = `[InputType.Unknown]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_parameter">Test Case: pasted parameter</h4>

Given the following input:

```r
f <- function(dir) system(paste0("ls ", dir))
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 7, trace: InputTraceType.Pure, types: [InputType.Parameter]}]`, input = `[InputType.Parameter]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_parameter_with_a_constant_and_an_unknown_call">Test Case: pasted parameter with a constant and an unknown call</h4>

Given the following input:

```r
f <- function(dir) system(paste0("ls ", dir))
f("ls")
f(x)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 7, trace: InputTraceType.Alias, types: [InputType.Constant, InputType.Scope, InputType.Parameter]}]`, input = `[InputType.Scope, InputType.Parameter]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L46) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_escaped_parameter">Test Case: pasted escaped parameter</h4>

Given the following input:

```r
f <- function(dir) system(paste0("ls ", shQuote(dir)))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L60) for the test-case implementation.
		
<h4 id="Test_Case:_partly_escaped_command">Test Case: partly escaped command</h4>

Given the following input:

```r
f <- function(a, b) system(paste0("cp ", shQuote(a), " ", b))
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 16, trace: InputTraceType.Pure, types: [InputType.Parameter]}]`, input = `[InputType.Parameter]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L61) for the test-case implementation.
		
<h4 id="Test_Case:_user_input_as_command">Test Case: user input as command</h4>

Given the following input:

```r
shinyServer('system(input$cmd)')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 15, trace: InputTraceType.Unknown, types: [InputType.User], name: 'cmd'}]`, input = `[InputType.User]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L75) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_arguments">Test Case: unknown arguments</h4>

Given the following input:

```r
system2("ls", args = x)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system2'`, sources = `[{id: 4, trace: InputTraceType.Unknown, types: [InputType.Unknown], name: 'args'}]`, input = `[InputType.Unknown]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L89) for the test-case implementation.
		
<h4 id="Test_Case:_redefined_function">Test Case: redefined function</h4>

Given the following input:

```r
system <- function(command) invisible(command)
system(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L103) for the test-case implementation.
		
<h4 id="Test_Case:_constant_evaluation">Test Case: constant evaluation</h4>

Given the following input:

```r
eval(parse(text = "1+1"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L107) for the test-case implementation.
		
<h4 id="Test_Case:_bounded_evaluation">Test Case: bounded evaluation</h4>

Given the following input:

```r
eval(parse(text = match.arg(x, c("a", "b"))))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L108) for the test-case implementation.
		
<h4 id="Test_Case:_constant_symbol_lookup">Test Case: constant symbol lookup</h4>

Given the following input:

```r
get("x")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L109) for the test-case implementation.
		
<h4 id="Test_Case:_constant_symbol_lookup_of_a_known_variable">Test Case: constant symbol lookup of a known variable</h4>

Given the following input:

```r
x <- 2
get("x")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L110) for the test-case implementation.
		
<h4 id="Test_Case:_constant_symbol_lookup_with_a_folded_name">Test Case: constant symbol lookup with a folded name</h4>

Given the following input:

```r
i <- "x"
get(i)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L111) for the test-case implementation.
		
<h4 id="Test_Case:_constant_symbol_tests">Test Case: constant symbol tests</h4>

Given the following input:

```r
exists("x")
mget(c("a", "b"))
match.fun("sum")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L112) for the test-case implementation.
		
<h4 id="Test_Case:_symbol_lookup_of_a_parameter">Test Case: symbol lookup of a parameter</h4>

Given the following input:

```r
f <- function(n) get(n)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.Eval`, function = `'get'`, sources = `[{id: 4, trace: InputTraceType.Pure, types: [InputType.Parameter]}]`, input = `[InputType.Parameter]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L113) for the test-case implementation.
		
<h4 id="Test_Case:_symbol_lookup_of_user_input">Test Case: symbol lookup of user input</h4>

Given the following input:

```r
shinyServer('get(input$n)')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.Eval`, function = `'get'`, sources = `[{id: 15, trace: InputTraceType.Unknown, types: [InputType.User], name: 'n'}]`, input = `[InputType.User]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L121) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_evaluation">Test Case: unknown evaluation</h4>

Given the following input:

```r
eval(parse(text = x))
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.Eval`, function = `'eval'`, sources = `[{id: 3, trace: InputTraceType.Unknown, types: [InputType.Unknown], name: 'text'}]`, input = `[InputType.Unknown]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L129) for the test-case implementation.
		
<h4 id="Test_Case:_constant_statement">Test Case: constant statement</h4>

Given the following input:

```r
dbGetQuery(con, "SELECT * FROM t")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L140) for the test-case implementation.
		
<h4 id="Test_Case:_interpolated_statement">Test Case: interpolated statement</h4>

Given the following input:

```r
shinyServer('dbGetQuery(con, DBI::sqlInterpolate(con, "SELECT * FROM t WHERE x = ?x", x = input$x))')
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L141) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_user_input">Test Case: pasted user input</h4>

Given the following input:

```r
shinyServer('dbGetQuery(con, paste0("SELECT * FROM t WHERE x = \'", input$x, "\'"))')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.Database`, function = `'dbGetQuery'`, sources = `[{id: 20, trace: InputTraceType.Unknown, types: [InputType.User], name: 'x'}]`, input = `[InputType.User]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L143) for the test-case implementation.
		
<h4 id="Test_Case:_statement_built_elsewhere">Test Case: statement built elsewhere</h4>

Given the following input:

```r
q <- paste0("SELECT * FROM t WHERE x = ", user)
dbGetQuery(con, q)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.Database`, function = `'dbGetQuery'`, sources = `[{id: 11, trace: InputTraceType.Alias, types: [InputType.Constant, InputType.Unknown, InputType.DerivedConstant]}]`, input = `[InputType.Unknown]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L158) for the test-case implementation.
		
<h4 id="Test_Case:_constant_value">Test Case: constant value</h4>

Given the following input:

```r
shinyServer('HTML("<b>hi</b>")')
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L170) for the test-case implementation.
		
<h4 id="Test_Case:_escaped_user_input">Test Case: escaped user input</h4>

Given the following input:

```r
shinyServer('HTML(htmltools::htmlEscape(input$name))')
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L171) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_user_input">Test Case: pasted user input</h4>

Given the following input:

```r
shinyServer('HTML(paste0("<b>", input$name, "</b>"))')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.Html`, function = `'HTML'`, sources = `[{id: 18, trace: InputTraceType.Unknown, types: [InputType.User], name: 'name'}]`, input = `[InputType.User]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L172) for the test-case implementation.
		
<h4 id="Test_Case:_constant_code">Test Case: constant code</h4>

Given the following input:

```r
shinyServer('shinyjs::runjs("alert(1)")')
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L189) for the test-case implementation.
		
<h4 id="Test_Case:_serialized_user_input">Test Case: serialized user input</h4>

Given the following input:

```r
shinyServer('shinyjs::runjs(paste0("alert(", jsonlite::toJSON(input$name), ")"))')
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L190) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_user_input">Test Case: pasted user input</h4>

Given the following input:

```r
shinyServer('shinyjs::runjs(paste0("alert(\'", input$name, "\')"))')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.JavaScript`, function = `'shinyjs::runjs'`, sources = `[{id: 18, trace: InputTraceType.Unknown, types: [InputType.User], name: 'name'}]`, input = `[InputType.User]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L192) for the test-case implementation.
		
<h4 id="Test_Case:_unknown_code">Test Case: unknown code</h4>

Given the following input:

```r
shinyjs::runjs(x)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.JavaScript`, function = `'shinyjs::runjs'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown]}]`, input = `[InputType.Unknown]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L207) for the test-case implementation.