_<span title="an overview of flowR's every helper object flowR has, by what it is about">Generated</span> from '[wiki-helper-objects.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-helper-objects.ts "src/documentation/wiki-helper-objects.ts")' on 2026-08-31, 20:31:00 UTC (v2.15.8, R v4.6.1), please do not edit directly._


A *helper object* is a `const` named after a type, holding the operations on values of it. flowR has
71 of them, and this page groups them by what they are about.


```ts
SourceLocation.at(node)?.startLine
DfgVertex.isFunctionCall(vertex)
DfEdge.includesType(edge, EdgeType.Reads)
```


They share one shape, which is also how this page finds them:


```ts
export const Thing = {
    name: 'Thing',
    doSomething(this: void, thing: Thing): Answer {
        /* ... */
    }
} as const;
```




<h2 id="Where_something_is">Where something is</h2>

A place in the analyzed source, and the ways to name one.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/range.ts#L63"><code><span title="Utility functions for source ranges .">SourceRange</span></code></a> | Utility functions for <code>source ranges</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/range.ts#L310"><code><span title="Utility functions for source locations . As every SourceRange is a location without a file, the readers of SourceRange apply to locations as well; the ones re-exported here save you the detour via SourceLocation.getRange .">SourceLocation</span></code></a> | Utility functions for <code>source locations</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/ast/model/processing/node-id.ts#L31"><code><span title="What a NodeId is: the identity of a node within one analysis, plus the built-in and pkg::fn names encoded as one, and the ways to read a name back out of it.">NodeId</span></code></a> | What a <code>NodeId</code> is: the identity of a node within one analysis, plus the built-in and `pkg::fn` names encoded as one, and the ways to read a name back out of it. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/slicing/criterion/parse.ts#L25"><code><span title="The helper object for slicing criteria: parsing, validating and resolving them, one ( SlicingCriterion.parse ) or several ( SlicingCriterion.decodeAll ) at a time.">SlicingCriterion</span></code></a> | The helper object for slicing criteria: parsing, validating and resolving them, one ( <code>SlicingCriterion.parse</code> ) or several ( <code>SlicingCriterion.decodeAll</code> ) at a time. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/text/playground-link.ts#L133"><code><span title="Everything about flowR's playground that is not the page itself: what a link to it carries, and how one is written. The page reads back exactly what Playground.link writes.">Playground</span></code></a> | Everything about flowR's playground that is not the page itself: what a link to it carries, and how one is written. |


<h2 id="The_normalized_AST">The normalized AST</h2>

What the R code is, once flowR has read it.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/ast/model/model.ts#L279"><code><span title="Helper object to provide helper functions for RNodes . For the individual type checks, please consult the individual vertices, e.g. RPipe.is . Some vertices also have a RPipe.availableFromRVersion property that indicates from which R version they are available, so you can check for that as well if needed.">RNode</span></code></a> | Helper object to provide helper functions for <code>RNodes</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/ast/model/nodes/r-project.ts#L36"><code><span title="Helper object to identify RProject nodes by their type and to provide related functions.">RProject</span></code></a> | Helper object to identify RProject nodes by their type and to provide related functions. |

Beside these sits one helper per kind of node, each named after what it matches, so a `for` loop is `RForLoop` and a call is `RFunctionCall`. Every one answers `is`, plus whatever that kind allows on top; `RNode` is where to start when the kind is not known yet.


<h2 id="Names_and_values">Names and values</h2>

What a name is, and what a value flowR worked out may be.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/identifier.ts#L49"><code><span title="Helper functions to work with identifiers . Use Identifier.matches to check if two identifiers match according to R's scoping rules!">Identifier</span></code></a> | Helper functions to work with <code>identifiers</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/eval/values/r-value.ts#L188"><code><span title="Reads the plain TS value a Value stands for, undefined whenever it stands for more than one, for none, or for another kind. Prefer these over reaching into a value's shape by hand. This is the constant-folding view: it answers 'is this one known constant' and nothing else. It runs no fixpoint, knows no control flow, and widens nothing. For an abstract state that does, use the dedicated abstract in...">RValue</span></code></a> | Reads the plain TS value a <code>Value</code> stands for, `undefined` whenever it stands for more than one, for none, or for another kind. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/convert-values.ts#L161"><code><span title="Checks whether the given string is an R string literal (including raw strings).">RStringValue</span></code></a> | Checks whether the given string is an R string literal (including raw strings). |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/convert-values.ts#L92"><code><span title="What an RNumberValue is: R's number as it was written, its integer marker (1L) and its complex flag (1i) included.">RNumberValue</span></code></a> | What an <code>RNumberValue</code> is: R's number as it was written, its integer marker (`1L`) and its complex flag (`1i`) included. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/logic.ts#L12"><code><span title="Always, never, or maybe, which is what a static answer about a running program usually is. Its operators keep maybe infectious, so a conclusion never claims more than what is known.">TernaryLogic</span></code></a> | Always, never, or maybe, which is what a static answer about a running program usually is. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/r-version.ts#L94"><code><span title="Helpers for R package versions (1.2-3 style), which are freer than SemVer.">RVersion</span></code></a> | Helpers for R package versions (`1.2-3` style), which are freer than SemVer. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/r-version.ts#L178"><code><span title="Helpers for R package version ranges (DESCRIPTION constraints like >= 0.4-9).">RRange</span></code></a> | Helpers for R package version ranges (DESCRIPTION constraints like `>= 0.4-9`). |


