_<span title="an overview of flowR's query API">Generated</span> from '[wiki-query.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-query.ts "src/documentation/wiki-query.ts")' on 2026-11-15, 09:20:10 UTC (v2.17.6, R v4.6.1), do not edit directly._

This page briefly summarizes flowR's query API, represented by the executeQueries function in [`./src/queries/query.ts`](https://github.com/flowr-analysis/flowr/tree/main/src/queries/query.ts).
Please see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page for more information on how to access this API.
In code, you run queries with <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L362"><code>FlowrAnalyzer::<b>query</b></code></a>.
Pass it a single query object, and it answers with the result of that query directly, which is the most common case and also the fastest, as there is nothing to group.
For queries that report one entry per query (e.g., the [Static Slice Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Static-Slice)), the result is just that entry.
A failing single query throws an error.

```ts
const { slice, reconstruct } = await analyzer.query({ type: 'static-slice', criteria: ['3@x'] });
```

Pass it a list of queries, and it answers with a record of the results by query type.
Queries of the same type run together, and a failing query type is reported as an error without affecting the others:

```ts
const results = await analyzer.query([{ type: 'id-map' }, { type: 'dataflow' }]);
const graph = results.dataflow.graph;
```

> [!NOTE]
> There are many ways to query a dataflow graph created by flowR.
> For example, you can use the [`request-query`](https://github.com/flowr-analysis/flowr/wiki/Interface#message-request-query) message
> with a running flowR server, or the <span title="Description (Repl Command): Query the given R code (use 'help' for more information)">`:query`</span> command in the flowR [REPL](https://github.com/flowr-analysis/flowr/wiki/Interface#-using-the-repl).
> 
> Also, check out the [flowr-analysis/sample-analyzer-project-query](https://github.com/flowr-analysis/sample-analyzer-project-query) repository for a complete example project using the query API.

## The Query Format

Queries are JSON arrays of query objects, each of which uses a `type` property to specify the query type.
In general, we separate two types of queries:

1. **Active Queries**: Are exactly what you would expect from a query (e.g., the [Call-Context Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Call-Context)). They fetch information from the dataflow graph.
2. **Virtual Queries**: Are used to structure your queries (e.g., the [Compound Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Compound)).

We support the following **active** queries (which we refer to as a `query`):

1. [Abstract Interpretation Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Abstract-Interpretation) (`absint`):\
    Returns the abstract values inferred for every expression or at specific locations.
1. [Ambient Access Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Ambient-Access) (`ambient-access`):\
    What code reads and writes of the global state
1. [Call-Context Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Call-Context) (`call-context`):\
    Finds all calls in a set of files that matches specified criteria.
1. [Call-Graph Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Call-Graph) (`call-graph`):\
    Returns the call graph of the given code.
1. [Code Clones Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Code-Clones) (`code-clones`):\
    Finds code clones in all analyzed files with a configurable selection of AST, token, and fingerprint based algorithms.
1. [Config Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Config) (`config`):\
    Returns the current configuration of flowR.
1. [Control-Flow Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Control-Flow) (`control-flow`):\
    Provides the control-flow of the program.
1. [Data Columns Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Data-Columns) (`data-columns`):\
    Returns the columns of a data frame that can be written at a position, as an editor offers them to complete.
1. [Dataflow Cluster Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Dataflow-Cluster) (`dataflow-cluster`):\
    Calculates and returns all the clusters present in the dataflow graph.
1. [Dataflow Lens Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Dataflow-Lens) (`dataflow-lens`):\
    Returns a simplified view on the dataflow graph, reduced to definitions, uses, and calls.
1. [Dataflow Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Dataflow) (`dataflow`):\
    Returns the dataflow graph of the given code.
1. [Dependencies Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Dependencies) (`dependencies`):\
    Returns all direct dependencies (in- and outputs) of a given R script
1. [Dice Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Dice) (`dice`):\
    Reduces the code to the parts that carry information from a given start point to a given end point.
1. [Does-Call Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Does-Call) (`does-call`):\
    Checks whether a function calls another function matching given constraints.
1. [Files Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Files) (`files`):\
    Returns the files matching the given criteria.
1. [Function Info Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Function-Info) (`function-info`):\
    Reports where a function name comes from: which packages export it, their signature, and whether flowR itself has a built-in definition for it.
1. [Guess Dependency Versions Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Guess-Dependency-Versions) (`guess-dep-versions`):\
    Guesses the version range each dependency must have, from declared constraints and actual code usage.
1. [Happens-Before Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Happens-Before) (`happens-before`):\
    Check whether one normalized AST node happens before another in the CFG.
1. [Id-Map Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Id-Map) (`id-map`):\
    Returns the id-map of the normalized AST of the given code.
1. [Input Sources Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Input-Sources) (`input-sources`):\
    Classify the input sources of function calls
1. [Inspect Argument Roles Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Inspect-Argument-Roles) (`inspect-fn-props`):\
    Determine what functions and their formals do
1. [Inspect Exceptions of Functions Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Inspect-Exceptions-of-Functions) (`inspect-exception`):\
    Determine whether functions throw exceptions (known to flowR)
1. [Inspect Function Guards Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Inspect-Function-Guards) (`inspect-fn-guards`):\
    Infer what functions ask of the calls they return from
1. [Inspect Higher-Order Functions Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Inspect-Higher-Order-Functions) (`inspect-higher-order`):\
    Determine whether functions are higher-order functions
1. [Inspect Recursive Functions Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Inspect-Recursive-Functions) (`inspect-recursion`):\
    Determine whether functions are recursive
1. [Linter Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Linter) (`linter`):\
    Lints a given R script for common issues.
1. [Location Map Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Location-Map) (`location-map`):\
    Returns a simple mapping of ids to their location in the source file
1. [Normalized AST Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Normalized-AST) (`normalized-ast`):\
    Returns the normalized AST of the given code.
1. [Origin Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Origin) (`origin`):\
    Retrieve the origin of a variable, function call, ...
1. [Project Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Project) (`project`):\
    Returns information about the analyzed project
1. [Provenance Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Provenance) (`provenance`):\
    Calculate the provenance of a given variable, optionally restricted to its enveloping fdef
1. [Resolve Value Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Resolve-Value) (`resolve-value`):\
    Provides access to flowR's value tracking (which is configurable)
1. [Search Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Search) (`search`):\
    Provides access to flowR's search API
1. [Signature Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Signature) (`signature`):\
    Inspects the signature database: packages, function signatures, source and documentation links.
1. [Static Slice Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Static-Slice) (`static-slice`):\
    Slice the dataflow graph reducing the code to just the parts relevant for the given criteria (backward and forward).
1. [Taint Analysis Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Taint-Analysis) (`taint`):\
    Returns the taint values inferred for every expression.

Similarly, we support the following **virtual** queries: 

1. [Compound Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Compound) (`compound`):\
    Combines multiple queries of the same type into one, specifying common arguments.

<details>

<summary>Detailed Query Format (Automatically Generated)</summary>

The schema of the query format:

- _Queries to run on the file analysis information (in the form of an array)_ (array)
Valid item types:
    - _A virtual or an active query!_ (alternatives)
        - _Supported queries_ (alternatives)
            - _Call context query used to find calls in the dataflow graph_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'call-context'
                - **callName** [required] _Regex regarding the function name!_ (string)
                - **callNameExact** [optional] _Should we automatically add the `^` and `$` anchors to the regex to make it an exact match?_ (boolean)
                - **kind** [optional] _The kind of the call, this can be used to group calls together (e.g., linking `plot` to `visualize`). Defaults to `.`_ (string)
                - **subkind** [optional] _The subkind of the call, this can be used to uniquely identify the respective call type when grouping the output (e.g., the normalized name, linking `ggplot` to `plot`). Defaults to `.`_ (string)
                - **callTargets** [optional] _Call targets the function may have. This defaults to `any`. Request this specifically to gain all call targets we can resolve._ (string)
                    Only allows: 'global', 'must-include-global', 'local', 'must-include-local', 'any'
                - **callTargetNamespace** [optional] _Only keep calls that resolve to (or are explicitly qualified with) this package (e.g. `bar` to find `bar::foo`)._ (string)
                - **ignoreParameterValues** [optional] _Should we ignore default values for parameters in the results?_ (boolean)
                - **includeAliases** [optional] _Consider a case like `f <- function_of_interest`, do you want uses of `f` to be included in the results?_ (boolean)
                - **fileFilter** [optional] _Filter that, when set, a node's file attribute must match to be considered_ (object)
                    - **fileFilter** [required] _Regex that a node's file attribute must match to be considered_ (string)
                    - **includeUndefinedFiles** [optional] _If `fileFilter` is set, but a nodes `file` attribute is `undefined`, should we include it in the results? Defaults to `true`._ (boolean)
                - **linkTo** [optional] _Links the current call to the last call of the given kind. This way, you can link a call like `points` to the latest graphics plot etc._ (alternatives)
                    - (alternatives)
                        - _Links the current call to the last call of the given kind. This way, you can link a call like `points` to the latest graphics plot etc._ (object)
                            - **type** [required] _The type of the linkTo sub-query._ (string)
                                Only allows: 'link-to-last-call'
                            - **callName** [required] _Test regarding the function name of the last call. Similar to `callName`, strings are interpreted as a regular expression, and string arrays are checked for containment._ (alternatives)
                                - (string)
                                - (array)
                                Valid item types:
                                    - (string)
                            - **ignoreIf** [optional] _Should we ignore this (source) call? Currently, there is no well working serialization for this._ (function)
                            - **cascadeIf** [optional] _Should we continue searching after the link was created? Currently, there is no well working serialization for this._ (function)
                            - **attachLinkInfo** [optional] _Additional information to attach to the link._ (object)
                        - _Allows to link nested calls to their parent calls. This way, you can link an `assert_equal` call to the parent `test_that` call etc._ (object)
                            - **type** [required] _The type of the linkTo sub-query._ (string)
                                Only allows: 'link-to-nested-call'
                            - **callName** [required] _Test regarding the function name of the last call. Similar to `callName`, strings are interpreted as a regular expression, and string arrays are checked for containment._ (alternatives)
                                - (string)
                                - (array)
                                Valid item types:
                                    - (string)
                            - **ignoreIf** [optional] _Should we ignore this (source) call? Currently, there is no well working serialization for this._ (function)
                            - **attachLinkInfo** [optional] _Additional information to attach to the link._ (object)
                    - (array)
                    Valid item types:
                        - (alternatives)
                            - _Links the current call to the last call of the given kind. This way, you can link a call like `points` to the latest graphics plot etc._ (object)
                                - **type** [required] _The type of the linkTo sub-query._ (string)
                                    Only allows: 'link-to-last-call'
                                - **callName** [required] _Test regarding the function name of the last call. Similar to `callName`, strings are interpreted as a regular expression, and string arrays are checked for containment._ (alternatives)
                                    - (string)
                                    - (array)
                                    Valid item types:
                                        - (string)
                                - **ignoreIf** [optional] _Should we ignore this (source) call? Currently, there is no well working serialization for this._ (function)
                                - **cascadeIf** [optional] _Should we continue searching after the link was created? Currently, there is no well working serialization for this._ (function)
                                - **attachLinkInfo** [optional] _Additional information to attach to the link._ (object)
                            - _Allows to link nested calls to their parent calls. This way, you can link an `assert_equal` call to the parent `test_that` call etc._ (object)
                                - **type** [required] _The type of the linkTo sub-query._ (string)
                                    Only allows: 'link-to-nested-call'
                                - **callName** [required] _Test regarding the function name of the last call. Similar to `callName`, strings are interpreted as a regular expression, and string arrays are checked for containment._ (alternatives)
                                    - (string)
                                    - (array)
                                    Valid item types:
                                        - (string)
                                - **ignoreIf** [optional] _Should we ignore this (source) call? Currently, there is no well working serialization for this._ (function)
                                - **attachLinkInfo** [optional] _Additional information to attach to the link._ (object)
            - _The config query retrieves the current configuration of the flowR instance and optionally also updates it._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'config'
                - **update** [optional] _An optional partial configuration to update the current configuration with before returning it. Only the provided fields will be updated, all other fields will remain unchanged._ (object)
                - **inspect** [optional] _An optional `.`-separated path (as a string array) to read a single configuration value instead of returning the whole configuration._ (array)
                Valid item types:
                    - (string)
                - **reset** [optional] _If true, discard every prior update and revert to the config the analyzer was created with, before returning it._ (boolean)
            - _The control flow query provides the control flow graph of the analysis, optionally simplified._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'control-flow'
                - **config** [optional] _Optional configuration for the control flow query._ (object)
                    - **simplificationPasses** _The simplification passes to apply to the control flow graph. If unset, the default simplification order will be used._ (array)
                    Valid item types:
                        - (string)
                            Only allows: 'unique-cf-sets', 'analyze-dead-code', 'remove-dead-code', 'to-basic-blocks'
            - _A query to compute the Call Graph of the analyzed project._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'call-graph'
                - **expandLibraryInternals** [optional] _Expand library/built-in leaf calls into their internal callees via the signature database (default false)._ (boolean)
                - **reportUnreachable** [optional] _Also report the calls that top-level execution never reaches (default false)._ (boolean)
            - _The dataflow query simply returns the dataflow graph, there is no need to pass it multiple times!_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'dataflow'
                - **environments** [optional] _Whether to include the environments of the vertices and function definitions (default: true). They make up most of the answer, so leave them out if only the graph itself is of interest._ (boolean)
            - _Either returns all function definitions alongside whether they are recursive, or just those matching the filters._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'does-call'
                - **queryId** [optional] _An optional unique identifier for this query, to identify it in the output._ (string)
                - **call** _The function from which calls are being made. This is a slicing criterion that resolves to a function definition node._ (string)
                - **calls** [required] _The constraints on which functions are being called. This can be a combination of name-based or id-based constraints, combined with logical operators (and, or, one-of)._ (object)
                - **expandLibraryInternals** [optional] _Expand a reached library/built-in leaf call into its internal callees via the signature database and match constraints against those too (default false)._ (boolean)
            - _The dataflow-lens query returns a simplified view on the dataflow graph_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'dataflow-lens'
            - _The abstract interpretation query retrieves inferred abstract values_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'absint'
                - **inference** [required] _The type of abstract interpretation inference._ (string)
                    Only allows: 'df-shape'
                - **criteria** [optional] _The slicing criteria of the nodes to get the inferred abstract values for._ (array)
                Valid item types:
                    - (string)
            - _The taint query conducts taint analyses and returns their results._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'taint'
                - **defs** _The taint analyses to run._ (array)
            - _The file query finds files in the project based on their roles and path patterns._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'files'
                - **roles** [optional] _Optional roles of the files to query. If not provided, all roles are considered._ (array)
                Valid item types:
                    - (string)
                        Only allows: 'description', 'namespace', 'news', 'vignette', 'test', 'install', 'data', 'documentation', 'license', 'virtual-env', 'manifest', 'startup', 'environment', 'source', 'other'
                - **matchesPathRegex** [optional] _An optional regular expression to match the file paths against._ (string)
            - _The id map query retrieves the id map from the normalized AST._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'id-map'
            - _The normalized AST query simply returns the normalized AST, there is no need to pass it multiple times!_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'normalized-ast'
            - _The cluster query calculates and returns all clusters in the dataflow graph._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'dataflow-cluster'
            - _Slice query used to slice the dataflow graph_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'static-slice'
                - **criteria** [required] _The slicing criteria to use._ (array)
                Valid item types:
                    - (string)
                - **direction** [optional] _The direction to slice in. Defaults to backward slicing if unset._ (string)
                    Only allows: 'backward', 'forward'
                - **removal** [optional] _Compute the removal slice instead: the code that only exists for the criteria, which can go while the rest keeps working. The result holds the removed statements, the reconstruction the program without them._ (boolean)
                - **name** [optional] _What to call this slice: the results are keyed by it instead of by the serialized query._ (string)
                - **noReconstruction** [optional] _Do not reconstruct the slice into readable code._ (boolean)
                - **noMagicComments** [optional] _Should the magic comments (force-including lines within the slice) be ignored?_ (boolean)
                - **inlineSources** [optional] _Inline resolvable source() calls into the reconstruction so the result is a single self-contained R text; "banner" marks where each spliced file begins and ends with a banner comment naming it._ (alternatives)
                    - (boolean)
                    - (string)
                        Only allows: 'banner'
                - **inlineFull** [optional] _Inline all files into the reconstruction, in flowR's loading order and independent of whether they are sourced explicitly; "banner" precedes every file with a banner comment naming it._ (alternatives)
                    - (boolean)
                    - (string)
                        Only allows: 'banner'
                - **includeCallees** [optional] _If set (and slicing backward), continue the slice past a function-definition boundary, also including the definition's binding and call sites._ (boolean)
                - **perFile** [optional] _Reconstruct the slice as the project's files, reported in `reconstruct.files` in loading order with their paths, instead of only the entry file._ (boolean)
                - **reportPackages** [optional] _Also report the packages the slice calls into, i.e. what this selection needs installed rather than what the whole program loads._ (boolean)
            - _Provenance query definition_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'provenance'
                - **criterion** [required] _The slicing criterion to use._ (string)
                - **restrictFdef** [required] _Whether to stop on fdef boundaries._ (boolean)
            - _Input Sources query definition_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'input-sources'
                - **criterion** [required] _The slicing criterion or array of criteria to use._ (alternatives)
                    - (string)
                    - (array)
                    Valid item types:
                        - (string)
                - **config** [optional] (object)
                    - **pure** [optional] _Deterministic/pure functions: functions that preserve constantness of their inputs (e.g., arithmetic, parse)._ (array)
                    Valid item types:
                        - (string)
                    - **file** [optional] _Functions that read from the filesystem and produce data (e.g., read.csv, readRDS)._ (array)
                    Valid item types:
                        - (string)
                    - **tempfile** [optional] _Functions that produce a temporary file path, which on its own touches no file system (e.g., tempfile, tempdir)._ (array)
                    Valid item types:
                        - (string)
                    - **glob** [optional] _Functions that answer with the paths they match at run time (e.g., list.files, Sys.glob)._ (array)
                    Valid item types:
                        - (string)
                    - **net** [optional] _Functions that fetch data from the network (e.g., download.file, url connections)._ (array)
                    Valid item types:
                        - (string)
                    - **rand** [optional] _Functions that produce randomness (e.g., runif, rnorm)._ (array)
                    Valid item types:
                        - (string)
                    - **system** [optional] _Functions that execute system commands (e.g., system, system2, shell, pipe)._ (array)
                    Valid item types:
                        - (string)
                    - **ffi** [optional] _Functions that call native code via the R FFI (.C, .Call, .Fortran, .External, dyn.load)._ (array)
                    Valid item types:
                        - (string)
                    - **lang** [optional] _Functions that produce language objects (e.g., substitute, quote, bquote, expression)._ (array)
                    Valid item types:
                        - (string)
                    - **options** [optional] _Functions that access or set global options (e.g., options, getOption)._ (array)
                    Valid item types:
                        - (string)
                    - **cmdline** [optional] _Functions that hand back what the program was invoked with (e.g., commandArgs)._ (array)
                    Valid item types:
                        - (string)
                    - **user** [optional] _Functions that read interactive user input (e.g., file.choose, readline, menu, askYesNo)._ (array)
                    Valid item types:
                        - (string)
                    - **sanitizers** [optional] _Functions whose result counts as a derived constant whatever flows in (e.g., an escaping function)._ (array)
                    Valid item types:
                        - (string)
                    - **evaluating** [optional] _Functions that evaluate code or look up names at run time, whose result is unknown (e.g., eval, do.call, exists)._ (array)
                    Valid item types:
                        - (string)
                    - **editing** [optional] _Functions that cut or replace parts of a string, undoing what a sanitizer escaped (e.g., gsub, substr)._ (array)
                    Valid item types:
                        - (string)
                    - **linkedObjects** [optional] _Objects a framework provides without a definition in the code, e.g. shiny's input._ (array)
                    Valid item types:
                        - (object)
                            - **name** [required] _Name of the object, e.g. input._ (string)
                            - **type** [required] _How reads of the object (or of its fields) are classified._ (string)
                                Only allows: 'param', 'file', 'tempfile', 'glob', 'net', 'rand', 'system', 'ffi', 'lang', 'options', 'cmdline', 'user', 'const', 'scope', 'dconst', 'unknown'
                            - **withParams** [optional] _Only link the object if the function binding it declares all of these parameters as well._ (array)
                            Valid item types:
                                - (string)
                    - **linkedEntryPoints** [optional] _Calls that hand a function to a framework, which binds its objects to the parameters by position._ (array)
                    Valid item types:
                        - (object)
                            - **call** [required] _The call taking the function, e.g. shiny::shinyApp._ (string)
                            - **argName** [required] _Name of the argument holding the function._ (string)
                            - **argIdx** [required] _Index of that argument when it is passed positionally._ (number)
                            - **params** [required] _Which linkedObject the framework binds to each parameter, by position._ (array)
                            Valid item types:
                                - (string)
                                    Only allows: 'null'
            - _The dependencies query retrieves and returns the set of all dependencies in the dataflow graph, which includes libraries, sourced files, read data, and written data._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'dependencies'
                - **ignoreDefaultFunctions** [optional] _Should the set of functions that are detected by default be ignored/skipped? Defaults to false._ (boolean)
                - **libraryFunctions** [optional] _The set of library functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **remoteFunctions** [optional] _The set of remote functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **sourceFunctions** [optional] _The set of source functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **readFunctions** [optional] _The set of read functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **writeFunctions** [optional] _The set of write functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **visualizeFunctions** [optional] _The set of visualize functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **transformFunctions** [optional] _The set of transform functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **testFunctions** [optional] _The set of test functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **statisticsFunctions** [optional] _The set of statistics functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **interactiveFunctions** [optional] _The set of interactive functions to search for._ (array)
                Valid item types:
                    - (object)
                        - **name** [required] _The name of the library function._ (string)
                        - **package** [optional] _The package name of the library function_ (string)
                        - **argIdx** [optional] _The index of the argument that contains the library name._ (number)
                        - **argName** [optional] _The name of the argument that contains the library name._ (string)
                - **enabledCategories** [optional] _A set of flags that determines what types of dependencies are searched for. If unset, all dependency types are searched for._ (array)
                Valid item types:
                    - (string)
                - **focus** [optional] _Focus on the dependencies at these slicing criteria: the result names every node taking part in them in `.meta.focus`._ (array)
                Valid item types:
                    - (string)
                - **assumedPackages** [optional] _Also report the base packages R attaches on startup (e.g. `stats` for a bare `sd()`) that the code uses but never asks for explicitly, as `library` entries marked `implicit`. `base` is reported too, additionally marked `alwaysAttached`. Defaults to false._ (boolean)
                - **additionalCategories** [optional] _A set of additional, user-supplied dependency categories, whose results will be included in the query return value. Using the name of a built-in category extends it instead of replacing it._ (object)
                    Only allows: '[object Object]'
            - _The location map query retrieves the location of every id in the ast._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'location-map'
                - **ids** [optional] _Optional list of ids to filter the results by._ (array)
                Valid item types:
                    - (string)
                - **span** [optional] _How much of the source the reported range covers: the token itself (default), the whole subtree of the node, or the top-level statement it belongs to._ (string)
                    Only allows: 'token', 'full', 'statement'
            - _The search query searches the normalized AST and dataflow graph for nodes that match the given search query._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'search'
                - **search** [required] _The search query to execute._ (object)
            - _Happens-Before tracks whether a always happens before b._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'happens-before'
                - **a** [required] _The first slicing criterion._ (string)
                - **b** [required] _The second slicing criterion._ (string)
            - _Query to inspect which functions throw exceptions._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'inspect-exception'
                - **filter** [optional] _If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered._ (array)
                Valid item types:
                    - [required] (string)
            - _Either returns all function definitions alongside whether they are higher-order functions, or just those matching the filters._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'inspect-higher-order'
                - **filter** [optional] _If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered._ (array)
                Valid item types:
                    - [required] (string)
            - _Either returns all function definitions alongside whether they are recursive, or just those matching the filters._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'inspect-recursion'
                - **filter** [optional] _If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered._ (array)
                Valid item types:
                    - [required] (string)
            - _Either returns all function definitions alongside what they and their formals do, or just those matching the filters._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'inspect-fn-props'
                - **filter** [optional] _If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered._ (array)
                Valid item types:
                    - [required] (string)
                - **maxDepth** [optional] _How far a value is followed back through names and calls when deciding what a formal stands for (default 6)._ (number)
                - **only** [optional] _Infer only what the formals do, or only what the function itself does; both are inferred when this is left out._ (string)
                    Only allows: 'arguments', 'function'
                - **formals** [optional] _Keep only the formals written as one of these names._ (array)
                Valid item types:
                    - (string)
                - **props** [optional] _Keep only these properties, named as the ArgProp/CallProp/SemanticCallTag members they are._ (array)
                Valid item types:
                    - (string)
                        Only allows: 'Forced', 'NoDefault', 'Alias', 'Value', 'Shape', 'Flag', 'Resource', 'Written', 'Nse', 'Callee', 'Presence', 'Bounds', 'Atomic', 'Handle', 'Lazy', 'Injectable', 'Deparsed', 'Optional', 'Required', 'Guarded', 'Pure', 'MayPure', 'Throws', 'Invisible', 'Generic', 'Method', 'Scope', 'NonDet', 'Ambient', 'Configures', 'Ffi', 'Lang', 'Strict', 'Concurrent', 'Primitive', 'Random', 'File', 'TempFile', 'Network', 'Process', 'User', 'Interactive', 'CommandLine', 'Glob', 'Graphics', 'Console', 'Database', 'Opens', 'Closes', 'Reads', 'Writes', 'Prints', 'Narrows', 'Edits', 'Statistics', 'Transforms', 'Deprecated', 'Eval', 'Html', 'JavaScript', 'LoadsPackage', 'AttachesPackage', 'ChecksPackage', 'DetachesPackage', 'Declares', 'Frames'
            - _Returns what function definitions ask of the calls they return from, for all of them or just those matching the filter._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'inspect-fn-guards'
                - **filter** [optional] _If given, only function definitions that match one of the given slicing criteria are considered. Each criterion can be either `line:column`, `line@variable-name`, or `$id`, where the latter directly specifies the node id of the function definition to be considered._ (array)
                Valid item types:
                    - [required] (string)
                - **kind** [optional] _Keep only the conditions the function checks itself, or only those R checks for it._ (string)
                    Only allows: 'explicit', 'implicit'
                - **onlyPure** [optional] _Keep only the conditions failing before any side effect._ (boolean)
                - **formals** [optional] _Keep only what is said about the formals written as one of these names._ (array)
                Valid item types:
                    - (string)
                - **builtIns** [optional] _Also state what these functions of R ask for, written `name` or `pkg::name`._ (array)
                Valid item types:
                    - (string)
            - _What code reads and writes of the global state (options, environment variables, devices, ...)._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'ambient-access'
                - **criteria** [optional] _The code to ask for, each slicing criterion with all the code its node spans. Without, every file and the whole project._ (array)
                Valid item types:
                    - (string)
                - **functions** [optional] _Also answer for every function definition the code writes._ (boolean)
                - **includeCallees** [optional] _Whether what the called functions access counts as well (default true)._ (boolean)
            - _The resolve value query used to get definitions of an identifier_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'resolve-value'
                - **criteria** [required] _The slicing criteria to use._ (array)
                Valid item types:
                    - (string)
            - _The project query provides information on the analyzed project._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'project'
                - **withDf** [optional] _Whether to include Dataflow information in the result._ (boolean)
                - **showFiles** [optional] _Whether to include the list of files in the result._ (boolean)
            - _Inspects the loaded signature database(s): loaded databases, a package, a function, or wildcard matches (optionally filtered by parameter name or required-parameter count). Names no database records are answered from flowR's own built-in configuration instead and marked as such._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'signature'
                - **package** [optional] _The package to inspect (glob wildcards allowed); omit for a summary of the loaded databases._ (string)
                - **function** [optional] _A function/symbol to inspect (glob wildcards allowed)._ (string)
                - **version** [optional] _A version spec: an exact version, a glob (3.*), a semver range (>=3.0.0, 3.x), or a release-date bound (<=2026, >=2021.05 in YYYY.MM.DD)._ (string)
                - **parameters** [optional] _Keep only functions that have a parameter matching every one of these names (glob wildcards allowed, position-independent)._ (array)
                Valid item types:
                    - (string)
                - **requiredParameters** [optional] _Keep only functions with exactly this many required (no-default) parameters, excluding `...`._ (number)
                - **flowr** [optional] _A spec over flowR's own built-in view: name(arg, [role], name[role], *) [prop], e.g. p*([alias]) [invisible]._ (string)
                - **callGraph** [optional] _For a single function, also render its transitive call graph as a mermaid.live link (`--cg`)._ (boolean)
                - **callGraphMaxNodes** [optional] _How many nodes the rendered call graph may hold before the expansion stops (default 300, `--cg-max <n>`)._ (number)
            - _The resolve value query used to get definitions of an identifier_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'origin'
                - **criterion** [required] _The slicing criteria to use_ (string)
            - _The linter query lints for the given set of rules and returns the result._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'linter'
                - **format** [optional] _Print the findings in a machine-readable format instead of the human-readable summary._ (string)
                    Only allows: 'text', 'sarif', 'github'
                - **rules** _The rules to lint for. If unset, all rules will be included._ (array)
                Valid item types:
                    - (string)
                        Only allows: 'deprecated-functions', 'file-path-validity', 'seeded-randomness', 'absolute-file-paths', 'unused-definitions', 'naming-convention', 'network-functions', 'dataframe-access-validation', 'dead-code', 'useless-loop', 'problematic-inputs', 'stop-call', 'roxygen-arguments', 'software-has-license', 'software-has-tests', 'no-leaked-credentials', 'undefined-symbol', 'unused-import', 'syntactically-valid', 'unclosed-connection', 'overwritten-file', 'unescaped-arguments', 'namespace-access', 'class-string-comparison', 'description-metadata', 'documentation-mismatch', 'non-ascii-code', 'true-false-abbreviation', 'bogus-return', 'package-hooks', 'global-environment-modification', 'namespace-tampering', 's3-method-consistency', 'foreign-function-calls', 'dependency-declaration', 'call-arguments', 'package-structure', 'compiled-code', 'package-metafiles', 'rd-files', 'package-data', 'package-runtime', 'secret-exfiltration', 'process-state-in-session', 'code-clones', 'call-contracts', 'interactive-functions'
                    - (object)
                        - **name** [required] (string)
                            Only allows: 'deprecated-functions', 'file-path-validity', 'seeded-randomness', 'absolute-file-paths', 'unused-definitions', 'naming-convention', 'network-functions', 'dataframe-access-validation', 'dead-code', 'useless-loop', 'problematic-inputs', 'stop-call', 'roxygen-arguments', 'software-has-license', 'software-has-tests', 'no-leaked-credentials', 'undefined-symbol', 'unused-import', 'syntactically-valid', 'unclosed-connection', 'overwritten-file', 'unescaped-arguments', 'namespace-access', 'class-string-comparison', 'description-metadata', 'documentation-mismatch', 'non-ascii-code', 'true-false-abbreviation', 'bogus-return', 'package-hooks', 'global-environment-modification', 'namespace-tampering', 's3-method-consistency', 'foreign-function-calls', 'dependency-declaration', 'call-arguments', 'package-structure', 'compiled-code', 'package-metafiles', 'rd-files', 'package-data', 'package-runtime', 'secret-exfiltration', 'process-state-in-session', 'code-clones', 'call-contracts', 'interactive-functions'
                        - **config** (object)
                - **tags** [optional] _Lint for every rule carrying one of these tags, e.g. cmd-check for the R CMD check rules._ (array)
                Valid item types:
                    - (string)
                        Only allows: 'bug', 'deprecated', 'documentation', 'experimental', 'performance', 'robustness', 'rver3', 'rver4', 'readability', 'reproducibility', 'security', 'shiny', 'smell', 'style', 'usability', 'cmd-check', 'quickfix'
            - _Dice query: selects only paths from the given start nodes that reach the given end nodes._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'dice'
                - **from** [required] _Slicing criteria for the start of the dice (forward slice seeds)._ (array)
                Valid item types:
                    - (string)
                - **to** [required] _Slicing criteria for the end of the dice (backward slice seeds)._ (array)
                Valid item types:
                    - (string)
                - **name** [optional] _What to call this slice: the results are keyed by it instead of by the serialized query._ (string)
                - **noReconstruction** [optional] _Do not reconstruct the slice into readable code._ (boolean)
                - **noMagicComments** [optional] _Should the magic comments (force-including lines within the slice) be ignored?_ (boolean)
                - **inlineSources** [optional] _Inline resolvable source() calls into the reconstruction so the result is a single self-contained R text; "banner" marks where each spliced file begins and ends with a banner comment naming it._ (alternatives)
                    - (boolean)
                    - (string)
                        Only allows: 'banner'
                - **inlineFull** [optional] _Inline all files into the reconstruction, in flowR's loading order and independent of whether they are sourced explicitly; "banner" precedes every file with a banner comment naming it._ (alternatives)
                    - (boolean)
                    - (string)
                        Only allows: 'banner'
                - **includeCallees** [optional] _If set (and slicing backward), continue the slice past a function-definition boundary, also including the definition's binding and call sites._ (boolean)
                - **perFile** [optional] _Reconstruct the slice as the project's files, reported in `reconstruct.files` in loading order with their paths, instead of only the entry file._ (boolean)
                - **reportPackages** [optional] _Also report the packages the slice calls into, i.e. what this selection needs installed rather than what the whole program loads._ (boolean)
            - _Guesses the possible version range of every dependency from declared constraints and signature-database usage._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'guess-dep-versions'
                - **packages** [optional] _Restrict the guess to these packages; omit to guess for every declared and used dependency._ (array)
                Valid item types:
                    - (string)
                - **date** [optional] _Only consider versions released on or before this day, written YYYY.MM.DD (also YYYY or YYYY.MM)._ (string)
                - **maxCandidates** [optional] _Cap the number of candidate versions listed per dependency._ (number)
                - **maxIterations** [optional] _Bound both fixpoint loops (mutual transitive refinement and arc consistency)._ (number)
                - **clean** [optional] _Ignore the project declared constraints (DESCRIPTION/lockfile/transitive); guess purely from code usage and the date/R bounds._ (boolean)
                - **disabled** [optional] _Exclude these evidence sources from consideration entirely (repl: --disabled followed by their one-letter codes, e.g. --disabled ds for declared+signature)._ (array)
                Valid item types:
                    - (string)
                        Only allows: 'declared', 'transitive', 'signature', 'date', 'base-r', 'available', 'indirect'
                - **explode** [optional] _Also explode the guessed space into concrete per-dependency version assignments._ (object)
                    - **order** [optional] _Iterate each dependency newest-first (default) or oldest-first._ (string)
                        Only allows: 'newest', 'oldest'
                    - **prefer** [optional] _A version to prefer per dependency when it survives the constraints._ (object)
                    - **limit** [optional] _Cap the number of version combinations considered. Combinations whose versions cannot be loaded together are skipped, so fewer assignments may come out._ (number)
            - _Reports which packages export a function name, its signature/details in each, and whether flowR itself carries a built-in definition for it._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'function-info'
                - **name** [required] _The bare function/symbol name to look up._ (string)
                - **packages** [optional] _Restrict the package list to these names; every exporting package is considered when omitted._ (array)
                Valid item types:
                    - (string)
            - _Finds code clones with a configurable selection of algorithms (AST, token, and fingerprint based)._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'code-clones'
                - **algorithms** [optional] _The clone detection algorithms to run (default: gst)._ (array)
                Valid item types:
                    - (string)
                        Only allows: 'baxter', 'gst', 'winnowing'
                - **perspective** [optional] _How the code is presented to the algorithms: as written (syntax), with sugar and newer R features rewritten (canonical, default), or additionally with single-use temporaries inlined along the dataflow (dataflow)._ (string)
                    Only allows: 'syntax', 'canonical', 'dataflow'
                - **config** [optional] _Thresholds and options of the algorithms, merged into the defaults._ (object)
                    - **scope** [optional] (string)
                        Only allows: 'all', 'cross-file'
                    - **maxPairs** [optional] (number)
                    - **gst** [optional] (object)
                        - **tokens** (string)
                            Only allows: 'normalized', 'exact'
                        - **minimumMatchLength** (number)
                        - **threshold** (number)
                        - **unit** (string)
                            Only allows: 'function', 'file'
                    - **winnowing** [optional] (object)
                        - **tokens** (string)
                            Only allows: 'normalized', 'exact'
                        - **k** (number)
                        - **t** (number)
                        - **threshold** (number)
                        - **maxDocumentFrequency** (number)
                        - **unit** (string)
                            Only allows: 'function', 'file'
                    - **baxter** [optional] (object)
                        - **massThreshold** (number)
                        - **similarityThreshold** (number)
                - **exportIndex** [optional] _Also return the clone index of the analyzed files, to search against it later._ (boolean)
                - **against** [optional] _Previously exported clone indices to search the analyzed files against. They must use the same perspective as the query._ (array)
                Valid item types:
                    - (object)
                        - **format** [required] (string)
                            Only allows: 'flowr-clone-index'
                        - **version** [required] (number)
                            Only allows: '1'
                        - **perspective** [required] (string)
                            Only allows: 'syntax', 'canonical', 'dataflow'
                        - **files** [required] (array)
                        Valid item types:
                            - (object)
            - _The data columns query returns the columns of a data frame that can be written at a position, after `df$` or within the arguments a call evaluates within its data._ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'data-columns'
                - **positions** [required] _The positions to ask about, as `line:column` of the cursor._ (array)
                Valid item types:
                    - (string)
                - **file** [optional] _The file the positions are in, if the analysis holds more than one._ (string)
        - _Virtual queries (used for structure)_ (alternatives)
            - _Compound query used to combine queries of the same type_ (object)
                - **type** [required] _The type of the query._ (string)
                    Only allows: 'compound'
                - **query** [required] _The query to run on the file analysis information._ (string)
                - **commonArguments** [required] _Common arguments for all queries._ (object)
                - **arguments** [required] _Arguments for each query._ (array)
                Valid item types:
                    - (object)

</details>

### Why Queries?

First, consider that you have a file like the following (a simple, artificial example):

```r
library(ggplot)
library(dplyr)
library(readr)

# read data with read_csv
data <- read_csv('data.csv')
data2 <- read_csv('data2.csv')

m <- mean(data$x) 
print(m)

data %>%
	ggplot(aes(x = x, y = y)) +
	geom_point()
	
plot(data2$x, data2$y)
points(data2$x, data2$y)
	
print(mean(data2$k))
```

<details> <summary>Dataflow Graph of the Example</summary>

```mermaid
flowchart LR
    1{{"`*#91;RSymbol#93;* **ggplot**
      *1.9-14* (**id: 1**)`"}}
    3[["`*#91;RFunctionCall#93;* base#58;#58;**library**
      *1.1-15* (**id: 3**)
    arg: (1)`"]]
    style 3 stroke:red,stroke-width:5px; 
    built-in:library["`Built-In:
library`"]
    style built-in:library stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    5{{"`*#91;RSymbol#93;* **dplyr**
      *2.9-13* (**id: 5**)`"}}
    7[["`*#91;RFunctionCall#93;* base#58;#58;**library**
      *2.1-14* (**id: 7**)
    arg: (5)`"]]
    9{{"`*#91;RSymbol#93;* **readr**
      *3.9-13* (**id: 9**)`"}}
    11[["`*#91;RFunctionCall#93;* base#58;#58;**library**
      *3.1-14* (**id: 11**)
    arg: (9)`"]]
    14{{"`*#91;RString#93;* **#39;data.csv#39;**
      *6.18-27* (**id: 14**)`"}}
    %% Environment of 16 [level: 0]:
    %% Built-in
    %% 1----------------------------------------
    %%    library-load: {**ggplot:: library-load** (id: 3, type: Function, def. @3)}
    %% 2----------------------------------------
    %%   magrittr:%>%:           {**dplyr::magrittr:%>%** (id: built-in:magrittr:%>%, type: Function, def. @built-in:magrittr)}
    %%   tibble:add_row:         {**dplyr::tibble:add_row** (id: built-in:tibble:add_row, type: Function, def. @built-in:tibble)}
    %%   tibble:as_data_frame:   {**dplyr::tibble:as_data_frame** (id: built-in:tibble:as_data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:as_tibble:       {**dplyr::tibble:as_tibble** (id: built-in:tibble:as_tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:data_frame:      {**dplyr::tibble:data_frame** (id: built-in:tibble:data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:lst:             {**dplyr::tibble:lst** (id: built-in:tibble:lst, type: Function, def. @built-in:tibble)}
    %%   tibble:tibble:          {**dplyr::tibble:tibble** (id: built-in:tibble:tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:tribble:         {**dplyr::tibble:tribble** (id: built-in:tibble:tribble, type: Function, def. @built-in:tibble)}
    %%   tidyselect:all_of:      {**dplyr::tidyselect:all_of** (id: built-in:tidyselect:all_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:any_of:      {**dplyr::tidyselect:any_of** (id: built-in:tidyselect:any_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:contains:    {**dplyr::tidyselect:contains** (id: built-in:tidyselect:contains, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:ends_with:   {**dplyr::tidyselect:ends_with** (id: built-in:tidyselect:ends_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:everything:  {**dplyr::tidyselect:everything** (id: built-in:tidyselect:everything, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:last_col:    {**dplyr::tidyselect:last_col** (id: built-in:tidyselect:last_col, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:matches:     {**dplyr::tidyselect:matches** (id: built-in:tidyselect:matches, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:num_range:   {**dplyr::tidyselect:num_range** (id: built-in:tidyselect:num_range, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:one_of:      {**dplyr::tidyselect:one_of** (id: built-in:tidyselect:one_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:starts_with: {**dplyr::tidyselect:starts_with** (id: built-in:tidyselect:starts_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:where:       {**dplyr::tidyselect:where** (id: built-in:tidyselect:where, type: Function, def. @built-in:tidyselect)}
    %%   rlang:as_label:         {**dplyr::rlang:as_label** (id: built-in:rlang:as_label, type: Function, def. @built-in:rlang)}
    %%   rlang:enexpr:           {**dplyr::rlang:enexpr** (id: built-in:rlang:enexpr, type: Function, def. @built-in:rlang)}
    %%   rlang:enexprs:          {**dplyr::rlang:enexprs** (id: built-in:rlang:enexprs, type: Function, def. @built-in:rlang)}
    %%   rlang:enquo:            {**dplyr::rlang:enquo** (id: built-in:rlang:enquo, type: Function, def. @built-in:rlang)}
    %%   rlang:enquos:           {**dplyr::rlang:enquos** (id: built-in:rlang:enquos, type: Function, def. @built-in:rlang)}
    %%   rlang:ensym:            {**dplyr::rlang:ensym** (id: built-in:rlang:ensym, type: Function, def. @built-in:rlang)}
    %%   rlang:ensyms:           {**dplyr::rlang:ensyms** (id: built-in:rlang:ensyms, type: Function, def. @built-in:rlang)}
    %%   rlang:expr:             {**dplyr::rlang:expr** (id: built-in:rlang:expr, type: Function, def. @built-in:rlang)}
    %%   rlang:quo:              {**dplyr::rlang:quo** (id: built-in:rlang:quo, type: Function, def. @built-in:rlang)}
    %%   rlang:quo_name:         {**dplyr::rlang:quo_name** (id: built-in:rlang:quo_name, type: Function, def. @built-in:rlang)}
    %%   rlang:quos:             {**dplyr::rlang:quos** (id: built-in:rlang:quos, type: Function, def. @built-in:rlang)}
    %%   rlang:sym:              {**dplyr::rlang:sym** (id: built-in:rlang:sym, type: Function, def. @built-in:rlang)}
    %%   rlang:syms:             {**dplyr::rlang:syms** (id: built-in:rlang:syms, type: Function, def. @built-in:rlang)}
    %%   pillar:glimpse:         {**dplyr::pillar:glimpse** (id: built-in:pillar:glimpse, type: Function, def. @built-in:pillar)}
    %%   pillar:type_sum:        {**dplyr::pillar:type_sum** (id: built-in:pillar:type_sum, type: Function, def. @built-in:pillar)}
    %%   generics:intersect:     {**dplyr::generics:intersect** (id: built-in:generics:intersect, type: Function, def. @built-in:generics)}
    %%   generics:setdiff:       {**dplyr::generics:setdiff** (id: built-in:generics:setdiff, type: Function, def. @built-in:generics)}
    %%   generics:setequal:      {**dplyr::generics:setequal** (id: built-in:generics:setequal, type: Function, def. @built-in:generics)}
    %%   generics:union:         {**dplyr::generics:union** (id: built-in:generics:union, type: Function, def. @built-in:generics)}
    %% 3----------------------------------------
    %%   [.fun_list:                                            {**dplyr::[.fun_list** (id: built-in:dplyr:[.fun_list, type: Function, def. @7)}
    %%   [.grouped_df:                                          {**dplyr::[.grouped_df** (id: built-in:dplyr:[.grouped_df, type: Function, def. @7)}
    %%   [.rowwise_df:                                          {**dplyr::[.rowwise_df** (id: built-in:dplyr:[.rowwise_df, type: Function, def. @7)}
    %%   [[<-.grouped_df:                                       {**dplyr::[[<-.grouped_df** (id: built-in:dplyr:[[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.grouped_df:                                        {**dplyr::[<-.grouped_df** (id: built-in:dplyr:[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.rowwise_df:                                        {**dplyr::[<-.rowwise_df** (id: built-in:dplyr:[<-.rowwise_df, type: Function, def. @7)}
    %%   $<-.grouped_df:                                        {**dplyr::$<-.grouped_df** (id: built-in:dplyr:$<-.grouped_df, type: Function, def. @7)}
    %%   across:                                                {**dplyr::across** (id: built-in:dplyr:across, type: Function, def. @7)}
    %%   add_count:                                             {**dplyr::add_count** (id: built-in:dplyr:add_count, type: Function, def. @7)}
    %%   add_count_:                                            {**dplyr::add_count_** (id: built-in:dplyr:add_count_, type: Function, def. @7)}
    %%   add_count.data.frame:                                  {**dplyr::add_count.data.frame** (id: built-in:dplyr:add_count.data.frame, type: Function, def. @7)}
    %%   add_count.default:                                     {**dplyr::add_count.default** (id: built-in:dplyr:add_count.default, type: Function, def. @7)}
    %%   add_rownames:                                          {**dplyr::add_rownames** (id: built-in:dplyr:add_rownames, type: Function, def. @7)}
    %%   add_tally:                                             {**dplyr::add_tally** (id: built-in:dplyr:add_tally, type: Function, def. @7)}
    %%   add_tally_:                                            {**dplyr::add_tally_** (id: built-in:dplyr:add_tally_, type: Function, def. @7)}
    %%   all_equal:                                             {**dplyr::all_equal** (id: built-in:dplyr:all_equal, type: Function, def. @7)}
    %%   all_vars:                                              {**dplyr::all_vars** (id: built-in:dplyr:all_vars, type: Function, def. @7)}
    %%   anti_join:                                             {**dplyr::anti_join** (id: built-in:dplyr:anti_join, type: Function, def. @7)}
    %%   anti_join.data.frame:                                  {**dplyr::anti_join.data.frame** (id: built-in:dplyr:anti_join.data.frame, type: Function, def. @7)}
    %%   any_vars:                                              {**dplyr::any_vars** (id: built-in:dplyr:any_vars, type: Function, def. @7)}
    %%   arrange:                                               {**dplyr::arrange** (id: built-in:dplyr:arrange, type: Function, def. @7)}
    %%   arrange_:                                              {**dplyr::arrange_** (id: built-in:dplyr:arrange_, type: Function, def. @7)}
    %%   arrange_all:                                           {**dplyr::arrange_all** (id: built-in:dplyr:arrange_all, type: Function, def. @7)}
    %%   arrange_at:                                            {**dplyr::arrange_at** (id: built-in:dplyr:arrange_at, type: Function, def. @7)}
    %%   arrange_if:                                            {**dplyr::arrange_if** (id: built-in:dplyr:arrange_if, type: Function, def. @7)}
    %%   arrange.data.frame:                                    {**dplyr::arrange.data.frame** (id: built-in:dplyr:arrange.data.frame, type: Function, def. @7)}
    %%   as_join_by.character:                                  {**dplyr::as_join_by.character** (id: built-in:dplyr:as_join_by.character, type: Function, def. @7)}
    %%   as_join_by.default:                                    {**dplyr::as_join_by.default** (id: built-in:dplyr:as_join_by.default, type: Function, def. @7)}
    %%   as_join_by.dplyr_join_by:                              {**dplyr::as_join_by.dplyr_join_by** (id: built-in:dplyr:as_join_by.dplyr_join_by, type: Function, def. @7)}
    %%   as_join_by.list:                                       {**dplyr::as_join_by.list** (id: built-in:dplyr:as_join_by.list, type: Function, def. @7)}
    %%   as_tibble.grouped_df:                                  {**dplyr::as_tibble.grouped_df** (id: built-in:dplyr:as_tibble.grouped_df, type: Function, def. @7)}
    %%   as_tibble.rowwise_df:                                  {**dplyr::as_tibble.rowwise_df** (id: built-in:dplyr:as_tibble.rowwise_df, type: Function, def. @7)}
    %%   as.data.frame.grouped_df:                              {**dplyr::as.data.frame.grouped_df** (id: built-in:dplyr:as.data.frame.grouped_df, type: Function, def. @7)}
    %%   as.tbl:                                                {**dplyr::as.tbl** (id: built-in:dplyr:as.tbl, type: Function, def. @7)}
    %%   auto_copy:                                             {**dplyr::auto_copy** (id: built-in:dplyr:auto_copy, type: Function, def. @7)}
    %%   auto_copy.data.frame:                                  {**dplyr::auto_copy.data.frame** (id: built-in:dplyr:auto_copy.data.frame, type: Function, def. @7)}
    %%   between:                                               {**dplyr::between** (id: built-in:dplyr:between, type: Function, def. @7)}
    %%   bind_cols:                                             {**dplyr::bind_cols** (id: built-in:dplyr:bind_cols, type: Function, def. @7)}
    %%   bind_rows:                                             {**dplyr::bind_rows** (id: built-in:dplyr:bind_rows, type: Function, def. @7)}
    %%   c_across:                                              {**dplyr::c_across** (id: built-in:dplyr:c_across, type: Function, def. @7)}
    %%   case_match:                                            {**dplyr::case_match** (id: built-in:dplyr:case_match, type: Function, def. @7)}
    %%   case_when:                                             {**dplyr::case_when** (id: built-in:dplyr:case_when, type: Function, def. @7)}
    %%   cbind.grouped_df:                                      {**dplyr::cbind.grouped_df** (id: built-in:dplyr:cbind.grouped_df, type: Function, def. @7)}
    %%   check_dbplyr:                                          {**dplyr::check_dbplyr** (id: built-in:dplyr:check_dbplyr, type: Function, def. @7)}
    %%   coalesce:                                              {**dplyr::coalesce** (id: built-in:dplyr:coalesce, type: Function, def. @7)}
    %%   collapse:                                              {**dplyr::collapse** (id: built-in:dplyr:collapse, type: Function, def. @7)}
    %%   collapse.data.frame:                                   {**dplyr::collapse.data.frame** (id: built-in:dplyr:collapse.data.frame, type: Function, def. @7)}
    %%   collect:                                               {**dplyr::collect** (id: built-in:dplyr:collect, type: Function, def. @7)}
    %%   collect.data.frame:                                    {**dplyr::collect.data.frame** (id: built-in:dplyr:collect.data.frame, type: Function, def. @7)}
    %%   combine:                                               {**dplyr::combine** (id: built-in:dplyr:combine, type: Function, def. @7)}
    %%   common_by:                                             {**dplyr::common_by** (id: built-in:dplyr:common_by, type: Function, def. @7)}
    %%   common_by.character:                                   {**dplyr::common_by.character** (id: built-in:dplyr:common_by.character, type: Function, def. @7)}
    %%   common_by.default:                                     {**dplyr::common_by.default** (id: built-in:dplyr:common_by.default, type: Function, def. @7)}
    %%   common_by.list:                                        {**dplyr::common_by.list** (id: built-in:dplyr:common_by.list, type: Function, def. @7)}
    %%   common_by.NULL:                                        {**dplyr::common_by.NULL** (id: built-in:dplyr:common_by.NULL, type: Function, def. @7)}
    %%   compute:                                               {**dplyr::compute** (id: built-in:dplyr:compute, type: Function, def. @7)}
    %%   compute.data.frame:                                    {**dplyr::compute.data.frame** (id: built-in:dplyr:compute.data.frame, type: Function, def. @7)}
    %%   consecutive_id:                                        {**dplyr::consecutive_id** (id: built-in:dplyr:consecutive_id, type: Function, def. @7)}
    %%   copy_to:                                               {**dplyr::copy_to** (id: built-in:dplyr:copy_to, type: Function, def. @7)}
    %%   copy_to.DBIConnection:                                 {**dplyr::copy_to.DBIConnection** (id: built-in:dplyr:copy_to.DBIConnection, type: Function, def. @7)}
    %%   count:                                                 {**dplyr::count** (id: built-in:dplyr:count, type: Function, def. @7)}
    %%   count_:                                                {**dplyr::count_** (id: built-in:dplyr:count_, type: Function, def. @7)}
    %%   count.data.frame:                                      {**dplyr::count.data.frame** (id: built-in:dplyr:count.data.frame, type: Function, def. @7)}
    %%   cross_join:                                            {**dplyr::cross_join** (id: built-in:dplyr:cross_join, type: Function, def. @7)}
    %%   cross_join.data.frame:                                 {**dplyr::cross_join.data.frame** (id: built-in:dplyr:cross_join.data.frame, type: Function, def. @7)}
    %%   cumall:                                                {**dplyr::cumall** (id: built-in:dplyr:cumall, type: Function, def. @7)}
    %%   cumany:                                                {**dplyr::cumany** (id: built-in:dplyr:cumany, type: Function, def. @7)}
    %%   cume_dist:                                             {**dplyr::cume_dist** (id: built-in:dplyr:cume_dist, type: Function, def. @7)}
    %%   cummean:                                               {**dplyr::cummean** (id: built-in:dplyr:cummean, type: Function, def. @7)}
    %%   cur_column:                                            {**dplyr::cur_column** (id: built-in:dplyr:cur_column, type: Function, def. @7)}
    %%   cur_data:                                              {**dplyr::cur_data** (id: built-in:dplyr:cur_data, type: Function, def. @7)}
    %%   cur_data_all:                                          {**dplyr::cur_data_all** (id: built-in:dplyr:cur_data_all, type: Function, def. @7)}
    %%   cur_group:                                             {**dplyr::cur_group** (id: built-in:dplyr:cur_group, type: Function, def. @7)}
    %%   cur_group_id:                                          {**dplyr::cur_group_id** (id: built-in:dplyr:cur_group_id, type: Function, def. @7)}
    %%   cur_group_rows:                                        {**dplyr::cur_group_rows** (id: built-in:dplyr:cur_group_rows, type: Function, def. @7)}
    %%   db_analyze:                                            {**dplyr::db_analyze** (id: built-in:dplyr:db_analyze, type: Function, def. @7)}
    %%   db_begin:                                              {**dplyr::db_begin** (id: built-in:dplyr:db_begin, type: Function, def. @7)}
    %%   db_commit:                                             {**dplyr::db_commit** (id: built-in:dplyr:db_commit, type: Function, def. @7)}
    %%   db_create_index:                                       {**dplyr::db_create_index** (id: built-in:dplyr:db_create_index, type: Function, def. @7)}
    %%   db_create_indexes:                                     {**dplyr::db_create_indexes** (id: built-in:dplyr:db_create_indexes, type: Function, def. @7)}
    %%   db_create_table:                                       {**dplyr::db_create_table** (id: built-in:dplyr:db_create_table, type: Function, def. @7)}
    %%   db_data_type:                                          {**dplyr::db_data_type** (id: built-in:dplyr:db_data_type, type: Function, def. @7)}
    %%   db_desc:                                               {**dplyr::db_desc** (id: built-in:dplyr:db_desc, type: Function, def. @7)}
    %%   db_drop_table:                                         {**dplyr::db_drop_table** (id: built-in:dplyr:db_drop_table, type: Function, def. @7)}
    %%   db_explain:                                            {**dplyr::db_explain** (id: built-in:dplyr:db_explain, type: Function, def. @7)}
    %%   db_has_table:                                          {**dplyr::db_has_table** (id: built-in:dplyr:db_has_table, type: Function, def. @7)}
    %%   db_insert_into:                                        {**dplyr::db_insert_into** (id: built-in:dplyr:db_insert_into, type: Function, def. @7)}
    %%   db_list_tables:                                        {**dplyr::db_list_tables** (id: built-in:dplyr:db_list_tables, type: Function, def. @7)}
    %%   db_query_fields:                                       {**dplyr::db_query_fields** (id: built-in:dplyr:db_query_fields, type: Function, def. @7)}
    %%   db_query_rows:                                         {**dplyr::db_query_rows** (id: built-in:dplyr:db_query_rows, type: Function, def. @7)}
    %%   db_rollback:                                           {**dplyr::db_rollback** (id: built-in:dplyr:db_rollback, type: Function, def. @7)}
    %%   db_save_query:                                         {**dplyr::db_save_query** (id: built-in:dplyr:db_save_query, type: Function, def. @7)}
    %%   db_write_table:                                        {**dplyr::db_write_table** (id: built-in:dplyr:db_write_table, type: Function, def. @7)}
    %%   dense_rank:                                            {**dplyr::dense_rank** (id: built-in:dplyr:dense_rank, type: Function, def. @7)}
    %%   desc:                                                  {**dplyr::desc** (id: built-in:dplyr:desc, type: Function, def. @7)}
    %%   dim_desc:                                              {**dplyr::dim_desc** (id: built-in:dplyr:dim_desc, type: Function, def. @7)}
    %%   distinct:                                              {**dplyr::distinct** (id: built-in:dplyr:distinct, type: Function, def. @7)}
    %%   distinct_:                                             {**dplyr::distinct_** (id: built-in:dplyr:distinct_, type: Function, def. @7)}
    %%   distinct_all:                                          {**dplyr::distinct_all** (id: built-in:dplyr:distinct_all, type: Function, def. @7)}
    %%   distinct_at:                                           {**dplyr::distinct_at** (id: built-in:dplyr:distinct_at, type: Function, def. @7)}
    %%   distinct_if:                                           {**dplyr::distinct_if** (id: built-in:dplyr:distinct_if, type: Function, def. @7)}
    %%   distinct_prepare:                                      {**dplyr::distinct_prepare** (id: built-in:dplyr:distinct_prepare, type: Function, def. @7)}
    %%   distinct.data.frame:                                   {**dplyr::distinct.data.frame** (id: built-in:dplyr:distinct.data.frame, type: Function, def. @7)}
    %%   do:                                                    {**dplyr::do** (id: built-in:dplyr:do, type: Function, def. @7)}
    %%   do_:                                                   {**dplyr::do_** (id: built-in:dplyr:do_, type: Function, def. @7)}
    %%   do.data.frame:                                         {**dplyr::do.data.frame** (id: built-in:dplyr:do.data.frame, type: Function, def. @7)}
    %%   do.grouped_df:                                         {**dplyr::do.grouped_df** (id: built-in:dplyr:do.grouped_df, type: Function, def. @7)}
    %%   do.NULL:                                               {**dplyr::do.NULL** (id: built-in:dplyr:do.NULL, type: Function, def. @7)}
    %%   do.rowwise_df:                                         {**dplyr::do.rowwise_df** (id: built-in:dplyr:do.rowwise_df, type: Function, def. @7)}
    %%   dplyr_col_modify:                                      {**dplyr::dplyr_col_modify** (id: built-in:dplyr:dplyr_col_modify, type: Function, def. @7)}
    %%   dplyr_col_modify.data.frame:                           {**dplyr::dplyr_col_modify.data.frame** (id: built-in:dplyr:dplyr_col_modify.data.frame, type: Function, def. @7)}
    %%   dplyr_col_modify.grouped_df:                           {**dplyr::dplyr_col_modify.grouped_df** (id: built-in:dplyr:dplyr_col_modify.grouped_df, type: Function, def. @7)}
    %%   dplyr_col_modify.rowwise_df:                           {**dplyr::dplyr_col_modify.rowwise_df** (id: built-in:dplyr:dplyr_col_modify.rowwise_df, type: Function, def. @7)}
    %%   dplyr_reconstruct:                                     {**dplyr::dplyr_reconstruct** (id: built-in:dplyr:dplyr_reconstruct, type: Function, def. @7)}
    %%   dplyr_reconstruct.data.frame:                          {**dplyr::dplyr_reconstruct.data.frame** (id: built-in:dplyr:dplyr_reconstruct.data.frame, type: Function, def. @7)}
    %%   dplyr_reconstruct.grouped_df:                          {**dplyr::dplyr_reconstruct.grouped_df** (id: built-in:dplyr:dplyr_reconstruct.grouped_df, type: Function, def. @7)}
    %%   dplyr_reconstruct.rowwise_df:                          {**dplyr::dplyr_reconstruct.rowwise_df** (id: built-in:dplyr:dplyr_reconstruct.rowwise_df, type: Function, def. @7)}
    %%   dplyr_row_slice:                                       {**dplyr::dplyr_row_slice** (id: built-in:dplyr:dplyr_row_slice, type: Function, def. @7)}
    %%   dplyr_row_slice.data.frame:                            {**dplyr::dplyr_row_slice.data.frame** (id: built-in:dplyr:dplyr_row_slice.data.frame, type: Function, def. @7)}
    %%   dplyr_row_slice.grouped_df:                            {**dplyr::dplyr_row_slice.grouped_df** (id: built-in:dplyr:dplyr_row_slice.grouped_df, type: Function, def. @7)}
    %%   dplyr_row_slice.rowwise_df:                            {**dplyr::dplyr_row_slice.rowwise_df** (id: built-in:dplyr:dplyr_row_slice.rowwise_df, type: Function, def. @7)}
    %%   explain:                                               {**dplyr::explain** (id: built-in:dplyr:explain, type: Function, def. @7)}
    %%   filter:                                                {**dplyr::filter** (id: built-in:dplyr:filter, type: Function, def. @7)}
    %%   filter_:                                               {**dplyr::filter_** (id: built-in:dplyr:filter_, type: Function, def. @7)}
    %%   filter_all:                                            {**dplyr::filter_all** (id: built-in:dplyr:filter_all, type: Function, def. @7)}
    %%   filter_at:                                             {**dplyr::filter_at** (id: built-in:dplyr:filter_at, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_size:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_size** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_size, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_type:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_type** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_type, type: Function, def. @7)}
    %%   filter_if:                                             {**dplyr::filter_if** (id: built-in:dplyr:filter_if, type: Function, def. @7)}
    %%   filter_out:                                            {**dplyr::filter_out** (id: built-in:dplyr:filter_out, type: Function, def. @7)}
    %%   filter_out.data.frame:                                 {**dplyr::filter_out.data.frame** (id: built-in:dplyr:filter_out.data.frame, type: Function, def. @7)}
    %%   filter.data.frame:                                     {**dplyr::filter.data.frame** (id: built-in:dplyr:filter.data.frame, type: Function, def. @7)}
    %%   filter.ts:                                             {**dplyr::filter.ts** (id: built-in:dplyr:filter.ts, type: Function, def. @7)}
    %%   first:                                                 {**dplyr::first** (id: built-in:dplyr:first, type: Function, def. @7)}
    %%   full_join:                                             {**dplyr::full_join** (id: built-in:dplyr:full_join, type: Function, def. @7)}
    %%   full_join.data.frame:                                  {**dplyr::full_join.data.frame** (id: built-in:dplyr:full_join.data.frame, type: Function, def. @7)}
    %%   funs:                                                  {**dplyr::funs** (id: built-in:dplyr:funs, type: Function, def. @7)}
    %%   funs_:                                                 {**dplyr::funs_** (id: built-in:dplyr:funs_, type: Function, def. @7)}
    %%   group_by:                                              {**dplyr::group_by** (id: built-in:dplyr:group_by, type: Function, def. @7)}
    %%   group_by_:                                             {**dplyr::group_by_** (id: built-in:dplyr:group_by_, type: Function, def. @7)}
    %%   group_by_all:                                          {**dplyr::group_by_all** (id: built-in:dplyr:group_by_all, type: Function, def. @7)}
    %%   group_by_at:                                           {**dplyr::group_by_at** (id: built-in:dplyr:group_by_at, type: Function, def. @7)}
    %%   group_by_drop_default:                                 {**dplyr::group_by_drop_default** (id: built-in:dplyr:group_by_drop_default, type: Function, def. @7)}
    %%   group_by_drop_default.default:                         {**dplyr::group_by_drop_default.default** (id: built-in:dplyr:group_by_drop_default.default, type: Function, def. @7)}
    %%   group_by_drop_default.grouped_df:                      {**dplyr::group_by_drop_default.grouped_df** (id: built-in:dplyr:group_by_drop_default.grouped_df, type: Function, def. @7)}
    %%   group_by_if:                                           {**dplyr::group_by_if** (id: built-in:dplyr:group_by_if, type: Function, def. @7)}
    %%   group_by_prepare:                                      {**dplyr::group_by_prepare** (id: built-in:dplyr:group_by_prepare, type: Function, def. @7)}
    %%   group_by.data.frame:                                   {**dplyr::group_by.data.frame** (id: built-in:dplyr:group_by.data.frame, type: Function, def. @7)}
    %%   group_cols:                                            {**dplyr::group_cols** (id: built-in:dplyr:group_cols, type: Function, def. @7)}
    %%   group_data:                                            {**dplyr::group_data** (id: built-in:dplyr:group_data, type: Function, def. @7)}
    %%   group_data.data.frame:                                 {**dplyr::group_data.data.frame** (id: built-in:dplyr:group_data.data.frame, type: Function, def. @7)}
    %%   group_data.grouped_df:                                 {**dplyr::group_data.grouped_df** (id: built-in:dplyr:group_data.grouped_df, type: Function, def. @7)}
    %%   group_data.rowwise_df:                                 {**dplyr::group_data.rowwise_df** (id: built-in:dplyr:group_data.rowwise_df, type: Function, def. @7)}
    %%   group_data.tbl_df:                                     {**dplyr::group_data.tbl_df** (id: built-in:dplyr:group_data.tbl_df, type: Function, def. @7)}
    %%   group_indices:                                         {**dplyr::group_indices** (id: built-in:dplyr:group_indices, type: Function, def. @7)}
    %%   group_indices_:                                        {**dplyr::group_indices_** (id: built-in:dplyr:group_indices_, type: Function, def. @7)}
    %%   group_indices.data.frame:                              {**dplyr::group_indices.data.frame** (id: built-in:dplyr:group_indices.data.frame, type: Function, def. @7)}
    %%   group_keys:                                            {**dplyr::group_keys** (id: built-in:dplyr:group_keys, type: Function, def. @7)}
    %%   group_keys.data.frame:                                 {**dplyr::group_keys.data.frame** (id: built-in:dplyr:group_keys.data.frame, type: Function, def. @7)}
    %%   group_map:                                             {**dplyr::group_map** (id: built-in:dplyr:group_map, type: Function, def. @7)}
    %%   group_map.data.frame:                                  {**dplyr::group_map.data.frame** (id: built-in:dplyr:group_map.data.frame, type: Function, def. @7)}
    %%   group_modify:                                          {**dplyr::group_modify** (id: built-in:dplyr:group_modify, type: Function, def. @7)}
    %%   group_modify.data.frame:                               {**dplyr::group_modify.data.frame** (id: built-in:dplyr:group_modify.data.frame, type: Function, def. @7)}
    %%   group_modify.grouped_df:                               {**dplyr::group_modify.grouped_df** (id: built-in:dplyr:group_modify.grouped_df, type: Function, def. @7)}
    %%   group_nest:                                            {**dplyr::group_nest** (id: built-in:dplyr:group_nest, type: Function, def. @7)}
    %%   group_nest.data.frame:                                 {**dplyr::group_nest.data.frame** (id: built-in:dplyr:group_nest.data.frame, type: Function, def. @7)}
    %%   group_nest.grouped_df:                                 {**dplyr::group_nest.grouped_df** (id: built-in:dplyr:group_nest.grouped_df, type: Function, def. @7)}
    %%   group_rows:                                            {**dplyr::group_rows** (id: built-in:dplyr:group_rows, type: Function, def. @7)}
    %%   group_size:                                            {**dplyr::group_size** (id: built-in:dplyr:group_size, type: Function, def. @7)}
    %%   group_size.data.frame:                                 {**dplyr::group_size.data.frame** (id: built-in:dplyr:group_size.data.frame, type: Function, def. @7)}
    %%   group_split:                                           {**dplyr::group_split** (id: built-in:dplyr:group_split, type: Function, def. @7)}
    %%   group_split.data.frame:                                {**dplyr::group_split.data.frame** (id: built-in:dplyr:group_split.data.frame, type: Function, def. @7)}
    %%   group_split.grouped_df:                                {**dplyr::group_split.grouped_df** (id: built-in:dplyr:group_split.grouped_df, type: Function, def. @7)}
    %%   group_split.rowwise_df:                                {**dplyr::group_split.rowwise_df** (id: built-in:dplyr:group_split.rowwise_df, type: Function, def. @7)}
    %%   group_trim:                                            {**dplyr::group_trim** (id: built-in:dplyr:group_trim, type: Function, def. @7)}
    %%   group_trim.data.frame:                                 {**dplyr::group_trim.data.frame** (id: built-in:dplyr:group_trim.data.frame, type: Function, def. @7)}
    %%   group_trim.grouped_df:                                 {**dplyr::group_trim.grouped_df** (id: built-in:dplyr:group_trim.grouped_df, type: Function, def. @7)}
    %%   group_vars:                                            {**dplyr::group_vars** (id: built-in:dplyr:group_vars, type: Function, def. @7)}
    %%   group_vars.data.frame:                                 {**dplyr::group_vars.data.frame** (id: built-in:dplyr:group_vars.data.frame, type: Function, def. @7)}
    %%   group_walk:                                            {**dplyr::group_walk** (id: built-in:dplyr:group_walk, type: Function, def. @7)}
    %%   grouped_df:                                            {**dplyr::grouped_df** (id: built-in:dplyr:grouped_df, type: Function, def. @7)}
    %%   groups:                                                {**dplyr::groups** (id: built-in:dplyr:groups, type: Function, def. @7)}
    %%   groups.data.frame:                                     {**dplyr::groups.data.frame** (id: built-in:dplyr:groups.data.frame, type: Function, def. @7)}
    %%   ident:                                                 {**dplyr::ident** (id: built-in:dplyr:ident, type: Function, def. @7)}
    %%   if_all:                                                {**dplyr::if_all** (id: built-in:dplyr:if_all, type: Function, def. @7)}
    %%   if_any:                                                {**dplyr::if_any** (id: built-in:dplyr:if_any, type: Function, def. @7)}
    %%   if_else:                                               {**dplyr::if_else** (id: built-in:dplyr:if_else, type: Function, def. @7)}
    %%   inner_join:                                            {**dplyr::inner_join** (id: built-in:dplyr:inner_join, type: Function, def. @7)}
    %%   inner_join.data.frame:                                 {**dplyr::inner_join.data.frame** (id: built-in:dplyr:inner_join.data.frame, type: Function, def. @7)}
    %%   intersect.data.frame:                                  {**dplyr::intersect.data.frame** (id: built-in:dplyr:intersect.data.frame, type: Function, def. @7)}
    %%   is_grouped_df:                                         {**dplyr::is_grouped_df** (id: built-in:dplyr:is_grouped_df, type: Function, def. @7)}
    %%   is.grouped_df:                                         {**dplyr::is.grouped_df** (id: built-in:dplyr:is.grouped_df, type: Function, def. @7)}
    %%   is.src:                                                {**dplyr::is.src** (id: built-in:dplyr:is.src, type: Function, def. @7)}
    %%   is.tbl:                                                {**dplyr::is.tbl** (id: built-in:dplyr:is.tbl, type: Function, def. @7)}
    %%   join_by:                                               {**dplyr::join_by** (id: built-in:dplyr:join_by, type: Function, def. @7)}
    %%   lag:                                                   {**dplyr::lag** (id: built-in:dplyr:lag, type: Function, def. @7)}
    %%   last:                                                  {**dplyr::last** (id: built-in:dplyr:last, type: Function, def. @7)}
    %%   last_dplyr_warnings:                                   {**dplyr::last_dplyr_warnings** (id: built-in:dplyr:last_dplyr_warnings, type: Function, def. @7)}
    %%   lead:                                                  {**dplyr::lead** (id: built-in:dplyr:lead, type: Function, def. @7)}
    %%   left_join:                                             {**dplyr::left_join** (id: built-in:dplyr:left_join, type: Function, def. @7)}
    %%   left_join.data.frame:                                  {**dplyr::left_join.data.frame** (id: built-in:dplyr:left_join.data.frame, type: Function, def. @7)}
    %%   make_tbl:                                              {**dplyr::make_tbl** (id: built-in:dplyr:make_tbl, type: Function, def. @7)}
    %%   min_rank:                                              {**dplyr::min_rank** (id: built-in:dplyr:min_rank, type: Function, def. @7)}
    %%   mutate:                                                {**dplyr::mutate** (id: built-in:dplyr:mutate, type: Function, def. @7)}
    %%   mutate_:                                               {**dplyr::mutate_** (id: built-in:dplyr:mutate_, type: Function, def. @7)}
    %%   mutate_all:                                            {**dplyr::mutate_all** (id: built-in:dplyr:mutate_all, type: Function, def. @7)}
    %%   mutate_at:                                             {**dplyr::mutate_at** (id: built-in:dplyr:mutate_at, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::error_incompatible_combine:     {**dplyr::mutate_bullets.dplyr:::error_incompatible_combine** (id: built-in:dplyr:mutate_bullets.dplyr:::error_incompatible_combine, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_constant_recycle_error:  {**dplyr::mutate_bullets.dplyr:::mutate_constant_recycle_error** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_constant_recycle_error, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_incompatible_size:       {**dplyr::mutate_bullets.dplyr:::mutate_incompatible_size** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_incompatible_size, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_mixed_null:              {**dplyr::mutate_bullets.dplyr:::mutate_mixed_null** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_mixed_null, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_not_vector:              {**dplyr::mutate_bullets.dplyr:::mutate_not_vector** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_not_vector, type: Function, def. @7)}
    %%   mutate_each:                                           {**dplyr::mutate_each** (id: built-in:dplyr:mutate_each, type: Function, def. @7)}
    %%   mutate_each_:                                          {**dplyr::mutate_each_** (id: built-in:dplyr:mutate_each_, type: Function, def. @7)}
    %%   mutate_if:                                             {**dplyr::mutate_if** (id: built-in:dplyr:mutate_if, type: Function, def. @7)}
    %%   mutate.data.frame:                                     {**dplyr::mutate.data.frame** (id: built-in:dplyr:mutate.data.frame, type: Function, def. @7)}
    %%   n:                                                     {**dplyr::n** (id: built-in:dplyr:n, type: Function, def. @7)}
    %%   n_distinct:                                            {**dplyr::n_distinct** (id: built-in:dplyr:n_distinct, type: Function, def. @7)}
    %%   n_groups:                                              {**dplyr::n_groups** (id: built-in:dplyr:n_groups, type: Function, def. @7)}
    %%   n_groups.data.frame:                                   {**dplyr::n_groups.data.frame** (id: built-in:dplyr:n_groups.data.frame, type: Function, def. @7)}
    %%   na_if:                                                 {**dplyr::na_if** (id: built-in:dplyr:na_if, type: Function, def. @7)}
    %%   names<-.grouped_df:                                    {**dplyr::names<-.grouped_df** (id: built-in:dplyr:names<-.grouped_df, type: Function, def. @7)}
    %%   names<-.rowwise_df:                                    {**dplyr::names<-.rowwise_df** (id: built-in:dplyr:names<-.rowwise_df, type: Function, def. @7)}
    %%   near:                                                  {**dplyr::near** (id: built-in:dplyr:near, type: Function, def. @7)}
    %%   nest_by:                                               {**dplyr::nest_by** (id: built-in:dplyr:nest_by, type: Function, def. @7)}
    %%   nest_by.data.frame:                                    {**dplyr::nest_by.data.frame** (id: built-in:dplyr:nest_by.data.frame, type: Function, def. @7)}
    %%   nest_by.grouped_df:                                    {**dplyr::nest_by.grouped_df** (id: built-in:dplyr:nest_by.grouped_df, type: Function, def. @7)}
    %%   nest_join:                                             {**dplyr::nest_join** (id: built-in:dplyr:nest_join, type: Function, def. @7)}
    %%   nest_join.data.frame:                                  {**dplyr::nest_join.data.frame** (id: built-in:dplyr:nest_join.data.frame, type: Function, def. @7)}
    %%   new_grouped_df:                                        {**dplyr::new_grouped_df** (id: built-in:dplyr:new_grouped_df, type: Function, def. @7)}
    %%   new_rowwise_df:                                        {**dplyr::new_rowwise_df** (id: built-in:dplyr:new_rowwise_df, type: Function, def. @7)}
    %%   nth:                                                   {**dplyr::nth** (id: built-in:dplyr:nth, type: Function, def. @7)}
    %%   ntile:                                                 {**dplyr::ntile** (id: built-in:dplyr:ntile, type: Function, def. @7)}
    %%   order_by:                                              {**dplyr::order_by** (id: built-in:dplyr:order_by, type: Function, def. @7)}
    %%   percent_rank:                                          {**dplyr::percent_rank** (id: built-in:dplyr:percent_rank, type: Function, def. @7)}
    %%   pick:                                                  {**dplyr::pick** (id: built-in:dplyr:pick, type: Function, def. @7)}
    %%   print.all_vars:                                        {**dplyr::print.all_vars** (id: built-in:dplyr:print.all_vars, type: Function, def. @7)}
    %%   print.any_vars:                                        {**dplyr::print.any_vars** (id: built-in:dplyr:print.any_vars, type: Function, def. @7)}
    %%   print.dplyr_join_by:                                   {**dplyr::print.dplyr_join_by** (id: built-in:dplyr:print.dplyr_join_by, type: Function, def. @7)}
    %%   print.dplyr_sel_vars:                                  {**dplyr::print.dplyr_sel_vars** (id: built-in:dplyr:print.dplyr_sel_vars, type: Function, def. @7)}
    %%   print.fun_list:                                        {**dplyr::print.fun_list** (id: built-in:dplyr:print.fun_list, type: Function, def. @7)}
    %%   print.last_dplyr_warnings:                             {**dplyr::print.last_dplyr_warnings** (id: built-in:dplyr:print.last_dplyr_warnings, type: Function, def. @7)}
    %%   print.src:                                             {**dplyr::print.src** (id: built-in:dplyr:print.src, type: Function, def. @7)}
    %%   progress_estimated:                                    {**dplyr::progress_estimated** (id: built-in:dplyr:progress_estimated, type: Function, def. @7)}
    %%   pull:                                                  {**dplyr::pull** (id: built-in:dplyr:pull, type: Function, def. @7)}
    %%   pull.data.frame:                                       {**dplyr::pull.data.frame** (id: built-in:dplyr:pull.data.frame, type: Function, def. @7)}
    %%   rbind.grouped_df:                                      {**dplyr::rbind.grouped_df** (id: built-in:dplyr:rbind.grouped_df, type: Function, def. @7)}
    %%   rbind.rowwise_df:                                      {**dplyr::rbind.rowwise_df** (id: built-in:dplyr:rbind.rowwise_df, type: Function, def. @7)}
    %%   recode:                                                {**dplyr::recode** (id: built-in:dplyr:recode, type: Function, def. @7)}
    %%   recode_default.default:                                {**dplyr::recode_default.default** (id: built-in:dplyr:recode_default.default, type: Function, def. @7)}
    %%   recode_default.factor:                                 {**dplyr::recode_default.factor** (id: built-in:dplyr:recode_default.factor, type: Function, def. @7)}
    %%   recode_factor:                                         {**dplyr::recode_factor** (id: built-in:dplyr:recode_factor, type: Function, def. @7)}
    %%   recode_values:                                         {**dplyr::recode_values** (id: built-in:dplyr:recode_values, type: Function, def. @7)}
    %%   recode.character:                                      {**dplyr::recode.character** (id: built-in:dplyr:recode.character, type: Function, def. @7)}
    %%   recode.factor:                                         {**dplyr::recode.factor** (id: built-in:dplyr:recode.factor, type: Function, def. @7)}
    %%   recode.numeric:                                        {**dplyr::recode.numeric** (id: built-in:dplyr:recode.numeric, type: Function, def. @7)}
    %%   reframe:                                               {**dplyr::reframe** (id: built-in:dplyr:reframe, type: Function, def. @7)}
    %%   reframe.data.frame:                                    {**dplyr::reframe.data.frame** (id: built-in:dplyr:reframe.data.frame, type: Function, def. @7)}
    %%   relocate:                                              {**dplyr::relocate** (id: built-in:dplyr:relocate, type: Function, def. @7)}
    %%   relocate.data.frame:                                   {**dplyr::relocate.data.frame** (id: built-in:dplyr:relocate.data.frame, type: Function, def. @7)}
    %%   rename:                                                {**dplyr::rename** (id: built-in:dplyr:rename, type: Function, def. @7)}
    %%   rename_:                                               {**dplyr::rename_** (id: built-in:dplyr:rename_, type: Function, def. @7)}
    %%   rename_all:                                            {**dplyr::rename_all** (id: built-in:dplyr:rename_all, type: Function, def. @7)}
    %%   rename_at:                                             {**dplyr::rename_at** (id: built-in:dplyr:rename_at, type: Function, def. @7)}
    %%   rename_if:                                             {**dplyr::rename_if** (id: built-in:dplyr:rename_if, type: Function, def. @7)}
    %%   rename_with:                                           {**dplyr::rename_with** (id: built-in:dplyr:rename_with, type: Function, def. @7)}
    %%   rename_with.data.frame:                                {**dplyr::rename_with.data.frame** (id: built-in:dplyr:rename_with.data.frame, type: Function, def. @7)}
    %%   rename.data.frame:                                     {**dplyr::rename.data.frame** (id: built-in:dplyr:rename.data.frame, type: Function, def. @7)}
    %%   replace_values:                                        {**dplyr::replace_values** (id: built-in:dplyr:replace_values, type: Function, def. @7)}
    %%   replace_when:                                          {**dplyr::replace_when** (id: built-in:dplyr:replace_when, type: Function, def. @7)}
    %%   right_join:                                            {**dplyr::right_join** (id: built-in:dplyr:right_join, type: Function, def. @7)}
    %%   right_join.data.frame:                                 {**dplyr::right_join.data.frame** (id: built-in:dplyr:right_join.data.frame, type: Function, def. @7)}
    %%   row_number:                                            {**dplyr::row_number** (id: built-in:dplyr:row_number, type: Function, def. @7)}
    %%   rows_append:                                           {**dplyr::rows_append** (id: built-in:dplyr:rows_append, type: Function, def. @7)}
    %%   rows_append.data.frame:                                {**dplyr::rows_append.data.frame** (id: built-in:dplyr:rows_append.data.frame, type: Function, def. @7)}
    %%   rows_delete:                                           {**dplyr::rows_delete** (id: built-in:dplyr:rows_delete, type: Function, def. @7)}
    %%   rows_delete.data.frame:                                {**dplyr::rows_delete.data.frame** (id: built-in:dplyr:rows_delete.data.frame, type: Function, def. @7)}
    %%   rows_insert:                                           {**dplyr::rows_insert** (id: built-in:dplyr:rows_insert, type: Function, def. @7)}
    %%   rows_insert.data.frame:                                {**dplyr::rows_insert.data.frame** (id: built-in:dplyr:rows_insert.data.frame, type: Function, def. @7)}
    %%   rows_patch:                                            {**dplyr::rows_patch** (id: built-in:dplyr:rows_patch, type: Function, def. @7)}
    %%   rows_patch.data.frame:                                 {**dplyr::rows_patch.data.frame** (id: built-in:dplyr:rows_patch.data.frame, type: Function, def. @7)}
    %%   rows_update:                                           {**dplyr::rows_update** (id: built-in:dplyr:rows_update, type: Function, def. @7)}
    %%   rows_update.data.frame:                                {**dplyr::rows_update.data.frame** (id: built-in:dplyr:rows_update.data.frame, type: Function, def. @7)}
    %%   rows_upsert:                                           {**dplyr::rows_upsert** (id: built-in:dplyr:rows_upsert, type: Function, def. @7)}
    %%   rows_upsert.data.frame:                                {**dplyr::rows_upsert.data.frame** (id: built-in:dplyr:rows_upsert.data.frame, type: Function, def. @7)}
    %%   rowwise:                                               {**dplyr::rowwise** (id: built-in:dplyr:rowwise, type: Function, def. @7)}
    %%   rowwise.data.frame:                                    {**dplyr::rowwise.data.frame** (id: built-in:dplyr:rowwise.data.frame, type: Function, def. @7)}
    %%   rowwise.grouped_df:                                    {**dplyr::rowwise.grouped_df** (id: built-in:dplyr:rowwise.grouped_df, type: Function, def. @7)}
    %%   same_src:                                              {**dplyr::same_src** (id: built-in:dplyr:same_src, type: Function, def. @7)}
    %%   same_src.data.frame:                                   {**dplyr::same_src.data.frame** (id: built-in:dplyr:same_src.data.frame, type: Function, def. @7)}
    %%   sample_frac:                                           {**dplyr::sample_frac** (id: built-in:dplyr:sample_frac, type: Function, def. @7)}
    %%   sample_frac.data.frame:                                {**dplyr::sample_frac.data.frame** (id: built-in:dplyr:sample_frac.data.frame, type: Function, def. @7)}
    %%   sample_frac.default:                                   {**dplyr::sample_frac.default** (id: built-in:dplyr:sample_frac.default, type: Function, def. @7)}
    %%   sample_n:                                              {**dplyr::sample_n** (id: built-in:dplyr:sample_n, type: Function, def. @7)}
    %%   sample_n.data.frame:                                   {**dplyr::sample_n.data.frame** (id: built-in:dplyr:sample_n.data.frame, type: Function, def. @7)}
    %%   sample_n.default:                                      {**dplyr::sample_n.default** (id: built-in:dplyr:sample_n.default, type: Function, def. @7)}
    %%   select:                                                {**dplyr::select** (id: built-in:dplyr:select, type: Function, def. @7)}
    %%   select_:                                               {**dplyr::select_** (id: built-in:dplyr:select_, type: Function, def. @7)}
    %%   select_all:                                            {**dplyr::select_all** (id: built-in:dplyr:select_all, type: Function, def. @7)}
    %%   select_at:                                             {**dplyr::select_at** (id: built-in:dplyr:select_at, type: Function, def. @7)}
    %%   select_if:                                             {**dplyr::select_if** (id: built-in:dplyr:select_if, type: Function, def. @7)}
    %%   select.data.frame:                                     {**dplyr::select.data.frame** (id: built-in:dplyr:select.data.frame, type: Function, def. @7)}
    %%   select.list:                                           {**dplyr::select.list** (id: built-in:dplyr:select.list, type: Function, def. @7)}
    %%   semi_join:                                             {**dplyr::semi_join** (id: built-in:dplyr:semi_join, type: Function, def. @7)}
    %%   semi_join.data.frame:                                  {**dplyr::semi_join.data.frame** (id: built-in:dplyr:semi_join.data.frame, type: Function, def. @7)}
    %%   setdiff.data.frame:                                    {**dplyr::setdiff.data.frame** (id: built-in:dplyr:setdiff.data.frame, type: Function, def. @7)}
    %%   setequal.data.frame:                                   {**dplyr::setequal.data.frame** (id: built-in:dplyr:setequal.data.frame, type: Function, def. @7)}
    %%   show_query:                                            {**dplyr::show_query** (id: built-in:dplyr:show_query, type: Function, def. @7)}
    %%   slice:                                                 {**dplyr::slice** (id: built-in:dplyr:slice, type: Function, def. @7)}
    %%   slice_:                                                {**dplyr::slice_** (id: built-in:dplyr:slice_, type: Function, def. @7)}
    %%   slice_head:                                            {**dplyr::slice_head** (id: built-in:dplyr:slice_head, type: Function, def. @7)}
    %%   slice_head.data.frame:                                 {**dplyr::slice_head.data.frame** (id: built-in:dplyr:slice_head.data.frame, type: Function, def. @7)}
    %%   slice_max:                                             {**dplyr::slice_max** (id: built-in:dplyr:slice_max, type: Function, def. @7)}
    %%   slice_max.data.frame:                                  {**dplyr::slice_max.data.frame** (id: built-in:dplyr:slice_max.data.frame, type: Function, def. @7)}
    %%   slice_min:                                             {**dplyr::slice_min** (id: built-in:dplyr:slice_min, type: Function, def. @7)}
    %%   slice_min.data.frame:                                  {**dplyr::slice_min.data.frame** (id: built-in:dplyr:slice_min.data.frame, type: Function, def. @7)}
    %%   slice_sample:                                          {**dplyr::slice_sample** (id: built-in:dplyr:slice_sample, type: Function, def. @7)}
    %%   slice_sample.data.frame:                               {**dplyr::slice_sample.data.frame** (id: built-in:dplyr:slice_sample.data.frame, type: Function, def. @7)}
    %%   slice_tail:                                            {**dplyr::slice_tail** (id: built-in:dplyr:slice_tail, type: Function, def. @7)}
    %%   slice_tail.data.frame:                                 {**dplyr::slice_tail.data.frame** (id: built-in:dplyr:slice_tail.data.frame, type: Function, def. @7)}
    %%   slice.data.frame:                                      {**dplyr::slice.data.frame** (id: built-in:dplyr:slice.data.frame, type: Function, def. @7)}
    %%   sql:                                                   {**dplyr::sql** (id: built-in:dplyr:sql, type: Function, def. @7)}
    %%   sql_escape_ident:                                      {**dplyr::sql_escape_ident** (id: built-in:dplyr:sql_escape_ident, type: Function, def. @7)}
    %%   sql_escape_string:                                     {**dplyr::sql_escape_string** (id: built-in:dplyr:sql_escape_string, type: Function, def. @7)}
    %%   sql_join:                                              {**dplyr::sql_join** (id: built-in:dplyr:sql_join, type: Function, def. @7)}
    %%   sql_select:                                            {**dplyr::sql_select** (id: built-in:dplyr:sql_select, type: Function, def. @7)}
    %%   sql_semi_join:                                         {**dplyr::sql_semi_join** (id: built-in:dplyr:sql_semi_join, type: Function, def. @7)}
    %%   sql_set_op:                                            {**dplyr::sql_set_op** (id: built-in:dplyr:sql_set_op, type: Function, def. @7)}
    %%   sql_subquery:                                          {**dplyr::sql_subquery** (id: built-in:dplyr:sql_subquery, type: Function, def. @7)}
    %%   sql_translate_env:                                     {**dplyr::sql_translate_env** (id: built-in:dplyr:sql_translate_env, type: Function, def. @7)}
    %%   src:                                                   {**dplyr::src** (id: built-in:dplyr:src, type: Function, def. @7)}
    %%   src_df:                                                {**dplyr::src_df** (id: built-in:dplyr:src_df, type: Function, def. @7)}
    %%   src_local:                                             {**dplyr::src_local** (id: built-in:dplyr:src_local, type: Function, def. @7)}
    %%   src_mysql:                                             {**dplyr::src_mysql** (id: built-in:dplyr:src_mysql, type: Function, def. @7)}
    %%   src_postgres:                                          {**dplyr::src_postgres** (id: built-in:dplyr:src_postgres, type: Function, def. @7)}
    %%   src_sqlite:                                            {**dplyr::src_sqlite** (id: built-in:dplyr:src_sqlite, type: Function, def. @7)}
    %%   src_tbls:                                              {**dplyr::src_tbls** (id: built-in:dplyr:src_tbls, type: Function, def. @7)}
    %%   summarise:                                             {**dplyr::summarise** (id: built-in:dplyr:summarise, type: Function, def. @7)}
    %%   summarise_:                                            {**dplyr::summarise_** (id: built-in:dplyr:summarise_, type: Function, def. @7)}
    %%   summarise_all:                                         {**dplyr::summarise_all** (id: built-in:dplyr:summarise_all, type: Function, def. @7)}
    %%   summarise_at:                                          {**dplyr::summarise_at** (id: built-in:dplyr:summarise_at, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::reframe_incompatible_size:   {**dplyr::summarise_bullets.dplyr:::reframe_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::reframe_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_incompatible_size: {**dplyr::summarise_bullets.dplyr:::summarise_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_mixed_null:        {**dplyr::summarise_bullets.dplyr:::summarise_mixed_null** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_mixed_null, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_unsupported_type:  {**dplyr::summarise_bullets.dplyr:::summarise_unsupported_type** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_unsupported_type, type: Function, def. @7)}
    %%   summarise_each:                                        {**dplyr::summarise_each** (id: built-in:dplyr:summarise_each, type: Function, def. @7)}
    %%   summarise_each_:                                       {**dplyr::summarise_each_** (id: built-in:dplyr:summarise_each_, type: Function, def. @7)}
    %%   summarise_if:                                          {**dplyr::summarise_if** (id: built-in:dplyr:summarise_if, type: Function, def. @7)}
    %%   summarise.data.frame:                                  {**dplyr::summarise.data.frame** (id: built-in:dplyr:summarise.data.frame, type: Function, def. @7)}
    %%   summarise.grouped_df:                                  {**dplyr::summarise.grouped_df** (id: built-in:dplyr:summarise.grouped_df, type: Function, def. @7)}
    %%   summarise.rowwise_df:                                  {**dplyr::summarise.rowwise_df** (id: built-in:dplyr:summarise.rowwise_df, type: Function, def. @7)}
    %%   summarize:                                             {**dplyr::summarize** (id: built-in:dplyr:summarize, type: Function, def. @7)}
    %%   summarize_:                                            {**dplyr::summarize_** (id: built-in:dplyr:summarize_, type: Function, def. @7)}
    %%   summarize_all:                                         {**dplyr::summarize_all** (id: built-in:dplyr:summarize_all, type: Function, def. @7)}
    %%   summarize_at:                                          {**dplyr::summarize_at** (id: built-in:dplyr:summarize_at, type: Function, def. @7)}
    %%   summarize_each:                                        {**dplyr::summarize_each** (id: built-in:dplyr:summarize_each, type: Function, def. @7)}
    %%   summarize_each_:                                       {**dplyr::summarize_each_** (id: built-in:dplyr:summarize_each_, type: Function, def. @7)}
    %%   summarize_if:                                          {**dplyr::summarize_if** (id: built-in:dplyr:summarize_if, type: Function, def. @7)}
    %%   symdiff:                                               {**dplyr::symdiff** (id: built-in:dplyr:symdiff, type: Function, def. @7)}
    %%   symdiff.data.frame:                                    {**dplyr::symdiff.data.frame** (id: built-in:dplyr:symdiff.data.frame, type: Function, def. @7)}
    %%   symdiff.default:                                       {**dplyr::symdiff.default** (id: built-in:dplyr:symdiff.default, type: Function, def. @7)}
    %%   tally:                                                 {**dplyr::tally** (id: built-in:dplyr:tally, type: Function, def. @7)}
    %%   tally_:                                                {**dplyr::tally_** (id: built-in:dplyr:tally_, type: Function, def. @7)}
    %%   tally.data.frame:                                      {**dplyr::tally.data.frame** (id: built-in:dplyr:tally.data.frame, type: Function, def. @7)}
    %%   tbl:                                                   {**dplyr::tbl** (id: built-in:dplyr:tbl, type: Function, def. @7)}
    %%   tbl_df:                                                {**dplyr::tbl_df** (id: built-in:dplyr:tbl_df, type: Function, def. @7)}
    %%   tbl_nongroup_vars:                                     {**dplyr::tbl_nongroup_vars** (id: built-in:dplyr:tbl_nongroup_vars, type: Function, def. @7)}
    %%   tbl_ptype:                                             {**dplyr::tbl_ptype** (id: built-in:dplyr:tbl_ptype, type: Function, def. @7)}
    %%   tbl_ptype.default:                                     {**dplyr::tbl_ptype.default** (id: built-in:dplyr:tbl_ptype.default, type: Function, def. @7)}
    %%   tbl_sum.grouped_df:                                    {**dplyr::tbl_sum.grouped_df** (id: built-in:dplyr:tbl_sum.grouped_df, type: Function, def. @7)}
    %%   tbl_sum.rowwise_df:                                    {**dplyr::tbl_sum.rowwise_df** (id: built-in:dplyr:tbl_sum.rowwise_df, type: Function, def. @7)}
    %%   tbl_vars:                                              {**dplyr::tbl_vars** (id: built-in:dplyr:tbl_vars, type: Function, def. @7)}
    %%   tbl_vars.data.frame:                                   {**dplyr::tbl_vars.data.frame** (id: built-in:dplyr:tbl_vars.data.frame, type: Function, def. @7)}
    %%   tbl.DBIConnection:                                     {**dplyr::tbl.DBIConnection** (id: built-in:dplyr:tbl.DBIConnection, type: Function, def. @7)}
    %%   top_frac:                                              {**dplyr::top_frac** (id: built-in:dplyr:top_frac, type: Function, def. @7)}
    %%   top_n:                                                 {**dplyr::top_n** (id: built-in:dplyr:top_n, type: Function, def. @7)}
    %%   transmute:                                             {**dplyr::transmute** (id: built-in:dplyr:transmute, type: Function, def. @7)}
    %%   transmute_:                                            {**dplyr::transmute_** (id: built-in:dplyr:transmute_, type: Function, def. @7)}
    %%   transmute_all:                                         {**dplyr::transmute_all** (id: built-in:dplyr:transmute_all, type: Function, def. @7)}
    %%   transmute_at:                                          {**dplyr::transmute_at** (id: built-in:dplyr:transmute_at, type: Function, def. @7)}
    %%   transmute_if:                                          {**dplyr::transmute_if** (id: built-in:dplyr:transmute_if, type: Function, def. @7)}
    %%   transmute.data.frame:                                  {**dplyr::transmute.data.frame** (id: built-in:dplyr:transmute.data.frame, type: Function, def. @7)}
    %%   ungroup:                                               {**dplyr::ungroup** (id: built-in:dplyr:ungroup, type: Function, def. @7)}
    %%   ungroup.data.frame:                                    {**dplyr::ungroup.data.frame** (id: built-in:dplyr:ungroup.data.frame, type: Function, def. @7)}
    %%   ungroup.grouped_df:                                    {**dplyr::ungroup.grouped_df** (id: built-in:dplyr:ungroup.grouped_df, type: Function, def. @7)}
    %%   ungroup.rowwise_df:                                    {**dplyr::ungroup.rowwise_df** (id: built-in:dplyr:ungroup.rowwise_df, type: Function, def. @7)}
    %%   union_all:                                             {**dplyr::union_all** (id: built-in:dplyr:union_all, type: Function, def. @7)}
    %%   union_all.data.frame:                                  {**dplyr::union_all.data.frame** (id: built-in:dplyr:union_all.data.frame, type: Function, def. @7)}
    %%   union_all.default:                                     {**dplyr::union_all.default** (id: built-in:dplyr:union_all.default, type: Function, def. @7)}
    %%   union.data.frame:                                      {**dplyr::union.data.frame** (id: built-in:dplyr:union.data.frame, type: Function, def. @7)}
    %%   validate_grouped_df:                                   {**dplyr::validate_grouped_df** (id: built-in:dplyr:validate_grouped_df, type: Function, def. @7)}
    %%   validate_rowwise_df:                                   {**dplyr::validate_rowwise_df** (id: built-in:dplyr:validate_rowwise_df, type: Function, def. @7)}
    %%   vars:                                                  {**dplyr::vars** (id: built-in:dplyr:vars, type: Function, def. @7)}
    %%   when_all:                                              {**dplyr::when_all** (id: built-in:dplyr:when_all, type: Function, def. @7)}
    %%   when_any:                                              {**dplyr::when_any** (id: built-in:dplyr:when_any, type: Function, def. @7)}
    %%   with_groups:                                           {**dplyr::with_groups** (id: built-in:dplyr:with_groups, type: Function, def. @7)}
    %%   with_order:                                            {**dplyr::with_order** (id: built-in:dplyr:with_order, type: Function, def. @7)}
    %%   wrap_dbplyr_obj:                                       {**dplyr::wrap_dbplyr_obj** (id: built-in:dplyr:wrap_dbplyr_obj, type: Function, def. @7)}
    %%   %>%:                                                   {**dplyr::%>%** (id: built-in:dplyr:%>%, type: Function, def. @7)}
    %%   add_row:                                               {**dplyr::add_row** (id: built-in:dplyr:add_row, type: Function, def. @7)}
    %%   all_of:                                                {**dplyr::all_of** (id: built-in:dplyr:all_of, type: Function, def. @7)}
    %%   any_of:                                                {**dplyr::any_of** (id: built-in:dplyr:any_of, type: Function, def. @7)}
    %%   as_data_frame:                                         {**dplyr::as_data_frame** (id: built-in:dplyr:as_data_frame, type: Function, def. @7)}
    %%   as_label:                                              {**dplyr::as_label** (id: built-in:dplyr:as_label, type: Function, def. @7)}
    %%   as_tibble:                                             {**dplyr::as_tibble** (id: built-in:dplyr:as_tibble, type: Function, def. @7)}
    %%   contains:                                              {**dplyr::contains** (id: built-in:dplyr:contains, type: Function, def. @7)}
    %%   data_frame:                                            {**dplyr::data_frame** (id: built-in:dplyr:data_frame, type: Function, def. @7)}
    %%   ends_with:                                             {**dplyr::ends_with** (id: built-in:dplyr:ends_with, type: Function, def. @7)}
    %%   enexpr:                                                {**dplyr::enexpr** (id: built-in:dplyr:enexpr, type: Function, def. @7)}
    %%   enexprs:                                               {**dplyr::enexprs** (id: built-in:dplyr:enexprs, type: Function, def. @7)}
    %%   enquo:                                                 {**dplyr::enquo** (id: built-in:dplyr:enquo, type: Function, def. @7)}
    %%   enquos:                                                {**dplyr::enquos** (id: built-in:dplyr:enquos, type: Function, def. @7)}
    %%   ensym:                                                 {**dplyr::ensym** (id: built-in:dplyr:ensym, type: Function, def. @7)}
    %%   ensyms:                                                {**dplyr::ensyms** (id: built-in:dplyr:ensyms, type: Function, def. @7)}
    %%   everything:                                            {**dplyr::everything** (id: built-in:dplyr:everything, type: Function, def. @7)}
    %%   expr:                                                  {**dplyr::expr** (id: built-in:dplyr:expr, type: Function, def. @7)}
    %%   glimpse:                                               {**dplyr::glimpse** (id: built-in:dplyr:glimpse, type: Function, def. @7)}
    %%   intersect:                                             {**dplyr::intersect** (id: built-in:dplyr:intersect, type: Function, def. @7)}
    %%   last_col:                                              {**dplyr::last_col** (id: built-in:dplyr:last_col, type: Function, def. @7)}
    %%   lst:                                                   {**dplyr::lst** (id: built-in:dplyr:lst, type: Function, def. @7)}
    %%   matches:                                               {**dplyr::matches** (id: built-in:dplyr:matches, type: Function, def. @7)}
    %%   num_range:                                             {**dplyr::num_range** (id: built-in:dplyr:num_range, type: Function, def. @7)}
    %%   one_of:                                                {**dplyr::one_of** (id: built-in:dplyr:one_of, type: Function, def. @7)}
    %%   quo:                                                   {**dplyr::quo** (id: built-in:dplyr:quo, type: Function, def. @7)}
    %%   quo_name:                                              {**dplyr::quo_name** (id: built-in:dplyr:quo_name, type: Function, def. @7)}
    %%   quos:                                                  {**dplyr::quos** (id: built-in:dplyr:quos, type: Function, def. @7)}
    %%   setdiff:                                               {**dplyr::setdiff** (id: built-in:dplyr:setdiff, type: Function, def. @7)}
    %%   setequal:                                              {**dplyr::setequal** (id: built-in:dplyr:setequal, type: Function, def. @7)}
    %%   starts_with:                                           {**dplyr::starts_with** (id: built-in:dplyr:starts_with, type: Function, def. @7)}
    %%   sym:                                                   {**dplyr::sym** (id: built-in:dplyr:sym, type: Function, def. @7)}
    %%   syms:                                                  {**dplyr::syms** (id: built-in:dplyr:syms, type: Function, def. @7)}
    %%   tibble:                                                {**dplyr::tibble** (id: built-in:dplyr:tibble, type: Function, def. @7)}
    %%   tribble:                                               {**dplyr::tribble** (id: built-in:dplyr:tribble, type: Function, def. @7)}
    %%   type_sum:                                              {**dplyr::type_sum** (id: built-in:dplyr:type_sum, type: Function, def. @7)}
    %%   union:                                                 {**dplyr::union** (id: built-in:dplyr:union, type: Function, def. @7)}
    %%   where:                                                 {**dplyr::where** (id: built-in:dplyr:where, type: Function, def. @7)}
    %%   id:                                                    {**dplyr::id** (id: built-in:dplyr:id, type: Function, def. @7)}
    %%   select_vars_:                                          {**dplyr::select_vars_** (id: built-in:dplyr:select_vars_, type: Function, def. @7)}
    %%   rename_vars_:                                          {**dplyr::rename_vars_** (id: built-in:dplyr:rename_vars_, type: Function, def. @7)}
    %%   changes:                                               {**dplyr::changes** (id: built-in:dplyr:changes, type: Function, def. @7)}
    %%   location:                                              {**dplyr::location** (id: built-in:dplyr:location, type: Function, def. @7)}
    %%   eval_tbls2:                                            {**dplyr::eval_tbls2** (id: built-in:dplyr:eval_tbls2, type: Function, def. @7)}
    %%   eval_tbls:                                             {**dplyr::eval_tbls** (id: built-in:dplyr:eval_tbls, type: Function, def. @7)}
    %%   compare_tbls2:                                         {**dplyr::compare_tbls2** (id: built-in:dplyr:compare_tbls2, type: Function, def. @7)}
    %%   compare_tbls:                                          {**dplyr::compare_tbls** (id: built-in:dplyr:compare_tbls, type: Function, def. @7)}
    %%   bench_tbls:                                            {**dplyr::bench_tbls** (id: built-in:dplyr:bench_tbls, type: Function, def. @7)}
    %%   current_vars:                                          {**dplyr::current_vars** (id: built-in:dplyr:current_vars, type: Function, def. @7)}
    %%   select_var:                                            {**dplyr::select_var** (id: built-in:dplyr:select_var, type: Function, def. @7)}
    %%   rename_vars:                                           {**dplyr::rename_vars** (id: built-in:dplyr:rename_vars, type: Function, def. @7)}
    %%   select_vars:                                           {**dplyr::select_vars** (id: built-in:dplyr:select_vars, type: Function, def. @7)}
    %%   failwith:                                              {**dplyr::failwith** (id: built-in:dplyr:failwith, type: Function, def. @7)}
    %% 4----------------------------------------
    %% 5----------------------------------------
    %%   [.spec_tbl_df:                      {**readr::[.spec_tbl_df** (id: built-in:readr:[.spec_tbl_df, type: Function, def. @11)}
    %%   AccumulateCallback:                 {**readr::AccumulateCallback** (id: built-in:readr:AccumulateCallback, type: Function, def. @11)}
    %%   as_chunk_callback.ChunkCallback:    {**readr::as_chunk_callback.ChunkCallback** (id: built-in:readr:as_chunk_callback.ChunkCallback, type: Function, def. @11)}
    %%   as_chunk_callback.function:         {**readr::as_chunk_callback.function** (id: built-in:readr:as_chunk_callback.function, type: Function, def. @11)}
    %%   as_chunk_callback.R6ClassGenerator: {**readr::as_chunk_callback.R6ClassGenerator** (id: built-in:readr:as_chunk_callback.R6ClassGenerator, type: Function, def. @11)}
    %%   as_tibble.spec_tbl_df:              {**readr::as_tibble.spec_tbl_df** (id: built-in:readr:as_tibble.spec_tbl_df, type: Function, def. @11)}
    %%   as.character.col_spec:              {**readr::as.character.col_spec** (id: built-in:readr:as.character.col_spec, type: Function, def. @11)}
    %%   as.col_spec:                        {**readr::as.col_spec** (id: built-in:readr:as.col_spec, type: Function, def. @11)}
    %%   as.col_spec.character:              {**readr::as.col_spec.character** (id: built-in:readr:as.col_spec.character, type: Function, def. @11)}
    %%   as.col_spec.col_spec:               {**readr::as.col_spec.col_spec** (id: built-in:readr:as.col_spec.col_spec, type: Function, def. @11)}
    %%   as.col_spec.data.frame:             {**readr::as.col_spec.data.frame** (id: built-in:readr:as.col_spec.data.frame, type: Function, def. @11)}
    %%   as.col_spec.default:                {**readr::as.col_spec.default** (id: built-in:readr:as.col_spec.default, type: Function, def. @11)}
    %%   as.col_spec.list:                   {**readr::as.col_spec.list** (id: built-in:readr:as.col_spec.list, type: Function, def. @11)}
    %%   as.col_spec.NULL:                   {**readr::as.col_spec.NULL** (id: built-in:readr:as.col_spec.NULL, type: Function, def. @11)}
    %%   as.data.frame.spec_tbl_df:          {**readr::as.data.frame.spec_tbl_df** (id: built-in:readr:as.data.frame.spec_tbl_df, type: Function, def. @11)}
    %%   ChunkCallback:                      {**readr::ChunkCallback** (id: built-in:readr:ChunkCallback, type: Function, def. @11)}
    %%   clipboard:                          {**readr::clipboard** (id: built-in:readr:clipboard, type: Function, def. @11)}
    %%   col_character:                      {**readr::col_character** (id: built-in:readr:col_character, type: Function, def. @11)}
    %%   col_date:                           {**readr::col_date** (id: built-in:readr:col_date, type: Function, def. @11)}
    %%   col_datetime:                       {**readr::col_datetime** (id: built-in:readr:col_datetime, type: Function, def. @11)}
    %%   col_double:                         {**readr::col_double** (id: built-in:readr:col_double, type: Function, def. @11)}
    %%   col_factor:                         {**readr::col_factor** (id: built-in:readr:col_factor, type: Function, def. @11)}
    %%   col_guess:                          {**readr::col_guess** (id: built-in:readr:col_guess, type: Function, def. @11)}
    %%   col_integer:                        {**readr::col_integer** (id: built-in:readr:col_integer, type: Function, def. @11)}
    %%   col_logical:                        {**readr::col_logical** (id: built-in:readr:col_logical, type: Function, def. @11)}
    %%   col_number:                         {**readr::col_number** (id: built-in:readr:col_number, type: Function, def. @11)}
    %%   col_skip:                           {**readr::col_skip** (id: built-in:readr:col_skip, type: Function, def. @11)}
    %%   col_time:                           {**readr::col_time** (id: built-in:readr:col_time, type: Function, def. @11)}
    %%   cols:                               {**readr::cols** (id: built-in:readr:cols, type: Function, def. @11)}
    %%   cols_condense:                      {**readr::cols_condense** (id: built-in:readr:cols_condense, type: Function, def. @11)}
    %%   cols_only:                          {**readr::cols_only** (id: built-in:readr:cols_only, type: Function, def. @11)}
    %%   count_fields:                       {**readr::count_fields** (id: built-in:readr:count_fields, type: Function, def. @11)}
    %%   DataFrameCallback:                  {**readr::DataFrameCallback** (id: built-in:readr:DataFrameCallback, type: Function, def. @11)}
    %%   datasource:                         {**readr::datasource** (id: built-in:readr:datasource, type: Function, def. @11)}
    %%   date_names:                         {**readr::date_names** (id: built-in:readr:date_names, type: Function, def. @11)}
    %%   date_names_lang:                    {**readr::date_names_lang** (id: built-in:readr:date_names_lang, type: Function, def. @11)}
    %%   date_names_langs:                   {**readr::date_names_langs** (id: built-in:readr:date_names_langs, type: Function, def. @11)}
    %%   default_locale:                     {**readr::default_locale** (id: built-in:readr:default_locale, type: Function, def. @11)}
    %%   edition_get:                        {**readr::edition_get** (id: built-in:readr:edition_get, type: Function, def. @11)}
    %%   format_csv:                         {**readr::format_csv** (id: built-in:readr:format_csv, type: Function, def. @11)}
    %%   format_csv2:                        {**readr::format_csv2** (id: built-in:readr:format_csv2, type: Function, def. @11)}
    %%   format_delim:                       {**readr::format_delim** (id: built-in:readr:format_delim, type: Function, def. @11)}
    %%   format_tsv:                         {**readr::format_tsv** (id: built-in:readr:format_tsv, type: Function, def. @11)}
    %%   format.col_spec:                    {**readr::format.col_spec** (id: built-in:readr:format.col_spec, type: Function, def. @11)}
    %%   fwf_cols:                           {**readr::fwf_cols** (id: built-in:readr:fwf_cols, type: Function, def. @11)}
    %%   fwf_empty:                          {**readr::fwf_empty** (id: built-in:readr:fwf_empty, type: Function, def. @11)}
    %%   fwf_positions:                      {**readr::fwf_positions** (id: built-in:readr:fwf_positions, type: Function, def. @11)}
    %%   fwf_widths:                         {**readr::fwf_widths** (id: built-in:readr:fwf_widths, type: Function, def. @11)}
    %%   guess_encoding:                     {**readr::guess_encoding** (id: built-in:readr:guess_encoding, type: Function, def. @11)}
    %%   guess_parser:                       {**readr::guess_parser** (id: built-in:readr:guess_parser, type: Function, def. @11)}
    %%   ListCallback:                       {**readr::ListCallback** (id: built-in:readr:ListCallback, type: Function, def. @11)}
    %%   local_edition:                      {**readr::local_edition** (id: built-in:readr:local_edition, type: Function, def. @11)}
    %%   locale:                             {**readr::locale** (id: built-in:readr:locale, type: Function, def. @11)}
    %%   output_column:                      {**readr::output_column** (id: built-in:readr:output_column, type: Function, def. @11)}
    %%   output_column.default:              {**readr::output_column.default** (id: built-in:readr:output_column.default, type: Function, def. @11)}
    %%   output_column.double:               {**readr::output_column.double** (id: built-in:readr:output_column.double, type: Function, def. @11)}
    %%   output_column.POSIXt:               {**readr::output_column.POSIXt** (id: built-in:readr:output_column.POSIXt, type: Function, def. @11)}
    %%   parse_character:                    {**readr::parse_character** (id: built-in:readr:parse_character, type: Function, def. @11)}
    %%   parse_date:                         {**readr::parse_date** (id: built-in:readr:parse_date, type: Function, def. @11)}
    %%   parse_datetime:                     {**readr::parse_datetime** (id: built-in:readr:parse_datetime, type: Function, def. @11)}
    %%   parse_double:                       {**readr::parse_double** (id: built-in:readr:parse_double, type: Function, def. @11)}
    %%   parse_factor:                       {**readr::parse_factor** (id: built-in:readr:parse_factor, type: Function, def. @11)}
    %%   parse_guess:                        {**readr::parse_guess** (id: built-in:readr:parse_guess, type: Function, def. @11)}
    %%   parse_integer:                      {**readr::parse_integer** (id: built-in:readr:parse_integer, type: Function, def. @11)}
    %%   parse_logical:                      {**readr::parse_logical** (id: built-in:readr:parse_logical, type: Function, def. @11)}
    %%   parse_number:                       {**readr::parse_number** (id: built-in:readr:parse_number, type: Function, def. @11)}
    %%   parse_time:                         {**readr::parse_time** (id: built-in:readr:parse_time, type: Function, def. @11)}
    %%   parse_vector:                       {**readr::parse_vector** (id: built-in:readr:parse_vector, type: Function, def. @11)}
    %%   print.col_spec:                     {**readr::print.col_spec** (id: built-in:readr:print.col_spec, type: Function, def. @11)}
    %%   print.collector:                    {**readr::print.collector** (id: built-in:readr:print.collector, type: Function, def. @11)}
    %%   print.date_names:                   {**readr::print.date_names** (id: built-in:readr:print.date_names, type: Function, def. @11)}
    %%   print.locale:                       {**readr::print.locale** (id: built-in:readr:print.locale, type: Function, def. @11)}
    %%   problems:                           {**readr::problems** (id: built-in:readr:problems, type: Function, def. @11)}
    %%   read_builtin:                       {**readr::read_builtin** (id: built-in:readr:read_builtin, type: Function, def. @11)}
    %%   read_csv:                           {**readr::read_csv** (id: built-in:readr:read_csv, type: Function, def. @11)}
    %%   read_csv_chunked:                   {**readr::read_csv_chunked** (id: built-in:readr:read_csv_chunked, type: Function, def. @11)}
    %%   read_csv2:                          {**readr::read_csv2** (id: built-in:readr:read_csv2, type: Function, def. @11)}
    %%   read_csv2_chunked:                  {**readr::read_csv2_chunked** (id: built-in:readr:read_csv2_chunked, type: Function, def. @11)}
    %%   read_delim:                         {**readr::read_delim** (id: built-in:readr:read_delim, type: Function, def. @11)}
    %%   read_delim_chunked:                 {**readr::read_delim_chunked** (id: built-in:readr:read_delim_chunked, type: Function, def. @11)}
    %%   read_file:                          {**readr::read_file** (id: built-in:readr:read_file, type: Function, def. @11)}
    %%   read_file_raw:                      {**readr::read_file_raw** (id: built-in:readr:read_file_raw, type: Function, def. @11)}
    %%   read_fwf:                           {**readr::read_fwf** (id: built-in:readr:read_fwf, type: Function, def. @11)}
    %%   read_lines:                         {**readr::read_lines** (id: built-in:readr:read_lines, type: Function, def. @11)}
    %%   read_lines_chunked:                 {**readr::read_lines_chunked** (id: built-in:readr:read_lines_chunked, type: Function, def. @11)}
    %%   read_lines_raw:                     {**readr::read_lines_raw** (id: built-in:readr:read_lines_raw, type: Function, def. @11)}
    %%   read_lines_raw_chunked:             {**readr::read_lines_raw_chunked** (id: built-in:readr:read_lines_raw_chunked, type: Function, def. @11)}
    %%   read_log:                           {**readr::read_log** (id: built-in:readr:read_log, type: Function, def. @11)}
    %%   read_rds:                           {**readr::read_rds** (id: built-in:readr:read_rds, type: Function, def. @11)}
    %%   read_table:                         {**readr::read_table** (id: built-in:readr:read_table, type: Function, def. @11)}
    %%   read_tsv:                           {**readr::read_tsv** (id: built-in:readr:read_tsv, type: Function, def. @11)}
    %%   read_tsv_chunked:                   {**readr::read_tsv_chunked** (id: built-in:readr:read_tsv_chunked, type: Function, def. @11)}
    %%   readr_example:                      {**readr::readr_example** (id: built-in:readr:readr_example, type: Function, def. @11)}
    %%   readr_threads:                      {**readr::readr_threads** (id: built-in:readr:readr_threads, type: Function, def. @11)}
    %%   should_read_lazy:                   {**readr::should_read_lazy** (id: built-in:readr:should_read_lazy, type: Function, def. @11)}
    %%   should_show_types:                  {**readr::should_show_types** (id: built-in:readr:should_show_types, type: Function, def. @11)}
    %%   show_progress:                      {**readr::show_progress** (id: built-in:readr:show_progress, type: Function, def. @11)}
    %%   SideEffectChunkCallback:            {**readr::SideEffectChunkCallback** (id: built-in:readr:SideEffectChunkCallback, type: Function, def. @11)}
    %%   spec:                               {**readr::spec** (id: built-in:readr:spec, type: Function, def. @11)}
    %%   spec_csv:                           {**readr::spec_csv** (id: built-in:readr:spec_csv, type: Function, def. @11)}
    %%   spec_csv2:                          {**readr::spec_csv2** (id: built-in:readr:spec_csv2, type: Function, def. @11)}
    %%   spec_delim:                         {**readr::spec_delim** (id: built-in:readr:spec_delim, type: Function, def. @11)}
    %%   spec_table:                         {**readr::spec_table** (id: built-in:readr:spec_table, type: Function, def. @11)}
    %%   spec_tsv:                           {**readr::spec_tsv** (id: built-in:readr:spec_tsv, type: Function, def. @11)}
    %%   stop_for_problems:                  {**readr::stop_for_problems** (id: built-in:readr:stop_for_problems, type: Function, def. @11)}
    %%   str.col_spec:                       {**readr::str.col_spec** (id: built-in:readr:str.col_spec, type: Function, def. @11)}
    %%   tokenize:                           {**readr::tokenize** (id: built-in:readr:tokenize, type: Function, def. @11)}
    %%   tokenizer_csv:                      {**readr::tokenizer_csv** (id: built-in:readr:tokenizer_csv, type: Function, def. @11)}
    %%   tokenizer_delim:                    {**readr::tokenizer_delim** (id: built-in:readr:tokenizer_delim, type: Function, def. @11)}
    %%   tokenizer_fwf:                      {**readr::tokenizer_fwf** (id: built-in:readr:tokenizer_fwf, type: Function, def. @11)}
    %%   tokenizer_line:                     {**readr::tokenizer_line** (id: built-in:readr:tokenizer_line, type: Function, def. @11)}
    %%   tokenizer_log:                      {**readr::tokenizer_log** (id: built-in:readr:tokenizer_log, type: Function, def. @11)}
    %%   tokenizer_tsv:                      {**readr::tokenizer_tsv** (id: built-in:readr:tokenizer_tsv, type: Function, def. @11)}
    %%   tokenizer_ws:                       {**readr::tokenizer_ws** (id: built-in:readr:tokenizer_ws, type: Function, def. @11)}
    %%   type_convert:                       {**readr::type_convert** (id: built-in:readr:type_convert, type: Function, def. @11)}
    %%   type_to_col.Date:                   {**readr::type_to_col.Date** (id: built-in:readr:type_to_col.Date, type: Function, def. @11)}
    %%   type_to_col.default:                {**readr::type_to_col.default** (id: built-in:readr:type_to_col.default, type: Function, def. @11)}
    %%   type_to_col.double:                 {**readr::type_to_col.double** (id: built-in:readr:type_to_col.double, type: Function, def. @11)}
    %%   type_to_col.factor:                 {**readr::type_to_col.factor** (id: built-in:readr:type_to_col.factor, type: Function, def. @11)}
    %%   type_to_col.hms:                    {**readr::type_to_col.hms** (id: built-in:readr:type_to_col.hms, type: Function, def. @11)}
    %%   type_to_col.integer:                {**readr::type_to_col.integer** (id: built-in:readr:type_to_col.integer, type: Function, def. @11)}
    %%   type_to_col.logical:                {**readr::type_to_col.logical** (id: built-in:readr:type_to_col.logical, type: Function, def. @11)}
    %%   type_to_col.POSIXct:                {**readr::type_to_col.POSIXct** (id: built-in:readr:type_to_col.POSIXct, type: Function, def. @11)}
    %%   with_edition:                       {**readr::with_edition** (id: built-in:readr:with_edition, type: Function, def. @11)}
    %%   write_csv:                          {**readr::write_csv** (id: built-in:readr:write_csv, type: Function, def. @11)}
    %%   write_csv2:                         {**readr::write_csv2** (id: built-in:readr:write_csv2, type: Function, def. @11)}
    %%   write_delim:                        {**readr::write_delim** (id: built-in:readr:write_delim, type: Function, def. @11)}
    %%   write_excel_csv:                    {**readr::write_excel_csv** (id: built-in:readr:write_excel_csv, type: Function, def. @11)}
    %%   write_excel_csv2:                   {**readr::write_excel_csv2** (id: built-in:readr:write_excel_csv2, type: Function, def. @11)}
    %%   write_file:                         {**readr::write_file** (id: built-in:readr:write_file, type: Function, def. @11)}
    %%   write_lines:                        {**readr::write_lines** (id: built-in:readr:write_lines, type: Function, def. @11)}
    %%   write_rds:                          {**readr::write_rds** (id: built-in:readr:write_rds, type: Function, def. @11)}
    %%   write_tsv:                          {**readr::write_tsv** (id: built-in:readr:write_tsv, type: Function, def. @11)}
    %%   read_table2:                        {**readr::read_table2** (id: built-in:readr:read_table2, type: Function, def. @11)}
    %%   melt_table:                         {**readr::melt_table** (id: built-in:readr:melt_table, type: Function, def. @11)}
    %%   melt_fwf:                           {**readr::melt_fwf** (id: built-in:readr:melt_fwf, type: Function, def. @11)}
    %%   melt_delim:                         {**readr::melt_delim** (id: built-in:readr:melt_delim, type: Function, def. @11)}
    %% 6----------------------------------------
    %%   #search-path:ggplot: {**#search-path:ggplot** (id: 3, type: Variable, def. @3)}
    %%   #search-path:        {**#search-path** (id: 3, type: Variable, cds: {}, def. @3), **#search-path** (id: 7, type: Variable, cds: {}, def. @7), **#search-path** (id: 11, type: Variable, cds: {}, def. @11)}
    %%   #search-path:dplyr:  {**#search-path:dplyr** (id: 7, type: Variable, def. @7)}
    %%   #search-path:readr:  {**#search-path:readr** (id: 11, type: Variable, def. @11)}
    16[["`*#91;RFunctionCall#93;* readr#58;#58;**read#95;csv**
      *6.9-28* (**id: 16**)
    arg: (14)`"]]
    built-in:readr:read_csv["`Built-In:
readr#58;#58;read#95;csv`"]
    style built-in:readr:read_csv stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    12["`*#91;RSymbol#93;* **data**
      *6.1-4* (**id: 12**, v: 16)`"]
    17[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
      *6.1-28* (**id: 17**)
    arg: (12, 16)`"]]
    built-in:_60_-["`Built-In:
#60;#45;`"]
    style built-in:_60_- stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    20{{"`*#91;RString#93;* **#39;data2.csv#39;**
      *7.19-29* (**id: 20**)`"}}
    %% Environment of 22 [level: 0]:
    %% Built-in
    %% 1----------------------------------------
    %%    library-load: {**ggplot:: library-load** (id: 3, type: Function, def. @3)}
    %% 2----------------------------------------
    %%   magrittr:%>%:           {**dplyr::magrittr:%>%** (id: built-in:magrittr:%>%, type: Function, def. @built-in:magrittr)}
    %%   tibble:add_row:         {**dplyr::tibble:add_row** (id: built-in:tibble:add_row, type: Function, def. @built-in:tibble)}
    %%   tibble:as_data_frame:   {**dplyr::tibble:as_data_frame** (id: built-in:tibble:as_data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:as_tibble:       {**dplyr::tibble:as_tibble** (id: built-in:tibble:as_tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:data_frame:      {**dplyr::tibble:data_frame** (id: built-in:tibble:data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:lst:             {**dplyr::tibble:lst** (id: built-in:tibble:lst, type: Function, def. @built-in:tibble)}
    %%   tibble:tibble:          {**dplyr::tibble:tibble** (id: built-in:tibble:tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:tribble:         {**dplyr::tibble:tribble** (id: built-in:tibble:tribble, type: Function, def. @built-in:tibble)}
    %%   tidyselect:all_of:      {**dplyr::tidyselect:all_of** (id: built-in:tidyselect:all_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:any_of:      {**dplyr::tidyselect:any_of** (id: built-in:tidyselect:any_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:contains:    {**dplyr::tidyselect:contains** (id: built-in:tidyselect:contains, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:ends_with:   {**dplyr::tidyselect:ends_with** (id: built-in:tidyselect:ends_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:everything:  {**dplyr::tidyselect:everything** (id: built-in:tidyselect:everything, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:last_col:    {**dplyr::tidyselect:last_col** (id: built-in:tidyselect:last_col, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:matches:     {**dplyr::tidyselect:matches** (id: built-in:tidyselect:matches, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:num_range:   {**dplyr::tidyselect:num_range** (id: built-in:tidyselect:num_range, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:one_of:      {**dplyr::tidyselect:one_of** (id: built-in:tidyselect:one_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:starts_with: {**dplyr::tidyselect:starts_with** (id: built-in:tidyselect:starts_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:where:       {**dplyr::tidyselect:where** (id: built-in:tidyselect:where, type: Function, def. @built-in:tidyselect)}
    %%   rlang:as_label:         {**dplyr::rlang:as_label** (id: built-in:rlang:as_label, type: Function, def. @built-in:rlang)}
    %%   rlang:enexpr:           {**dplyr::rlang:enexpr** (id: built-in:rlang:enexpr, type: Function, def. @built-in:rlang)}
    %%   rlang:enexprs:          {**dplyr::rlang:enexprs** (id: built-in:rlang:enexprs, type: Function, def. @built-in:rlang)}
    %%   rlang:enquo:            {**dplyr::rlang:enquo** (id: built-in:rlang:enquo, type: Function, def. @built-in:rlang)}
    %%   rlang:enquos:           {**dplyr::rlang:enquos** (id: built-in:rlang:enquos, type: Function, def. @built-in:rlang)}
    %%   rlang:ensym:            {**dplyr::rlang:ensym** (id: built-in:rlang:ensym, type: Function, def. @built-in:rlang)}
    %%   rlang:ensyms:           {**dplyr::rlang:ensyms** (id: built-in:rlang:ensyms, type: Function, def. @built-in:rlang)}
    %%   rlang:expr:             {**dplyr::rlang:expr** (id: built-in:rlang:expr, type: Function, def. @built-in:rlang)}
    %%   rlang:quo:              {**dplyr::rlang:quo** (id: built-in:rlang:quo, type: Function, def. @built-in:rlang)}
    %%   rlang:quo_name:         {**dplyr::rlang:quo_name** (id: built-in:rlang:quo_name, type: Function, def. @built-in:rlang)}
    %%   rlang:quos:             {**dplyr::rlang:quos** (id: built-in:rlang:quos, type: Function, def. @built-in:rlang)}
    %%   rlang:sym:              {**dplyr::rlang:sym** (id: built-in:rlang:sym, type: Function, def. @built-in:rlang)}
    %%   rlang:syms:             {**dplyr::rlang:syms** (id: built-in:rlang:syms, type: Function, def. @built-in:rlang)}
    %%   pillar:glimpse:         {**dplyr::pillar:glimpse** (id: built-in:pillar:glimpse, type: Function, def. @built-in:pillar)}
    %%   pillar:type_sum:        {**dplyr::pillar:type_sum** (id: built-in:pillar:type_sum, type: Function, def. @built-in:pillar)}
    %%   generics:intersect:     {**dplyr::generics:intersect** (id: built-in:generics:intersect, type: Function, def. @built-in:generics)}
    %%   generics:setdiff:       {**dplyr::generics:setdiff** (id: built-in:generics:setdiff, type: Function, def. @built-in:generics)}
    %%   generics:setequal:      {**dplyr::generics:setequal** (id: built-in:generics:setequal, type: Function, def. @built-in:generics)}
    %%   generics:union:         {**dplyr::generics:union** (id: built-in:generics:union, type: Function, def. @built-in:generics)}
    %% 3----------------------------------------
    %%   [.fun_list:                                            {**dplyr::[.fun_list** (id: built-in:dplyr:[.fun_list, type: Function, def. @7)}
    %%   [.grouped_df:                                          {**dplyr::[.grouped_df** (id: built-in:dplyr:[.grouped_df, type: Function, def. @7)}
    %%   [.rowwise_df:                                          {**dplyr::[.rowwise_df** (id: built-in:dplyr:[.rowwise_df, type: Function, def. @7)}
    %%   [[<-.grouped_df:                                       {**dplyr::[[<-.grouped_df** (id: built-in:dplyr:[[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.grouped_df:                                        {**dplyr::[<-.grouped_df** (id: built-in:dplyr:[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.rowwise_df:                                        {**dplyr::[<-.rowwise_df** (id: built-in:dplyr:[<-.rowwise_df, type: Function, def. @7)}
    %%   $<-.grouped_df:                                        {**dplyr::$<-.grouped_df** (id: built-in:dplyr:$<-.grouped_df, type: Function, def. @7)}
    %%   across:                                                {**dplyr::across** (id: built-in:dplyr:across, type: Function, def. @7)}
    %%   add_count:                                             {**dplyr::add_count** (id: built-in:dplyr:add_count, type: Function, def. @7)}
    %%   add_count_:                                            {**dplyr::add_count_** (id: built-in:dplyr:add_count_, type: Function, def. @7)}
    %%   add_count.data.frame:                                  {**dplyr::add_count.data.frame** (id: built-in:dplyr:add_count.data.frame, type: Function, def. @7)}
    %%   add_count.default:                                     {**dplyr::add_count.default** (id: built-in:dplyr:add_count.default, type: Function, def. @7)}
    %%   add_rownames:                                          {**dplyr::add_rownames** (id: built-in:dplyr:add_rownames, type: Function, def. @7)}
    %%   add_tally:                                             {**dplyr::add_tally** (id: built-in:dplyr:add_tally, type: Function, def. @7)}
    %%   add_tally_:                                            {**dplyr::add_tally_** (id: built-in:dplyr:add_tally_, type: Function, def. @7)}
    %%   all_equal:                                             {**dplyr::all_equal** (id: built-in:dplyr:all_equal, type: Function, def. @7)}
    %%   all_vars:                                              {**dplyr::all_vars** (id: built-in:dplyr:all_vars, type: Function, def. @7)}
    %%   anti_join:                                             {**dplyr::anti_join** (id: built-in:dplyr:anti_join, type: Function, def. @7)}
    %%   anti_join.data.frame:                                  {**dplyr::anti_join.data.frame** (id: built-in:dplyr:anti_join.data.frame, type: Function, def. @7)}
    %%   any_vars:                                              {**dplyr::any_vars** (id: built-in:dplyr:any_vars, type: Function, def. @7)}
    %%   arrange:                                               {**dplyr::arrange** (id: built-in:dplyr:arrange, type: Function, def. @7)}
    %%   arrange_:                                              {**dplyr::arrange_** (id: built-in:dplyr:arrange_, type: Function, def. @7)}
    %%   arrange_all:                                           {**dplyr::arrange_all** (id: built-in:dplyr:arrange_all, type: Function, def. @7)}
    %%   arrange_at:                                            {**dplyr::arrange_at** (id: built-in:dplyr:arrange_at, type: Function, def. @7)}
    %%   arrange_if:                                            {**dplyr::arrange_if** (id: built-in:dplyr:arrange_if, type: Function, def. @7)}
    %%   arrange.data.frame:                                    {**dplyr::arrange.data.frame** (id: built-in:dplyr:arrange.data.frame, type: Function, def. @7)}
    %%   as_join_by.character:                                  {**dplyr::as_join_by.character** (id: built-in:dplyr:as_join_by.character, type: Function, def. @7)}
    %%   as_join_by.default:                                    {**dplyr::as_join_by.default** (id: built-in:dplyr:as_join_by.default, type: Function, def. @7)}
    %%   as_join_by.dplyr_join_by:                              {**dplyr::as_join_by.dplyr_join_by** (id: built-in:dplyr:as_join_by.dplyr_join_by, type: Function, def. @7)}
    %%   as_join_by.list:                                       {**dplyr::as_join_by.list** (id: built-in:dplyr:as_join_by.list, type: Function, def. @7)}
    %%   as_tibble.grouped_df:                                  {**dplyr::as_tibble.grouped_df** (id: built-in:dplyr:as_tibble.grouped_df, type: Function, def. @7)}
    %%   as_tibble.rowwise_df:                                  {**dplyr::as_tibble.rowwise_df** (id: built-in:dplyr:as_tibble.rowwise_df, type: Function, def. @7)}
    %%   as.data.frame.grouped_df:                              {**dplyr::as.data.frame.grouped_df** (id: built-in:dplyr:as.data.frame.grouped_df, type: Function, def. @7)}
    %%   as.tbl:                                                {**dplyr::as.tbl** (id: built-in:dplyr:as.tbl, type: Function, def. @7)}
    %%   auto_copy:                                             {**dplyr::auto_copy** (id: built-in:dplyr:auto_copy, type: Function, def. @7)}
    %%   auto_copy.data.frame:                                  {**dplyr::auto_copy.data.frame** (id: built-in:dplyr:auto_copy.data.frame, type: Function, def. @7)}
    %%   between:                                               {**dplyr::between** (id: built-in:dplyr:between, type: Function, def. @7)}
    %%   bind_cols:                                             {**dplyr::bind_cols** (id: built-in:dplyr:bind_cols, type: Function, def. @7)}
    %%   bind_rows:                                             {**dplyr::bind_rows** (id: built-in:dplyr:bind_rows, type: Function, def. @7)}
    %%   c_across:                                              {**dplyr::c_across** (id: built-in:dplyr:c_across, type: Function, def. @7)}
    %%   case_match:                                            {**dplyr::case_match** (id: built-in:dplyr:case_match, type: Function, def. @7)}
    %%   case_when:                                             {**dplyr::case_when** (id: built-in:dplyr:case_when, type: Function, def. @7)}
    %%   cbind.grouped_df:                                      {**dplyr::cbind.grouped_df** (id: built-in:dplyr:cbind.grouped_df, type: Function, def. @7)}
    %%   check_dbplyr:                                          {**dplyr::check_dbplyr** (id: built-in:dplyr:check_dbplyr, type: Function, def. @7)}
    %%   coalesce:                                              {**dplyr::coalesce** (id: built-in:dplyr:coalesce, type: Function, def. @7)}
    %%   collapse:                                              {**dplyr::collapse** (id: built-in:dplyr:collapse, type: Function, def. @7)}
    %%   collapse.data.frame:                                   {**dplyr::collapse.data.frame** (id: built-in:dplyr:collapse.data.frame, type: Function, def. @7)}
    %%   collect:                                               {**dplyr::collect** (id: built-in:dplyr:collect, type: Function, def. @7)}
    %%   collect.data.frame:                                    {**dplyr::collect.data.frame** (id: built-in:dplyr:collect.data.frame, type: Function, def. @7)}
    %%   combine:                                               {**dplyr::combine** (id: built-in:dplyr:combine, type: Function, def. @7)}
    %%   common_by:                                             {**dplyr::common_by** (id: built-in:dplyr:common_by, type: Function, def. @7)}
    %%   common_by.character:                                   {**dplyr::common_by.character** (id: built-in:dplyr:common_by.character, type: Function, def. @7)}
    %%   common_by.default:                                     {**dplyr::common_by.default** (id: built-in:dplyr:common_by.default, type: Function, def. @7)}
    %%   common_by.list:                                        {**dplyr::common_by.list** (id: built-in:dplyr:common_by.list, type: Function, def. @7)}
    %%   common_by.NULL:                                        {**dplyr::common_by.NULL** (id: built-in:dplyr:common_by.NULL, type: Function, def. @7)}
    %%   compute:                                               {**dplyr::compute** (id: built-in:dplyr:compute, type: Function, def. @7)}
    %%   compute.data.frame:                                    {**dplyr::compute.data.frame** (id: built-in:dplyr:compute.data.frame, type: Function, def. @7)}
    %%   consecutive_id:                                        {**dplyr::consecutive_id** (id: built-in:dplyr:consecutive_id, type: Function, def. @7)}
    %%   copy_to:                                               {**dplyr::copy_to** (id: built-in:dplyr:copy_to, type: Function, def. @7)}
    %%   copy_to.DBIConnection:                                 {**dplyr::copy_to.DBIConnection** (id: built-in:dplyr:copy_to.DBIConnection, type: Function, def. @7)}
    %%   count:                                                 {**dplyr::count** (id: built-in:dplyr:count, type: Function, def. @7)}
    %%   count_:                                                {**dplyr::count_** (id: built-in:dplyr:count_, type: Function, def. @7)}
    %%   count.data.frame:                                      {**dplyr::count.data.frame** (id: built-in:dplyr:count.data.frame, type: Function, def. @7)}
    %%   cross_join:                                            {**dplyr::cross_join** (id: built-in:dplyr:cross_join, type: Function, def. @7)}
    %%   cross_join.data.frame:                                 {**dplyr::cross_join.data.frame** (id: built-in:dplyr:cross_join.data.frame, type: Function, def. @7)}
    %%   cumall:                                                {**dplyr::cumall** (id: built-in:dplyr:cumall, type: Function, def. @7)}
    %%   cumany:                                                {**dplyr::cumany** (id: built-in:dplyr:cumany, type: Function, def. @7)}
    %%   cume_dist:                                             {**dplyr::cume_dist** (id: built-in:dplyr:cume_dist, type: Function, def. @7)}
    %%   cummean:                                               {**dplyr::cummean** (id: built-in:dplyr:cummean, type: Function, def. @7)}
    %%   cur_column:                                            {**dplyr::cur_column** (id: built-in:dplyr:cur_column, type: Function, def. @7)}
    %%   cur_data:                                              {**dplyr::cur_data** (id: built-in:dplyr:cur_data, type: Function, def. @7)}
    %%   cur_data_all:                                          {**dplyr::cur_data_all** (id: built-in:dplyr:cur_data_all, type: Function, def. @7)}
    %%   cur_group:                                             {**dplyr::cur_group** (id: built-in:dplyr:cur_group, type: Function, def. @7)}
    %%   cur_group_id:                                          {**dplyr::cur_group_id** (id: built-in:dplyr:cur_group_id, type: Function, def. @7)}
    %%   cur_group_rows:                                        {**dplyr::cur_group_rows** (id: built-in:dplyr:cur_group_rows, type: Function, def. @7)}
    %%   db_analyze:                                            {**dplyr::db_analyze** (id: built-in:dplyr:db_analyze, type: Function, def. @7)}
    %%   db_begin:                                              {**dplyr::db_begin** (id: built-in:dplyr:db_begin, type: Function, def. @7)}
    %%   db_commit:                                             {**dplyr::db_commit** (id: built-in:dplyr:db_commit, type: Function, def. @7)}
    %%   db_create_index:                                       {**dplyr::db_create_index** (id: built-in:dplyr:db_create_index, type: Function, def. @7)}
    %%   db_create_indexes:                                     {**dplyr::db_create_indexes** (id: built-in:dplyr:db_create_indexes, type: Function, def. @7)}
    %%   db_create_table:                                       {**dplyr::db_create_table** (id: built-in:dplyr:db_create_table, type: Function, def. @7)}
    %%   db_data_type:                                          {**dplyr::db_data_type** (id: built-in:dplyr:db_data_type, type: Function, def. @7)}
    %%   db_desc:                                               {**dplyr::db_desc** (id: built-in:dplyr:db_desc, type: Function, def. @7)}
    %%   db_drop_table:                                         {**dplyr::db_drop_table** (id: built-in:dplyr:db_drop_table, type: Function, def. @7)}
    %%   db_explain:                                            {**dplyr::db_explain** (id: built-in:dplyr:db_explain, type: Function, def. @7)}
    %%   db_has_table:                                          {**dplyr::db_has_table** (id: built-in:dplyr:db_has_table, type: Function, def. @7)}
    %%   db_insert_into:                                        {**dplyr::db_insert_into** (id: built-in:dplyr:db_insert_into, type: Function, def. @7)}
    %%   db_list_tables:                                        {**dplyr::db_list_tables** (id: built-in:dplyr:db_list_tables, type: Function, def. @7)}
    %%   db_query_fields:                                       {**dplyr::db_query_fields** (id: built-in:dplyr:db_query_fields, type: Function, def. @7)}
    %%   db_query_rows:                                         {**dplyr::db_query_rows** (id: built-in:dplyr:db_query_rows, type: Function, def. @7)}
    %%   db_rollback:                                           {**dplyr::db_rollback** (id: built-in:dplyr:db_rollback, type: Function, def. @7)}
    %%   db_save_query:                                         {**dplyr::db_save_query** (id: built-in:dplyr:db_save_query, type: Function, def. @7)}
    %%   db_write_table:                                        {**dplyr::db_write_table** (id: built-in:dplyr:db_write_table, type: Function, def. @7)}
    %%   dense_rank:                                            {**dplyr::dense_rank** (id: built-in:dplyr:dense_rank, type: Function, def. @7)}
    %%   desc:                                                  {**dplyr::desc** (id: built-in:dplyr:desc, type: Function, def. @7)}
    %%   dim_desc:                                              {**dplyr::dim_desc** (id: built-in:dplyr:dim_desc, type: Function, def. @7)}
    %%   distinct:                                              {**dplyr::distinct** (id: built-in:dplyr:distinct, type: Function, def. @7)}
    %%   distinct_:                                             {**dplyr::distinct_** (id: built-in:dplyr:distinct_, type: Function, def. @7)}
    %%   distinct_all:                                          {**dplyr::distinct_all** (id: built-in:dplyr:distinct_all, type: Function, def. @7)}
    %%   distinct_at:                                           {**dplyr::distinct_at** (id: built-in:dplyr:distinct_at, type: Function, def. @7)}
    %%   distinct_if:                                           {**dplyr::distinct_if** (id: built-in:dplyr:distinct_if, type: Function, def. @7)}
    %%   distinct_prepare:                                      {**dplyr::distinct_prepare** (id: built-in:dplyr:distinct_prepare, type: Function, def. @7)}
    %%   distinct.data.frame:                                   {**dplyr::distinct.data.frame** (id: built-in:dplyr:distinct.data.frame, type: Function, def. @7)}
    %%   do:                                                    {**dplyr::do** (id: built-in:dplyr:do, type: Function, def. @7)}
    %%   do_:                                                   {**dplyr::do_** (id: built-in:dplyr:do_, type: Function, def. @7)}
    %%   do.data.frame:                                         {**dplyr::do.data.frame** (id: built-in:dplyr:do.data.frame, type: Function, def. @7)}
    %%   do.grouped_df:                                         {**dplyr::do.grouped_df** (id: built-in:dplyr:do.grouped_df, type: Function, def. @7)}
    %%   do.NULL:                                               {**dplyr::do.NULL** (id: built-in:dplyr:do.NULL, type: Function, def. @7)}
    %%   do.rowwise_df:                                         {**dplyr::do.rowwise_df** (id: built-in:dplyr:do.rowwise_df, type: Function, def. @7)}
    %%   dplyr_col_modify:                                      {**dplyr::dplyr_col_modify** (id: built-in:dplyr:dplyr_col_modify, type: Function, def. @7)}
    %%   dplyr_col_modify.data.frame:                           {**dplyr::dplyr_col_modify.data.frame** (id: built-in:dplyr:dplyr_col_modify.data.frame, type: Function, def. @7)}
    %%   dplyr_col_modify.grouped_df:                           {**dplyr::dplyr_col_modify.grouped_df** (id: built-in:dplyr:dplyr_col_modify.grouped_df, type: Function, def. @7)}
    %%   dplyr_col_modify.rowwise_df:                           {**dplyr::dplyr_col_modify.rowwise_df** (id: built-in:dplyr:dplyr_col_modify.rowwise_df, type: Function, def. @7)}
    %%   dplyr_reconstruct:                                     {**dplyr::dplyr_reconstruct** (id: built-in:dplyr:dplyr_reconstruct, type: Function, def. @7)}
    %%   dplyr_reconstruct.data.frame:                          {**dplyr::dplyr_reconstruct.data.frame** (id: built-in:dplyr:dplyr_reconstruct.data.frame, type: Function, def. @7)}
    %%   dplyr_reconstruct.grouped_df:                          {**dplyr::dplyr_reconstruct.grouped_df** (id: built-in:dplyr:dplyr_reconstruct.grouped_df, type: Function, def. @7)}
    %%   dplyr_reconstruct.rowwise_df:                          {**dplyr::dplyr_reconstruct.rowwise_df** (id: built-in:dplyr:dplyr_reconstruct.rowwise_df, type: Function, def. @7)}
    %%   dplyr_row_slice:                                       {**dplyr::dplyr_row_slice** (id: built-in:dplyr:dplyr_row_slice, type: Function, def. @7)}
    %%   dplyr_row_slice.data.frame:                            {**dplyr::dplyr_row_slice.data.frame** (id: built-in:dplyr:dplyr_row_slice.data.frame, type: Function, def. @7)}
    %%   dplyr_row_slice.grouped_df:                            {**dplyr::dplyr_row_slice.grouped_df** (id: built-in:dplyr:dplyr_row_slice.grouped_df, type: Function, def. @7)}
    %%   dplyr_row_slice.rowwise_df:                            {**dplyr::dplyr_row_slice.rowwise_df** (id: built-in:dplyr:dplyr_row_slice.rowwise_df, type: Function, def. @7)}
    %%   explain:                                               {**dplyr::explain** (id: built-in:dplyr:explain, type: Function, def. @7)}
    %%   filter:                                                {**dplyr::filter** (id: built-in:dplyr:filter, type: Function, def. @7)}
    %%   filter_:                                               {**dplyr::filter_** (id: built-in:dplyr:filter_, type: Function, def. @7)}
    %%   filter_all:                                            {**dplyr::filter_all** (id: built-in:dplyr:filter_all, type: Function, def. @7)}
    %%   filter_at:                                             {**dplyr::filter_at** (id: built-in:dplyr:filter_at, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_size:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_size** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_size, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_type:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_type** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_type, type: Function, def. @7)}
    %%   filter_if:                                             {**dplyr::filter_if** (id: built-in:dplyr:filter_if, type: Function, def. @7)}
    %%   filter_out:                                            {**dplyr::filter_out** (id: built-in:dplyr:filter_out, type: Function, def. @7)}
    %%   filter_out.data.frame:                                 {**dplyr::filter_out.data.frame** (id: built-in:dplyr:filter_out.data.frame, type: Function, def. @7)}
    %%   filter.data.frame:                                     {**dplyr::filter.data.frame** (id: built-in:dplyr:filter.data.frame, type: Function, def. @7)}
    %%   filter.ts:                                             {**dplyr::filter.ts** (id: built-in:dplyr:filter.ts, type: Function, def. @7)}
    %%   first:                                                 {**dplyr::first** (id: built-in:dplyr:first, type: Function, def. @7)}
    %%   full_join:                                             {**dplyr::full_join** (id: built-in:dplyr:full_join, type: Function, def. @7)}
    %%   full_join.data.frame:                                  {**dplyr::full_join.data.frame** (id: built-in:dplyr:full_join.data.frame, type: Function, def. @7)}
    %%   funs:                                                  {**dplyr::funs** (id: built-in:dplyr:funs, type: Function, def. @7)}
    %%   funs_:                                                 {**dplyr::funs_** (id: built-in:dplyr:funs_, type: Function, def. @7)}
    %%   group_by:                                              {**dplyr::group_by** (id: built-in:dplyr:group_by, type: Function, def. @7)}
    %%   group_by_:                                             {**dplyr::group_by_** (id: built-in:dplyr:group_by_, type: Function, def. @7)}
    %%   group_by_all:                                          {**dplyr::group_by_all** (id: built-in:dplyr:group_by_all, type: Function, def. @7)}
    %%   group_by_at:                                           {**dplyr::group_by_at** (id: built-in:dplyr:group_by_at, type: Function, def. @7)}
    %%   group_by_drop_default:                                 {**dplyr::group_by_drop_default** (id: built-in:dplyr:group_by_drop_default, type: Function, def. @7)}
    %%   group_by_drop_default.default:                         {**dplyr::group_by_drop_default.default** (id: built-in:dplyr:group_by_drop_default.default, type: Function, def. @7)}
    %%   group_by_drop_default.grouped_df:                      {**dplyr::group_by_drop_default.grouped_df** (id: built-in:dplyr:group_by_drop_default.grouped_df, type: Function, def. @7)}
    %%   group_by_if:                                           {**dplyr::group_by_if** (id: built-in:dplyr:group_by_if, type: Function, def. @7)}
    %%   group_by_prepare:                                      {**dplyr::group_by_prepare** (id: built-in:dplyr:group_by_prepare, type: Function, def. @7)}
    %%   group_by.data.frame:                                   {**dplyr::group_by.data.frame** (id: built-in:dplyr:group_by.data.frame, type: Function, def. @7)}
    %%   group_cols:                                            {**dplyr::group_cols** (id: built-in:dplyr:group_cols, type: Function, def. @7)}
    %%   group_data:                                            {**dplyr::group_data** (id: built-in:dplyr:group_data, type: Function, def. @7)}
    %%   group_data.data.frame:                                 {**dplyr::group_data.data.frame** (id: built-in:dplyr:group_data.data.frame, type: Function, def. @7)}
    %%   group_data.grouped_df:                                 {**dplyr::group_data.grouped_df** (id: built-in:dplyr:group_data.grouped_df, type: Function, def. @7)}
    %%   group_data.rowwise_df:                                 {**dplyr::group_data.rowwise_df** (id: built-in:dplyr:group_data.rowwise_df, type: Function, def. @7)}
    %%   group_data.tbl_df:                                     {**dplyr::group_data.tbl_df** (id: built-in:dplyr:group_data.tbl_df, type: Function, def. @7)}
    %%   group_indices:                                         {**dplyr::group_indices** (id: built-in:dplyr:group_indices, type: Function, def. @7)}
    %%   group_indices_:                                        {**dplyr::group_indices_** (id: built-in:dplyr:group_indices_, type: Function, def. @7)}
    %%   group_indices.data.frame:                              {**dplyr::group_indices.data.frame** (id: built-in:dplyr:group_indices.data.frame, type: Function, def. @7)}
    %%   group_keys:                                            {**dplyr::group_keys** (id: built-in:dplyr:group_keys, type: Function, def. @7)}
    %%   group_keys.data.frame:                                 {**dplyr::group_keys.data.frame** (id: built-in:dplyr:group_keys.data.frame, type: Function, def. @7)}
    %%   group_map:                                             {**dplyr::group_map** (id: built-in:dplyr:group_map, type: Function, def. @7)}
    %%   group_map.data.frame:                                  {**dplyr::group_map.data.frame** (id: built-in:dplyr:group_map.data.frame, type: Function, def. @7)}
    %%   group_modify:                                          {**dplyr::group_modify** (id: built-in:dplyr:group_modify, type: Function, def. @7)}
    %%   group_modify.data.frame:                               {**dplyr::group_modify.data.frame** (id: built-in:dplyr:group_modify.data.frame, type: Function, def. @7)}
    %%   group_modify.grouped_df:                               {**dplyr::group_modify.grouped_df** (id: built-in:dplyr:group_modify.grouped_df, type: Function, def. @7)}
    %%   group_nest:                                            {**dplyr::group_nest** (id: built-in:dplyr:group_nest, type: Function, def. @7)}
    %%   group_nest.data.frame:                                 {**dplyr::group_nest.data.frame** (id: built-in:dplyr:group_nest.data.frame, type: Function, def. @7)}
    %%   group_nest.grouped_df:                                 {**dplyr::group_nest.grouped_df** (id: built-in:dplyr:group_nest.grouped_df, type: Function, def. @7)}
    %%   group_rows:                                            {**dplyr::group_rows** (id: built-in:dplyr:group_rows, type: Function, def. @7)}
    %%   group_size:                                            {**dplyr::group_size** (id: built-in:dplyr:group_size, type: Function, def. @7)}
    %%   group_size.data.frame:                                 {**dplyr::group_size.data.frame** (id: built-in:dplyr:group_size.data.frame, type: Function, def. @7)}
    %%   group_split:                                           {**dplyr::group_split** (id: built-in:dplyr:group_split, type: Function, def. @7)}
    %%   group_split.data.frame:                                {**dplyr::group_split.data.frame** (id: built-in:dplyr:group_split.data.frame, type: Function, def. @7)}
    %%   group_split.grouped_df:                                {**dplyr::group_split.grouped_df** (id: built-in:dplyr:group_split.grouped_df, type: Function, def. @7)}
    %%   group_split.rowwise_df:                                {**dplyr::group_split.rowwise_df** (id: built-in:dplyr:group_split.rowwise_df, type: Function, def. @7)}
    %%   group_trim:                                            {**dplyr::group_trim** (id: built-in:dplyr:group_trim, type: Function, def. @7)}
    %%   group_trim.data.frame:                                 {**dplyr::group_trim.data.frame** (id: built-in:dplyr:group_trim.data.frame, type: Function, def. @7)}
    %%   group_trim.grouped_df:                                 {**dplyr::group_trim.grouped_df** (id: built-in:dplyr:group_trim.grouped_df, type: Function, def. @7)}
    %%   group_vars:                                            {**dplyr::group_vars** (id: built-in:dplyr:group_vars, type: Function, def. @7)}
    %%   group_vars.data.frame:                                 {**dplyr::group_vars.data.frame** (id: built-in:dplyr:group_vars.data.frame, type: Function, def. @7)}
    %%   group_walk:                                            {**dplyr::group_walk** (id: built-in:dplyr:group_walk, type: Function, def. @7)}
    %%   grouped_df:                                            {**dplyr::grouped_df** (id: built-in:dplyr:grouped_df, type: Function, def. @7)}
    %%   groups:                                                {**dplyr::groups** (id: built-in:dplyr:groups, type: Function, def. @7)}
    %%   groups.data.frame:                                     {**dplyr::groups.data.frame** (id: built-in:dplyr:groups.data.frame, type: Function, def. @7)}
    %%   ident:                                                 {**dplyr::ident** (id: built-in:dplyr:ident, type: Function, def. @7)}
    %%   if_all:                                                {**dplyr::if_all** (id: built-in:dplyr:if_all, type: Function, def. @7)}
    %%   if_any:                                                {**dplyr::if_any** (id: built-in:dplyr:if_any, type: Function, def. @7)}
    %%   if_else:                                               {**dplyr::if_else** (id: built-in:dplyr:if_else, type: Function, def. @7)}
    %%   inner_join:                                            {**dplyr::inner_join** (id: built-in:dplyr:inner_join, type: Function, def. @7)}
    %%   inner_join.data.frame:                                 {**dplyr::inner_join.data.frame** (id: built-in:dplyr:inner_join.data.frame, type: Function, def. @7)}
    %%   intersect.data.frame:                                  {**dplyr::intersect.data.frame** (id: built-in:dplyr:intersect.data.frame, type: Function, def. @7)}
    %%   is_grouped_df:                                         {**dplyr::is_grouped_df** (id: built-in:dplyr:is_grouped_df, type: Function, def. @7)}
    %%   is.grouped_df:                                         {**dplyr::is.grouped_df** (id: built-in:dplyr:is.grouped_df, type: Function, def. @7)}
    %%   is.src:                                                {**dplyr::is.src** (id: built-in:dplyr:is.src, type: Function, def. @7)}
    %%   is.tbl:                                                {**dplyr::is.tbl** (id: built-in:dplyr:is.tbl, type: Function, def. @7)}
    %%   join_by:                                               {**dplyr::join_by** (id: built-in:dplyr:join_by, type: Function, def. @7)}
    %%   lag:                                                   {**dplyr::lag** (id: built-in:dplyr:lag, type: Function, def. @7)}
    %%   last:                                                  {**dplyr::last** (id: built-in:dplyr:last, type: Function, def. @7)}
    %%   last_dplyr_warnings:                                   {**dplyr::last_dplyr_warnings** (id: built-in:dplyr:last_dplyr_warnings, type: Function, def. @7)}
    %%   lead:                                                  {**dplyr::lead** (id: built-in:dplyr:lead, type: Function, def. @7)}
    %%   left_join:                                             {**dplyr::left_join** (id: built-in:dplyr:left_join, type: Function, def. @7)}
    %%   left_join.data.frame:                                  {**dplyr::left_join.data.frame** (id: built-in:dplyr:left_join.data.frame, type: Function, def. @7)}
    %%   make_tbl:                                              {**dplyr::make_tbl** (id: built-in:dplyr:make_tbl, type: Function, def. @7)}
    %%   min_rank:                                              {**dplyr::min_rank** (id: built-in:dplyr:min_rank, type: Function, def. @7)}
    %%   mutate:                                                {**dplyr::mutate** (id: built-in:dplyr:mutate, type: Function, def. @7)}
    %%   mutate_:                                               {**dplyr::mutate_** (id: built-in:dplyr:mutate_, type: Function, def. @7)}
    %%   mutate_all:                                            {**dplyr::mutate_all** (id: built-in:dplyr:mutate_all, type: Function, def. @7)}
    %%   mutate_at:                                             {**dplyr::mutate_at** (id: built-in:dplyr:mutate_at, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::error_incompatible_combine:     {**dplyr::mutate_bullets.dplyr:::error_incompatible_combine** (id: built-in:dplyr:mutate_bullets.dplyr:::error_incompatible_combine, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_constant_recycle_error:  {**dplyr::mutate_bullets.dplyr:::mutate_constant_recycle_error** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_constant_recycle_error, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_incompatible_size:       {**dplyr::mutate_bullets.dplyr:::mutate_incompatible_size** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_incompatible_size, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_mixed_null:              {**dplyr::mutate_bullets.dplyr:::mutate_mixed_null** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_mixed_null, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_not_vector:              {**dplyr::mutate_bullets.dplyr:::mutate_not_vector** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_not_vector, type: Function, def. @7)}
    %%   mutate_each:                                           {**dplyr::mutate_each** (id: built-in:dplyr:mutate_each, type: Function, def. @7)}
    %%   mutate_each_:                                          {**dplyr::mutate_each_** (id: built-in:dplyr:mutate_each_, type: Function, def. @7)}
    %%   mutate_if:                                             {**dplyr::mutate_if** (id: built-in:dplyr:mutate_if, type: Function, def. @7)}
    %%   mutate.data.frame:                                     {**dplyr::mutate.data.frame** (id: built-in:dplyr:mutate.data.frame, type: Function, def. @7)}
    %%   n:                                                     {**dplyr::n** (id: built-in:dplyr:n, type: Function, def. @7)}
    %%   n_distinct:                                            {**dplyr::n_distinct** (id: built-in:dplyr:n_distinct, type: Function, def. @7)}
    %%   n_groups:                                              {**dplyr::n_groups** (id: built-in:dplyr:n_groups, type: Function, def. @7)}
    %%   n_groups.data.frame:                                   {**dplyr::n_groups.data.frame** (id: built-in:dplyr:n_groups.data.frame, type: Function, def. @7)}
    %%   na_if:                                                 {**dplyr::na_if** (id: built-in:dplyr:na_if, type: Function, def. @7)}
    %%   names<-.grouped_df:                                    {**dplyr::names<-.grouped_df** (id: built-in:dplyr:names<-.grouped_df, type: Function, def. @7)}
    %%   names<-.rowwise_df:                                    {**dplyr::names<-.rowwise_df** (id: built-in:dplyr:names<-.rowwise_df, type: Function, def. @7)}
    %%   near:                                                  {**dplyr::near** (id: built-in:dplyr:near, type: Function, def. @7)}
    %%   nest_by:                                               {**dplyr::nest_by** (id: built-in:dplyr:nest_by, type: Function, def. @7)}
    %%   nest_by.data.frame:                                    {**dplyr::nest_by.data.frame** (id: built-in:dplyr:nest_by.data.frame, type: Function, def. @7)}
    %%   nest_by.grouped_df:                                    {**dplyr::nest_by.grouped_df** (id: built-in:dplyr:nest_by.grouped_df, type: Function, def. @7)}
    %%   nest_join:                                             {**dplyr::nest_join** (id: built-in:dplyr:nest_join, type: Function, def. @7)}
    %%   nest_join.data.frame:                                  {**dplyr::nest_join.data.frame** (id: built-in:dplyr:nest_join.data.frame, type: Function, def. @7)}
    %%   new_grouped_df:                                        {**dplyr::new_grouped_df** (id: built-in:dplyr:new_grouped_df, type: Function, def. @7)}
    %%   new_rowwise_df:                                        {**dplyr::new_rowwise_df** (id: built-in:dplyr:new_rowwise_df, type: Function, def. @7)}
    %%   nth:                                                   {**dplyr::nth** (id: built-in:dplyr:nth, type: Function, def. @7)}
    %%   ntile:                                                 {**dplyr::ntile** (id: built-in:dplyr:ntile, type: Function, def. @7)}
    %%   order_by:                                              {**dplyr::order_by** (id: built-in:dplyr:order_by, type: Function, def. @7)}
    %%   percent_rank:                                          {**dplyr::percent_rank** (id: built-in:dplyr:percent_rank, type: Function, def. @7)}
    %%   pick:                                                  {**dplyr::pick** (id: built-in:dplyr:pick, type: Function, def. @7)}
    %%   print.all_vars:                                        {**dplyr::print.all_vars** (id: built-in:dplyr:print.all_vars, type: Function, def. @7)}
    %%   print.any_vars:                                        {**dplyr::print.any_vars** (id: built-in:dplyr:print.any_vars, type: Function, def. @7)}
    %%   print.dplyr_join_by:                                   {**dplyr::print.dplyr_join_by** (id: built-in:dplyr:print.dplyr_join_by, type: Function, def. @7)}
    %%   print.dplyr_sel_vars:                                  {**dplyr::print.dplyr_sel_vars** (id: built-in:dplyr:print.dplyr_sel_vars, type: Function, def. @7)}
    %%   print.fun_list:                                        {**dplyr::print.fun_list** (id: built-in:dplyr:print.fun_list, type: Function, def. @7)}
    %%   print.last_dplyr_warnings:                             {**dplyr::print.last_dplyr_warnings** (id: built-in:dplyr:print.last_dplyr_warnings, type: Function, def. @7)}
    %%   print.src:                                             {**dplyr::print.src** (id: built-in:dplyr:print.src, type: Function, def. @7)}
    %%   progress_estimated:                                    {**dplyr::progress_estimated** (id: built-in:dplyr:progress_estimated, type: Function, def. @7)}
    %%   pull:                                                  {**dplyr::pull** (id: built-in:dplyr:pull, type: Function, def. @7)}
    %%   pull.data.frame:                                       {**dplyr::pull.data.frame** (id: built-in:dplyr:pull.data.frame, type: Function, def. @7)}
    %%   rbind.grouped_df:                                      {**dplyr::rbind.grouped_df** (id: built-in:dplyr:rbind.grouped_df, type: Function, def. @7)}
    %%   rbind.rowwise_df:                                      {**dplyr::rbind.rowwise_df** (id: built-in:dplyr:rbind.rowwise_df, type: Function, def. @7)}
    %%   recode:                                                {**dplyr::recode** (id: built-in:dplyr:recode, type: Function, def. @7)}
    %%   recode_default.default:                                {**dplyr::recode_default.default** (id: built-in:dplyr:recode_default.default, type: Function, def. @7)}
    %%   recode_default.factor:                                 {**dplyr::recode_default.factor** (id: built-in:dplyr:recode_default.factor, type: Function, def. @7)}
    %%   recode_factor:                                         {**dplyr::recode_factor** (id: built-in:dplyr:recode_factor, type: Function, def. @7)}
    %%   recode_values:                                         {**dplyr::recode_values** (id: built-in:dplyr:recode_values, type: Function, def. @7)}
    %%   recode.character:                                      {**dplyr::recode.character** (id: built-in:dplyr:recode.character, type: Function, def. @7)}
    %%   recode.factor:                                         {**dplyr::recode.factor** (id: built-in:dplyr:recode.factor, type: Function, def. @7)}
    %%   recode.numeric:                                        {**dplyr::recode.numeric** (id: built-in:dplyr:recode.numeric, type: Function, def. @7)}
    %%   reframe:                                               {**dplyr::reframe** (id: built-in:dplyr:reframe, type: Function, def. @7)}
    %%   reframe.data.frame:                                    {**dplyr::reframe.data.frame** (id: built-in:dplyr:reframe.data.frame, type: Function, def. @7)}
    %%   relocate:                                              {**dplyr::relocate** (id: built-in:dplyr:relocate, type: Function, def. @7)}
    %%   relocate.data.frame:                                   {**dplyr::relocate.data.frame** (id: built-in:dplyr:relocate.data.frame, type: Function, def. @7)}
    %%   rename:                                                {**dplyr::rename** (id: built-in:dplyr:rename, type: Function, def. @7)}
    %%   rename_:                                               {**dplyr::rename_** (id: built-in:dplyr:rename_, type: Function, def. @7)}
    %%   rename_all:                                            {**dplyr::rename_all** (id: built-in:dplyr:rename_all, type: Function, def. @7)}
    %%   rename_at:                                             {**dplyr::rename_at** (id: built-in:dplyr:rename_at, type: Function, def. @7)}
    %%   rename_if:                                             {**dplyr::rename_if** (id: built-in:dplyr:rename_if, type: Function, def. @7)}
    %%   rename_with:                                           {**dplyr::rename_with** (id: built-in:dplyr:rename_with, type: Function, def. @7)}
    %%   rename_with.data.frame:                                {**dplyr::rename_with.data.frame** (id: built-in:dplyr:rename_with.data.frame, type: Function, def. @7)}
    %%   rename.data.frame:                                     {**dplyr::rename.data.frame** (id: built-in:dplyr:rename.data.frame, type: Function, def. @7)}
    %%   replace_values:                                        {**dplyr::replace_values** (id: built-in:dplyr:replace_values, type: Function, def. @7)}
    %%   replace_when:                                          {**dplyr::replace_when** (id: built-in:dplyr:replace_when, type: Function, def. @7)}
    %%   right_join:                                            {**dplyr::right_join** (id: built-in:dplyr:right_join, type: Function, def. @7)}
    %%   right_join.data.frame:                                 {**dplyr::right_join.data.frame** (id: built-in:dplyr:right_join.data.frame, type: Function, def. @7)}
    %%   row_number:                                            {**dplyr::row_number** (id: built-in:dplyr:row_number, type: Function, def. @7)}
    %%   rows_append:                                           {**dplyr::rows_append** (id: built-in:dplyr:rows_append, type: Function, def. @7)}
    %%   rows_append.data.frame:                                {**dplyr::rows_append.data.frame** (id: built-in:dplyr:rows_append.data.frame, type: Function, def. @7)}
    %%   rows_delete:                                           {**dplyr::rows_delete** (id: built-in:dplyr:rows_delete, type: Function, def. @7)}
    %%   rows_delete.data.frame:                                {**dplyr::rows_delete.data.frame** (id: built-in:dplyr:rows_delete.data.frame, type: Function, def. @7)}
    %%   rows_insert:                                           {**dplyr::rows_insert** (id: built-in:dplyr:rows_insert, type: Function, def. @7)}
    %%   rows_insert.data.frame:                                {**dplyr::rows_insert.data.frame** (id: built-in:dplyr:rows_insert.data.frame, type: Function, def. @7)}
    %%   rows_patch:                                            {**dplyr::rows_patch** (id: built-in:dplyr:rows_patch, type: Function, def. @7)}
    %%   rows_patch.data.frame:                                 {**dplyr::rows_patch.data.frame** (id: built-in:dplyr:rows_patch.data.frame, type: Function, def. @7)}
    %%   rows_update:                                           {**dplyr::rows_update** (id: built-in:dplyr:rows_update, type: Function, def. @7)}
    %%   rows_update.data.frame:                                {**dplyr::rows_update.data.frame** (id: built-in:dplyr:rows_update.data.frame, type: Function, def. @7)}
    %%   rows_upsert:                                           {**dplyr::rows_upsert** (id: built-in:dplyr:rows_upsert, type: Function, def. @7)}
    %%   rows_upsert.data.frame:                                {**dplyr::rows_upsert.data.frame** (id: built-in:dplyr:rows_upsert.data.frame, type: Function, def. @7)}
    %%   rowwise:                                               {**dplyr::rowwise** (id: built-in:dplyr:rowwise, type: Function, def. @7)}
    %%   rowwise.data.frame:                                    {**dplyr::rowwise.data.frame** (id: built-in:dplyr:rowwise.data.frame, type: Function, def. @7)}
    %%   rowwise.grouped_df:                                    {**dplyr::rowwise.grouped_df** (id: built-in:dplyr:rowwise.grouped_df, type: Function, def. @7)}
    %%   same_src:                                              {**dplyr::same_src** (id: built-in:dplyr:same_src, type: Function, def. @7)}
    %%   same_src.data.frame:                                   {**dplyr::same_src.data.frame** (id: built-in:dplyr:same_src.data.frame, type: Function, def. @7)}
    %%   sample_frac:                                           {**dplyr::sample_frac** (id: built-in:dplyr:sample_frac, type: Function, def. @7)}
    %%   sample_frac.data.frame:                                {**dplyr::sample_frac.data.frame** (id: built-in:dplyr:sample_frac.data.frame, type: Function, def. @7)}
    %%   sample_frac.default:                                   {**dplyr::sample_frac.default** (id: built-in:dplyr:sample_frac.default, type: Function, def. @7)}
    %%   sample_n:                                              {**dplyr::sample_n** (id: built-in:dplyr:sample_n, type: Function, def. @7)}
    %%   sample_n.data.frame:                                   {**dplyr::sample_n.data.frame** (id: built-in:dplyr:sample_n.data.frame, type: Function, def. @7)}
    %%   sample_n.default:                                      {**dplyr::sample_n.default** (id: built-in:dplyr:sample_n.default, type: Function, def. @7)}
    %%   select:                                                {**dplyr::select** (id: built-in:dplyr:select, type: Function, def. @7)}
    %%   select_:                                               {**dplyr::select_** (id: built-in:dplyr:select_, type: Function, def. @7)}
    %%   select_all:                                            {**dplyr::select_all** (id: built-in:dplyr:select_all, type: Function, def. @7)}
    %%   select_at:                                             {**dplyr::select_at** (id: built-in:dplyr:select_at, type: Function, def. @7)}
    %%   select_if:                                             {**dplyr::select_if** (id: built-in:dplyr:select_if, type: Function, def. @7)}
    %%   select.data.frame:                                     {**dplyr::select.data.frame** (id: built-in:dplyr:select.data.frame, type: Function, def. @7)}
    %%   select.list:                                           {**dplyr::select.list** (id: built-in:dplyr:select.list, type: Function, def. @7)}
    %%   semi_join:                                             {**dplyr::semi_join** (id: built-in:dplyr:semi_join, type: Function, def. @7)}
    %%   semi_join.data.frame:                                  {**dplyr::semi_join.data.frame** (id: built-in:dplyr:semi_join.data.frame, type: Function, def. @7)}
    %%   setdiff.data.frame:                                    {**dplyr::setdiff.data.frame** (id: built-in:dplyr:setdiff.data.frame, type: Function, def. @7)}
    %%   setequal.data.frame:                                   {**dplyr::setequal.data.frame** (id: built-in:dplyr:setequal.data.frame, type: Function, def. @7)}
    %%   show_query:                                            {**dplyr::show_query** (id: built-in:dplyr:show_query, type: Function, def. @7)}
    %%   slice:                                                 {**dplyr::slice** (id: built-in:dplyr:slice, type: Function, def. @7)}
    %%   slice_:                                                {**dplyr::slice_** (id: built-in:dplyr:slice_, type: Function, def. @7)}
    %%   slice_head:                                            {**dplyr::slice_head** (id: built-in:dplyr:slice_head, type: Function, def. @7)}
    %%   slice_head.data.frame:                                 {**dplyr::slice_head.data.frame** (id: built-in:dplyr:slice_head.data.frame, type: Function, def. @7)}
    %%   slice_max:                                             {**dplyr::slice_max** (id: built-in:dplyr:slice_max, type: Function, def. @7)}
    %%   slice_max.data.frame:                                  {**dplyr::slice_max.data.frame** (id: built-in:dplyr:slice_max.data.frame, type: Function, def. @7)}
    %%   slice_min:                                             {**dplyr::slice_min** (id: built-in:dplyr:slice_min, type: Function, def. @7)}
    %%   slice_min.data.frame:                                  {**dplyr::slice_min.data.frame** (id: built-in:dplyr:slice_min.data.frame, type: Function, def. @7)}
    %%   slice_sample:                                          {**dplyr::slice_sample** (id: built-in:dplyr:slice_sample, type: Function, def. @7)}
    %%   slice_sample.data.frame:                               {**dplyr::slice_sample.data.frame** (id: built-in:dplyr:slice_sample.data.frame, type: Function, def. @7)}
    %%   slice_tail:                                            {**dplyr::slice_tail** (id: built-in:dplyr:slice_tail, type: Function, def. @7)}
    %%   slice_tail.data.frame:                                 {**dplyr::slice_tail.data.frame** (id: built-in:dplyr:slice_tail.data.frame, type: Function, def. @7)}
    %%   slice.data.frame:                                      {**dplyr::slice.data.frame** (id: built-in:dplyr:slice.data.frame, type: Function, def. @7)}
    %%   sql:                                                   {**dplyr::sql** (id: built-in:dplyr:sql, type: Function, def. @7)}
    %%   sql_escape_ident:                                      {**dplyr::sql_escape_ident** (id: built-in:dplyr:sql_escape_ident, type: Function, def. @7)}
    %%   sql_escape_string:                                     {**dplyr::sql_escape_string** (id: built-in:dplyr:sql_escape_string, type: Function, def. @7)}
    %%   sql_join:                                              {**dplyr::sql_join** (id: built-in:dplyr:sql_join, type: Function, def. @7)}
    %%   sql_select:                                            {**dplyr::sql_select** (id: built-in:dplyr:sql_select, type: Function, def. @7)}
    %%   sql_semi_join:                                         {**dplyr::sql_semi_join** (id: built-in:dplyr:sql_semi_join, type: Function, def. @7)}
    %%   sql_set_op:                                            {**dplyr::sql_set_op** (id: built-in:dplyr:sql_set_op, type: Function, def. @7)}
    %%   sql_subquery:                                          {**dplyr::sql_subquery** (id: built-in:dplyr:sql_subquery, type: Function, def. @7)}
    %%   sql_translate_env:                                     {**dplyr::sql_translate_env** (id: built-in:dplyr:sql_translate_env, type: Function, def. @7)}
    %%   src:                                                   {**dplyr::src** (id: built-in:dplyr:src, type: Function, def. @7)}
    %%   src_df:                                                {**dplyr::src_df** (id: built-in:dplyr:src_df, type: Function, def. @7)}
    %%   src_local:                                             {**dplyr::src_local** (id: built-in:dplyr:src_local, type: Function, def. @7)}
    %%   src_mysql:                                             {**dplyr::src_mysql** (id: built-in:dplyr:src_mysql, type: Function, def. @7)}
    %%   src_postgres:                                          {**dplyr::src_postgres** (id: built-in:dplyr:src_postgres, type: Function, def. @7)}
    %%   src_sqlite:                                            {**dplyr::src_sqlite** (id: built-in:dplyr:src_sqlite, type: Function, def. @7)}
    %%   src_tbls:                                              {**dplyr::src_tbls** (id: built-in:dplyr:src_tbls, type: Function, def. @7)}
    %%   summarise:                                             {**dplyr::summarise** (id: built-in:dplyr:summarise, type: Function, def. @7)}
    %%   summarise_:                                            {**dplyr::summarise_** (id: built-in:dplyr:summarise_, type: Function, def. @7)}
    %%   summarise_all:                                         {**dplyr::summarise_all** (id: built-in:dplyr:summarise_all, type: Function, def. @7)}
    %%   summarise_at:                                          {**dplyr::summarise_at** (id: built-in:dplyr:summarise_at, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::reframe_incompatible_size:   {**dplyr::summarise_bullets.dplyr:::reframe_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::reframe_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_incompatible_size: {**dplyr::summarise_bullets.dplyr:::summarise_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_mixed_null:        {**dplyr::summarise_bullets.dplyr:::summarise_mixed_null** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_mixed_null, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_unsupported_type:  {**dplyr::summarise_bullets.dplyr:::summarise_unsupported_type** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_unsupported_type, type: Function, def. @7)}
    %%   summarise_each:                                        {**dplyr::summarise_each** (id: built-in:dplyr:summarise_each, type: Function, def. @7)}
    %%   summarise_each_:                                       {**dplyr::summarise_each_** (id: built-in:dplyr:summarise_each_, type: Function, def. @7)}
    %%   summarise_if:                                          {**dplyr::summarise_if** (id: built-in:dplyr:summarise_if, type: Function, def. @7)}
    %%   summarise.data.frame:                                  {**dplyr::summarise.data.frame** (id: built-in:dplyr:summarise.data.frame, type: Function, def. @7)}
    %%   summarise.grouped_df:                                  {**dplyr::summarise.grouped_df** (id: built-in:dplyr:summarise.grouped_df, type: Function, def. @7)}
    %%   summarise.rowwise_df:                                  {**dplyr::summarise.rowwise_df** (id: built-in:dplyr:summarise.rowwise_df, type: Function, def. @7)}
    %%   summarize:                                             {**dplyr::summarize** (id: built-in:dplyr:summarize, type: Function, def. @7)}
    %%   summarize_:                                            {**dplyr::summarize_** (id: built-in:dplyr:summarize_, type: Function, def. @7)}
    %%   summarize_all:                                         {**dplyr::summarize_all** (id: built-in:dplyr:summarize_all, type: Function, def. @7)}
    %%   summarize_at:                                          {**dplyr::summarize_at** (id: built-in:dplyr:summarize_at, type: Function, def. @7)}
    %%   summarize_each:                                        {**dplyr::summarize_each** (id: built-in:dplyr:summarize_each, type: Function, def. @7)}
    %%   summarize_each_:                                       {**dplyr::summarize_each_** (id: built-in:dplyr:summarize_each_, type: Function, def. @7)}
    %%   summarize_if:                                          {**dplyr::summarize_if** (id: built-in:dplyr:summarize_if, type: Function, def. @7)}
    %%   symdiff:                                               {**dplyr::symdiff** (id: built-in:dplyr:symdiff, type: Function, def. @7)}
    %%   symdiff.data.frame:                                    {**dplyr::symdiff.data.frame** (id: built-in:dplyr:symdiff.data.frame, type: Function, def. @7)}
    %%   symdiff.default:                                       {**dplyr::symdiff.default** (id: built-in:dplyr:symdiff.default, type: Function, def. @7)}
    %%   tally:                                                 {**dplyr::tally** (id: built-in:dplyr:tally, type: Function, def. @7)}
    %%   tally_:                                                {**dplyr::tally_** (id: built-in:dplyr:tally_, type: Function, def. @7)}
    %%   tally.data.frame:                                      {**dplyr::tally.data.frame** (id: built-in:dplyr:tally.data.frame, type: Function, def. @7)}
    %%   tbl:                                                   {**dplyr::tbl** (id: built-in:dplyr:tbl, type: Function, def. @7)}
    %%   tbl_df:                                                {**dplyr::tbl_df** (id: built-in:dplyr:tbl_df, type: Function, def. @7)}
    %%   tbl_nongroup_vars:                                     {**dplyr::tbl_nongroup_vars** (id: built-in:dplyr:tbl_nongroup_vars, type: Function, def. @7)}
    %%   tbl_ptype:                                             {**dplyr::tbl_ptype** (id: built-in:dplyr:tbl_ptype, type: Function, def. @7)}
    %%   tbl_ptype.default:                                     {**dplyr::tbl_ptype.default** (id: built-in:dplyr:tbl_ptype.default, type: Function, def. @7)}
    %%   tbl_sum.grouped_df:                                    {**dplyr::tbl_sum.grouped_df** (id: built-in:dplyr:tbl_sum.grouped_df, type: Function, def. @7)}
    %%   tbl_sum.rowwise_df:                                    {**dplyr::tbl_sum.rowwise_df** (id: built-in:dplyr:tbl_sum.rowwise_df, type: Function, def. @7)}
    %%   tbl_vars:                                              {**dplyr::tbl_vars** (id: built-in:dplyr:tbl_vars, type: Function, def. @7)}
    %%   tbl_vars.data.frame:                                   {**dplyr::tbl_vars.data.frame** (id: built-in:dplyr:tbl_vars.data.frame, type: Function, def. @7)}
    %%   tbl.DBIConnection:                                     {**dplyr::tbl.DBIConnection** (id: built-in:dplyr:tbl.DBIConnection, type: Function, def. @7)}
    %%   top_frac:                                              {**dplyr::top_frac** (id: built-in:dplyr:top_frac, type: Function, def. @7)}
    %%   top_n:                                                 {**dplyr::top_n** (id: built-in:dplyr:top_n, type: Function, def. @7)}
    %%   transmute:                                             {**dplyr::transmute** (id: built-in:dplyr:transmute, type: Function, def. @7)}
    %%   transmute_:                                            {**dplyr::transmute_** (id: built-in:dplyr:transmute_, type: Function, def. @7)}
    %%   transmute_all:                                         {**dplyr::transmute_all** (id: built-in:dplyr:transmute_all, type: Function, def. @7)}
    %%   transmute_at:                                          {**dplyr::transmute_at** (id: built-in:dplyr:transmute_at, type: Function, def. @7)}
    %%   transmute_if:                                          {**dplyr::transmute_if** (id: built-in:dplyr:transmute_if, type: Function, def. @7)}
    %%   transmute.data.frame:                                  {**dplyr::transmute.data.frame** (id: built-in:dplyr:transmute.data.frame, type: Function, def. @7)}
    %%   ungroup:                                               {**dplyr::ungroup** (id: built-in:dplyr:ungroup, type: Function, def. @7)}
    %%   ungroup.data.frame:                                    {**dplyr::ungroup.data.frame** (id: built-in:dplyr:ungroup.data.frame, type: Function, def. @7)}
    %%   ungroup.grouped_df:                                    {**dplyr::ungroup.grouped_df** (id: built-in:dplyr:ungroup.grouped_df, type: Function, def. @7)}
    %%   ungroup.rowwise_df:                                    {**dplyr::ungroup.rowwise_df** (id: built-in:dplyr:ungroup.rowwise_df, type: Function, def. @7)}
    %%   union_all:                                             {**dplyr::union_all** (id: built-in:dplyr:union_all, type: Function, def. @7)}
    %%   union_all.data.frame:                                  {**dplyr::union_all.data.frame** (id: built-in:dplyr:union_all.data.frame, type: Function, def. @7)}
    %%   union_all.default:                                     {**dplyr::union_all.default** (id: built-in:dplyr:union_all.default, type: Function, def. @7)}
    %%   union.data.frame:                                      {**dplyr::union.data.frame** (id: built-in:dplyr:union.data.frame, type: Function, def. @7)}
    %%   validate_grouped_df:                                   {**dplyr::validate_grouped_df** (id: built-in:dplyr:validate_grouped_df, type: Function, def. @7)}
    %%   validate_rowwise_df:                                   {**dplyr::validate_rowwise_df** (id: built-in:dplyr:validate_rowwise_df, type: Function, def. @7)}
    %%   vars:                                                  {**dplyr::vars** (id: built-in:dplyr:vars, type: Function, def. @7)}
    %%   when_all:                                              {**dplyr::when_all** (id: built-in:dplyr:when_all, type: Function, def. @7)}
    %%   when_any:                                              {**dplyr::when_any** (id: built-in:dplyr:when_any, type: Function, def. @7)}
    %%   with_groups:                                           {**dplyr::with_groups** (id: built-in:dplyr:with_groups, type: Function, def. @7)}
    %%   with_order:                                            {**dplyr::with_order** (id: built-in:dplyr:with_order, type: Function, def. @7)}
    %%   wrap_dbplyr_obj:                                       {**dplyr::wrap_dbplyr_obj** (id: built-in:dplyr:wrap_dbplyr_obj, type: Function, def. @7)}
    %%   %>%:                                                   {**dplyr::%>%** (id: built-in:dplyr:%>%, type: Function, def. @7)}
    %%   add_row:                                               {**dplyr::add_row** (id: built-in:dplyr:add_row, type: Function, def. @7)}
    %%   all_of:                                                {**dplyr::all_of** (id: built-in:dplyr:all_of, type: Function, def. @7)}
    %%   any_of:                                                {**dplyr::any_of** (id: built-in:dplyr:any_of, type: Function, def. @7)}
    %%   as_data_frame:                                         {**dplyr::as_data_frame** (id: built-in:dplyr:as_data_frame, type: Function, def. @7)}
    %%   as_label:                                              {**dplyr::as_label** (id: built-in:dplyr:as_label, type: Function, def. @7)}
    %%   as_tibble:                                             {**dplyr::as_tibble** (id: built-in:dplyr:as_tibble, type: Function, def. @7)}
    %%   contains:                                              {**dplyr::contains** (id: built-in:dplyr:contains, type: Function, def. @7)}
    %%   data_frame:                                            {**dplyr::data_frame** (id: built-in:dplyr:data_frame, type: Function, def. @7)}
    %%   ends_with:                                             {**dplyr::ends_with** (id: built-in:dplyr:ends_with, type: Function, def. @7)}
    %%   enexpr:                                                {**dplyr::enexpr** (id: built-in:dplyr:enexpr, type: Function, def. @7)}
    %%   enexprs:                                               {**dplyr::enexprs** (id: built-in:dplyr:enexprs, type: Function, def. @7)}
    %%   enquo:                                                 {**dplyr::enquo** (id: built-in:dplyr:enquo, type: Function, def. @7)}
    %%   enquos:                                                {**dplyr::enquos** (id: built-in:dplyr:enquos, type: Function, def. @7)}
    %%   ensym:                                                 {**dplyr::ensym** (id: built-in:dplyr:ensym, type: Function, def. @7)}
    %%   ensyms:                                                {**dplyr::ensyms** (id: built-in:dplyr:ensyms, type: Function, def. @7)}
    %%   everything:                                            {**dplyr::everything** (id: built-in:dplyr:everything, type: Function, def. @7)}
    %%   expr:                                                  {**dplyr::expr** (id: built-in:dplyr:expr, type: Function, def. @7)}
    %%   glimpse:                                               {**dplyr::glimpse** (id: built-in:dplyr:glimpse, type: Function, def. @7)}
    %%   intersect:                                             {**dplyr::intersect** (id: built-in:dplyr:intersect, type: Function, def. @7)}
    %%   last_col:                                              {**dplyr::last_col** (id: built-in:dplyr:last_col, type: Function, def. @7)}
    %%   lst:                                                   {**dplyr::lst** (id: built-in:dplyr:lst, type: Function, def. @7)}
    %%   matches:                                               {**dplyr::matches** (id: built-in:dplyr:matches, type: Function, def. @7)}
    %%   num_range:                                             {**dplyr::num_range** (id: built-in:dplyr:num_range, type: Function, def. @7)}
    %%   one_of:                                                {**dplyr::one_of** (id: built-in:dplyr:one_of, type: Function, def. @7)}
    %%   quo:                                                   {**dplyr::quo** (id: built-in:dplyr:quo, type: Function, def. @7)}
    %%   quo_name:                                              {**dplyr::quo_name** (id: built-in:dplyr:quo_name, type: Function, def. @7)}
    %%   quos:                                                  {**dplyr::quos** (id: built-in:dplyr:quos, type: Function, def. @7)}
    %%   setdiff:                                               {**dplyr::setdiff** (id: built-in:dplyr:setdiff, type: Function, def. @7)}
    %%   setequal:                                              {**dplyr::setequal** (id: built-in:dplyr:setequal, type: Function, def. @7)}
    %%   starts_with:                                           {**dplyr::starts_with** (id: built-in:dplyr:starts_with, type: Function, def. @7)}
    %%   sym:                                                   {**dplyr::sym** (id: built-in:dplyr:sym, type: Function, def. @7)}
    %%   syms:                                                  {**dplyr::syms** (id: built-in:dplyr:syms, type: Function, def. @7)}
    %%   tibble:                                                {**dplyr::tibble** (id: built-in:dplyr:tibble, type: Function, def. @7)}
    %%   tribble:                                               {**dplyr::tribble** (id: built-in:dplyr:tribble, type: Function, def. @7)}
    %%   type_sum:                                              {**dplyr::type_sum** (id: built-in:dplyr:type_sum, type: Function, def. @7)}
    %%   union:                                                 {**dplyr::union** (id: built-in:dplyr:union, type: Function, def. @7)}
    %%   where:                                                 {**dplyr::where** (id: built-in:dplyr:where, type: Function, def. @7)}
    %%   id:                                                    {**dplyr::id** (id: built-in:dplyr:id, type: Function, def. @7)}
    %%   select_vars_:                                          {**dplyr::select_vars_** (id: built-in:dplyr:select_vars_, type: Function, def. @7)}
    %%   rename_vars_:                                          {**dplyr::rename_vars_** (id: built-in:dplyr:rename_vars_, type: Function, def. @7)}
    %%   changes:                                               {**dplyr::changes** (id: built-in:dplyr:changes, type: Function, def. @7)}
    %%   location:                                              {**dplyr::location** (id: built-in:dplyr:location, type: Function, def. @7)}
    %%   eval_tbls2:                                            {**dplyr::eval_tbls2** (id: built-in:dplyr:eval_tbls2, type: Function, def. @7)}
    %%   eval_tbls:                                             {**dplyr::eval_tbls** (id: built-in:dplyr:eval_tbls, type: Function, def. @7)}
    %%   compare_tbls2:                                         {**dplyr::compare_tbls2** (id: built-in:dplyr:compare_tbls2, type: Function, def. @7)}
    %%   compare_tbls:                                          {**dplyr::compare_tbls** (id: built-in:dplyr:compare_tbls, type: Function, def. @7)}
    %%   bench_tbls:                                            {**dplyr::bench_tbls** (id: built-in:dplyr:bench_tbls, type: Function, def. @7)}
    %%   current_vars:                                          {**dplyr::current_vars** (id: built-in:dplyr:current_vars, type: Function, def. @7)}
    %%   select_var:                                            {**dplyr::select_var** (id: built-in:dplyr:select_var, type: Function, def. @7)}
    %%   rename_vars:                                           {**dplyr::rename_vars** (id: built-in:dplyr:rename_vars, type: Function, def. @7)}
    %%   select_vars:                                           {**dplyr::select_vars** (id: built-in:dplyr:select_vars, type: Function, def. @7)}
    %%   failwith:                                              {**dplyr::failwith** (id: built-in:dplyr:failwith, type: Function, def. @7)}
    %% 4----------------------------------------
    %% 5----------------------------------------
    %%   [.spec_tbl_df:                      {**readr::[.spec_tbl_df** (id: built-in:readr:[.spec_tbl_df, type: Function, def. @11)}
    %%   AccumulateCallback:                 {**readr::AccumulateCallback** (id: built-in:readr:AccumulateCallback, type: Function, def. @11)}
    %%   as_chunk_callback.ChunkCallback:    {**readr::as_chunk_callback.ChunkCallback** (id: built-in:readr:as_chunk_callback.ChunkCallback, type: Function, def. @11)}
    %%   as_chunk_callback.function:         {**readr::as_chunk_callback.function** (id: built-in:readr:as_chunk_callback.function, type: Function, def. @11)}
    %%   as_chunk_callback.R6ClassGenerator: {**readr::as_chunk_callback.R6ClassGenerator** (id: built-in:readr:as_chunk_callback.R6ClassGenerator, type: Function, def. @11)}
    %%   as_tibble.spec_tbl_df:              {**readr::as_tibble.spec_tbl_df** (id: built-in:readr:as_tibble.spec_tbl_df, type: Function, def. @11)}
    %%   as.character.col_spec:              {**readr::as.character.col_spec** (id: built-in:readr:as.character.col_spec, type: Function, def. @11)}
    %%   as.col_spec:                        {**readr::as.col_spec** (id: built-in:readr:as.col_spec, type: Function, def. @11)}
    %%   as.col_spec.character:              {**readr::as.col_spec.character** (id: built-in:readr:as.col_spec.character, type: Function, def. @11)}
    %%   as.col_spec.col_spec:               {**readr::as.col_spec.col_spec** (id: built-in:readr:as.col_spec.col_spec, type: Function, def. @11)}
    %%   as.col_spec.data.frame:             {**readr::as.col_spec.data.frame** (id: built-in:readr:as.col_spec.data.frame, type: Function, def. @11)}
    %%   as.col_spec.default:                {**readr::as.col_spec.default** (id: built-in:readr:as.col_spec.default, type: Function, def. @11)}
    %%   as.col_spec.list:                   {**readr::as.col_spec.list** (id: built-in:readr:as.col_spec.list, type: Function, def. @11)}
    %%   as.col_spec.NULL:                   {**readr::as.col_spec.NULL** (id: built-in:readr:as.col_spec.NULL, type: Function, def. @11)}
    %%   as.data.frame.spec_tbl_df:          {**readr::as.data.frame.spec_tbl_df** (id: built-in:readr:as.data.frame.spec_tbl_df, type: Function, def. @11)}
    %%   ChunkCallback:                      {**readr::ChunkCallback** (id: built-in:readr:ChunkCallback, type: Function, def. @11)}
    %%   clipboard:                          {**readr::clipboard** (id: built-in:readr:clipboard, type: Function, def. @11)}
    %%   col_character:                      {**readr::col_character** (id: built-in:readr:col_character, type: Function, def. @11)}
    %%   col_date:                           {**readr::col_date** (id: built-in:readr:col_date, type: Function, def. @11)}
    %%   col_datetime:                       {**readr::col_datetime** (id: built-in:readr:col_datetime, type: Function, def. @11)}
    %%   col_double:                         {**readr::col_double** (id: built-in:readr:col_double, type: Function, def. @11)}
    %%   col_factor:                         {**readr::col_factor** (id: built-in:readr:col_factor, type: Function, def. @11)}
    %%   col_guess:                          {**readr::col_guess** (id: built-in:readr:col_guess, type: Function, def. @11)}
    %%   col_integer:                        {**readr::col_integer** (id: built-in:readr:col_integer, type: Function, def. @11)}
    %%   col_logical:                        {**readr::col_logical** (id: built-in:readr:col_logical, type: Function, def. @11)}
    %%   col_number:                         {**readr::col_number** (id: built-in:readr:col_number, type: Function, def. @11)}
    %%   col_skip:                           {**readr::col_skip** (id: built-in:readr:col_skip, type: Function, def. @11)}
    %%   col_time:                           {**readr::col_time** (id: built-in:readr:col_time, type: Function, def. @11)}
    %%   cols:                               {**readr::cols** (id: built-in:readr:cols, type: Function, def. @11)}
    %%   cols_condense:                      {**readr::cols_condense** (id: built-in:readr:cols_condense, type: Function, def. @11)}
    %%   cols_only:                          {**readr::cols_only** (id: built-in:readr:cols_only, type: Function, def. @11)}
    %%   count_fields:                       {**readr::count_fields** (id: built-in:readr:count_fields, type: Function, def. @11)}
    %%   DataFrameCallback:                  {**readr::DataFrameCallback** (id: built-in:readr:DataFrameCallback, type: Function, def. @11)}
    %%   datasource:                         {**readr::datasource** (id: built-in:readr:datasource, type: Function, def. @11)}
    %%   date_names:                         {**readr::date_names** (id: built-in:readr:date_names, type: Function, def. @11)}
    %%   date_names_lang:                    {**readr::date_names_lang** (id: built-in:readr:date_names_lang, type: Function, def. @11)}
    %%   date_names_langs:                   {**readr::date_names_langs** (id: built-in:readr:date_names_langs, type: Function, def. @11)}
    %%   default_locale:                     {**readr::default_locale** (id: built-in:readr:default_locale, type: Function, def. @11)}
    %%   edition_get:                        {**readr::edition_get** (id: built-in:readr:edition_get, type: Function, def. @11)}
    %%   format_csv:                         {**readr::format_csv** (id: built-in:readr:format_csv, type: Function, def. @11)}
    %%   format_csv2:                        {**readr::format_csv2** (id: built-in:readr:format_csv2, type: Function, def. @11)}
    %%   format_delim:                       {**readr::format_delim** (id: built-in:readr:format_delim, type: Function, def. @11)}
    %%   format_tsv:                         {**readr::format_tsv** (id: built-in:readr:format_tsv, type: Function, def. @11)}
    %%   format.col_spec:                    {**readr::format.col_spec** (id: built-in:readr:format.col_spec, type: Function, def. @11)}
    %%   fwf_cols:                           {**readr::fwf_cols** (id: built-in:readr:fwf_cols, type: Function, def. @11)}
    %%   fwf_empty:                          {**readr::fwf_empty** (id: built-in:readr:fwf_empty, type: Function, def. @11)}
    %%   fwf_positions:                      {**readr::fwf_positions** (id: built-in:readr:fwf_positions, type: Function, def. @11)}
    %%   fwf_widths:                         {**readr::fwf_widths** (id: built-in:readr:fwf_widths, type: Function, def. @11)}
    %%   guess_encoding:                     {**readr::guess_encoding** (id: built-in:readr:guess_encoding, type: Function, def. @11)}
    %%   guess_parser:                       {**readr::guess_parser** (id: built-in:readr:guess_parser, type: Function, def. @11)}
    %%   ListCallback:                       {**readr::ListCallback** (id: built-in:readr:ListCallback, type: Function, def. @11)}
    %%   local_edition:                      {**readr::local_edition** (id: built-in:readr:local_edition, type: Function, def. @11)}
    %%   locale:                             {**readr::locale** (id: built-in:readr:locale, type: Function, def. @11)}
    %%   output_column:                      {**readr::output_column** (id: built-in:readr:output_column, type: Function, def. @11)}
    %%   output_column.default:              {**readr::output_column.default** (id: built-in:readr:output_column.default, type: Function, def. @11)}
    %%   output_column.double:               {**readr::output_column.double** (id: built-in:readr:output_column.double, type: Function, def. @11)}
    %%   output_column.POSIXt:               {**readr::output_column.POSIXt** (id: built-in:readr:output_column.POSIXt, type: Function, def. @11)}
    %%   parse_character:                    {**readr::parse_character** (id: built-in:readr:parse_character, type: Function, def. @11)}
    %%   parse_date:                         {**readr::parse_date** (id: built-in:readr:parse_date, type: Function, def. @11)}
    %%   parse_datetime:                     {**readr::parse_datetime** (id: built-in:readr:parse_datetime, type: Function, def. @11)}
    %%   parse_double:                       {**readr::parse_double** (id: built-in:readr:parse_double, type: Function, def. @11)}
    %%   parse_factor:                       {**readr::parse_factor** (id: built-in:readr:parse_factor, type: Function, def. @11)}
    %%   parse_guess:                        {**readr::parse_guess** (id: built-in:readr:parse_guess, type: Function, def. @11)}
    %%   parse_integer:                      {**readr::parse_integer** (id: built-in:readr:parse_integer, type: Function, def. @11)}
    %%   parse_logical:                      {**readr::parse_logical** (id: built-in:readr:parse_logical, type: Function, def. @11)}
    %%   parse_number:                       {**readr::parse_number** (id: built-in:readr:parse_number, type: Function, def. @11)}
    %%   parse_time:                         {**readr::parse_time** (id: built-in:readr:parse_time, type: Function, def. @11)}
    %%   parse_vector:                       {**readr::parse_vector** (id: built-in:readr:parse_vector, type: Function, def. @11)}
    %%   print.col_spec:                     {**readr::print.col_spec** (id: built-in:readr:print.col_spec, type: Function, def. @11)}
    %%   print.collector:                    {**readr::print.collector** (id: built-in:readr:print.collector, type: Function, def. @11)}
    %%   print.date_names:                   {**readr::print.date_names** (id: built-in:readr:print.date_names, type: Function, def. @11)}
    %%   print.locale:                       {**readr::print.locale** (id: built-in:readr:print.locale, type: Function, def. @11)}
    %%   problems:                           {**readr::problems** (id: built-in:readr:problems, type: Function, def. @11)}
    %%   read_builtin:                       {**readr::read_builtin** (id: built-in:readr:read_builtin, type: Function, def. @11)}
    %%   read_csv:                           {**readr::read_csv** (id: built-in:readr:read_csv, type: Function, def. @11)}
    %%   read_csv_chunked:                   {**readr::read_csv_chunked** (id: built-in:readr:read_csv_chunked, type: Function, def. @11)}
    %%   read_csv2:                          {**readr::read_csv2** (id: built-in:readr:read_csv2, type: Function, def. @11)}
    %%   read_csv2_chunked:                  {**readr::read_csv2_chunked** (id: built-in:readr:read_csv2_chunked, type: Function, def. @11)}
    %%   read_delim:                         {**readr::read_delim** (id: built-in:readr:read_delim, type: Function, def. @11)}
    %%   read_delim_chunked:                 {**readr::read_delim_chunked** (id: built-in:readr:read_delim_chunked, type: Function, def. @11)}
    %%   read_file:                          {**readr::read_file** (id: built-in:readr:read_file, type: Function, def. @11)}
    %%   read_file_raw:                      {**readr::read_file_raw** (id: built-in:readr:read_file_raw, type: Function, def. @11)}
    %%   read_fwf:                           {**readr::read_fwf** (id: built-in:readr:read_fwf, type: Function, def. @11)}
    %%   read_lines:                         {**readr::read_lines** (id: built-in:readr:read_lines, type: Function, def. @11)}
    %%   read_lines_chunked:                 {**readr::read_lines_chunked** (id: built-in:readr:read_lines_chunked, type: Function, def. @11)}
    %%   read_lines_raw:                     {**readr::read_lines_raw** (id: built-in:readr:read_lines_raw, type: Function, def. @11)}
    %%   read_lines_raw_chunked:             {**readr::read_lines_raw_chunked** (id: built-in:readr:read_lines_raw_chunked, type: Function, def. @11)}
    %%   read_log:                           {**readr::read_log** (id: built-in:readr:read_log, type: Function, def. @11)}
    %%   read_rds:                           {**readr::read_rds** (id: built-in:readr:read_rds, type: Function, def. @11)}
    %%   read_table:                         {**readr::read_table** (id: built-in:readr:read_table, type: Function, def. @11)}
    %%   read_tsv:                           {**readr::read_tsv** (id: built-in:readr:read_tsv, type: Function, def. @11)}
    %%   read_tsv_chunked:                   {**readr::read_tsv_chunked** (id: built-in:readr:read_tsv_chunked, type: Function, def. @11)}
    %%   readr_example:                      {**readr::readr_example** (id: built-in:readr:readr_example, type: Function, def. @11)}
    %%   readr_threads:                      {**readr::readr_threads** (id: built-in:readr:readr_threads, type: Function, def. @11)}
    %%   should_read_lazy:                   {**readr::should_read_lazy** (id: built-in:readr:should_read_lazy, type: Function, def. @11)}
    %%   should_show_types:                  {**readr::should_show_types** (id: built-in:readr:should_show_types, type: Function, def. @11)}
    %%   show_progress:                      {**readr::show_progress** (id: built-in:readr:show_progress, type: Function, def. @11)}
    %%   SideEffectChunkCallback:            {**readr::SideEffectChunkCallback** (id: built-in:readr:SideEffectChunkCallback, type: Function, def. @11)}
    %%   spec:                               {**readr::spec** (id: built-in:readr:spec, type: Function, def. @11)}
    %%   spec_csv:                           {**readr::spec_csv** (id: built-in:readr:spec_csv, type: Function, def. @11)}
    %%   spec_csv2:                          {**readr::spec_csv2** (id: built-in:readr:spec_csv2, type: Function, def. @11)}
    %%   spec_delim:                         {**readr::spec_delim** (id: built-in:readr:spec_delim, type: Function, def. @11)}
    %%   spec_table:                         {**readr::spec_table** (id: built-in:readr:spec_table, type: Function, def. @11)}
    %%   spec_tsv:                           {**readr::spec_tsv** (id: built-in:readr:spec_tsv, type: Function, def. @11)}
    %%   stop_for_problems:                  {**readr::stop_for_problems** (id: built-in:readr:stop_for_problems, type: Function, def. @11)}
    %%   str.col_spec:                       {**readr::str.col_spec** (id: built-in:readr:str.col_spec, type: Function, def. @11)}
    %%   tokenize:                           {**readr::tokenize** (id: built-in:readr:tokenize, type: Function, def. @11)}
    %%   tokenizer_csv:                      {**readr::tokenizer_csv** (id: built-in:readr:tokenizer_csv, type: Function, def. @11)}
    %%   tokenizer_delim:                    {**readr::tokenizer_delim** (id: built-in:readr:tokenizer_delim, type: Function, def. @11)}
    %%   tokenizer_fwf:                      {**readr::tokenizer_fwf** (id: built-in:readr:tokenizer_fwf, type: Function, def. @11)}
    %%   tokenizer_line:                     {**readr::tokenizer_line** (id: built-in:readr:tokenizer_line, type: Function, def. @11)}
    %%   tokenizer_log:                      {**readr::tokenizer_log** (id: built-in:readr:tokenizer_log, type: Function, def. @11)}
    %%   tokenizer_tsv:                      {**readr::tokenizer_tsv** (id: built-in:readr:tokenizer_tsv, type: Function, def. @11)}
    %%   tokenizer_ws:                       {**readr::tokenizer_ws** (id: built-in:readr:tokenizer_ws, type: Function, def. @11)}
    %%   type_convert:                       {**readr::type_convert** (id: built-in:readr:type_convert, type: Function, def. @11)}
    %%   type_to_col.Date:                   {**readr::type_to_col.Date** (id: built-in:readr:type_to_col.Date, type: Function, def. @11)}
    %%   type_to_col.default:                {**readr::type_to_col.default** (id: built-in:readr:type_to_col.default, type: Function, def. @11)}
    %%   type_to_col.double:                 {**readr::type_to_col.double** (id: built-in:readr:type_to_col.double, type: Function, def. @11)}
    %%   type_to_col.factor:                 {**readr::type_to_col.factor** (id: built-in:readr:type_to_col.factor, type: Function, def. @11)}
    %%   type_to_col.hms:                    {**readr::type_to_col.hms** (id: built-in:readr:type_to_col.hms, type: Function, def. @11)}
    %%   type_to_col.integer:                {**readr::type_to_col.integer** (id: built-in:readr:type_to_col.integer, type: Function, def. @11)}
    %%   type_to_col.logical:                {**readr::type_to_col.logical** (id: built-in:readr:type_to_col.logical, type: Function, def. @11)}
    %%   type_to_col.POSIXct:                {**readr::type_to_col.POSIXct** (id: built-in:readr:type_to_col.POSIXct, type: Function, def. @11)}
    %%   with_edition:                       {**readr::with_edition** (id: built-in:readr:with_edition, type: Function, def. @11)}
    %%   write_csv:                          {**readr::write_csv** (id: built-in:readr:write_csv, type: Function, def. @11)}
    %%   write_csv2:                         {**readr::write_csv2** (id: built-in:readr:write_csv2, type: Function, def. @11)}
    %%   write_delim:                        {**readr::write_delim** (id: built-in:readr:write_delim, type: Function, def. @11)}
    %%   write_excel_csv:                    {**readr::write_excel_csv** (id: built-in:readr:write_excel_csv, type: Function, def. @11)}
    %%   write_excel_csv2:                   {**readr::write_excel_csv2** (id: built-in:readr:write_excel_csv2, type: Function, def. @11)}
    %%   write_file:                         {**readr::write_file** (id: built-in:readr:write_file, type: Function, def. @11)}
    %%   write_lines:                        {**readr::write_lines** (id: built-in:readr:write_lines, type: Function, def. @11)}
    %%   write_rds:                          {**readr::write_rds** (id: built-in:readr:write_rds, type: Function, def. @11)}
    %%   write_tsv:                          {**readr::write_tsv** (id: built-in:readr:write_tsv, type: Function, def. @11)}
    %%   read_table2:                        {**readr::read_table2** (id: built-in:readr:read_table2, type: Function, def. @11)}
    %%   melt_table:                         {**readr::melt_table** (id: built-in:readr:melt_table, type: Function, def. @11)}
    %%   melt_fwf:                           {**readr::melt_fwf** (id: built-in:readr:melt_fwf, type: Function, def. @11)}
    %%   melt_delim:                         {**readr::melt_delim** (id: built-in:readr:melt_delim, type: Function, def. @11)}
    %% 6----------------------------------------
    %%   #search-path:ggplot: {**#search-path:ggplot** (id: 3, type: Variable, def. @3)}
    %%   #search-path:        {**#search-path** (id: 3, type: Variable, cds: {}, def. @3), **#search-path** (id: 7, type: Variable, cds: {}, def. @7), **#search-path** (id: 11, type: Variable, cds: {}, def. @11)}
    %%   #search-path:dplyr:  {**#search-path:dplyr** (id: 7, type: Variable, def. @7)}
    %%   #search-path:readr:  {**#search-path:readr** (id: 11, type: Variable, def. @11)}
    %%   data:                {**data** (id: 12, type: Unknown, def. @17)}
    22[["`*#91;RFunctionCall#93;* readr#58;#58;**read#95;csv**
      *7.10-30* (**id: 22**)
    arg: (20)`"]]
    18["`*#91;RSymbol#93;* **data2**
      *7.1-5* (**id: 18**, v: 22)`"]
    23[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
      *7.1-30* (**id: 23**)
    arg: (18, 22)`"]]
    26(["`*#91;RSymbol#93;* **data**
      *9.11-14* (**id: 26**)`"])
    27{{"`*#91;RSymbol#93;* **x**
      *9.16* (**id: 27**)`"}}
    29[["`*#91;RAccess#93;* base#58;#58;**$**
      *9.11-16* (**id: 29**)
    arg: (26, 27)`"]]
    built-in:_36_["`Built-In:
$`"]
    style built-in:_36_ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    31[["`*#91;RFunctionCall#93;* base#58;#58;**mean**
      *9.6-17* (**id: 31**)
    arg: (29)`"]]
    built-in:mean["`Built-In:
mean`"]
    style built-in:mean stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    24["`*#91;RSymbol#93;* **m**
      *9.1* (**id: 24**, v: 31)`"]
    32[["`*#91;RBinaryOp#93;* base#58;#58;**#60;#45;**
      *9.1-17* (**id: 32**)
    arg: (24, 31)`"]]
    34(["`*#91;RSymbol#93;* **m**
      *10.7* (**id: 34**)`"])
    36[["`*#91;RFunctionCall#93;* base#58;#58;**print**
      *10.1-8* (**id: 36**)
    arg: (34)`"]]
    built-in:print["`Built-In:
print`"]
    style built-in:print stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    38(["`*#91;RSymbol#93;* **data**
      *12.1-4* (**id: 38**)`"])
    43(["`*#91;RSymbol#93;* **x**
      *13.24* (**id: 43**, 50+, 48+)`"])
    44(["`*#91;RArgument#93;* **x**
      *13.20* (**id: 44**, 50+, 48+)`"])
    46(["`*#91;RSymbol#93;* **y**
      *13.31* (**id: 46**, 50+, 48+)`"])
    47(["`*#91;RArgument#93;* **y**
      *13.27* (**id: 47**, 50+, 48+)`"])
    %% Environment of 48 [level: 0]:
    %% Built-in
    %% 1----------------------------------------
    %%    library-load: {**ggplot:: library-load** (id: 3, type: Function, def. @3)}
    %% 2----------------------------------------
    %%   magrittr:%>%:           {**dplyr::magrittr:%>%** (id: built-in:magrittr:%>%, type: Function, def. @built-in:magrittr)}
    %%   tibble:add_row:         {**dplyr::tibble:add_row** (id: built-in:tibble:add_row, type: Function, def. @built-in:tibble)}
    %%   tibble:as_data_frame:   {**dplyr::tibble:as_data_frame** (id: built-in:tibble:as_data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:as_tibble:       {**dplyr::tibble:as_tibble** (id: built-in:tibble:as_tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:data_frame:      {**dplyr::tibble:data_frame** (id: built-in:tibble:data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:lst:             {**dplyr::tibble:lst** (id: built-in:tibble:lst, type: Function, def. @built-in:tibble)}
    %%   tibble:tibble:          {**dplyr::tibble:tibble** (id: built-in:tibble:tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:tribble:         {**dplyr::tibble:tribble** (id: built-in:tibble:tribble, type: Function, def. @built-in:tibble)}
    %%   tidyselect:all_of:      {**dplyr::tidyselect:all_of** (id: built-in:tidyselect:all_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:any_of:      {**dplyr::tidyselect:any_of** (id: built-in:tidyselect:any_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:contains:    {**dplyr::tidyselect:contains** (id: built-in:tidyselect:contains, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:ends_with:   {**dplyr::tidyselect:ends_with** (id: built-in:tidyselect:ends_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:everything:  {**dplyr::tidyselect:everything** (id: built-in:tidyselect:everything, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:last_col:    {**dplyr::tidyselect:last_col** (id: built-in:tidyselect:last_col, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:matches:     {**dplyr::tidyselect:matches** (id: built-in:tidyselect:matches, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:num_range:   {**dplyr::tidyselect:num_range** (id: built-in:tidyselect:num_range, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:one_of:      {**dplyr::tidyselect:one_of** (id: built-in:tidyselect:one_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:starts_with: {**dplyr::tidyselect:starts_with** (id: built-in:tidyselect:starts_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:where:       {**dplyr::tidyselect:where** (id: built-in:tidyselect:where, type: Function, def. @built-in:tidyselect)}
    %%   rlang:as_label:         {**dplyr::rlang:as_label** (id: built-in:rlang:as_label, type: Function, def. @built-in:rlang)}
    %%   rlang:enexpr:           {**dplyr::rlang:enexpr** (id: built-in:rlang:enexpr, type: Function, def. @built-in:rlang)}
    %%   rlang:enexprs:          {**dplyr::rlang:enexprs** (id: built-in:rlang:enexprs, type: Function, def. @built-in:rlang)}
    %%   rlang:enquo:            {**dplyr::rlang:enquo** (id: built-in:rlang:enquo, type: Function, def. @built-in:rlang)}
    %%   rlang:enquos:           {**dplyr::rlang:enquos** (id: built-in:rlang:enquos, type: Function, def. @built-in:rlang)}
    %%   rlang:ensym:            {**dplyr::rlang:ensym** (id: built-in:rlang:ensym, type: Function, def. @built-in:rlang)}
    %%   rlang:ensyms:           {**dplyr::rlang:ensyms** (id: built-in:rlang:ensyms, type: Function, def. @built-in:rlang)}
    %%   rlang:expr:             {**dplyr::rlang:expr** (id: built-in:rlang:expr, type: Function, def. @built-in:rlang)}
    %%   rlang:quo:              {**dplyr::rlang:quo** (id: built-in:rlang:quo, type: Function, def. @built-in:rlang)}
    %%   rlang:quo_name:         {**dplyr::rlang:quo_name** (id: built-in:rlang:quo_name, type: Function, def. @built-in:rlang)}
    %%   rlang:quos:             {**dplyr::rlang:quos** (id: built-in:rlang:quos, type: Function, def. @built-in:rlang)}
    %%   rlang:sym:              {**dplyr::rlang:sym** (id: built-in:rlang:sym, type: Function, def. @built-in:rlang)}
    %%   rlang:syms:             {**dplyr::rlang:syms** (id: built-in:rlang:syms, type: Function, def. @built-in:rlang)}
    %%   pillar:glimpse:         {**dplyr::pillar:glimpse** (id: built-in:pillar:glimpse, type: Function, def. @built-in:pillar)}
    %%   pillar:type_sum:        {**dplyr::pillar:type_sum** (id: built-in:pillar:type_sum, type: Function, def. @built-in:pillar)}
    %%   generics:intersect:     {**dplyr::generics:intersect** (id: built-in:generics:intersect, type: Function, def. @built-in:generics)}
    %%   generics:setdiff:       {**dplyr::generics:setdiff** (id: built-in:generics:setdiff, type: Function, def. @built-in:generics)}
    %%   generics:setequal:      {**dplyr::generics:setequal** (id: built-in:generics:setequal, type: Function, def. @built-in:generics)}
    %%   generics:union:         {**dplyr::generics:union** (id: built-in:generics:union, type: Function, def. @built-in:generics)}
    %% 3----------------------------------------
    %%   [.fun_list:                                            {**dplyr::[.fun_list** (id: built-in:dplyr:[.fun_list, type: Function, def. @7)}
    %%   [.grouped_df:                                          {**dplyr::[.grouped_df** (id: built-in:dplyr:[.grouped_df, type: Function, def. @7)}
    %%   [.rowwise_df:                                          {**dplyr::[.rowwise_df** (id: built-in:dplyr:[.rowwise_df, type: Function, def. @7)}
    %%   [[<-.grouped_df:                                       {**dplyr::[[<-.grouped_df** (id: built-in:dplyr:[[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.grouped_df:                                        {**dplyr::[<-.grouped_df** (id: built-in:dplyr:[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.rowwise_df:                                        {**dplyr::[<-.rowwise_df** (id: built-in:dplyr:[<-.rowwise_df, type: Function, def. @7)}
    %%   $<-.grouped_df:                                        {**dplyr::$<-.grouped_df** (id: built-in:dplyr:$<-.grouped_df, type: Function, def. @7)}
    %%   across:                                                {**dplyr::across** (id: built-in:dplyr:across, type: Function, def. @7)}
    %%   add_count:                                             {**dplyr::add_count** (id: built-in:dplyr:add_count, type: Function, def. @7)}
    %%   add_count_:                                            {**dplyr::add_count_** (id: built-in:dplyr:add_count_, type: Function, def. @7)}
    %%   add_count.data.frame:                                  {**dplyr::add_count.data.frame** (id: built-in:dplyr:add_count.data.frame, type: Function, def. @7)}
    %%   add_count.default:                                     {**dplyr::add_count.default** (id: built-in:dplyr:add_count.default, type: Function, def. @7)}
    %%   add_rownames:                                          {**dplyr::add_rownames** (id: built-in:dplyr:add_rownames, type: Function, def. @7)}
    %%   add_tally:                                             {**dplyr::add_tally** (id: built-in:dplyr:add_tally, type: Function, def. @7)}
    %%   add_tally_:                                            {**dplyr::add_tally_** (id: built-in:dplyr:add_tally_, type: Function, def. @7)}
    %%   all_equal:                                             {**dplyr::all_equal** (id: built-in:dplyr:all_equal, type: Function, def. @7)}
    %%   all_vars:                                              {**dplyr::all_vars** (id: built-in:dplyr:all_vars, type: Function, def. @7)}
    %%   anti_join:                                             {**dplyr::anti_join** (id: built-in:dplyr:anti_join, type: Function, def. @7)}
    %%   anti_join.data.frame:                                  {**dplyr::anti_join.data.frame** (id: built-in:dplyr:anti_join.data.frame, type: Function, def. @7)}
    %%   any_vars:                                              {**dplyr::any_vars** (id: built-in:dplyr:any_vars, type: Function, def. @7)}
    %%   arrange:                                               {**dplyr::arrange** (id: built-in:dplyr:arrange, type: Function, def. @7)}
    %%   arrange_:                                              {**dplyr::arrange_** (id: built-in:dplyr:arrange_, type: Function, def. @7)}
    %%   arrange_all:                                           {**dplyr::arrange_all** (id: built-in:dplyr:arrange_all, type: Function, def. @7)}
    %%   arrange_at:                                            {**dplyr::arrange_at** (id: built-in:dplyr:arrange_at, type: Function, def. @7)}
    %%   arrange_if:                                            {**dplyr::arrange_if** (id: built-in:dplyr:arrange_if, type: Function, def. @7)}
    %%   arrange.data.frame:                                    {**dplyr::arrange.data.frame** (id: built-in:dplyr:arrange.data.frame, type: Function, def. @7)}
    %%   as_join_by.character:                                  {**dplyr::as_join_by.character** (id: built-in:dplyr:as_join_by.character, type: Function, def. @7)}
    %%   as_join_by.default:                                    {**dplyr::as_join_by.default** (id: built-in:dplyr:as_join_by.default, type: Function, def. @7)}
    %%   as_join_by.dplyr_join_by:                              {**dplyr::as_join_by.dplyr_join_by** (id: built-in:dplyr:as_join_by.dplyr_join_by, type: Function, def. @7)}
    %%   as_join_by.list:                                       {**dplyr::as_join_by.list** (id: built-in:dplyr:as_join_by.list, type: Function, def. @7)}
    %%   as_tibble.grouped_df:                                  {**dplyr::as_tibble.grouped_df** (id: built-in:dplyr:as_tibble.grouped_df, type: Function, def. @7)}
    %%   as_tibble.rowwise_df:                                  {**dplyr::as_tibble.rowwise_df** (id: built-in:dplyr:as_tibble.rowwise_df, type: Function, def. @7)}
    %%   as.data.frame.grouped_df:                              {**dplyr::as.data.frame.grouped_df** (id: built-in:dplyr:as.data.frame.grouped_df, type: Function, def. @7)}
    %%   as.tbl:                                                {**dplyr::as.tbl** (id: built-in:dplyr:as.tbl, type: Function, def. @7)}
    %%   auto_copy:                                             {**dplyr::auto_copy** (id: built-in:dplyr:auto_copy, type: Function, def. @7)}
    %%   auto_copy.data.frame:                                  {**dplyr::auto_copy.data.frame** (id: built-in:dplyr:auto_copy.data.frame, type: Function, def. @7)}
    %%   between:                                               {**dplyr::between** (id: built-in:dplyr:between, type: Function, def. @7)}
    %%   bind_cols:                                             {**dplyr::bind_cols** (id: built-in:dplyr:bind_cols, type: Function, def. @7)}
    %%   bind_rows:                                             {**dplyr::bind_rows** (id: built-in:dplyr:bind_rows, type: Function, def. @7)}
    %%   c_across:                                              {**dplyr::c_across** (id: built-in:dplyr:c_across, type: Function, def. @7)}
    %%   case_match:                                            {**dplyr::case_match** (id: built-in:dplyr:case_match, type: Function, def. @7)}
    %%   case_when:                                             {**dplyr::case_when** (id: built-in:dplyr:case_when, type: Function, def. @7)}
    %%   cbind.grouped_df:                                      {**dplyr::cbind.grouped_df** (id: built-in:dplyr:cbind.grouped_df, type: Function, def. @7)}
    %%   check_dbplyr:                                          {**dplyr::check_dbplyr** (id: built-in:dplyr:check_dbplyr, type: Function, def. @7)}
    %%   coalesce:                                              {**dplyr::coalesce** (id: built-in:dplyr:coalesce, type: Function, def. @7)}
    %%   collapse:                                              {**dplyr::collapse** (id: built-in:dplyr:collapse, type: Function, def. @7)}
    %%   collapse.data.frame:                                   {**dplyr::collapse.data.frame** (id: built-in:dplyr:collapse.data.frame, type: Function, def. @7)}
    %%   collect:                                               {**dplyr::collect** (id: built-in:dplyr:collect, type: Function, def. @7)}
    %%   collect.data.frame:                                    {**dplyr::collect.data.frame** (id: built-in:dplyr:collect.data.frame, type: Function, def. @7)}
    %%   combine:                                               {**dplyr::combine** (id: built-in:dplyr:combine, type: Function, def. @7)}
    %%   common_by:                                             {**dplyr::common_by** (id: built-in:dplyr:common_by, type: Function, def. @7)}
    %%   common_by.character:                                   {**dplyr::common_by.character** (id: built-in:dplyr:common_by.character, type: Function, def. @7)}
    %%   common_by.default:                                     {**dplyr::common_by.default** (id: built-in:dplyr:common_by.default, type: Function, def. @7)}
    %%   common_by.list:                                        {**dplyr::common_by.list** (id: built-in:dplyr:common_by.list, type: Function, def. @7)}
    %%   common_by.NULL:                                        {**dplyr::common_by.NULL** (id: built-in:dplyr:common_by.NULL, type: Function, def. @7)}
    %%   compute:                                               {**dplyr::compute** (id: built-in:dplyr:compute, type: Function, def. @7)}
    %%   compute.data.frame:                                    {**dplyr::compute.data.frame** (id: built-in:dplyr:compute.data.frame, type: Function, def. @7)}
    %%   consecutive_id:                                        {**dplyr::consecutive_id** (id: built-in:dplyr:consecutive_id, type: Function, def. @7)}
    %%   copy_to:                                               {**dplyr::copy_to** (id: built-in:dplyr:copy_to, type: Function, def. @7)}
    %%   copy_to.DBIConnection:                                 {**dplyr::copy_to.DBIConnection** (id: built-in:dplyr:copy_to.DBIConnection, type: Function, def. @7)}
    %%   count:                                                 {**dplyr::count** (id: built-in:dplyr:count, type: Function, def. @7)}
    %%   count_:                                                {**dplyr::count_** (id: built-in:dplyr:count_, type: Function, def. @7)}
    %%   count.data.frame:                                      {**dplyr::count.data.frame** (id: built-in:dplyr:count.data.frame, type: Function, def. @7)}
    %%   cross_join:                                            {**dplyr::cross_join** (id: built-in:dplyr:cross_join, type: Function, def. @7)}
    %%   cross_join.data.frame:                                 {**dplyr::cross_join.data.frame** (id: built-in:dplyr:cross_join.data.frame, type: Function, def. @7)}
    %%   cumall:                                                {**dplyr::cumall** (id: built-in:dplyr:cumall, type: Function, def. @7)}
    %%   cumany:                                                {**dplyr::cumany** (id: built-in:dplyr:cumany, type: Function, def. @7)}
    %%   cume_dist:                                             {**dplyr::cume_dist** (id: built-in:dplyr:cume_dist, type: Function, def. @7)}
    %%   cummean:                                               {**dplyr::cummean** (id: built-in:dplyr:cummean, type: Function, def. @7)}
    %%   cur_column:                                            {**dplyr::cur_column** (id: built-in:dplyr:cur_column, type: Function, def. @7)}
    %%   cur_data:                                              {**dplyr::cur_data** (id: built-in:dplyr:cur_data, type: Function, def. @7)}
    %%   cur_data_all:                                          {**dplyr::cur_data_all** (id: built-in:dplyr:cur_data_all, type: Function, def. @7)}
    %%   cur_group:                                             {**dplyr::cur_group** (id: built-in:dplyr:cur_group, type: Function, def. @7)}
    %%   cur_group_id:                                          {**dplyr::cur_group_id** (id: built-in:dplyr:cur_group_id, type: Function, def. @7)}
    %%   cur_group_rows:                                        {**dplyr::cur_group_rows** (id: built-in:dplyr:cur_group_rows, type: Function, def. @7)}
    %%   db_analyze:                                            {**dplyr::db_analyze** (id: built-in:dplyr:db_analyze, type: Function, def. @7)}
    %%   db_begin:                                              {**dplyr::db_begin** (id: built-in:dplyr:db_begin, type: Function, def. @7)}
    %%   db_commit:                                             {**dplyr::db_commit** (id: built-in:dplyr:db_commit, type: Function, def. @7)}
    %%   db_create_index:                                       {**dplyr::db_create_index** (id: built-in:dplyr:db_create_index, type: Function, def. @7)}
    %%   db_create_indexes:                                     {**dplyr::db_create_indexes** (id: built-in:dplyr:db_create_indexes, type: Function, def. @7)}
    %%   db_create_table:                                       {**dplyr::db_create_table** (id: built-in:dplyr:db_create_table, type: Function, def. @7)}
    %%   db_data_type:                                          {**dplyr::db_data_type** (id: built-in:dplyr:db_data_type, type: Function, def. @7)}
    %%   db_desc:                                               {**dplyr::db_desc** (id: built-in:dplyr:db_desc, type: Function, def. @7)}
    %%   db_drop_table:                                         {**dplyr::db_drop_table** (id: built-in:dplyr:db_drop_table, type: Function, def. @7)}
    %%   db_explain:                                            {**dplyr::db_explain** (id: built-in:dplyr:db_explain, type: Function, def. @7)}
    %%   db_has_table:                                          {**dplyr::db_has_table** (id: built-in:dplyr:db_has_table, type: Function, def. @7)}
    %%   db_insert_into:                                        {**dplyr::db_insert_into** (id: built-in:dplyr:db_insert_into, type: Function, def. @7)}
    %%   db_list_tables:                                        {**dplyr::db_list_tables** (id: built-in:dplyr:db_list_tables, type: Function, def. @7)}
    %%   db_query_fields:                                       {**dplyr::db_query_fields** (id: built-in:dplyr:db_query_fields, type: Function, def. @7)}
    %%   db_query_rows:                                         {**dplyr::db_query_rows** (id: built-in:dplyr:db_query_rows, type: Function, def. @7)}
    %%   db_rollback:                                           {**dplyr::db_rollback** (id: built-in:dplyr:db_rollback, type: Function, def. @7)}
    %%   db_save_query:                                         {**dplyr::db_save_query** (id: built-in:dplyr:db_save_query, type: Function, def. @7)}
    %%   db_write_table:                                        {**dplyr::db_write_table** (id: built-in:dplyr:db_write_table, type: Function, def. @7)}
    %%   dense_rank:                                            {**dplyr::dense_rank** (id: built-in:dplyr:dense_rank, type: Function, def. @7)}
    %%   desc:                                                  {**dplyr::desc** (id: built-in:dplyr:desc, type: Function, def. @7)}
    %%   dim_desc:                                              {**dplyr::dim_desc** (id: built-in:dplyr:dim_desc, type: Function, def. @7)}
    %%   distinct:                                              {**dplyr::distinct** (id: built-in:dplyr:distinct, type: Function, def. @7)}
    %%   distinct_:                                             {**dplyr::distinct_** (id: built-in:dplyr:distinct_, type: Function, def. @7)}
    %%   distinct_all:                                          {**dplyr::distinct_all** (id: built-in:dplyr:distinct_all, type: Function, def. @7)}
    %%   distinct_at:                                           {**dplyr::distinct_at** (id: built-in:dplyr:distinct_at, type: Function, def. @7)}
    %%   distinct_if:                                           {**dplyr::distinct_if** (id: built-in:dplyr:distinct_if, type: Function, def. @7)}
    %%   distinct_prepare:                                      {**dplyr::distinct_prepare** (id: built-in:dplyr:distinct_prepare, type: Function, def. @7)}
    %%   distinct.data.frame:                                   {**dplyr::distinct.data.frame** (id: built-in:dplyr:distinct.data.frame, type: Function, def. @7)}
    %%   do:                                                    {**dplyr::do** (id: built-in:dplyr:do, type: Function, def. @7)}
    %%   do_:                                                   {**dplyr::do_** (id: built-in:dplyr:do_, type: Function, def. @7)}
    %%   do.data.frame:                                         {**dplyr::do.data.frame** (id: built-in:dplyr:do.data.frame, type: Function, def. @7)}
    %%   do.grouped_df:                                         {**dplyr::do.grouped_df** (id: built-in:dplyr:do.grouped_df, type: Function, def. @7)}
    %%   do.NULL:                                               {**dplyr::do.NULL** (id: built-in:dplyr:do.NULL, type: Function, def. @7)}
    %%   do.rowwise_df:                                         {**dplyr::do.rowwise_df** (id: built-in:dplyr:do.rowwise_df, type: Function, def. @7)}
    %%   dplyr_col_modify:                                      {**dplyr::dplyr_col_modify** (id: built-in:dplyr:dplyr_col_modify, type: Function, def. @7)}
    %%   dplyr_col_modify.data.frame:                           {**dplyr::dplyr_col_modify.data.frame** (id: built-in:dplyr:dplyr_col_modify.data.frame, type: Function, def. @7)}
    %%   dplyr_col_modify.grouped_df:                           {**dplyr::dplyr_col_modify.grouped_df** (id: built-in:dplyr:dplyr_col_modify.grouped_df, type: Function, def. @7)}
    %%   dplyr_col_modify.rowwise_df:                           {**dplyr::dplyr_col_modify.rowwise_df** (id: built-in:dplyr:dplyr_col_modify.rowwise_df, type: Function, def. @7)}
    %%   dplyr_reconstruct:                                     {**dplyr::dplyr_reconstruct** (id: built-in:dplyr:dplyr_reconstruct, type: Function, def. @7)}
    %%   dplyr_reconstruct.data.frame:                          {**dplyr::dplyr_reconstruct.data.frame** (id: built-in:dplyr:dplyr_reconstruct.data.frame, type: Function, def. @7)}
    %%   dplyr_reconstruct.grouped_df:                          {**dplyr::dplyr_reconstruct.grouped_df** (id: built-in:dplyr:dplyr_reconstruct.grouped_df, type: Function, def. @7)}
    %%   dplyr_reconstruct.rowwise_df:                          {**dplyr::dplyr_reconstruct.rowwise_df** (id: built-in:dplyr:dplyr_reconstruct.rowwise_df, type: Function, def. @7)}
    %%   dplyr_row_slice:                                       {**dplyr::dplyr_row_slice** (id: built-in:dplyr:dplyr_row_slice, type: Function, def. @7)}
    %%   dplyr_row_slice.data.frame:                            {**dplyr::dplyr_row_slice.data.frame** (id: built-in:dplyr:dplyr_row_slice.data.frame, type: Function, def. @7)}
    %%   dplyr_row_slice.grouped_df:                            {**dplyr::dplyr_row_slice.grouped_df** (id: built-in:dplyr:dplyr_row_slice.grouped_df, type: Function, def. @7)}
    %%   dplyr_row_slice.rowwise_df:                            {**dplyr::dplyr_row_slice.rowwise_df** (id: built-in:dplyr:dplyr_row_slice.rowwise_df, type: Function, def. @7)}
    %%   explain:                                               {**dplyr::explain** (id: built-in:dplyr:explain, type: Function, def. @7)}
    %%   filter:                                                {**dplyr::filter** (id: built-in:dplyr:filter, type: Function, def. @7)}
    %%   filter_:                                               {**dplyr::filter_** (id: built-in:dplyr:filter_, type: Function, def. @7)}
    %%   filter_all:                                            {**dplyr::filter_all** (id: built-in:dplyr:filter_all, type: Function, def. @7)}
    %%   filter_at:                                             {**dplyr::filter_at** (id: built-in:dplyr:filter_at, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_size:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_size** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_size, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_type:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_type** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_type, type: Function, def. @7)}
    %%   filter_if:                                             {**dplyr::filter_if** (id: built-in:dplyr:filter_if, type: Function, def. @7)}
    %%   filter_out:                                            {**dplyr::filter_out** (id: built-in:dplyr:filter_out, type: Function, def. @7)}
    %%   filter_out.data.frame:                                 {**dplyr::filter_out.data.frame** (id: built-in:dplyr:filter_out.data.frame, type: Function, def. @7)}
    %%   filter.data.frame:                                     {**dplyr::filter.data.frame** (id: built-in:dplyr:filter.data.frame, type: Function, def. @7)}
    %%   filter.ts:                                             {**dplyr::filter.ts** (id: built-in:dplyr:filter.ts, type: Function, def. @7)}
    %%   first:                                                 {**dplyr::first** (id: built-in:dplyr:first, type: Function, def. @7)}
    %%   full_join:                                             {**dplyr::full_join** (id: built-in:dplyr:full_join, type: Function, def. @7)}
    %%   full_join.data.frame:                                  {**dplyr::full_join.data.frame** (id: built-in:dplyr:full_join.data.frame, type: Function, def. @7)}
    %%   funs:                                                  {**dplyr::funs** (id: built-in:dplyr:funs, type: Function, def. @7)}
    %%   funs_:                                                 {**dplyr::funs_** (id: built-in:dplyr:funs_, type: Function, def. @7)}
    %%   group_by:                                              {**dplyr::group_by** (id: built-in:dplyr:group_by, type: Function, def. @7)}
    %%   group_by_:                                             {**dplyr::group_by_** (id: built-in:dplyr:group_by_, type: Function, def. @7)}
    %%   group_by_all:                                          {**dplyr::group_by_all** (id: built-in:dplyr:group_by_all, type: Function, def. @7)}
    %%   group_by_at:                                           {**dplyr::group_by_at** (id: built-in:dplyr:group_by_at, type: Function, def. @7)}
    %%   group_by_drop_default:                                 {**dplyr::group_by_drop_default** (id: built-in:dplyr:group_by_drop_default, type: Function, def. @7)}
    %%   group_by_drop_default.default:                         {**dplyr::group_by_drop_default.default** (id: built-in:dplyr:group_by_drop_default.default, type: Function, def. @7)}
    %%   group_by_drop_default.grouped_df:                      {**dplyr::group_by_drop_default.grouped_df** (id: built-in:dplyr:group_by_drop_default.grouped_df, type: Function, def. @7)}
    %%   group_by_if:                                           {**dplyr::group_by_if** (id: built-in:dplyr:group_by_if, type: Function, def. @7)}
    %%   group_by_prepare:                                      {**dplyr::group_by_prepare** (id: built-in:dplyr:group_by_prepare, type: Function, def. @7)}
    %%   group_by.data.frame:                                   {**dplyr::group_by.data.frame** (id: built-in:dplyr:group_by.data.frame, type: Function, def. @7)}
    %%   group_cols:                                            {**dplyr::group_cols** (id: built-in:dplyr:group_cols, type: Function, def. @7)}
    %%   group_data:                                            {**dplyr::group_data** (id: built-in:dplyr:group_data, type: Function, def. @7)}
    %%   group_data.data.frame:                                 {**dplyr::group_data.data.frame** (id: built-in:dplyr:group_data.data.frame, type: Function, def. @7)}
    %%   group_data.grouped_df:                                 {**dplyr::group_data.grouped_df** (id: built-in:dplyr:group_data.grouped_df, type: Function, def. @7)}
    %%   group_data.rowwise_df:                                 {**dplyr::group_data.rowwise_df** (id: built-in:dplyr:group_data.rowwise_df, type: Function, def. @7)}
    %%   group_data.tbl_df:                                     {**dplyr::group_data.tbl_df** (id: built-in:dplyr:group_data.tbl_df, type: Function, def. @7)}
    %%   group_indices:                                         {**dplyr::group_indices** (id: built-in:dplyr:group_indices, type: Function, def. @7)}
    %%   group_indices_:                                        {**dplyr::group_indices_** (id: built-in:dplyr:group_indices_, type: Function, def. @7)}
    %%   group_indices.data.frame:                              {**dplyr::group_indices.data.frame** (id: built-in:dplyr:group_indices.data.frame, type: Function, def. @7)}
    %%   group_keys:                                            {**dplyr::group_keys** (id: built-in:dplyr:group_keys, type: Function, def. @7)}
    %%   group_keys.data.frame:                                 {**dplyr::group_keys.data.frame** (id: built-in:dplyr:group_keys.data.frame, type: Function, def. @7)}
    %%   group_map:                                             {**dplyr::group_map** (id: built-in:dplyr:group_map, type: Function, def. @7)}
    %%   group_map.data.frame:                                  {**dplyr::group_map.data.frame** (id: built-in:dplyr:group_map.data.frame, type: Function, def. @7)}
    %%   group_modify:                                          {**dplyr::group_modify** (id: built-in:dplyr:group_modify, type: Function, def. @7)}
    %%   group_modify.data.frame:                               {**dplyr::group_modify.data.frame** (id: built-in:dplyr:group_modify.data.frame, type: Function, def. @7)}
    %%   group_modify.grouped_df:                               {**dplyr::group_modify.grouped_df** (id: built-in:dplyr:group_modify.grouped_df, type: Function, def. @7)}
    %%   group_nest:                                            {**dplyr::group_nest** (id: built-in:dplyr:group_nest, type: Function, def. @7)}
    %%   group_nest.data.frame:                                 {**dplyr::group_nest.data.frame** (id: built-in:dplyr:group_nest.data.frame, type: Function, def. @7)}
    %%   group_nest.grouped_df:                                 {**dplyr::group_nest.grouped_df** (id: built-in:dplyr:group_nest.grouped_df, type: Function, def. @7)}
    %%   group_rows:                                            {**dplyr::group_rows** (id: built-in:dplyr:group_rows, type: Function, def. @7)}
    %%   group_size:                                            {**dplyr::group_size** (id: built-in:dplyr:group_size, type: Function, def. @7)}
    %%   group_size.data.frame:                                 {**dplyr::group_size.data.frame** (id: built-in:dplyr:group_size.data.frame, type: Function, def. @7)}
    %%   group_split:                                           {**dplyr::group_split** (id: built-in:dplyr:group_split, type: Function, def. @7)}
    %%   group_split.data.frame:                                {**dplyr::group_split.data.frame** (id: built-in:dplyr:group_split.data.frame, type: Function, def. @7)}
    %%   group_split.grouped_df:                                {**dplyr::group_split.grouped_df** (id: built-in:dplyr:group_split.grouped_df, type: Function, def. @7)}
    %%   group_split.rowwise_df:                                {**dplyr::group_split.rowwise_df** (id: built-in:dplyr:group_split.rowwise_df, type: Function, def. @7)}
    %%   group_trim:                                            {**dplyr::group_trim** (id: built-in:dplyr:group_trim, type: Function, def. @7)}
    %%   group_trim.data.frame:                                 {**dplyr::group_trim.data.frame** (id: built-in:dplyr:group_trim.data.frame, type: Function, def. @7)}
    %%   group_trim.grouped_df:                                 {**dplyr::group_trim.grouped_df** (id: built-in:dplyr:group_trim.grouped_df, type: Function, def. @7)}
    %%   group_vars:                                            {**dplyr::group_vars** (id: built-in:dplyr:group_vars, type: Function, def. @7)}
    %%   group_vars.data.frame:                                 {**dplyr::group_vars.data.frame** (id: built-in:dplyr:group_vars.data.frame, type: Function, def. @7)}
    %%   group_walk:                                            {**dplyr::group_walk** (id: built-in:dplyr:group_walk, type: Function, def. @7)}
    %%   grouped_df:                                            {**dplyr::grouped_df** (id: built-in:dplyr:grouped_df, type: Function, def. @7)}
    %%   groups:                                                {**dplyr::groups** (id: built-in:dplyr:groups, type: Function, def. @7)}
    %%   groups.data.frame:                                     {**dplyr::groups.data.frame** (id: built-in:dplyr:groups.data.frame, type: Function, def. @7)}
    %%   ident:                                                 {**dplyr::ident** (id: built-in:dplyr:ident, type: Function, def. @7)}
    %%   if_all:                                                {**dplyr::if_all** (id: built-in:dplyr:if_all, type: Function, def. @7)}
    %%   if_any:                                                {**dplyr::if_any** (id: built-in:dplyr:if_any, type: Function, def. @7)}
    %%   if_else:                                               {**dplyr::if_else** (id: built-in:dplyr:if_else, type: Function, def. @7)}
    %%   inner_join:                                            {**dplyr::inner_join** (id: built-in:dplyr:inner_join, type: Function, def. @7)}
    %%   inner_join.data.frame:                                 {**dplyr::inner_join.data.frame** (id: built-in:dplyr:inner_join.data.frame, type: Function, def. @7)}
    %%   intersect.data.frame:                                  {**dplyr::intersect.data.frame** (id: built-in:dplyr:intersect.data.frame, type: Function, def. @7)}
    %%   is_grouped_df:                                         {**dplyr::is_grouped_df** (id: built-in:dplyr:is_grouped_df, type: Function, def. @7)}
    %%   is.grouped_df:                                         {**dplyr::is.grouped_df** (id: built-in:dplyr:is.grouped_df, type: Function, def. @7)}
    %%   is.src:                                                {**dplyr::is.src** (id: built-in:dplyr:is.src, type: Function, def. @7)}
    %%   is.tbl:                                                {**dplyr::is.tbl** (id: built-in:dplyr:is.tbl, type: Function, def. @7)}
    %%   join_by:                                               {**dplyr::join_by** (id: built-in:dplyr:join_by, type: Function, def. @7)}
    %%   lag:                                                   {**dplyr::lag** (id: built-in:dplyr:lag, type: Function, def. @7)}
    %%   last:                                                  {**dplyr::last** (id: built-in:dplyr:last, type: Function, def. @7)}
    %%   last_dplyr_warnings:                                   {**dplyr::last_dplyr_warnings** (id: built-in:dplyr:last_dplyr_warnings, type: Function, def. @7)}
    %%   lead:                                                  {**dplyr::lead** (id: built-in:dplyr:lead, type: Function, def. @7)}
    %%   left_join:                                             {**dplyr::left_join** (id: built-in:dplyr:left_join, type: Function, def. @7)}
    %%   left_join.data.frame:                                  {**dplyr::left_join.data.frame** (id: built-in:dplyr:left_join.data.frame, type: Function, def. @7)}
    %%   make_tbl:                                              {**dplyr::make_tbl** (id: built-in:dplyr:make_tbl, type: Function, def. @7)}
    %%   min_rank:                                              {**dplyr::min_rank** (id: built-in:dplyr:min_rank, type: Function, def. @7)}
    %%   mutate:                                                {**dplyr::mutate** (id: built-in:dplyr:mutate, type: Function, def. @7)}
    %%   mutate_:                                               {**dplyr::mutate_** (id: built-in:dplyr:mutate_, type: Function, def. @7)}
    %%   mutate_all:                                            {**dplyr::mutate_all** (id: built-in:dplyr:mutate_all, type: Function, def. @7)}
    %%   mutate_at:                                             {**dplyr::mutate_at** (id: built-in:dplyr:mutate_at, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::error_incompatible_combine:     {**dplyr::mutate_bullets.dplyr:::error_incompatible_combine** (id: built-in:dplyr:mutate_bullets.dplyr:::error_incompatible_combine, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_constant_recycle_error:  {**dplyr::mutate_bullets.dplyr:::mutate_constant_recycle_error** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_constant_recycle_error, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_incompatible_size:       {**dplyr::mutate_bullets.dplyr:::mutate_incompatible_size** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_incompatible_size, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_mixed_null:              {**dplyr::mutate_bullets.dplyr:::mutate_mixed_null** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_mixed_null, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_not_vector:              {**dplyr::mutate_bullets.dplyr:::mutate_not_vector** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_not_vector, type: Function, def. @7)}
    %%   mutate_each:                                           {**dplyr::mutate_each** (id: built-in:dplyr:mutate_each, type: Function, def. @7)}
    %%   mutate_each_:                                          {**dplyr::mutate_each_** (id: built-in:dplyr:mutate_each_, type: Function, def. @7)}
    %%   mutate_if:                                             {**dplyr::mutate_if** (id: built-in:dplyr:mutate_if, type: Function, def. @7)}
    %%   mutate.data.frame:                                     {**dplyr::mutate.data.frame** (id: built-in:dplyr:mutate.data.frame, type: Function, def. @7)}
    %%   n:                                                     {**dplyr::n** (id: built-in:dplyr:n, type: Function, def. @7)}
    %%   n_distinct:                                            {**dplyr::n_distinct** (id: built-in:dplyr:n_distinct, type: Function, def. @7)}
    %%   n_groups:                                              {**dplyr::n_groups** (id: built-in:dplyr:n_groups, type: Function, def. @7)}
    %%   n_groups.data.frame:                                   {**dplyr::n_groups.data.frame** (id: built-in:dplyr:n_groups.data.frame, type: Function, def. @7)}
    %%   na_if:                                                 {**dplyr::na_if** (id: built-in:dplyr:na_if, type: Function, def. @7)}
    %%   names<-.grouped_df:                                    {**dplyr::names<-.grouped_df** (id: built-in:dplyr:names<-.grouped_df, type: Function, def. @7)}
    %%   names<-.rowwise_df:                                    {**dplyr::names<-.rowwise_df** (id: built-in:dplyr:names<-.rowwise_df, type: Function, def. @7)}
    %%   near:                                                  {**dplyr::near** (id: built-in:dplyr:near, type: Function, def. @7)}
    %%   nest_by:                                               {**dplyr::nest_by** (id: built-in:dplyr:nest_by, type: Function, def. @7)}
    %%   nest_by.data.frame:                                    {**dplyr::nest_by.data.frame** (id: built-in:dplyr:nest_by.data.frame, type: Function, def. @7)}
    %%   nest_by.grouped_df:                                    {**dplyr::nest_by.grouped_df** (id: built-in:dplyr:nest_by.grouped_df, type: Function, def. @7)}
    %%   nest_join:                                             {**dplyr::nest_join** (id: built-in:dplyr:nest_join, type: Function, def. @7)}
    %%   nest_join.data.frame:                                  {**dplyr::nest_join.data.frame** (id: built-in:dplyr:nest_join.data.frame, type: Function, def. @7)}
    %%   new_grouped_df:                                        {**dplyr::new_grouped_df** (id: built-in:dplyr:new_grouped_df, type: Function, def. @7)}
    %%   new_rowwise_df:                                        {**dplyr::new_rowwise_df** (id: built-in:dplyr:new_rowwise_df, type: Function, def. @7)}
    %%   nth:                                                   {**dplyr::nth** (id: built-in:dplyr:nth, type: Function, def. @7)}
    %%   ntile:                                                 {**dplyr::ntile** (id: built-in:dplyr:ntile, type: Function, def. @7)}
    %%   order_by:                                              {**dplyr::order_by** (id: built-in:dplyr:order_by, type: Function, def. @7)}
    %%   percent_rank:                                          {**dplyr::percent_rank** (id: built-in:dplyr:percent_rank, type: Function, def. @7)}
    %%   pick:                                                  {**dplyr::pick** (id: built-in:dplyr:pick, type: Function, def. @7)}
    %%   print.all_vars:                                        {**dplyr::print.all_vars** (id: built-in:dplyr:print.all_vars, type: Function, def. @7)}
    %%   print.any_vars:                                        {**dplyr::print.any_vars** (id: built-in:dplyr:print.any_vars, type: Function, def. @7)}
    %%   print.dplyr_join_by:                                   {**dplyr::print.dplyr_join_by** (id: built-in:dplyr:print.dplyr_join_by, type: Function, def. @7)}
    %%   print.dplyr_sel_vars:                                  {**dplyr::print.dplyr_sel_vars** (id: built-in:dplyr:print.dplyr_sel_vars, type: Function, def. @7)}
    %%   print.fun_list:                                        {**dplyr::print.fun_list** (id: built-in:dplyr:print.fun_list, type: Function, def. @7)}
    %%   print.last_dplyr_warnings:                             {**dplyr::print.last_dplyr_warnings** (id: built-in:dplyr:print.last_dplyr_warnings, type: Function, def. @7)}
    %%   print.src:                                             {**dplyr::print.src** (id: built-in:dplyr:print.src, type: Function, def. @7)}
    %%   progress_estimated:                                    {**dplyr::progress_estimated** (id: built-in:dplyr:progress_estimated, type: Function, def. @7)}
    %%   pull:                                                  {**dplyr::pull** (id: built-in:dplyr:pull, type: Function, def. @7)}
    %%   pull.data.frame:                                       {**dplyr::pull.data.frame** (id: built-in:dplyr:pull.data.frame, type: Function, def. @7)}
    %%   rbind.grouped_df:                                      {**dplyr::rbind.grouped_df** (id: built-in:dplyr:rbind.grouped_df, type: Function, def. @7)}
    %%   rbind.rowwise_df:                                      {**dplyr::rbind.rowwise_df** (id: built-in:dplyr:rbind.rowwise_df, type: Function, def. @7)}
    %%   recode:                                                {**dplyr::recode** (id: built-in:dplyr:recode, type: Function, def. @7)}
    %%   recode_default.default:                                {**dplyr::recode_default.default** (id: built-in:dplyr:recode_default.default, type: Function, def. @7)}
    %%   recode_default.factor:                                 {**dplyr::recode_default.factor** (id: built-in:dplyr:recode_default.factor, type: Function, def. @7)}
    %%   recode_factor:                                         {**dplyr::recode_factor** (id: built-in:dplyr:recode_factor, type: Function, def. @7)}
    %%   recode_values:                                         {**dplyr::recode_values** (id: built-in:dplyr:recode_values, type: Function, def. @7)}
    %%   recode.character:                                      {**dplyr::recode.character** (id: built-in:dplyr:recode.character, type: Function, def. @7)}
    %%   recode.factor:                                         {**dplyr::recode.factor** (id: built-in:dplyr:recode.factor, type: Function, def. @7)}
    %%   recode.numeric:                                        {**dplyr::recode.numeric** (id: built-in:dplyr:recode.numeric, type: Function, def. @7)}
    %%   reframe:                                               {**dplyr::reframe** (id: built-in:dplyr:reframe, type: Function, def. @7)}
    %%   reframe.data.frame:                                    {**dplyr::reframe.data.frame** (id: built-in:dplyr:reframe.data.frame, type: Function, def. @7)}
    %%   relocate:                                              {**dplyr::relocate** (id: built-in:dplyr:relocate, type: Function, def. @7)}
    %%   relocate.data.frame:                                   {**dplyr::relocate.data.frame** (id: built-in:dplyr:relocate.data.frame, type: Function, def. @7)}
    %%   rename:                                                {**dplyr::rename** (id: built-in:dplyr:rename, type: Function, def. @7)}
    %%   rename_:                                               {**dplyr::rename_** (id: built-in:dplyr:rename_, type: Function, def. @7)}
    %%   rename_all:                                            {**dplyr::rename_all** (id: built-in:dplyr:rename_all, type: Function, def. @7)}
    %%   rename_at:                                             {**dplyr::rename_at** (id: built-in:dplyr:rename_at, type: Function, def. @7)}
    %%   rename_if:                                             {**dplyr::rename_if** (id: built-in:dplyr:rename_if, type: Function, def. @7)}
    %%   rename_with:                                           {**dplyr::rename_with** (id: built-in:dplyr:rename_with, type: Function, def. @7)}
    %%   rename_with.data.frame:                                {**dplyr::rename_with.data.frame** (id: built-in:dplyr:rename_with.data.frame, type: Function, def. @7)}
    %%   rename.data.frame:                                     {**dplyr::rename.data.frame** (id: built-in:dplyr:rename.data.frame, type: Function, def. @7)}
    %%   replace_values:                                        {**dplyr::replace_values** (id: built-in:dplyr:replace_values, type: Function, def. @7)}
    %%   replace_when:                                          {**dplyr::replace_when** (id: built-in:dplyr:replace_when, type: Function, def. @7)}
    %%   right_join:                                            {**dplyr::right_join** (id: built-in:dplyr:right_join, type: Function, def. @7)}
    %%   right_join.data.frame:                                 {**dplyr::right_join.data.frame** (id: built-in:dplyr:right_join.data.frame, type: Function, def. @7)}
    %%   row_number:                                            {**dplyr::row_number** (id: built-in:dplyr:row_number, type: Function, def. @7)}
    %%   rows_append:                                           {**dplyr::rows_append** (id: built-in:dplyr:rows_append, type: Function, def. @7)}
    %%   rows_append.data.frame:                                {**dplyr::rows_append.data.frame** (id: built-in:dplyr:rows_append.data.frame, type: Function, def. @7)}
    %%   rows_delete:                                           {**dplyr::rows_delete** (id: built-in:dplyr:rows_delete, type: Function, def. @7)}
    %%   rows_delete.data.frame:                                {**dplyr::rows_delete.data.frame** (id: built-in:dplyr:rows_delete.data.frame, type: Function, def. @7)}
    %%   rows_insert:                                           {**dplyr::rows_insert** (id: built-in:dplyr:rows_insert, type: Function, def. @7)}
    %%   rows_insert.data.frame:                                {**dplyr::rows_insert.data.frame** (id: built-in:dplyr:rows_insert.data.frame, type: Function, def. @7)}
    %%   rows_patch:                                            {**dplyr::rows_patch** (id: built-in:dplyr:rows_patch, type: Function, def. @7)}
    %%   rows_patch.data.frame:                                 {**dplyr::rows_patch.data.frame** (id: built-in:dplyr:rows_patch.data.frame, type: Function, def. @7)}
    %%   rows_update:                                           {**dplyr::rows_update** (id: built-in:dplyr:rows_update, type: Function, def. @7)}
    %%   rows_update.data.frame:                                {**dplyr::rows_update.data.frame** (id: built-in:dplyr:rows_update.data.frame, type: Function, def. @7)}
    %%   rows_upsert:                                           {**dplyr::rows_upsert** (id: built-in:dplyr:rows_upsert, type: Function, def. @7)}
    %%   rows_upsert.data.frame:                                {**dplyr::rows_upsert.data.frame** (id: built-in:dplyr:rows_upsert.data.frame, type: Function, def. @7)}
    %%   rowwise:                                               {**dplyr::rowwise** (id: built-in:dplyr:rowwise, type: Function, def. @7)}
    %%   rowwise.data.frame:                                    {**dplyr::rowwise.data.frame** (id: built-in:dplyr:rowwise.data.frame, type: Function, def. @7)}
    %%   rowwise.grouped_df:                                    {**dplyr::rowwise.grouped_df** (id: built-in:dplyr:rowwise.grouped_df, type: Function, def. @7)}
    %%   same_src:                                              {**dplyr::same_src** (id: built-in:dplyr:same_src, type: Function, def. @7)}
    %%   same_src.data.frame:                                   {**dplyr::same_src.data.frame** (id: built-in:dplyr:same_src.data.frame, type: Function, def. @7)}
    %%   sample_frac:                                           {**dplyr::sample_frac** (id: built-in:dplyr:sample_frac, type: Function, def. @7)}
    %%   sample_frac.data.frame:                                {**dplyr::sample_frac.data.frame** (id: built-in:dplyr:sample_frac.data.frame, type: Function, def. @7)}
    %%   sample_frac.default:                                   {**dplyr::sample_frac.default** (id: built-in:dplyr:sample_frac.default, type: Function, def. @7)}
    %%   sample_n:                                              {**dplyr::sample_n** (id: built-in:dplyr:sample_n, type: Function, def. @7)}
    %%   sample_n.data.frame:                                   {**dplyr::sample_n.data.frame** (id: built-in:dplyr:sample_n.data.frame, type: Function, def. @7)}
    %%   sample_n.default:                                      {**dplyr::sample_n.default** (id: built-in:dplyr:sample_n.default, type: Function, def. @7)}
    %%   select:                                                {**dplyr::select** (id: built-in:dplyr:select, type: Function, def. @7)}
    %%   select_:                                               {**dplyr::select_** (id: built-in:dplyr:select_, type: Function, def. @7)}
    %%   select_all:                                            {**dplyr::select_all** (id: built-in:dplyr:select_all, type: Function, def. @7)}
    %%   select_at:                                             {**dplyr::select_at** (id: built-in:dplyr:select_at, type: Function, def. @7)}
    %%   select_if:                                             {**dplyr::select_if** (id: built-in:dplyr:select_if, type: Function, def. @7)}
    %%   select.data.frame:                                     {**dplyr::select.data.frame** (id: built-in:dplyr:select.data.frame, type: Function, def. @7)}
    %%   select.list:                                           {**dplyr::select.list** (id: built-in:dplyr:select.list, type: Function, def. @7)}
    %%   semi_join:                                             {**dplyr::semi_join** (id: built-in:dplyr:semi_join, type: Function, def. @7)}
    %%   semi_join.data.frame:                                  {**dplyr::semi_join.data.frame** (id: built-in:dplyr:semi_join.data.frame, type: Function, def. @7)}
    %%   setdiff.data.frame:                                    {**dplyr::setdiff.data.frame** (id: built-in:dplyr:setdiff.data.frame, type: Function, def. @7)}
    %%   setequal.data.frame:                                   {**dplyr::setequal.data.frame** (id: built-in:dplyr:setequal.data.frame, type: Function, def. @7)}
    %%   show_query:                                            {**dplyr::show_query** (id: built-in:dplyr:show_query, type: Function, def. @7)}
    %%   slice:                                                 {**dplyr::slice** (id: built-in:dplyr:slice, type: Function, def. @7)}
    %%   slice_:                                                {**dplyr::slice_** (id: built-in:dplyr:slice_, type: Function, def. @7)}
    %%   slice_head:                                            {**dplyr::slice_head** (id: built-in:dplyr:slice_head, type: Function, def. @7)}
    %%   slice_head.data.frame:                                 {**dplyr::slice_head.data.frame** (id: built-in:dplyr:slice_head.data.frame, type: Function, def. @7)}
    %%   slice_max:                                             {**dplyr::slice_max** (id: built-in:dplyr:slice_max, type: Function, def. @7)}
    %%   slice_max.data.frame:                                  {**dplyr::slice_max.data.frame** (id: built-in:dplyr:slice_max.data.frame, type: Function, def. @7)}
    %%   slice_min:                                             {**dplyr::slice_min** (id: built-in:dplyr:slice_min, type: Function, def. @7)}
    %%   slice_min.data.frame:                                  {**dplyr::slice_min.data.frame** (id: built-in:dplyr:slice_min.data.frame, type: Function, def. @7)}
    %%   slice_sample:                                          {**dplyr::slice_sample** (id: built-in:dplyr:slice_sample, type: Function, def. @7)}
    %%   slice_sample.data.frame:                               {**dplyr::slice_sample.data.frame** (id: built-in:dplyr:slice_sample.data.frame, type: Function, def. @7)}
    %%   slice_tail:                                            {**dplyr::slice_tail** (id: built-in:dplyr:slice_tail, type: Function, def. @7)}
    %%   slice_tail.data.frame:                                 {**dplyr::slice_tail.data.frame** (id: built-in:dplyr:slice_tail.data.frame, type: Function, def. @7)}
    %%   slice.data.frame:                                      {**dplyr::slice.data.frame** (id: built-in:dplyr:slice.data.frame, type: Function, def. @7)}
    %%   sql:                                                   {**dplyr::sql** (id: built-in:dplyr:sql, type: Function, def. @7)}
    %%   sql_escape_ident:                                      {**dplyr::sql_escape_ident** (id: built-in:dplyr:sql_escape_ident, type: Function, def. @7)}
    %%   sql_escape_string:                                     {**dplyr::sql_escape_string** (id: built-in:dplyr:sql_escape_string, type: Function, def. @7)}
    %%   sql_join:                                              {**dplyr::sql_join** (id: built-in:dplyr:sql_join, type: Function, def. @7)}
    %%   sql_select:                                            {**dplyr::sql_select** (id: built-in:dplyr:sql_select, type: Function, def. @7)}
    %%   sql_semi_join:                                         {**dplyr::sql_semi_join** (id: built-in:dplyr:sql_semi_join, type: Function, def. @7)}
    %%   sql_set_op:                                            {**dplyr::sql_set_op** (id: built-in:dplyr:sql_set_op, type: Function, def. @7)}
    %%   sql_subquery:                                          {**dplyr::sql_subquery** (id: built-in:dplyr:sql_subquery, type: Function, def. @7)}
    %%   sql_translate_env:                                     {**dplyr::sql_translate_env** (id: built-in:dplyr:sql_translate_env, type: Function, def. @7)}
    %%   src:                                                   {**dplyr::src** (id: built-in:dplyr:src, type: Function, def. @7)}
    %%   src_df:                                                {**dplyr::src_df** (id: built-in:dplyr:src_df, type: Function, def. @7)}
    %%   src_local:                                             {**dplyr::src_local** (id: built-in:dplyr:src_local, type: Function, def. @7)}
    %%   src_mysql:                                             {**dplyr::src_mysql** (id: built-in:dplyr:src_mysql, type: Function, def. @7)}
    %%   src_postgres:                                          {**dplyr::src_postgres** (id: built-in:dplyr:src_postgres, type: Function, def. @7)}
    %%   src_sqlite:                                            {**dplyr::src_sqlite** (id: built-in:dplyr:src_sqlite, type: Function, def. @7)}
    %%   src_tbls:                                              {**dplyr::src_tbls** (id: built-in:dplyr:src_tbls, type: Function, def. @7)}
    %%   summarise:                                             {**dplyr::summarise** (id: built-in:dplyr:summarise, type: Function, def. @7)}
    %%   summarise_:                                            {**dplyr::summarise_** (id: built-in:dplyr:summarise_, type: Function, def. @7)}
    %%   summarise_all:                                         {**dplyr::summarise_all** (id: built-in:dplyr:summarise_all, type: Function, def. @7)}
    %%   summarise_at:                                          {**dplyr::summarise_at** (id: built-in:dplyr:summarise_at, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::reframe_incompatible_size:   {**dplyr::summarise_bullets.dplyr:::reframe_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::reframe_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_incompatible_size: {**dplyr::summarise_bullets.dplyr:::summarise_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_mixed_null:        {**dplyr::summarise_bullets.dplyr:::summarise_mixed_null** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_mixed_null, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_unsupported_type:  {**dplyr::summarise_bullets.dplyr:::summarise_unsupported_type** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_unsupported_type, type: Function, def. @7)}
    %%   summarise_each:                                        {**dplyr::summarise_each** (id: built-in:dplyr:summarise_each, type: Function, def. @7)}
    %%   summarise_each_:                                       {**dplyr::summarise_each_** (id: built-in:dplyr:summarise_each_, type: Function, def. @7)}
    %%   summarise_if:                                          {**dplyr::summarise_if** (id: built-in:dplyr:summarise_if, type: Function, def. @7)}
    %%   summarise.data.frame:                                  {**dplyr::summarise.data.frame** (id: built-in:dplyr:summarise.data.frame, type: Function, def. @7)}
    %%   summarise.grouped_df:                                  {**dplyr::summarise.grouped_df** (id: built-in:dplyr:summarise.grouped_df, type: Function, def. @7)}
    %%   summarise.rowwise_df:                                  {**dplyr::summarise.rowwise_df** (id: built-in:dplyr:summarise.rowwise_df, type: Function, def. @7)}
    %%   summarize:                                             {**dplyr::summarize** (id: built-in:dplyr:summarize, type: Function, def. @7)}
    %%   summarize_:                                            {**dplyr::summarize_** (id: built-in:dplyr:summarize_, type: Function, def. @7)}
    %%   summarize_all:                                         {**dplyr::summarize_all** (id: built-in:dplyr:summarize_all, type: Function, def. @7)}
    %%   summarize_at:                                          {**dplyr::summarize_at** (id: built-in:dplyr:summarize_at, type: Function, def. @7)}
    %%   summarize_each:                                        {**dplyr::summarize_each** (id: built-in:dplyr:summarize_each, type: Function, def. @7)}
    %%   summarize_each_:                                       {**dplyr::summarize_each_** (id: built-in:dplyr:summarize_each_, type: Function, def. @7)}
    %%   summarize_if:                                          {**dplyr::summarize_if** (id: built-in:dplyr:summarize_if, type: Function, def. @7)}
    %%   symdiff:                                               {**dplyr::symdiff** (id: built-in:dplyr:symdiff, type: Function, def. @7)}
    %%   symdiff.data.frame:                                    {**dplyr::symdiff.data.frame** (id: built-in:dplyr:symdiff.data.frame, type: Function, def. @7)}
    %%   symdiff.default:                                       {**dplyr::symdiff.default** (id: built-in:dplyr:symdiff.default, type: Function, def. @7)}
    %%   tally:                                                 {**dplyr::tally** (id: built-in:dplyr:tally, type: Function, def. @7)}
    %%   tally_:                                                {**dplyr::tally_** (id: built-in:dplyr:tally_, type: Function, def. @7)}
    %%   tally.data.frame:                                      {**dplyr::tally.data.frame** (id: built-in:dplyr:tally.data.frame, type: Function, def. @7)}
    %%   tbl:                                                   {**dplyr::tbl** (id: built-in:dplyr:tbl, type: Function, def. @7)}
    %%   tbl_df:                                                {**dplyr::tbl_df** (id: built-in:dplyr:tbl_df, type: Function, def. @7)}
    %%   tbl_nongroup_vars:                                     {**dplyr::tbl_nongroup_vars** (id: built-in:dplyr:tbl_nongroup_vars, type: Function, def. @7)}
    %%   tbl_ptype:                                             {**dplyr::tbl_ptype** (id: built-in:dplyr:tbl_ptype, type: Function, def. @7)}
    %%   tbl_ptype.default:                                     {**dplyr::tbl_ptype.default** (id: built-in:dplyr:tbl_ptype.default, type: Function, def. @7)}
    %%   tbl_sum.grouped_df:                                    {**dplyr::tbl_sum.grouped_df** (id: built-in:dplyr:tbl_sum.grouped_df, type: Function, def. @7)}
    %%   tbl_sum.rowwise_df:                                    {**dplyr::tbl_sum.rowwise_df** (id: built-in:dplyr:tbl_sum.rowwise_df, type: Function, def. @7)}
    %%   tbl_vars:                                              {**dplyr::tbl_vars** (id: built-in:dplyr:tbl_vars, type: Function, def. @7)}
    %%   tbl_vars.data.frame:                                   {**dplyr::tbl_vars.data.frame** (id: built-in:dplyr:tbl_vars.data.frame, type: Function, def. @7)}
    %%   tbl.DBIConnection:                                     {**dplyr::tbl.DBIConnection** (id: built-in:dplyr:tbl.DBIConnection, type: Function, def. @7)}
    %%   top_frac:                                              {**dplyr::top_frac** (id: built-in:dplyr:top_frac, type: Function, def. @7)}
    %%   top_n:                                                 {**dplyr::top_n** (id: built-in:dplyr:top_n, type: Function, def. @7)}
    %%   transmute:                                             {**dplyr::transmute** (id: built-in:dplyr:transmute, type: Function, def. @7)}
    %%   transmute_:                                            {**dplyr::transmute_** (id: built-in:dplyr:transmute_, type: Function, def. @7)}
    %%   transmute_all:                                         {**dplyr::transmute_all** (id: built-in:dplyr:transmute_all, type: Function, def. @7)}
    %%   transmute_at:                                          {**dplyr::transmute_at** (id: built-in:dplyr:transmute_at, type: Function, def. @7)}
    %%   transmute_if:                                          {**dplyr::transmute_if** (id: built-in:dplyr:transmute_if, type: Function, def. @7)}
    %%   transmute.data.frame:                                  {**dplyr::transmute.data.frame** (id: built-in:dplyr:transmute.data.frame, type: Function, def. @7)}
    %%   ungroup:                                               {**dplyr::ungroup** (id: built-in:dplyr:ungroup, type: Function, def. @7)}
    %%   ungroup.data.frame:                                    {**dplyr::ungroup.data.frame** (id: built-in:dplyr:ungroup.data.frame, type: Function, def. @7)}
    %%   ungroup.grouped_df:                                    {**dplyr::ungroup.grouped_df** (id: built-in:dplyr:ungroup.grouped_df, type: Function, def. @7)}
    %%   ungroup.rowwise_df:                                    {**dplyr::ungroup.rowwise_df** (id: built-in:dplyr:ungroup.rowwise_df, type: Function, def. @7)}
    %%   union_all:                                             {**dplyr::union_all** (id: built-in:dplyr:union_all, type: Function, def. @7)}
    %%   union_all.data.frame:                                  {**dplyr::union_all.data.frame** (id: built-in:dplyr:union_all.data.frame, type: Function, def. @7)}
    %%   union_all.default:                                     {**dplyr::union_all.default** (id: built-in:dplyr:union_all.default, type: Function, def. @7)}
    %%   union.data.frame:                                      {**dplyr::union.data.frame** (id: built-in:dplyr:union.data.frame, type: Function, def. @7)}
    %%   validate_grouped_df:                                   {**dplyr::validate_grouped_df** (id: built-in:dplyr:validate_grouped_df, type: Function, def. @7)}
    %%   validate_rowwise_df:                                   {**dplyr::validate_rowwise_df** (id: built-in:dplyr:validate_rowwise_df, type: Function, def. @7)}
    %%   vars:                                                  {**dplyr::vars** (id: built-in:dplyr:vars, type: Function, def. @7)}
    %%   when_all:                                              {**dplyr::when_all** (id: built-in:dplyr:when_all, type: Function, def. @7)}
    %%   when_any:                                              {**dplyr::when_any** (id: built-in:dplyr:when_any, type: Function, def. @7)}
    %%   with_groups:                                           {**dplyr::with_groups** (id: built-in:dplyr:with_groups, type: Function, def. @7)}
    %%   with_order:                                            {**dplyr::with_order** (id: built-in:dplyr:with_order, type: Function, def. @7)}
    %%   wrap_dbplyr_obj:                                       {**dplyr::wrap_dbplyr_obj** (id: built-in:dplyr:wrap_dbplyr_obj, type: Function, def. @7)}
    %%   %>%:                                                   {**dplyr::%>%** (id: built-in:dplyr:%>%, type: Function, def. @7)}
    %%   add_row:                                               {**dplyr::add_row** (id: built-in:dplyr:add_row, type: Function, def. @7)}
    %%   all_of:                                                {**dplyr::all_of** (id: built-in:dplyr:all_of, type: Function, def. @7)}
    %%   any_of:                                                {**dplyr::any_of** (id: built-in:dplyr:any_of, type: Function, def. @7)}
    %%   as_data_frame:                                         {**dplyr::as_data_frame** (id: built-in:dplyr:as_data_frame, type: Function, def. @7)}
    %%   as_label:                                              {**dplyr::as_label** (id: built-in:dplyr:as_label, type: Function, def. @7)}
    %%   as_tibble:                                             {**dplyr::as_tibble** (id: built-in:dplyr:as_tibble, type: Function, def. @7)}
    %%   contains:                                              {**dplyr::contains** (id: built-in:dplyr:contains, type: Function, def. @7)}
    %%   data_frame:                                            {**dplyr::data_frame** (id: built-in:dplyr:data_frame, type: Function, def. @7)}
    %%   ends_with:                                             {**dplyr::ends_with** (id: built-in:dplyr:ends_with, type: Function, def. @7)}
    %%   enexpr:                                                {**dplyr::enexpr** (id: built-in:dplyr:enexpr, type: Function, def. @7)}
    %%   enexprs:                                               {**dplyr::enexprs** (id: built-in:dplyr:enexprs, type: Function, def. @7)}
    %%   enquo:                                                 {**dplyr::enquo** (id: built-in:dplyr:enquo, type: Function, def. @7)}
    %%   enquos:                                                {**dplyr::enquos** (id: built-in:dplyr:enquos, type: Function, def. @7)}
    %%   ensym:                                                 {**dplyr::ensym** (id: built-in:dplyr:ensym, type: Function, def. @7)}
    %%   ensyms:                                                {**dplyr::ensyms** (id: built-in:dplyr:ensyms, type: Function, def. @7)}
    %%   everything:                                            {**dplyr::everything** (id: built-in:dplyr:everything, type: Function, def. @7)}
    %%   expr:                                                  {**dplyr::expr** (id: built-in:dplyr:expr, type: Function, def. @7)}
    %%   glimpse:                                               {**dplyr::glimpse** (id: built-in:dplyr:glimpse, type: Function, def. @7)}
    %%   intersect:                                             {**dplyr::intersect** (id: built-in:dplyr:intersect, type: Function, def. @7)}
    %%   last_col:                                              {**dplyr::last_col** (id: built-in:dplyr:last_col, type: Function, def. @7)}
    %%   lst:                                                   {**dplyr::lst** (id: built-in:dplyr:lst, type: Function, def. @7)}
    %%   matches:                                               {**dplyr::matches** (id: built-in:dplyr:matches, type: Function, def. @7)}
    %%   num_range:                                             {**dplyr::num_range** (id: built-in:dplyr:num_range, type: Function, def. @7)}
    %%   one_of:                                                {**dplyr::one_of** (id: built-in:dplyr:one_of, type: Function, def. @7)}
    %%   quo:                                                   {**dplyr::quo** (id: built-in:dplyr:quo, type: Function, def. @7)}
    %%   quo_name:                                              {**dplyr::quo_name** (id: built-in:dplyr:quo_name, type: Function, def. @7)}
    %%   quos:                                                  {**dplyr::quos** (id: built-in:dplyr:quos, type: Function, def. @7)}
    %%   setdiff:                                               {**dplyr::setdiff** (id: built-in:dplyr:setdiff, type: Function, def. @7)}
    %%   setequal:                                              {**dplyr::setequal** (id: built-in:dplyr:setequal, type: Function, def. @7)}
    %%   starts_with:                                           {**dplyr::starts_with** (id: built-in:dplyr:starts_with, type: Function, def. @7)}
    %%   sym:                                                   {**dplyr::sym** (id: built-in:dplyr:sym, type: Function, def. @7)}
    %%   syms:                                                  {**dplyr::syms** (id: built-in:dplyr:syms, type: Function, def. @7)}
    %%   tibble:                                                {**dplyr::tibble** (id: built-in:dplyr:tibble, type: Function, def. @7)}
    %%   tribble:                                               {**dplyr::tribble** (id: built-in:dplyr:tribble, type: Function, def. @7)}
    %%   type_sum:                                              {**dplyr::type_sum** (id: built-in:dplyr:type_sum, type: Function, def. @7)}
    %%   union:                                                 {**dplyr::union** (id: built-in:dplyr:union, type: Function, def. @7)}
    %%   where:                                                 {**dplyr::where** (id: built-in:dplyr:where, type: Function, def. @7)}
    %%   id:                                                    {**dplyr::id** (id: built-in:dplyr:id, type: Function, def. @7)}
    %%   select_vars_:                                          {**dplyr::select_vars_** (id: built-in:dplyr:select_vars_, type: Function, def. @7)}
    %%   rename_vars_:                                          {**dplyr::rename_vars_** (id: built-in:dplyr:rename_vars_, type: Function, def. @7)}
    %%   changes:                                               {**dplyr::changes** (id: built-in:dplyr:changes, type: Function, def. @7)}
    %%   location:                                              {**dplyr::location** (id: built-in:dplyr:location, type: Function, def. @7)}
    %%   eval_tbls2:                                            {**dplyr::eval_tbls2** (id: built-in:dplyr:eval_tbls2, type: Function, def. @7)}
    %%   eval_tbls:                                             {**dplyr::eval_tbls** (id: built-in:dplyr:eval_tbls, type: Function, def. @7)}
    %%   compare_tbls2:                                         {**dplyr::compare_tbls2** (id: built-in:dplyr:compare_tbls2, type: Function, def. @7)}
    %%   compare_tbls:                                          {**dplyr::compare_tbls** (id: built-in:dplyr:compare_tbls, type: Function, def. @7)}
    %%   bench_tbls:                                            {**dplyr::bench_tbls** (id: built-in:dplyr:bench_tbls, type: Function, def. @7)}
    %%   current_vars:                                          {**dplyr::current_vars** (id: built-in:dplyr:current_vars, type: Function, def. @7)}
    %%   select_var:                                            {**dplyr::select_var** (id: built-in:dplyr:select_var, type: Function, def. @7)}
    %%   rename_vars:                                           {**dplyr::rename_vars** (id: built-in:dplyr:rename_vars, type: Function, def. @7)}
    %%   select_vars:                                           {**dplyr::select_vars** (id: built-in:dplyr:select_vars, type: Function, def. @7)}
    %%   failwith:                                              {**dplyr::failwith** (id: built-in:dplyr:failwith, type: Function, def. @7)}
    %% 4----------------------------------------
    %% 5----------------------------------------
    %%   [.spec_tbl_df:                      {**readr::[.spec_tbl_df** (id: built-in:readr:[.spec_tbl_df, type: Function, def. @11)}
    %%   AccumulateCallback:                 {**readr::AccumulateCallback** (id: built-in:readr:AccumulateCallback, type: Function, def. @11)}
    %%   as_chunk_callback.ChunkCallback:    {**readr::as_chunk_callback.ChunkCallback** (id: built-in:readr:as_chunk_callback.ChunkCallback, type: Function, def. @11)}
    %%   as_chunk_callback.function:         {**readr::as_chunk_callback.function** (id: built-in:readr:as_chunk_callback.function, type: Function, def. @11)}
    %%   as_chunk_callback.R6ClassGenerator: {**readr::as_chunk_callback.R6ClassGenerator** (id: built-in:readr:as_chunk_callback.R6ClassGenerator, type: Function, def. @11)}
    %%   as_tibble.spec_tbl_df:              {**readr::as_tibble.spec_tbl_df** (id: built-in:readr:as_tibble.spec_tbl_df, type: Function, def. @11)}
    %%   as.character.col_spec:              {**readr::as.character.col_spec** (id: built-in:readr:as.character.col_spec, type: Function, def. @11)}
    %%   as.col_spec:                        {**readr::as.col_spec** (id: built-in:readr:as.col_spec, type: Function, def. @11)}
    %%   as.col_spec.character:              {**readr::as.col_spec.character** (id: built-in:readr:as.col_spec.character, type: Function, def. @11)}
    %%   as.col_spec.col_spec:               {**readr::as.col_spec.col_spec** (id: built-in:readr:as.col_spec.col_spec, type: Function, def. @11)}
    %%   as.col_spec.data.frame:             {**readr::as.col_spec.data.frame** (id: built-in:readr:as.col_spec.data.frame, type: Function, def. @11)}
    %%   as.col_spec.default:                {**readr::as.col_spec.default** (id: built-in:readr:as.col_spec.default, type: Function, def. @11)}
    %%   as.col_spec.list:                   {**readr::as.col_spec.list** (id: built-in:readr:as.col_spec.list, type: Function, def. @11)}
    %%   as.col_spec.NULL:                   {**readr::as.col_spec.NULL** (id: built-in:readr:as.col_spec.NULL, type: Function, def. @11)}
    %%   as.data.frame.spec_tbl_df:          {**readr::as.data.frame.spec_tbl_df** (id: built-in:readr:as.data.frame.spec_tbl_df, type: Function, def. @11)}
    %%   ChunkCallback:                      {**readr::ChunkCallback** (id: built-in:readr:ChunkCallback, type: Function, def. @11)}
    %%   clipboard:                          {**readr::clipboard** (id: built-in:readr:clipboard, type: Function, def. @11)}
    %%   col_character:                      {**readr::col_character** (id: built-in:readr:col_character, type: Function, def. @11)}
    %%   col_date:                           {**readr::col_date** (id: built-in:readr:col_date, type: Function, def. @11)}
    %%   col_datetime:                       {**readr::col_datetime** (id: built-in:readr:col_datetime, type: Function, def. @11)}
    %%   col_double:                         {**readr::col_double** (id: built-in:readr:col_double, type: Function, def. @11)}
    %%   col_factor:                         {**readr::col_factor** (id: built-in:readr:col_factor, type: Function, def. @11)}
    %%   col_guess:                          {**readr::col_guess** (id: built-in:readr:col_guess, type: Function, def. @11)}
    %%   col_integer:                        {**readr::col_integer** (id: built-in:readr:col_integer, type: Function, def. @11)}
    %%   col_logical:                        {**readr::col_logical** (id: built-in:readr:col_logical, type: Function, def. @11)}
    %%   col_number:                         {**readr::col_number** (id: built-in:readr:col_number, type: Function, def. @11)}
    %%   col_skip:                           {**readr::col_skip** (id: built-in:readr:col_skip, type: Function, def. @11)}
    %%   col_time:                           {**readr::col_time** (id: built-in:readr:col_time, type: Function, def. @11)}
    %%   cols:                               {**readr::cols** (id: built-in:readr:cols, type: Function, def. @11)}
    %%   cols_condense:                      {**readr::cols_condense** (id: built-in:readr:cols_condense, type: Function, def. @11)}
    %%   cols_only:                          {**readr::cols_only** (id: built-in:readr:cols_only, type: Function, def. @11)}
    %%   count_fields:                       {**readr::count_fields** (id: built-in:readr:count_fields, type: Function, def. @11)}
    %%   DataFrameCallback:                  {**readr::DataFrameCallback** (id: built-in:readr:DataFrameCallback, type: Function, def. @11)}
    %%   datasource:                         {**readr::datasource** (id: built-in:readr:datasource, type: Function, def. @11)}
    %%   date_names:                         {**readr::date_names** (id: built-in:readr:date_names, type: Function, def. @11)}
    %%   date_names_lang:                    {**readr::date_names_lang** (id: built-in:readr:date_names_lang, type: Function, def. @11)}
    %%   date_names_langs:                   {**readr::date_names_langs** (id: built-in:readr:date_names_langs, type: Function, def. @11)}
    %%   default_locale:                     {**readr::default_locale** (id: built-in:readr:default_locale, type: Function, def. @11)}
    %%   edition_get:                        {**readr::edition_get** (id: built-in:readr:edition_get, type: Function, def. @11)}
    %%   format_csv:                         {**readr::format_csv** (id: built-in:readr:format_csv, type: Function, def. @11)}
    %%   format_csv2:                        {**readr::format_csv2** (id: built-in:readr:format_csv2, type: Function, def. @11)}
    %%   format_delim:                       {**readr::format_delim** (id: built-in:readr:format_delim, type: Function, def. @11)}
    %%   format_tsv:                         {**readr::format_tsv** (id: built-in:readr:format_tsv, type: Function, def. @11)}
    %%   format.col_spec:                    {**readr::format.col_spec** (id: built-in:readr:format.col_spec, type: Function, def. @11)}
    %%   fwf_cols:                           {**readr::fwf_cols** (id: built-in:readr:fwf_cols, type: Function, def. @11)}
    %%   fwf_empty:                          {**readr::fwf_empty** (id: built-in:readr:fwf_empty, type: Function, def. @11)}
    %%   fwf_positions:                      {**readr::fwf_positions** (id: built-in:readr:fwf_positions, type: Function, def. @11)}
    %%   fwf_widths:                         {**readr::fwf_widths** (id: built-in:readr:fwf_widths, type: Function, def. @11)}
    %%   guess_encoding:                     {**readr::guess_encoding** (id: built-in:readr:guess_encoding, type: Function, def. @11)}
    %%   guess_parser:                       {**readr::guess_parser** (id: built-in:readr:guess_parser, type: Function, def. @11)}
    %%   ListCallback:                       {**readr::ListCallback** (id: built-in:readr:ListCallback, type: Function, def. @11)}
    %%   local_edition:                      {**readr::local_edition** (id: built-in:readr:local_edition, type: Function, def. @11)}
    %%   locale:                             {**readr::locale** (id: built-in:readr:locale, type: Function, def. @11)}
    %%   output_column:                      {**readr::output_column** (id: built-in:readr:output_column, type: Function, def. @11)}
    %%   output_column.default:              {**readr::output_column.default** (id: built-in:readr:output_column.default, type: Function, def. @11)}
    %%   output_column.double:               {**readr::output_column.double** (id: built-in:readr:output_column.double, type: Function, def. @11)}
    %%   output_column.POSIXt:               {**readr::output_column.POSIXt** (id: built-in:readr:output_column.POSIXt, type: Function, def. @11)}
    %%   parse_character:                    {**readr::parse_character** (id: built-in:readr:parse_character, type: Function, def. @11)}
    %%   parse_date:                         {**readr::parse_date** (id: built-in:readr:parse_date, type: Function, def. @11)}
    %%   parse_datetime:                     {**readr::parse_datetime** (id: built-in:readr:parse_datetime, type: Function, def. @11)}
    %%   parse_double:                       {**readr::parse_double** (id: built-in:readr:parse_double, type: Function, def. @11)}
    %%   parse_factor:                       {**readr::parse_factor** (id: built-in:readr:parse_factor, type: Function, def. @11)}
    %%   parse_guess:                        {**readr::parse_guess** (id: built-in:readr:parse_guess, type: Function, def. @11)}
    %%   parse_integer:                      {**readr::parse_integer** (id: built-in:readr:parse_integer, type: Function, def. @11)}
    %%   parse_logical:                      {**readr::parse_logical** (id: built-in:readr:parse_logical, type: Function, def. @11)}
    %%   parse_number:                       {**readr::parse_number** (id: built-in:readr:parse_number, type: Function, def. @11)}
    %%   parse_time:                         {**readr::parse_time** (id: built-in:readr:parse_time, type: Function, def. @11)}
    %%   parse_vector:                       {**readr::parse_vector** (id: built-in:readr:parse_vector, type: Function, def. @11)}
    %%   print.col_spec:                     {**readr::print.col_spec** (id: built-in:readr:print.col_spec, type: Function, def. @11)}
    %%   print.collector:                    {**readr::print.collector** (id: built-in:readr:print.collector, type: Function, def. @11)}
    %%   print.date_names:                   {**readr::print.date_names** (id: built-in:readr:print.date_names, type: Function, def. @11)}
    %%   print.locale:                       {**readr::print.locale** (id: built-in:readr:print.locale, type: Function, def. @11)}
    %%   problems:                           {**readr::problems** (id: built-in:readr:problems, type: Function, def. @11)}
    %%   read_builtin:                       {**readr::read_builtin** (id: built-in:readr:read_builtin, type: Function, def. @11)}
    %%   read_csv:                           {**readr::read_csv** (id: built-in:readr:read_csv, type: Function, def. @11)}
    %%   read_csv_chunked:                   {**readr::read_csv_chunked** (id: built-in:readr:read_csv_chunked, type: Function, def. @11)}
    %%   read_csv2:                          {**readr::read_csv2** (id: built-in:readr:read_csv2, type: Function, def. @11)}
    %%   read_csv2_chunked:                  {**readr::read_csv2_chunked** (id: built-in:readr:read_csv2_chunked, type: Function, def. @11)}
    %%   read_delim:                         {**readr::read_delim** (id: built-in:readr:read_delim, type: Function, def. @11)}
    %%   read_delim_chunked:                 {**readr::read_delim_chunked** (id: built-in:readr:read_delim_chunked, type: Function, def. @11)}
    %%   read_file:                          {**readr::read_file** (id: built-in:readr:read_file, type: Function, def. @11)}
    %%   read_file_raw:                      {**readr::read_file_raw** (id: built-in:readr:read_file_raw, type: Function, def. @11)}
    %%   read_fwf:                           {**readr::read_fwf** (id: built-in:readr:read_fwf, type: Function, def. @11)}
    %%   read_lines:                         {**readr::read_lines** (id: built-in:readr:read_lines, type: Function, def. @11)}
    %%   read_lines_chunked:                 {**readr::read_lines_chunked** (id: built-in:readr:read_lines_chunked, type: Function, def. @11)}
    %%   read_lines_raw:                     {**readr::read_lines_raw** (id: built-in:readr:read_lines_raw, type: Function, def. @11)}
    %%   read_lines_raw_chunked:             {**readr::read_lines_raw_chunked** (id: built-in:readr:read_lines_raw_chunked, type: Function, def. @11)}
    %%   read_log:                           {**readr::read_log** (id: built-in:readr:read_log, type: Function, def. @11)}
    %%   read_rds:                           {**readr::read_rds** (id: built-in:readr:read_rds, type: Function, def. @11)}
    %%   read_table:                         {**readr::read_table** (id: built-in:readr:read_table, type: Function, def. @11)}
    %%   read_tsv:                           {**readr::read_tsv** (id: built-in:readr:read_tsv, type: Function, def. @11)}
    %%   read_tsv_chunked:                   {**readr::read_tsv_chunked** (id: built-in:readr:read_tsv_chunked, type: Function, def. @11)}
    %%   readr_example:                      {**readr::readr_example** (id: built-in:readr:readr_example, type: Function, def. @11)}
    %%   readr_threads:                      {**readr::readr_threads** (id: built-in:readr:readr_threads, type: Function, def. @11)}
    %%   should_read_lazy:                   {**readr::should_read_lazy** (id: built-in:readr:should_read_lazy, type: Function, def. @11)}
    %%   should_show_types:                  {**readr::should_show_types** (id: built-in:readr:should_show_types, type: Function, def. @11)}
    %%   show_progress:                      {**readr::show_progress** (id: built-in:readr:show_progress, type: Function, def. @11)}
    %%   SideEffectChunkCallback:            {**readr::SideEffectChunkCallback** (id: built-in:readr:SideEffectChunkCallback, type: Function, def. @11)}
    %%   spec:                               {**readr::spec** (id: built-in:readr:spec, type: Function, def. @11)}
    %%   spec_csv:                           {**readr::spec_csv** (id: built-in:readr:spec_csv, type: Function, def. @11)}
    %%   spec_csv2:                          {**readr::spec_csv2** (id: built-in:readr:spec_csv2, type: Function, def. @11)}
    %%   spec_delim:                         {**readr::spec_delim** (id: built-in:readr:spec_delim, type: Function, def. @11)}
    %%   spec_table:                         {**readr::spec_table** (id: built-in:readr:spec_table, type: Function, def. @11)}
    %%   spec_tsv:                           {**readr::spec_tsv** (id: built-in:readr:spec_tsv, type: Function, def. @11)}
    %%   stop_for_problems:                  {**readr::stop_for_problems** (id: built-in:readr:stop_for_problems, type: Function, def. @11)}
    %%   str.col_spec:                       {**readr::str.col_spec** (id: built-in:readr:str.col_spec, type: Function, def. @11)}
    %%   tokenize:                           {**readr::tokenize** (id: built-in:readr:tokenize, type: Function, def. @11)}
    %%   tokenizer_csv:                      {**readr::tokenizer_csv** (id: built-in:readr:tokenizer_csv, type: Function, def. @11)}
    %%   tokenizer_delim:                    {**readr::tokenizer_delim** (id: built-in:readr:tokenizer_delim, type: Function, def. @11)}
    %%   tokenizer_fwf:                      {**readr::tokenizer_fwf** (id: built-in:readr:tokenizer_fwf, type: Function, def. @11)}
    %%   tokenizer_line:                     {**readr::tokenizer_line** (id: built-in:readr:tokenizer_line, type: Function, def. @11)}
    %%   tokenizer_log:                      {**readr::tokenizer_log** (id: built-in:readr:tokenizer_log, type: Function, def. @11)}
    %%   tokenizer_tsv:                      {**readr::tokenizer_tsv** (id: built-in:readr:tokenizer_tsv, type: Function, def. @11)}
    %%   tokenizer_ws:                       {**readr::tokenizer_ws** (id: built-in:readr:tokenizer_ws, type: Function, def. @11)}
    %%   type_convert:                       {**readr::type_convert** (id: built-in:readr:type_convert, type: Function, def. @11)}
    %%   type_to_col.Date:                   {**readr::type_to_col.Date** (id: built-in:readr:type_to_col.Date, type: Function, def. @11)}
    %%   type_to_col.default:                {**readr::type_to_col.default** (id: built-in:readr:type_to_col.default, type: Function, def. @11)}
    %%   type_to_col.double:                 {**readr::type_to_col.double** (id: built-in:readr:type_to_col.double, type: Function, def. @11)}
    %%   type_to_col.factor:                 {**readr::type_to_col.factor** (id: built-in:readr:type_to_col.factor, type: Function, def. @11)}
    %%   type_to_col.hms:                    {**readr::type_to_col.hms** (id: built-in:readr:type_to_col.hms, type: Function, def. @11)}
    %%   type_to_col.integer:                {**readr::type_to_col.integer** (id: built-in:readr:type_to_col.integer, type: Function, def. @11)}
    %%   type_to_col.logical:                {**readr::type_to_col.logical** (id: built-in:readr:type_to_col.logical, type: Function, def. @11)}
    %%   type_to_col.POSIXct:                {**readr::type_to_col.POSIXct** (id: built-in:readr:type_to_col.POSIXct, type: Function, def. @11)}
    %%   with_edition:                       {**readr::with_edition** (id: built-in:readr:with_edition, type: Function, def. @11)}
    %%   write_csv:                          {**readr::write_csv** (id: built-in:readr:write_csv, type: Function, def. @11)}
    %%   write_csv2:                         {**readr::write_csv2** (id: built-in:readr:write_csv2, type: Function, def. @11)}
    %%   write_delim:                        {**readr::write_delim** (id: built-in:readr:write_delim, type: Function, def. @11)}
    %%   write_excel_csv:                    {**readr::write_excel_csv** (id: built-in:readr:write_excel_csv, type: Function, def. @11)}
    %%   write_excel_csv2:                   {**readr::write_excel_csv2** (id: built-in:readr:write_excel_csv2, type: Function, def. @11)}
    %%   write_file:                         {**readr::write_file** (id: built-in:readr:write_file, type: Function, def. @11)}
    %%   write_lines:                        {**readr::write_lines** (id: built-in:readr:write_lines, type: Function, def. @11)}
    %%   write_rds:                          {**readr::write_rds** (id: built-in:readr:write_rds, type: Function, def. @11)}
    %%   write_tsv:                          {**readr::write_tsv** (id: built-in:readr:write_tsv, type: Function, def. @11)}
    %%   read_table2:                        {**readr::read_table2** (id: built-in:readr:read_table2, type: Function, def. @11)}
    %%   melt_table:                         {**readr::melt_table** (id: built-in:readr:melt_table, type: Function, def. @11)}
    %%   melt_fwf:                           {**readr::melt_fwf** (id: built-in:readr:melt_fwf, type: Function, def. @11)}
    %%   melt_delim:                         {**readr::melt_delim** (id: built-in:readr:melt_delim, type: Function, def. @11)}
    %% 6----------------------------------------
    %%   #search-path:ggplot: {**#search-path:ggplot** (id: 3, type: Variable, def. @3)}
    %%   #search-path:        {**#search-path** (id: 3, type: Variable, cds: {}, def. @3), **#search-path** (id: 7, type: Variable, cds: {}, def. @7), **#search-path** (id: 11, type: Variable, cds: {}, def. @11)}
    %%   #search-path:dplyr:  {**#search-path:dplyr** (id: 7, type: Variable, def. @7)}
    %%   #search-path:readr:  {**#search-path:readr** (id: 11, type: Variable, def. @11)}
    %%   data:                {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2:               {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:                   {**m** (id: 24, type: Unknown, def. @32)}
    %%   #sink:output:        {**#sink:output** (id: 36, type: Variable, cds: {}, def. @36)}
    48[["`*#91;RFunctionCall#93;* **aes**
      *13.16-32* (**id: 48**, 50+)
    arg: (x (44), y (47))`"]]
    %% Environment of 50 [level: 0]:
    %% Built-in
    %% 1----------------------------------------
    %%    library-load: {**ggplot:: library-load** (id: 3, type: Function, def. @3)}
    %% 2----------------------------------------
    %%   magrittr:%>%:           {**dplyr::magrittr:%>%** (id: built-in:magrittr:%>%, type: Function, def. @built-in:magrittr)}
    %%   tibble:add_row:         {**dplyr::tibble:add_row** (id: built-in:tibble:add_row, type: Function, def. @built-in:tibble)}
    %%   tibble:as_data_frame:   {**dplyr::tibble:as_data_frame** (id: built-in:tibble:as_data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:as_tibble:       {**dplyr::tibble:as_tibble** (id: built-in:tibble:as_tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:data_frame:      {**dplyr::tibble:data_frame** (id: built-in:tibble:data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:lst:             {**dplyr::tibble:lst** (id: built-in:tibble:lst, type: Function, def. @built-in:tibble)}
    %%   tibble:tibble:          {**dplyr::tibble:tibble** (id: built-in:tibble:tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:tribble:         {**dplyr::tibble:tribble** (id: built-in:tibble:tribble, type: Function, def. @built-in:tibble)}
    %%   tidyselect:all_of:      {**dplyr::tidyselect:all_of** (id: built-in:tidyselect:all_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:any_of:      {**dplyr::tidyselect:any_of** (id: built-in:tidyselect:any_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:contains:    {**dplyr::tidyselect:contains** (id: built-in:tidyselect:contains, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:ends_with:   {**dplyr::tidyselect:ends_with** (id: built-in:tidyselect:ends_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:everything:  {**dplyr::tidyselect:everything** (id: built-in:tidyselect:everything, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:last_col:    {**dplyr::tidyselect:last_col** (id: built-in:tidyselect:last_col, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:matches:     {**dplyr::tidyselect:matches** (id: built-in:tidyselect:matches, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:num_range:   {**dplyr::tidyselect:num_range** (id: built-in:tidyselect:num_range, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:one_of:      {**dplyr::tidyselect:one_of** (id: built-in:tidyselect:one_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:starts_with: {**dplyr::tidyselect:starts_with** (id: built-in:tidyselect:starts_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:where:       {**dplyr::tidyselect:where** (id: built-in:tidyselect:where, type: Function, def. @built-in:tidyselect)}
    %%   rlang:as_label:         {**dplyr::rlang:as_label** (id: built-in:rlang:as_label, type: Function, def. @built-in:rlang)}
    %%   rlang:enexpr:           {**dplyr::rlang:enexpr** (id: built-in:rlang:enexpr, type: Function, def. @built-in:rlang)}
    %%   rlang:enexprs:          {**dplyr::rlang:enexprs** (id: built-in:rlang:enexprs, type: Function, def. @built-in:rlang)}
    %%   rlang:enquo:            {**dplyr::rlang:enquo** (id: built-in:rlang:enquo, type: Function, def. @built-in:rlang)}
    %%   rlang:enquos:           {**dplyr::rlang:enquos** (id: built-in:rlang:enquos, type: Function, def. @built-in:rlang)}
    %%   rlang:ensym:            {**dplyr::rlang:ensym** (id: built-in:rlang:ensym, type: Function, def. @built-in:rlang)}
    %%   rlang:ensyms:           {**dplyr::rlang:ensyms** (id: built-in:rlang:ensyms, type: Function, def. @built-in:rlang)}
    %%   rlang:expr:             {**dplyr::rlang:expr** (id: built-in:rlang:expr, type: Function, def. @built-in:rlang)}
    %%   rlang:quo:              {**dplyr::rlang:quo** (id: built-in:rlang:quo, type: Function, def. @built-in:rlang)}
    %%   rlang:quo_name:         {**dplyr::rlang:quo_name** (id: built-in:rlang:quo_name, type: Function, def. @built-in:rlang)}
    %%   rlang:quos:             {**dplyr::rlang:quos** (id: built-in:rlang:quos, type: Function, def. @built-in:rlang)}
    %%   rlang:sym:              {**dplyr::rlang:sym** (id: built-in:rlang:sym, type: Function, def. @built-in:rlang)}
    %%   rlang:syms:             {**dplyr::rlang:syms** (id: built-in:rlang:syms, type: Function, def. @built-in:rlang)}
    %%   pillar:glimpse:         {**dplyr::pillar:glimpse** (id: built-in:pillar:glimpse, type: Function, def. @built-in:pillar)}
    %%   pillar:type_sum:        {**dplyr::pillar:type_sum** (id: built-in:pillar:type_sum, type: Function, def. @built-in:pillar)}
    %%   generics:intersect:     {**dplyr::generics:intersect** (id: built-in:generics:intersect, type: Function, def. @built-in:generics)}
    %%   generics:setdiff:       {**dplyr::generics:setdiff** (id: built-in:generics:setdiff, type: Function, def. @built-in:generics)}
    %%   generics:setequal:      {**dplyr::generics:setequal** (id: built-in:generics:setequal, type: Function, def. @built-in:generics)}
    %%   generics:union:         {**dplyr::generics:union** (id: built-in:generics:union, type: Function, def. @built-in:generics)}
    %% 3----------------------------------------
    %%   [.fun_list:                                            {**dplyr::[.fun_list** (id: built-in:dplyr:[.fun_list, type: Function, def. @7)}
    %%   [.grouped_df:                                          {**dplyr::[.grouped_df** (id: built-in:dplyr:[.grouped_df, type: Function, def. @7)}
    %%   [.rowwise_df:                                          {**dplyr::[.rowwise_df** (id: built-in:dplyr:[.rowwise_df, type: Function, def. @7)}
    %%   [[<-.grouped_df:                                       {**dplyr::[[<-.grouped_df** (id: built-in:dplyr:[[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.grouped_df:                                        {**dplyr::[<-.grouped_df** (id: built-in:dplyr:[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.rowwise_df:                                        {**dplyr::[<-.rowwise_df** (id: built-in:dplyr:[<-.rowwise_df, type: Function, def. @7)}
    %%   $<-.grouped_df:                                        {**dplyr::$<-.grouped_df** (id: built-in:dplyr:$<-.grouped_df, type: Function, def. @7)}
    %%   across:                                                {**dplyr::across** (id: built-in:dplyr:across, type: Function, def. @7)}
    %%   add_count:                                             {**dplyr::add_count** (id: built-in:dplyr:add_count, type: Function, def. @7)}
    %%   add_count_:                                            {**dplyr::add_count_** (id: built-in:dplyr:add_count_, type: Function, def. @7)}
    %%   add_count.data.frame:                                  {**dplyr::add_count.data.frame** (id: built-in:dplyr:add_count.data.frame, type: Function, def. @7)}
    %%   add_count.default:                                     {**dplyr::add_count.default** (id: built-in:dplyr:add_count.default, type: Function, def. @7)}
    %%   add_rownames:                                          {**dplyr::add_rownames** (id: built-in:dplyr:add_rownames, type: Function, def. @7)}
    %%   add_tally:                                             {**dplyr::add_tally** (id: built-in:dplyr:add_tally, type: Function, def. @7)}
    %%   add_tally_:                                            {**dplyr::add_tally_** (id: built-in:dplyr:add_tally_, type: Function, def. @7)}
    %%   all_equal:                                             {**dplyr::all_equal** (id: built-in:dplyr:all_equal, type: Function, def. @7)}
    %%   all_vars:                                              {**dplyr::all_vars** (id: built-in:dplyr:all_vars, type: Function, def. @7)}
    %%   anti_join:                                             {**dplyr::anti_join** (id: built-in:dplyr:anti_join, type: Function, def. @7)}
    %%   anti_join.data.frame:                                  {**dplyr::anti_join.data.frame** (id: built-in:dplyr:anti_join.data.frame, type: Function, def. @7)}
    %%   any_vars:                                              {**dplyr::any_vars** (id: built-in:dplyr:any_vars, type: Function, def. @7)}
    %%   arrange:                                               {**dplyr::arrange** (id: built-in:dplyr:arrange, type: Function, def. @7)}
    %%   arrange_:                                              {**dplyr::arrange_** (id: built-in:dplyr:arrange_, type: Function, def. @7)}
    %%   arrange_all:                                           {**dplyr::arrange_all** (id: built-in:dplyr:arrange_all, type: Function, def. @7)}
    %%   arrange_at:                                            {**dplyr::arrange_at** (id: built-in:dplyr:arrange_at, type: Function, def. @7)}
    %%   arrange_if:                                            {**dplyr::arrange_if** (id: built-in:dplyr:arrange_if, type: Function, def. @7)}
    %%   arrange.data.frame:                                    {**dplyr::arrange.data.frame** (id: built-in:dplyr:arrange.data.frame, type: Function, def. @7)}
    %%   as_join_by.character:                                  {**dplyr::as_join_by.character** (id: built-in:dplyr:as_join_by.character, type: Function, def. @7)}
    %%   as_join_by.default:                                    {**dplyr::as_join_by.default** (id: built-in:dplyr:as_join_by.default, type: Function, def. @7)}
    %%   as_join_by.dplyr_join_by:                              {**dplyr::as_join_by.dplyr_join_by** (id: built-in:dplyr:as_join_by.dplyr_join_by, type: Function, def. @7)}
    %%   as_join_by.list:                                       {**dplyr::as_join_by.list** (id: built-in:dplyr:as_join_by.list, type: Function, def. @7)}
    %%   as_tibble.grouped_df:                                  {**dplyr::as_tibble.grouped_df** (id: built-in:dplyr:as_tibble.grouped_df, type: Function, def. @7)}
    %%   as_tibble.rowwise_df:                                  {**dplyr::as_tibble.rowwise_df** (id: built-in:dplyr:as_tibble.rowwise_df, type: Function, def. @7)}
    %%   as.data.frame.grouped_df:                              {**dplyr::as.data.frame.grouped_df** (id: built-in:dplyr:as.data.frame.grouped_df, type: Function, def. @7)}
    %%   as.tbl:                                                {**dplyr::as.tbl** (id: built-in:dplyr:as.tbl, type: Function, def. @7)}
    %%   auto_copy:                                             {**dplyr::auto_copy** (id: built-in:dplyr:auto_copy, type: Function, def. @7)}
    %%   auto_copy.data.frame:                                  {**dplyr::auto_copy.data.frame** (id: built-in:dplyr:auto_copy.data.frame, type: Function, def. @7)}
    %%   between:                                               {**dplyr::between** (id: built-in:dplyr:between, type: Function, def. @7)}
    %%   bind_cols:                                             {**dplyr::bind_cols** (id: built-in:dplyr:bind_cols, type: Function, def. @7)}
    %%   bind_rows:                                             {**dplyr::bind_rows** (id: built-in:dplyr:bind_rows, type: Function, def. @7)}
    %%   c_across:                                              {**dplyr::c_across** (id: built-in:dplyr:c_across, type: Function, def. @7)}
    %%   case_match:                                            {**dplyr::case_match** (id: built-in:dplyr:case_match, type: Function, def. @7)}
    %%   case_when:                                             {**dplyr::case_when** (id: built-in:dplyr:case_when, type: Function, def. @7)}
    %%   cbind.grouped_df:                                      {**dplyr::cbind.grouped_df** (id: built-in:dplyr:cbind.grouped_df, type: Function, def. @7)}
    %%   check_dbplyr:                                          {**dplyr::check_dbplyr** (id: built-in:dplyr:check_dbplyr, type: Function, def. @7)}
    %%   coalesce:                                              {**dplyr::coalesce** (id: built-in:dplyr:coalesce, type: Function, def. @7)}
    %%   collapse:                                              {**dplyr::collapse** (id: built-in:dplyr:collapse, type: Function, def. @7)}
    %%   collapse.data.frame:                                   {**dplyr::collapse.data.frame** (id: built-in:dplyr:collapse.data.frame, type: Function, def. @7)}
    %%   collect:                                               {**dplyr::collect** (id: built-in:dplyr:collect, type: Function, def. @7)}
    %%   collect.data.frame:                                    {**dplyr::collect.data.frame** (id: built-in:dplyr:collect.data.frame, type: Function, def. @7)}
    %%   combine:                                               {**dplyr::combine** (id: built-in:dplyr:combine, type: Function, def. @7)}
    %%   common_by:                                             {**dplyr::common_by** (id: built-in:dplyr:common_by, type: Function, def. @7)}
    %%   common_by.character:                                   {**dplyr::common_by.character** (id: built-in:dplyr:common_by.character, type: Function, def. @7)}
    %%   common_by.default:                                     {**dplyr::common_by.default** (id: built-in:dplyr:common_by.default, type: Function, def. @7)}
    %%   common_by.list:                                        {**dplyr::common_by.list** (id: built-in:dplyr:common_by.list, type: Function, def. @7)}
    %%   common_by.NULL:                                        {**dplyr::common_by.NULL** (id: built-in:dplyr:common_by.NULL, type: Function, def. @7)}
    %%   compute:                                               {**dplyr::compute** (id: built-in:dplyr:compute, type: Function, def. @7)}
    %%   compute.data.frame:                                    {**dplyr::compute.data.frame** (id: built-in:dplyr:compute.data.frame, type: Function, def. @7)}
    %%   consecutive_id:                                        {**dplyr::consecutive_id** (id: built-in:dplyr:consecutive_id, type: Function, def. @7)}
    %%   copy_to:                                               {**dplyr::copy_to** (id: built-in:dplyr:copy_to, type: Function, def. @7)}
    %%   copy_to.DBIConnection:                                 {**dplyr::copy_to.DBIConnection** (id: built-in:dplyr:copy_to.DBIConnection, type: Function, def. @7)}
    %%   count:                                                 {**dplyr::count** (id: built-in:dplyr:count, type: Function, def. @7)}
    %%   count_:                                                {**dplyr::count_** (id: built-in:dplyr:count_, type: Function, def. @7)}
    %%   count.data.frame:                                      {**dplyr::count.data.frame** (id: built-in:dplyr:count.data.frame, type: Function, def. @7)}
    %%   cross_join:                                            {**dplyr::cross_join** (id: built-in:dplyr:cross_join, type: Function, def. @7)}
    %%   cross_join.data.frame:                                 {**dplyr::cross_join.data.frame** (id: built-in:dplyr:cross_join.data.frame, type: Function, def. @7)}
    %%   cumall:                                                {**dplyr::cumall** (id: built-in:dplyr:cumall, type: Function, def. @7)}
    %%   cumany:                                                {**dplyr::cumany** (id: built-in:dplyr:cumany, type: Function, def. @7)}
    %%   cume_dist:                                             {**dplyr::cume_dist** (id: built-in:dplyr:cume_dist, type: Function, def. @7)}
    %%   cummean:                                               {**dplyr::cummean** (id: built-in:dplyr:cummean, type: Function, def. @7)}
    %%   cur_column:                                            {**dplyr::cur_column** (id: built-in:dplyr:cur_column, type: Function, def. @7)}
    %%   cur_data:                                              {**dplyr::cur_data** (id: built-in:dplyr:cur_data, type: Function, def. @7)}
    %%   cur_data_all:                                          {**dplyr::cur_data_all** (id: built-in:dplyr:cur_data_all, type: Function, def. @7)}
    %%   cur_group:                                             {**dplyr::cur_group** (id: built-in:dplyr:cur_group, type: Function, def. @7)}
    %%   cur_group_id:                                          {**dplyr::cur_group_id** (id: built-in:dplyr:cur_group_id, type: Function, def. @7)}
    %%   cur_group_rows:                                        {**dplyr::cur_group_rows** (id: built-in:dplyr:cur_group_rows, type: Function, def. @7)}
    %%   db_analyze:                                            {**dplyr::db_analyze** (id: built-in:dplyr:db_analyze, type: Function, def. @7)}
    %%   db_begin:                                              {**dplyr::db_begin** (id: built-in:dplyr:db_begin, type: Function, def. @7)}
    %%   db_commit:                                             {**dplyr::db_commit** (id: built-in:dplyr:db_commit, type: Function, def. @7)}
    %%   db_create_index:                                       {**dplyr::db_create_index** (id: built-in:dplyr:db_create_index, type: Function, def. @7)}
    %%   db_create_indexes:                                     {**dplyr::db_create_indexes** (id: built-in:dplyr:db_create_indexes, type: Function, def. @7)}
    %%   db_create_table:                                       {**dplyr::db_create_table** (id: built-in:dplyr:db_create_table, type: Function, def. @7)}
    %%   db_data_type:                                          {**dplyr::db_data_type** (id: built-in:dplyr:db_data_type, type: Function, def. @7)}
    %%   db_desc:                                               {**dplyr::db_desc** (id: built-in:dplyr:db_desc, type: Function, def. @7)}
    %%   db_drop_table:                                         {**dplyr::db_drop_table** (id: built-in:dplyr:db_drop_table, type: Function, def. @7)}
    %%   db_explain:                                            {**dplyr::db_explain** (id: built-in:dplyr:db_explain, type: Function, def. @7)}
    %%   db_has_table:                                          {**dplyr::db_has_table** (id: built-in:dplyr:db_has_table, type: Function, def. @7)}
    %%   db_insert_into:                                        {**dplyr::db_insert_into** (id: built-in:dplyr:db_insert_into, type: Function, def. @7)}
    %%   db_list_tables:                                        {**dplyr::db_list_tables** (id: built-in:dplyr:db_list_tables, type: Function, def. @7)}
    %%   db_query_fields:                                       {**dplyr::db_query_fields** (id: built-in:dplyr:db_query_fields, type: Function, def. @7)}
    %%   db_query_rows:                                         {**dplyr::db_query_rows** (id: built-in:dplyr:db_query_rows, type: Function, def. @7)}
    %%   db_rollback:                                           {**dplyr::db_rollback** (id: built-in:dplyr:db_rollback, type: Function, def. @7)}
    %%   db_save_query:                                         {**dplyr::db_save_query** (id: built-in:dplyr:db_save_query, type: Function, def. @7)}
    %%   db_write_table:                                        {**dplyr::db_write_table** (id: built-in:dplyr:db_write_table, type: Function, def. @7)}
    %%   dense_rank:                                            {**dplyr::dense_rank** (id: built-in:dplyr:dense_rank, type: Function, def. @7)}
    %%   desc:                                                  {**dplyr::desc** (id: built-in:dplyr:desc, type: Function, def. @7)}
    %%   dim_desc:                                              {**dplyr::dim_desc** (id: built-in:dplyr:dim_desc, type: Function, def. @7)}
    %%   distinct:                                              {**dplyr::distinct** (id: built-in:dplyr:distinct, type: Function, def. @7)}
    %%   distinct_:                                             {**dplyr::distinct_** (id: built-in:dplyr:distinct_, type: Function, def. @7)}
    %%   distinct_all:                                          {**dplyr::distinct_all** (id: built-in:dplyr:distinct_all, type: Function, def. @7)}
    %%   distinct_at:                                           {**dplyr::distinct_at** (id: built-in:dplyr:distinct_at, type: Function, def. @7)}
    %%   distinct_if:                                           {**dplyr::distinct_if** (id: built-in:dplyr:distinct_if, type: Function, def. @7)}
    %%   distinct_prepare:                                      {**dplyr::distinct_prepare** (id: built-in:dplyr:distinct_prepare, type: Function, def. @7)}
    %%   distinct.data.frame:                                   {**dplyr::distinct.data.frame** (id: built-in:dplyr:distinct.data.frame, type: Function, def. @7)}
    %%   do:                                                    {**dplyr::do** (id: built-in:dplyr:do, type: Function, def. @7)}
    %%   do_:                                                   {**dplyr::do_** (id: built-in:dplyr:do_, type: Function, def. @7)}
    %%   do.data.frame:                                         {**dplyr::do.data.frame** (id: built-in:dplyr:do.data.frame, type: Function, def. @7)}
    %%   do.grouped_df:                                         {**dplyr::do.grouped_df** (id: built-in:dplyr:do.grouped_df, type: Function, def. @7)}
    %%   do.NULL:                                               {**dplyr::do.NULL** (id: built-in:dplyr:do.NULL, type: Function, def. @7)}
    %%   do.rowwise_df:                                         {**dplyr::do.rowwise_df** (id: built-in:dplyr:do.rowwise_df, type: Function, def. @7)}
    %%   dplyr_col_modify:                                      {**dplyr::dplyr_col_modify** (id: built-in:dplyr:dplyr_col_modify, type: Function, def. @7)}
    %%   dplyr_col_modify.data.frame:                           {**dplyr::dplyr_col_modify.data.frame** (id: built-in:dplyr:dplyr_col_modify.data.frame, type: Function, def. @7)}
    %%   dplyr_col_modify.grouped_df:                           {**dplyr::dplyr_col_modify.grouped_df** (id: built-in:dplyr:dplyr_col_modify.grouped_df, type: Function, def. @7)}
    %%   dplyr_col_modify.rowwise_df:                           {**dplyr::dplyr_col_modify.rowwise_df** (id: built-in:dplyr:dplyr_col_modify.rowwise_df, type: Function, def. @7)}
    %%   dplyr_reconstruct:                                     {**dplyr::dplyr_reconstruct** (id: built-in:dplyr:dplyr_reconstruct, type: Function, def. @7)}
    %%   dplyr_reconstruct.data.frame:                          {**dplyr::dplyr_reconstruct.data.frame** (id: built-in:dplyr:dplyr_reconstruct.data.frame, type: Function, def. @7)}
    %%   dplyr_reconstruct.grouped_df:                          {**dplyr::dplyr_reconstruct.grouped_df** (id: built-in:dplyr:dplyr_reconstruct.grouped_df, type: Function, def. @7)}
    %%   dplyr_reconstruct.rowwise_df:                          {**dplyr::dplyr_reconstruct.rowwise_df** (id: built-in:dplyr:dplyr_reconstruct.rowwise_df, type: Function, def. @7)}
    %%   dplyr_row_slice:                                       {**dplyr::dplyr_row_slice** (id: built-in:dplyr:dplyr_row_slice, type: Function, def. @7)}
    %%   dplyr_row_slice.data.frame:                            {**dplyr::dplyr_row_slice.data.frame** (id: built-in:dplyr:dplyr_row_slice.data.frame, type: Function, def. @7)}
    %%   dplyr_row_slice.grouped_df:                            {**dplyr::dplyr_row_slice.grouped_df** (id: built-in:dplyr:dplyr_row_slice.grouped_df, type: Function, def. @7)}
    %%   dplyr_row_slice.rowwise_df:                            {**dplyr::dplyr_row_slice.rowwise_df** (id: built-in:dplyr:dplyr_row_slice.rowwise_df, type: Function, def. @7)}
    %%   explain:                                               {**dplyr::explain** (id: built-in:dplyr:explain, type: Function, def. @7)}
    %%   filter:                                                {**dplyr::filter** (id: built-in:dplyr:filter, type: Function, def. @7)}
    %%   filter_:                                               {**dplyr::filter_** (id: built-in:dplyr:filter_, type: Function, def. @7)}
    %%   filter_all:                                            {**dplyr::filter_all** (id: built-in:dplyr:filter_all, type: Function, def. @7)}
    %%   filter_at:                                             {**dplyr::filter_at** (id: built-in:dplyr:filter_at, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_size:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_size** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_size, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_type:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_type** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_type, type: Function, def. @7)}
    %%   filter_if:                                             {**dplyr::filter_if** (id: built-in:dplyr:filter_if, type: Function, def. @7)}
    %%   filter_out:                                            {**dplyr::filter_out** (id: built-in:dplyr:filter_out, type: Function, def. @7)}
    %%   filter_out.data.frame:                                 {**dplyr::filter_out.data.frame** (id: built-in:dplyr:filter_out.data.frame, type: Function, def. @7)}
    %%   filter.data.frame:                                     {**dplyr::filter.data.frame** (id: built-in:dplyr:filter.data.frame, type: Function, def. @7)}
    %%   filter.ts:                                             {**dplyr::filter.ts** (id: built-in:dplyr:filter.ts, type: Function, def. @7)}
    %%   first:                                                 {**dplyr::first** (id: built-in:dplyr:first, type: Function, def. @7)}
    %%   full_join:                                             {**dplyr::full_join** (id: built-in:dplyr:full_join, type: Function, def. @7)}
    %%   full_join.data.frame:                                  {**dplyr::full_join.data.frame** (id: built-in:dplyr:full_join.data.frame, type: Function, def. @7)}
    %%   funs:                                                  {**dplyr::funs** (id: built-in:dplyr:funs, type: Function, def. @7)}
    %%   funs_:                                                 {**dplyr::funs_** (id: built-in:dplyr:funs_, type: Function, def. @7)}
    %%   group_by:                                              {**dplyr::group_by** (id: built-in:dplyr:group_by, type: Function, def. @7)}
    %%   group_by_:                                             {**dplyr::group_by_** (id: built-in:dplyr:group_by_, type: Function, def. @7)}
    %%   group_by_all:                                          {**dplyr::group_by_all** (id: built-in:dplyr:group_by_all, type: Function, def. @7)}
    %%   group_by_at:                                           {**dplyr::group_by_at** (id: built-in:dplyr:group_by_at, type: Function, def. @7)}
    %%   group_by_drop_default:                                 {**dplyr::group_by_drop_default** (id: built-in:dplyr:group_by_drop_default, type: Function, def. @7)}
    %%   group_by_drop_default.default:                         {**dplyr::group_by_drop_default.default** (id: built-in:dplyr:group_by_drop_default.default, type: Function, def. @7)}
    %%   group_by_drop_default.grouped_df:                      {**dplyr::group_by_drop_default.grouped_df** (id: built-in:dplyr:group_by_drop_default.grouped_df, type: Function, def. @7)}
    %%   group_by_if:                                           {**dplyr::group_by_if** (id: built-in:dplyr:group_by_if, type: Function, def. @7)}
    %%   group_by_prepare:                                      {**dplyr::group_by_prepare** (id: built-in:dplyr:group_by_prepare, type: Function, def. @7)}
    %%   group_by.data.frame:                                   {**dplyr::group_by.data.frame** (id: built-in:dplyr:group_by.data.frame, type: Function, def. @7)}
    %%   group_cols:                                            {**dplyr::group_cols** (id: built-in:dplyr:group_cols, type: Function, def. @7)}
    %%   group_data:                                            {**dplyr::group_data** (id: built-in:dplyr:group_data, type: Function, def. @7)}
    %%   group_data.data.frame:                                 {**dplyr::group_data.data.frame** (id: built-in:dplyr:group_data.data.frame, type: Function, def. @7)}
    %%   group_data.grouped_df:                                 {**dplyr::group_data.grouped_df** (id: built-in:dplyr:group_data.grouped_df, type: Function, def. @7)}
    %%   group_data.rowwise_df:                                 {**dplyr::group_data.rowwise_df** (id: built-in:dplyr:group_data.rowwise_df, type: Function, def. @7)}
    %%   group_data.tbl_df:                                     {**dplyr::group_data.tbl_df** (id: built-in:dplyr:group_data.tbl_df, type: Function, def. @7)}
    %%   group_indices:                                         {**dplyr::group_indices** (id: built-in:dplyr:group_indices, type: Function, def. @7)}
    %%   group_indices_:                                        {**dplyr::group_indices_** (id: built-in:dplyr:group_indices_, type: Function, def. @7)}
    %%   group_indices.data.frame:                              {**dplyr::group_indices.data.frame** (id: built-in:dplyr:group_indices.data.frame, type: Function, def. @7)}
    %%   group_keys:                                            {**dplyr::group_keys** (id: built-in:dplyr:group_keys, type: Function, def. @7)}
    %%   group_keys.data.frame:                                 {**dplyr::group_keys.data.frame** (id: built-in:dplyr:group_keys.data.frame, type: Function, def. @7)}
    %%   group_map:                                             {**dplyr::group_map** (id: built-in:dplyr:group_map, type: Function, def. @7)}
    %%   group_map.data.frame:                                  {**dplyr::group_map.data.frame** (id: built-in:dplyr:group_map.data.frame, type: Function, def. @7)}
    %%   group_modify:                                          {**dplyr::group_modify** (id: built-in:dplyr:group_modify, type: Function, def. @7)}
    %%   group_modify.data.frame:                               {**dplyr::group_modify.data.frame** (id: built-in:dplyr:group_modify.data.frame, type: Function, def. @7)}
    %%   group_modify.grouped_df:                               {**dplyr::group_modify.grouped_df** (id: built-in:dplyr:group_modify.grouped_df, type: Function, def. @7)}
    %%   group_nest:                                            {**dplyr::group_nest** (id: built-in:dplyr:group_nest, type: Function, def. @7)}
    %%   group_nest.data.frame:                                 {**dplyr::group_nest.data.frame** (id: built-in:dplyr:group_nest.data.frame, type: Function, def. @7)}
    %%   group_nest.grouped_df:                                 {**dplyr::group_nest.grouped_df** (id: built-in:dplyr:group_nest.grouped_df, type: Function, def. @7)}
    %%   group_rows:                                            {**dplyr::group_rows** (id: built-in:dplyr:group_rows, type: Function, def. @7)}
    %%   group_size:                                            {**dplyr::group_size** (id: built-in:dplyr:group_size, type: Function, def. @7)}
    %%   group_size.data.frame:                                 {**dplyr::group_size.data.frame** (id: built-in:dplyr:group_size.data.frame, type: Function, def. @7)}
    %%   group_split:                                           {**dplyr::group_split** (id: built-in:dplyr:group_split, type: Function, def. @7)}
    %%   group_split.data.frame:                                {**dplyr::group_split.data.frame** (id: built-in:dplyr:group_split.data.frame, type: Function, def. @7)}
    %%   group_split.grouped_df:                                {**dplyr::group_split.grouped_df** (id: built-in:dplyr:group_split.grouped_df, type: Function, def. @7)}
    %%   group_split.rowwise_df:                                {**dplyr::group_split.rowwise_df** (id: built-in:dplyr:group_split.rowwise_df, type: Function, def. @7)}
    %%   group_trim:                                            {**dplyr::group_trim** (id: built-in:dplyr:group_trim, type: Function, def. @7)}
    %%   group_trim.data.frame:                                 {**dplyr::group_trim.data.frame** (id: built-in:dplyr:group_trim.data.frame, type: Function, def. @7)}
    %%   group_trim.grouped_df:                                 {**dplyr::group_trim.grouped_df** (id: built-in:dplyr:group_trim.grouped_df, type: Function, def. @7)}
    %%   group_vars:                                            {**dplyr::group_vars** (id: built-in:dplyr:group_vars, type: Function, def. @7)}
    %%   group_vars.data.frame:                                 {**dplyr::group_vars.data.frame** (id: built-in:dplyr:group_vars.data.frame, type: Function, def. @7)}
    %%   group_walk:                                            {**dplyr::group_walk** (id: built-in:dplyr:group_walk, type: Function, def. @7)}
    %%   grouped_df:                                            {**dplyr::grouped_df** (id: built-in:dplyr:grouped_df, type: Function, def. @7)}
    %%   groups:                                                {**dplyr::groups** (id: built-in:dplyr:groups, type: Function, def. @7)}
    %%   groups.data.frame:                                     {**dplyr::groups.data.frame** (id: built-in:dplyr:groups.data.frame, type: Function, def. @7)}
    %%   ident:                                                 {**dplyr::ident** (id: built-in:dplyr:ident, type: Function, def. @7)}
    %%   if_all:                                                {**dplyr::if_all** (id: built-in:dplyr:if_all, type: Function, def. @7)}
    %%   if_any:                                                {**dplyr::if_any** (id: built-in:dplyr:if_any, type: Function, def. @7)}
    %%   if_else:                                               {**dplyr::if_else** (id: built-in:dplyr:if_else, type: Function, def. @7)}
    %%   inner_join:                                            {**dplyr::inner_join** (id: built-in:dplyr:inner_join, type: Function, def. @7)}
    %%   inner_join.data.frame:                                 {**dplyr::inner_join.data.frame** (id: built-in:dplyr:inner_join.data.frame, type: Function, def. @7)}
    %%   intersect.data.frame:                                  {**dplyr::intersect.data.frame** (id: built-in:dplyr:intersect.data.frame, type: Function, def. @7)}
    %%   is_grouped_df:                                         {**dplyr::is_grouped_df** (id: built-in:dplyr:is_grouped_df, type: Function, def. @7)}
    %%   is.grouped_df:                                         {**dplyr::is.grouped_df** (id: built-in:dplyr:is.grouped_df, type: Function, def. @7)}
    %%   is.src:                                                {**dplyr::is.src** (id: built-in:dplyr:is.src, type: Function, def. @7)}
    %%   is.tbl:                                                {**dplyr::is.tbl** (id: built-in:dplyr:is.tbl, type: Function, def. @7)}
    %%   join_by:                                               {**dplyr::join_by** (id: built-in:dplyr:join_by, type: Function, def. @7)}
    %%   lag:                                                   {**dplyr::lag** (id: built-in:dplyr:lag, type: Function, def. @7)}
    %%   last:                                                  {**dplyr::last** (id: built-in:dplyr:last, type: Function, def. @7)}
    %%   last_dplyr_warnings:                                   {**dplyr::last_dplyr_warnings** (id: built-in:dplyr:last_dplyr_warnings, type: Function, def. @7)}
    %%   lead:                                                  {**dplyr::lead** (id: built-in:dplyr:lead, type: Function, def. @7)}
    %%   left_join:                                             {**dplyr::left_join** (id: built-in:dplyr:left_join, type: Function, def. @7)}
    %%   left_join.data.frame:                                  {**dplyr::left_join.data.frame** (id: built-in:dplyr:left_join.data.frame, type: Function, def. @7)}
    %%   make_tbl:                                              {**dplyr::make_tbl** (id: built-in:dplyr:make_tbl, type: Function, def. @7)}
    %%   min_rank:                                              {**dplyr::min_rank** (id: built-in:dplyr:min_rank, type: Function, def. @7)}
    %%   mutate:                                                {**dplyr::mutate** (id: built-in:dplyr:mutate, type: Function, def. @7)}
    %%   mutate_:                                               {**dplyr::mutate_** (id: built-in:dplyr:mutate_, type: Function, def. @7)}
    %%   mutate_all:                                            {**dplyr::mutate_all** (id: built-in:dplyr:mutate_all, type: Function, def. @7)}
    %%   mutate_at:                                             {**dplyr::mutate_at** (id: built-in:dplyr:mutate_at, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::error_incompatible_combine:     {**dplyr::mutate_bullets.dplyr:::error_incompatible_combine** (id: built-in:dplyr:mutate_bullets.dplyr:::error_incompatible_combine, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_constant_recycle_error:  {**dplyr::mutate_bullets.dplyr:::mutate_constant_recycle_error** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_constant_recycle_error, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_incompatible_size:       {**dplyr::mutate_bullets.dplyr:::mutate_incompatible_size** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_incompatible_size, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_mixed_null:              {**dplyr::mutate_bullets.dplyr:::mutate_mixed_null** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_mixed_null, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_not_vector:              {**dplyr::mutate_bullets.dplyr:::mutate_not_vector** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_not_vector, type: Function, def. @7)}
    %%   mutate_each:                                           {**dplyr::mutate_each** (id: built-in:dplyr:mutate_each, type: Function, def. @7)}
    %%   mutate_each_:                                          {**dplyr::mutate_each_** (id: built-in:dplyr:mutate_each_, type: Function, def. @7)}
    %%   mutate_if:                                             {**dplyr::mutate_if** (id: built-in:dplyr:mutate_if, type: Function, def. @7)}
    %%   mutate.data.frame:                                     {**dplyr::mutate.data.frame** (id: built-in:dplyr:mutate.data.frame, type: Function, def. @7)}
    %%   n:                                                     {**dplyr::n** (id: built-in:dplyr:n, type: Function, def. @7)}
    %%   n_distinct:                                            {**dplyr::n_distinct** (id: built-in:dplyr:n_distinct, type: Function, def. @7)}
    %%   n_groups:                                              {**dplyr::n_groups** (id: built-in:dplyr:n_groups, type: Function, def. @7)}
    %%   n_groups.data.frame:                                   {**dplyr::n_groups.data.frame** (id: built-in:dplyr:n_groups.data.frame, type: Function, def. @7)}
    %%   na_if:                                                 {**dplyr::na_if** (id: built-in:dplyr:na_if, type: Function, def. @7)}
    %%   names<-.grouped_df:                                    {**dplyr::names<-.grouped_df** (id: built-in:dplyr:names<-.grouped_df, type: Function, def. @7)}
    %%   names<-.rowwise_df:                                    {**dplyr::names<-.rowwise_df** (id: built-in:dplyr:names<-.rowwise_df, type: Function, def. @7)}
    %%   near:                                                  {**dplyr::near** (id: built-in:dplyr:near, type: Function, def. @7)}
    %%   nest_by:                                               {**dplyr::nest_by** (id: built-in:dplyr:nest_by, type: Function, def. @7)}
    %%   nest_by.data.frame:                                    {**dplyr::nest_by.data.frame** (id: built-in:dplyr:nest_by.data.frame, type: Function, def. @7)}
    %%   nest_by.grouped_df:                                    {**dplyr::nest_by.grouped_df** (id: built-in:dplyr:nest_by.grouped_df, type: Function, def. @7)}
    %%   nest_join:                                             {**dplyr::nest_join** (id: built-in:dplyr:nest_join, type: Function, def. @7)}
    %%   nest_join.data.frame:                                  {**dplyr::nest_join.data.frame** (id: built-in:dplyr:nest_join.data.frame, type: Function, def. @7)}
    %%   new_grouped_df:                                        {**dplyr::new_grouped_df** (id: built-in:dplyr:new_grouped_df, type: Function, def. @7)}
    %%   new_rowwise_df:                                        {**dplyr::new_rowwise_df** (id: built-in:dplyr:new_rowwise_df, type: Function, def. @7)}
    %%   nth:                                                   {**dplyr::nth** (id: built-in:dplyr:nth, type: Function, def. @7)}
    %%   ntile:                                                 {**dplyr::ntile** (id: built-in:dplyr:ntile, type: Function, def. @7)}
    %%   order_by:                                              {**dplyr::order_by** (id: built-in:dplyr:order_by, type: Function, def. @7)}
    %%   percent_rank:                                          {**dplyr::percent_rank** (id: built-in:dplyr:percent_rank, type: Function, def. @7)}
    %%   pick:                                                  {**dplyr::pick** (id: built-in:dplyr:pick, type: Function, def. @7)}
    %%   print.all_vars:                                        {**dplyr::print.all_vars** (id: built-in:dplyr:print.all_vars, type: Function, def. @7)}
    %%   print.any_vars:                                        {**dplyr::print.any_vars** (id: built-in:dplyr:print.any_vars, type: Function, def. @7)}
    %%   print.dplyr_join_by:                                   {**dplyr::print.dplyr_join_by** (id: built-in:dplyr:print.dplyr_join_by, type: Function, def. @7)}
    %%   print.dplyr_sel_vars:                                  {**dplyr::print.dplyr_sel_vars** (id: built-in:dplyr:print.dplyr_sel_vars, type: Function, def. @7)}
    %%   print.fun_list:                                        {**dplyr::print.fun_list** (id: built-in:dplyr:print.fun_list, type: Function, def. @7)}
    %%   print.last_dplyr_warnings:                             {**dplyr::print.last_dplyr_warnings** (id: built-in:dplyr:print.last_dplyr_warnings, type: Function, def. @7)}
    %%   print.src:                                             {**dplyr::print.src** (id: built-in:dplyr:print.src, type: Function, def. @7)}
    %%   progress_estimated:                                    {**dplyr::progress_estimated** (id: built-in:dplyr:progress_estimated, type: Function, def. @7)}
    %%   pull:                                                  {**dplyr::pull** (id: built-in:dplyr:pull, type: Function, def. @7)}
    %%   pull.data.frame:                                       {**dplyr::pull.data.frame** (id: built-in:dplyr:pull.data.frame, type: Function, def. @7)}
    %%   rbind.grouped_df:                                      {**dplyr::rbind.grouped_df** (id: built-in:dplyr:rbind.grouped_df, type: Function, def. @7)}
    %%   rbind.rowwise_df:                                      {**dplyr::rbind.rowwise_df** (id: built-in:dplyr:rbind.rowwise_df, type: Function, def. @7)}
    %%   recode:                                                {**dplyr::recode** (id: built-in:dplyr:recode, type: Function, def. @7)}
    %%   recode_default.default:                                {**dplyr::recode_default.default** (id: built-in:dplyr:recode_default.default, type: Function, def. @7)}
    %%   recode_default.factor:                                 {**dplyr::recode_default.factor** (id: built-in:dplyr:recode_default.factor, type: Function, def. @7)}
    %%   recode_factor:                                         {**dplyr::recode_factor** (id: built-in:dplyr:recode_factor, type: Function, def. @7)}
    %%   recode_values:                                         {**dplyr::recode_values** (id: built-in:dplyr:recode_values, type: Function, def. @7)}
    %%   recode.character:                                      {**dplyr::recode.character** (id: built-in:dplyr:recode.character, type: Function, def. @7)}
    %%   recode.factor:                                         {**dplyr::recode.factor** (id: built-in:dplyr:recode.factor, type: Function, def. @7)}
    %%   recode.numeric:                                        {**dplyr::recode.numeric** (id: built-in:dplyr:recode.numeric, type: Function, def. @7)}
    %%   reframe:                                               {**dplyr::reframe** (id: built-in:dplyr:reframe, type: Function, def. @7)}
    %%   reframe.data.frame:                                    {**dplyr::reframe.data.frame** (id: built-in:dplyr:reframe.data.frame, type: Function, def. @7)}
    %%   relocate:                                              {**dplyr::relocate** (id: built-in:dplyr:relocate, type: Function, def. @7)}
    %%   relocate.data.frame:                                   {**dplyr::relocate.data.frame** (id: built-in:dplyr:relocate.data.frame, type: Function, def. @7)}
    %%   rename:                                                {**dplyr::rename** (id: built-in:dplyr:rename, type: Function, def. @7)}
    %%   rename_:                                               {**dplyr::rename_** (id: built-in:dplyr:rename_, type: Function, def. @7)}
    %%   rename_all:                                            {**dplyr::rename_all** (id: built-in:dplyr:rename_all, type: Function, def. @7)}
    %%   rename_at:                                             {**dplyr::rename_at** (id: built-in:dplyr:rename_at, type: Function, def. @7)}
    %%   rename_if:                                             {**dplyr::rename_if** (id: built-in:dplyr:rename_if, type: Function, def. @7)}
    %%   rename_with:                                           {**dplyr::rename_with** (id: built-in:dplyr:rename_with, type: Function, def. @7)}
    %%   rename_with.data.frame:                                {**dplyr::rename_with.data.frame** (id: built-in:dplyr:rename_with.data.frame, type: Function, def. @7)}
    %%   rename.data.frame:                                     {**dplyr::rename.data.frame** (id: built-in:dplyr:rename.data.frame, type: Function, def. @7)}
    %%   replace_values:                                        {**dplyr::replace_values** (id: built-in:dplyr:replace_values, type: Function, def. @7)}
    %%   replace_when:                                          {**dplyr::replace_when** (id: built-in:dplyr:replace_when, type: Function, def. @7)}
    %%   right_join:                                            {**dplyr::right_join** (id: built-in:dplyr:right_join, type: Function, def. @7)}
    %%   right_join.data.frame:                                 {**dplyr::right_join.data.frame** (id: built-in:dplyr:right_join.data.frame, type: Function, def. @7)}
    %%   row_number:                                            {**dplyr::row_number** (id: built-in:dplyr:row_number, type: Function, def. @7)}
    %%   rows_append:                                           {**dplyr::rows_append** (id: built-in:dplyr:rows_append, type: Function, def. @7)}
    %%   rows_append.data.frame:                                {**dplyr::rows_append.data.frame** (id: built-in:dplyr:rows_append.data.frame, type: Function, def. @7)}
    %%   rows_delete:                                           {**dplyr::rows_delete** (id: built-in:dplyr:rows_delete, type: Function, def. @7)}
    %%   rows_delete.data.frame:                                {**dplyr::rows_delete.data.frame** (id: built-in:dplyr:rows_delete.data.frame, type: Function, def. @7)}
    %%   rows_insert:                                           {**dplyr::rows_insert** (id: built-in:dplyr:rows_insert, type: Function, def. @7)}
    %%   rows_insert.data.frame:                                {**dplyr::rows_insert.data.frame** (id: built-in:dplyr:rows_insert.data.frame, type: Function, def. @7)}
    %%   rows_patch:                                            {**dplyr::rows_patch** (id: built-in:dplyr:rows_patch, type: Function, def. @7)}
    %%   rows_patch.data.frame:                                 {**dplyr::rows_patch.data.frame** (id: built-in:dplyr:rows_patch.data.frame, type: Function, def. @7)}
    %%   rows_update:                                           {**dplyr::rows_update** (id: built-in:dplyr:rows_update, type: Function, def. @7)}
    %%   rows_update.data.frame:                                {**dplyr::rows_update.data.frame** (id: built-in:dplyr:rows_update.data.frame, type: Function, def. @7)}
    %%   rows_upsert:                                           {**dplyr::rows_upsert** (id: built-in:dplyr:rows_upsert, type: Function, def. @7)}
    %%   rows_upsert.data.frame:                                {**dplyr::rows_upsert.data.frame** (id: built-in:dplyr:rows_upsert.data.frame, type: Function, def. @7)}
    %%   rowwise:                                               {**dplyr::rowwise** (id: built-in:dplyr:rowwise, type: Function, def. @7)}
    %%   rowwise.data.frame:                                    {**dplyr::rowwise.data.frame** (id: built-in:dplyr:rowwise.data.frame, type: Function, def. @7)}
    %%   rowwise.grouped_df:                                    {**dplyr::rowwise.grouped_df** (id: built-in:dplyr:rowwise.grouped_df, type: Function, def. @7)}
    %%   same_src:                                              {**dplyr::same_src** (id: built-in:dplyr:same_src, type: Function, def. @7)}
    %%   same_src.data.frame:                                   {**dplyr::same_src.data.frame** (id: built-in:dplyr:same_src.data.frame, type: Function, def. @7)}
    %%   sample_frac:                                           {**dplyr::sample_frac** (id: built-in:dplyr:sample_frac, type: Function, def. @7)}
    %%   sample_frac.data.frame:                                {**dplyr::sample_frac.data.frame** (id: built-in:dplyr:sample_frac.data.frame, type: Function, def. @7)}
    %%   sample_frac.default:                                   {**dplyr::sample_frac.default** (id: built-in:dplyr:sample_frac.default, type: Function, def. @7)}
    %%   sample_n:                                              {**dplyr::sample_n** (id: built-in:dplyr:sample_n, type: Function, def. @7)}
    %%   sample_n.data.frame:                                   {**dplyr::sample_n.data.frame** (id: built-in:dplyr:sample_n.data.frame, type: Function, def. @7)}
    %%   sample_n.default:                                      {**dplyr::sample_n.default** (id: built-in:dplyr:sample_n.default, type: Function, def. @7)}
    %%   select:                                                {**dplyr::select** (id: built-in:dplyr:select, type: Function, def. @7)}
    %%   select_:                                               {**dplyr::select_** (id: built-in:dplyr:select_, type: Function, def. @7)}
    %%   select_all:                                            {**dplyr::select_all** (id: built-in:dplyr:select_all, type: Function, def. @7)}
    %%   select_at:                                             {**dplyr::select_at** (id: built-in:dplyr:select_at, type: Function, def. @7)}
    %%   select_if:                                             {**dplyr::select_if** (id: built-in:dplyr:select_if, type: Function, def. @7)}
    %%   select.data.frame:                                     {**dplyr::select.data.frame** (id: built-in:dplyr:select.data.frame, type: Function, def. @7)}
    %%   select.list:                                           {**dplyr::select.list** (id: built-in:dplyr:select.list, type: Function, def. @7)}
    %%   semi_join:                                             {**dplyr::semi_join** (id: built-in:dplyr:semi_join, type: Function, def. @7)}
    %%   semi_join.data.frame:                                  {**dplyr::semi_join.data.frame** (id: built-in:dplyr:semi_join.data.frame, type: Function, def. @7)}
    %%   setdiff.data.frame:                                    {**dplyr::setdiff.data.frame** (id: built-in:dplyr:setdiff.data.frame, type: Function, def. @7)}
    %%   setequal.data.frame:                                   {**dplyr::setequal.data.frame** (id: built-in:dplyr:setequal.data.frame, type: Function, def. @7)}
    %%   show_query:                                            {**dplyr::show_query** (id: built-in:dplyr:show_query, type: Function, def. @7)}
    %%   slice:                                                 {**dplyr::slice** (id: built-in:dplyr:slice, type: Function, def. @7)}
    %%   slice_:                                                {**dplyr::slice_** (id: built-in:dplyr:slice_, type: Function, def. @7)}
    %%   slice_head:                                            {**dplyr::slice_head** (id: built-in:dplyr:slice_head, type: Function, def. @7)}
    %%   slice_head.data.frame:                                 {**dplyr::slice_head.data.frame** (id: built-in:dplyr:slice_head.data.frame, type: Function, def. @7)}
    %%   slice_max:                                             {**dplyr::slice_max** (id: built-in:dplyr:slice_max, type: Function, def. @7)}
    %%   slice_max.data.frame:                                  {**dplyr::slice_max.data.frame** (id: built-in:dplyr:slice_max.data.frame, type: Function, def. @7)}
    %%   slice_min:                                             {**dplyr::slice_min** (id: built-in:dplyr:slice_min, type: Function, def. @7)}
    %%   slice_min.data.frame:                                  {**dplyr::slice_min.data.frame** (id: built-in:dplyr:slice_min.data.frame, type: Function, def. @7)}
    %%   slice_sample:                                          {**dplyr::slice_sample** (id: built-in:dplyr:slice_sample, type: Function, def. @7)}
    %%   slice_sample.data.frame:                               {**dplyr::slice_sample.data.frame** (id: built-in:dplyr:slice_sample.data.frame, type: Function, def. @7)}
    %%   slice_tail:                                            {**dplyr::slice_tail** (id: built-in:dplyr:slice_tail, type: Function, def. @7)}
    %%   slice_tail.data.frame:                                 {**dplyr::slice_tail.data.frame** (id: built-in:dplyr:slice_tail.data.frame, type: Function, def. @7)}
    %%   slice.data.frame:                                      {**dplyr::slice.data.frame** (id: built-in:dplyr:slice.data.frame, type: Function, def. @7)}
    %%   sql:                                                   {**dplyr::sql** (id: built-in:dplyr:sql, type: Function, def. @7)}
    %%   sql_escape_ident:                                      {**dplyr::sql_escape_ident** (id: built-in:dplyr:sql_escape_ident, type: Function, def. @7)}
    %%   sql_escape_string:                                     {**dplyr::sql_escape_string** (id: built-in:dplyr:sql_escape_string, type: Function, def. @7)}
    %%   sql_join:                                              {**dplyr::sql_join** (id: built-in:dplyr:sql_join, type: Function, def. @7)}
    %%   sql_select:                                            {**dplyr::sql_select** (id: built-in:dplyr:sql_select, type: Function, def. @7)}
    %%   sql_semi_join:                                         {**dplyr::sql_semi_join** (id: built-in:dplyr:sql_semi_join, type: Function, def. @7)}
    %%   sql_set_op:                                            {**dplyr::sql_set_op** (id: built-in:dplyr:sql_set_op, type: Function, def. @7)}
    %%   sql_subquery:                                          {**dplyr::sql_subquery** (id: built-in:dplyr:sql_subquery, type: Function, def. @7)}
    %%   sql_translate_env:                                     {**dplyr::sql_translate_env** (id: built-in:dplyr:sql_translate_env, type: Function, def. @7)}
    %%   src:                                                   {**dplyr::src** (id: built-in:dplyr:src, type: Function, def. @7)}
    %%   src_df:                                                {**dplyr::src_df** (id: built-in:dplyr:src_df, type: Function, def. @7)}
    %%   src_local:                                             {**dplyr::src_local** (id: built-in:dplyr:src_local, type: Function, def. @7)}
    %%   src_mysql:                                             {**dplyr::src_mysql** (id: built-in:dplyr:src_mysql, type: Function, def. @7)}
    %%   src_postgres:                                          {**dplyr::src_postgres** (id: built-in:dplyr:src_postgres, type: Function, def. @7)}
    %%   src_sqlite:                                            {**dplyr::src_sqlite** (id: built-in:dplyr:src_sqlite, type: Function, def. @7)}
    %%   src_tbls:                                              {**dplyr::src_tbls** (id: built-in:dplyr:src_tbls, type: Function, def. @7)}
    %%   summarise:                                             {**dplyr::summarise** (id: built-in:dplyr:summarise, type: Function, def. @7)}
    %%   summarise_:                                            {**dplyr::summarise_** (id: built-in:dplyr:summarise_, type: Function, def. @7)}
    %%   summarise_all:                                         {**dplyr::summarise_all** (id: built-in:dplyr:summarise_all, type: Function, def. @7)}
    %%   summarise_at:                                          {**dplyr::summarise_at** (id: built-in:dplyr:summarise_at, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::reframe_incompatible_size:   {**dplyr::summarise_bullets.dplyr:::reframe_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::reframe_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_incompatible_size: {**dplyr::summarise_bullets.dplyr:::summarise_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_mixed_null:        {**dplyr::summarise_bullets.dplyr:::summarise_mixed_null** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_mixed_null, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_unsupported_type:  {**dplyr::summarise_bullets.dplyr:::summarise_unsupported_type** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_unsupported_type, type: Function, def. @7)}
    %%   summarise_each:                                        {**dplyr::summarise_each** (id: built-in:dplyr:summarise_each, type: Function, def. @7)}
    %%   summarise_each_:                                       {**dplyr::summarise_each_** (id: built-in:dplyr:summarise_each_, type: Function, def. @7)}
    %%   summarise_if:                                          {**dplyr::summarise_if** (id: built-in:dplyr:summarise_if, type: Function, def. @7)}
    %%   summarise.data.frame:                                  {**dplyr::summarise.data.frame** (id: built-in:dplyr:summarise.data.frame, type: Function, def. @7)}
    %%   summarise.grouped_df:                                  {**dplyr::summarise.grouped_df** (id: built-in:dplyr:summarise.grouped_df, type: Function, def. @7)}
    %%   summarise.rowwise_df:                                  {**dplyr::summarise.rowwise_df** (id: built-in:dplyr:summarise.rowwise_df, type: Function, def. @7)}
    %%   summarize:                                             {**dplyr::summarize** (id: built-in:dplyr:summarize, type: Function, def. @7)}
    %%   summarize_:                                            {**dplyr::summarize_** (id: built-in:dplyr:summarize_, type: Function, def. @7)}
    %%   summarize_all:                                         {**dplyr::summarize_all** (id: built-in:dplyr:summarize_all, type: Function, def. @7)}
    %%   summarize_at:                                          {**dplyr::summarize_at** (id: built-in:dplyr:summarize_at, type: Function, def. @7)}
    %%   summarize_each:                                        {**dplyr::summarize_each** (id: built-in:dplyr:summarize_each, type: Function, def. @7)}
    %%   summarize_each_:                                       {**dplyr::summarize_each_** (id: built-in:dplyr:summarize_each_, type: Function, def. @7)}
    %%   summarize_if:                                          {**dplyr::summarize_if** (id: built-in:dplyr:summarize_if, type: Function, def. @7)}
    %%   symdiff:                                               {**dplyr::symdiff** (id: built-in:dplyr:symdiff, type: Function, def. @7)}
    %%   symdiff.data.frame:                                    {**dplyr::symdiff.data.frame** (id: built-in:dplyr:symdiff.data.frame, type: Function, def. @7)}
    %%   symdiff.default:                                       {**dplyr::symdiff.default** (id: built-in:dplyr:symdiff.default, type: Function, def. @7)}
    %%   tally:                                                 {**dplyr::tally** (id: built-in:dplyr:tally, type: Function, def. @7)}
    %%   tally_:                                                {**dplyr::tally_** (id: built-in:dplyr:tally_, type: Function, def. @7)}
    %%   tally.data.frame:                                      {**dplyr::tally.data.frame** (id: built-in:dplyr:tally.data.frame, type: Function, def. @7)}
    %%   tbl:                                                   {**dplyr::tbl** (id: built-in:dplyr:tbl, type: Function, def. @7)}
    %%   tbl_df:                                                {**dplyr::tbl_df** (id: built-in:dplyr:tbl_df, type: Function, def. @7)}
    %%   tbl_nongroup_vars:                                     {**dplyr::tbl_nongroup_vars** (id: built-in:dplyr:tbl_nongroup_vars, type: Function, def. @7)}
    %%   tbl_ptype:                                             {**dplyr::tbl_ptype** (id: built-in:dplyr:tbl_ptype, type: Function, def. @7)}
    %%   tbl_ptype.default:                                     {**dplyr::tbl_ptype.default** (id: built-in:dplyr:tbl_ptype.default, type: Function, def. @7)}
    %%   tbl_sum.grouped_df:                                    {**dplyr::tbl_sum.grouped_df** (id: built-in:dplyr:tbl_sum.grouped_df, type: Function, def. @7)}
    %%   tbl_sum.rowwise_df:                                    {**dplyr::tbl_sum.rowwise_df** (id: built-in:dplyr:tbl_sum.rowwise_df, type: Function, def. @7)}
    %%   tbl_vars:                                              {**dplyr::tbl_vars** (id: built-in:dplyr:tbl_vars, type: Function, def. @7)}
    %%   tbl_vars.data.frame:                                   {**dplyr::tbl_vars.data.frame** (id: built-in:dplyr:tbl_vars.data.frame, type: Function, def. @7)}
    %%   tbl.DBIConnection:                                     {**dplyr::tbl.DBIConnection** (id: built-in:dplyr:tbl.DBIConnection, type: Function, def. @7)}
    %%   top_frac:                                              {**dplyr::top_frac** (id: built-in:dplyr:top_frac, type: Function, def. @7)}
    %%   top_n:                                                 {**dplyr::top_n** (id: built-in:dplyr:top_n, type: Function, def. @7)}
    %%   transmute:                                             {**dplyr::transmute** (id: built-in:dplyr:transmute, type: Function, def. @7)}
    %%   transmute_:                                            {**dplyr::transmute_** (id: built-in:dplyr:transmute_, type: Function, def. @7)}
    %%   transmute_all:                                         {**dplyr::transmute_all** (id: built-in:dplyr:transmute_all, type: Function, def. @7)}
    %%   transmute_at:                                          {**dplyr::transmute_at** (id: built-in:dplyr:transmute_at, type: Function, def. @7)}
    %%   transmute_if:                                          {**dplyr::transmute_if** (id: built-in:dplyr:transmute_if, type: Function, def. @7)}
    %%   transmute.data.frame:                                  {**dplyr::transmute.data.frame** (id: built-in:dplyr:transmute.data.frame, type: Function, def. @7)}
    %%   ungroup:                                               {**dplyr::ungroup** (id: built-in:dplyr:ungroup, type: Function, def. @7)}
    %%   ungroup.data.frame:                                    {**dplyr::ungroup.data.frame** (id: built-in:dplyr:ungroup.data.frame, type: Function, def. @7)}
    %%   ungroup.grouped_df:                                    {**dplyr::ungroup.grouped_df** (id: built-in:dplyr:ungroup.grouped_df, type: Function, def. @7)}
    %%   ungroup.rowwise_df:                                    {**dplyr::ungroup.rowwise_df** (id: built-in:dplyr:ungroup.rowwise_df, type: Function, def. @7)}
    %%   union_all:                                             {**dplyr::union_all** (id: built-in:dplyr:union_all, type: Function, def. @7)}
    %%   union_all.data.frame:                                  {**dplyr::union_all.data.frame** (id: built-in:dplyr:union_all.data.frame, type: Function, def. @7)}
    %%   union_all.default:                                     {**dplyr::union_all.default** (id: built-in:dplyr:union_all.default, type: Function, def. @7)}
    %%   union.data.frame:                                      {**dplyr::union.data.frame** (id: built-in:dplyr:union.data.frame, type: Function, def. @7)}
    %%   validate_grouped_df:                                   {**dplyr::validate_grouped_df** (id: built-in:dplyr:validate_grouped_df, type: Function, def. @7)}
    %%   validate_rowwise_df:                                   {**dplyr::validate_rowwise_df** (id: built-in:dplyr:validate_rowwise_df, type: Function, def. @7)}
    %%   vars:                                                  {**dplyr::vars** (id: built-in:dplyr:vars, type: Function, def. @7)}
    %%   when_all:                                              {**dplyr::when_all** (id: built-in:dplyr:when_all, type: Function, def. @7)}
    %%   when_any:                                              {**dplyr::when_any** (id: built-in:dplyr:when_any, type: Function, def. @7)}
    %%   with_groups:                                           {**dplyr::with_groups** (id: built-in:dplyr:with_groups, type: Function, def. @7)}
    %%   with_order:                                            {**dplyr::with_order** (id: built-in:dplyr:with_order, type: Function, def. @7)}
    %%   wrap_dbplyr_obj:                                       {**dplyr::wrap_dbplyr_obj** (id: built-in:dplyr:wrap_dbplyr_obj, type: Function, def. @7)}
    %%   %>%:                                                   {**dplyr::%>%** (id: built-in:dplyr:%>%, type: Function, def. @7)}
    %%   add_row:                                               {**dplyr::add_row** (id: built-in:dplyr:add_row, type: Function, def. @7)}
    %%   all_of:                                                {**dplyr::all_of** (id: built-in:dplyr:all_of, type: Function, def. @7)}
    %%   any_of:                                                {**dplyr::any_of** (id: built-in:dplyr:any_of, type: Function, def. @7)}
    %%   as_data_frame:                                         {**dplyr::as_data_frame** (id: built-in:dplyr:as_data_frame, type: Function, def. @7)}
    %%   as_label:                                              {**dplyr::as_label** (id: built-in:dplyr:as_label, type: Function, def. @7)}
    %%   as_tibble:                                             {**dplyr::as_tibble** (id: built-in:dplyr:as_tibble, type: Function, def. @7)}
    %%   contains:                                              {**dplyr::contains** (id: built-in:dplyr:contains, type: Function, def. @7)}
    %%   data_frame:                                            {**dplyr::data_frame** (id: built-in:dplyr:data_frame, type: Function, def. @7)}
    %%   ends_with:                                             {**dplyr::ends_with** (id: built-in:dplyr:ends_with, type: Function, def. @7)}
    %%   enexpr:                                                {**dplyr::enexpr** (id: built-in:dplyr:enexpr, type: Function, def. @7)}
    %%   enexprs:                                               {**dplyr::enexprs** (id: built-in:dplyr:enexprs, type: Function, def. @7)}
    %%   enquo:                                                 {**dplyr::enquo** (id: built-in:dplyr:enquo, type: Function, def. @7)}
    %%   enquos:                                                {**dplyr::enquos** (id: built-in:dplyr:enquos, type: Function, def. @7)}
    %%   ensym:                                                 {**dplyr::ensym** (id: built-in:dplyr:ensym, type: Function, def. @7)}
    %%   ensyms:                                                {**dplyr::ensyms** (id: built-in:dplyr:ensyms, type: Function, def. @7)}
    %%   everything:                                            {**dplyr::everything** (id: built-in:dplyr:everything, type: Function, def. @7)}
    %%   expr:                                                  {**dplyr::expr** (id: built-in:dplyr:expr, type: Function, def. @7)}
    %%   glimpse:                                               {**dplyr::glimpse** (id: built-in:dplyr:glimpse, type: Function, def. @7)}
    %%   intersect:                                             {**dplyr::intersect** (id: built-in:dplyr:intersect, type: Function, def. @7)}
    %%   last_col:                                              {**dplyr::last_col** (id: built-in:dplyr:last_col, type: Function, def. @7)}
    %%   lst:                                                   {**dplyr::lst** (id: built-in:dplyr:lst, type: Function, def. @7)}
    %%   matches:                                               {**dplyr::matches** (id: built-in:dplyr:matches, type: Function, def. @7)}
    %%   num_range:                                             {**dplyr::num_range** (id: built-in:dplyr:num_range, type: Function, def. @7)}
    %%   one_of:                                                {**dplyr::one_of** (id: built-in:dplyr:one_of, type: Function, def. @7)}
    %%   quo:                                                   {**dplyr::quo** (id: built-in:dplyr:quo, type: Function, def. @7)}
    %%   quo_name:                                              {**dplyr::quo_name** (id: built-in:dplyr:quo_name, type: Function, def. @7)}
    %%   quos:                                                  {**dplyr::quos** (id: built-in:dplyr:quos, type: Function, def. @7)}
    %%   setdiff:                                               {**dplyr::setdiff** (id: built-in:dplyr:setdiff, type: Function, def. @7)}
    %%   setequal:                                              {**dplyr::setequal** (id: built-in:dplyr:setequal, type: Function, def. @7)}
    %%   starts_with:                                           {**dplyr::starts_with** (id: built-in:dplyr:starts_with, type: Function, def. @7)}
    %%   sym:                                                   {**dplyr::sym** (id: built-in:dplyr:sym, type: Function, def. @7)}
    %%   syms:                                                  {**dplyr::syms** (id: built-in:dplyr:syms, type: Function, def. @7)}
    %%   tibble:                                                {**dplyr::tibble** (id: built-in:dplyr:tibble, type: Function, def. @7)}
    %%   tribble:                                               {**dplyr::tribble** (id: built-in:dplyr:tribble, type: Function, def. @7)}
    %%   type_sum:                                              {**dplyr::type_sum** (id: built-in:dplyr:type_sum, type: Function, def. @7)}
    %%   union:                                                 {**dplyr::union** (id: built-in:dplyr:union, type: Function, def. @7)}
    %%   where:                                                 {**dplyr::where** (id: built-in:dplyr:where, type: Function, def. @7)}
    %%   id:                                                    {**dplyr::id** (id: built-in:dplyr:id, type: Function, def. @7)}
    %%   select_vars_:                                          {**dplyr::select_vars_** (id: built-in:dplyr:select_vars_, type: Function, def. @7)}
    %%   rename_vars_:                                          {**dplyr::rename_vars_** (id: built-in:dplyr:rename_vars_, type: Function, def. @7)}
    %%   changes:                                               {**dplyr::changes** (id: built-in:dplyr:changes, type: Function, def. @7)}
    %%   location:                                              {**dplyr::location** (id: built-in:dplyr:location, type: Function, def. @7)}
    %%   eval_tbls2:                                            {**dplyr::eval_tbls2** (id: built-in:dplyr:eval_tbls2, type: Function, def. @7)}
    %%   eval_tbls:                                             {**dplyr::eval_tbls** (id: built-in:dplyr:eval_tbls, type: Function, def. @7)}
    %%   compare_tbls2:                                         {**dplyr::compare_tbls2** (id: built-in:dplyr:compare_tbls2, type: Function, def. @7)}
    %%   compare_tbls:                                          {**dplyr::compare_tbls** (id: built-in:dplyr:compare_tbls, type: Function, def. @7)}
    %%   bench_tbls:                                            {**dplyr::bench_tbls** (id: built-in:dplyr:bench_tbls, type: Function, def. @7)}
    %%   current_vars:                                          {**dplyr::current_vars** (id: built-in:dplyr:current_vars, type: Function, def. @7)}
    %%   select_var:                                            {**dplyr::select_var** (id: built-in:dplyr:select_var, type: Function, def. @7)}
    %%   rename_vars:                                           {**dplyr::rename_vars** (id: built-in:dplyr:rename_vars, type: Function, def. @7)}
    %%   select_vars:                                           {**dplyr::select_vars** (id: built-in:dplyr:select_vars, type: Function, def. @7)}
    %%   failwith:                                              {**dplyr::failwith** (id: built-in:dplyr:failwith, type: Function, def. @7)}
    %% 4----------------------------------------
    %% 5----------------------------------------
    %%   [.spec_tbl_df:                      {**readr::[.spec_tbl_df** (id: built-in:readr:[.spec_tbl_df, type: Function, def. @11)}
    %%   AccumulateCallback:                 {**readr::AccumulateCallback** (id: built-in:readr:AccumulateCallback, type: Function, def. @11)}
    %%   as_chunk_callback.ChunkCallback:    {**readr::as_chunk_callback.ChunkCallback** (id: built-in:readr:as_chunk_callback.ChunkCallback, type: Function, def. @11)}
    %%   as_chunk_callback.function:         {**readr::as_chunk_callback.function** (id: built-in:readr:as_chunk_callback.function, type: Function, def. @11)}
    %%   as_chunk_callback.R6ClassGenerator: {**readr::as_chunk_callback.R6ClassGenerator** (id: built-in:readr:as_chunk_callback.R6ClassGenerator, type: Function, def. @11)}
    %%   as_tibble.spec_tbl_df:              {**readr::as_tibble.spec_tbl_df** (id: built-in:readr:as_tibble.spec_tbl_df, type: Function, def. @11)}
    %%   as.character.col_spec:              {**readr::as.character.col_spec** (id: built-in:readr:as.character.col_spec, type: Function, def. @11)}
    %%   as.col_spec:                        {**readr::as.col_spec** (id: built-in:readr:as.col_spec, type: Function, def. @11)}
    %%   as.col_spec.character:              {**readr::as.col_spec.character** (id: built-in:readr:as.col_spec.character, type: Function, def. @11)}
    %%   as.col_spec.col_spec:               {**readr::as.col_spec.col_spec** (id: built-in:readr:as.col_spec.col_spec, type: Function, def. @11)}
    %%   as.col_spec.data.frame:             {**readr::as.col_spec.data.frame** (id: built-in:readr:as.col_spec.data.frame, type: Function, def. @11)}
    %%   as.col_spec.default:                {**readr::as.col_spec.default** (id: built-in:readr:as.col_spec.default, type: Function, def. @11)}
    %%   as.col_spec.list:                   {**readr::as.col_spec.list** (id: built-in:readr:as.col_spec.list, type: Function, def. @11)}
    %%   as.col_spec.NULL:                   {**readr::as.col_spec.NULL** (id: built-in:readr:as.col_spec.NULL, type: Function, def. @11)}
    %%   as.data.frame.spec_tbl_df:          {**readr::as.data.frame.spec_tbl_df** (id: built-in:readr:as.data.frame.spec_tbl_df, type: Function, def. @11)}
    %%   ChunkCallback:                      {**readr::ChunkCallback** (id: built-in:readr:ChunkCallback, type: Function, def. @11)}
    %%   clipboard:                          {**readr::clipboard** (id: built-in:readr:clipboard, type: Function, def. @11)}
    %%   col_character:                      {**readr::col_character** (id: built-in:readr:col_character, type: Function, def. @11)}
    %%   col_date:                           {**readr::col_date** (id: built-in:readr:col_date, type: Function, def. @11)}
    %%   col_datetime:                       {**readr::col_datetime** (id: built-in:readr:col_datetime, type: Function, def. @11)}
    %%   col_double:                         {**readr::col_double** (id: built-in:readr:col_double, type: Function, def. @11)}
    %%   col_factor:                         {**readr::col_factor** (id: built-in:readr:col_factor, type: Function, def. @11)}
    %%   col_guess:                          {**readr::col_guess** (id: built-in:readr:col_guess, type: Function, def. @11)}
    %%   col_integer:                        {**readr::col_integer** (id: built-in:readr:col_integer, type: Function, def. @11)}
    %%   col_logical:                        {**readr::col_logical** (id: built-in:readr:col_logical, type: Function, def. @11)}
    %%   col_number:                         {**readr::col_number** (id: built-in:readr:col_number, type: Function, def. @11)}
    %%   col_skip:                           {**readr::col_skip** (id: built-in:readr:col_skip, type: Function, def. @11)}
    %%   col_time:                           {**readr::col_time** (id: built-in:readr:col_time, type: Function, def. @11)}
    %%   cols:                               {**readr::cols** (id: built-in:readr:cols, type: Function, def. @11)}
    %%   cols_condense:                      {**readr::cols_condense** (id: built-in:readr:cols_condense, type: Function, def. @11)}
    %%   cols_only:                          {**readr::cols_only** (id: built-in:readr:cols_only, type: Function, def. @11)}
    %%   count_fields:                       {**readr::count_fields** (id: built-in:readr:count_fields, type: Function, def. @11)}
    %%   DataFrameCallback:                  {**readr::DataFrameCallback** (id: built-in:readr:DataFrameCallback, type: Function, def. @11)}
    %%   datasource:                         {**readr::datasource** (id: built-in:readr:datasource, type: Function, def. @11)}
    %%   date_names:                         {**readr::date_names** (id: built-in:readr:date_names, type: Function, def. @11)}
    %%   date_names_lang:                    {**readr::date_names_lang** (id: built-in:readr:date_names_lang, type: Function, def. @11)}
    %%   date_names_langs:                   {**readr::date_names_langs** (id: built-in:readr:date_names_langs, type: Function, def. @11)}
    %%   default_locale:                     {**readr::default_locale** (id: built-in:readr:default_locale, type: Function, def. @11)}
    %%   edition_get:                        {**readr::edition_get** (id: built-in:readr:edition_get, type: Function, def. @11)}
    %%   format_csv:                         {**readr::format_csv** (id: built-in:readr:format_csv, type: Function, def. @11)}
    %%   format_csv2:                        {**readr::format_csv2** (id: built-in:readr:format_csv2, type: Function, def. @11)}
    %%   format_delim:                       {**readr::format_delim** (id: built-in:readr:format_delim, type: Function, def. @11)}
    %%   format_tsv:                         {**readr::format_tsv** (id: built-in:readr:format_tsv, type: Function, def. @11)}
    %%   format.col_spec:                    {**readr::format.col_spec** (id: built-in:readr:format.col_spec, type: Function, def. @11)}
    %%   fwf_cols:                           {**readr::fwf_cols** (id: built-in:readr:fwf_cols, type: Function, def. @11)}
    %%   fwf_empty:                          {**readr::fwf_empty** (id: built-in:readr:fwf_empty, type: Function, def. @11)}
    %%   fwf_positions:                      {**readr::fwf_positions** (id: built-in:readr:fwf_positions, type: Function, def. @11)}
    %%   fwf_widths:                         {**readr::fwf_widths** (id: built-in:readr:fwf_widths, type: Function, def. @11)}
    %%   guess_encoding:                     {**readr::guess_encoding** (id: built-in:readr:guess_encoding, type: Function, def. @11)}
    %%   guess_parser:                       {**readr::guess_parser** (id: built-in:readr:guess_parser, type: Function, def. @11)}
    %%   ListCallback:                       {**readr::ListCallback** (id: built-in:readr:ListCallback, type: Function, def. @11)}
    %%   local_edition:                      {**readr::local_edition** (id: built-in:readr:local_edition, type: Function, def. @11)}
    %%   locale:                             {**readr::locale** (id: built-in:readr:locale, type: Function, def. @11)}
    %%   output_column:                      {**readr::output_column** (id: built-in:readr:output_column, type: Function, def. @11)}
    %%   output_column.default:              {**readr::output_column.default** (id: built-in:readr:output_column.default, type: Function, def. @11)}
    %%   output_column.double:               {**readr::output_column.double** (id: built-in:readr:output_column.double, type: Function, def. @11)}
    %%   output_column.POSIXt:               {**readr::output_column.POSIXt** (id: built-in:readr:output_column.POSIXt, type: Function, def. @11)}
    %%   parse_character:                    {**readr::parse_character** (id: built-in:readr:parse_character, type: Function, def. @11)}
    %%   parse_date:                         {**readr::parse_date** (id: built-in:readr:parse_date, type: Function, def. @11)}
    %%   parse_datetime:                     {**readr::parse_datetime** (id: built-in:readr:parse_datetime, type: Function, def. @11)}
    %%   parse_double:                       {**readr::parse_double** (id: built-in:readr:parse_double, type: Function, def. @11)}
    %%   parse_factor:                       {**readr::parse_factor** (id: built-in:readr:parse_factor, type: Function, def. @11)}
    %%   parse_guess:                        {**readr::parse_guess** (id: built-in:readr:parse_guess, type: Function, def. @11)}
    %%   parse_integer:                      {**readr::parse_integer** (id: built-in:readr:parse_integer, type: Function, def. @11)}
    %%   parse_logical:                      {**readr::parse_logical** (id: built-in:readr:parse_logical, type: Function, def. @11)}
    %%   parse_number:                       {**readr::parse_number** (id: built-in:readr:parse_number, type: Function, def. @11)}
    %%   parse_time:                         {**readr::parse_time** (id: built-in:readr:parse_time, type: Function, def. @11)}
    %%   parse_vector:                       {**readr::parse_vector** (id: built-in:readr:parse_vector, type: Function, def. @11)}
    %%   print.col_spec:                     {**readr::print.col_spec** (id: built-in:readr:print.col_spec, type: Function, def. @11)}
    %%   print.collector:                    {**readr::print.collector** (id: built-in:readr:print.collector, type: Function, def. @11)}
    %%   print.date_names:                   {**readr::print.date_names** (id: built-in:readr:print.date_names, type: Function, def. @11)}
    %%   print.locale:                       {**readr::print.locale** (id: built-in:readr:print.locale, type: Function, def. @11)}
    %%   problems:                           {**readr::problems** (id: built-in:readr:problems, type: Function, def. @11)}
    %%   read_builtin:                       {**readr::read_builtin** (id: built-in:readr:read_builtin, type: Function, def. @11)}
    %%   read_csv:                           {**readr::read_csv** (id: built-in:readr:read_csv, type: Function, def. @11)}
    %%   read_csv_chunked:                   {**readr::read_csv_chunked** (id: built-in:readr:read_csv_chunked, type: Function, def. @11)}
    %%   read_csv2:                          {**readr::read_csv2** (id: built-in:readr:read_csv2, type: Function, def. @11)}
    %%   read_csv2_chunked:                  {**readr::read_csv2_chunked** (id: built-in:readr:read_csv2_chunked, type: Function, def. @11)}
    %%   read_delim:                         {**readr::read_delim** (id: built-in:readr:read_delim, type: Function, def. @11)}
    %%   read_delim_chunked:                 {**readr::read_delim_chunked** (id: built-in:readr:read_delim_chunked, type: Function, def. @11)}
    %%   read_file:                          {**readr::read_file** (id: built-in:readr:read_file, type: Function, def. @11)}
    %%   read_file_raw:                      {**readr::read_file_raw** (id: built-in:readr:read_file_raw, type: Function, def. @11)}
    %%   read_fwf:                           {**readr::read_fwf** (id: built-in:readr:read_fwf, type: Function, def. @11)}
    %%   read_lines:                         {**readr::read_lines** (id: built-in:readr:read_lines, type: Function, def. @11)}
    %%   read_lines_chunked:                 {**readr::read_lines_chunked** (id: built-in:readr:read_lines_chunked, type: Function, def. @11)}
    %%   read_lines_raw:                     {**readr::read_lines_raw** (id: built-in:readr:read_lines_raw, type: Function, def. @11)}
    %%   read_lines_raw_chunked:             {**readr::read_lines_raw_chunked** (id: built-in:readr:read_lines_raw_chunked, type: Function, def. @11)}
    %%   read_log:                           {**readr::read_log** (id: built-in:readr:read_log, type: Function, def. @11)}
    %%   read_rds:                           {**readr::read_rds** (id: built-in:readr:read_rds, type: Function, def. @11)}
    %%   read_table:                         {**readr::read_table** (id: built-in:readr:read_table, type: Function, def. @11)}
    %%   read_tsv:                           {**readr::read_tsv** (id: built-in:readr:read_tsv, type: Function, def. @11)}
    %%   read_tsv_chunked:                   {**readr::read_tsv_chunked** (id: built-in:readr:read_tsv_chunked, type: Function, def. @11)}
    %%   readr_example:                      {**readr::readr_example** (id: built-in:readr:readr_example, type: Function, def. @11)}
    %%   readr_threads:                      {**readr::readr_threads** (id: built-in:readr:readr_threads, type: Function, def. @11)}
    %%   should_read_lazy:                   {**readr::should_read_lazy** (id: built-in:readr:should_read_lazy, type: Function, def. @11)}
    %%   should_show_types:                  {**readr::should_show_types** (id: built-in:readr:should_show_types, type: Function, def. @11)}
    %%   show_progress:                      {**readr::show_progress** (id: built-in:readr:show_progress, type: Function, def. @11)}
    %%   SideEffectChunkCallback:            {**readr::SideEffectChunkCallback** (id: built-in:readr:SideEffectChunkCallback, type: Function, def. @11)}
    %%   spec:                               {**readr::spec** (id: built-in:readr:spec, type: Function, def. @11)}
    %%   spec_csv:                           {**readr::spec_csv** (id: built-in:readr:spec_csv, type: Function, def. @11)}
    %%   spec_csv2:                          {**readr::spec_csv2** (id: built-in:readr:spec_csv2, type: Function, def. @11)}
    %%   spec_delim:                         {**readr::spec_delim** (id: built-in:readr:spec_delim, type: Function, def. @11)}
    %%   spec_table:                         {**readr::spec_table** (id: built-in:readr:spec_table, type: Function, def. @11)}
    %%   spec_tsv:                           {**readr::spec_tsv** (id: built-in:readr:spec_tsv, type: Function, def. @11)}
    %%   stop_for_problems:                  {**readr::stop_for_problems** (id: built-in:readr:stop_for_problems, type: Function, def. @11)}
    %%   str.col_spec:                       {**readr::str.col_spec** (id: built-in:readr:str.col_spec, type: Function, def. @11)}
    %%   tokenize:                           {**readr::tokenize** (id: built-in:readr:tokenize, type: Function, def. @11)}
    %%   tokenizer_csv:                      {**readr::tokenizer_csv** (id: built-in:readr:tokenizer_csv, type: Function, def. @11)}
    %%   tokenizer_delim:                    {**readr::tokenizer_delim** (id: built-in:readr:tokenizer_delim, type: Function, def. @11)}
    %%   tokenizer_fwf:                      {**readr::tokenizer_fwf** (id: built-in:readr:tokenizer_fwf, type: Function, def. @11)}
    %%   tokenizer_line:                     {**readr::tokenizer_line** (id: built-in:readr:tokenizer_line, type: Function, def. @11)}
    %%   tokenizer_log:                      {**readr::tokenizer_log** (id: built-in:readr:tokenizer_log, type: Function, def. @11)}
    %%   tokenizer_tsv:                      {**readr::tokenizer_tsv** (id: built-in:readr:tokenizer_tsv, type: Function, def. @11)}
    %%   tokenizer_ws:                       {**readr::tokenizer_ws** (id: built-in:readr:tokenizer_ws, type: Function, def. @11)}
    %%   type_convert:                       {**readr::type_convert** (id: built-in:readr:type_convert, type: Function, def. @11)}
    %%   type_to_col.Date:                   {**readr::type_to_col.Date** (id: built-in:readr:type_to_col.Date, type: Function, def. @11)}
    %%   type_to_col.default:                {**readr::type_to_col.default** (id: built-in:readr:type_to_col.default, type: Function, def. @11)}
    %%   type_to_col.double:                 {**readr::type_to_col.double** (id: built-in:readr:type_to_col.double, type: Function, def. @11)}
    %%   type_to_col.factor:                 {**readr::type_to_col.factor** (id: built-in:readr:type_to_col.factor, type: Function, def. @11)}
    %%   type_to_col.hms:                    {**readr::type_to_col.hms** (id: built-in:readr:type_to_col.hms, type: Function, def. @11)}
    %%   type_to_col.integer:                {**readr::type_to_col.integer** (id: built-in:readr:type_to_col.integer, type: Function, def. @11)}
    %%   type_to_col.logical:                {**readr::type_to_col.logical** (id: built-in:readr:type_to_col.logical, type: Function, def. @11)}
    %%   type_to_col.POSIXct:                {**readr::type_to_col.POSIXct** (id: built-in:readr:type_to_col.POSIXct, type: Function, def. @11)}
    %%   with_edition:                       {**readr::with_edition** (id: built-in:readr:with_edition, type: Function, def. @11)}
    %%   write_csv:                          {**readr::write_csv** (id: built-in:readr:write_csv, type: Function, def. @11)}
    %%   write_csv2:                         {**readr::write_csv2** (id: built-in:readr:write_csv2, type: Function, def. @11)}
    %%   write_delim:                        {**readr::write_delim** (id: built-in:readr:write_delim, type: Function, def. @11)}
    %%   write_excel_csv:                    {**readr::write_excel_csv** (id: built-in:readr:write_excel_csv, type: Function, def. @11)}
    %%   write_excel_csv2:                   {**readr::write_excel_csv2** (id: built-in:readr:write_excel_csv2, type: Function, def. @11)}
    %%   write_file:                         {**readr::write_file** (id: built-in:readr:write_file, type: Function, def. @11)}
    %%   write_lines:                        {**readr::write_lines** (id: built-in:readr:write_lines, type: Function, def. @11)}
    %%   write_rds:                          {**readr::write_rds** (id: built-in:readr:write_rds, type: Function, def. @11)}
    %%   write_tsv:                          {**readr::write_tsv** (id: built-in:readr:write_tsv, type: Function, def. @11)}
    %%   read_table2:                        {**readr::read_table2** (id: built-in:readr:read_table2, type: Function, def. @11)}
    %%   melt_table:                         {**readr::melt_table** (id: built-in:readr:melt_table, type: Function, def. @11)}
    %%   melt_fwf:                           {**readr::melt_fwf** (id: built-in:readr:melt_fwf, type: Function, def. @11)}
    %%   melt_delim:                         {**readr::melt_delim** (id: built-in:readr:melt_delim, type: Function, def. @11)}
    %% 6----------------------------------------
    %%   #search-path:ggplot: {**#search-path:ggplot** (id: 3, type: Variable, def. @3)}
    %%   #search-path:        {**#search-path** (id: 3, type: Variable, cds: {}, def. @3), **#search-path** (id: 7, type: Variable, cds: {}, def. @7), **#search-path** (id: 11, type: Variable, cds: {}, def. @11)}
    %%   #search-path:dplyr:  {**#search-path:dplyr** (id: 7, type: Variable, def. @7)}
    %%   #search-path:readr:  {**#search-path:readr** (id: 11, type: Variable, def. @11)}
    %%   data:                {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2:               {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:                   {**m** (id: 24, type: Unknown, def. @32)}
    %%   #sink:output:        {**#sink:output** (id: 36, type: Variable, cds: {}, def. @36)}
    50[["`*#91;RFunctionCall#93;* **ggplot**
      *13.9-33* (**id: 50**)
    arg: (38, 48)`"]]
    %% Environment of 52 [level: 0]:
    %% Built-in
    %% 1----------------------------------------
    %%    library-load: {**ggplot:: library-load** (id: 3, type: Function, def. @3)}
    %% 2----------------------------------------
    %%   magrittr:%>%:           {**dplyr::magrittr:%>%** (id: built-in:magrittr:%>%, type: Function, def. @built-in:magrittr)}
    %%   tibble:add_row:         {**dplyr::tibble:add_row** (id: built-in:tibble:add_row, type: Function, def. @built-in:tibble)}
    %%   tibble:as_data_frame:   {**dplyr::tibble:as_data_frame** (id: built-in:tibble:as_data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:as_tibble:       {**dplyr::tibble:as_tibble** (id: built-in:tibble:as_tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:data_frame:      {**dplyr::tibble:data_frame** (id: built-in:tibble:data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:lst:             {**dplyr::tibble:lst** (id: built-in:tibble:lst, type: Function, def. @built-in:tibble)}
    %%   tibble:tibble:          {**dplyr::tibble:tibble** (id: built-in:tibble:tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:tribble:         {**dplyr::tibble:tribble** (id: built-in:tibble:tribble, type: Function, def. @built-in:tibble)}
    %%   tidyselect:all_of:      {**dplyr::tidyselect:all_of** (id: built-in:tidyselect:all_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:any_of:      {**dplyr::tidyselect:any_of** (id: built-in:tidyselect:any_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:contains:    {**dplyr::tidyselect:contains** (id: built-in:tidyselect:contains, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:ends_with:   {**dplyr::tidyselect:ends_with** (id: built-in:tidyselect:ends_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:everything:  {**dplyr::tidyselect:everything** (id: built-in:tidyselect:everything, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:last_col:    {**dplyr::tidyselect:last_col** (id: built-in:tidyselect:last_col, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:matches:     {**dplyr::tidyselect:matches** (id: built-in:tidyselect:matches, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:num_range:   {**dplyr::tidyselect:num_range** (id: built-in:tidyselect:num_range, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:one_of:      {**dplyr::tidyselect:one_of** (id: built-in:tidyselect:one_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:starts_with: {**dplyr::tidyselect:starts_with** (id: built-in:tidyselect:starts_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:where:       {**dplyr::tidyselect:where** (id: built-in:tidyselect:where, type: Function, def. @built-in:tidyselect)}
    %%   rlang:as_label:         {**dplyr::rlang:as_label** (id: built-in:rlang:as_label, type: Function, def. @built-in:rlang)}
    %%   rlang:enexpr:           {**dplyr::rlang:enexpr** (id: built-in:rlang:enexpr, type: Function, def. @built-in:rlang)}
    %%   rlang:enexprs:          {**dplyr::rlang:enexprs** (id: built-in:rlang:enexprs, type: Function, def. @built-in:rlang)}
    %%   rlang:enquo:            {**dplyr::rlang:enquo** (id: built-in:rlang:enquo, type: Function, def. @built-in:rlang)}
    %%   rlang:enquos:           {**dplyr::rlang:enquos** (id: built-in:rlang:enquos, type: Function, def. @built-in:rlang)}
    %%   rlang:ensym:            {**dplyr::rlang:ensym** (id: built-in:rlang:ensym, type: Function, def. @built-in:rlang)}
    %%   rlang:ensyms:           {**dplyr::rlang:ensyms** (id: built-in:rlang:ensyms, type: Function, def. @built-in:rlang)}
    %%   rlang:expr:             {**dplyr::rlang:expr** (id: built-in:rlang:expr, type: Function, def. @built-in:rlang)}
    %%   rlang:quo:              {**dplyr::rlang:quo** (id: built-in:rlang:quo, type: Function, def. @built-in:rlang)}
    %%   rlang:quo_name:         {**dplyr::rlang:quo_name** (id: built-in:rlang:quo_name, type: Function, def. @built-in:rlang)}
    %%   rlang:quos:             {**dplyr::rlang:quos** (id: built-in:rlang:quos, type: Function, def. @built-in:rlang)}
    %%   rlang:sym:              {**dplyr::rlang:sym** (id: built-in:rlang:sym, type: Function, def. @built-in:rlang)}
    %%   rlang:syms:             {**dplyr::rlang:syms** (id: built-in:rlang:syms, type: Function, def. @built-in:rlang)}
    %%   pillar:glimpse:         {**dplyr::pillar:glimpse** (id: built-in:pillar:glimpse, type: Function, def. @built-in:pillar)}
    %%   pillar:type_sum:        {**dplyr::pillar:type_sum** (id: built-in:pillar:type_sum, type: Function, def. @built-in:pillar)}
    %%   generics:intersect:     {**dplyr::generics:intersect** (id: built-in:generics:intersect, type: Function, def. @built-in:generics)}
    %%   generics:setdiff:       {**dplyr::generics:setdiff** (id: built-in:generics:setdiff, type: Function, def. @built-in:generics)}
    %%   generics:setequal:      {**dplyr::generics:setequal** (id: built-in:generics:setequal, type: Function, def. @built-in:generics)}
    %%   generics:union:         {**dplyr::generics:union** (id: built-in:generics:union, type: Function, def. @built-in:generics)}
    %% 3----------------------------------------
    %%   [.fun_list:                                            {**dplyr::[.fun_list** (id: built-in:dplyr:[.fun_list, type: Function, def. @7)}
    %%   [.grouped_df:                                          {**dplyr::[.grouped_df** (id: built-in:dplyr:[.grouped_df, type: Function, def. @7)}
    %%   [.rowwise_df:                                          {**dplyr::[.rowwise_df** (id: built-in:dplyr:[.rowwise_df, type: Function, def. @7)}
    %%   [[<-.grouped_df:                                       {**dplyr::[[<-.grouped_df** (id: built-in:dplyr:[[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.grouped_df:                                        {**dplyr::[<-.grouped_df** (id: built-in:dplyr:[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.rowwise_df:                                        {**dplyr::[<-.rowwise_df** (id: built-in:dplyr:[<-.rowwise_df, type: Function, def. @7)}
    %%   $<-.grouped_df:                                        {**dplyr::$<-.grouped_df** (id: built-in:dplyr:$<-.grouped_df, type: Function, def. @7)}
    %%   across:                                                {**dplyr::across** (id: built-in:dplyr:across, type: Function, def. @7)}
    %%   add_count:                                             {**dplyr::add_count** (id: built-in:dplyr:add_count, type: Function, def. @7)}
    %%   add_count_:                                            {**dplyr::add_count_** (id: built-in:dplyr:add_count_, type: Function, def. @7)}
    %%   add_count.data.frame:                                  {**dplyr::add_count.data.frame** (id: built-in:dplyr:add_count.data.frame, type: Function, def. @7)}
    %%   add_count.default:                                     {**dplyr::add_count.default** (id: built-in:dplyr:add_count.default, type: Function, def. @7)}
    %%   add_rownames:                                          {**dplyr::add_rownames** (id: built-in:dplyr:add_rownames, type: Function, def. @7)}
    %%   add_tally:                                             {**dplyr::add_tally** (id: built-in:dplyr:add_tally, type: Function, def. @7)}
    %%   add_tally_:                                            {**dplyr::add_tally_** (id: built-in:dplyr:add_tally_, type: Function, def. @7)}
    %%   all_equal:                                             {**dplyr::all_equal** (id: built-in:dplyr:all_equal, type: Function, def. @7)}
    %%   all_vars:                                              {**dplyr::all_vars** (id: built-in:dplyr:all_vars, type: Function, def. @7)}
    %%   anti_join:                                             {**dplyr::anti_join** (id: built-in:dplyr:anti_join, type: Function, def. @7)}
    %%   anti_join.data.frame:                                  {**dplyr::anti_join.data.frame** (id: built-in:dplyr:anti_join.data.frame, type: Function, def. @7)}
    %%   any_vars:                                              {**dplyr::any_vars** (id: built-in:dplyr:any_vars, type: Function, def. @7)}
    %%   arrange:                                               {**dplyr::arrange** (id: built-in:dplyr:arrange, type: Function, def. @7)}
    %%   arrange_:                                              {**dplyr::arrange_** (id: built-in:dplyr:arrange_, type: Function, def. @7)}
    %%   arrange_all:                                           {**dplyr::arrange_all** (id: built-in:dplyr:arrange_all, type: Function, def. @7)}
    %%   arrange_at:                                            {**dplyr::arrange_at** (id: built-in:dplyr:arrange_at, type: Function, def. @7)}
    %%   arrange_if:                                            {**dplyr::arrange_if** (id: built-in:dplyr:arrange_if, type: Function, def. @7)}
    %%   arrange.data.frame:                                    {**dplyr::arrange.data.frame** (id: built-in:dplyr:arrange.data.frame, type: Function, def. @7)}
    %%   as_join_by.character:                                  {**dplyr::as_join_by.character** (id: built-in:dplyr:as_join_by.character, type: Function, def. @7)}
    %%   as_join_by.default:                                    {**dplyr::as_join_by.default** (id: built-in:dplyr:as_join_by.default, type: Function, def. @7)}
    %%   as_join_by.dplyr_join_by:                              {**dplyr::as_join_by.dplyr_join_by** (id: built-in:dplyr:as_join_by.dplyr_join_by, type: Function, def. @7)}
    %%   as_join_by.list:                                       {**dplyr::as_join_by.list** (id: built-in:dplyr:as_join_by.list, type: Function, def. @7)}
    %%   as_tibble.grouped_df:                                  {**dplyr::as_tibble.grouped_df** (id: built-in:dplyr:as_tibble.grouped_df, type: Function, def. @7)}
    %%   as_tibble.rowwise_df:                                  {**dplyr::as_tibble.rowwise_df** (id: built-in:dplyr:as_tibble.rowwise_df, type: Function, def. @7)}
    %%   as.data.frame.grouped_df:                              {**dplyr::as.data.frame.grouped_df** (id: built-in:dplyr:as.data.frame.grouped_df, type: Function, def. @7)}
    %%   as.tbl:                                                {**dplyr::as.tbl** (id: built-in:dplyr:as.tbl, type: Function, def. @7)}
    %%   auto_copy:                                             {**dplyr::auto_copy** (id: built-in:dplyr:auto_copy, type: Function, def. @7)}
    %%   auto_copy.data.frame:                                  {**dplyr::auto_copy.data.frame** (id: built-in:dplyr:auto_copy.data.frame, type: Function, def. @7)}
    %%   between:                                               {**dplyr::between** (id: built-in:dplyr:between, type: Function, def. @7)}
    %%   bind_cols:                                             {**dplyr::bind_cols** (id: built-in:dplyr:bind_cols, type: Function, def. @7)}
    %%   bind_rows:                                             {**dplyr::bind_rows** (id: built-in:dplyr:bind_rows, type: Function, def. @7)}
    %%   c_across:                                              {**dplyr::c_across** (id: built-in:dplyr:c_across, type: Function, def. @7)}
    %%   case_match:                                            {**dplyr::case_match** (id: built-in:dplyr:case_match, type: Function, def. @7)}
    %%   case_when:                                             {**dplyr::case_when** (id: built-in:dplyr:case_when, type: Function, def. @7)}
    %%   cbind.grouped_df:                                      {**dplyr::cbind.grouped_df** (id: built-in:dplyr:cbind.grouped_df, type: Function, def. @7)}
    %%   check_dbplyr:                                          {**dplyr::check_dbplyr** (id: built-in:dplyr:check_dbplyr, type: Function, def. @7)}
    %%   coalesce:                                              {**dplyr::coalesce** (id: built-in:dplyr:coalesce, type: Function, def. @7)}
    %%   collapse:                                              {**dplyr::collapse** (id: built-in:dplyr:collapse, type: Function, def. @7)}
    %%   collapse.data.frame:                                   {**dplyr::collapse.data.frame** (id: built-in:dplyr:collapse.data.frame, type: Function, def. @7)}
    %%   collect:                                               {**dplyr::collect** (id: built-in:dplyr:collect, type: Function, def. @7)}
    %%   collect.data.frame:                                    {**dplyr::collect.data.frame** (id: built-in:dplyr:collect.data.frame, type: Function, def. @7)}
    %%   combine:                                               {**dplyr::combine** (id: built-in:dplyr:combine, type: Function, def. @7)}
    %%   common_by:                                             {**dplyr::common_by** (id: built-in:dplyr:common_by, type: Function, def. @7)}
    %%   common_by.character:                                   {**dplyr::common_by.character** (id: built-in:dplyr:common_by.character, type: Function, def. @7)}
    %%   common_by.default:                                     {**dplyr::common_by.default** (id: built-in:dplyr:common_by.default, type: Function, def. @7)}
    %%   common_by.list:                                        {**dplyr::common_by.list** (id: built-in:dplyr:common_by.list, type: Function, def. @7)}
    %%   common_by.NULL:                                        {**dplyr::common_by.NULL** (id: built-in:dplyr:common_by.NULL, type: Function, def. @7)}
    %%   compute:                                               {**dplyr::compute** (id: built-in:dplyr:compute, type: Function, def. @7)}
    %%   compute.data.frame:                                    {**dplyr::compute.data.frame** (id: built-in:dplyr:compute.data.frame, type: Function, def. @7)}
    %%   consecutive_id:                                        {**dplyr::consecutive_id** (id: built-in:dplyr:consecutive_id, type: Function, def. @7)}
    %%   copy_to:                                               {**dplyr::copy_to** (id: built-in:dplyr:copy_to, type: Function, def. @7)}
    %%   copy_to.DBIConnection:                                 {**dplyr::copy_to.DBIConnection** (id: built-in:dplyr:copy_to.DBIConnection, type: Function, def. @7)}
    %%   count:                                                 {**dplyr::count** (id: built-in:dplyr:count, type: Function, def. @7)}
    %%   count_:                                                {**dplyr::count_** (id: built-in:dplyr:count_, type: Function, def. @7)}
    %%   count.data.frame:                                      {**dplyr::count.data.frame** (id: built-in:dplyr:count.data.frame, type: Function, def. @7)}
    %%   cross_join:                                            {**dplyr::cross_join** (id: built-in:dplyr:cross_join, type: Function, def. @7)}
    %%   cross_join.data.frame:                                 {**dplyr::cross_join.data.frame** (id: built-in:dplyr:cross_join.data.frame, type: Function, def. @7)}
    %%   cumall:                                                {**dplyr::cumall** (id: built-in:dplyr:cumall, type: Function, def. @7)}
    %%   cumany:                                                {**dplyr::cumany** (id: built-in:dplyr:cumany, type: Function, def. @7)}
    %%   cume_dist:                                             {**dplyr::cume_dist** (id: built-in:dplyr:cume_dist, type: Function, def. @7)}
    %%   cummean:                                               {**dplyr::cummean** (id: built-in:dplyr:cummean, type: Function, def. @7)}
    %%   cur_column:                                            {**dplyr::cur_column** (id: built-in:dplyr:cur_column, type: Function, def. @7)}
    %%   cur_data:                                              {**dplyr::cur_data** (id: built-in:dplyr:cur_data, type: Function, def. @7)}
    %%   cur_data_all:                                          {**dplyr::cur_data_all** (id: built-in:dplyr:cur_data_all, type: Function, def. @7)}
    %%   cur_group:                                             {**dplyr::cur_group** (id: built-in:dplyr:cur_group, type: Function, def. @7)}
    %%   cur_group_id:                                          {**dplyr::cur_group_id** (id: built-in:dplyr:cur_group_id, type: Function, def. @7)}
    %%   cur_group_rows:                                        {**dplyr::cur_group_rows** (id: built-in:dplyr:cur_group_rows, type: Function, def. @7)}
    %%   db_analyze:                                            {**dplyr::db_analyze** (id: built-in:dplyr:db_analyze, type: Function, def. @7)}
    %%   db_begin:                                              {**dplyr::db_begin** (id: built-in:dplyr:db_begin, type: Function, def. @7)}
    %%   db_commit:                                             {**dplyr::db_commit** (id: built-in:dplyr:db_commit, type: Function, def. @7)}
    %%   db_create_index:                                       {**dplyr::db_create_index** (id: built-in:dplyr:db_create_index, type: Function, def. @7)}
    %%   db_create_indexes:                                     {**dplyr::db_create_indexes** (id: built-in:dplyr:db_create_indexes, type: Function, def. @7)}
    %%   db_create_table:                                       {**dplyr::db_create_table** (id: built-in:dplyr:db_create_table, type: Function, def. @7)}
    %%   db_data_type:                                          {**dplyr::db_data_type** (id: built-in:dplyr:db_data_type, type: Function, def. @7)}
    %%   db_desc:                                               {**dplyr::db_desc** (id: built-in:dplyr:db_desc, type: Function, def. @7)}
    %%   db_drop_table:                                         {**dplyr::db_drop_table** (id: built-in:dplyr:db_drop_table, type: Function, def. @7)}
    %%   db_explain:                                            {**dplyr::db_explain** (id: built-in:dplyr:db_explain, type: Function, def. @7)}
    %%   db_has_table:                                          {**dplyr::db_has_table** (id: built-in:dplyr:db_has_table, type: Function, def. @7)}
    %%   db_insert_into:                                        {**dplyr::db_insert_into** (id: built-in:dplyr:db_insert_into, type: Function, def. @7)}
    %%   db_list_tables:                                        {**dplyr::db_list_tables** (id: built-in:dplyr:db_list_tables, type: Function, def. @7)}
    %%   db_query_fields:                                       {**dplyr::db_query_fields** (id: built-in:dplyr:db_query_fields, type: Function, def. @7)}
    %%   db_query_rows:                                         {**dplyr::db_query_rows** (id: built-in:dplyr:db_query_rows, type: Function, def. @7)}
    %%   db_rollback:                                           {**dplyr::db_rollback** (id: built-in:dplyr:db_rollback, type: Function, def. @7)}
    %%   db_save_query:                                         {**dplyr::db_save_query** (id: built-in:dplyr:db_save_query, type: Function, def. @7)}
    %%   db_write_table:                                        {**dplyr::db_write_table** (id: built-in:dplyr:db_write_table, type: Function, def. @7)}
    %%   dense_rank:                                            {**dplyr::dense_rank** (id: built-in:dplyr:dense_rank, type: Function, def. @7)}
    %%   desc:                                                  {**dplyr::desc** (id: built-in:dplyr:desc, type: Function, def. @7)}
    %%   dim_desc:                                              {**dplyr::dim_desc** (id: built-in:dplyr:dim_desc, type: Function, def. @7)}
    %%   distinct:                                              {**dplyr::distinct** (id: built-in:dplyr:distinct, type: Function, def. @7)}
    %%   distinct_:                                             {**dplyr::distinct_** (id: built-in:dplyr:distinct_, type: Function, def. @7)}
    %%   distinct_all:                                          {**dplyr::distinct_all** (id: built-in:dplyr:distinct_all, type: Function, def. @7)}
    %%   distinct_at:                                           {**dplyr::distinct_at** (id: built-in:dplyr:distinct_at, type: Function, def. @7)}
    %%   distinct_if:                                           {**dplyr::distinct_if** (id: built-in:dplyr:distinct_if, type: Function, def. @7)}
    %%   distinct_prepare:                                      {**dplyr::distinct_prepare** (id: built-in:dplyr:distinct_prepare, type: Function, def. @7)}
    %%   distinct.data.frame:                                   {**dplyr::distinct.data.frame** (id: built-in:dplyr:distinct.data.frame, type: Function, def. @7)}
    %%   do:                                                    {**dplyr::do** (id: built-in:dplyr:do, type: Function, def. @7)}
    %%   do_:                                                   {**dplyr::do_** (id: built-in:dplyr:do_, type: Function, def. @7)}
    %%   do.data.frame:                                         {**dplyr::do.data.frame** (id: built-in:dplyr:do.data.frame, type: Function, def. @7)}
    %%   do.grouped_df:                                         {**dplyr::do.grouped_df** (id: built-in:dplyr:do.grouped_df, type: Function, def. @7)}
    %%   do.NULL:                                               {**dplyr::do.NULL** (id: built-in:dplyr:do.NULL, type: Function, def. @7)}
    %%   do.rowwise_df:                                         {**dplyr::do.rowwise_df** (id: built-in:dplyr:do.rowwise_df, type: Function, def. @7)}
    %%   dplyr_col_modify:                                      {**dplyr::dplyr_col_modify** (id: built-in:dplyr:dplyr_col_modify, type: Function, def. @7)}
    %%   dplyr_col_modify.data.frame:                           {**dplyr::dplyr_col_modify.data.frame** (id: built-in:dplyr:dplyr_col_modify.data.frame, type: Function, def. @7)}
    %%   dplyr_col_modify.grouped_df:                           {**dplyr::dplyr_col_modify.grouped_df** (id: built-in:dplyr:dplyr_col_modify.grouped_df, type: Function, def. @7)}
    %%   dplyr_col_modify.rowwise_df:                           {**dplyr::dplyr_col_modify.rowwise_df** (id: built-in:dplyr:dplyr_col_modify.rowwise_df, type: Function, def. @7)}
    %%   dplyr_reconstruct:                                     {**dplyr::dplyr_reconstruct** (id: built-in:dplyr:dplyr_reconstruct, type: Function, def. @7)}
    %%   dplyr_reconstruct.data.frame:                          {**dplyr::dplyr_reconstruct.data.frame** (id: built-in:dplyr:dplyr_reconstruct.data.frame, type: Function, def. @7)}
    %%   dplyr_reconstruct.grouped_df:                          {**dplyr::dplyr_reconstruct.grouped_df** (id: built-in:dplyr:dplyr_reconstruct.grouped_df, type: Function, def. @7)}
    %%   dplyr_reconstruct.rowwise_df:                          {**dplyr::dplyr_reconstruct.rowwise_df** (id: built-in:dplyr:dplyr_reconstruct.rowwise_df, type: Function, def. @7)}
    %%   dplyr_row_slice:                                       {**dplyr::dplyr_row_slice** (id: built-in:dplyr:dplyr_row_slice, type: Function, def. @7)}
    %%   dplyr_row_slice.data.frame:                            {**dplyr::dplyr_row_slice.data.frame** (id: built-in:dplyr:dplyr_row_slice.data.frame, type: Function, def. @7)}
    %%   dplyr_row_slice.grouped_df:                            {**dplyr::dplyr_row_slice.grouped_df** (id: built-in:dplyr:dplyr_row_slice.grouped_df, type: Function, def. @7)}
    %%   dplyr_row_slice.rowwise_df:                            {**dplyr::dplyr_row_slice.rowwise_df** (id: built-in:dplyr:dplyr_row_slice.rowwise_df, type: Function, def. @7)}
    %%   explain:                                               {**dplyr::explain** (id: built-in:dplyr:explain, type: Function, def. @7)}
    %%   filter:                                                {**dplyr::filter** (id: built-in:dplyr:filter, type: Function, def. @7)}
    %%   filter_:                                               {**dplyr::filter_** (id: built-in:dplyr:filter_, type: Function, def. @7)}
    %%   filter_all:                                            {**dplyr::filter_all** (id: built-in:dplyr:filter_all, type: Function, def. @7)}
    %%   filter_at:                                             {**dplyr::filter_at** (id: built-in:dplyr:filter_at, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_size:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_size** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_size, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_type:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_type** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_type, type: Function, def. @7)}
    %%   filter_if:                                             {**dplyr::filter_if** (id: built-in:dplyr:filter_if, type: Function, def. @7)}
    %%   filter_out:                                            {**dplyr::filter_out** (id: built-in:dplyr:filter_out, type: Function, def. @7)}
    %%   filter_out.data.frame:                                 {**dplyr::filter_out.data.frame** (id: built-in:dplyr:filter_out.data.frame, type: Function, def. @7)}
    %%   filter.data.frame:                                     {**dplyr::filter.data.frame** (id: built-in:dplyr:filter.data.frame, type: Function, def. @7)}
    %%   filter.ts:                                             {**dplyr::filter.ts** (id: built-in:dplyr:filter.ts, type: Function, def. @7)}
    %%   first:                                                 {**dplyr::first** (id: built-in:dplyr:first, type: Function, def. @7)}
    %%   full_join:                                             {**dplyr::full_join** (id: built-in:dplyr:full_join, type: Function, def. @7)}
    %%   full_join.data.frame:                                  {**dplyr::full_join.data.frame** (id: built-in:dplyr:full_join.data.frame, type: Function, def. @7)}
    %%   funs:                                                  {**dplyr::funs** (id: built-in:dplyr:funs, type: Function, def. @7)}
    %%   funs_:                                                 {**dplyr::funs_** (id: built-in:dplyr:funs_, type: Function, def. @7)}
    %%   group_by:                                              {**dplyr::group_by** (id: built-in:dplyr:group_by, type: Function, def. @7)}
    %%   group_by_:                                             {**dplyr::group_by_** (id: built-in:dplyr:group_by_, type: Function, def. @7)}
    %%   group_by_all:                                          {**dplyr::group_by_all** (id: built-in:dplyr:group_by_all, type: Function, def. @7)}
    %%   group_by_at:                                           {**dplyr::group_by_at** (id: built-in:dplyr:group_by_at, type: Function, def. @7)}
    %%   group_by_drop_default:                                 {**dplyr::group_by_drop_default** (id: built-in:dplyr:group_by_drop_default, type: Function, def. @7)}
    %%   group_by_drop_default.default:                         {**dplyr::group_by_drop_default.default** (id: built-in:dplyr:group_by_drop_default.default, type: Function, def. @7)}
    %%   group_by_drop_default.grouped_df:                      {**dplyr::group_by_drop_default.grouped_df** (id: built-in:dplyr:group_by_drop_default.grouped_df, type: Function, def. @7)}
    %%   group_by_if:                                           {**dplyr::group_by_if** (id: built-in:dplyr:group_by_if, type: Function, def. @7)}
    %%   group_by_prepare:                                      {**dplyr::group_by_prepare** (id: built-in:dplyr:group_by_prepare, type: Function, def. @7)}
    %%   group_by.data.frame:                                   {**dplyr::group_by.data.frame** (id: built-in:dplyr:group_by.data.frame, type: Function, def. @7)}
    %%   group_cols:                                            {**dplyr::group_cols** (id: built-in:dplyr:group_cols, type: Function, def. @7)}
    %%   group_data:                                            {**dplyr::group_data** (id: built-in:dplyr:group_data, type: Function, def. @7)}
    %%   group_data.data.frame:                                 {**dplyr::group_data.data.frame** (id: built-in:dplyr:group_data.data.frame, type: Function, def. @7)}
    %%   group_data.grouped_df:                                 {**dplyr::group_data.grouped_df** (id: built-in:dplyr:group_data.grouped_df, type: Function, def. @7)}
    %%   group_data.rowwise_df:                                 {**dplyr::group_data.rowwise_df** (id: built-in:dplyr:group_data.rowwise_df, type: Function, def. @7)}
    %%   group_data.tbl_df:                                     {**dplyr::group_data.tbl_df** (id: built-in:dplyr:group_data.tbl_df, type: Function, def. @7)}
    %%   group_indices:                                         {**dplyr::group_indices** (id: built-in:dplyr:group_indices, type: Function, def. @7)}
    %%   group_indices_:                                        {**dplyr::group_indices_** (id: built-in:dplyr:group_indices_, type: Function, def. @7)}
    %%   group_indices.data.frame:                              {**dplyr::group_indices.data.frame** (id: built-in:dplyr:group_indices.data.frame, type: Function, def. @7)}
    %%   group_keys:                                            {**dplyr::group_keys** (id: built-in:dplyr:group_keys, type: Function, def. @7)}
    %%   group_keys.data.frame:                                 {**dplyr::group_keys.data.frame** (id: built-in:dplyr:group_keys.data.frame, type: Function, def. @7)}
    %%   group_map:                                             {**dplyr::group_map** (id: built-in:dplyr:group_map, type: Function, def. @7)}
    %%   group_map.data.frame:                                  {**dplyr::group_map.data.frame** (id: built-in:dplyr:group_map.data.frame, type: Function, def. @7)}
    %%   group_modify:                                          {**dplyr::group_modify** (id: built-in:dplyr:group_modify, type: Function, def. @7)}
    %%   group_modify.data.frame:                               {**dplyr::group_modify.data.frame** (id: built-in:dplyr:group_modify.data.frame, type: Function, def. @7)}
    %%   group_modify.grouped_df:                               {**dplyr::group_modify.grouped_df** (id: built-in:dplyr:group_modify.grouped_df, type: Function, def. @7)}
    %%   group_nest:                                            {**dplyr::group_nest** (id: built-in:dplyr:group_nest, type: Function, def. @7)}
    %%   group_nest.data.frame:                                 {**dplyr::group_nest.data.frame** (id: built-in:dplyr:group_nest.data.frame, type: Function, def. @7)}
    %%   group_nest.grouped_df:                                 {**dplyr::group_nest.grouped_df** (id: built-in:dplyr:group_nest.grouped_df, type: Function, def. @7)}
    %%   group_rows:                                            {**dplyr::group_rows** (id: built-in:dplyr:group_rows, type: Function, def. @7)}
    %%   group_size:                                            {**dplyr::group_size** (id: built-in:dplyr:group_size, type: Function, def. @7)}
    %%   group_size.data.frame:                                 {**dplyr::group_size.data.frame** (id: built-in:dplyr:group_size.data.frame, type: Function, def. @7)}
    %%   group_split:                                           {**dplyr::group_split** (id: built-in:dplyr:group_split, type: Function, def. @7)}
    %%   group_split.data.frame:                                {**dplyr::group_split.data.frame** (id: built-in:dplyr:group_split.data.frame, type: Function, def. @7)}
    %%   group_split.grouped_df:                                {**dplyr::group_split.grouped_df** (id: built-in:dplyr:group_split.grouped_df, type: Function, def. @7)}
    %%   group_split.rowwise_df:                                {**dplyr::group_split.rowwise_df** (id: built-in:dplyr:group_split.rowwise_df, type: Function, def. @7)}
    %%   group_trim:                                            {**dplyr::group_trim** (id: built-in:dplyr:group_trim, type: Function, def. @7)}
    %%   group_trim.data.frame:                                 {**dplyr::group_trim.data.frame** (id: built-in:dplyr:group_trim.data.frame, type: Function, def. @7)}
    %%   group_trim.grouped_df:                                 {**dplyr::group_trim.grouped_df** (id: built-in:dplyr:group_trim.grouped_df, type: Function, def. @7)}
    %%   group_vars:                                            {**dplyr::group_vars** (id: built-in:dplyr:group_vars, type: Function, def. @7)}
    %%   group_vars.data.frame:                                 {**dplyr::group_vars.data.frame** (id: built-in:dplyr:group_vars.data.frame, type: Function, def. @7)}
    %%   group_walk:                                            {**dplyr::group_walk** (id: built-in:dplyr:group_walk, type: Function, def. @7)}
    %%   grouped_df:                                            {**dplyr::grouped_df** (id: built-in:dplyr:grouped_df, type: Function, def. @7)}
    %%   groups:                                                {**dplyr::groups** (id: built-in:dplyr:groups, type: Function, def. @7)}
    %%   groups.data.frame:                                     {**dplyr::groups.data.frame** (id: built-in:dplyr:groups.data.frame, type: Function, def. @7)}
    %%   ident:                                                 {**dplyr::ident** (id: built-in:dplyr:ident, type: Function, def. @7)}
    %%   if_all:                                                {**dplyr::if_all** (id: built-in:dplyr:if_all, type: Function, def. @7)}
    %%   if_any:                                                {**dplyr::if_any** (id: built-in:dplyr:if_any, type: Function, def. @7)}
    %%   if_else:                                               {**dplyr::if_else** (id: built-in:dplyr:if_else, type: Function, def. @7)}
    %%   inner_join:                                            {**dplyr::inner_join** (id: built-in:dplyr:inner_join, type: Function, def. @7)}
    %%   inner_join.data.frame:                                 {**dplyr::inner_join.data.frame** (id: built-in:dplyr:inner_join.data.frame, type: Function, def. @7)}
    %%   intersect.data.frame:                                  {**dplyr::intersect.data.frame** (id: built-in:dplyr:intersect.data.frame, type: Function, def. @7)}
    %%   is_grouped_df:                                         {**dplyr::is_grouped_df** (id: built-in:dplyr:is_grouped_df, type: Function, def. @7)}
    %%   is.grouped_df:                                         {**dplyr::is.grouped_df** (id: built-in:dplyr:is.grouped_df, type: Function, def. @7)}
    %%   is.src:                                                {**dplyr::is.src** (id: built-in:dplyr:is.src, type: Function, def. @7)}
    %%   is.tbl:                                                {**dplyr::is.tbl** (id: built-in:dplyr:is.tbl, type: Function, def. @7)}
    %%   join_by:                                               {**dplyr::join_by** (id: built-in:dplyr:join_by, type: Function, def. @7)}
    %%   lag:                                                   {**dplyr::lag** (id: built-in:dplyr:lag, type: Function, def. @7)}
    %%   last:                                                  {**dplyr::last** (id: built-in:dplyr:last, type: Function, def. @7)}
    %%   last_dplyr_warnings:                                   {**dplyr::last_dplyr_warnings** (id: built-in:dplyr:last_dplyr_warnings, type: Function, def. @7)}
    %%   lead:                                                  {**dplyr::lead** (id: built-in:dplyr:lead, type: Function, def. @7)}
    %%   left_join:                                             {**dplyr::left_join** (id: built-in:dplyr:left_join, type: Function, def. @7)}
    %%   left_join.data.frame:                                  {**dplyr::left_join.data.frame** (id: built-in:dplyr:left_join.data.frame, type: Function, def. @7)}
    %%   make_tbl:                                              {**dplyr::make_tbl** (id: built-in:dplyr:make_tbl, type: Function, def. @7)}
    %%   min_rank:                                              {**dplyr::min_rank** (id: built-in:dplyr:min_rank, type: Function, def. @7)}
    %%   mutate:                                                {**dplyr::mutate** (id: built-in:dplyr:mutate, type: Function, def. @7)}
    %%   mutate_:                                               {**dplyr::mutate_** (id: built-in:dplyr:mutate_, type: Function, def. @7)}
    %%   mutate_all:                                            {**dplyr::mutate_all** (id: built-in:dplyr:mutate_all, type: Function, def. @7)}
    %%   mutate_at:                                             {**dplyr::mutate_at** (id: built-in:dplyr:mutate_at, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::error_incompatible_combine:     {**dplyr::mutate_bullets.dplyr:::error_incompatible_combine** (id: built-in:dplyr:mutate_bullets.dplyr:::error_incompatible_combine, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_constant_recycle_error:  {**dplyr::mutate_bullets.dplyr:::mutate_constant_recycle_error** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_constant_recycle_error, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_incompatible_size:       {**dplyr::mutate_bullets.dplyr:::mutate_incompatible_size** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_incompatible_size, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_mixed_null:              {**dplyr::mutate_bullets.dplyr:::mutate_mixed_null** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_mixed_null, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_not_vector:              {**dplyr::mutate_bullets.dplyr:::mutate_not_vector** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_not_vector, type: Function, def. @7)}
    %%   mutate_each:                                           {**dplyr::mutate_each** (id: built-in:dplyr:mutate_each, type: Function, def. @7)}
    %%   mutate_each_:                                          {**dplyr::mutate_each_** (id: built-in:dplyr:mutate_each_, type: Function, def. @7)}
    %%   mutate_if:                                             {**dplyr::mutate_if** (id: built-in:dplyr:mutate_if, type: Function, def. @7)}
    %%   mutate.data.frame:                                     {**dplyr::mutate.data.frame** (id: built-in:dplyr:mutate.data.frame, type: Function, def. @7)}
    %%   n:                                                     {**dplyr::n** (id: built-in:dplyr:n, type: Function, def. @7)}
    %%   n_distinct:                                            {**dplyr::n_distinct** (id: built-in:dplyr:n_distinct, type: Function, def. @7)}
    %%   n_groups:                                              {**dplyr::n_groups** (id: built-in:dplyr:n_groups, type: Function, def. @7)}
    %%   n_groups.data.frame:                                   {**dplyr::n_groups.data.frame** (id: built-in:dplyr:n_groups.data.frame, type: Function, def. @7)}
    %%   na_if:                                                 {**dplyr::na_if** (id: built-in:dplyr:na_if, type: Function, def. @7)}
    %%   names<-.grouped_df:                                    {**dplyr::names<-.grouped_df** (id: built-in:dplyr:names<-.grouped_df, type: Function, def. @7)}
    %%   names<-.rowwise_df:                                    {**dplyr::names<-.rowwise_df** (id: built-in:dplyr:names<-.rowwise_df, type: Function, def. @7)}
    %%   near:                                                  {**dplyr::near** (id: built-in:dplyr:near, type: Function, def. @7)}
    %%   nest_by:                                               {**dplyr::nest_by** (id: built-in:dplyr:nest_by, type: Function, def. @7)}
    %%   nest_by.data.frame:                                    {**dplyr::nest_by.data.frame** (id: built-in:dplyr:nest_by.data.frame, type: Function, def. @7)}
    %%   nest_by.grouped_df:                                    {**dplyr::nest_by.grouped_df** (id: built-in:dplyr:nest_by.grouped_df, type: Function, def. @7)}
    %%   nest_join:                                             {**dplyr::nest_join** (id: built-in:dplyr:nest_join, type: Function, def. @7)}
    %%   nest_join.data.frame:                                  {**dplyr::nest_join.data.frame** (id: built-in:dplyr:nest_join.data.frame, type: Function, def. @7)}
    %%   new_grouped_df:                                        {**dplyr::new_grouped_df** (id: built-in:dplyr:new_grouped_df, type: Function, def. @7)}
    %%   new_rowwise_df:                                        {**dplyr::new_rowwise_df** (id: built-in:dplyr:new_rowwise_df, type: Function, def. @7)}
    %%   nth:                                                   {**dplyr::nth** (id: built-in:dplyr:nth, type: Function, def. @7)}
    %%   ntile:                                                 {**dplyr::ntile** (id: built-in:dplyr:ntile, type: Function, def. @7)}
    %%   order_by:                                              {**dplyr::order_by** (id: built-in:dplyr:order_by, type: Function, def. @7)}
    %%   percent_rank:                                          {**dplyr::percent_rank** (id: built-in:dplyr:percent_rank, type: Function, def. @7)}
    %%   pick:                                                  {**dplyr::pick** (id: built-in:dplyr:pick, type: Function, def. @7)}
    %%   print.all_vars:                                        {**dplyr::print.all_vars** (id: built-in:dplyr:print.all_vars, type: Function, def. @7)}
    %%   print.any_vars:                                        {**dplyr::print.any_vars** (id: built-in:dplyr:print.any_vars, type: Function, def. @7)}
    %%   print.dplyr_join_by:                                   {**dplyr::print.dplyr_join_by** (id: built-in:dplyr:print.dplyr_join_by, type: Function, def. @7)}
    %%   print.dplyr_sel_vars:                                  {**dplyr::print.dplyr_sel_vars** (id: built-in:dplyr:print.dplyr_sel_vars, type: Function, def. @7)}
    %%   print.fun_list:                                        {**dplyr::print.fun_list** (id: built-in:dplyr:print.fun_list, type: Function, def. @7)}
    %%   print.last_dplyr_warnings:                             {**dplyr::print.last_dplyr_warnings** (id: built-in:dplyr:print.last_dplyr_warnings, type: Function, def. @7)}
    %%   print.src:                                             {**dplyr::print.src** (id: built-in:dplyr:print.src, type: Function, def. @7)}
    %%   progress_estimated:                                    {**dplyr::progress_estimated** (id: built-in:dplyr:progress_estimated, type: Function, def. @7)}
    %%   pull:                                                  {**dplyr::pull** (id: built-in:dplyr:pull, type: Function, def. @7)}
    %%   pull.data.frame:                                       {**dplyr::pull.data.frame** (id: built-in:dplyr:pull.data.frame, type: Function, def. @7)}
    %%   rbind.grouped_df:                                      {**dplyr::rbind.grouped_df** (id: built-in:dplyr:rbind.grouped_df, type: Function, def. @7)}
    %%   rbind.rowwise_df:                                      {**dplyr::rbind.rowwise_df** (id: built-in:dplyr:rbind.rowwise_df, type: Function, def. @7)}
    %%   recode:                                                {**dplyr::recode** (id: built-in:dplyr:recode, type: Function, def. @7)}
    %%   recode_default.default:                                {**dplyr::recode_default.default** (id: built-in:dplyr:recode_default.default, type: Function, def. @7)}
    %%   recode_default.factor:                                 {**dplyr::recode_default.factor** (id: built-in:dplyr:recode_default.factor, type: Function, def. @7)}
    %%   recode_factor:                                         {**dplyr::recode_factor** (id: built-in:dplyr:recode_factor, type: Function, def. @7)}
    %%   recode_values:                                         {**dplyr::recode_values** (id: built-in:dplyr:recode_values, type: Function, def. @7)}
    %%   recode.character:                                      {**dplyr::recode.character** (id: built-in:dplyr:recode.character, type: Function, def. @7)}
    %%   recode.factor:                                         {**dplyr::recode.factor** (id: built-in:dplyr:recode.factor, type: Function, def. @7)}
    %%   recode.numeric:                                        {**dplyr::recode.numeric** (id: built-in:dplyr:recode.numeric, type: Function, def. @7)}
    %%   reframe:                                               {**dplyr::reframe** (id: built-in:dplyr:reframe, type: Function, def. @7)}
    %%   reframe.data.frame:                                    {**dplyr::reframe.data.frame** (id: built-in:dplyr:reframe.data.frame, type: Function, def. @7)}
    %%   relocate:                                              {**dplyr::relocate** (id: built-in:dplyr:relocate, type: Function, def. @7)}
    %%   relocate.data.frame:                                   {**dplyr::relocate.data.frame** (id: built-in:dplyr:relocate.data.frame, type: Function, def. @7)}
    %%   rename:                                                {**dplyr::rename** (id: built-in:dplyr:rename, type: Function, def. @7)}
    %%   rename_:                                               {**dplyr::rename_** (id: built-in:dplyr:rename_, type: Function, def. @7)}
    %%   rename_all:                                            {**dplyr::rename_all** (id: built-in:dplyr:rename_all, type: Function, def. @7)}
    %%   rename_at:                                             {**dplyr::rename_at** (id: built-in:dplyr:rename_at, type: Function, def. @7)}
    %%   rename_if:                                             {**dplyr::rename_if** (id: built-in:dplyr:rename_if, type: Function, def. @7)}
    %%   rename_with:                                           {**dplyr::rename_with** (id: built-in:dplyr:rename_with, type: Function, def. @7)}
    %%   rename_with.data.frame:                                {**dplyr::rename_with.data.frame** (id: built-in:dplyr:rename_with.data.frame, type: Function, def. @7)}
    %%   rename.data.frame:                                     {**dplyr::rename.data.frame** (id: built-in:dplyr:rename.data.frame, type: Function, def. @7)}
    %%   replace_values:                                        {**dplyr::replace_values** (id: built-in:dplyr:replace_values, type: Function, def. @7)}
    %%   replace_when:                                          {**dplyr::replace_when** (id: built-in:dplyr:replace_when, type: Function, def. @7)}
    %%   right_join:                                            {**dplyr::right_join** (id: built-in:dplyr:right_join, type: Function, def. @7)}
    %%   right_join.data.frame:                                 {**dplyr::right_join.data.frame** (id: built-in:dplyr:right_join.data.frame, type: Function, def. @7)}
    %%   row_number:                                            {**dplyr::row_number** (id: built-in:dplyr:row_number, type: Function, def. @7)}
    %%   rows_append:                                           {**dplyr::rows_append** (id: built-in:dplyr:rows_append, type: Function, def. @7)}
    %%   rows_append.data.frame:                                {**dplyr::rows_append.data.frame** (id: built-in:dplyr:rows_append.data.frame, type: Function, def. @7)}
    %%   rows_delete:                                           {**dplyr::rows_delete** (id: built-in:dplyr:rows_delete, type: Function, def. @7)}
    %%   rows_delete.data.frame:                                {**dplyr::rows_delete.data.frame** (id: built-in:dplyr:rows_delete.data.frame, type: Function, def. @7)}
    %%   rows_insert:                                           {**dplyr::rows_insert** (id: built-in:dplyr:rows_insert, type: Function, def. @7)}
    %%   rows_insert.data.frame:                                {**dplyr::rows_insert.data.frame** (id: built-in:dplyr:rows_insert.data.frame, type: Function, def. @7)}
    %%   rows_patch:                                            {**dplyr::rows_patch** (id: built-in:dplyr:rows_patch, type: Function, def. @7)}
    %%   rows_patch.data.frame:                                 {**dplyr::rows_patch.data.frame** (id: built-in:dplyr:rows_patch.data.frame, type: Function, def. @7)}
    %%   rows_update:                                           {**dplyr::rows_update** (id: built-in:dplyr:rows_update, type: Function, def. @7)}
    %%   rows_update.data.frame:                                {**dplyr::rows_update.data.frame** (id: built-in:dplyr:rows_update.data.frame, type: Function, def. @7)}
    %%   rows_upsert:                                           {**dplyr::rows_upsert** (id: built-in:dplyr:rows_upsert, type: Function, def. @7)}
    %%   rows_upsert.data.frame:                                {**dplyr::rows_upsert.data.frame** (id: built-in:dplyr:rows_upsert.data.frame, type: Function, def. @7)}
    %%   rowwise:                                               {**dplyr::rowwise** (id: built-in:dplyr:rowwise, type: Function, def. @7)}
    %%   rowwise.data.frame:                                    {**dplyr::rowwise.data.frame** (id: built-in:dplyr:rowwise.data.frame, type: Function, def. @7)}
    %%   rowwise.grouped_df:                                    {**dplyr::rowwise.grouped_df** (id: built-in:dplyr:rowwise.grouped_df, type: Function, def. @7)}
    %%   same_src:                                              {**dplyr::same_src** (id: built-in:dplyr:same_src, type: Function, def. @7)}
    %%   same_src.data.frame:                                   {**dplyr::same_src.data.frame** (id: built-in:dplyr:same_src.data.frame, type: Function, def. @7)}
    %%   sample_frac:                                           {**dplyr::sample_frac** (id: built-in:dplyr:sample_frac, type: Function, def. @7)}
    %%   sample_frac.data.frame:                                {**dplyr::sample_frac.data.frame** (id: built-in:dplyr:sample_frac.data.frame, type: Function, def. @7)}
    %%   sample_frac.default:                                   {**dplyr::sample_frac.default** (id: built-in:dplyr:sample_frac.default, type: Function, def. @7)}
    %%   sample_n:                                              {**dplyr::sample_n** (id: built-in:dplyr:sample_n, type: Function, def. @7)}
    %%   sample_n.data.frame:                                   {**dplyr::sample_n.data.frame** (id: built-in:dplyr:sample_n.data.frame, type: Function, def. @7)}
    %%   sample_n.default:                                      {**dplyr::sample_n.default** (id: built-in:dplyr:sample_n.default, type: Function, def. @7)}
    %%   select:                                                {**dplyr::select** (id: built-in:dplyr:select, type: Function, def. @7)}
    %%   select_:                                               {**dplyr::select_** (id: built-in:dplyr:select_, type: Function, def. @7)}
    %%   select_all:                                            {**dplyr::select_all** (id: built-in:dplyr:select_all, type: Function, def. @7)}
    %%   select_at:                                             {**dplyr::select_at** (id: built-in:dplyr:select_at, type: Function, def. @7)}
    %%   select_if:                                             {**dplyr::select_if** (id: built-in:dplyr:select_if, type: Function, def. @7)}
    %%   select.data.frame:                                     {**dplyr::select.data.frame** (id: built-in:dplyr:select.data.frame, type: Function, def. @7)}
    %%   select.list:                                           {**dplyr::select.list** (id: built-in:dplyr:select.list, type: Function, def. @7)}
    %%   semi_join:                                             {**dplyr::semi_join** (id: built-in:dplyr:semi_join, type: Function, def. @7)}
    %%   semi_join.data.frame:                                  {**dplyr::semi_join.data.frame** (id: built-in:dplyr:semi_join.data.frame, type: Function, def. @7)}
    %%   setdiff.data.frame:                                    {**dplyr::setdiff.data.frame** (id: built-in:dplyr:setdiff.data.frame, type: Function, def. @7)}
    %%   setequal.data.frame:                                   {**dplyr::setequal.data.frame** (id: built-in:dplyr:setequal.data.frame, type: Function, def. @7)}
    %%   show_query:                                            {**dplyr::show_query** (id: built-in:dplyr:show_query, type: Function, def. @7)}
    %%   slice:                                                 {**dplyr::slice** (id: built-in:dplyr:slice, type: Function, def. @7)}
    %%   slice_:                                                {**dplyr::slice_** (id: built-in:dplyr:slice_, type: Function, def. @7)}
    %%   slice_head:                                            {**dplyr::slice_head** (id: built-in:dplyr:slice_head, type: Function, def. @7)}
    %%   slice_head.data.frame:                                 {**dplyr::slice_head.data.frame** (id: built-in:dplyr:slice_head.data.frame, type: Function, def. @7)}
    %%   slice_max:                                             {**dplyr::slice_max** (id: built-in:dplyr:slice_max, type: Function, def. @7)}
    %%   slice_max.data.frame:                                  {**dplyr::slice_max.data.frame** (id: built-in:dplyr:slice_max.data.frame, type: Function, def. @7)}
    %%   slice_min:                                             {**dplyr::slice_min** (id: built-in:dplyr:slice_min, type: Function, def. @7)}
    %%   slice_min.data.frame:                                  {**dplyr::slice_min.data.frame** (id: built-in:dplyr:slice_min.data.frame, type: Function, def. @7)}
    %%   slice_sample:                                          {**dplyr::slice_sample** (id: built-in:dplyr:slice_sample, type: Function, def. @7)}
    %%   slice_sample.data.frame:                               {**dplyr::slice_sample.data.frame** (id: built-in:dplyr:slice_sample.data.frame, type: Function, def. @7)}
    %%   slice_tail:                                            {**dplyr::slice_tail** (id: built-in:dplyr:slice_tail, type: Function, def. @7)}
    %%   slice_tail.data.frame:                                 {**dplyr::slice_tail.data.frame** (id: built-in:dplyr:slice_tail.data.frame, type: Function, def. @7)}
    %%   slice.data.frame:                                      {**dplyr::slice.data.frame** (id: built-in:dplyr:slice.data.frame, type: Function, def. @7)}
    %%   sql:                                                   {**dplyr::sql** (id: built-in:dplyr:sql, type: Function, def. @7)}
    %%   sql_escape_ident:                                      {**dplyr::sql_escape_ident** (id: built-in:dplyr:sql_escape_ident, type: Function, def. @7)}
    %%   sql_escape_string:                                     {**dplyr::sql_escape_string** (id: built-in:dplyr:sql_escape_string, type: Function, def. @7)}
    %%   sql_join:                                              {**dplyr::sql_join** (id: built-in:dplyr:sql_join, type: Function, def. @7)}
    %%   sql_select:                                            {**dplyr::sql_select** (id: built-in:dplyr:sql_select, type: Function, def. @7)}
    %%   sql_semi_join:                                         {**dplyr::sql_semi_join** (id: built-in:dplyr:sql_semi_join, type: Function, def. @7)}
    %%   sql_set_op:                                            {**dplyr::sql_set_op** (id: built-in:dplyr:sql_set_op, type: Function, def. @7)}
    %%   sql_subquery:                                          {**dplyr::sql_subquery** (id: built-in:dplyr:sql_subquery, type: Function, def. @7)}
    %%   sql_translate_env:                                     {**dplyr::sql_translate_env** (id: built-in:dplyr:sql_translate_env, type: Function, def. @7)}
    %%   src:                                                   {**dplyr::src** (id: built-in:dplyr:src, type: Function, def. @7)}
    %%   src_df:                                                {**dplyr::src_df** (id: built-in:dplyr:src_df, type: Function, def. @7)}
    %%   src_local:                                             {**dplyr::src_local** (id: built-in:dplyr:src_local, type: Function, def. @7)}
    %%   src_mysql:                                             {**dplyr::src_mysql** (id: built-in:dplyr:src_mysql, type: Function, def. @7)}
    %%   src_postgres:                                          {**dplyr::src_postgres** (id: built-in:dplyr:src_postgres, type: Function, def. @7)}
    %%   src_sqlite:                                            {**dplyr::src_sqlite** (id: built-in:dplyr:src_sqlite, type: Function, def. @7)}
    %%   src_tbls:                                              {**dplyr::src_tbls** (id: built-in:dplyr:src_tbls, type: Function, def. @7)}
    %%   summarise:                                             {**dplyr::summarise** (id: built-in:dplyr:summarise, type: Function, def. @7)}
    %%   summarise_:                                            {**dplyr::summarise_** (id: built-in:dplyr:summarise_, type: Function, def. @7)}
    %%   summarise_all:                                         {**dplyr::summarise_all** (id: built-in:dplyr:summarise_all, type: Function, def. @7)}
    %%   summarise_at:                                          {**dplyr::summarise_at** (id: built-in:dplyr:summarise_at, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::reframe_incompatible_size:   {**dplyr::summarise_bullets.dplyr:::reframe_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::reframe_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_incompatible_size: {**dplyr::summarise_bullets.dplyr:::summarise_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_mixed_null:        {**dplyr::summarise_bullets.dplyr:::summarise_mixed_null** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_mixed_null, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_unsupported_type:  {**dplyr::summarise_bullets.dplyr:::summarise_unsupported_type** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_unsupported_type, type: Function, def. @7)}
    %%   summarise_each:                                        {**dplyr::summarise_each** (id: built-in:dplyr:summarise_each, type: Function, def. @7)}
    %%   summarise_each_:                                       {**dplyr::summarise_each_** (id: built-in:dplyr:summarise_each_, type: Function, def. @7)}
    %%   summarise_if:                                          {**dplyr::summarise_if** (id: built-in:dplyr:summarise_if, type: Function, def. @7)}
    %%   summarise.data.frame:                                  {**dplyr::summarise.data.frame** (id: built-in:dplyr:summarise.data.frame, type: Function, def. @7)}
    %%   summarise.grouped_df:                                  {**dplyr::summarise.grouped_df** (id: built-in:dplyr:summarise.grouped_df, type: Function, def. @7)}
    %%   summarise.rowwise_df:                                  {**dplyr::summarise.rowwise_df** (id: built-in:dplyr:summarise.rowwise_df, type: Function, def. @7)}
    %%   summarize:                                             {**dplyr::summarize** (id: built-in:dplyr:summarize, type: Function, def. @7)}
    %%   summarize_:                                            {**dplyr::summarize_** (id: built-in:dplyr:summarize_, type: Function, def. @7)}
    %%   summarize_all:                                         {**dplyr::summarize_all** (id: built-in:dplyr:summarize_all, type: Function, def. @7)}
    %%   summarize_at:                                          {**dplyr::summarize_at** (id: built-in:dplyr:summarize_at, type: Function, def. @7)}
    %%   summarize_each:                                        {**dplyr::summarize_each** (id: built-in:dplyr:summarize_each, type: Function, def. @7)}
    %%   summarize_each_:                                       {**dplyr::summarize_each_** (id: built-in:dplyr:summarize_each_, type: Function, def. @7)}
    %%   summarize_if:                                          {**dplyr::summarize_if** (id: built-in:dplyr:summarize_if, type: Function, def. @7)}
    %%   symdiff:                                               {**dplyr::symdiff** (id: built-in:dplyr:symdiff, type: Function, def. @7)}
    %%   symdiff.data.frame:                                    {**dplyr::symdiff.data.frame** (id: built-in:dplyr:symdiff.data.frame, type: Function, def. @7)}
    %%   symdiff.default:                                       {**dplyr::symdiff.default** (id: built-in:dplyr:symdiff.default, type: Function, def. @7)}
    %%   tally:                                                 {**dplyr::tally** (id: built-in:dplyr:tally, type: Function, def. @7)}
    %%   tally_:                                                {**dplyr::tally_** (id: built-in:dplyr:tally_, type: Function, def. @7)}
    %%   tally.data.frame:                                      {**dplyr::tally.data.frame** (id: built-in:dplyr:tally.data.frame, type: Function, def. @7)}
    %%   tbl:                                                   {**dplyr::tbl** (id: built-in:dplyr:tbl, type: Function, def. @7)}
    %%   tbl_df:                                                {**dplyr::tbl_df** (id: built-in:dplyr:tbl_df, type: Function, def. @7)}
    %%   tbl_nongroup_vars:                                     {**dplyr::tbl_nongroup_vars** (id: built-in:dplyr:tbl_nongroup_vars, type: Function, def. @7)}
    %%   tbl_ptype:                                             {**dplyr::tbl_ptype** (id: built-in:dplyr:tbl_ptype, type: Function, def. @7)}
    %%   tbl_ptype.default:                                     {**dplyr::tbl_ptype.default** (id: built-in:dplyr:tbl_ptype.default, type: Function, def. @7)}
    %%   tbl_sum.grouped_df:                                    {**dplyr::tbl_sum.grouped_df** (id: built-in:dplyr:tbl_sum.grouped_df, type: Function, def. @7)}
    %%   tbl_sum.rowwise_df:                                    {**dplyr::tbl_sum.rowwise_df** (id: built-in:dplyr:tbl_sum.rowwise_df, type: Function, def. @7)}
    %%   tbl_vars:                                              {**dplyr::tbl_vars** (id: built-in:dplyr:tbl_vars, type: Function, def. @7)}
    %%   tbl_vars.data.frame:                                   {**dplyr::tbl_vars.data.frame** (id: built-in:dplyr:tbl_vars.data.frame, type: Function, def. @7)}
    %%   tbl.DBIConnection:                                     {**dplyr::tbl.DBIConnection** (id: built-in:dplyr:tbl.DBIConnection, type: Function, def. @7)}
    %%   top_frac:                                              {**dplyr::top_frac** (id: built-in:dplyr:top_frac, type: Function, def. @7)}
    %%   top_n:                                                 {**dplyr::top_n** (id: built-in:dplyr:top_n, type: Function, def. @7)}
    %%   transmute:                                             {**dplyr::transmute** (id: built-in:dplyr:transmute, type: Function, def. @7)}
    %%   transmute_:                                            {**dplyr::transmute_** (id: built-in:dplyr:transmute_, type: Function, def. @7)}
    %%   transmute_all:                                         {**dplyr::transmute_all** (id: built-in:dplyr:transmute_all, type: Function, def. @7)}
    %%   transmute_at:                                          {**dplyr::transmute_at** (id: built-in:dplyr:transmute_at, type: Function, def. @7)}
    %%   transmute_if:                                          {**dplyr::transmute_if** (id: built-in:dplyr:transmute_if, type: Function, def. @7)}
    %%   transmute.data.frame:                                  {**dplyr::transmute.data.frame** (id: built-in:dplyr:transmute.data.frame, type: Function, def. @7)}
    %%   ungroup:                                               {**dplyr::ungroup** (id: built-in:dplyr:ungroup, type: Function, def. @7)}
    %%   ungroup.data.frame:                                    {**dplyr::ungroup.data.frame** (id: built-in:dplyr:ungroup.data.frame, type: Function, def. @7)}
    %%   ungroup.grouped_df:                                    {**dplyr::ungroup.grouped_df** (id: built-in:dplyr:ungroup.grouped_df, type: Function, def. @7)}
    %%   ungroup.rowwise_df:                                    {**dplyr::ungroup.rowwise_df** (id: built-in:dplyr:ungroup.rowwise_df, type: Function, def. @7)}
    %%   union_all:                                             {**dplyr::union_all** (id: built-in:dplyr:union_all, type: Function, def. @7)}
    %%   union_all.data.frame:                                  {**dplyr::union_all.data.frame** (id: built-in:dplyr:union_all.data.frame, type: Function, def. @7)}
    %%   union_all.default:                                     {**dplyr::union_all.default** (id: built-in:dplyr:union_all.default, type: Function, def. @7)}
    %%   union.data.frame:                                      {**dplyr::union.data.frame** (id: built-in:dplyr:union.data.frame, type: Function, def. @7)}
    %%   validate_grouped_df:                                   {**dplyr::validate_grouped_df** (id: built-in:dplyr:validate_grouped_df, type: Function, def. @7)}
    %%   validate_rowwise_df:                                   {**dplyr::validate_rowwise_df** (id: built-in:dplyr:validate_rowwise_df, type: Function, def. @7)}
    %%   vars:                                                  {**dplyr::vars** (id: built-in:dplyr:vars, type: Function, def. @7)}
    %%   when_all:                                              {**dplyr::when_all** (id: built-in:dplyr:when_all, type: Function, def. @7)}
    %%   when_any:                                              {**dplyr::when_any** (id: built-in:dplyr:when_any, type: Function, def. @7)}
    %%   with_groups:                                           {**dplyr::with_groups** (id: built-in:dplyr:with_groups, type: Function, def. @7)}
    %%   with_order:                                            {**dplyr::with_order** (id: built-in:dplyr:with_order, type: Function, def. @7)}
    %%   wrap_dbplyr_obj:                                       {**dplyr::wrap_dbplyr_obj** (id: built-in:dplyr:wrap_dbplyr_obj, type: Function, def. @7)}
    %%   %>%:                                                   {**dplyr::%>%** (id: built-in:dplyr:%>%, type: Function, def. @7)}
    %%   add_row:                                               {**dplyr::add_row** (id: built-in:dplyr:add_row, type: Function, def. @7)}
    %%   all_of:                                                {**dplyr::all_of** (id: built-in:dplyr:all_of, type: Function, def. @7)}
    %%   any_of:                                                {**dplyr::any_of** (id: built-in:dplyr:any_of, type: Function, def. @7)}
    %%   as_data_frame:                                         {**dplyr::as_data_frame** (id: built-in:dplyr:as_data_frame, type: Function, def. @7)}
    %%   as_label:                                              {**dplyr::as_label** (id: built-in:dplyr:as_label, type: Function, def. @7)}
    %%   as_tibble:                                             {**dplyr::as_tibble** (id: built-in:dplyr:as_tibble, type: Function, def. @7)}
    %%   contains:                                              {**dplyr::contains** (id: built-in:dplyr:contains, type: Function, def. @7)}
    %%   data_frame:                                            {**dplyr::data_frame** (id: built-in:dplyr:data_frame, type: Function, def. @7)}
    %%   ends_with:                                             {**dplyr::ends_with** (id: built-in:dplyr:ends_with, type: Function, def. @7)}
    %%   enexpr:                                                {**dplyr::enexpr** (id: built-in:dplyr:enexpr, type: Function, def. @7)}
    %%   enexprs:                                               {**dplyr::enexprs** (id: built-in:dplyr:enexprs, type: Function, def. @7)}
    %%   enquo:                                                 {**dplyr::enquo** (id: built-in:dplyr:enquo, type: Function, def. @7)}
    %%   enquos:                                                {**dplyr::enquos** (id: built-in:dplyr:enquos, type: Function, def. @7)}
    %%   ensym:                                                 {**dplyr::ensym** (id: built-in:dplyr:ensym, type: Function, def. @7)}
    %%   ensyms:                                                {**dplyr::ensyms** (id: built-in:dplyr:ensyms, type: Function, def. @7)}
    %%   everything:                                            {**dplyr::everything** (id: built-in:dplyr:everything, type: Function, def. @7)}
    %%   expr:                                                  {**dplyr::expr** (id: built-in:dplyr:expr, type: Function, def. @7)}
    %%   glimpse:                                               {**dplyr::glimpse** (id: built-in:dplyr:glimpse, type: Function, def. @7)}
    %%   intersect:                                             {**dplyr::intersect** (id: built-in:dplyr:intersect, type: Function, def. @7)}
    %%   last_col:                                              {**dplyr::last_col** (id: built-in:dplyr:last_col, type: Function, def. @7)}
    %%   lst:                                                   {**dplyr::lst** (id: built-in:dplyr:lst, type: Function, def. @7)}
    %%   matches:                                               {**dplyr::matches** (id: built-in:dplyr:matches, type: Function, def. @7)}
    %%   num_range:                                             {**dplyr::num_range** (id: built-in:dplyr:num_range, type: Function, def. @7)}
    %%   one_of:                                                {**dplyr::one_of** (id: built-in:dplyr:one_of, type: Function, def. @7)}
    %%   quo:                                                   {**dplyr::quo** (id: built-in:dplyr:quo, type: Function, def. @7)}
    %%   quo_name:                                              {**dplyr::quo_name** (id: built-in:dplyr:quo_name, type: Function, def. @7)}
    %%   quos:                                                  {**dplyr::quos** (id: built-in:dplyr:quos, type: Function, def. @7)}
    %%   setdiff:                                               {**dplyr::setdiff** (id: built-in:dplyr:setdiff, type: Function, def. @7)}
    %%   setequal:                                              {**dplyr::setequal** (id: built-in:dplyr:setequal, type: Function, def. @7)}
    %%   starts_with:                                           {**dplyr::starts_with** (id: built-in:dplyr:starts_with, type: Function, def. @7)}
    %%   sym:                                                   {**dplyr::sym** (id: built-in:dplyr:sym, type: Function, def. @7)}
    %%   syms:                                                  {**dplyr::syms** (id: built-in:dplyr:syms, type: Function, def. @7)}
    %%   tibble:                                                {**dplyr::tibble** (id: built-in:dplyr:tibble, type: Function, def. @7)}
    %%   tribble:                                               {**dplyr::tribble** (id: built-in:dplyr:tribble, type: Function, def. @7)}
    %%   type_sum:                                              {**dplyr::type_sum** (id: built-in:dplyr:type_sum, type: Function, def. @7)}
    %%   union:                                                 {**dplyr::union** (id: built-in:dplyr:union, type: Function, def. @7)}
    %%   where:                                                 {**dplyr::where** (id: built-in:dplyr:where, type: Function, def. @7)}
    %%   id:                                                    {**dplyr::id** (id: built-in:dplyr:id, type: Function, def. @7)}
    %%   select_vars_:                                          {**dplyr::select_vars_** (id: built-in:dplyr:select_vars_, type: Function, def. @7)}
    %%   rename_vars_:                                          {**dplyr::rename_vars_** (id: built-in:dplyr:rename_vars_, type: Function, def. @7)}
    %%   changes:                                               {**dplyr::changes** (id: built-in:dplyr:changes, type: Function, def. @7)}
    %%   location:                                              {**dplyr::location** (id: built-in:dplyr:location, type: Function, def. @7)}
    %%   eval_tbls2:                                            {**dplyr::eval_tbls2** (id: built-in:dplyr:eval_tbls2, type: Function, def. @7)}
    %%   eval_tbls:                                             {**dplyr::eval_tbls** (id: built-in:dplyr:eval_tbls, type: Function, def. @7)}
    %%   compare_tbls2:                                         {**dplyr::compare_tbls2** (id: built-in:dplyr:compare_tbls2, type: Function, def. @7)}
    %%   compare_tbls:                                          {**dplyr::compare_tbls** (id: built-in:dplyr:compare_tbls, type: Function, def. @7)}
    %%   bench_tbls:                                            {**dplyr::bench_tbls** (id: built-in:dplyr:bench_tbls, type: Function, def. @7)}
    %%   current_vars:                                          {**dplyr::current_vars** (id: built-in:dplyr:current_vars, type: Function, def. @7)}
    %%   select_var:                                            {**dplyr::select_var** (id: built-in:dplyr:select_var, type: Function, def. @7)}
    %%   rename_vars:                                           {**dplyr::rename_vars** (id: built-in:dplyr:rename_vars, type: Function, def. @7)}
    %%   select_vars:                                           {**dplyr::select_vars** (id: built-in:dplyr:select_vars, type: Function, def. @7)}
    %%   failwith:                                              {**dplyr::failwith** (id: built-in:dplyr:failwith, type: Function, def. @7)}
    %% 4----------------------------------------
    %% 5----------------------------------------
    %%   [.spec_tbl_df:                      {**readr::[.spec_tbl_df** (id: built-in:readr:[.spec_tbl_df, type: Function, def. @11)}
    %%   AccumulateCallback:                 {**readr::AccumulateCallback** (id: built-in:readr:AccumulateCallback, type: Function, def. @11)}
    %%   as_chunk_callback.ChunkCallback:    {**readr::as_chunk_callback.ChunkCallback** (id: built-in:readr:as_chunk_callback.ChunkCallback, type: Function, def. @11)}
    %%   as_chunk_callback.function:         {**readr::as_chunk_callback.function** (id: built-in:readr:as_chunk_callback.function, type: Function, def. @11)}
    %%   as_chunk_callback.R6ClassGenerator: {**readr::as_chunk_callback.R6ClassGenerator** (id: built-in:readr:as_chunk_callback.R6ClassGenerator, type: Function, def. @11)}
    %%   as_tibble.spec_tbl_df:              {**readr::as_tibble.spec_tbl_df** (id: built-in:readr:as_tibble.spec_tbl_df, type: Function, def. @11)}
    %%   as.character.col_spec:              {**readr::as.character.col_spec** (id: built-in:readr:as.character.col_spec, type: Function, def. @11)}
    %%   as.col_spec:                        {**readr::as.col_spec** (id: built-in:readr:as.col_spec, type: Function, def. @11)}
    %%   as.col_spec.character:              {**readr::as.col_spec.character** (id: built-in:readr:as.col_spec.character, type: Function, def. @11)}
    %%   as.col_spec.col_spec:               {**readr::as.col_spec.col_spec** (id: built-in:readr:as.col_spec.col_spec, type: Function, def. @11)}
    %%   as.col_spec.data.frame:             {**readr::as.col_spec.data.frame** (id: built-in:readr:as.col_spec.data.frame, type: Function, def. @11)}
    %%   as.col_spec.default:                {**readr::as.col_spec.default** (id: built-in:readr:as.col_spec.default, type: Function, def. @11)}
    %%   as.col_spec.list:                   {**readr::as.col_spec.list** (id: built-in:readr:as.col_spec.list, type: Function, def. @11)}
    %%   as.col_spec.NULL:                   {**readr::as.col_spec.NULL** (id: built-in:readr:as.col_spec.NULL, type: Function, def. @11)}
    %%   as.data.frame.spec_tbl_df:          {**readr::as.data.frame.spec_tbl_df** (id: built-in:readr:as.data.frame.spec_tbl_df, type: Function, def. @11)}
    %%   ChunkCallback:                      {**readr::ChunkCallback** (id: built-in:readr:ChunkCallback, type: Function, def. @11)}
    %%   clipboard:                          {**readr::clipboard** (id: built-in:readr:clipboard, type: Function, def. @11)}
    %%   col_character:                      {**readr::col_character** (id: built-in:readr:col_character, type: Function, def. @11)}
    %%   col_date:                           {**readr::col_date** (id: built-in:readr:col_date, type: Function, def. @11)}
    %%   col_datetime:                       {**readr::col_datetime** (id: built-in:readr:col_datetime, type: Function, def. @11)}
    %%   col_double:                         {**readr::col_double** (id: built-in:readr:col_double, type: Function, def. @11)}
    %%   col_factor:                         {**readr::col_factor** (id: built-in:readr:col_factor, type: Function, def. @11)}
    %%   col_guess:                          {**readr::col_guess** (id: built-in:readr:col_guess, type: Function, def. @11)}
    %%   col_integer:                        {**readr::col_integer** (id: built-in:readr:col_integer, type: Function, def. @11)}
    %%   col_logical:                        {**readr::col_logical** (id: built-in:readr:col_logical, type: Function, def. @11)}
    %%   col_number:                         {**readr::col_number** (id: built-in:readr:col_number, type: Function, def. @11)}
    %%   col_skip:                           {**readr::col_skip** (id: built-in:readr:col_skip, type: Function, def. @11)}
    %%   col_time:                           {**readr::col_time** (id: built-in:readr:col_time, type: Function, def. @11)}
    %%   cols:                               {**readr::cols** (id: built-in:readr:cols, type: Function, def. @11)}
    %%   cols_condense:                      {**readr::cols_condense** (id: built-in:readr:cols_condense, type: Function, def. @11)}
    %%   cols_only:                          {**readr::cols_only** (id: built-in:readr:cols_only, type: Function, def. @11)}
    %%   count_fields:                       {**readr::count_fields** (id: built-in:readr:count_fields, type: Function, def. @11)}
    %%   DataFrameCallback:                  {**readr::DataFrameCallback** (id: built-in:readr:DataFrameCallback, type: Function, def. @11)}
    %%   datasource:                         {**readr::datasource** (id: built-in:readr:datasource, type: Function, def. @11)}
    %%   date_names:                         {**readr::date_names** (id: built-in:readr:date_names, type: Function, def. @11)}
    %%   date_names_lang:                    {**readr::date_names_lang** (id: built-in:readr:date_names_lang, type: Function, def. @11)}
    %%   date_names_langs:                   {**readr::date_names_langs** (id: built-in:readr:date_names_langs, type: Function, def. @11)}
    %%   default_locale:                     {**readr::default_locale** (id: built-in:readr:default_locale, type: Function, def. @11)}
    %%   edition_get:                        {**readr::edition_get** (id: built-in:readr:edition_get, type: Function, def. @11)}
    %%   format_csv:                         {**readr::format_csv** (id: built-in:readr:format_csv, type: Function, def. @11)}
    %%   format_csv2:                        {**readr::format_csv2** (id: built-in:readr:format_csv2, type: Function, def. @11)}
    %%   format_delim:                       {**readr::format_delim** (id: built-in:readr:format_delim, type: Function, def. @11)}
    %%   format_tsv:                         {**readr::format_tsv** (id: built-in:readr:format_tsv, type: Function, def. @11)}
    %%   format.col_spec:                    {**readr::format.col_spec** (id: built-in:readr:format.col_spec, type: Function, def. @11)}
    %%   fwf_cols:                           {**readr::fwf_cols** (id: built-in:readr:fwf_cols, type: Function, def. @11)}
    %%   fwf_empty:                          {**readr::fwf_empty** (id: built-in:readr:fwf_empty, type: Function, def. @11)}
    %%   fwf_positions:                      {**readr::fwf_positions** (id: built-in:readr:fwf_positions, type: Function, def. @11)}
    %%   fwf_widths:                         {**readr::fwf_widths** (id: built-in:readr:fwf_widths, type: Function, def. @11)}
    %%   guess_encoding:                     {**readr::guess_encoding** (id: built-in:readr:guess_encoding, type: Function, def. @11)}
    %%   guess_parser:                       {**readr::guess_parser** (id: built-in:readr:guess_parser, type: Function, def. @11)}
    %%   ListCallback:                       {**readr::ListCallback** (id: built-in:readr:ListCallback, type: Function, def. @11)}
    %%   local_edition:                      {**readr::local_edition** (id: built-in:readr:local_edition, type: Function, def. @11)}
    %%   locale:                             {**readr::locale** (id: built-in:readr:locale, type: Function, def. @11)}
    %%   output_column:                      {**readr::output_column** (id: built-in:readr:output_column, type: Function, def. @11)}
    %%   output_column.default:              {**readr::output_column.default** (id: built-in:readr:output_column.default, type: Function, def. @11)}
    %%   output_column.double:               {**readr::output_column.double** (id: built-in:readr:output_column.double, type: Function, def. @11)}
    %%   output_column.POSIXt:               {**readr::output_column.POSIXt** (id: built-in:readr:output_column.POSIXt, type: Function, def. @11)}
    %%   parse_character:                    {**readr::parse_character** (id: built-in:readr:parse_character, type: Function, def. @11)}
    %%   parse_date:                         {**readr::parse_date** (id: built-in:readr:parse_date, type: Function, def. @11)}
    %%   parse_datetime:                     {**readr::parse_datetime** (id: built-in:readr:parse_datetime, type: Function, def. @11)}
    %%   parse_double:                       {**readr::parse_double** (id: built-in:readr:parse_double, type: Function, def. @11)}
    %%   parse_factor:                       {**readr::parse_factor** (id: built-in:readr:parse_factor, type: Function, def. @11)}
    %%   parse_guess:                        {**readr::parse_guess** (id: built-in:readr:parse_guess, type: Function, def. @11)}
    %%   parse_integer:                      {**readr::parse_integer** (id: built-in:readr:parse_integer, type: Function, def. @11)}
    %%   parse_logical:                      {**readr::parse_logical** (id: built-in:readr:parse_logical, type: Function, def. @11)}
    %%   parse_number:                       {**readr::parse_number** (id: built-in:readr:parse_number, type: Function, def. @11)}
    %%   parse_time:                         {**readr::parse_time** (id: built-in:readr:parse_time, type: Function, def. @11)}
    %%   parse_vector:                       {**readr::parse_vector** (id: built-in:readr:parse_vector, type: Function, def. @11)}
    %%   print.col_spec:                     {**readr::print.col_spec** (id: built-in:readr:print.col_spec, type: Function, def. @11)}
    %%   print.collector:                    {**readr::print.collector** (id: built-in:readr:print.collector, type: Function, def. @11)}
    %%   print.date_names:                   {**readr::print.date_names** (id: built-in:readr:print.date_names, type: Function, def. @11)}
    %%   print.locale:                       {**readr::print.locale** (id: built-in:readr:print.locale, type: Function, def. @11)}
    %%   problems:                           {**readr::problems** (id: built-in:readr:problems, type: Function, def. @11)}
    %%   read_builtin:                       {**readr::read_builtin** (id: built-in:readr:read_builtin, type: Function, def. @11)}
    %%   read_csv:                           {**readr::read_csv** (id: built-in:readr:read_csv, type: Function, def. @11)}
    %%   read_csv_chunked:                   {**readr::read_csv_chunked** (id: built-in:readr:read_csv_chunked, type: Function, def. @11)}
    %%   read_csv2:                          {**readr::read_csv2** (id: built-in:readr:read_csv2, type: Function, def. @11)}
    %%   read_csv2_chunked:                  {**readr::read_csv2_chunked** (id: built-in:readr:read_csv2_chunked, type: Function, def. @11)}
    %%   read_delim:                         {**readr::read_delim** (id: built-in:readr:read_delim, type: Function, def. @11)}
    %%   read_delim_chunked:                 {**readr::read_delim_chunked** (id: built-in:readr:read_delim_chunked, type: Function, def. @11)}
    %%   read_file:                          {**readr::read_file** (id: built-in:readr:read_file, type: Function, def. @11)}
    %%   read_file_raw:                      {**readr::read_file_raw** (id: built-in:readr:read_file_raw, type: Function, def. @11)}
    %%   read_fwf:                           {**readr::read_fwf** (id: built-in:readr:read_fwf, type: Function, def. @11)}
    %%   read_lines:                         {**readr::read_lines** (id: built-in:readr:read_lines, type: Function, def. @11)}
    %%   read_lines_chunked:                 {**readr::read_lines_chunked** (id: built-in:readr:read_lines_chunked, type: Function, def. @11)}
    %%   read_lines_raw:                     {**readr::read_lines_raw** (id: built-in:readr:read_lines_raw, type: Function, def. @11)}
    %%   read_lines_raw_chunked:             {**readr::read_lines_raw_chunked** (id: built-in:readr:read_lines_raw_chunked, type: Function, def. @11)}
    %%   read_log:                           {**readr::read_log** (id: built-in:readr:read_log, type: Function, def. @11)}
    %%   read_rds:                           {**readr::read_rds** (id: built-in:readr:read_rds, type: Function, def. @11)}
    %%   read_table:                         {**readr::read_table** (id: built-in:readr:read_table, type: Function, def. @11)}
    %%   read_tsv:                           {**readr::read_tsv** (id: built-in:readr:read_tsv, type: Function, def. @11)}
    %%   read_tsv_chunked:                   {**readr::read_tsv_chunked** (id: built-in:readr:read_tsv_chunked, type: Function, def. @11)}
    %%   readr_example:                      {**readr::readr_example** (id: built-in:readr:readr_example, type: Function, def. @11)}
    %%   readr_threads:                      {**readr::readr_threads** (id: built-in:readr:readr_threads, type: Function, def. @11)}
    %%   should_read_lazy:                   {**readr::should_read_lazy** (id: built-in:readr:should_read_lazy, type: Function, def. @11)}
    %%   should_show_types:                  {**readr::should_show_types** (id: built-in:readr:should_show_types, type: Function, def. @11)}
    %%   show_progress:                      {**readr::show_progress** (id: built-in:readr:show_progress, type: Function, def. @11)}
    %%   SideEffectChunkCallback:            {**readr::SideEffectChunkCallback** (id: built-in:readr:SideEffectChunkCallback, type: Function, def. @11)}
    %%   spec:                               {**readr::spec** (id: built-in:readr:spec, type: Function, def. @11)}
    %%   spec_csv:                           {**readr::spec_csv** (id: built-in:readr:spec_csv, type: Function, def. @11)}
    %%   spec_csv2:                          {**readr::spec_csv2** (id: built-in:readr:spec_csv2, type: Function, def. @11)}
    %%   spec_delim:                         {**readr::spec_delim** (id: built-in:readr:spec_delim, type: Function, def. @11)}
    %%   spec_table:                         {**readr::spec_table** (id: built-in:readr:spec_table, type: Function, def. @11)}
    %%   spec_tsv:                           {**readr::spec_tsv** (id: built-in:readr:spec_tsv, type: Function, def. @11)}
    %%   stop_for_problems:                  {**readr::stop_for_problems** (id: built-in:readr:stop_for_problems, type: Function, def. @11)}
    %%   str.col_spec:                       {**readr::str.col_spec** (id: built-in:readr:str.col_spec, type: Function, def. @11)}
    %%   tokenize:                           {**readr::tokenize** (id: built-in:readr:tokenize, type: Function, def. @11)}
    %%   tokenizer_csv:                      {**readr::tokenizer_csv** (id: built-in:readr:tokenizer_csv, type: Function, def. @11)}
    %%   tokenizer_delim:                    {**readr::tokenizer_delim** (id: built-in:readr:tokenizer_delim, type: Function, def. @11)}
    %%   tokenizer_fwf:                      {**readr::tokenizer_fwf** (id: built-in:readr:tokenizer_fwf, type: Function, def. @11)}
    %%   tokenizer_line:                     {**readr::tokenizer_line** (id: built-in:readr:tokenizer_line, type: Function, def. @11)}
    %%   tokenizer_log:                      {**readr::tokenizer_log** (id: built-in:readr:tokenizer_log, type: Function, def. @11)}
    %%   tokenizer_tsv:                      {**readr::tokenizer_tsv** (id: built-in:readr:tokenizer_tsv, type: Function, def. @11)}
    %%   tokenizer_ws:                       {**readr::tokenizer_ws** (id: built-in:readr:tokenizer_ws, type: Function, def. @11)}
    %%   type_convert:                       {**readr::type_convert** (id: built-in:readr:type_convert, type: Function, def. @11)}
    %%   type_to_col.Date:                   {**readr::type_to_col.Date** (id: built-in:readr:type_to_col.Date, type: Function, def. @11)}
    %%   type_to_col.default:                {**readr::type_to_col.default** (id: built-in:readr:type_to_col.default, type: Function, def. @11)}
    %%   type_to_col.double:                 {**readr::type_to_col.double** (id: built-in:readr:type_to_col.double, type: Function, def. @11)}
    %%   type_to_col.factor:                 {**readr::type_to_col.factor** (id: built-in:readr:type_to_col.factor, type: Function, def. @11)}
    %%   type_to_col.hms:                    {**readr::type_to_col.hms** (id: built-in:readr:type_to_col.hms, type: Function, def. @11)}
    %%   type_to_col.integer:                {**readr::type_to_col.integer** (id: built-in:readr:type_to_col.integer, type: Function, def. @11)}
    %%   type_to_col.logical:                {**readr::type_to_col.logical** (id: built-in:readr:type_to_col.logical, type: Function, def. @11)}
    %%   type_to_col.POSIXct:                {**readr::type_to_col.POSIXct** (id: built-in:readr:type_to_col.POSIXct, type: Function, def. @11)}
    %%   with_edition:                       {**readr::with_edition** (id: built-in:readr:with_edition, type: Function, def. @11)}
    %%   write_csv:                          {**readr::write_csv** (id: built-in:readr:write_csv, type: Function, def. @11)}
    %%   write_csv2:                         {**readr::write_csv2** (id: built-in:readr:write_csv2, type: Function, def. @11)}
    %%   write_delim:                        {**readr::write_delim** (id: built-in:readr:write_delim, type: Function, def. @11)}
    %%   write_excel_csv:                    {**readr::write_excel_csv** (id: built-in:readr:write_excel_csv, type: Function, def. @11)}
    %%   write_excel_csv2:                   {**readr::write_excel_csv2** (id: built-in:readr:write_excel_csv2, type: Function, def. @11)}
    %%   write_file:                         {**readr::write_file** (id: built-in:readr:write_file, type: Function, def. @11)}
    %%   write_lines:                        {**readr::write_lines** (id: built-in:readr:write_lines, type: Function, def. @11)}
    %%   write_rds:                          {**readr::write_rds** (id: built-in:readr:write_rds, type: Function, def. @11)}
    %%   write_tsv:                          {**readr::write_tsv** (id: built-in:readr:write_tsv, type: Function, def. @11)}
    %%   read_table2:                        {**readr::read_table2** (id: built-in:readr:read_table2, type: Function, def. @11)}
    %%   melt_table:                         {**readr::melt_table** (id: built-in:readr:melt_table, type: Function, def. @11)}
    %%   melt_fwf:                           {**readr::melt_fwf** (id: built-in:readr:melt_fwf, type: Function, def. @11)}
    %%   melt_delim:                         {**readr::melt_delim** (id: built-in:readr:melt_delim, type: Function, def. @11)}
    %% 6----------------------------------------
    %%   #search-path:ggplot: {**#search-path:ggplot** (id: 3, type: Variable, def. @3)}
    %%   #search-path:        {**#search-path** (id: 3, type: Variable, cds: {}, def. @3), **#search-path** (id: 7, type: Variable, cds: {}, def. @7), **#search-path** (id: 11, type: Variable, cds: {}, def. @11)}
    %%   #search-path:dplyr:  {**#search-path:dplyr** (id: 7, type: Variable, def. @7)}
    %%   #search-path:readr:  {**#search-path:readr** (id: 11, type: Variable, def. @11)}
    %%   data:                {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2:               {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:                   {**m** (id: 24, type: Unknown, def. @32)}
    %%   #sink:output:        {**#sink:output** (id: 36, type: Variable, cds: {}, def. @36)}
    52[["`*#91;RFunctionCall#93;* **dplyr#58;#58;%#62;%**
      *12.6-8* (**id: 52**)
    arg: (38, 50)`"]]
    built-in:dplyr:_37__62__37_["`Built-In:
dplyr#58;#58;%#62;%`"]
    style built-in:dplyr:_37__62__37_ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    %% Environment of 54 [level: 0]:
    %% Built-in
    %% 1----------------------------------------
    %%    library-load: {**ggplot:: library-load** (id: 3, type: Function, def. @3)}
    %% 2----------------------------------------
    %%   magrittr:%>%:           {**dplyr::magrittr:%>%** (id: built-in:magrittr:%>%, type: Function, def. @built-in:magrittr)}
    %%   tibble:add_row:         {**dplyr::tibble:add_row** (id: built-in:tibble:add_row, type: Function, def. @built-in:tibble)}
    %%   tibble:as_data_frame:   {**dplyr::tibble:as_data_frame** (id: built-in:tibble:as_data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:as_tibble:       {**dplyr::tibble:as_tibble** (id: built-in:tibble:as_tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:data_frame:      {**dplyr::tibble:data_frame** (id: built-in:tibble:data_frame, type: Function, def. @built-in:tibble)}
    %%   tibble:lst:             {**dplyr::tibble:lst** (id: built-in:tibble:lst, type: Function, def. @built-in:tibble)}
    %%   tibble:tibble:          {**dplyr::tibble:tibble** (id: built-in:tibble:tibble, type: Function, def. @built-in:tibble)}
    %%   tibble:tribble:         {**dplyr::tibble:tribble** (id: built-in:tibble:tribble, type: Function, def. @built-in:tibble)}
    %%   tidyselect:all_of:      {**dplyr::tidyselect:all_of** (id: built-in:tidyselect:all_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:any_of:      {**dplyr::tidyselect:any_of** (id: built-in:tidyselect:any_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:contains:    {**dplyr::tidyselect:contains** (id: built-in:tidyselect:contains, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:ends_with:   {**dplyr::tidyselect:ends_with** (id: built-in:tidyselect:ends_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:everything:  {**dplyr::tidyselect:everything** (id: built-in:tidyselect:everything, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:last_col:    {**dplyr::tidyselect:last_col** (id: built-in:tidyselect:last_col, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:matches:     {**dplyr::tidyselect:matches** (id: built-in:tidyselect:matches, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:num_range:   {**dplyr::tidyselect:num_range** (id: built-in:tidyselect:num_range, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:one_of:      {**dplyr::tidyselect:one_of** (id: built-in:tidyselect:one_of, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:starts_with: {**dplyr::tidyselect:starts_with** (id: built-in:tidyselect:starts_with, type: Function, def. @built-in:tidyselect)}
    %%   tidyselect:where:       {**dplyr::tidyselect:where** (id: built-in:tidyselect:where, type: Function, def. @built-in:tidyselect)}
    %%   rlang:as_label:         {**dplyr::rlang:as_label** (id: built-in:rlang:as_label, type: Function, def. @built-in:rlang)}
    %%   rlang:enexpr:           {**dplyr::rlang:enexpr** (id: built-in:rlang:enexpr, type: Function, def. @built-in:rlang)}
    %%   rlang:enexprs:          {**dplyr::rlang:enexprs** (id: built-in:rlang:enexprs, type: Function, def. @built-in:rlang)}
    %%   rlang:enquo:            {**dplyr::rlang:enquo** (id: built-in:rlang:enquo, type: Function, def. @built-in:rlang)}
    %%   rlang:enquos:           {**dplyr::rlang:enquos** (id: built-in:rlang:enquos, type: Function, def. @built-in:rlang)}
    %%   rlang:ensym:            {**dplyr::rlang:ensym** (id: built-in:rlang:ensym, type: Function, def. @built-in:rlang)}
    %%   rlang:ensyms:           {**dplyr::rlang:ensyms** (id: built-in:rlang:ensyms, type: Function, def. @built-in:rlang)}
    %%   rlang:expr:             {**dplyr::rlang:expr** (id: built-in:rlang:expr, type: Function, def. @built-in:rlang)}
    %%   rlang:quo:              {**dplyr::rlang:quo** (id: built-in:rlang:quo, type: Function, def. @built-in:rlang)}
    %%   rlang:quo_name:         {**dplyr::rlang:quo_name** (id: built-in:rlang:quo_name, type: Function, def. @built-in:rlang)}
    %%   rlang:quos:             {**dplyr::rlang:quos** (id: built-in:rlang:quos, type: Function, def. @built-in:rlang)}
    %%   rlang:sym:              {**dplyr::rlang:sym** (id: built-in:rlang:sym, type: Function, def. @built-in:rlang)}
    %%   rlang:syms:             {**dplyr::rlang:syms** (id: built-in:rlang:syms, type: Function, def. @built-in:rlang)}
    %%   pillar:glimpse:         {**dplyr::pillar:glimpse** (id: built-in:pillar:glimpse, type: Function, def. @built-in:pillar)}
    %%   pillar:type_sum:        {**dplyr::pillar:type_sum** (id: built-in:pillar:type_sum, type: Function, def. @built-in:pillar)}
    %%   generics:intersect:     {**dplyr::generics:intersect** (id: built-in:generics:intersect, type: Function, def. @built-in:generics)}
    %%   generics:setdiff:       {**dplyr::generics:setdiff** (id: built-in:generics:setdiff, type: Function, def. @built-in:generics)}
    %%   generics:setequal:      {**dplyr::generics:setequal** (id: built-in:generics:setequal, type: Function, def. @built-in:generics)}
    %%   generics:union:         {**dplyr::generics:union** (id: built-in:generics:union, type: Function, def. @built-in:generics)}
    %% 3----------------------------------------
    %%   [.fun_list:                                            {**dplyr::[.fun_list** (id: built-in:dplyr:[.fun_list, type: Function, def. @7)}
    %%   [.grouped_df:                                          {**dplyr::[.grouped_df** (id: built-in:dplyr:[.grouped_df, type: Function, def. @7)}
    %%   [.rowwise_df:                                          {**dplyr::[.rowwise_df** (id: built-in:dplyr:[.rowwise_df, type: Function, def. @7)}
    %%   [[<-.grouped_df:                                       {**dplyr::[[<-.grouped_df** (id: built-in:dplyr:[[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.grouped_df:                                        {**dplyr::[<-.grouped_df** (id: built-in:dplyr:[<-.grouped_df, type: Function, def. @7)}
    %%   [<-.rowwise_df:                                        {**dplyr::[<-.rowwise_df** (id: built-in:dplyr:[<-.rowwise_df, type: Function, def. @7)}
    %%   $<-.grouped_df:                                        {**dplyr::$<-.grouped_df** (id: built-in:dplyr:$<-.grouped_df, type: Function, def. @7)}
    %%   across:                                                {**dplyr::across** (id: built-in:dplyr:across, type: Function, def. @7)}
    %%   add_count:                                             {**dplyr::add_count** (id: built-in:dplyr:add_count, type: Function, def. @7)}
    %%   add_count_:                                            {**dplyr::add_count_** (id: built-in:dplyr:add_count_, type: Function, def. @7)}
    %%   add_count.data.frame:                                  {**dplyr::add_count.data.frame** (id: built-in:dplyr:add_count.data.frame, type: Function, def. @7)}
    %%   add_count.default:                                     {**dplyr::add_count.default** (id: built-in:dplyr:add_count.default, type: Function, def. @7)}
    %%   add_rownames:                                          {**dplyr::add_rownames** (id: built-in:dplyr:add_rownames, type: Function, def. @7)}
    %%   add_tally:                                             {**dplyr::add_tally** (id: built-in:dplyr:add_tally, type: Function, def. @7)}
    %%   add_tally_:                                            {**dplyr::add_tally_** (id: built-in:dplyr:add_tally_, type: Function, def. @7)}
    %%   all_equal:                                             {**dplyr::all_equal** (id: built-in:dplyr:all_equal, type: Function, def. @7)}
    %%   all_vars:                                              {**dplyr::all_vars** (id: built-in:dplyr:all_vars, type: Function, def. @7)}
    %%   anti_join:                                             {**dplyr::anti_join** (id: built-in:dplyr:anti_join, type: Function, def. @7)}
    %%   anti_join.data.frame:                                  {**dplyr::anti_join.data.frame** (id: built-in:dplyr:anti_join.data.frame, type: Function, def. @7)}
    %%   any_vars:                                              {**dplyr::any_vars** (id: built-in:dplyr:any_vars, type: Function, def. @7)}
    %%   arrange:                                               {**dplyr::arrange** (id: built-in:dplyr:arrange, type: Function, def. @7)}
    %%   arrange_:                                              {**dplyr::arrange_** (id: built-in:dplyr:arrange_, type: Function, def. @7)}
    %%   arrange_all:                                           {**dplyr::arrange_all** (id: built-in:dplyr:arrange_all, type: Function, def. @7)}
    %%   arrange_at:                                            {**dplyr::arrange_at** (id: built-in:dplyr:arrange_at, type: Function, def. @7)}
    %%   arrange_if:                                            {**dplyr::arrange_if** (id: built-in:dplyr:arrange_if, type: Function, def. @7)}
    %%   arrange.data.frame:                                    {**dplyr::arrange.data.frame** (id: built-in:dplyr:arrange.data.frame, type: Function, def. @7)}
    %%   as_join_by.character:                                  {**dplyr::as_join_by.character** (id: built-in:dplyr:as_join_by.character, type: Function, def. @7)}
    %%   as_join_by.default:                                    {**dplyr::as_join_by.default** (id: built-in:dplyr:as_join_by.default, type: Function, def. @7)}
    %%   as_join_by.dplyr_join_by:                              {**dplyr::as_join_by.dplyr_join_by** (id: built-in:dplyr:as_join_by.dplyr_join_by, type: Function, def. @7)}
    %%   as_join_by.list:                                       {**dplyr::as_join_by.list** (id: built-in:dplyr:as_join_by.list, type: Function, def. @7)}
    %%   as_tibble.grouped_df:                                  {**dplyr::as_tibble.grouped_df** (id: built-in:dplyr:as_tibble.grouped_df, type: Function, def. @7)}
    %%   as_tibble.rowwise_df:                                  {**dplyr::as_tibble.rowwise_df** (id: built-in:dplyr:as_tibble.rowwise_df, type: Function, def. @7)}
    %%   as.data.frame.grouped_df:                              {**dplyr::as.data.frame.grouped_df** (id: built-in:dplyr:as.data.frame.grouped_df, type: Function, def. @7)}
    %%   as.tbl:                                                {**dplyr::as.tbl** (id: built-in:dplyr:as.tbl, type: Function, def. @7)}
    %%   auto_copy:                                             {**dplyr::auto_copy** (id: built-in:dplyr:auto_copy, type: Function, def. @7)}
    %%   auto_copy.data.frame:                                  {**dplyr::auto_copy.data.frame** (id: built-in:dplyr:auto_copy.data.frame, type: Function, def. @7)}
    %%   between:                                               {**dplyr::between** (id: built-in:dplyr:between, type: Function, def. @7)}
    %%   bind_cols:                                             {**dplyr::bind_cols** (id: built-in:dplyr:bind_cols, type: Function, def. @7)}
    %%   bind_rows:                                             {**dplyr::bind_rows** (id: built-in:dplyr:bind_rows, type: Function, def. @7)}
    %%   c_across:                                              {**dplyr::c_across** (id: built-in:dplyr:c_across, type: Function, def. @7)}
    %%   case_match:                                            {**dplyr::case_match** (id: built-in:dplyr:case_match, type: Function, def. @7)}
    %%   case_when:                                             {**dplyr::case_when** (id: built-in:dplyr:case_when, type: Function, def. @7)}
    %%   cbind.grouped_df:                                      {**dplyr::cbind.grouped_df** (id: built-in:dplyr:cbind.grouped_df, type: Function, def. @7)}
    %%   check_dbplyr:                                          {**dplyr::check_dbplyr** (id: built-in:dplyr:check_dbplyr, type: Function, def. @7)}
    %%   coalesce:                                              {**dplyr::coalesce** (id: built-in:dplyr:coalesce, type: Function, def. @7)}
    %%   collapse:                                              {**dplyr::collapse** (id: built-in:dplyr:collapse, type: Function, def. @7)}
    %%   collapse.data.frame:                                   {**dplyr::collapse.data.frame** (id: built-in:dplyr:collapse.data.frame, type: Function, def. @7)}
    %%   collect:                                               {**dplyr::collect** (id: built-in:dplyr:collect, type: Function, def. @7)}
    %%   collect.data.frame:                                    {**dplyr::collect.data.frame** (id: built-in:dplyr:collect.data.frame, type: Function, def. @7)}
    %%   combine:                                               {**dplyr::combine** (id: built-in:dplyr:combine, type: Function, def. @7)}
    %%   common_by:                                             {**dplyr::common_by** (id: built-in:dplyr:common_by, type: Function, def. @7)}
    %%   common_by.character:                                   {**dplyr::common_by.character** (id: built-in:dplyr:common_by.character, type: Function, def. @7)}
    %%   common_by.default:                                     {**dplyr::common_by.default** (id: built-in:dplyr:common_by.default, type: Function, def. @7)}
    %%   common_by.list:                                        {**dplyr::common_by.list** (id: built-in:dplyr:common_by.list, type: Function, def. @7)}
    %%   common_by.NULL:                                        {**dplyr::common_by.NULL** (id: built-in:dplyr:common_by.NULL, type: Function, def. @7)}
    %%   compute:                                               {**dplyr::compute** (id: built-in:dplyr:compute, type: Function, def. @7)}
    %%   compute.data.frame:                                    {**dplyr::compute.data.frame** (id: built-in:dplyr:compute.data.frame, type: Function, def. @7)}
    %%   consecutive_id:                                        {**dplyr::consecutive_id** (id: built-in:dplyr:consecutive_id, type: Function, def. @7)}
    %%   copy_to:                                               {**dplyr::copy_to** (id: built-in:dplyr:copy_to, type: Function, def. @7)}
    %%   copy_to.DBIConnection:                                 {**dplyr::copy_to.DBIConnection** (id: built-in:dplyr:copy_to.DBIConnection, type: Function, def. @7)}
    %%   count:                                                 {**dplyr::count** (id: built-in:dplyr:count, type: Function, def. @7)}
    %%   count_:                                                {**dplyr::count_** (id: built-in:dplyr:count_, type: Function, def. @7)}
    %%   count.data.frame:                                      {**dplyr::count.data.frame** (id: built-in:dplyr:count.data.frame, type: Function, def. @7)}
    %%   cross_join:                                            {**dplyr::cross_join** (id: built-in:dplyr:cross_join, type: Function, def. @7)}
    %%   cross_join.data.frame:                                 {**dplyr::cross_join.data.frame** (id: built-in:dplyr:cross_join.data.frame, type: Function, def. @7)}
    %%   cumall:                                                {**dplyr::cumall** (id: built-in:dplyr:cumall, type: Function, def. @7)}
    %%   cumany:                                                {**dplyr::cumany** (id: built-in:dplyr:cumany, type: Function, def. @7)}
    %%   cume_dist:                                             {**dplyr::cume_dist** (id: built-in:dplyr:cume_dist, type: Function, def. @7)}
    %%   cummean:                                               {**dplyr::cummean** (id: built-in:dplyr:cummean, type: Function, def. @7)}
    %%   cur_column:                                            {**dplyr::cur_column** (id: built-in:dplyr:cur_column, type: Function, def. @7)}
    %%   cur_data:                                              {**dplyr::cur_data** (id: built-in:dplyr:cur_data, type: Function, def. @7)}
    %%   cur_data_all:                                          {**dplyr::cur_data_all** (id: built-in:dplyr:cur_data_all, type: Function, def. @7)}
    %%   cur_group:                                             {**dplyr::cur_group** (id: built-in:dplyr:cur_group, type: Function, def. @7)}
    %%   cur_group_id:                                          {**dplyr::cur_group_id** (id: built-in:dplyr:cur_group_id, type: Function, def. @7)}
    %%   cur_group_rows:                                        {**dplyr::cur_group_rows** (id: built-in:dplyr:cur_group_rows, type: Function, def. @7)}
    %%   db_analyze:                                            {**dplyr::db_analyze** (id: built-in:dplyr:db_analyze, type: Function, def. @7)}
    %%   db_begin:                                              {**dplyr::db_begin** (id: built-in:dplyr:db_begin, type: Function, def. @7)}
    %%   db_commit:                                             {**dplyr::db_commit** (id: built-in:dplyr:db_commit, type: Function, def. @7)}
    %%   db_create_index:                                       {**dplyr::db_create_index** (id: built-in:dplyr:db_create_index, type: Function, def. @7)}
    %%   db_create_indexes:                                     {**dplyr::db_create_indexes** (id: built-in:dplyr:db_create_indexes, type: Function, def. @7)}
    %%   db_create_table:                                       {**dplyr::db_create_table** (id: built-in:dplyr:db_create_table, type: Function, def. @7)}
    %%   db_data_type:                                          {**dplyr::db_data_type** (id: built-in:dplyr:db_data_type, type: Function, def. @7)}
    %%   db_desc:                                               {**dplyr::db_desc** (id: built-in:dplyr:db_desc, type: Function, def. @7)}
    %%   db_drop_table:                                         {**dplyr::db_drop_table** (id: built-in:dplyr:db_drop_table, type: Function, def. @7)}
    %%   db_explain:                                            {**dplyr::db_explain** (id: built-in:dplyr:db_explain, type: Function, def. @7)}
    %%   db_has_table:                                          {**dplyr::db_has_table** (id: built-in:dplyr:db_has_table, type: Function, def. @7)}
    %%   db_insert_into:                                        {**dplyr::db_insert_into** (id: built-in:dplyr:db_insert_into, type: Function, def. @7)}
    %%   db_list_tables:                                        {**dplyr::db_list_tables** (id: built-in:dplyr:db_list_tables, type: Function, def. @7)}
    %%   db_query_fields:                                       {**dplyr::db_query_fields** (id: built-in:dplyr:db_query_fields, type: Function, def. @7)}
    %%   db_query_rows:                                         {**dplyr::db_query_rows** (id: built-in:dplyr:db_query_rows, type: Function, def. @7)}
    %%   db_rollback:                                           {**dplyr::db_rollback** (id: built-in:dplyr:db_rollback, type: Function, def. @7)}
    %%   db_save_query:                                         {**dplyr::db_save_query** (id: built-in:dplyr:db_save_query, type: Function, def. @7)}
    %%   db_write_table:                                        {**dplyr::db_write_table** (id: built-in:dplyr:db_write_table, type: Function, def. @7)}
    %%   dense_rank:                                            {**dplyr::dense_rank** (id: built-in:dplyr:dense_rank, type: Function, def. @7)}
    %%   desc:                                                  {**dplyr::desc** (id: built-in:dplyr:desc, type: Function, def. @7)}
    %%   dim_desc:                                              {**dplyr::dim_desc** (id: built-in:dplyr:dim_desc, type: Function, def. @7)}
    %%   distinct:                                              {**dplyr::distinct** (id: built-in:dplyr:distinct, type: Function, def. @7)}
    %%   distinct_:                                             {**dplyr::distinct_** (id: built-in:dplyr:distinct_, type: Function, def. @7)}
    %%   distinct_all:                                          {**dplyr::distinct_all** (id: built-in:dplyr:distinct_all, type: Function, def. @7)}
    %%   distinct_at:                                           {**dplyr::distinct_at** (id: built-in:dplyr:distinct_at, type: Function, def. @7)}
    %%   distinct_if:                                           {**dplyr::distinct_if** (id: built-in:dplyr:distinct_if, type: Function, def. @7)}
    %%   distinct_prepare:                                      {**dplyr::distinct_prepare** (id: built-in:dplyr:distinct_prepare, type: Function, def. @7)}
    %%   distinct.data.frame:                                   {**dplyr::distinct.data.frame** (id: built-in:dplyr:distinct.data.frame, type: Function, def. @7)}
    %%   do:                                                    {**dplyr::do** (id: built-in:dplyr:do, type: Function, def. @7)}
    %%   do_:                                                   {**dplyr::do_** (id: built-in:dplyr:do_, type: Function, def. @7)}
    %%   do.data.frame:                                         {**dplyr::do.data.frame** (id: built-in:dplyr:do.data.frame, type: Function, def. @7)}
    %%   do.grouped_df:                                         {**dplyr::do.grouped_df** (id: built-in:dplyr:do.grouped_df, type: Function, def. @7)}
    %%   do.NULL:                                               {**dplyr::do.NULL** (id: built-in:dplyr:do.NULL, type: Function, def. @7)}
    %%   do.rowwise_df:                                         {**dplyr::do.rowwise_df** (id: built-in:dplyr:do.rowwise_df, type: Function, def. @7)}
    %%   dplyr_col_modify:                                      {**dplyr::dplyr_col_modify** (id: built-in:dplyr:dplyr_col_modify, type: Function, def. @7)}
    %%   dplyr_col_modify.data.frame:                           {**dplyr::dplyr_col_modify.data.frame** (id: built-in:dplyr:dplyr_col_modify.data.frame, type: Function, def. @7)}
    %%   dplyr_col_modify.grouped_df:                           {**dplyr::dplyr_col_modify.grouped_df** (id: built-in:dplyr:dplyr_col_modify.grouped_df, type: Function, def. @7)}
    %%   dplyr_col_modify.rowwise_df:                           {**dplyr::dplyr_col_modify.rowwise_df** (id: built-in:dplyr:dplyr_col_modify.rowwise_df, type: Function, def. @7)}
    %%   dplyr_reconstruct:                                     {**dplyr::dplyr_reconstruct** (id: built-in:dplyr:dplyr_reconstruct, type: Function, def. @7)}
    %%   dplyr_reconstruct.data.frame:                          {**dplyr::dplyr_reconstruct.data.frame** (id: built-in:dplyr:dplyr_reconstruct.data.frame, type: Function, def. @7)}
    %%   dplyr_reconstruct.grouped_df:                          {**dplyr::dplyr_reconstruct.grouped_df** (id: built-in:dplyr:dplyr_reconstruct.grouped_df, type: Function, def. @7)}
    %%   dplyr_reconstruct.rowwise_df:                          {**dplyr::dplyr_reconstruct.rowwise_df** (id: built-in:dplyr:dplyr_reconstruct.rowwise_df, type: Function, def. @7)}
    %%   dplyr_row_slice:                                       {**dplyr::dplyr_row_slice** (id: built-in:dplyr:dplyr_row_slice, type: Function, def. @7)}
    %%   dplyr_row_slice.data.frame:                            {**dplyr::dplyr_row_slice.data.frame** (id: built-in:dplyr:dplyr_row_slice.data.frame, type: Function, def. @7)}
    %%   dplyr_row_slice.grouped_df:                            {**dplyr::dplyr_row_slice.grouped_df** (id: built-in:dplyr:dplyr_row_slice.grouped_df, type: Function, def. @7)}
    %%   dplyr_row_slice.rowwise_df:                            {**dplyr::dplyr_row_slice.rowwise_df** (id: built-in:dplyr:dplyr_row_slice.rowwise_df, type: Function, def. @7)}
    %%   explain:                                               {**dplyr::explain** (id: built-in:dplyr:explain, type: Function, def. @7)}
    %%   filter:                                                {**dplyr::filter** (id: built-in:dplyr:filter, type: Function, def. @7)}
    %%   filter_:                                               {**dplyr::filter_** (id: built-in:dplyr:filter_, type: Function, def. @7)}
    %%   filter_all:                                            {**dplyr::filter_all** (id: built-in:dplyr:filter_all, type: Function, def. @7)}
    %%   filter_at:                                             {**dplyr::filter_at** (id: built-in:dplyr:filter_at, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_size:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_size** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_size, type: Function, def. @7)}
    %%   filter_bullets.dplyr:::filter_incompatible_type:       {**dplyr::filter_bullets.dplyr:::filter_incompatible_type** (id: built-in:dplyr:filter_bullets.dplyr:::filter_incompatible_type, type: Function, def. @7)}
    %%   filter_if:                                             {**dplyr::filter_if** (id: built-in:dplyr:filter_if, type: Function, def. @7)}
    %%   filter_out:                                            {**dplyr::filter_out** (id: built-in:dplyr:filter_out, type: Function, def. @7)}
    %%   filter_out.data.frame:                                 {**dplyr::filter_out.data.frame** (id: built-in:dplyr:filter_out.data.frame, type: Function, def. @7)}
    %%   filter.data.frame:                                     {**dplyr::filter.data.frame** (id: built-in:dplyr:filter.data.frame, type: Function, def. @7)}
    %%   filter.ts:                                             {**dplyr::filter.ts** (id: built-in:dplyr:filter.ts, type: Function, def. @7)}
    %%   first:                                                 {**dplyr::first** (id: built-in:dplyr:first, type: Function, def. @7)}
    %%   full_join:                                             {**dplyr::full_join** (id: built-in:dplyr:full_join, type: Function, def. @7)}
    %%   full_join.data.frame:                                  {**dplyr::full_join.data.frame** (id: built-in:dplyr:full_join.data.frame, type: Function, def. @7)}
    %%   funs:                                                  {**dplyr::funs** (id: built-in:dplyr:funs, type: Function, def. @7)}
    %%   funs_:                                                 {**dplyr::funs_** (id: built-in:dplyr:funs_, type: Function, def. @7)}
    %%   group_by:                                              {**dplyr::group_by** (id: built-in:dplyr:group_by, type: Function, def. @7)}
    %%   group_by_:                                             {**dplyr::group_by_** (id: built-in:dplyr:group_by_, type: Function, def. @7)}
    %%   group_by_all:                                          {**dplyr::group_by_all** (id: built-in:dplyr:group_by_all, type: Function, def. @7)}
    %%   group_by_at:                                           {**dplyr::group_by_at** (id: built-in:dplyr:group_by_at, type: Function, def. @7)}
    %%   group_by_drop_default:                                 {**dplyr::group_by_drop_default** (id: built-in:dplyr:group_by_drop_default, type: Function, def. @7)}
    %%   group_by_drop_default.default:                         {**dplyr::group_by_drop_default.default** (id: built-in:dplyr:group_by_drop_default.default, type: Function, def. @7)}
    %%   group_by_drop_default.grouped_df:                      {**dplyr::group_by_drop_default.grouped_df** (id: built-in:dplyr:group_by_drop_default.grouped_df, type: Function, def. @7)}
    %%   group_by_if:                                           {**dplyr::group_by_if** (id: built-in:dplyr:group_by_if, type: Function, def. @7)}
    %%   group_by_prepare:                                      {**dplyr::group_by_prepare** (id: built-in:dplyr:group_by_prepare, type: Function, def. @7)}
    %%   group_by.data.frame:                                   {**dplyr::group_by.data.frame** (id: built-in:dplyr:group_by.data.frame, type: Function, def. @7)}
    %%   group_cols:                                            {**dplyr::group_cols** (id: built-in:dplyr:group_cols, type: Function, def. @7)}
    %%   group_data:                                            {**dplyr::group_data** (id: built-in:dplyr:group_data, type: Function, def. @7)}
    %%   group_data.data.frame:                                 {**dplyr::group_data.data.frame** (id: built-in:dplyr:group_data.data.frame, type: Function, def. @7)}
    %%   group_data.grouped_df:                                 {**dplyr::group_data.grouped_df** (id: built-in:dplyr:group_data.grouped_df, type: Function, def. @7)}
    %%   group_data.rowwise_df:                                 {**dplyr::group_data.rowwise_df** (id: built-in:dplyr:group_data.rowwise_df, type: Function, def. @7)}
    %%   group_data.tbl_df:                                     {**dplyr::group_data.tbl_df** (id: built-in:dplyr:group_data.tbl_df, type: Function, def. @7)}
    %%   group_indices:                                         {**dplyr::group_indices** (id: built-in:dplyr:group_indices, type: Function, def. @7)}
    %%   group_indices_:                                        {**dplyr::group_indices_** (id: built-in:dplyr:group_indices_, type: Function, def. @7)}
    %%   group_indices.data.frame:                              {**dplyr::group_indices.data.frame** (id: built-in:dplyr:group_indices.data.frame, type: Function, def. @7)}
    %%   group_keys:                                            {**dplyr::group_keys** (id: built-in:dplyr:group_keys, type: Function, def. @7)}
    %%   group_keys.data.frame:                                 {**dplyr::group_keys.data.frame** (id: built-in:dplyr:group_keys.data.frame, type: Function, def. @7)}
    %%   group_map:                                             {**dplyr::group_map** (id: built-in:dplyr:group_map, type: Function, def. @7)}
    %%   group_map.data.frame:                                  {**dplyr::group_map.data.frame** (id: built-in:dplyr:group_map.data.frame, type: Function, def. @7)}
    %%   group_modify:                                          {**dplyr::group_modify** (id: built-in:dplyr:group_modify, type: Function, def. @7)}
    %%   group_modify.data.frame:                               {**dplyr::group_modify.data.frame** (id: built-in:dplyr:group_modify.data.frame, type: Function, def. @7)}
    %%   group_modify.grouped_df:                               {**dplyr::group_modify.grouped_df** (id: built-in:dplyr:group_modify.grouped_df, type: Function, def. @7)}
    %%   group_nest:                                            {**dplyr::group_nest** (id: built-in:dplyr:group_nest, type: Function, def. @7)}
    %%   group_nest.data.frame:                                 {**dplyr::group_nest.data.frame** (id: built-in:dplyr:group_nest.data.frame, type: Function, def. @7)}
    %%   group_nest.grouped_df:                                 {**dplyr::group_nest.grouped_df** (id: built-in:dplyr:group_nest.grouped_df, type: Function, def. @7)}
    %%   group_rows:                                            {**dplyr::group_rows** (id: built-in:dplyr:group_rows, type: Function, def. @7)}
    %%   group_size:                                            {**dplyr::group_size** (id: built-in:dplyr:group_size, type: Function, def. @7)}
    %%   group_size.data.frame:                                 {**dplyr::group_size.data.frame** (id: built-in:dplyr:group_size.data.frame, type: Function, def. @7)}
    %%   group_split:                                           {**dplyr::group_split** (id: built-in:dplyr:group_split, type: Function, def. @7)}
    %%   group_split.data.frame:                                {**dplyr::group_split.data.frame** (id: built-in:dplyr:group_split.data.frame, type: Function, def. @7)}
    %%   group_split.grouped_df:                                {**dplyr::group_split.grouped_df** (id: built-in:dplyr:group_split.grouped_df, type: Function, def. @7)}
    %%   group_split.rowwise_df:                                {**dplyr::group_split.rowwise_df** (id: built-in:dplyr:group_split.rowwise_df, type: Function, def. @7)}
    %%   group_trim:                                            {**dplyr::group_trim** (id: built-in:dplyr:group_trim, type: Function, def. @7)}
    %%   group_trim.data.frame:                                 {**dplyr::group_trim.data.frame** (id: built-in:dplyr:group_trim.data.frame, type: Function, def. @7)}
    %%   group_trim.grouped_df:                                 {**dplyr::group_trim.grouped_df** (id: built-in:dplyr:group_trim.grouped_df, type: Function, def. @7)}
    %%   group_vars:                                            {**dplyr::group_vars** (id: built-in:dplyr:group_vars, type: Function, def. @7)}
    %%   group_vars.data.frame:                                 {**dplyr::group_vars.data.frame** (id: built-in:dplyr:group_vars.data.frame, type: Function, def. @7)}
    %%   group_walk:                                            {**dplyr::group_walk** (id: built-in:dplyr:group_walk, type: Function, def. @7)}
    %%   grouped_df:                                            {**dplyr::grouped_df** (id: built-in:dplyr:grouped_df, type: Function, def. @7)}
    %%   groups:                                                {**dplyr::groups** (id: built-in:dplyr:groups, type: Function, def. @7)}
    %%   groups.data.frame:                                     {**dplyr::groups.data.frame** (id: built-in:dplyr:groups.data.frame, type: Function, def. @7)}
    %%   ident:                                                 {**dplyr::ident** (id: built-in:dplyr:ident, type: Function, def. @7)}
    %%   if_all:                                                {**dplyr::if_all** (id: built-in:dplyr:if_all, type: Function, def. @7)}
    %%   if_any:                                                {**dplyr::if_any** (id: built-in:dplyr:if_any, type: Function, def. @7)}
    %%   if_else:                                               {**dplyr::if_else** (id: built-in:dplyr:if_else, type: Function, def. @7)}
    %%   inner_join:                                            {**dplyr::inner_join** (id: built-in:dplyr:inner_join, type: Function, def. @7)}
    %%   inner_join.data.frame:                                 {**dplyr::inner_join.data.frame** (id: built-in:dplyr:inner_join.data.frame, type: Function, def. @7)}
    %%   intersect.data.frame:                                  {**dplyr::intersect.data.frame** (id: built-in:dplyr:intersect.data.frame, type: Function, def. @7)}
    %%   is_grouped_df:                                         {**dplyr::is_grouped_df** (id: built-in:dplyr:is_grouped_df, type: Function, def. @7)}
    %%   is.grouped_df:                                         {**dplyr::is.grouped_df** (id: built-in:dplyr:is.grouped_df, type: Function, def. @7)}
    %%   is.src:                                                {**dplyr::is.src** (id: built-in:dplyr:is.src, type: Function, def. @7)}
    %%   is.tbl:                                                {**dplyr::is.tbl** (id: built-in:dplyr:is.tbl, type: Function, def. @7)}
    %%   join_by:                                               {**dplyr::join_by** (id: built-in:dplyr:join_by, type: Function, def. @7)}
    %%   lag:                                                   {**dplyr::lag** (id: built-in:dplyr:lag, type: Function, def. @7)}
    %%   last:                                                  {**dplyr::last** (id: built-in:dplyr:last, type: Function, def. @7)}
    %%   last_dplyr_warnings:                                   {**dplyr::last_dplyr_warnings** (id: built-in:dplyr:last_dplyr_warnings, type: Function, def. @7)}
    %%   lead:                                                  {**dplyr::lead** (id: built-in:dplyr:lead, type: Function, def. @7)}
    %%   left_join:                                             {**dplyr::left_join** (id: built-in:dplyr:left_join, type: Function, def. @7)}
    %%   left_join.data.frame:                                  {**dplyr::left_join.data.frame** (id: built-in:dplyr:left_join.data.frame, type: Function, def. @7)}
    %%   make_tbl:                                              {**dplyr::make_tbl** (id: built-in:dplyr:make_tbl, type: Function, def. @7)}
    %%   min_rank:                                              {**dplyr::min_rank** (id: built-in:dplyr:min_rank, type: Function, def. @7)}
    %%   mutate:                                                {**dplyr::mutate** (id: built-in:dplyr:mutate, type: Function, def. @7)}
    %%   mutate_:                                               {**dplyr::mutate_** (id: built-in:dplyr:mutate_, type: Function, def. @7)}
    %%   mutate_all:                                            {**dplyr::mutate_all** (id: built-in:dplyr:mutate_all, type: Function, def. @7)}
    %%   mutate_at:                                             {**dplyr::mutate_at** (id: built-in:dplyr:mutate_at, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::error_incompatible_combine:     {**dplyr::mutate_bullets.dplyr:::error_incompatible_combine** (id: built-in:dplyr:mutate_bullets.dplyr:::error_incompatible_combine, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_constant_recycle_error:  {**dplyr::mutate_bullets.dplyr:::mutate_constant_recycle_error** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_constant_recycle_error, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_incompatible_size:       {**dplyr::mutate_bullets.dplyr:::mutate_incompatible_size** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_incompatible_size, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_mixed_null:              {**dplyr::mutate_bullets.dplyr:::mutate_mixed_null** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_mixed_null, type: Function, def. @7)}
    %%   mutate_bullets.dplyr:::mutate_not_vector:              {**dplyr::mutate_bullets.dplyr:::mutate_not_vector** (id: built-in:dplyr:mutate_bullets.dplyr:::mutate_not_vector, type: Function, def. @7)}
    %%   mutate_each:                                           {**dplyr::mutate_each** (id: built-in:dplyr:mutate_each, type: Function, def. @7)}
    %%   mutate_each_:                                          {**dplyr::mutate_each_** (id: built-in:dplyr:mutate_each_, type: Function, def. @7)}
    %%   mutate_if:                                             {**dplyr::mutate_if** (id: built-in:dplyr:mutate_if, type: Function, def. @7)}
    %%   mutate.data.frame:                                     {**dplyr::mutate.data.frame** (id: built-in:dplyr:mutate.data.frame, type: Function, def. @7)}
    %%   n:                                                     {**dplyr::n** (id: built-in:dplyr:n, type: Function, def. @7)}
    %%   n_distinct:                                            {**dplyr::n_distinct** (id: built-in:dplyr:n_distinct, type: Function, def. @7)}
    %%   n_groups:                                              {**dplyr::n_groups** (id: built-in:dplyr:n_groups, type: Function, def. @7)}
    %%   n_groups.data.frame:                                   {**dplyr::n_groups.data.frame** (id: built-in:dplyr:n_groups.data.frame, type: Function, def. @7)}
    %%   na_if:                                                 {**dplyr::na_if** (id: built-in:dplyr:na_if, type: Function, def. @7)}
    %%   names<-.grouped_df:                                    {**dplyr::names<-.grouped_df** (id: built-in:dplyr:names<-.grouped_df, type: Function, def. @7)}
    %%   names<-.rowwise_df:                                    {**dplyr::names<-.rowwise_df** (id: built-in:dplyr:names<-.rowwise_df, type: Function, def. @7)}
    %%   near:                                                  {**dplyr::near** (id: built-in:dplyr:near, type: Function, def. @7)}
    %%   nest_by:                                               {**dplyr::nest_by** (id: built-in:dplyr:nest_by, type: Function, def. @7)}
    %%   nest_by.data.frame:                                    {**dplyr::nest_by.data.frame** (id: built-in:dplyr:nest_by.data.frame, type: Function, def. @7)}
    %%   nest_by.grouped_df:                                    {**dplyr::nest_by.grouped_df** (id: built-in:dplyr:nest_by.grouped_df, type: Function, def. @7)}
    %%   nest_join:                                             {**dplyr::nest_join** (id: built-in:dplyr:nest_join, type: Function, def. @7)}
    %%   nest_join.data.frame:                                  {**dplyr::nest_join.data.frame** (id: built-in:dplyr:nest_join.data.frame, type: Function, def. @7)}
    %%   new_grouped_df:                                        {**dplyr::new_grouped_df** (id: built-in:dplyr:new_grouped_df, type: Function, def. @7)}
    %%   new_rowwise_df:                                        {**dplyr::new_rowwise_df** (id: built-in:dplyr:new_rowwise_df, type: Function, def. @7)}
    %%   nth:                                                   {**dplyr::nth** (id: built-in:dplyr:nth, type: Function, def. @7)}
    %%   ntile:                                                 {**dplyr::ntile** (id: built-in:dplyr:ntile, type: Function, def. @7)}
    %%   order_by:                                              {**dplyr::order_by** (id: built-in:dplyr:order_by, type: Function, def. @7)}
    %%   percent_rank:                                          {**dplyr::percent_rank** (id: built-in:dplyr:percent_rank, type: Function, def. @7)}
    %%   pick:                                                  {**dplyr::pick** (id: built-in:dplyr:pick, type: Function, def. @7)}
    %%   print.all_vars:                                        {**dplyr::print.all_vars** (id: built-in:dplyr:print.all_vars, type: Function, def. @7)}
    %%   print.any_vars:                                        {**dplyr::print.any_vars** (id: built-in:dplyr:print.any_vars, type: Function, def. @7)}
    %%   print.dplyr_join_by:                                   {**dplyr::print.dplyr_join_by** (id: built-in:dplyr:print.dplyr_join_by, type: Function, def. @7)}
    %%   print.dplyr_sel_vars:                                  {**dplyr::print.dplyr_sel_vars** (id: built-in:dplyr:print.dplyr_sel_vars, type: Function, def. @7)}
    %%   print.fun_list:                                        {**dplyr::print.fun_list** (id: built-in:dplyr:print.fun_list, type: Function, def. @7)}
    %%   print.last_dplyr_warnings:                             {**dplyr::print.last_dplyr_warnings** (id: built-in:dplyr:print.last_dplyr_warnings, type: Function, def. @7)}
    %%   print.src:                                             {**dplyr::print.src** (id: built-in:dplyr:print.src, type: Function, def. @7)}
    %%   progress_estimated:                                    {**dplyr::progress_estimated** (id: built-in:dplyr:progress_estimated, type: Function, def. @7)}
    %%   pull:                                                  {**dplyr::pull** (id: built-in:dplyr:pull, type: Function, def. @7)}
    %%   pull.data.frame:                                       {**dplyr::pull.data.frame** (id: built-in:dplyr:pull.data.frame, type: Function, def. @7)}
    %%   rbind.grouped_df:                                      {**dplyr::rbind.grouped_df** (id: built-in:dplyr:rbind.grouped_df, type: Function, def. @7)}
    %%   rbind.rowwise_df:                                      {**dplyr::rbind.rowwise_df** (id: built-in:dplyr:rbind.rowwise_df, type: Function, def. @7)}
    %%   recode:                                                {**dplyr::recode** (id: built-in:dplyr:recode, type: Function, def. @7)}
    %%   recode_default.default:                                {**dplyr::recode_default.default** (id: built-in:dplyr:recode_default.default, type: Function, def. @7)}
    %%   recode_default.factor:                                 {**dplyr::recode_default.factor** (id: built-in:dplyr:recode_default.factor, type: Function, def. @7)}
    %%   recode_factor:                                         {**dplyr::recode_factor** (id: built-in:dplyr:recode_factor, type: Function, def. @7)}
    %%   recode_values:                                         {**dplyr::recode_values** (id: built-in:dplyr:recode_values, type: Function, def. @7)}
    %%   recode.character:                                      {**dplyr::recode.character** (id: built-in:dplyr:recode.character, type: Function, def. @7)}
    %%   recode.factor:                                         {**dplyr::recode.factor** (id: built-in:dplyr:recode.factor, type: Function, def. @7)}
    %%   recode.numeric:                                        {**dplyr::recode.numeric** (id: built-in:dplyr:recode.numeric, type: Function, def. @7)}
    %%   reframe:                                               {**dplyr::reframe** (id: built-in:dplyr:reframe, type: Function, def. @7)}
    %%   reframe.data.frame:                                    {**dplyr::reframe.data.frame** (id: built-in:dplyr:reframe.data.frame, type: Function, def. @7)}
    %%   relocate:                                              {**dplyr::relocate** (id: built-in:dplyr:relocate, type: Function, def. @7)}
    %%   relocate.data.frame:                                   {**dplyr::relocate.data.frame** (id: built-in:dplyr:relocate.data.frame, type: Function, def. @7)}
    %%   rename:                                                {**dplyr::rename** (id: built-in:dplyr:rename, type: Function, def. @7)}
    %%   rename_:                                               {**dplyr::rename_** (id: built-in:dplyr:rename_, type: Function, def. @7)}
    %%   rename_all:                                            {**dplyr::rename_all** (id: built-in:dplyr:rename_all, type: Function, def. @7)}
    %%   rename_at:                                             {**dplyr::rename_at** (id: built-in:dplyr:rename_at, type: Function, def. @7)}
    %%   rename_if:                                             {**dplyr::rename_if** (id: built-in:dplyr:rename_if, type: Function, def. @7)}
    %%   rename_with:                                           {**dplyr::rename_with** (id: built-in:dplyr:rename_with, type: Function, def. @7)}
    %%   rename_with.data.frame:                                {**dplyr::rename_with.data.frame** (id: built-in:dplyr:rename_with.data.frame, type: Function, def. @7)}
    %%   rename.data.frame:                                     {**dplyr::rename.data.frame** (id: built-in:dplyr:rename.data.frame, type: Function, def. @7)}
    %%   replace_values:                                        {**dplyr::replace_values** (id: built-in:dplyr:replace_values, type: Function, def. @7)}
    %%   replace_when:                                          {**dplyr::replace_when** (id: built-in:dplyr:replace_when, type: Function, def. @7)}
    %%   right_join:                                            {**dplyr::right_join** (id: built-in:dplyr:right_join, type: Function, def. @7)}
    %%   right_join.data.frame:                                 {**dplyr::right_join.data.frame** (id: built-in:dplyr:right_join.data.frame, type: Function, def. @7)}
    %%   row_number:                                            {**dplyr::row_number** (id: built-in:dplyr:row_number, type: Function, def. @7)}
    %%   rows_append:                                           {**dplyr::rows_append** (id: built-in:dplyr:rows_append, type: Function, def. @7)}
    %%   rows_append.data.frame:                                {**dplyr::rows_append.data.frame** (id: built-in:dplyr:rows_append.data.frame, type: Function, def. @7)}
    %%   rows_delete:                                           {**dplyr::rows_delete** (id: built-in:dplyr:rows_delete, type: Function, def. @7)}
    %%   rows_delete.data.frame:                                {**dplyr::rows_delete.data.frame** (id: built-in:dplyr:rows_delete.data.frame, type: Function, def. @7)}
    %%   rows_insert:                                           {**dplyr::rows_insert** (id: built-in:dplyr:rows_insert, type: Function, def. @7)}
    %%   rows_insert.data.frame:                                {**dplyr::rows_insert.data.frame** (id: built-in:dplyr:rows_insert.data.frame, type: Function, def. @7)}
    %%   rows_patch:                                            {**dplyr::rows_patch** (id: built-in:dplyr:rows_patch, type: Function, def. @7)}
    %%   rows_patch.data.frame:                                 {**dplyr::rows_patch.data.frame** (id: built-in:dplyr:rows_patch.data.frame, type: Function, def. @7)}
    %%   rows_update:                                           {**dplyr::rows_update** (id: built-in:dplyr:rows_update, type: Function, def. @7)}
    %%   rows_update.data.frame:                                {**dplyr::rows_update.data.frame** (id: built-in:dplyr:rows_update.data.frame, type: Function, def. @7)}
    %%   rows_upsert:                                           {**dplyr::rows_upsert** (id: built-in:dplyr:rows_upsert, type: Function, def. @7)}
    %%   rows_upsert.data.frame:                                {**dplyr::rows_upsert.data.frame** (id: built-in:dplyr:rows_upsert.data.frame, type: Function, def. @7)}
    %%   rowwise:                                               {**dplyr::rowwise** (id: built-in:dplyr:rowwise, type: Function, def. @7)}
    %%   rowwise.data.frame:                                    {**dplyr::rowwise.data.frame** (id: built-in:dplyr:rowwise.data.frame, type: Function, def. @7)}
    %%   rowwise.grouped_df:                                    {**dplyr::rowwise.grouped_df** (id: built-in:dplyr:rowwise.grouped_df, type: Function, def. @7)}
    %%   same_src:                                              {**dplyr::same_src** (id: built-in:dplyr:same_src, type: Function, def. @7)}
    %%   same_src.data.frame:                                   {**dplyr::same_src.data.frame** (id: built-in:dplyr:same_src.data.frame, type: Function, def. @7)}
    %%   sample_frac:                                           {**dplyr::sample_frac** (id: built-in:dplyr:sample_frac, type: Function, def. @7)}
    %%   sample_frac.data.frame:                                {**dplyr::sample_frac.data.frame** (id: built-in:dplyr:sample_frac.data.frame, type: Function, def. @7)}
    %%   sample_frac.default:                                   {**dplyr::sample_frac.default** (id: built-in:dplyr:sample_frac.default, type: Function, def. @7)}
    %%   sample_n:                                              {**dplyr::sample_n** (id: built-in:dplyr:sample_n, type: Function, def. @7)}
    %%   sample_n.data.frame:                                   {**dplyr::sample_n.data.frame** (id: built-in:dplyr:sample_n.data.frame, type: Function, def. @7)}
    %%   sample_n.default:                                      {**dplyr::sample_n.default** (id: built-in:dplyr:sample_n.default, type: Function, def. @7)}
    %%   select:                                                {**dplyr::select** (id: built-in:dplyr:select, type: Function, def. @7)}
    %%   select_:                                               {**dplyr::select_** (id: built-in:dplyr:select_, type: Function, def. @7)}
    %%   select_all:                                            {**dplyr::select_all** (id: built-in:dplyr:select_all, type: Function, def. @7)}
    %%   select_at:                                             {**dplyr::select_at** (id: built-in:dplyr:select_at, type: Function, def. @7)}
    %%   select_if:                                             {**dplyr::select_if** (id: built-in:dplyr:select_if, type: Function, def. @7)}
    %%   select.data.frame:                                     {**dplyr::select.data.frame** (id: built-in:dplyr:select.data.frame, type: Function, def. @7)}
    %%   select.list:                                           {**dplyr::select.list** (id: built-in:dplyr:select.list, type: Function, def. @7)}
    %%   semi_join:                                             {**dplyr::semi_join** (id: built-in:dplyr:semi_join, type: Function, def. @7)}
    %%   semi_join.data.frame:                                  {**dplyr::semi_join.data.frame** (id: built-in:dplyr:semi_join.data.frame, type: Function, def. @7)}
    %%   setdiff.data.frame:                                    {**dplyr::setdiff.data.frame** (id: built-in:dplyr:setdiff.data.frame, type: Function, def. @7)}
    %%   setequal.data.frame:                                   {**dplyr::setequal.data.frame** (id: built-in:dplyr:setequal.data.frame, type: Function, def. @7)}
    %%   show_query:                                            {**dplyr::show_query** (id: built-in:dplyr:show_query, type: Function, def. @7)}
    %%   slice:                                                 {**dplyr::slice** (id: built-in:dplyr:slice, type: Function, def. @7)}
    %%   slice_:                                                {**dplyr::slice_** (id: built-in:dplyr:slice_, type: Function, def. @7)}
    %%   slice_head:                                            {**dplyr::slice_head** (id: built-in:dplyr:slice_head, type: Function, def. @7)}
    %%   slice_head.data.frame:                                 {**dplyr::slice_head.data.frame** (id: built-in:dplyr:slice_head.data.frame, type: Function, def. @7)}
    %%   slice_max:                                             {**dplyr::slice_max** (id: built-in:dplyr:slice_max, type: Function, def. @7)}
    %%   slice_max.data.frame:                                  {**dplyr::slice_max.data.frame** (id: built-in:dplyr:slice_max.data.frame, type: Function, def. @7)}
    %%   slice_min:                                             {**dplyr::slice_min** (id: built-in:dplyr:slice_min, type: Function, def. @7)}
    %%   slice_min.data.frame:                                  {**dplyr::slice_min.data.frame** (id: built-in:dplyr:slice_min.data.frame, type: Function, def. @7)}
    %%   slice_sample:                                          {**dplyr::slice_sample** (id: built-in:dplyr:slice_sample, type: Function, def. @7)}
    %%   slice_sample.data.frame:                               {**dplyr::slice_sample.data.frame** (id: built-in:dplyr:slice_sample.data.frame, type: Function, def. @7)}
    %%   slice_tail:                                            {**dplyr::slice_tail** (id: built-in:dplyr:slice_tail, type: Function, def. @7)}
    %%   slice_tail.data.frame:                                 {**dplyr::slice_tail.data.frame** (id: built-in:dplyr:slice_tail.data.frame, type: Function, def. @7)}
    %%   slice.data.frame:                                      {**dplyr::slice.data.frame** (id: built-in:dplyr:slice.data.frame, type: Function, def. @7)}
    %%   sql:                                                   {**dplyr::sql** (id: built-in:dplyr:sql, type: Function, def. @7)}
    %%   sql_escape_ident:                                      {**dplyr::sql_escape_ident** (id: built-in:dplyr:sql_escape_ident, type: Function, def. @7)}
    %%   sql_escape_string:                                     {**dplyr::sql_escape_string** (id: built-in:dplyr:sql_escape_string, type: Function, def. @7)}
    %%   sql_join:                                              {**dplyr::sql_join** (id: built-in:dplyr:sql_join, type: Function, def. @7)}
    %%   sql_select:                                            {**dplyr::sql_select** (id: built-in:dplyr:sql_select, type: Function, def. @7)}
    %%   sql_semi_join:                                         {**dplyr::sql_semi_join** (id: built-in:dplyr:sql_semi_join, type: Function, def. @7)}
    %%   sql_set_op:                                            {**dplyr::sql_set_op** (id: built-in:dplyr:sql_set_op, type: Function, def. @7)}
    %%   sql_subquery:                                          {**dplyr::sql_subquery** (id: built-in:dplyr:sql_subquery, type: Function, def. @7)}
    %%   sql_translate_env:                                     {**dplyr::sql_translate_env** (id: built-in:dplyr:sql_translate_env, type: Function, def. @7)}
    %%   src:                                                   {**dplyr::src** (id: built-in:dplyr:src, type: Function, def. @7)}
    %%   src_df:                                                {**dplyr::src_df** (id: built-in:dplyr:src_df, type: Function, def. @7)}
    %%   src_local:                                             {**dplyr::src_local** (id: built-in:dplyr:src_local, type: Function, def. @7)}
    %%   src_mysql:                                             {**dplyr::src_mysql** (id: built-in:dplyr:src_mysql, type: Function, def. @7)}
    %%   src_postgres:                                          {**dplyr::src_postgres** (id: built-in:dplyr:src_postgres, type: Function, def. @7)}
    %%   src_sqlite:                                            {**dplyr::src_sqlite** (id: built-in:dplyr:src_sqlite, type: Function, def. @7)}
    %%   src_tbls:                                              {**dplyr::src_tbls** (id: built-in:dplyr:src_tbls, type: Function, def. @7)}
    %%   summarise:                                             {**dplyr::summarise** (id: built-in:dplyr:summarise, type: Function, def. @7)}
    %%   summarise_:                                            {**dplyr::summarise_** (id: built-in:dplyr:summarise_, type: Function, def. @7)}
    %%   summarise_all:                                         {**dplyr::summarise_all** (id: built-in:dplyr:summarise_all, type: Function, def. @7)}
    %%   summarise_at:                                          {**dplyr::summarise_at** (id: built-in:dplyr:summarise_at, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::reframe_incompatible_size:   {**dplyr::summarise_bullets.dplyr:::reframe_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::reframe_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_incompatible_size: {**dplyr::summarise_bullets.dplyr:::summarise_incompatible_size** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_incompatible_size, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_mixed_null:        {**dplyr::summarise_bullets.dplyr:::summarise_mixed_null** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_mixed_null, type: Function, def. @7)}
    %%   summarise_bullets.dplyr:::summarise_unsupported_type:  {**dplyr::summarise_bullets.dplyr:::summarise_unsupported_type** (id: built-in:dplyr:summarise_bullets.dplyr:::summarise_unsupported_type, type: Function, def. @7)}
    %%   summarise_each:                                        {**dplyr::summarise_each** (id: built-in:dplyr:summarise_each, type: Function, def. @7)}
    %%   summarise_each_:                                       {**dplyr::summarise_each_** (id: built-in:dplyr:summarise_each_, type: Function, def. @7)}
    %%   summarise_if:                                          {**dplyr::summarise_if** (id: built-in:dplyr:summarise_if, type: Function, def. @7)}
    %%   summarise.data.frame:                                  {**dplyr::summarise.data.frame** (id: built-in:dplyr:summarise.data.frame, type: Function, def. @7)}
    %%   summarise.grouped_df:                                  {**dplyr::summarise.grouped_df** (id: built-in:dplyr:summarise.grouped_df, type: Function, def. @7)}
    %%   summarise.rowwise_df:                                  {**dplyr::summarise.rowwise_df** (id: built-in:dplyr:summarise.rowwise_df, type: Function, def. @7)}
    %%   summarize:                                             {**dplyr::summarize** (id: built-in:dplyr:summarize, type: Function, def. @7)}
    %%   summarize_:                                            {**dplyr::summarize_** (id: built-in:dplyr:summarize_, type: Function, def. @7)}
    %%   summarize_all:                                         {**dplyr::summarize_all** (id: built-in:dplyr:summarize_all, type: Function, def. @7)}
    %%   summarize_at:                                          {**dplyr::summarize_at** (id: built-in:dplyr:summarize_at, type: Function, def. @7)}
    %%   summarize_each:                                        {**dplyr::summarize_each** (id: built-in:dplyr:summarize_each, type: Function, def. @7)}
    %%   summarize_each_:                                       {**dplyr::summarize_each_** (id: built-in:dplyr:summarize_each_, type: Function, def. @7)}
    %%   summarize_if:                                          {**dplyr::summarize_if** (id: built-in:dplyr:summarize_if, type: Function, def. @7)}
    %%   symdiff:                                               {**dplyr::symdiff** (id: built-in:dplyr:symdiff, type: Function, def. @7)}
    %%   symdiff.data.frame:                                    {**dplyr::symdiff.data.frame** (id: built-in:dplyr:symdiff.data.frame, type: Function, def. @7)}
    %%   symdiff.default:                                       {**dplyr::symdiff.default** (id: built-in:dplyr:symdiff.default, type: Function, def. @7)}
    %%   tally:                                                 {**dplyr::tally** (id: built-in:dplyr:tally, type: Function, def. @7)}
    %%   tally_:                                                {**dplyr::tally_** (id: built-in:dplyr:tally_, type: Function, def. @7)}
    %%   tally.data.frame:                                      {**dplyr::tally.data.frame** (id: built-in:dplyr:tally.data.frame, type: Function, def. @7)}
    %%   tbl:                                                   {**dplyr::tbl** (id: built-in:dplyr:tbl, type: Function, def. @7)}
    %%   tbl_df:                                                {**dplyr::tbl_df** (id: built-in:dplyr:tbl_df, type: Function, def. @7)}
    %%   tbl_nongroup_vars:                                     {**dplyr::tbl_nongroup_vars** (id: built-in:dplyr:tbl_nongroup_vars, type: Function, def. @7)}
    %%   tbl_ptype:                                             {**dplyr::tbl_ptype** (id: built-in:dplyr:tbl_ptype, type: Function, def. @7)}
    %%   tbl_ptype.default:                                     {**dplyr::tbl_ptype.default** (id: built-in:dplyr:tbl_ptype.default, type: Function, def. @7)}
    %%   tbl_sum.grouped_df:                                    {**dplyr::tbl_sum.grouped_df** (id: built-in:dplyr:tbl_sum.grouped_df, type: Function, def. @7)}
    %%   tbl_sum.rowwise_df:                                    {**dplyr::tbl_sum.rowwise_df** (id: built-in:dplyr:tbl_sum.rowwise_df, type: Function, def. @7)}
    %%   tbl_vars:                                              {**dplyr::tbl_vars** (id: built-in:dplyr:tbl_vars, type: Function, def. @7)}
    %%   tbl_vars.data.frame:                                   {**dplyr::tbl_vars.data.frame** (id: built-in:dplyr:tbl_vars.data.frame, type: Function, def. @7)}
    %%   tbl.DBIConnection:                                     {**dplyr::tbl.DBIConnection** (id: built-in:dplyr:tbl.DBIConnection, type: Function, def. @7)}
    %%   top_frac:                                              {**dplyr::top_frac** (id: built-in:dplyr:top_frac, type: Function, def. @7)}
    %%   top_n:                                                 {**dplyr::top_n** (id: built-in:dplyr:top_n, type: Function, def. @7)}
    %%   transmute:                                             {**dplyr::transmute** (id: built-in:dplyr:transmute, type: Function, def. @7)}
    %%   transmute_:                                            {**dplyr::transmute_** (id: built-in:dplyr:transmute_, type: Function, def. @7)}
    %%   transmute_all:                                         {**dplyr::transmute_all** (id: built-in:dplyr:transmute_all, type: Function, def. @7)}
    %%   transmute_at:                                          {**dplyr::transmute_at** (id: built-in:dplyr:transmute_at, type: Function, def. @7)}
    %%   transmute_if:                                          {**dplyr::transmute_if** (id: built-in:dplyr:transmute_if, type: Function, def. @7)}
    %%   transmute.data.frame:                                  {**dplyr::transmute.data.frame** (id: built-in:dplyr:transmute.data.frame, type: Function, def. @7)}
    %%   ungroup:                                               {**dplyr::ungroup** (id: built-in:dplyr:ungroup, type: Function, def. @7)}
    %%   ungroup.data.frame:                                    {**dplyr::ungroup.data.frame** (id: built-in:dplyr:ungroup.data.frame, type: Function, def. @7)}
    %%   ungroup.grouped_df:                                    {**dplyr::ungroup.grouped_df** (id: built-in:dplyr:ungroup.grouped_df, type: Function, def. @7)}
    %%   ungroup.rowwise_df:                                    {**dplyr::ungroup.rowwise_df** (id: built-in:dplyr:ungroup.rowwise_df, type: Function, def. @7)}
    %%   union_all:                                             {**dplyr::union_all** (id: built-in:dplyr:union_all, type: Function, def. @7)}
    %%   union_all.data.frame:                                  {**dplyr::union_all.data.frame** (id: built-in:dplyr:union_all.data.frame, type: Function, def. @7)}
    %%   union_all.default:                                     {**dplyr::union_all.default** (id: built-in:dplyr:union_all.default, type: Function, def. @7)}
    %%   union.data.frame:                                      {**dplyr::union.data.frame** (id: built-in:dplyr:union.data.frame, type: Function, def. @7)}
    %%   validate_grouped_df:                                   {**dplyr::validate_grouped_df** (id: built-in:dplyr:validate_grouped_df, type: Function, def. @7)}
    %%   validate_rowwise_df:                                   {**dplyr::validate_rowwise_df** (id: built-in:dplyr:validate_rowwise_df, type: Function, def. @7)}
    %%   vars:                                                  {**dplyr::vars** (id: built-in:dplyr:vars, type: Function, def. @7)}
    %%   when_all:                                              {**dplyr::when_all** (id: built-in:dplyr:when_all, type: Function, def. @7)}
    %%   when_any:                                              {**dplyr::when_any** (id: built-in:dplyr:when_any, type: Function, def. @7)}
    %%   with_groups:                                           {**dplyr::with_groups** (id: built-in:dplyr:with_groups, type: Function, def. @7)}
    %%   with_order:                                            {**dplyr::with_order** (id: built-in:dplyr:with_order, type: Function, def. @7)}
    %%   wrap_dbplyr_obj:                                       {**dplyr::wrap_dbplyr_obj** (id: built-in:dplyr:wrap_dbplyr_obj, type: Function, def. @7)}
    %%   %>%:                                                   {**dplyr::%>%** (id: built-in:dplyr:%>%, type: Function, def. @7)}
    %%   add_row:                                               {**dplyr::add_row** (id: built-in:dplyr:add_row, type: Function, def. @7)}
    %%   all_of:                                                {**dplyr::all_of** (id: built-in:dplyr:all_of, type: Function, def. @7)}
    %%   any_of:                                                {**dplyr::any_of** (id: built-in:dplyr:any_of, type: Function, def. @7)}
    %%   as_data_frame:                                         {**dplyr::as_data_frame** (id: built-in:dplyr:as_data_frame, type: Function, def. @7)}
    %%   as_label:                                              {**dplyr::as_label** (id: built-in:dplyr:as_label, type: Function, def. @7)}
    %%   as_tibble:                                             {**dplyr::as_tibble** (id: built-in:dplyr:as_tibble, type: Function, def. @7)}
    %%   contains:                                              {**dplyr::contains** (id: built-in:dplyr:contains, type: Function, def. @7)}
    %%   data_frame:                                            {**dplyr::data_frame** (id: built-in:dplyr:data_frame, type: Function, def. @7)}
    %%   ends_with:                                             {**dplyr::ends_with** (id: built-in:dplyr:ends_with, type: Function, def. @7)}
    %%   enexpr:                                                {**dplyr::enexpr** (id: built-in:dplyr:enexpr, type: Function, def. @7)}
    %%   enexprs:                                               {**dplyr::enexprs** (id: built-in:dplyr:enexprs, type: Function, def. @7)}
    %%   enquo:                                                 {**dplyr::enquo** (id: built-in:dplyr:enquo, type: Function, def. @7)}
    %%   enquos:                                                {**dplyr::enquos** (id: built-in:dplyr:enquos, type: Function, def. @7)}
    %%   ensym:                                                 {**dplyr::ensym** (id: built-in:dplyr:ensym, type: Function, def. @7)}
    %%   ensyms:                                                {**dplyr::ensyms** (id: built-in:dplyr:ensyms, type: Function, def. @7)}
    %%   everything:                                            {**dplyr::everything** (id: built-in:dplyr:everything, type: Function, def. @7)}
    %%   expr:                                                  {**dplyr::expr** (id: built-in:dplyr:expr, type: Function, def. @7)}
    %%   glimpse:                                               {**dplyr::glimpse** (id: built-in:dplyr:glimpse, type: Function, def. @7)}
    %%   intersect:                                             {**dplyr::intersect** (id: built-in:dplyr:intersect, type: Function, def. @7)}
    %%   last_col:                                              {**dplyr::last_col** (id: built-in:dplyr:last_col, type: Function, def. @7)}
    %%   lst:                                                   {**dplyr::lst** (id: built-in:dplyr:lst, type: Function, def. @7)}
    %%   matches:                                               {**dplyr::matches** (id: built-in:dplyr:matches, type: Function, def. @7)}
    %%   num_range:                                             {**dplyr::num_range** (id: built-in:dplyr:num_range, type: Function, def. @7)}
    %%   one_of:                                                {**dplyr::one_of** (id: built-in:dplyr:one_of, type: Function, def. @7)}
    %%   quo:                                                   {**dplyr::quo** (id: built-in:dplyr:quo, type: Function, def. @7)}
    %%   quo_name:                                              {**dplyr::quo_name** (id: built-in:dplyr:quo_name, type: Function, def. @7)}
    %%   quos:                                                  {**dplyr::quos** (id: built-in:dplyr:quos, type: Function, def. @7)}
    %%   setdiff:                                               {**dplyr::setdiff** (id: built-in:dplyr:setdiff, type: Function, def. @7)}
    %%   setequal:                                              {**dplyr::setequal** (id: built-in:dplyr:setequal, type: Function, def. @7)}
    %%   starts_with:                                           {**dplyr::starts_with** (id: built-in:dplyr:starts_with, type: Function, def. @7)}
    %%   sym:                                                   {**dplyr::sym** (id: built-in:dplyr:sym, type: Function, def. @7)}
    %%   syms:                                                  {**dplyr::syms** (id: built-in:dplyr:syms, type: Function, def. @7)}
    %%   tibble:                                                {**dplyr::tibble** (id: built-in:dplyr:tibble, type: Function, def. @7)}
    %%   tribble:                                               {**dplyr::tribble** (id: built-in:dplyr:tribble, type: Function, def. @7)}
    %%   type_sum:                                              {**dplyr::type_sum** (id: built-in:dplyr:type_sum, type: Function, def. @7)}
    %%   union:                                                 {**dplyr::union** (id: built-in:dplyr:union, type: Function, def. @7)}
    %%   where:                                                 {**dplyr::where** (id: built-in:dplyr:where, type: Function, def. @7)}
    %%   id:                                                    {**dplyr::id** (id: built-in:dplyr:id, type: Function, def. @7)}
    %%   select_vars_:                                          {**dplyr::select_vars_** (id: built-in:dplyr:select_vars_, type: Function, def. @7)}
    %%   rename_vars_:                                          {**dplyr::rename_vars_** (id: built-in:dplyr:rename_vars_, type: Function, def. @7)}
    %%   changes:                                               {**dplyr::changes** (id: built-in:dplyr:changes, type: Function, def. @7)}
    %%   location:                                              {**dplyr::location** (id: built-in:dplyr:location, type: Function, def. @7)}
    %%   eval_tbls2:                                            {**dplyr::eval_tbls2** (id: built-in:dplyr:eval_tbls2, type: Function, def. @7)}
    %%   eval_tbls:                                             {**dplyr::eval_tbls** (id: built-in:dplyr:eval_tbls, type: Function, def. @7)}
    %%   compare_tbls2:                                         {**dplyr::compare_tbls2** (id: built-in:dplyr:compare_tbls2, type: Function, def. @7)}
    %%   compare_tbls:                                          {**dplyr::compare_tbls** (id: built-in:dplyr:compare_tbls, type: Function, def. @7)}
    %%   bench_tbls:                                            {**dplyr::bench_tbls** (id: built-in:dplyr:bench_tbls, type: Function, def. @7)}
    %%   current_vars:                                          {**dplyr::current_vars** (id: built-in:dplyr:current_vars, type: Function, def. @7)}
    %%   select_var:                                            {**dplyr::select_var** (id: built-in:dplyr:select_var, type: Function, def. @7)}
    %%   rename_vars:                                           {**dplyr::rename_vars** (id: built-in:dplyr:rename_vars, type: Function, def. @7)}
    %%   select_vars:                                           {**dplyr::select_vars** (id: built-in:dplyr:select_vars, type: Function, def. @7)}
    %%   failwith:                                              {**dplyr::failwith** (id: built-in:dplyr:failwith, type: Function, def. @7)}
    %% 4----------------------------------------
    %% 5----------------------------------------
    %%   [.spec_tbl_df:                      {**readr::[.spec_tbl_df** (id: built-in:readr:[.spec_tbl_df, type: Function, def. @11)}
    %%   AccumulateCallback:                 {**readr::AccumulateCallback** (id: built-in:readr:AccumulateCallback, type: Function, def. @11)}
    %%   as_chunk_callback.ChunkCallback:    {**readr::as_chunk_callback.ChunkCallback** (id: built-in:readr:as_chunk_callback.ChunkCallback, type: Function, def. @11)}
    %%   as_chunk_callback.function:         {**readr::as_chunk_callback.function** (id: built-in:readr:as_chunk_callback.function, type: Function, def. @11)}
    %%   as_chunk_callback.R6ClassGenerator: {**readr::as_chunk_callback.R6ClassGenerator** (id: built-in:readr:as_chunk_callback.R6ClassGenerator, type: Function, def. @11)}
    %%   as_tibble.spec_tbl_df:              {**readr::as_tibble.spec_tbl_df** (id: built-in:readr:as_tibble.spec_tbl_df, type: Function, def. @11)}
    %%   as.character.col_spec:              {**readr::as.character.col_spec** (id: built-in:readr:as.character.col_spec, type: Function, def. @11)}
    %%   as.col_spec:                        {**readr::as.col_spec** (id: built-in:readr:as.col_spec, type: Function, def. @11)}
    %%   as.col_spec.character:              {**readr::as.col_spec.character** (id: built-in:readr:as.col_spec.character, type: Function, def. @11)}
    %%   as.col_spec.col_spec:               {**readr::as.col_spec.col_spec** (id: built-in:readr:as.col_spec.col_spec, type: Function, def. @11)}
    %%   as.col_spec.data.frame:             {**readr::as.col_spec.data.frame** (id: built-in:readr:as.col_spec.data.frame, type: Function, def. @11)}
    %%   as.col_spec.default:                {**readr::as.col_spec.default** (id: built-in:readr:as.col_spec.default, type: Function, def. @11)}
    %%   as.col_spec.list:                   {**readr::as.col_spec.list** (id: built-in:readr:as.col_spec.list, type: Function, def. @11)}
    %%   as.col_spec.NULL:                   {**readr::as.col_spec.NULL** (id: built-in:readr:as.col_spec.NULL, type: Function, def. @11)}
    %%   as.data.frame.spec_tbl_df:          {**readr::as.data.frame.spec_tbl_df** (id: built-in:readr:as.data.frame.spec_tbl_df, type: Function, def. @11)}
    %%   ChunkCallback:                      {**readr::ChunkCallback** (id: built-in:readr:ChunkCallback, type: Function, def. @11)}
    %%   clipboard:                          {**readr::clipboard** (id: built-in:readr:clipboard, type: Function, def. @11)}
    %%   col_character:                      {**readr::col_character** (id: built-in:readr:col_character, type: Function, def. @11)}
    %%   col_date:                           {**readr::col_date** (id: built-in:readr:col_date, type: Function, def. @11)}
    %%   col_datetime:                       {**readr::col_datetime** (id: built-in:readr:col_datetime, type: Function, def. @11)}
    %%   col_double:                         {**readr::col_double** (id: built-in:readr:col_double, type: Function, def. @11)}
    %%   col_factor:                         {**readr::col_factor** (id: built-in:readr:col_factor, type: Function, def. @11)}
    %%   col_guess:                          {**readr::col_guess** (id: built-in:readr:col_guess, type: Function, def. @11)}
    %%   col_integer:                        {**readr::col_integer** (id: built-in:readr:col_integer, type: Function, def. @11)}
    %%   col_logical:                        {**readr::col_logical** (id: built-in:readr:col_logical, type: Function, def. @11)}
    %%   col_number:                         {**readr::col_number** (id: built-in:readr:col_number, type: Function, def. @11)}
    %%   col_skip:                           {**readr::col_skip** (id: built-in:readr:col_skip, type: Function, def. @11)}
    %%   col_time:                           {**readr::col_time** (id: built-in:readr:col_time, type: Function, def. @11)}
    %%   cols:                               {**readr::cols** (id: built-in:readr:cols, type: Function, def. @11)}
    %%   cols_condense:                      {**readr::cols_condense** (id: built-in:readr:cols_condense, type: Function, def. @11)}
    %%   cols_only:                          {**readr::cols_only** (id: built-in:readr:cols_only, type: Function, def. @11)}
    %%   count_fields:                       {**readr::count_fields** (id: built-in:readr:count_fields, type: Function, def. @11)}
    %%   DataFrameCallback:                  {**readr::DataFrameCallback** (id: built-in:readr:DataFrameCallback, type: Function, def. @11)}
    %%   datasource:                         {**readr::datasource** (id: built-in:readr:datasource, type: Function, def. @11)}
    %%   date_names:                         {**readr::date_names** (id: built-in:readr:date_names, type: Function, def. @11)}
    %%   date_names_lang:                    {**readr::date_names_lang** (id: built-in:readr:date_names_lang, type: Function, def. @11)}
    %%   date_names_langs:                   {**readr::date_names_langs** (id: built-in:readr:date_names_langs, type: Function, def. @11)}
    %%   default_locale:                     {**readr::default_locale** (id: built-in:readr:default_locale, type: Function, def. @11)}
    %%   edition_get:                        {**readr::edition_get** (id: built-in:readr:edition_get, type: Function, def. @11)}
    %%   format_csv:                         {**readr::format_csv** (id: built-in:readr:format_csv, type: Function, def. @11)}
    %%   format_csv2:                        {**readr::format_csv2** (id: built-in:readr:format_csv2, type: Function, def. @11)}
    %%   format_delim:                       {**readr::format_delim** (id: built-in:readr:format_delim, type: Function, def. @11)}
    %%   format_tsv:                         {**readr::format_tsv** (id: built-in:readr:format_tsv, type: Function, def. @11)}
    %%   format.col_spec:                    {**readr::format.col_spec** (id: built-in:readr:format.col_spec, type: Function, def. @11)}
    %%   fwf_cols:                           {**readr::fwf_cols** (id: built-in:readr:fwf_cols, type: Function, def. @11)}
    %%   fwf_empty:                          {**readr::fwf_empty** (id: built-in:readr:fwf_empty, type: Function, def. @11)}
    %%   fwf_positions:                      {**readr::fwf_positions** (id: built-in:readr:fwf_positions, type: Function, def. @11)}
    %%   fwf_widths:                         {**readr::fwf_widths** (id: built-in:readr:fwf_widths, type: Function, def. @11)}
    %%   guess_encoding:                     {**readr::guess_encoding** (id: built-in:readr:guess_encoding, type: Function, def. @11)}
    %%   guess_parser:                       {**readr::guess_parser** (id: built-in:readr:guess_parser, type: Function, def. @11)}
    %%   ListCallback:                       {**readr::ListCallback** (id: built-in:readr:ListCallback, type: Function, def. @11)}
    %%   local_edition:                      {**readr::local_edition** (id: built-in:readr:local_edition, type: Function, def. @11)}
    %%   locale:                             {**readr::locale** (id: built-in:readr:locale, type: Function, def. @11)}
    %%   output_column:                      {**readr::output_column** (id: built-in:readr:output_column, type: Function, def. @11)}
    %%   output_column.default:              {**readr::output_column.default** (id: built-in:readr:output_column.default, type: Function, def. @11)}
    %%   output_column.double:               {**readr::output_column.double** (id: built-in:readr:output_column.double, type: Function, def. @11)}
    %%   output_column.POSIXt:               {**readr::output_column.POSIXt** (id: built-in:readr:output_column.POSIXt, type: Function, def. @11)}
    %%   parse_character:                    {**readr::parse_character** (id: built-in:readr:parse_character, type: Function, def. @11)}
    %%   parse_date:                         {**readr::parse_date** (id: built-in:readr:parse_date, type: Function, def. @11)}
    %%   parse_datetime:                     {**readr::parse_datetime** (id: built-in:readr:parse_datetime, type: Function, def. @11)}
    %%   parse_double:                       {**readr::parse_double** (id: built-in:readr:parse_double, type: Function, def. @11)}
    %%   parse_factor:                       {**readr::parse_factor** (id: built-in:readr:parse_factor, type: Function, def. @11)}
    %%   parse_guess:                        {**readr::parse_guess** (id: built-in:readr:parse_guess, type: Function, def. @11)}
    %%   parse_integer:                      {**readr::parse_integer** (id: built-in:readr:parse_integer, type: Function, def. @11)}
    %%   parse_logical:                      {**readr::parse_logical** (id: built-in:readr:parse_logical, type: Function, def. @11)}
    %%   parse_number:                       {**readr::parse_number** (id: built-in:readr:parse_number, type: Function, def. @11)}
    %%   parse_time:                         {**readr::parse_time** (id: built-in:readr:parse_time, type: Function, def. @11)}
    %%   parse_vector:                       {**readr::parse_vector** (id: built-in:readr:parse_vector, type: Function, def. @11)}
    %%   print.col_spec:                     {**readr::print.col_spec** (id: built-in:readr:print.col_spec, type: Function, def. @11)}
    %%   print.collector:                    {**readr::print.collector** (id: built-in:readr:print.collector, type: Function, def. @11)}
    %%   print.date_names:                   {**readr::print.date_names** (id: built-in:readr:print.date_names, type: Function, def. @11)}
    %%   print.locale:                       {**readr::print.locale** (id: built-in:readr:print.locale, type: Function, def. @11)}
    %%   problems:                           {**readr::problems** (id: built-in:readr:problems, type: Function, def. @11)}
    %%   read_builtin:                       {**readr::read_builtin** (id: built-in:readr:read_builtin, type: Function, def. @11)}
    %%   read_csv:                           {**readr::read_csv** (id: built-in:readr:read_csv, type: Function, def. @11)}
    %%   read_csv_chunked:                   {**readr::read_csv_chunked** (id: built-in:readr:read_csv_chunked, type: Function, def. @11)}
    %%   read_csv2:                          {**readr::read_csv2** (id: built-in:readr:read_csv2, type: Function, def. @11)}
    %%   read_csv2_chunked:                  {**readr::read_csv2_chunked** (id: built-in:readr:read_csv2_chunked, type: Function, def. @11)}
    %%   read_delim:                         {**readr::read_delim** (id: built-in:readr:read_delim, type: Function, def. @11)}
    %%   read_delim_chunked:                 {**readr::read_delim_chunked** (id: built-in:readr:read_delim_chunked, type: Function, def. @11)}
    %%   read_file:                          {**readr::read_file** (id: built-in:readr:read_file, type: Function, def. @11)}
    %%   read_file_raw:                      {**readr::read_file_raw** (id: built-in:readr:read_file_raw, type: Function, def. @11)}
    %%   read_fwf:                           {**readr::read_fwf** (id: built-in:readr:read_fwf, type: Function, def. @11)}
    %%   read_lines:                         {**readr::read_lines** (id: built-in:readr:read_lines, type: Function, def. @11)}
    %%   read_lines_chunked:                 {**readr::read_lines_chunked** (id: built-in:readr:read_lines_chunked, type: Function, def. @11)}
    %%   read_lines_raw:                     {**readr::read_lines_raw** (id: built-in:readr:read_lines_raw, type: Function, def. @11)}
    %%   read_lines_raw_chunked:             {**readr::read_lines_raw_chunked** (id: built-in:readr:read_lines_raw_chunked, type: Function, def. @11)}
    %%   read_log:                           {**readr::read_log** (id: built-in:readr:read_log, type: Function, def. @11)}
    %%   read_rds:                           {**readr::read_rds** (id: built-in:readr:read_rds, type: Function, def. @11)}
    %%   read_table:                         {**readr::read_table** (id: built-in:readr:read_table, type: Function, def. @11)}
    %%   read_tsv:                           {**readr::read_tsv** (id: built-in:readr:read_tsv, type: Function, def. @11)}
    %%   read_tsv_chunked:                   {**readr::read_tsv_chunked** (id: built-in:readr:read_tsv_chunked, type: Function, def. @11)}
    %%   readr_example:                      {**readr::readr_example** (id: built-in:readr:readr_example, type: Function, def. @11)}
    %%   readr_threads:                      {**readr::readr_threads** (id: built-in:readr:readr_threads, type: Function, def. @11)}
    %%   should_read_lazy:                   {**readr::should_read_lazy** (id: built-in:readr:should_read_lazy, type: Function, def. @11)}
    %%   should_show_types:                  {**readr::should_show_types** (id: built-in:readr:should_show_types, type: Function, def. @11)}
    %%   show_progress:                      {**readr::show_progress** (id: built-in:readr:show_progress, type: Function, def. @11)}
    %%   SideEffectChunkCallback:            {**readr::SideEffectChunkCallback** (id: built-in:readr:SideEffectChunkCallback, type: Function, def. @11)}
    %%   spec:                               {**readr::spec** (id: built-in:readr:spec, type: Function, def. @11)}
    %%   spec_csv:                           {**readr::spec_csv** (id: built-in:readr:spec_csv, type: Function, def. @11)}
    %%   spec_csv2:                          {**readr::spec_csv2** (id: built-in:readr:spec_csv2, type: Function, def. @11)}
    %%   spec_delim:                         {**readr::spec_delim** (id: built-in:readr:spec_delim, type: Function, def. @11)}
    %%   spec_table:                         {**readr::spec_table** (id: built-in:readr:spec_table, type: Function, def. @11)}
    %%   spec_tsv:                           {**readr::spec_tsv** (id: built-in:readr:spec_tsv, type: Function, def. @11)}
    %%   stop_for_problems:                  {**readr::stop_for_problems** (id: built-in:readr:stop_for_problems, type: Function, def. @11)}
    %%   str.col_spec:                       {**readr::str.col_spec** (id: built-in:readr:str.col_spec, type: Function, def. @11)}
    %%   tokenize:                           {**readr::tokenize** (id: built-in:readr:tokenize, type: Function, def. @11)}
    %%   tokenizer_csv:                      {**readr::tokenizer_csv** (id: built-in:readr:tokenizer_csv, type: Function, def. @11)}
    %%   tokenizer_delim:                    {**readr::tokenizer_delim** (id: built-in:readr:tokenizer_delim, type: Function, def. @11)}
    %%   tokenizer_fwf:                      {**readr::tokenizer_fwf** (id: built-in:readr:tokenizer_fwf, type: Function, def. @11)}
    %%   tokenizer_line:                     {**readr::tokenizer_line** (id: built-in:readr:tokenizer_line, type: Function, def. @11)}
    %%   tokenizer_log:                      {**readr::tokenizer_log** (id: built-in:readr:tokenizer_log, type: Function, def. @11)}
    %%   tokenizer_tsv:                      {**readr::tokenizer_tsv** (id: built-in:readr:tokenizer_tsv, type: Function, def. @11)}
    %%   tokenizer_ws:                       {**readr::tokenizer_ws** (id: built-in:readr:tokenizer_ws, type: Function, def. @11)}
    %%   type_convert:                       {**readr::type_convert** (id: built-in:readr:type_convert, type: Function, def. @11)}
    %%   type_to_col.Date:                   {**readr::type_to_col.Date** (id: built-in:readr:type_to_col.Date, type: Function, def. @11)}
    %%   type_to_col.default:                {**readr::type_to_col.default** (id: built-in:readr:type_to_col.default, type: Function, def. @11)}
    %%   type_to_col.double:                 {**readr::type_to_col.double** (id: built-in:readr:type_to_col.double, type: Function, def. @11)}
    %%   type_to_col.factor:                 {**readr::type_to_col.factor** (id: built-in:readr:type_to_col.factor, type: Function, def. @11)}
    %%   type_to_col.hms:                    {**readr::type_to_col.hms** (id: built-in:readr:type_to_col.hms, type: Function, def. @11)}
    %%   type_to_col.integer:                {**readr::type_to_col.integer** (id: built-in:readr:type_to_col.integer, type: Function, def. @11)}
    %%   type_to_col.logical:                {**readr::type_to_col.logical** (id: built-in:readr:type_to_col.logical, type: Function, def. @11)}
    %%   type_to_col.POSIXct:                {**readr::type_to_col.POSIXct** (id: built-in:readr:type_to_col.POSIXct, type: Function, def. @11)}
    %%   with_edition:                       {**readr::with_edition** (id: built-in:readr:with_edition, type: Function, def. @11)}
    %%   write_csv:                          {**readr::write_csv** (id: built-in:readr:write_csv, type: Function, def. @11)}
    %%   write_csv2:                         {**readr::write_csv2** (id: built-in:readr:write_csv2, type: Function, def. @11)}
    %%   write_delim:                        {**readr::write_delim** (id: built-in:readr:write_delim, type: Function, def. @11)}
    %%   write_excel_csv:                    {**readr::write_excel_csv** (id: built-in:readr:write_excel_csv, type: Function, def. @11)}
    %%   write_excel_csv2:                   {**readr::write_excel_csv2** (id: built-in:readr:write_excel_csv2, type: Function, def. @11)}
    %%   write_file:                         {**readr::write_file** (id: built-in:readr:write_file, type: Function, def. @11)}
    %%   write_lines:                        {**readr::write_lines** (id: built-in:readr:write_lines, type: Function, def. @11)}
    %%   write_rds:                          {**readr::write_rds** (id: built-in:readr:write_rds, type: Function, def. @11)}
    %%   write_tsv:                          {**readr::write_tsv** (id: built-in:readr:write_tsv, type: Function, def. @11)}
    %%   read_table2:                        {**readr::read_table2** (id: built-in:readr:read_table2, type: Function, def. @11)}
    %%   melt_table:                         {**readr::melt_table** (id: built-in:readr:melt_table, type: Function, def. @11)}
    %%   melt_fwf:                           {**readr::melt_fwf** (id: built-in:readr:melt_fwf, type: Function, def. @11)}
    %%   melt_delim:                         {**readr::melt_delim** (id: built-in:readr:melt_delim, type: Function, def. @11)}
    %% 6----------------------------------------
    %%   #search-path:ggplot: {**#search-path:ggplot** (id: 3, type: Variable, def. @3)}
    %%   #search-path:        {**#search-path** (id: 3, type: Variable, cds: {}, def. @3), **#search-path** (id: 7, type: Variable, cds: {}, def. @7), **#search-path** (id: 11, type: Variable, cds: {}, def. @11)}
    %%   #search-path:dplyr:  {**#search-path:dplyr** (id: 7, type: Variable, def. @7)}
    %%   #search-path:readr:  {**#search-path:readr** (id: 11, type: Variable, def. @11)}
    %%   data:                {**data** (id: 12, type: Unknown, def. @17)}
    %%   data2:               {**data2** (id: 18, type: Unknown, def. @23)}
    %%   m:                   {**m** (id: 24, type: Unknown, def. @32)}
    %%   #sink:output:        {**#sink:output** (id: 36, type: Variable, cds: {}, def. @36)}
    54[["`*#91;RFunctionCall#93;* **geom#95;point**
      *14.9-20* (**id: 54**)`"]]
    55[["`*#91;RBinaryOp#93;* base#58;#58;**#43;**
      *12.1-14.20* (**id: 55**)
    arg: (52, 54)`"]]
    built-in:_43_["`Built-In:
#43;`"]
    style built-in:_43_ stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    57(["`*#91;RSymbol#93;* **data2**
      *16.6-10* (**id: 57**)`"])
    58{{"`*#91;RSymbol#93;* **x**
      *16.12* (**id: 58**)`"}}
    60[["`*#91;RAccess#93;* base#58;#58;**$**
      *16.6-12* (**id: 60**)
    arg: (57, 58)`"]]
    62(["`*#91;RSymbol#93;* **data2**
      *16.15-19* (**id: 62**)`"])
    63{{"`*#91;RSymbol#93;* **y**
      *16.21* (**id: 63**)`"}}
    65[["`*#91;RAccess#93;* base#58;#58;**$**
      *16.15-21* (**id: 65**)
    arg: (62, 63)`"]]
    67[["`*#91;RFunctionCall#93;* base#58;#58;**plot**
      *16.1-22* (**id: 67**)
    arg: (60, 65)`"]]
    built-in:plot["`Built-In:
plot`"]
    style built-in:plot stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    69(["`*#91;RSymbol#93;* **data2**
      *17.8-12* (**id: 69**)`"])
    70{{"`*#91;RSymbol#93;* **x**
      *17.14* (**id: 70**)`"}}
    72[["`*#91;RAccess#93;* base#58;#58;**$**
      *17.8-14* (**id: 72**)
    arg: (69, 70)`"]]
    74(["`*#91;RSymbol#93;* **data2**
      *17.17-21* (**id: 74**)`"])
    75{{"`*#91;RSymbol#93;* **y**
      *17.23* (**id: 75**)`"}}
    77[["`*#91;RAccess#93;* base#58;#58;**$**
      *17.17-23* (**id: 77**)
    arg: (74, 75)`"]]
    79[["`*#91;RFunctionCall#93;* graphics#58;#58;**points**
      *17.1-24* (**id: 79**)
    arg: (72, 77)`"]]
    built-in:points["`Built-In:
points`"]
    style built-in:points stroke:gray,fill:gray,stroke-width:2px,opacity:.8;
    82(["`*#91;RSymbol#93;* **data2**
      *19.12-16* (**id: 82**)`"])
    83{{"`*#91;RSymbol#93;* **k**
      *19.18* (**id: 83**)`"}}
    85[["`*#91;RAccess#93;* base#58;#58;**$**
      *19.12-18* (**id: 85**)
    arg: (82, 83)`"]]
    87[["`*#91;RFunctionCall#93;* base#58;#58;**mean**
      *19.7-19* (**id: 87**)
    arg: (85)`"]]
    89[["`*#91;RFunctionCall#93;* base#58;#58;**print**
      *19.1-20* (**id: 89**)
    arg: (87)`"]]
    1 -.->|"flow"| 3
    linkStyle 0 stroke:gray,color:gray;
    3 -->|"arg"| 1
    3 -.->|"reads, calls"| built-in:library
    linkStyle 2 stroke:gray;
    3 -.->|"flow"| 5
    linkStyle 3 stroke:gray,color:gray;
    5 -.->|"flow"| 7
    linkStyle 4 stroke:gray,color:gray;
    7 -->|"arg"| 5
    7 -.->|"reads, calls"| built-in:library
    linkStyle 6 stroke:gray;
    7 -.->|"flow"| 9
    linkStyle 7 stroke:gray,color:gray;
    9 -.->|"flow"| 11
    linkStyle 8 stroke:gray,color:gray;
    11 -->|"arg"| 9
    11 -.->|"reads, calls"| built-in:library
    linkStyle 10 stroke:gray;
    11 -.->|"flow"| 14
    linkStyle 11 stroke:gray,color:gray;
    14 -.->|"flow"| 16
    linkStyle 12 stroke:gray,color:gray;
    16 -->|"reads, arg"| 14
    16 -->|"reads"| 11
    16 -.->|"reads, calls"| built-in:readr:read_csv
    linkStyle 15 stroke:gray;
    16 -.->|"flow"| 12
    linkStyle 16 stroke:gray,color:gray;
    12 -->|"defined-by, flow"| 17
    12 -->|"defined-by"| 16
    17 -->|"reads, arg"| 16
    17 -->|"returns, arg"| 12
    17 -.->|"reads, calls"| built-in:_60_-
    linkStyle 21 stroke:gray;
    17 -.->|"flow"| 20
    linkStyle 22 stroke:gray,color:gray;
    20 -.->|"flow"| 22
    linkStyle 23 stroke:gray,color:gray;
    22 -->|"reads, arg"| 20
    22 -->|"reads"| 11
    22 -.->|"reads, calls"| built-in:readr:read_csv
    linkStyle 26 stroke:gray;
    22 -.->|"flow"| 18
    linkStyle 27 stroke:gray,color:gray;
    18 -->|"defined-by, flow"| 23
    18 -->|"defined-by"| 22
    23 -->|"reads, arg"| 22
    23 -->|"returns, arg"| 18
    23 -.->|"reads, calls"| built-in:_60_-
    linkStyle 32 stroke:gray;
    23 -.->|"flow"| 26
    linkStyle 33 stroke:gray,color:gray;
    26 -->|"reads"| 12
    26 -.->|"flow"| 27
    linkStyle 35 stroke:gray,color:gray;
    27 -.->|"flow"| 29
    linkStyle 36 stroke:gray,color:gray;
    29 -->|"reads, returns, arg"| 26
    29 -->|"reads, arg"| 27
    29 -.->|"reads, calls"| built-in:_36_
    linkStyle 39 stroke:gray;
    29 -.->|"flow"| 31
    linkStyle 40 stroke:gray,color:gray;
    31 -->|"reads, arg"| 29
    31 -.->|"flow"| 24
    linkStyle 42 stroke:gray,color:gray;
    31 -.->|"reads, calls"| built-in:mean
    linkStyle 43 stroke:gray;
    24 -->|"defined-by, flow"| 32
    24 -->|"defined-by"| 31
    32 -->|"reads, arg"| 31
    32 -->|"returns, arg"| 24
    32 -.->|"reads, calls"| built-in:_60_-
    linkStyle 48 stroke:gray;
    32 -.->|"flow"| 34
    linkStyle 49 stroke:gray,color:gray;
    34 -->|"reads"| 24
    34 -.->|"flow"| 36
    linkStyle 51 stroke:gray,color:gray;
    36 -->|"reads, returns, arg"| 34
    36 -.->|"reads, calls"| built-in:print
    linkStyle 53 stroke:gray;
    36 -.->|"flow"| 38
    linkStyle 54 stroke:gray,color:gray;
    38 -->|"reads"| 12
    38 -.->|"flow"| 43
    linkStyle 56 stroke:gray,color:gray;
    43 -.->|"flow"| 44
    linkStyle 57 stroke:gray,color:gray;
    44 -->|"reads"| 43
    44 -.->|"flow"| 46
    linkStyle 59 stroke:gray,color:gray;
    46 -.->|"flow"| 47
    linkStyle 60 stroke:gray,color:gray;
    47 -->|"reads"| 46
    47 -.->|"flow"| 48
    linkStyle 62 stroke:gray,color:gray;
    48 -->|"reads"| 43
    48 -->|"arg"| 44
    48 -->|"reads"| 46
    48 -->|"arg"| 47
    48 -->|"reads"| 3
    48 -->|"reads"| 7
    48 -->|"reads"| 11
    48 -.->|"flow"| 50
    linkStyle 70 stroke:gray,color:gray;
    50 -->|"reads, arg"| 48
    50 -->|"reads"| 3
    50 -->|"reads"| 7
    50 -->|"reads"| 11
    50 -.->|"flow"| 52
    linkStyle 75 stroke:gray,color:gray;
    50 -->|"reads, arg"| 38
    52 -->|"arg"| 38
    52 -->|"returns, arg"| 50
    52 -->|"reads"| 7
    52 -.->|"reads, calls"| built-in:dplyr:_37__62__37_
    linkStyle 80 stroke:gray;
    52 -.->|"flow"| 54
    linkStyle 81 stroke:gray,color:gray;
    54 -->|"reads"| 3
    54 -->|"reads"| 7
    54 -->|"reads"| 11
    54 -.->|"flow"| 55
    linkStyle 85 stroke:gray,color:gray;
    55 -->|"reads, arg"| 52
    55 -->|"reads, arg"| 54
    55 -.->|"reads, calls"| built-in:_43_
    linkStyle 88 stroke:gray;
    55 -.->|"flow"| 57
    linkStyle 89 stroke:gray,color:gray;
    57 -->|"reads"| 18
    57 -.->|"flow"| 58
    linkStyle 91 stroke:gray,color:gray;
    58 -.->|"flow"| 60
    linkStyle 92 stroke:gray,color:gray;
    60 -->|"reads, returns, arg"| 57
    60 -->|"reads, arg"| 58
    60 -.->|"reads, calls"| built-in:_36_
    linkStyle 95 stroke:gray;
    60 -.->|"flow"| 62
    linkStyle 96 stroke:gray,color:gray;
    62 -->|"reads"| 18
    62 -.->|"flow"| 63
    linkStyle 98 stroke:gray,color:gray;
    63 -.->|"flow"| 65
    linkStyle 99 stroke:gray,color:gray;
    65 -->|"reads, returns, arg"| 62
    65 -->|"reads, arg"| 63
    65 -.->|"reads, calls"| built-in:_36_
    linkStyle 102 stroke:gray;
    65 -.->|"flow"| 67
    linkStyle 103 stroke:gray,color:gray;
    67 -->|"reads, arg"| 60
    67 -->|"reads, arg"| 65
    67 -.->|"reads, calls"| built-in:plot
    linkStyle 106 stroke:gray;
    67 -.->|"flow"| 69
    linkStyle 107 stroke:gray,color:gray;
    69 -->|"reads"| 18
    69 -.->|"flow"| 70
    linkStyle 109 stroke:gray,color:gray;
    70 -.->|"flow"| 72
    linkStyle 110 stroke:gray,color:gray;
    72 -->|"reads, returns, arg"| 69
    72 -->|"reads, arg"| 70
    72 -.->|"reads, calls"| built-in:_36_
    linkStyle 113 stroke:gray;
    72 -.->|"flow"| 74
    linkStyle 114 stroke:gray,color:gray;
    74 -->|"reads"| 18
    74 -.->|"flow"| 75
    linkStyle 116 stroke:gray,color:gray;
    75 -.->|"flow"| 77
    linkStyle 117 stroke:gray,color:gray;
    77 -->|"reads, returns, arg"| 74
    77 -->|"reads, arg"| 75
    77 -.->|"reads, calls"| built-in:_36_
    linkStyle 120 stroke:gray;
    77 -.->|"flow"| 79
    linkStyle 121 stroke:gray,color:gray;
    79 -->|"reads, arg"| 72
    79 -->|"reads, arg"| 77
    79 -.->|"reads, calls"| built-in:points
    linkStyle 124 stroke:gray;
    79 -->|"reads"| 67
    79 -.->|"flow"| 82
    linkStyle 126 stroke:gray,color:gray;
    82 -->|"reads"| 18
    82 -.->|"flow"| 83
    linkStyle 128 stroke:gray,color:gray;
    83 -.->|"flow"| 85
    linkStyle 129 stroke:gray,color:gray;
    85 -->|"reads, returns, arg"| 82
    85 -->|"reads, arg"| 83
    85 -.->|"reads, calls"| built-in:_36_
    linkStyle 132 stroke:gray;
    85 -.->|"flow"| 87
    linkStyle 133 stroke:gray,color:gray;
    87 -->|"reads, arg"| 85
    87 -.->|"reads, calls"| built-in:mean
    linkStyle 135 stroke:gray;
    87 -.->|"flow"| 89
    linkStyle 136 stroke:gray,color:gray;
    89 -->|"reads, returns, arg"| 87
    89 -.->|"reads, calls"| built-in:print
    linkStyle 138 stroke:gray;
```

(The analysis ran (parse and normalize with the [r-shell](https://github.com/flowr-analysis/flowr/wiki/Engines) engine) in the generation environment. No [signature database](https://github.com/flowr-analysis/flowr/wiki/Signature-Database) is mounted, so `library()` attaches no exports (base-R names are still qualified, e.g., `stats::acf`).)

</details>

&nbsp;

Additionally, consider that you are interested in all function calls which loads data with `read_csv`.
A simple `regex`-based query could look like this: `^read_csv$`.
However, this fails to incorporate
 
1. Syntax-based information (comments, strings, used as a variable, called as a higher-order function, ...)
2. Semantic information (e.g., `read_csv` is overwritten by a function with the same name)
3. Context information (e.g., calls like `points` may link to the current plot)

To solve this, flowR provides a query API which allows you to specify queries on the dataflow graph.
For the specific use-case stated, you could use the [Call-Context Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Call-Context) to find all calls to `read_csv` which refer functions that are not overwritten.

Just as an example, the following [Call-Context Query](https://github.com/flowr-analysis/flowr/wiki/%5BQuery%5D-Call-Context) finds all calls to `read_csv` that are not overwritten:

```json
[ { "type": "call-context",   "callName": "^read_csv$",   "callTargets": "global",   "kind": "input",   "subkind": "csv-file" } ]
```

_Results (prettified and summarized):_

Query: **call-context** (0 ms)\
&nbsp;&nbsp;&nbsp;╰ **input** (2 hits):\
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;╰ **csv-file** (2 hits): _`read_csv('data.csv')`_ (L.6) with 1 call (UNKNOWN: built-in (info: undefined)), _`read_csv('data2.csv')`_ (L.7) with 1 call (UNKNOWN: built-in (info: undefined))

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

The analysis ran (including parsing and normalization and the query) within the generation environment.

The JSON contains the ids of the nodes in question (see the [Interface](https://github.com/flowr-analysis/flowr/wiki/Interface) wiki page).

```json
{"call-context":{".meta":{},"kinds":{"input":{"subkinds":{"csv-file":[{"id":16,"name":"read_csv","calls":["built-in"]},{"id":22,"name":"read_csv","calls":["built-in"]}]}}}},".meta":{}}
```

</details>

Every query is explained in detail on its own wiki page, linked from the overviews above.
