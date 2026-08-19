_<span title="an overview of flowR's linter">Generated</span> from '[src/documentation/wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts)' on 2026-08-16, 06:15:25 UTC (v2.13.16), so please do not edit it directly._
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

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Syntactically Valid** (syntactically-valid):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Missing `)` at 1.12-11 (1 quick fix(es) available)\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ _Metadata_: parser: "tree-sitter", errors: 1, fixable: 1, searchTimeMs: 0, processTimeMs: 1\
_All queries together required ≈1 ms (1ms accuracy, total 2 ms)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis required _1.9 ms_ (including parsing and normalization and the query) within the generation environment.

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
            "loc": [
              1,
              12,
              1,
              11
            ],
            "message": "Missing `)`",
            "quickFix": [
              {
                "type": "replace",
                "loc": [
                  1,
                  12,
                  1,
                  11
                ],
                "description": "Insert missing `)`",
                "replacement": ")"
              }
            ]
          }
        ],
        ".meta": {
          "parser": "tree-sitter",
          "errors": 1,
          "fixable": 1,
          "searchTimeMs": 0,
          "processTimeMs": 1
        }
      }
    },
    ".meta": {
      "timing": 1
    }
  },
  ".meta": {
    "timing": 1
  }
}
```



</details>





	

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-syntactically-valid.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts)


<h4 id="Test_Case:_valid_code_has_no_syntax_errors">Test Case: valid code has no syntax errors</h4>


Given the following input:

```r
x <- c(1, 2)
print(x)
```



We expect the linter to report the following:

```ts
* no lints
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L8) for the test-case implementation.
		
<h4 id="Test_Case:_missing_closing_parenthesis">Test Case: missing closing parenthesis</h4>


Given the following input:

```r
x <- c(1, 2
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'missing',
message:   'Missing `)`',
loc:       [1, 12, 1, 11],
quickFix:  [{ type: 'replace', loc: [1, 12, 1, 11], description: 'Insert missing `)`', replacement: ')' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L14) for the test-case implementation.
		
<h4 id="Test_Case:_unbalanced_brace">Test Case: unbalanced brace</h4>


Given the following input:

```r
{ 1
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `{ 1`',
loc:       [1, 1, 1, 3],
quickFix:  [{ type: 'replace', loc: [1, 4, 1, 3], description: 'Add missing closing `}`', replacement: '}' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L26) for the test-case implementation.
		
<h4 id="Test_Case:_dangling_assignment_operator">Test Case: dangling assignment operator</h4>


Given the following input:

```r
x <-
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'missing',
message:   'Missing `identifier`',
loc:       [1, 5, 1, 4],
quickFix:  [{ type: 'remove', loc: [1, 3, 1, 4], description: 'Remove the dangling `<-`' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L38) for the test-case implementation.
		
<h4 id="Test_Case:_dangling_operator_prefers_the_add_direction_when_configured">Test Case: dangling operator prefers the add direction when configured</h4>

> // preferFix flips the direction: with `add`, the same error offers the NULL placeholder instead of the removal

Given the following input:

```r
x <-
```


And using the following [configuration](#configuration): 
```ts
{ preferFix: 'add' }
```


We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'missing',
message:   'Missing `identifier`',
loc:       [1, 5, 1, 4],
quickFix:  [{ type: 'replace', loc: [1, 5, 1, 4], description: 'Insert placeholder `NULL`', replacement: ' NULL' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L51) for the test-case implementation.
		
<h4 id="Test_Case:_fuzzy-completes_an_unfinished_operator">Test Case: fuzzy-completes an unfinished operator</h4>


Given the following input:

```r
a %in b
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `%in b`',
loc:       [1, 3, 1, 7],
quickFix:  [{ type: 'replace', loc: [1, 3, 1, 5], description: 'Complete operator to `%in%`', replacement: '%in%' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L64) for the test-case implementation.
		
<h4 id="Test_Case:_typographic_quotes">Test Case: typographic quotes</h4>

> // what a word processor or a PDF leaves behind

Given the following input:

```r
x <- “hi”
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `“`',
loc:       [1, 6, 1, 6],
quickFix:  [{ type: 'replace', loc: [1, 6, 1, 6], description: 'Replace the typographic quote with a straight one', replacement: '"' }]
			}, {
certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `”`',
loc:       [1, 9, 1, 9],
quickFix:  [{ type: 'replace', loc: [1, 9, 1, 9], description: 'Replace the typographic quote with a straight one', replacement: '"' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L91) for the test-case implementation.
		
<h4 id="Test_Case:_comment-out_fallback_for_a_stray_token">Test Case: comment-out fallback for a stray token</h4>

> // a stray token no other pattern can repair falls back to commenting it out

Given the following input:

```r
,
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `,`',
loc:       [1, 1, 1, 1],
quickFix:  [{ type: 'replace', loc: [1, 1, 1, 1], description: 'Comment out the offending code', replacement: '# ,' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L110) for the test-case implementation.
		
<h4 id="Test_Case:_disabling_a_fix_drops_its_suggestion">Test Case: disabling a fix drops its suggestion</h4>

> // disabling the only applicable pattern leaves the error reported but without a quick-fix

Given the following input:

```r
,
```


And using the following [configuration](#configuration): 
```ts
{ disabledFixes: ['comment-out'] }
```


We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `,`',
loc:       [1, 1, 1, 1],
quickFix:  undefined
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L123) for the test-case implementation.
		
<h4 id="Test_Case:_stray_closing_parenthesis">Test Case: stray closing parenthesis</h4>

> // a copy that stopped short of the opening bracket leaves closers that close nothing

Given the following input:

```r
x <- c(1, 2))
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `)`',
loc:       [1, 13, 1, 13],
quickFix:  [{ type: 'remove', loc: [1, 13, 1, 13], description: 'Remove the stray `)`' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L137) for the test-case implementation.
		
<h4 id="Test_Case:_copied_REPL_prompt">Test Case: copied REPL prompt</h4>

> // lines copied out of the REPL keep their prompt

Given the following input:

```r
> x <- 1
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `>`',
loc:       [1, 1, 1, 1],
quickFix:  [{ type: 'remove', loc: [1, 1, 1, 1], description: 'Remove the copied `>` prompt' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L163) for the test-case implementation.
		
<h4 id="Test_Case:_pasted_console_output">Test Case: pasted console output</h4>

> // printed results pasted back into the script: the whole line is missing its `#`

Given the following input:

```r
[1] 1 2 3
```



We expect the linter to report the following:

```ts
				certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `[`',
loc:       [1, 1, 1, 1],
quickFix:  [{ type: 'replace', loc: [1, 1, 1, 0], description: 'Comment out the pasted console output', replacement: '# ' }]
			}, {
certainty: LintingResultCertainty.Certain,
kind:      'error',
message:   'Unexpected `]`',
loc:       [1, 3, 1, 3],
quickFix:  [{ type: 'replace', loc: [1, 1, 1, 0], description: 'Comment out the pasted console output', replacement: '# ' }]
```


See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-syntactically-valid.test.ts#L189) for the test-case implementation.