<h2 id="Environments_and_resolution">Environments and resolution</h2>

From a name to what it may refer to, and from a node to what it may hold.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/environment.ts#L601"><code><span title="Helpers for navigating and manipulating environments around the global environment and attached-package search path.">REnvironment</span></code></a> | Helpers for navigating and manipulating <code>environments</code> around the global environment and attached-package search path. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/resolve-helper.ts#L37"><code><span title="The helper object for resolution: from a name to the definitions it may refer to, and from a node to the value(s) it may hold. Resolve.info and Resolve.infoOf state *where* to resolve, which everything below takes; from an analyzer that is one call, with no need to assemble the graph, the id map and the context by hand. Take the narrowest entry point that answers your question, they differ a lot i...">Resolve</span></code></a> | The helper object for resolution: from a name to the definitions it may refer to, and from a node to the value(s) it may hold. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/eval/resolve/node-value.ts#L41"><code><span title="The value(s) a node may hold. Every entry point resolves against either the state the current processor sees or a ResolveInfo , so a finished analysis asks the same questions in the same words, and takes overrides for the cases that deviate (e.g. another environment). This is constant propagation over the dataflow graph, not abstract interpretation: it follows definitions to constants and gives up...">NodeValue</span></code></a> | The value(s) a node may hold. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/internal/linker.ts#L504"><code><span title="The open references a function definition still carries into its closure.">ClosureRefs</span></code></a> | The open references a function definition still carries into its closure. |


<h2 id="The_dataflow_graph">The dataflow graph</h2>

What depends on what. `Dataflow` is the way in; the rest are the pieces it hands back.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/gas.ts#L30"><code><span title="Gas key for dataflow extraction. Unlike the keys above it is *armed* once per run (see ReadOnlyFlowrAnalyzerGasContext.budget ) and counted as the fold goes.">Dataflow</span></code></a> | Gas key for dataflow extraction. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/vertex.ts#L223"><code><span title="The one helper to ask a vertex what it is. Every check tolerates an absent vertex, which is what getVertex() hands back for an id the graph does not know.">DfgVertex</span></code></a> | The one helper to ask a <code>vertex</code> what it is. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/edge.ts#L109"><code><span title="Helper Functions to work with DfEdge and EdgeType .">DfEdge</span></code></a> | Helper Functions to work with <code>DfEdge</code> and <code>EdgeType</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/graph.ts#L44"><code><span title="Helper functions to work with FunctionArgument s. EmptyArgument marks an empty argument.">FunctionArgument</span></code></a> | Helper functions to work with <code>FunctionArgument</code> s. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/graph.ts#L162"><code><span title="Helpers for the UnknownSideEffect union, which is either a plain NodeId or a { id, linkTo } object. Use these instead of hand-rolling typeof x === 'object' ? x.id : x checks so the object/non-object discrimination lives in one place.">UnknownSideEffect</span></code></a> | Helpers for the <code>UnknownSideEffect</code> union, which is either a plain <code>NodeId</code> or a `{ id, linkTo }` object. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/info.ts#L42"><code><span title="Utility functions to work with control dependencies .">ControlDependency</span></code></a> | Utility functions to work with <code>control dependencies</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/info.ts#L262"><code><span title="Helper object for DataflowInformation">DataflowInformation</span></code></a> | Helper object for <code>DataflowInformation</code> |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/call-graph.ts#L282"><code><span title="Helper object for call-graphs, you can compute new call graphs based on CallGraph.compute .">CallGraph</span></code></a> | Helper object for call-graphs, you can compute new call graphs based on <code>CallGraph.compute</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/graph-helper.ts#L22"><code><span title="The underlying functions which work for any graph* like view. Use Dataflow for the dataflow graph and CallGraph for the call graph, both spread this object in.">GraphHelper</span></code></a> | The underlying functions which work for any graph* like view. |


<h2 id="Control_flow">Control flow</h2>

