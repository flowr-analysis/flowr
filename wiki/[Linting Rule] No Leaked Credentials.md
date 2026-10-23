_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-23, 16:00:51 UTC (v2.16.6), do not edit directly._
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

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **No Leaked Credentials** (no-leaked-credentials):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Possible hardcoded credential in `password` at 1.1-8

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {"no-leaked-credentials":{"results":[{"certainty":"uncertain","involvedId":0,"variableName":"password","loc":[1,1,1,8]}],".meta":{"totalChecked":1}}},
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-no-leaked-credentials.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts)

<h4 id="Test_32_Case:_32_no_32_credentials">Test Case: no credentials</h4>

Given the following input:

```r
x <- 42
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L8) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_password_32_assignment">Test Case: password assignment</h4>

Given the following input:

```r
password <- "s3cr3t"
```

We expect the linter to report the following:

* uncertain at 1.1-1.8: variableName = `'password'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L14) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_api_key_32_assignment">Test Case: api_key assignment</h4>

Given the following input:

```r
api_key <- "abc123-xyz"
```

We expect the linter to report the following:

* uncertain at 1.1-1.7: variableName = `'api_key'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L20) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_token_32_assignment">Test Case: token assignment</h4>

Given the following input:

```r
auth_token <- "Bearer abc123"
```

We expect the linter to report the following:

* uncertain at 1.1-1.10: variableName = `'auth_token'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_case_32_insensitive_32_match">Test Case: case insensitive match</h4>

Given the following input:

```r
PASSWORD <- "hunter2"
```

We expect the linter to report the following:

* uncertain at 1.1-1.8: variableName = `'PASSWORD'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L32) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_an_32_empty_32_password_32_holds_32_no_32_credential">Test Case: an empty password holds no credential</h4>

Given the following input:

```r
password <- ""
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_one-character_32_password_32_is_32_still_32_flagged">Test Case: a one-character password is still flagged</h4>

Given the following input:

```r
password <- "a"
```

We expect the linter to report the following:

* uncertain at 1.1-1.8: variableName = `'password'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_non-string_32_value_32_not_32_flagged">Test Case: non-string value not flagged</h4>

Given the following input:

```r
password <- getPass()
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L50) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_numeric_32_value_32_not_32_flagged">Test Case: numeric value not flagged</h4>

Given the following input:

```r
secret <- 42
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L56) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unrelated_32_variable_32_with_32_plain_32_string_32_not_32_flagged">Test Case: unrelated variable with plain string not flagged</h4>

Given the following input:

```r
greeting <- "hello world"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L62) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_multiple_32_assignments">Test Case: multiple assignments</h4>

Given the following input:

```r
x <- "hello"
password <- "mypass"
y <- 1
```

We expect the linter to report the following:

* uncertain at 2.1-2.8: variableName = `'password'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L68) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_api.key_32_with_32_dot_32_separator">Test Case: api.key with dot separator</h4>

Given the following input:

```r
api.key <- "tok_12345"
```

We expect the linter to report the following:

* uncertain at 1.1-1.7: variableName = `'api.key'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L74) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_custom_32_name_32_pattern">Test Case: custom name pattern</h4>

Given the following input:

```r
mysupersecretvar <- "secret"
```

And using the following [configuration](#configuration): 
```ts
{credentialNamePattern: 'mysupersecretvar'}
```

We expect the linter to report the following:

* uncertain at 1.1-1.16: variableName = `'mysupersecretvar'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L80) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_aws_32_access_32_key_32_id_32_detected_32_by_32_value">Test Case: aws access key id detected by value</h4>

Given the following input:

```r
x <- "AKIAIOSFODNN7EXAMPLE"
```

We expect the linter to report the following:

* uncertain at 1.1-1.1: variableName = `'x'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L87) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_github_32_pat_32_detected_32_by_32_value">Test Case: github pat detected by value</h4>

Given the following input:

```r
connection <- "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

We expect the linter to report the following:

* uncertain at 1.1-1.10: variableName = `'connection'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L93) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_pem_32_private_32_key_32_detected_32_by_32_value">Test Case: pem private key detected by value</h4>

Given the following input:

```r
data <- "-----BEGIN RSA PRIVATE KEY-----"
```

We expect the linter to report the following:

