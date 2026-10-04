_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-04, 14:48:48 UTC (v2.15.9), do not edit directly._
<h2 id="problematic-inputs">Problematic inputs&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect security-critical. For example, missing input validation."><a href='#security'>![security](https://img.shields.io/badge/security-orange) </a></span> <span title="This rule is used to detect issues that are related to the performance of the code. For example, inefficient algorithms, unnecessary computations, or unoptimized data structures."><a href='#performance'>![performance](https://img.shields.io/badge/performance-teal) </a></span> <span title="This rule is used to detect issues that are related to the readability of the code. For example, complex expressions, long lines, or inconsistent formatting."><a href='#readability'>![readability](https://img.shields.io/badge/readability-teal) </a></span>

This rule is a `best-effort` rule.
 
Detects uses of dynamic calls (e.g. eval, system) with non-constant inputs, and graphics-device calls (pdf, postscript) where a filename starts with '|' indicating a pipe command injection.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/problematic-inputs.ts#L113">src/linter/rules/problematic-inputs.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `problematic-inputs` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/problematic-inputs.ts#L108"><code>consider</code></a>\

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/problematic-inputs.ts#L110"><code>pipeCommandFunctions</code></a>\

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

Query: **linter** (2 ms)\
&nbsp;&nbsp;&nbsp;╰ **Problematic inputs** (problematic-inputs):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Use of configured dynamic call at 3.2-8; inputs: 5 (type: [param], trace: pure)\

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to get those.

```json
{
  "linter": {
    "results": {
      "problematic-inputs": {"results":[{"involvedId":7,"certainty":"certain","loc":[3,2,3,8],"name":"eval","sources":[{"id":5,"types":["param"],"trace":"pure"}]}],".meta":{}}
    },
    ".meta": {}
  },
  ".meta": {}
}
```

</details>

#### Additional Examples
	
These examples are synthesized from the test cases in: [test/functionality/linter/lint-problematic-inputs.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts)

<h4 id="Test_32_Case:_32_const-eval">Test Case: const-eval</h4>

Given the following input:

```r
eval(parse(text="x"))
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L11) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_network_32_eval">Test Case: network eval</h4>

Given the following input:

```r
x <- read.csv("https://example.com/data.csv"); eval(parse(text=x))
```

We expect the linter to report the following:

* certain: name = `'eval'`, sources = `[{id: 11, trace: InputTraceType.Known, types: [InputType.File, InputType.Network, InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L12) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_read_32_eval">Test Case: read eval</h4>

Given the following input:

```r
x <- read.csv("data.csv"); eval(parse(text=x))
```

We expect the linter to report the following:

* certain: name = `'eval'`, sources = `[{id: 11, trace: InputTraceType.Known, types: [InputType.File, InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L18) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unseeded_32_randomness_32_eval">Test Case: unseeded randomness eval</h4>

Given the following input:

```r
eval(parse(text=runif(1)))
```

We expect the linter to report the following:

* certain: name = `'eval'`, sources = `[{id: 8, trace: InputTraceType.Known, types: [InputType.Random, InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L24) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_unknown_32_eval">Test Case: unknown eval</h4>

Given the following input:

```r
eval(parse(text=x))
```

We expect the linter to report the following:

* uncertain: name = `'eval'`, sources = `[{id: 5, trace: InputTraceType.Known, types: [InputType.Unknown, InputType.DerivedConstant]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L30) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_label_40__39_unknown_32_system_39__44__32__91__39_system-calls_39__93__44__32__91__39_linter_39__93__41_">Test Case: label('unknown system', ['system-calls'], ['linter'])</h4>

Given the following input:

```r
system(x)
```

We expect the linter to report the following:

* uncertain: name = `'system'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L36) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_pdf_32_safe_32_path">Test Case: pdf safe path</h4>

Given the following input:

```r
pdf("output.pdf")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L44) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_pdf_32_pipe_32_constant">Test Case: pdf pipe constant</h4>

Given the following input:

```r
pdf("|lp -o landscape")
```

We expect the linter to report the following:

* certain: name = `'pdf'`, pipeCommand = `'|lp -o landscape'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L45) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_pdf_32_pipe_32_with_32_named_32_arg">Test Case: pdf pipe with named arg</h4>

Given the following input:

```r
pdf("|lp -o landscape", paper = "a4r")
```

We expect the linter to report the following:

* certain: name = `'pdf'`, pipeCommand = `'|lp -o landscape'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L52) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_pdf_32_non-file_32_arg_32_pipe_32_not_32_flagged">Test Case: pdf non-file arg pipe not flagged</h4>

Given the following input:

```r
pdf(file = "out.pdf", title = "|untrusted")
```

We expect the linter to report the following:

* no lints

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L59) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_pdf_32_unknown_32_input">Test Case: pdf unknown input</h4>

Given the following input:

```r
pdf(x)
```

We expect the linter to report the following:

* uncertain: name = `'pdf'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown]}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L60) for the test-case implementation.
		
<h4 id="Test_32_Case:_32_postscript_32_pipe_32_constant">Test Case: postscript pipe constant</h4>

Given the following input:

```r
postscript("|lp")
```

We expect the linter to report the following:

* certain: name = `'postscript'`, pipeCommand = `'|lp'`, sources = `[{id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp'}]`

See [here](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-problematic-inputs.test.ts#L66) for the test-case implementation.