_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-25, 09:29:25 UTC (v2.16.6), do not edit directly._
<h2 id="problematic-inputs">Problematic Inputs&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#performance'>![performance](https://img.shields.io/badge/performance-teal) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#security'>![security](https://img.shields.io/badge/security-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds dynamic calls (e.g. eval, system) with non-constant inputs, and graphics-device calls (pdf, postscript) where a filename starts with '|' indicating a pipe command injection.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/problematic-inputs.ts#L146">src/linter/rules/problematic-inputs.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `problematic-inputs` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/problematic-inputs.ts#L141"><code>consider</code></a>

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/problematic-inputs.ts#L143"><code>pipeCommandFunctions</code></a>

### Examples

```r

function(x) {
	eval(x)
}
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "problematic-inputs",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (12 ms)\
&nbsp;&nbsp;&nbsp;╰ **Problematic Inputs** (problematic-inputs):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Use of configured dynamic call at 3.2-8 with inputs 5 (type: [param], trace: pure)

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-problematic-inputs.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts)

<h4 id="Test_32_Case:_32_network_32_eval">Test Case: network eval</h4>

Given the following input:

```r
x <- read.csv("https://example.com/data.csv"); eval(parse(text=x))
```

We expect the linter to report the following:

* certain: name = `'eval'`, sources = `[{id: 11, trace: InputTraceType.Known, types: [InputType.File, InputType.Network, InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L15) for the test-case implementation.

<h4 id="Test_32_Case:_32_read_32_eval">Test Case: read eval</h4>

Given the following input:

```r
x <- read.csv("data.csv"); eval(parse(text=x))
```

We expect the linter to report the following:

* certain: name = `'eval'`, sources = `[{id: 11, trace: InputTraceType.Known, types: [InputType.File, InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L21) for the test-case implementation.

<h4 id="Test_32_Case:_32_unseeded_32_randomness_32_eval">Test Case: unseeded randomness eval</h4>

Given the following input:

```r
eval(parse(text=runif(1)))
```

We expect the linter to report the following:

* certain: name = `'eval'`, sources = `[{id: 8, trace: InputTraceType.Known, types: [InputType.Random, InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L27) for the test-case implementation.

<h4 id="Test_32_Case:_32_unknown_32_eval">Test Case: unknown eval</h4>

Given the following input:

```r
eval(parse(text=x))
```

We expect the linter to report the following:

* uncertain: name = `'eval'`, sources = `[{id: 5, trace: InputTraceType.Known, types: [InputType.Unknown, InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L33) for the test-case implementation.

<h4 id="Test_32_Case:_32_const_32_system">Test Case: const system</h4>

Given the following input:

```r
system("rm -rf /")
```

We expect the linter to report the following:

* certain: name = `'system'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'rm -rf /'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L39) for the test-case implementation.

<h4 id="Test_32_Case:_32_label_40__39_unknown_32_system_39__44__32__91__39_system-calls_39__93__44__32__91__39_linter_39__93__41_">Test Case: label('unknown system', ['system-calls'], ['linter'])</h4>

Given the following input:

```r
system(x)
```

We expect the linter to report the following:

* uncertain: name = `'system'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L45) for the test-case implementation.

<h4 id="Test_32_Case:_32_disallowedValues_32_match">Test Case: disallowedValues match</h4>

Given the following input:

```r
custom("rm -rf /")
```

And using the following [configuration](#configuration): 
```ts
{consider: [{pattern: /^custom$/, allowedInputTypes: Object.values(InputType), disallowedValues: /^rm -rf/}]}
```

We expect the linter to report the following:

* certain: name = `'custom'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'rm -rf /'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L53) for the test-case implementation.

<h4 id="Test_32_Case:_32_disallowedValues_32_no_32_match">Test Case: disallowedValues no match</h4>

Given the following input:

```r
custom("rm -rf /")
```

And using the following [configuration](#configuration): 
```ts
{consider: [{pattern: /^custom$/, allowedInputTypes: Object.values(InputType), disallowedValues: /^cat/}]}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L61) for the test-case implementation.

<h4 id="Test_32_Case:_32_allowedValues_32_match">Test Case: allowedValues match</h4>

Given the following input:

```r
custom("rm -rf /")
```

And using the following [configuration](#configuration): 
```ts
{consider: [{pattern: /^custom$/, allowedInputTypes: Object.values(InputType), allowedValues: /^cat/}]}
```

We expect the linter to report the following:

* certain: name = `'custom'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'rm -rf /'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L64) for the test-case implementation.

<h4 id="Test_32_Case:_32_allowedValues_32_no_32_match">Test Case: allowedValues no match</h4>

Given the following input:

```r
custom("rm -rf /")
```

And using the following [configuration](#configuration): 
```ts
{consider: [{pattern: /^custom$/, allowedInputTypes: Object.values(InputType), allowedValues: /^rm -rf/}]}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L72) for the test-case implementation.

<h4 id="Test_32_Case:_32_disallowedValues_32_match_32_with_32_resolve">Test Case: disallowedValues match with resolve</h4>

Given the following input:

```r
custom(parse(text=foo))
```

And using the following [configuration](#configuration): 
```ts
{consider: [{pattern: /^custom$/, allowedInputTypes: Object.values(InputType), resolveSourceArgs: true, disallowedValues: /^parse\(/}]}
```

We expect the linter to report the following:

* uncertain: name = `'custom'`, sources = `[{id: 5, trace: InputTraceType.Known, types: [InputType.Unknown, InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L75) for the test-case implementation.

<h4 id="Test_32_Case:_32_disallowedValues_32_no_32_match_32_with_32_resolve">Test Case: disallowedValues no match with resolve</h4>

Given the following input:

```r
custom(parse(text=runif(1)))
```

And using the following [configuration](#configuration): 
```ts
{consider: [{pattern: /^custom$/, allowedInputTypes: Object.values(InputType), resolveSourceArgs: true, disallowedValues: /^x$/}]}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L83) for the test-case implementation.

<h4 id="Test_32_Case:_32_pdf_32_derived_32_pipe">Test Case: pdf derived pipe</h4>

Given the following input:

```r
pdf(paste0("|", "lp"))
```

We expect the linter to report the following:

* certain: name = `'pdf'`, pipeCommand = `'|'`, sources = `[{id: 2, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|'}, {id: 4, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'lp'}, {id: 6, trace: InputTraceType.Pure, types: [InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L90) for the test-case implementation.

<h4 id="Test_32_Case:_32_pdf_32_pipe_32_constant">Test Case: pdf pipe constant</h4>

Given the following input:

```r
pdf("|lp -o landscape")
```

We expect the linter to report the following:

* certain: name = `'pdf'`, pipeCommand = `'|lp -o landscape'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L101) for the test-case implementation.

<h4 id="Test_32_Case:_32_pdf_32_pipe_32_with_32_named_32_arg">Test Case: pdf pipe with named arg</h4>

Given the following input:

```r
pdf("|lp -o landscape", paper = "a4r")
```

We expect the linter to report the following:

* certain: name = `'pdf'`, pipeCommand = `'|lp -o landscape'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L108) for the test-case implementation.

<h4 id="Test_32_Case:_32_pdf_32_pipe_32_as_32_file_32_with_32_a_32_title_32_after_32_it">Test Case: pdf pipe as file with a title after it</h4>

Given the following input:

```r
pdf("|lp", title = "x")
```

We expect the linter to report the following:

* certain: name = `'pdf'`, pipeCommand = `'|lp'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L116) for the test-case implementation.

<h4 id="Test_32_Case:_32_pdf_32_file_32_after_32_a_32_named_32_arg">Test Case: pdf file after a named arg</h4>

Given the following input:

```r
pdf(width = 7, "|lp")
```

We expect the linter to report the following:

* certain: name = `'pdf'`, pipeCommand = `'|lp'`, sources = `[{id: 4, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L123) for the test-case implementation.

<h4 id="Test_32_Case:_32_pdf_32_unknown_32_input">Test Case: pdf unknown input</h4>

Given the following input:

```r
pdf(x)
```

We expect the linter to report the following:

* uncertain: name = `'pdf'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L131) for the test-case implementation.

<h4 id="Test_32_Case:_32_pdf_32_with_32_a_32_name_32_the_32_user_32_gives">Test Case: pdf with a name the user gives</h4>

Given the following input:

```r
name <- readline("File: ")
pdf(name)
```

We expect the linter to report the following:

* certain: name = `'pdf'`, sources = `[{id: 7, trace: InputTraceType.Alias, types: [InputType.User]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L137) for the test-case implementation.

<h4 id="Test_32_Case:_32_postscript_32_pipe_32_constant">Test Case: postscript pipe constant</h4>

Given the following input:

```r
postscript("|lp")
```

We expect the linter to report the following:

* certain: name = `'postscript'`, pipeCommand = `'|lp'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L143) for the test-case implementation.

<h4 id="Test_32_Case:_32_pipe_32_disallowedValues_32_match">Test Case: pipe disallowedValues match</h4>

Given the following input:

```r
custom("|rm -rf /")
```

And using the following [configuration](#configuration): 
```ts
{pipeCommandFunctions: [{pattern: /^custom$/, argIdx: 0, argName: 'file', disallowedValues: /^\|rm/}]}
```

We expect the linter to report the following:

* certain: name = `'custom'`, pipeCommand = `'|rm -rf /'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|rm -rf /'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L152) for the test-case implementation.

<h4 id="Test_32_Case:_32_pipe_32_disallowedValues_32_no_32_match">Test Case: pipe disallowedValues no match</h4>

Given the following input:

```r
custom("|lp -o landscape")
```

And using the following [configuration](#configuration): 
```ts
{pipeCommandFunctions: [{pattern: /^custom$/, argIdx: 0, argName: 'file', disallowedValues: /^\|rm/}]}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L159) for the test-case implementation.

<h4 id="Test_32_Case:_32_pipe_32_allowedValues_32_match">Test Case: pipe allowedValues match</h4>

Given the following input:

```r
custom("|rm -rf /")
```

And using the following [configuration](#configuration): 
```ts
{pipeCommandFunctions: [{pattern: /^custom$/, argIdx: 0, argName: 'file', allowedValues: /^\|rm/}]}
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L161) for the test-case implementation.

<h4 id="Test_32_Case:_32_pipe_32_allowedValues_32_no_32_match">Test Case: pipe allowedValues no match</h4>

Given the following input:

```r
custom("|lp -o landscape")
```

And using the following [configuration](#configuration): 
```ts
{pipeCommandFunctions: [{pattern: /^custom$/, argIdx: 0, argName: 'file', allowedValues: /^\|rm/}]}
```

We expect the linter to report the following:

* certain: name = `'custom'`, pipeCommand = `'|lp -o landscape'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L163) for the test-case implementation.

<h4 id="Test_32_Case:_32_title_32_is_32_no_32_file">Test Case: title is no file</h4>

> R: pdf(title = "|x", "out.pdf") writes out.pdf, the title is no pipe

Given the following input:

```r
pdf(title = "|x", "out.pdf")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L174) for the test-case implementation.

<h4 id="Test_32_Cases_32_without_32_Findings">Test Cases without Findings</h4>

The linter reports nothing for:

**const-eval**

```r
eval(parse(text="x"))
```

**const source**

```r
source("a.R")
```

**known source**

```r
f <- "h.R"; source(f)
```

**derived source**

```r
source(paste0("b", ".R"))
```

**pdf safe path**

```r
pdf("output.pdf")
```

**pdf title before the file is no pipe**

```r
pdf(title = "|x", "out.pdf")
```

**pdf non-file arg pipe not flagged**

```r
pdf(file = "out.pdf", title = "|untrusted")
```

**a temporary path is no problematic input**

```r
f <- tempfile()
system(paste("touch", f))
```