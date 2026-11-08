_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-10-27, 10:46:55 UTC (v2.16.6), do not edit directly._
<h2 id="seeded-randomness">Seeded Randomness&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect issues that do not directly affect the semantics of the code, but are still considered bad practice."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#smell'>![smell](https://img.shields.io/badge/smell-yellow) </a></span> <span title="This rule is used to detect issues that are related to the reproducibility of the code. For example, missing or incorrect random seeds, or missing data."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#reproducibility'>![reproducibility](https://img.shields.io/badge/reproducibility-teal) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds randomness-based function calls not preceded by a random seed generation function. For consistent reproducibility, functions that use randomness should only be called after a constant random seed is set using a function like `set.seed`.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/seeded-randomness.ts#L62">src/linter/rules/seeded-randomness.ts</a>._

### Configuration

Linting rules can be configured by passing a configuration object to the linter query as shown in the example below.
The `seeded-randomness` rule accepts the following configuration options:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/seeded-randomness.ts#L51"><code><span title="A set of randomness consumer function names that require a seed to be set prior to invocation.">randomnessConsumers</span></code></a>\
A set of randomness consumer function names that require a seed to be set prior to invocation.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/seeded-randomness.ts#L47"><code><span title="A set of functions and variables whose invocation or assignment causes a random seeded to be set. Each entry has a type, which is either function or assignment, and a name, which is the name of the function or variable. The default value for this is the function set.seed and the variable .Random.seed.">randomnessProducers</span></code></a>\
A set of functions and variables whose invocation or assignment causes a random seeded to be set.
Each entry has a `type`, which is either `function` or `assignment`, and a `name`, which is the name of the function or variable.
The default value for this is the function `set.seed` and the variable `.Random.seed`.

### Examples

```r
runif(1)
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "seeded-randomness",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (1 ms)\
&nbsp;&nbsp;&nbsp;╰ **Seeded Randomness** (seeded-randomness):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Function `runif` at 1.1-8

More examples are the test cases in [test/functionality/linter/lint-seeded-randomness.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-seeded-randomness.test.ts).