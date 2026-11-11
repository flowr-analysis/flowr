_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-10, 21:10:40 UTC (v2.17.5), do not edit directly._
<h2 id="Linter Query">Linter Query&emsp;<sup>[<a href="https://github.com/flowr-analysis/flowr/wiki/Query-API">overview</a>]</sup></h2>

Lints a given R script for common issues.\
_This query is requested with the type `linter`._\
Run in the REPL: `:query @linter [rules:<r1>,<r2>,...] [tags:<t1>,...] [format:<fmt>] <code | file://path>`

This query lints a given R script for common issues, such as missing files, unused variables, and more.

For a script reading `read.csv("i_do_not_exist.csv")`, the following query returns all smells detected:

```json
[ { "type": "linter" } ]
```

(This can be shortened to `@linter` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **linter** (26 ms)\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `i_do_not_exist.csv` at 1.1-30\
&nbsp;&nbsp;&nbsp;╰ _+21 rules with no findings (:query* to see all)_

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"linter":{"results":{"deprecated-functions":{"results":[],".meta":{"builtin":0,"sigdb":0}},"file-path-validity":{"results":[{"involvedId":3,"loc":[1,1,1,30],"filePath":"i_do_not_exist.csv","certainty":"certain"}],".meta":{"totalReads":1,"totalUnknown":0,"totalWritesBeforeAlways":0,"totalValid":0}},"seeded-randomness":{"results":[],".meta":{"consumerCalls":0,"callsWithFunctionProducers":0,"callsWithAssignmentProducers":0,"callsWithNonConstantProducers":0,"callsWithOtherBranchProducers":0}},"absolute-file-paths":{"results":[],".meta":{"totalConsidered":1,"totalUnknown":0}},"unused-definitions":{"results":[],".meta":{"totalConsidered":0}},"network-functions":{"results":[],".meta":{"totalCalls":0,"totalFunctionDefinitions":0}},"dataframe-access-validation":{"results":[],".meta":{"numOperations":0,"numAccesses":0,"totalAccessed":0}},"dead-code":{"results":[],".meta":{}},"useless-loop":{"results":[],".meta":{"numOfUselessLoops":0}},"problematic-inputs":{"results":[],".meta":{}},"stop-call":{"results":[],".meta":{"consideredNodes":0}},"roxygen-arguments":{"results":[],".meta":{}},"no-leaked-credentials":{"results":[],".meta":{"totalChecked":1}},"undefined-symbol":{"results":[],".meta":{"totalFunctionCalls":1,"totalVariableUses":0,"suppressed":{"installed":0,"loadedPackage":0,"enclosingScope":0,"nonStandardEval":0,"subscript":0,"unresolvedLibrary":0,"declaredGlobal":0}}},"unused-import":{"results":[],".meta":{"totalConsidered":0,"totalUnresolved":0,"totalMultiPackage":0,"totalUnused":0}},"unclosed-connection":{"results":[],".meta":{"totalOpened":0,"totalClosed":0}},"overwritten-file":{"results":[],".meta":{"totalFiles":0}},"unescaped-arguments":{"results":[],".meta":{"totalCriticalArguments":0,"totalEscapedArguments":0}},"namespace-access":{"results":[],".meta":{"unresolved":0}},"secret-exfiltration":{"results":[],".meta":{"secretSinkCalls":0}},"process-state-in-session":{"results":[],".meta":{"sessionFunctions":0}},"call-contracts":{"results":[],".meta":{"checkedCalls":0}}},".meta":{}},".meta":{}}
```

</details>

You can also configure which rules to apply and what settings to use for these rules:

```json
[ { "type": "linter",   "rules": [ "file-path-validity" ] } ]
```

(This can be shortened to `@linter rules:file-path-validity "read.csv("i_do_not_exist.csv")"` when used with the REPL command <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span>).

_Results (prettified and summarized):_

Query: **linter** (5 ms)\
&nbsp;&nbsp;&nbsp;╰ **File Path Validity** (file-path-validity):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ certain:\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ Path `i_do_not_exist.csv` at 1.1-30

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"linter":{"results":{"file-path-validity":{"results":[{"involvedId":3,"loc":[1,1,1,30],"filePath":"i_do_not_exist.csv","certainty":"certain"}],".meta":{"totalReads":1,"totalUnknown":0,"totalWritesBeforeAlways":0,"totalValid":0}}},".meta":{}},".meta":{}}
```

</details>

We welcome any feedback and suggestions for new rules on this (consider opening a [new issue](https://github.com/flowr-analysis/flowr/issues/new/choose)).
		
<details>

<summary style="color:gray">Implementation Details</summary>

The Linter Query is executed by <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/linter-query/linter-query-executor.ts#L20"><code><span title="Executes the given linter queries using the provided analyzer. A query without an explicit rule list runs only the rules that are active by default.">executeLinterQuery</span></code></a>.

</details>