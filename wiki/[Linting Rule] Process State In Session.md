_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-11-01, 18:30:05 UTC (v2.16.8), do not edit directly._
<h2 id="process-state-in-session">Process State in Session&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#security'>![security](https://img.shields.io/badge/security-teal) </a></span> <span title="This rule is used to detect issues that are related to the shiny framework."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#shiny'>![shiny](https://img.shields.io/badge/shiny-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds per-session Shiny code changing state all sessions share: globals, options, environment variables, the working directory, namespaces, top-level reactive values, shared caches (memoise, bindCache, cachem) whose key misses session values, and resource paths.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/process-state-in-session.ts#L332">src/linter/rules/process-state-in-session.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `process-state-in-session` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/process-state-in-session.ts#L63"><code><span title="cache constructors">caches</span></code></a>\
cache constructors
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/process-state-in-session.ts#L65"><code><span title="memoisers">memoisers</span></code></a>\
memoisers
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/process-state-in-session.ts#L57"><code><span title="parameter lists marking a session function (Shiny server or module), all of one must be present">sessionSignatures</span></code></a>\
parameter lists marking a session function (Shiny server or module), all of one must be present
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/process-state-in-session.ts#L59"><code><span title="process-wide setters, with what to use instead">settings</span></code></a>\
process-wide setters, with what to use instead
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/process-state-in-session.ts#L61"><code><span title="functions creating state, shared when called at the top level">sharedState</span></code></a>\
functions creating state, shared when called at the top level

### Examples

```r

counter <- reactiveVal(0)
addResourcePath("data", "/srv/data")
server <- function(input, output, session) {
  user <<- input$name
  options(digits = input$digits)
  counter(counter() + 1)
  output$plot <- renderPlot(plot(load_for(session$user, input$n))) |> bindCache(input$n)
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "process-state-in-session",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (6 ms)\
&nbsp;&nbsp;&nbsp;╰ **Process State in Session** (process-state-in-session):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ resource-path by addResourcePath at 3.1-36\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ global-superassignment by user at 5.3-21\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ process-setting by options at 6.3-32\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ shared-state by counter at 7.3-24\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ cache-key by bindCache at 8.71-88

More examples are the test cases in [test/functionality/linter/lint-process-state-in-session.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-process-state-in-session.test.ts).