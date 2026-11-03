_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-11-01, 18:30:05 UTC (v2.16.8), do not edit directly._
<h2 id="secret-exfiltration">Secret Exfiltration&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#security'>![security](https://img.shields.io/badge/security-teal) </a></span> <span title="This rule is used to detect issues that are related to the shiny framework."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#shiny'>![shiny](https://img.shields.io/badge/shiny-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds secrets (environment, keyrings, config, credential files) sent to untrusted hosts, the browser, or logs, and optionally into urls, files, other processes, or language models.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L192">src/linter/rules/secret-exfiltration.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `secret-exfiltration` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L78"><code><span title="input types that make a destination untrusted, including files (see fileTrust for what they hold)">controlledInputs</span></code></a>\
input types that make a destination untrusted, including files (see `fileTrust` for what they hold)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L66"><code><span title="environment variable names that hold credentials (case-insensitive)">credentialNamePattern</span></code></a>\
environment variable names that hold credentials (case-insensitive)
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L68"><code><span title="literals that are credentials, as in no-leaked-credentials">credentialValuePattern</span></code></a>\
literals that are credentials, as in `no-leaked-credentials`
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L72"><code><span title="extra functions whose result is never secret">declassifiers</span></code></a>\
extra functions whose result is never secret
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L80"><code><span title="how far the content of files is trusted not to hold secrets; untrusted content gives uncertain results">fileTrust</span></code></a>\
how far the content of files is trusted not to hold secrets; untrusted content gives uncertain results
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L76"><code><span title="low-severity leaks to report">optIn</span></code></a>\
low-severity leaks to report
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L82"><code><span title="paths of files holding secrets, in addition to credential files like .Renviron">secretFiles</span></code></a>\
paths of files holding secrets, in addition to credential files like `.Renviron`
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L74"><code><span title="where secrets leave the process">sinks</span></code></a>\
where secrets leave the process
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L70"><code><span title="extra functions returning secrets">sources</span></code></a>\
extra functions returning secrets
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/secret-exfiltration.ts#L84"><code><span title="paths of files trusted to hold no secrets, an empty pattern trusts none">trustedFiles</span></code></a>\
paths of files trusted to hold no secrets, an empty pattern trusts none

### Examples

```r

key <- Sys.getenv("API_KEY")
server <- function(input, output, session) {
  httr2::request("https://api.example.org") |>
    httr2::req_auth_bearer_token(key)
  httr::GET(input$url, httr::add_headers(Authorization = key))
  output$debug <- renderPrint(Sys.getenv())
  message("calling with ", key)
  message("key set: ", nzchar(key))
  httr::GET(paste0("https://api.example.org/?key=", key))
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "secret-exfiltration",     "config": { "optIn": [ "url" ] } } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (22 ms)\
&nbsp;&nbsp;&nbsp;╰ **Secret Exfiltration** (secret-exfiltration):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ renderPrint shows a secret (high) at 7.19-43\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ message shows a secret (medium) at 8.3-31\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ httr::GET puts a secret into a url (low) at 10.3-57\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ httr::GET sends a secret to a destination others control (high) at 6.3-62

More examples are the test cases in [test/functionality/linter/lint-secret-exfiltration.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-secret-exfiltration.test.ts).