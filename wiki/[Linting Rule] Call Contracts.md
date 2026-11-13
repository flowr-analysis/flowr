_<span title="an overview of flowR's linter">Generated</span> from '[wiki-linter.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-linter.ts "src/documentation/wiki-linter.ts")' on 2026-11-13, 12:11:51 UTC (v2.17.6), do not edit directly._
<h2 id="call-contracts">Call Contracts&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Linter">overview</a>]</sup></h2>

<span title="This rule is used to detect bugs in the code. Everything that affects the semantics of the code, such as incorrect function calls, wrong arguments, etc. is to be considered a bug. Otherwise, it may be a smell or a style issue."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#bug'>![bug](https://img.shields.io/badge/bug-red) </a></span> <span title="This rule is used to detect issues that are related to the portability of the code. For example, platform-specific code, or code that relies on specific R versions or packages."><a href='https://github.com/flowr-analysis/flowr/wiki/Linter#robustness'>![robustness](https://img.shields.io/badge/robustness-teal) </a></span>

This rule is a <code>best-effort</code> rule.
 
Finds calls that hand a function a value its contract rules out, or leave out an argument it needs, so they fail whenever they run.\
_This linting rule is implemented in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/rules/call-contracts.ts#L32">src/linter/rules/call-contracts.ts</a>._

### Examples

```r
f <- function(x, n) { stopifnot(length(x) >= n); x }
f(1:3, 5)
g <- function(how = c("fast", "exact")) match.arg(how)
g("slow")
combn(4, -1)
strsplit(1, "a")
```

The linting query can be used to run this rule on the above example:

```json
[ { "type": "linter",   "rules": [ { "name": "call-contracts",     "config": {} } ] } ]
```

_Results (prettified and summarized):_

Query: **linter** (105 ms)\
&nbsp;&nbsp;&nbsp;╰ **Call Contracts** (call-contracts):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ uncertain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ call of `f` fails its contract at 2.1-9\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ call of `g` fails its contract at 4.1-9\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ call of `combn` fails its contract at 5.1-12\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ call of `strsplit` fails its contract at 6.1-16

More examples are the test cases in [test/functionality/linter/lint-call-contracts.test.ts](https://github.com/flowr-analysis/flowr/tree/main/test/functionality/linter/lint-call-contracts.test.ts).