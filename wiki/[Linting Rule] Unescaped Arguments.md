_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-24, 20:38:50 UTC (v2.16.6), do not edit directly._
<h2 id="unescaped-arguments">Unescaped Arguments&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-brightgreen) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#security'>![security](https://img.shields.io/badge/security-teal) </a></span> <span title="This rule is used to detect issues that are related to the shiny framework."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#shiny'>![shiny](https://img.shields.io/badge/shiny-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds arguments of critical system, evaluation, database, and HTML/JavaScript calls that are not properly escaped.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L427">src/linter/rules/unescaped-arguments.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `unescaped-arguments` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L139"><code><span title="The input types that count as already escaped">acceptedInputs</span></code></a>\
The input types that count as already escaped
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L129"><code><span title="The target, critical functions, critical arguments, sanitizers and quick fixes for each category">categories</span></code></a>\
The target, critical functions, critical arguments, sanitizers and quick fixes for each category
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L134"><code><span title="The categories that should be disabled and not checked">disabledCategories</span></code></a>\
The categories that should be disabled and not checked
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/unescaped-arguments.ts#L143"><code><span title="The maximum depth to descent to find unescaped parts of an argument">maxDecentDepth</span></code></a>\
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

Query: **linter** (11 ms)\
&nbsp;&nbsp;&nbsp;╰ **Unescaped Arguments** (unescaped-arguments):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Unescaped system argument of `system` at 2.9-26 (1 quick fix(es) available)

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-unescaped-arguments.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts)

<h4 id="Test_32_Case:_32_unknown_32_command">Test Case: unknown command</h4>

Given the following input:

```r
system(x)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown]}]`, input = `[InputType.Unknown]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L37) for the test-case implementation.

<h4 id="Test_32_Case:_32_system2_32_hands_32_its_32_arguments_32_to_32_a_32_shell">Test Case: system2 hands its arguments to a shell</h4>

Given the following input:

```r
f <- function(d) system2("ls", d)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system2'`, sources = `[{id: 6, trace: InputTraceType.Pure, types: [InputType.Parameter]}]`, input = `[InputType.Parameter]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L52) for the test-case implementation.

<h4 id="Test_32_Case:_32_do.call_32_with_32_a_32_function_32_name_32_from_32_a_32_parameter">Test Case: do.call with a function name from a parameter</h4>

Given the following input:

```r
f <- function(fn) do.call(fn, list(1))
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.Eval`, function = `'do.call'`, sources = `[{id: 4, trace: InputTraceType.Unknown, types: [InputType.Parameter]}]`, input = `[InputType.Parameter]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L62) for the test-case implementation.

<h4 id="Test_32_Case:_32_pasted_32_parameter">Test Case: pasted parameter</h4>

Given the following input:

```r
f <- function(dir) system(paste0("ls ", dir))
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 7, trace: InputTraceType.Pure, types: [InputType.Parameter]}]`, input = `[InputType.Parameter]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L70) for the test-case implementation.

<h4 id="Test_32_Case:_32_pasted_32_parameter_32_with_32_a_32_constant_32_and_32_an_32_unknown_32_call">Test Case: pasted parameter with a constant and an unknown call</h4>

Given the following input:

```r
f <- function(dir) system(paste0("ls ", dir))
f("ls")
f(x)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 7, trace: InputTraceType.Alias, types: [InputType.Constant, InputType.Scope, InputType.Parameter]}]`, input = `[InputType.Scope, InputType.Parameter]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L84) for the test-case implementation.

<h4 id="Test_32_Case:_32_partly_32_escaped_32_command">Test Case: partly escaped command</h4>

Given the following input:

```r
f <- function(a, b) system(paste0("cp ", shQuote(a), " ", b))
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 16, trace: InputTraceType.Pure, types: [InputType.Parameter]}]`, input = `[InputType.Parameter]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L99) for the test-case implementation.

<h4 id="Test_32_Case:_32_user_32_input_32_as_32_command">Test Case: user input as command</h4>

Given the following input:

```r
shinyServer('system(input$cmd)')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.System`, function = `'system'`, sources = `[{id: 15, trace: InputTraceType.Unknown, types: [InputType.User], name: 'cmd'}]`, input = `[InputType.User]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L113) for the test-case implementation.

<h4 id="Test_32_Case:_32_unknown_32_arguments">Test Case: unknown arguments</h4>

Given the following input:

```r
system2("ls", args = x)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.System`, function = `'system2'`, sources = `[{id: 4, trace: InputTraceType.Unknown, types: [InputType.Unknown], name: 'args'}]`, input = `[InputType.Unknown]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L127) for the test-case implementation.

<h4 id="Test_32_Case:_32_constant_32_code_32_built_32_from_32_a_32_quoted_32_expression">Test Case: constant code built from a quoted expression</h4>

> the code is the one the program spells out, a language object is no input by itself

Given the following input:

```r
code <- deparse(quote(1 + 2))
code <- gsub("2", "3", code)
eval(parse(text = code))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L157) for the test-case implementation.

<h4 id="Test_32_Case:_32_a_32_captured_32_argument_32_is_32_code_32_of_32_the_32_caller">Test Case: a captured argument is code of the caller</h4>

Given the following input:

```r
f <- function(x) { e <- substitute(x); eval(e) }
f(y)
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.Eval`, function = `'eval'`, sources = `[{id: 12, types: [InputType.Lang], trace: InputTraceType.Alias}]`, input = `[InputType.Lang]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L159) for the test-case implementation.

<h4 id="Test_32_Case:_32_symbol_32_lookup_32_of_32_a_32_parameter">Test Case: symbol lookup of a parameter</h4>

