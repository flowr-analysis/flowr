_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="no-leaked-credentials">No Leaked Credentials&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This marks rules which are currently considered experimental, _not_ that they detect experimental code."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#experimental'>![experimental](https://img.shields.io/badge/experimental-lightgrey) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#security'>![security](https://img.shields.io/badge/security-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds hardcoded credentials assigned to variables or passed as arguments whose names suggest they hold passwords, tokens, or API keys, handed to authentication functions, or whose values match known credential formats (AWS, GitHub, Slack, Stripe, Google, JWT, SSH, URLs with passwords).\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/no-leaked-credentials.ts#L145">src/linter/rules/no-leaked-credentials.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `no-leaked-credentials` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/no-leaked-credentials.ts#L68"><code><span title="Pattern matched (case-insensitively) against function names whose unnamed arguments are credentials, like httr::authenticate">credentialCallPattern</span></code></a>\
Pattern matched (case-insensitively) against function names whose unnamed arguments are credentials, like `httr::authenticate`
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/no-leaked-credentials.ts#L64"><code><span title="Pattern matched (case-insensitively) against variable names to identify potential credential assignments">credentialNamePattern</span></code></a>\
Pattern matched (case-insensitively) against variable names to identify potential credential assignments
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/no-leaked-credentials.ts#L66"><code><span title="Pattern matched against string literal values to detect known credential formats (e.g., AWS access key IDs, GitHub tokens)">credentialValuePattern</span></code></a>\
Pattern matched against string literal values to detect known credential formats (e.g., AWS access key IDs, GitHub tokens)

### Examples

```r
password <- "s3cr3t"
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "no-leaked-credentials",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **No Leaked Credentials** (no-leaked-credentials):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Possible hardcoded credential in `password` at 1.1-8

More examples are the test cases in [test/functionality/linter/lint-no-leaked-credentials.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts).