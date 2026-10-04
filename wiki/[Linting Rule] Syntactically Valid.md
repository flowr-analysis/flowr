_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-04, 14:48:48 UTC (v2.15.9), do not edit directly._
<h2 id="syntactically-valid">Syntactically Valid&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule may provide quickfixes to automatically fix the issues it detects."><a href='#quickfix'>![quickfix](https://img.shields.io/badge/quickfix-lightgray) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a `best-effort` rule.
 
Checks whether the code is free of syntax errors, using the configured (error-tolerant) parser, and offers extensible quick-fixes to repair them.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/syntactically-valid.ts#L266">src/linter/rules/syntactically-valid.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `syntactically-valid` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/syntactically-valid.ts#L25"><code><span title="Names of auto-fix patterns to disable (default none).">disabledFixes</span></code></a>\
Names of
<code>auto-fix patterns</code>
to disable (default none).
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/syntactically-valid.ts#L27"><code><span title="Preferred FixDirection ; each error gets a single fix, favouring a candidate of this direction.">preferFix</span></code></a>\
Preferred
<code>FixDirection</code>
; each error gets a single fix, favouring a candidate of this direction.

### Examples

```r
x <- c(1, 2
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "syntactically-valid",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **Syntactically Valid** (syntactically-valid):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Missing `)` at 1.12-11 (1 quick fix(es) available)\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "syntactically-valid": {
        "results": [
          {
            "certainty": "certain",
            "kind": "missing",
            "loc": [1,12,1,11],
            "message": "Missing `)`",
            "quickFix": [{"type":"replace","loc":[1,12,1,11],"description":"Insert missing `)`","replacement":")"}]
          }
        ],
        ".meta": {"parser":"tree-sitter","errors":1,"fixable":1}
      }
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-syntactically-valid.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts)

<h4 id="Test_32_Case:_32_label_40__39_valid_32_code_32_has_32_no_32_syntax_32_errors_39__44__32__91__39_syntax-errors_39__93__44__32__91__39_linter_39__93__41_">Test Case: label('valid code has no syntax errors', ['syntax-errors'], ['linter'])</h4>

Given the following input:

```r
x <- c(1, 2)
print(x)
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L9) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_label_40__39_missing_32_closing_32_parenthesis_39__44__32__91__39_syntax-errors_39__93__44__32__91__39_linter_39__93__41_">Test Case: label('missing closing parenthesis', ['syntax-errors'], ['linter'])</h4>

Given the following input:

```r
x <- c(1, 2
```

We expect the linter to report the following:

* certain at 1.12-1.11: kind = `'missing'`, message = `'Missing `)`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L15) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_label_40__39_unbalanced_32_brace_39__44__32__91__39_syntax-errors_39__93__44__32__91__39_linter_39__93__41_">Test Case: label('unbalanced brace', ['syntax-errors'], ['linter'])</h4>

Given the following input:

```r
{ 1
```

We expect the linter to report the following:

* certain at 1.1-1.3: kind = `'error'`, message = `'Unexpected `{ 1`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L27) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dangling_32_assignment_32_operator">Test Case: dangling assignment operator</h4>

Given the following input:

```r
x <-
```

We expect the linter to report the following:

* certain at 1.5-1.4: kind = `'missing'`, message = `'Missing `identifier`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L39) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_dangling_32_operator_32_prefers_32_the_32_add_32_direction_32_when_32_configured">Test Case: dangling operator prefers the add direction when configured</h4>

> // preferFix flips the direction: with `add`, the same error offers the NULL placeholder instead of the removal

Given the following input:

```r
x <-
```

And using the following [configuration](#configuration): 
```ts
{preferFix: 'add'}
```

We expect the linter to report the following:

* certain at 1.5-1.4: kind = `'missing'`, message = `'Missing `identifier`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L52) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_fuzzy-completes_32_an_32_unfinished_32_operator">Test Case: fuzzy-completes an unfinished operator</h4>

Given the following input:

```r
a %in b
```

We expect the linter to report the following:

* certain at 1.3-1.7: kind = `'error'`, message = `'Unexpected `%in b`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L65) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_typographic_32_quotes">Test Case: typographic quotes</h4>

> // what a word processor or a PDF leaves behind

Given the following input:

```r
x <- “hi”
```

We expect the linter to report the following:

* certain at 1.6-1.6: kind = `'error'`, message = `'Unexpected `“`'`, 1 quick fix
* certain at 1.9-1.9: kind = `'error'`, message = `'Unexpected `”`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L92) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_comment-out_32_fallback_32_for_32_a_32_stray_32_token">Test Case: comment-out fallback for a stray token</h4>

> // a stray token no other pattern can repair falls back to commenting it out

Given the following input:

```r
,
```

We expect the linter to report the following:

* certain at 1.1-1.1: kind = `'error'`, message = `'Unexpected `,`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L111) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_disabling_32_a_32_fix_32_drops_32_its_32_suggestion">Test Case: disabling a fix drops its suggestion</h4>

> // disabling the only applicable pattern leaves the error reported but without a quick-fix

Given the following input:

```r
,
```

And using the following [configuration](#configuration): 
```ts
{disabledFixes: ['comment-out']}
```

We expect the linter to report the following:

* certain at 1.1-1.1: kind = `'error'`, message = `'Unexpected `,`'`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L124) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_stray_32_closing_32_parenthesis">Test Case: stray closing parenthesis</h4>

> // a copy that stopped short of the opening bracket leaves closers that close nothing

Given the following input:

```r
x <- c(1, 2))
```

We expect the linter to report the following:

* certain at 1.13-1.13: kind = `'error'`, message = `'Unexpected `)`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L138) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_copied_32_REPL_32_prompt">Test Case: copied REPL prompt</h4>

> // lines copied out of the REPL keep their prompt

Given the following input:

```r
> x <- 1
```

We expect the linter to report the following:

* certain at 1.1-1.1: kind = `'error'`, message = `'Unexpected `>`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L164) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_pasted_32_console_32_output">Test Case: pasted console output</h4>

> // printed results pasted back into the script: the whole line is missing its `#`

Given the following input:

```r
[1] 1 2 3
```

We expect the linter to report the following:

* certain at 1.1-1.1: kind = `'error'`, message = `'Unexpected `[`'`, 1 quick fix
* certain at 1.3-1.3: kind = `'error'`, message = `'Unexpected `]`'`, 1 quick fix

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L190) for the test-case implementation.