Given the following input:

```r
f <- function(n) get(n)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.Eval`, function = `'get'`, sources = `[{id: 4, trace: InputTraceType.Pure, types: [InputType.Parameter]}]`, input = `[InputType.Parameter]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L175) for the test-case implementation.

<h4 id="Test_32_Case:_32_symbol_32_lookup_32_of_32_user_32_input">Test Case: symbol lookup of user input</h4>

Given the following input:

```r
shinyServer('get(input$n)')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.Eval`, function = `'get'`, sources = `[{id: 15, trace: InputTraceType.Unknown, types: [InputType.User], name: 'n'}]`, input = `[InputType.User]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L183) for the test-case implementation.

<h4 id="Test_32_Case:_32_unknown_32_evaluation">Test Case: unknown evaluation</h4>

Given the following input:

```r
eval(parse(text = x))
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.Eval`, function = `'eval'`, sources = `[{id: 3, trace: InputTraceType.Unknown, types: [InputType.Unknown], name: 'text'}]`, input = `[InputType.Unknown]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L191) for the test-case implementation.

<h4 id="Test_32_Case:_32_pasted_32_user_32_input">Test Case: pasted user input</h4>

Given the following input:

```r
shinyServer('dbGetQuery(con, paste0("SELECT * FROM t WHERE x = \'", input$x, "\'"))')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.Database`, function = `'dbGetQuery'`, sources = `[{id: 20, trace: InputTraceType.Unknown, types: [InputType.User], name: 'x'}]`, input = `[InputType.User]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L206) for the test-case implementation.

<h4 id="Test_32_Case:_32_statement_32_built_32_elsewhere">Test Case: statement built elsewhere</h4>

Given the following input:

```r
q <- paste0("SELECT * FROM t WHERE x = ", user)
dbGetQuery(con, q)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.Database`, function = `'dbGetQuery'`, sources = `[{id: 11, trace: InputTraceType.Alias, types: [InputType.Constant, InputType.Unknown, InputType.DerivedConstant]}]`, input = `[InputType.Unknown]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L221) for the test-case implementation.

<h4 id="Test_32_Case:_32_pasted_32_user_32_input">Test Case: pasted user input</h4>

Given the following input:

```r
shinyServer('HTML(paste0("<b>", input$name, "</b>"))')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.Html`, function = `'HTML'`, sources = `[{id: 18, trace: InputTraceType.Unknown, types: [InputType.User], name: 'name'}]`, input = `[InputType.User]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L235) for the test-case implementation.

<h4 id="Test_32_Case:_32_pasted_32_user_32_input">Test Case: pasted user input</h4>

Given the following input:

```r
shinyServer('shinyjs::runjs(paste0("alert(\'", input$name, "\')"))')
```

We expect the linter to report the following:

* certain: category = `UnescapedArgumentCategory.JavaScript`, function = `'shinyjs::runjs'`, sources = `[{id: 18, trace: InputTraceType.Unknown, types: [InputType.User], name: 'name'}]`, input = `[InputType.User]`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L255) for the test-case implementation.

<h4 id="Test_32_Case:_32_unknown_32_code">Test Case: unknown code</h4>

Given the following input:

```r
shinyjs::runjs(x)
```

We expect the linter to report the following:

* uncertain: category = `UnescapedArgumentCategory.JavaScript`, function = `'shinyjs::runjs'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown]}]`, input = `[InputType.Unknown]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-unescaped-arguments.test.ts#L270) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**constant command**

```r
system("ls")
```

**escaped command**

```r
system(shQuote(x))
```

**processx passes its arguments without a shell**

```r
f <- function(d) processx::run("ls", d)
```

**do.call with a constant function name**

```r
t <- lapply(1:3, function(i) data.frame(a = i))
do.call("rbind", t)
```

**pasted escaped parameter**

```r
f <- function(dir) system(paste0("ls ", shQuote(dir)))
```

**redefined function**

```r
system <- function(command) invisible(command)
system(x)
```

**a temporary path**

```r
system(paste("cat", tempfile()))
```

**a number carries nothing to inject**

```r
x <- readline()
system(paste("head -n", as.integer(x)))
```

**constant evaluation**

```r
eval(parse(text = "1+1"))
```

**constant quoted expression**

```r
eval(quote(1 + 2))
```

**bounded evaluation**

```r
eval(parse(text = match.arg(x, c("a", "b"))))
```

**a count of file content carries nothing to inject**

```r
eval(parse(text = length(readLines("a"))))
```

**constant code parsed from a string**

```r
eval(str2lang("1+2"))
```

**constant symbol lookup**

```r
get("x")
```

**constant symbol lookup of a known variable**

```r
x <- 2
get("x")
```

**constant symbol lookup with a folded name**

```r
i <- "x"
get(i)
```

**constant symbol tests**

```r
exists("x")
mget(c("a", "b"))
match.fun("sum")
```

**constant statement**

```r
dbGetQuery(con, "SELECT * FROM t")
```

**interpolated statement**

```r
shinyServer('dbGetQuery(con, DBI::sqlInterpolate(con, "SELECT * FROM t WHERE x = ?x", x = input$x))')
```

**constant value**

```r
shinyServer('HTML("<b>hi</b>")')
```

**escaped user input**

```r
shinyServer('HTML(htmltools::htmlEscape(input$name))')
```

**constant code**

```r
shinyServer('shinyjs::runjs("alert(1)")')
```

**serialized user input**

```r
shinyServer('shinyjs::runjs(paste0("alert(", jsonlite::toJSON(input$name), ")"))')
```