* uncertain at 1.1-1.4: variableName = `'data'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L99) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_slack_32_token_32_detected_32_by_32_value">Test Case: slack token detected by value</h4>

Given the following input:

```r
bot <- "xoxb-1234567890-abcdefghijklmn"
```

We expect the linter to report the following:

* uncertain at 1.1-1.3: variableName = `'bot'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L105) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_stripe_32_key_32_detected_32_by_32_value">Test Case: stripe key detected by value</h4>

Given the following input:

```r
client <- "sk_live_12345abcdefghijklmnopqrs"
```

We expect the linter to report the following:

* uncertain at 1.1-1.6: variableName = `'client'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L111) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_name_32_and_32_value_32_both_32_match">Test Case: name and value both match</h4>

Given the following input:

```r
api_key <- "AKIAIOSFODNN7EXAMPLE"
```

We expect the linter to report the following:

* uncertain at 1.1-1.7: variableName = `'api_key'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L117) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_credential_32_passed_32_as_32_named_32_argument">Test Case: credential passed as named argument</h4>

Given the following input:

```r
con <- DBI::dbConnect(drv, password = "hunter2")
```

We expect the linter to report the following:

* uncertain at 1.28-1.35: variableName = `'password'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L123) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_credential_32_handed_32_to_32_an_32_authentication_32_function">Test Case: credential handed to an authentication function</h4>

Given the following input:

```r
httr::authenticate("me", "hunter2")
```

We expect the linter to report the following:

* uncertain at 1.1-1.35: variableName = `'authenticate'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L128) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_credential_32_built_32_from_32_literals">Test Case: credential built from literals</h4>

Given the following input:

```r
password <- paste0("hun", "ter2")
```

We expect the linter to report the following:

* uncertain at 1.1-1.8: variableName = `'password'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L133) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_credential_32_through_32_a_32_chained_32_assignment">Test Case: credential through a chained assignment</h4>

Given the following input:

```r
password <- x <- "hunter2"
```

We expect the linter to report the following:

* uncertain at 1.1-1.8: variableName = `'password'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L138) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_credential_32_flowing_32_into_32_a_32_named_32_argument">Test Case: credential flowing into a named argument</h4>

Given the following input:

```r
pw <- "hunter2"
cfg <- list(password = pw)
```

We expect the linter to report the following:

* uncertain at 2.13-2.20: variableName = `'password'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L143) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_known_32_token_32_after_32_a_32_prefix">Test Case: known token after a prefix</h4>

Given the following input:

```r
hdr <- "Bearer ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
```

We expect the linter to report the following:

* uncertain at 1.1-1.3: variableName = `'hdr'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L148) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_url_32_with_32_an_32_embedded_32_password">Test Case: url with an embedded password</h4>

Given the following input:

```r
m <- mongolite::mongo(url = "mongodb://me:hunter2@host/db")
```

We expect the linter to report the following:

* uncertain at 1.23-1.25: variableName = `'url'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L153) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_prompts_44__32_services_44__32_and_32_auth_32_schemes_32_are_32_no_32_credentials">Test Case: prompts, services, and auth schemes are no credentials</h4>

Given the following input:

```r
pw <- rstudioapi::askForPassword("DB password")
keyring::key_set_with_value("db", password = pw)
httr::add_headers(Authorization = paste("Bearer", Sys.getenv("TOKEN")))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L158) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_a_32_key_32_looked_32_up_32_by_32_a_32_package_32_function_32_is_32_no_32_credential">Test Case: a key looked up by a package function is no credential</h4>

Given the following input:

```r
pw <- config::get("password")
con <- DBI::dbConnect(drv, password = pw)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L163) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_looked_32_up_32_credentials_32_are_32_not_32_hardcoded">Test Case: looked up credentials are not hardcoded</h4>

Given the following input:

```r
password <- Sys.getenv("PW")
assign("api_key", keyring::key_get("svc"))
httr::authenticate("me", Sys.getenv("PW"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L168) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_placeholders_32_and_32_descriptions_32_of_32_credentials_32_are_32_not_32_flagged">Test Case: placeholders and descriptions of credentials are not flagged</h4>

Given the following input:

```r
api_key <- "<your-key>"
password <- "xxx"
password_label <- "Password:"
credentials_file <- "~/.aws/credentials"
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-no-leaked-credentials.test.ts#L173) for the test-case implementation.