What may run after what.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/control-flow/control-flow-graph.ts#L81"><code><span title="Helper object for CfgVertex - a vertex in the ControlFlowGraph .">CfgVertex</span></code></a> | Helper object for <code>CfgVertex</code> - a vertex in the <code>ControlFlowGraph</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/control-flow/control-flow-graph.ts#L250"><code><span title="Helper object for CfgEdge - an edge in the ControlFlowGraph .">CfgEdge</span></code></a> | Helper object for <code>CfgEdge</code> - an edge in the <code>ControlFlowGraph</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/internal/control-flow.ts#L22"><code><span title="Records the control flow of a program in the DataflowGraph while the dataflow analysis walks it. The ControlFlowGraph is a view on what is recorded here. The control flow is modeled in post-order: everything a construct is made of runs before the construct itself, so its own vertex is where its parts join again and where it is left.">ControlFlow</span></code></a> | Records the control flow of a program in the <code>DataflowGraph</code> while the dataflow analysis walks it. |


<h2 id="What_a_function_and_its_calls_mean">What a function and its calls mean</h2>

What an analysis works out about a definition, and what one call of it amounts to.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/function-semantics.ts#L33"><code><span title="The one helper to ask what a function *does*: what it makes of its arguments, what it may raise, which formals it forces, and what it declares as a class. It replaces the seven single-purpose helper objects that used to sit one per file under src/dataflow/fn/.">FunctionSemantics</span></code></a> | The one helper to ask what a function *does*: what it makes of its arguments, what it may raise, which formals it forces, and what it declares as a class. |

One entry point covers both halves: `FunctionSemantics.props`, `FunctionSemantics.exceptions`, `FunctionSemantics.strictness` and their kin answer about a definition, while `FunctionSemantics.call` holds what flowR states about a call (`props`, `signature`, `argument`), how R binds its arguments (`match`), and which of them it does not simply evaluate (`nse`, `quoted`, `deferred`).


<h2 id="Asking_flowR_something">Asking flowR something</h2>

The APIs an analysis is written against.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/query.ts#L447"><code><span title="Running queries and reading what they reported, without Object.entries and the casts it forces. Reading changes nothing: the results keep the shape they are serialized in.">Query</span></code></a> | Running queries and reading what they reported, without `Object.entries` and the casts it forces. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/search/flowr-search-builder.ts#L42"><code><span title="This object holds all the methods to generate search queries. For compatibility, please use the Q identifier object to access these methods.">FlowrSearchGenerator</span></code></a> | This object holds all the methods to generate search queries. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/query-function-filter.ts#L15"><code><span title="Resolves the function filter shared by the inspection queries (inspect-*).">QueryFunctionFilter</span></code></a> | Resolves the function filter shared by the inspection queries (`inspect-*`). |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/happens-before-query/happens-before-query-format.ts#L24"><code><span title="How an answer of the HappensBeforeQuery is keyed: the two criteria it was asked about, so that both the executor writing an answer and anyone reading one spell the key the same way.">HappensBeforeKey</span></code></a> | How an answer of the <code>HappensBeforeQuery</code> is keyed: the two criteria it was asked about, so that both the executor writing an answer and anyone reading one spell the key the same way. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/linter-format.ts#L179"><code><span title="Helper functions for working with LintingResults .">LintingResults</span></code></a> | Helper functions for working with <code>LintingResults</code> . |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/linter-format.ts#L103"><code><span title="Helper for working with quick fixes .">LintQuickFix</span></code></a> | Helper for working with <code>quick fixes</code> . |


<h2 id="The_project_and_its_configuration">The project and its configuration</h2>

What is being analyzed, and under which settings.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/config.ts#L523"><code><span title="flowR's configuration: its default, reading one from disk, and getting or setting a single value at a dotted path (an EngineConfigPath included).">FlowrConfig</span></code></a> | flowR's configuration: its default, reading one from disk, and getting or setting a single value at a dotted path (an <code>EngineConfigPath</code> included). |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-description-file-plugin.ts#L13"><code><span title="Access to the DESCRIPTION file of the analyzed project.">DescriptionFile</span></code></a> | Access to the `DESCRIPTION` file of the analyzed project. |


<h2 id="Output">Output</h2>

Turning any of the above into something to look at.

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/mermaid/mermaid.ts#L7"><code><span title="Global mermaid helper object with useful functions.">Mermaid</span></code></a> | Global mermaid helper object with useful functions. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/mermaid/dfg.ts#L362"><code><span title="The helper object for all things regarding the mermaid based visualization of dataflow graphs!">DataflowMermaid</span></code></a> | The helper object for all things regarding the mermaid based visualization of dataflow graphs! |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/record.ts#L4"><code><span title="Helper for transforming records.">Record</span></code></a> | Helper for transforming records. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/cli/repl/commands/repl-clipboard.ts#L4"><code><span title="Output that the user most likely wants on their clipboard as well.">ReplClipboard</span></code></a> | Output that the user most likely wants on their clipboard as well. |

