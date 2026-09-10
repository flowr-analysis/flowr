_<span title="an overview of flowR's helper objects, by what they are about">Generated</span> from '[wiki-helper-objects.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-helper-objects.ts "src/documentation/wiki-helper-objects.ts")' on 2026-09-09, 15:40:41 UTC (v2.15.8, R v4.6.1), do not edit directly._


This page lists every important helper object of flowR.

- [Normalized AST](#Normalized_AST)
- [Dataflow graph](#Dataflow_graph)
- [Control flow graph](#Control_flow_graph)
- [Location](#Location)
- [Names and values](#Names_and_values)
- [Asking flowR](#Asking_flowR)
- [Configuration and context](#Configuration_and_context)
- [Output](#Output)
- [Adding a helper object](#Adding_a_helper_object)

<h2 id="Normalized_AST">Normalized AST</h2>

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/ast/model/model.ts#L280"><code><span title="Helper object to provide helper functions for RNodes . For the individual type checks, please consult the individual vertices, e.g. RPipe.is . Some vertices also have a RPipe.availableFromRVersion property that indicates from which R version they are available, so you can check for that as well if needed.">RNode</span></code></a> | Helper object to provide helper functions for RNodes. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/ast/model/nodes/r-project.ts#L37"><code><span title="Helper object to identify RProject nodes by their type and to provide related functions.">RProject</span></code></a> | Helper object to identify RProject nodes by their type and to provide related functions. |

<h2 id="Dataflow_graph">Dataflow graph</h2>

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/call-graph.ts#L283"><code><span title="Helper object for call-graphs, you can compute new call graphs based on CallGraph.compute .">CallGraph</span></code></a> | Helper object for call-graphs, you can compute new call graphs based on CallGraph.compute. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/info.ts#L43"><code><span title="Utility functions to work with control dependencies .">ControlDependency</span></code></a> | Utility functions to work with control dependencies. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/gas.ts#L30"><code><span title="Gas key for dataflow extraction. Unlike the keys above it is *armed* once per run (see ReadOnlyFlowrAnalyzerGasContext.budget ) and counted as the fold goes.">Dataflow</span></code></a> | This is the root helper object to work with the DataflowGraph. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/info.ts#L264"><code><span title="Helper object for DataflowInformation .">DataflowInformation</span></code></a> | Helper object for DataflowInformation. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/edge.ts#L110"><code><span title="Helper Functions to work with DfEdge and EdgeType .">DfEdge</span></code></a> | Helper Functions to work with DfEdge and EdgeType. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/vertex.ts#L226"><code><span title="The one helper to ask a vertex what it is. Every check tolerates an absent vertex, which is what getVertex() hands back for an id the graph does not know.">DfgVertex</span></code></a> | The one helper to ask a vertex what it is. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/graph.ts#L47"><code><span title="Helper functions to work with FunctionArguments . EmptyArgument marks an empty argument.">FunctionArgument</span></code></a> | Helper functions to work with FunctionArguments. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/graph-helper.ts#L23"><code><span title="The underlying functions which work for any graph* like view. Use Dataflow for the dataflow graph and CallGraph for the call graph, both spread this object in.">GraphHelper</span></code></a> | The underlying functions which work for any graph* like view. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/graph/graph.ts#L166"><code><span title="Helpers for the UnknownSideEffect union, which is either a plain NodeId or a { id, linkTo } object. Use these instead of hand-rolling typeof x === 'object' ? x.id : x checks so the object/non-object discrimination lives in one place.">UnknownSideEffect</span></code></a> | Helpers for the UnknownSideEffect union, which is either a plain NodeId or a `{ id, linkTo }` object. |

<h2 id="Control_flow_graph">Control flow graph</h2>

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/control-flow/control-flow-graph.ts#L252"><code><span title="Helper object for CfgEdge - an edge in the ControlFlowGraph .">CfgEdge</span></code></a> | Helper object for CfgEdge - an edge in the ControlFlowGraph. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/control-flow/control-flow-graph.ts#L82"><code><span title="Helper object for CfgVertex - a vertex in the ControlFlowGraph .">CfgVertex</span></code></a> | Helper object for CfgVertex - a vertex in the ControlFlowGraph. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/internal/control-flow.ts#L23"><code><span title="Records the control flow of a program in the DataflowGraph while the dataflow analysis walks it. The ControlFlowGraph is a view on what is recorded here. The control flow is modeled in post-order: everything a construct is made of runs before the construct itself, so its own vertex is where its parts join again and where it is left.">ControlFlow</span></code></a> | Records the control flow of a program in the DataflowGraph while the dataflow analysis walks it. |

<h2 id="Location">Location</h2>

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/ast/model/processing/node-id.ts#L33"><code><span title="What a NodeId is: the identity of a node within one analysis, plus the built-in and pkg::fn names encoded as one, and the ways to read a name back out of it.">NodeId</span></code></a> | What a NodeId is: the identity of a node within one analysis, plus the built-in and `pkg::fn` names encoded as one, and the ways to read a name back out of it. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/text/playground-link.ts#L134"><code><span title="Everything about flowR's playground that is not the page itself: what a link to it carries, and how one is written. The page reads back exactly what Playground.link writes.">Playground</span></code></a> | Everything about flowR's playground that is not the page itself: what a link to it carries, and how one is written. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/files.ts#L168"><code><span title="Paths as R spells them on every OS: forward slashes throughout, which R accepts on Windows as well and which survive interpolation into an R string literal, where a raw \\ would escape.">RPath</span></code></a> | Paths as R spells them on every OS, with forward slashes throughout. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/slicing/criterion/parse.ts#L26"><code><span title="The helper object for slicing criteria: parsing, validating and resolving them, one ( SlicingCriterion.parse ) or several ( SlicingCriterion.decodeAll ) at a time.">SlicingCriterion</span></code></a> | The helper object for slicing criteria: parsing, validating and resolving them, one (SlicingCriterion.parse) or several (SlicingCriterion.decodeAll) at a time. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/range.ts#L312"><code><span title="Utility functions for source locations . As every SourceRange is a location without a file, the readers of SourceRange apply to locations as well; the ones re-exported here save you the detour via SourceLocation.getRange .">SourceLocation</span></code></a> | Utility functions for source locations. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/range.ts#L64"><code><span title="Utility functions for source ranges .">SourceRange</span></code></a> | Utility functions for source ranges. |

<h2 id="Names_and_values">Names and values</h2>

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/identifier.ts#L50"><code><span title="Helper functions to work with identifiers . Use Identifier.matches to check if two identifiers match according to R's scoping rules!">Identifier</span></code></a> | Helper functions to work with identifiers. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/convert-values.ts#L93"><code><span title="What an RNumberValue is: R's number as it was written, its integer marker (1L) and its complex flag (1i) included.">RNumberValue</span></code></a> | What an RNumberValue is: R's number as it was written, its integer marker (`1L`) and its complex flag (`1i`) included. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/r-version.ts#L184"><code><span title="Helpers for R package version ranges (DESCRIPTION constraints like >= 0.4-9).">RRange</span></code></a> | Helpers for R package version ranges (DESCRIPTION constraints like `>= 0.4-9`). |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/lang-4.x/convert-values.ts#L163"><code><span title="Checks whether the given string is an R string literal (including raw strings).">RStringValue</span></code></a> | Checks whether the given string is an R string literal (including raw strings). |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/eval/values/r-value.ts#L177"><code><span title="Reads the plain TS value a Value stands for, undefined whenever it stands for more than one, for none, or for another kind. Prefer these over reaching into a value's shape by hand. This is the constant-folding view: it answers 'is this one known constant' and nothing else. It runs no fixpoint, knows no control flow, and widens nothing. For an abstract state that does, use the dedicated abstract in...">RValue</span></code></a> | Reads the plain TS value a Value stands for, `undefined` whenever it stands for more than one, for none, or for another kind. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/r-version.ts#L97"><code><span title="Helpers for R package versions (1.2-3 style), which are freer than SemVer.">RVersion</span></code></a> | Helpers for R package versions (`1.2-3` style), which are freer than SemVer. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/logic.ts#L13"><code><span title="Always, never, or maybe, which is what a static answer about a running program usually is. Its operators keep maybe infectious, so a conclusion never claims more than what is known.">TernaryLogic</span></code></a> | Always, never, or maybe, which is what a static answer about a running program usually is. |

<h2 id="Asking_flowR">Asking flowR</h2>

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/internal/linker.ts#L567"><code><span title="The open references a function definition still carries into its closure.">ClosureRefs</span></code></a> | The open references a function definition still carries into its closure. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/search/flowr-search-builder.ts#L43"><code><span title="This object holds all the methods to generate search queries. For compatibility, please use the Q identifier object to access these methods.">FlowrSearchGenerator</span></code></a> | This object holds all the methods to generate search queries. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/fn/function-semantics.ts#L34"><code><span title="The one helper to ask what a function *does*: what it makes of its arguments, what it may raise, which formals it forces, and what it declares as a class. It replaces the seven single-purpose helper objects that used to sit one per file under src/dataflow/fn/.">FunctionSemantics</span></code></a> | The one helper to ask what a function *does*: what it makes of its arguments, what it may raise, which formals it forces, and what it declares as a class. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/catalog/happens-before-query/happens-before-query-format.ts#L25"><code><span title="How an answer of the HappensBeforeQuery is keyed: the two criteria it was asked about, so that both the executor writing an answer and anyone reading one spell the key the same way.">HappensBeforeKey</span></code></a> | How an answer of the HappensBeforeQuery is keyed: the two criteria it was asked about, so that both the executor writing an answer and anyone reading one spell the key the same way. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/linter-format.ts#L185"><code><span title="Helper functions for working with LintingResults .">LintingResults</span></code></a> | Helper functions for working with LintingResults. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/linter/linter-format.ts#L108"><code><span title="Helper for working with quick fixes .">LintQuickFix</span></code></a> | Helper for working with quick fixes. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/eval/resolve/node-value.ts#L42"><code><span title="The value(s) a node may hold. Every entry point resolves against either the state the current processor sees or a ResolveInfo , so a finished analysis asks the same questions in the same words, and takes overrides for the cases that deviate (e.g. another environment). This is constant propagation over the dataflow graph, not abstract interpretation: it follows definitions to constants and gives up...">NodeValue</span></code></a> | The value(s) a node may hold. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/query.ts#L454"><code><span title="Running queries and reading what they reported, without Object.entries and the casts it forces. Reading changes nothing: the results keep the shape they are serialized in.">Query</span></code></a> | Running queries and reading what they reported, without `Object.entries` and the casts it forces. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/queries/query-function-filter.ts#L16"><code><span title="Resolves the function filter shared by the inspection queries (inspect-*).">QueryFunctionFilter</span></code></a> | Resolves the function filter shared by the inspection queries (`inspect-*`). |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/environment.ts#L609"><code><span title="Helpers for navigating and manipulating environments around the global environment and attached-package search path.">REnvironment</span></code></a> | Helpers for navigating and manipulating environments around the global environment and attached-package search path. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/dataflow/environments/resolve-helper.ts#L38"><code><span title="The helper object for resolution: from a name to the definitions it may refer to, and from a node to the value(s) it may hold. Resolve.info and Resolve.infoOf state *where* to resolve, which everything below takes; from an analyzer that is one call, with no need to assemble the graph, the id map and the context by hand. Take the narrowest entry point that answers your question, they differ a lot i...">Resolve</span></code></a> | The helper object for resolution: from a name to the definitions it may refer to, and from a node to the value(s) it may hold. |

<h2 id="Configuration_and_context">Configuration and context</h2>

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-description-file-plugin.ts#L16"><code><span title="Access to the DESCRIPTION file of the analyzed project.">DescriptionFile</span></code></a> | Access to the `DESCRIPTION` file of the analyzed project. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/config.ts#L538"><code><span title="flowR's configuration: its default, reading one from disk, and getting or setting a single value at a dotted path (an EngineConfigPath included).">FlowrConfig</span></code></a> | flowR's configuration: its default, reading one from disk, and getting or setting a single value at a dotted path (an EngineConfigPath included). |

<h2 id="Output">Output</h2>

| helper | what it is |
| :-- | :-- |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/mermaid/dfg.ts#L363"><code><span title="The helper object for all things regarding the mermaid based visualization of dataflow graphs!">DataflowMermaid</span></code></a> | The helper object for all things regarding the mermaid based visualization of dataflow graphs! |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/mermaid/mermaid.ts#L8"><code><span title="Global mermaid helper object with useful functions.">Mermaid</span></code></a> | Global mermaid helper object with useful functions. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/util/record.ts#L5"><code><span title="Helper for transforming records.">Record</span></code></a> | Helper for transforming records. |
| <a href="https://github.com/flowr-analysis/flowr/tree/main/src/cli/repl/commands/repl-clipboard.ts#L7"><code><span title="Output that the user most likely wants on their clipboard as well.">ReplClipboard</span></code></a> | Output that the user most likely wants on their clipboard as well. |

<h2 id="Adding_a_helper_object">Adding a helper object</h2>

Give the doc comment of the object an `@helper <category>` tag. The category is one of
`ast`, `dataflow`, `control-flow`, `location`, `values`, `api`, `project`, `output`. The table shows the first sentence of the doc comment itself;
write `@helper <category> <what it is>` only when the table should say something else.
