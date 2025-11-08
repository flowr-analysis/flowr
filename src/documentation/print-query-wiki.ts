import { RShell } from '../r-bridge/shell';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { executeQueries, QueriesSchema } from '../queries/query';
import { FlowrGithubBaseRef, FlowrGithubGroupName, FlowrWikiBaseRef, getFilePathMd } from './doc-util/doc-files';
import {
	explainQueries,
	linkToQueryOfName,
	registerQueryDocumentation,
	showQuery,
	tocForQueryType
} from './doc-util/doc-query';
import { describeSchema } from '../util/schema';
import { markdownFormatter } from '../util/text/ansi';
import { executeCallContextQueries } from '../queries/catalog/call-context-query/call-context-query-executor';
import { executeCompoundQueries } from '../queries/virtual-query/compound-query';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { exampleQueryCode } from './data/query/example-query-code';
import { block, details } from './doc-util/doc-structure';
import { codeBlock } from './doc-util/doc-code';
import { executeDataflowQuery } from '../queries/catalog/dataflow-query/dataflow-query-executor';
import { executeIdMapQuery } from '../queries/catalog/id-map-query/id-map-query-executor';
import { executeNormalizedAstQuery } from '../queries/catalog/normalized-ast-query/normalized-ast-query-executor';
import { executeDataflowClusterQuery } from '../queries/catalog/cluster-query/cluster-query-executor';
import { executeStaticSliceQuery } from '../queries/catalog/static-slice-query/static-slice-query-executor';
import { executeLineageQuery } from '../queries/catalog/lineage-query/lineage-query-executor';
import { executeDependenciesQuery } from '../queries/catalog/dependencies-query/dependencies-query-executor';
import { getReplCommand } from './doc-util/doc-cli-option';
import { NewIssueUrl } from './doc-util/doc-issue';
import { executeLocationMapQuery } from '../queries/catalog/location-map-query/location-map-query-executor';
import { CallTargets } from '../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { executeConfigQuery } from '../queries/catalog/config-query/config-query-executor';
import { executeSearch } from '../queries/catalog/search-query/search-query-executor';
import { Q } from '../search/flowr-search-builder';
import { VertexType } from '../dataflow/graph/vertex';
import { getTypesFromFolder, shortLink } from './doc-util/doc-types';
import path from 'path';
import { executeControlFlowQuery } from '../queries/catalog/control-flow-query/control-flow-query-executor';
import { printCfgCode } from './doc-util/doc-cfg';
import { executeDfShapeQuery } from '../queries/catalog/df-shape-query/df-shape-query-executor';
import { SliceDirection } from '../core/steps/all/static-slicing/00-slice';
import { documentReplSession } from './doc-util/doc-repl';
import {
	executeHigherOrderQuery
} from '../queries/catalog/inspect-higher-order-query/inspect-higher-order-query-executor';


registerQueryDocumentation('call-context', {
	name:             'Call-Context Query',
	type:             'active',
	shortDescription: 'Finds all calls in a set of files that matches specified criteria.',
	functionName:     executeCallContextQueries.name,
	functionFile:     '../queries/catalog/call-context-query/call-context-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		return `
Call context queries can be used to identify calls to specific functions that match criteria of your interest.
For now, we support two criteria:

1. **Function Name** (\`callName\`): The function name is specified by a regular expression. This allows you to find all calls to functions that match a specific pattern. Please note, that if you do not use Regex-Anchors, the query will match any function name that contains the given pattern (you can set the \`callNameExact\` property to \`true\` to automatically add the \`^...$\` anchors).
2. **Call Targets**  (\`callTargets\`): This specifies to what the function call targets. For example, you may want to find all calls to a function that is not defined locally.

Besides this, we provide the following ways to automatically categorize and link identified invocations:

1. **Kind**         (\`kind\`): This is a general category that can be used to group calls together. For example, you may want to link all calls to \`plot\` to \`visualize\`.
2. **Subkind**      (\`subkind\`): This is used to uniquely identify the respective call type when grouping the output. For example, you may want to link all calls to \`ggplot\` to \`plot\`.
3. **Linked Calls** (\`linkTo\`): This links the current call to the last call of the given kind. This way, you can link a call like \`points\` to the latest graphics plot etc.
   For now, we _only_ offer support for linking to the last call, as the current flow dependency over-approximation is not stable.
4. **Aliases**      (\`includeAliases\`): Consider a case like \`f <- function_of_interest\`, do you want calls to \`f\` to be included in the results? There is probably no need to combine this with a global call target!

It's also possible to filter the results based on the following properties:

1. **File** (\`fileFilter\`): This allows you to filter the results based on the file in which the call is located. This can be useful if you are only interested in calls in, e.g., specific folders.
   The \`fileFilter\` property is an object made up of two properties:
     - **Filter** (\`filter\`): A regular expression that a node's file attribute must match to be considered.
     - **Include Undefined Files** (\`includeUndefinedFiles\`): If \`fileFilter\` is set, but a node's file attribute is not present, should we include it in the results? Defaults to \`true\`.
2. **Ignore Parameter Values** (\`ignoreParameterValues\`): Should we ignore default values for parameters in the results?

Re-using the example code from above, the following query attaches all calls to \`mean\` to the kind \`visualize\` and the subkind \`text\`,
all calls that start with \`read_\` to the kind \`input\` but only if they are not locally overwritten, and the subkind \`csv-file\`, and links all calls to \`points\` to the last call to \`plot\`:

${
	await showQuery(shell, exampleQueryCode, [
		{ type: 'call-context', callName: '^mean$', kind: 'visualize', subkind: 'text' },
		{
			type:        'call-context',
			callName:    '^read_',
			kind:        'input',
			subkind:     'csv-file',
			callTargets: CallTargets.OnlyGlobal
		},
		{
			type:     'call-context',
			callName: '^points$',
			kind:     'visualize',
			subkind:  'plot',
			linkTo:   { type: 'link-to-last-call', callName: '^plot$' }
		}
	], { showCode: false })
}

As you can see, all kinds and subkinds with the same name are grouped together.
Yet, re-stating common arguments and kinds may be cumbersome (although you can already use clever regex patterns).
See the ${linkToQueryOfName('compound')} for a way to structure your queries more compactly if you think it gets too verbose. 

${
	await (async() => {
		const code = `
foo <- my_test_function
foo()
if(u) bar <- foo
bar()
my_test_function()
`.trim();
		return details('Alias Example', `Consider the following code: ${codeBlock('r', code)}\nNow let's say we want to query _all_ uses of the \`my_test_function\`:` + await showQuery(shell, code, [
			{ type: 'call-context', callName: '^my_test_function', includeAliases: true }
		], { showCode: false }));
	})()
}
		`;
	}
});

registerQueryDocumentation('dataflow', {
	name:             'Dataflow Query',
	type:             'active',
	shortDescription: 'Returns the dataflow graph of the given code.',
	functionName:     executeDataflowQuery.name,
	functionFile:     '../queries/catalog/dataflow-query/dataflow-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x + 1';
		return `
Maybe you want to handle only the result of the query execution, or you just need the [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph) again.
This query type does exactly that!

Using the example code \`${exampleCode}\`, the following query returns the dataflow graph of the code:
${
	await showQuery(shell, exampleCode, [{
		type: 'dataflow'
	}], { showCode: true, collapseQuery: true })
}
		`;
	}
});

registerQueryDocumentation('project', {
	name:             'Project Query',
	type:             'active',
	shortDescription: 'Returns information about the analyzed project',
	functionName:     executeDataflowQuery.name,
	functionFile:     '../queries/catalog/project-query/project-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x + 1';
		return `
This query returns the information about the analyzed project.
Currently, this is only the list of file paths included.

${
	await showQuery(shell, exampleCode, [{
		type: 'project'
	}], { showCode: true, collapseQuery: true })
}
		`;
	}
});

registerQueryDocumentation('normalized-ast', {
	name:             'Normalized AST Query',
	type:             'active',
	shortDescription: 'Returns the normalized AST of the given code.',
	functionName:     executeNormalizedAstQuery.name,
	functionFile:     '../queries/catalog/normalized-ast-query/normalized-ast-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x + 1';
		return `
Maybe you want to handle only the result of the query execution, or you just need the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST) again.
This query type does exactly that!

Using the example code \`${exampleCode}\`, the following query returns the normalized AST of the code:
${
	await showQuery(shell, exampleCode, [{
		type: 'normalized-ast'
	}], { showCode: true, collapseQuery: true })
}
		`;
	}
});

registerQueryDocumentation('lineage', {
	name:             'Lineage Query',
	type:             'active',
	shortDescription: 'Returns lineage of a criteria.',
	functionName:     executeLineageQuery.name,
	functionFile:     '../queries/catalog/lineage-query/lineage-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x <- 1\nx';

		return `
This query calculates the _lineage_ of a given slicing criterion. The lineage traces back all parts that the
respective variables stems from given the reads, definitions, and returns in the dataflow graph.

To understand this, let's start with a simple example query, to get the lineage of the second use of \`x\` in the following code:
${codeBlock('r', exampleCode)}
 
For this, we use the criterion \`2@x\` (which is the first use of \`x\` in the second line).
 
${
	await showQuery(shell, exampleCode, [{
		type:      'lineage',
		criterion: '2@x'
	}], { showCode: false })
}

In this simple scenario, the _lineage_ is equivalent to the slice (and in-fact the complete code). 
In general the lineage is smaller and makes no guarantees on executability. 
It is just a quick and neither complete nor sound way to get information on where the variable originates from.

This query replaces the old [\`request-lineage\`](${FlowrWikiBaseRef}/Interface#message-request-lineage) message.

		`;
	}
});

registerQueryDocumentation('dataflow-cluster', {
	name:             'Dataflow Cluster Query',
	type:             'active',
	shortDescription: 'Calculates and returns all the clusters present in the dataflow graph.',
	functionName:     executeDataflowClusterQuery.name,
	functionFile:     '../queries/catalog/cluster-query/cluster-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleA = 'x <- 1; x';
		const exampleB = 'x <- 1; y';
		return `
This query automatically calculates clusters in flowR's dataflow graph 
and returns a list of all clusters found. 
Clusters are to be interpreted as literal clusters on the graph traversing
edges in both directions. From this perspective, 
the code \`${exampleA}\` has one cluster (given that all code is related), 
while the code \`${exampleB}\` has two clusters (given that the \`y\` has no relation to the previous definition).

${details('Example <code>' + exampleA + '</code>',  
	await showQuery(shell, exampleA, [{ type: 'dataflow-cluster' }], { showCode: false }))}
${details('Example <code>' + exampleB + '</code>',
	await showQuery(shell, exampleB, [{ type: 'dataflow-cluster' }], { showCode: false }))}

Using the example code from above, the following query returns all clusters:
${
	await showQuery(shell, exampleQueryCode, [{
		type: 'dataflow-cluster'
	}], { showCode: false, collapseQuery: true })
}
		`;
	}
});

registerQueryDocumentation('resolve-value', {
	name:             'Resolve Value Query',
	type:             'active',
	shortDescription: 'Provides access to flowR\'s value tracking (which is configurable)',
	functionName:     executeSearch.name,
	functionFile:     '../queries/catalog/resolve-value-query/resolve-value-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x <- 1\nprint(x)';
		return `
With this query you can use flowR's value-tracking capabilities to resolve identifiers to all potential values they may have at runtime (if possible).
The extent to which flowR traces values (e.g., built-ins vs. constants) can be configured in flowR's Configuration file (see the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information).

Using the example code \`${exampleCode}\` (with the \`print(x)\` in the second line), the following query returns all values of \`x\` in the code:
${
	await showQuery(shell, exampleCode, [{
		type:     'resolve-value',
		criteria: ['2@x']
	}], { showCode: true })
}
		`;
	}
});

registerQueryDocumentation('inspect-higher-order', {
	name:             'Inspect Higher-Order Functions Query',
	type:             'active',
	shortDescription: 'Determine whether functions are higher-order functions',
	functionName:     executeHigherOrderQuery.name,
	functionFile:     '../queries/catalog/inspect-higher-order-query/inspect-higher-order-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'f <- function() function(x) x; f()';
		return `
With this query you can identify which functions in the code are higher-order functions, i.e., either take a function as an argument or return a function.
Please note, that functions that are just identities (e.g., \`function(x) x\`) are not considered higher-order if they do not take a function as an argument.

Using the example code \`${exampleCode}\` the following query returns the information for all identified function definitions whether they are higher-order functions:
${
	await showQuery(shell, exampleCode, [{
		type: 'inspect-higher-order',
	}], { showCode: true })
}
		`;
	}
});

registerQueryDocumentation('origin', {
	name:             'Origin Query',
	type:             'active',
	shortDescription: 'Retrieve the origin of a variable, function call, ...',
	functionName:     executeSearch.name,
	functionFile:     '../queries/catalog/origin-query/origin-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x <- 1\nprint(x)';
		return `
With this query you can use flowR's origin tracking to find out the read origins of a variable,
the functions called by a call, and more.

Using the example code \`${exampleCode}\` (with the \`print(x)\` in the second line), the following query returns the origins of \`x\` in the code:
${
	await showQuery(shell, exampleCode, [{
		type:      'origin',
		criterion: '2@x'
	}], { showCode: true })
}
		`;
	}
});

registerQueryDocumentation('search', {
	name:             'Search Query',
	type:             'active',
	shortDescription: 'Provides access to flowR\'s search API',
	functionName:     executeSearch.name,
	functionFile:     '../queries/catalog/search-query/search-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x + 1';
		return `
With this query you can use the [Search API](${FlowrWikiBaseRef}/Search%20API) to conduct searches on the flowR analysis result. 

Using the example code \`${exampleCode}\`, the following query returns all uses of 'x' in the code:
${
	await showQuery(shell, exampleCode, [{
		type:   'search',
		search: Q.var('x').filter(VertexType.Use).build()
	}], { showCode: true, collapseQuery: false })
}
		`;
	}
});

registerQueryDocumentation('happens-before', {
	name:             'Happens-Before Query',
	type:             'active',
	shortDescription: 'Check whether one normalized AST node happens before another in the CFG.',
	functionName:     executeSearch.name,
	functionFile:     '../queries/catalog/happens-before-query/happens-before-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x <- 1\ny <- 2';
		return `
With this query you can analyze the control flow graph:

Using the example code:

${codeBlock('r', exampleCode)}

the following query returns that the first assignment happens always before the other:
${
	await showQuery(shell, exampleCode, [{
		type: 'happens-before',
		a:    '1@x',
		b:    '2@y'
	}], { showCode: true, collapseQuery: false })
}
		`;
	}
});

registerQueryDocumentation('id-map', {
	name:             'Id-Map Query',
	type:             'active',
	shortDescription: 'Returns the id-map of the normalized AST of the given code.',
	functionName:     executeIdMapQuery.name,
	functionFile:     '../queries/catalog/id-map-query/id-map-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x + 1';
		return `
This query provides access to all nodes in the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST) as a mapping from their id to the node itself. 

Using the example code \`${exampleCode}\`, the following query returns all nodes from the code:
${
	await showQuery(shell, exampleCode, [{
		type: 'id-map'
	}], { showCode: true, collapseQuery: true })
}
		`;
	}
});

registerQueryDocumentation('config', {
	name:             'Config Query',
	type:             'active',
	shortDescription: 'Returns the current configuration of flowR.',
	functionName:     executeConfigQuery.name,
	functionFile:     '../queries/catalog/config-query/config-query-format.ts',
	 
	buildExplanation: async(shell: RShell) => {
		return `
This query provides access to the current configuration of the flowR instance. See the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information on what the configuration represents.
Additionally, you can use this query to update the configuration of flowR on-the-fly (please do not rely on this mechanism it is mostly of interest for demonstrations).
${
	await showQuery(shell, '', [{
		type:   'config',
		update: {
			ignoreSourceCalls: true
		}
	}], { showCode: false, collapseQuery: true, collapseResult: true })
}

Please note that, in the repl, a special syntax starting with \`+\` (which should be autocompleted) can be used to update the configuration on the fly:

${
	await documentReplSession(shell, [
		{
			command:     ':query @config +solver.slicer.threshold=10000',
			description: 'Set the slicing threshold to 10,000.'
		}
	])
}
`;
	}
});

registerQueryDocumentation('df-shape', {
	name:             'Dataframe Shape Inference Query',
	type:             'active',
	shortDescription: 'Returns the shapes inferred for all dataframes in the code.',
	functionName:     executeDfShapeQuery.name,
	functionFile:     '../queries/catalog/df-shape-query/df-shape-query-format.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x <- data.frame(a=1:3)\nfilter(x, FALSE)';
		return `
This query infers all shapes of dataframes within the code. For example, you can use:
${
	await showQuery(shell, exampleCode, [{
		type: 'df-shape'
	}], { showCode: true, collapseQuery: true })
}
`;
	}
});

registerQueryDocumentation('compound', {
	name:             'Compound Query',
	type:             'virtual',
	shortDescription: 'Combines multiple queries of the same type into one, specifying common arguments.',
	functionName:     executeCompoundQueries.name,
	functionFile:     '../queries/virtual-query/compound-query.ts',
	buildExplanation: async(shell: RShell) => {
		return `
A compound query comes in use, whenever we want to state multiple queries of the same type with a set of common arguments.
It offers the following properties of interest:

1. **Query** (\`query\`): the type of the query that is to be combined.
2. **Common Arguments** (\`commonArguments\`): The arguments that are to be used as defaults for all queries (i.e., any argument the query may have).
3. **Arguments** (\`arguments\`): The other arguments for the individual queries that are to be combined.

For example, consider the following compound query that combines two call-context queries for \`mean\` and \`print\`, both of which are to be
assigned to the kind \`visualize\` and the subkind \`text\` (using the example code from above):

${
	await showQuery(shell, exampleQueryCode, [{
		type:            'compound',
		query:           'call-context',
		commonArguments: { kind: 'visualize', subkind: 'text' },
		arguments:       [
			{ callName: '^mean$' },
			{ callName: '^print$' }
		]
	}], { showCode: false })
}

Of course, in this specific scenario, the following query would be equivalent:

${
	await showQuery(shell, exampleQueryCode, [
		{ type: 'call-context', callName: '^(mean|print)$', kind: 'visualize', subkind: 'text' }
	], { showCode: false, collapseResult: true })
}

However, compound queries become more useful whenever common arguments can not be expressed as a union in one of their properties.
Additionally, you can still overwrite default arguments.
In the following, we (by default) want all calls to not resolve to a local definition, except for those to \`print\` for which we explicitly
want to resolve to a local definition:

${
	await showQuery(shell, exampleQueryCode, [{
		type:            'compound',
		query:           'call-context',
		commonArguments: { kind: 'visualize', subkind: 'text', callTargets: CallTargets.OnlyGlobal },
		arguments:       [
			{ callName: '^mean$' },
			{ callName: '^print$', callTargets: CallTargets.OnlyLocal }
		]
	}], { showCode: false })
}

Now, the results no longer contain calls to \`plot\` that are not defined locally.

		`;
	}
});

registerQueryDocumentation('static-slice', {
	name:             'Static Slice Query',
	type:             'active',
	shortDescription: 'Slice the dataflow graph reducing the code to just the parts relevant for the given criteria (backward and forward).',
	functionName:     executeStaticSliceQuery.name,
	functionFile:     '../queries/catalog/static-slice-query/static-slice-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'x <- 1\ny <- 2\nx';
		return `
To slice, _flowR_ needs one thing from you: a variable or a list of variables (function calls are supported to, referring to the anonymous
return of the call) that you want to slice the dataflow graph for (additionally, you have to tell flowR if you want to have a forward slice). 
Given this, the backward slice is essentially the subpart of the program that may influence the value of the variables you are interested in.
To specify a variable of interest, you have to present flowR with a [slicing criterion](${FlowrWikiBaseRef}/Terminology#slicing-criterion) (or, respectively, an array of them).

To exemplify the capabilities, consider the following code:
${codeBlock('r', exampleCode)}
If you are interested in the parts required for the use of \`x\` in the last line, you can use the following query:

${
	await showQuery(shell, exampleCode, [{
		type:     'static-slice',
		criteria: ['3@x']
	}], { showCode: false })
}

In general, you may be uninterested in seeing the reconstructed version and want to save some computation time, for this,
you can use the \`noReconstruction\` flag.

${
	details('No Reconstruction Example',
		await showQuery(shell, exampleCode, [{
			type:             'static-slice',
			criteria:         ['3@x'],
			noReconstruction: true
		}], { showCode: false })
	)
}

Likewise, if you want the forward slice for the first use of \`x\`, you can do it like this:

${
	await showQuery(shell, exampleCode, [{
		type:      'static-slice',
		criteria:  ['1@x'],
		direction: SliceDirection.Forward
	}], { showCode: false })
}

You can disable [magic comments](${FlowrWikiBaseRef}/Interface#slice-magic-comments) using the \`noMagicComments\` flag.
This query replaces the old [\`request-slice\`](${FlowrWikiBaseRef}/Interface#message-request-slice) message.
		`;
	}
});

registerQueryDocumentation('dependencies', {
	name:             'Dependencies Query',
	type:             'active',
	shortDescription: 'Returns all direct dependencies (in- and outputs) of a given R script',
	functionName:     executeDependenciesQuery.name,
	functionFile:     '../queries/catalog/dependencies-query/dependencies-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'library(x)';
		const longerCode = `
source("sample.R")
foo <- loadNamespace("bar")

data <- read.csv("data.csv")

#' @importFrom ggplot2 ggplot geom_point aes
ggplot(data, aes(x=x, y=y)) + geom_point()

better::write.csv(data, "data2.csv")
print("hello world!")
		`;
		return `
This query extracts all dependencies from an R script, using a combination of a ${linkToQueryOfName('call-context')}
and more advanced tracking in the [Dataflow Graph](${FlowrWikiBaseRef}/Dataflow%20Graph).

In other words, if you have a script simply reading: \`${exampleCode}\`, the following query returns the loaded library:
${
	await showQuery(shell, exampleCode, [{
		type: 'dependencies'
	}], { showCode: false, collapseQuery: true })
}

Of course, this works for more complicated scripts too. The query offers information on the loaded _libraries_, _sourced_ files, data which is _read_ and data which is _written_.
For example, consider the following script:
${codeBlock('r', longerCode)}
The following query returns the dependencies of the script.
${
	await showQuery(shell, longerCode, [{
		type: 'dependencies'
	}], { showCode: false, collapseQuery: true, collapseResult: true })
}

Currently, the dependency extraction may fail as it is essentially a set of heuristics guessing the dependencies.
We welcome any feedback on this (consider opening a [new issue](${NewIssueUrl})).

In the meantime we offer several properties to overwrite the default behavior (e.g., function names that should be collected)

${
	await showQuery(shell, longerCode, [{
		type:                   'dependencies',
		ignoreDefaultFunctions: true,
		enabledCategories:      ['library'],
		libraryFunctions:       [{ package: 'base', name: 'print', argIdx: 0, argName: 'library', resolveValue: true }],
	}], { showCode: false, collapseQuery: false, collapseResult: true })
}

Here, \`resolveValue\` tells the dependency query to resolve the value of this argument in case it is not a constant.
		`;
	}
});

registerQueryDocumentation('linter', {
	name:             'Linter Query',
	type:             'active',
	shortDescription: 'Lints a given R script for common issues.',
	functionName:     executeDependenciesQuery.name,
	functionFile:     '../queries/catalog/linter-query/linter-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'read.csv("i_do_not_exist.csv")';
		return `
This query lints a given R script for common issues, such as missing files, unused variables, and more.

In other words, if you have a script simply reading: \`${exampleCode}\`, the following query returns all smells detected:
${
	await showQuery(shell, exampleCode, [{
		type: 'linter'
	}], { showCode: false, collapseQuery: true })
}

You can also configure which rules to apply and what settings to use for these rules. 
We welcome any feedback and suggestions for new rules on this (consider opening a [new issue](${NewIssueUrl})).
		`;
	}
});

registerQueryDocumentation('control-flow', {
	name:             'Control-Flow Query',
	type:             'active',
	shortDescription: 'Provides the control-flow of the program.',
	functionName:     executeControlFlowQuery.name,
	functionFile:     '../queries/catalog/control-flow-query/control-flow-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		const exampleCode = 'if(TRUE) 1 else 2';
		return `
This control-flow query provides you access to the control flow graph.

In other words, if you have a script simply reading: \`${exampleCode}\`, the following query returns the CFG:
${
	await showQuery(shell, exampleCode, [{
		type: 'control-flow'
	}], { showCode: false, collapseQuery: true, collapseResult: true })
}

You can also overwrite the simplification passes to tune the perspective. for example, if you want to have basic blocks:
${
	await showQuery(shell, exampleCode, [{
		type:   'control-flow',
		config: {
			simplificationPasses: ['unique-cf-sets', 'to-basic-blocks']
		}
	}], { showCode: false, collapseResult: true })
}

this produces: 

${await printCfgCode(shell, exampleCode, { showCode: false, prefix: 'flowchart RL\n', simplifications: ['to-basic-blocks'] })}


If, on the other hand, you want to prune dead code edges:
${
	await showQuery(shell, exampleCode, [{
		type:   'control-flow',
		config: {
			simplificationPasses: ['unique-cf-sets', 'analyze-dead-code']
		}
	}], { showCode: false, collapseResult: true })
}

this produces:

${await printCfgCode(shell, exampleCode, { showCode: false, prefix: 'flowchart RL\n', simplifications: ['analyze-dead-code'] })}


Or, completely remove dead code:
${
	await showQuery(shell, exampleCode, [{
		type:   'control-flow',
		config: {
			simplificationPasses: ['unique-cf-sets', 'analyze-dead-code', 'remove-dead-code']
		}
	}], { showCode: false, collapseResult: true })
}

this produces:

${await printCfgCode(shell, exampleCode, { showCode: false, prefix: 'flowchart RL\n', simplifications: ['analyze-dead-code', 'remove-dead-code'] })}

		`;
	}
});

registerQueryDocumentation('location-map', {
	name:             'Location Map Query',
	type:             'active',
	shortDescription: 'Returns a simple mapping of ids to their location in the source file',
	functionName:     executeLocationMapQuery.name,
	functionFile:     '../queries/catalog/location-map-query/location-map-query-executor.ts',
	buildExplanation: async(shell: RShell) => {

		const types = getTypesFromFolder({
			files: [path.resolve('./src/util/range.ts')],
		});
		const exampleCode = 'x + 1\nx * 2';
		return `
A query like the ${linkToQueryOfName('id-map')} query can return a huge result, especially for larger scripts.
If you are not interested in all of the information contained within the full map, you can use the location map query to get a simple mapping of ids to their location in the source file.   

Consider you have the following code:

${codeBlock('r', exampleCode)}

The following query then gives you the aforementioned mapping:

${
	await showQuery(shell, exampleCode, [{
		type: 'location-map'
	}], { showCode: false, collapseQuery: true })
}

All locations are given as a ${shortLink('SourceRange', types.info)} paired with the file id in the format \`[file-id, [start-line, start-column, end-line, end-column]]\`.	

		`;
	}
});



async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	return `${autoGenHeader({ filename: module.filename, purpose: 'query API', rVersion: rversion })}

This page briefly summarizes flowR's query API, represented by the ${executeQueries.name} function in ${getFilePathMd('../queries/query.ts')}.
Please see the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information on how to access this API.

${
	block({
		type:    'NOTE',
		content: `
There are many ways to query a dataflow graph created by flowR.
For example, you can use the [\`request-query\`](${FlowrWikiBaseRef}/Interface#message-request-query) message
with a running flowR server, or the ${getReplCommand('query')} command in the flowR [REPL](${FlowrWikiBaseRef}/Interface#repl).

Also, check out the [${FlowrGithubGroupName}/sample-analyzer-project-query](${FlowrGithubBaseRef}/sample-analyzer-project-query) repository for a complete example project using the query API.
			`.trim()
	})
}

## The Query Format

Queries are JSON arrays of query objects, each of which uses a \`type\` property to specify the query type.
In general, we separate two types of queries:

1. **Active Queries**: Are exactly what you would expect from a query (e.g., the ${linkToQueryOfName('call-context')}). They fetch information from the dataflow graph.
2. **Virtual Queries**: Are used to structure your queries (e.g., the ${linkToQueryOfName('compound')}).

We separate these from a concept perspective. 
For now, we support the following **active** queries (which we will refer to simply as a \`query\`):

${tocForQueryType('active')}

Similarly, we support the following **virtual** queries: 

${tocForQueryType('virtual')}

<details>


<summary>Detailed Query Format (Automatically Generated)</summary>

Although it is probably better to consult the detailed explanations below, if you want to have a look at the schema, here is its description:

${describeSchema(QueriesSchema(), markdownFormatter)}

</details>

### Why Queries?

First, consider that you have a file like the following (of course, this is just a simple and artificial example):

\`\`\`r
${exampleQueryCode}
\`\`\`

<details> <summary>Dataflow Graph of the Example</summary>

${await printDfGraphForCode(shell, exampleQueryCode, { showCode: false })}

</details>

&nbsp;

Additionally, consider that you are interested in all function calls which loads data with \`read_csv\`.
A simple \`regex\`-based query could look like this: \`^read_csv$\`.
However, this fails to incorporate
 
1. Syntax-based information (comments, strings, used as a variable, called as a higher-order function, ...)
2. Semantic information (e.g., \`read_csv\` is overwritten by a function with the same name)
3. Context information (e.g., calls like \`points\` may link to the current plot)

To solve this, flowR provides a query API which allows you to specify queries on the dataflow graph.
For the specific use-case stated, you could use the ${linkToQueryOfName('call-context')} to find all calls to \`read_csv\` which refer functions that are not overwritten.

Just as an example, the following ${linkToQueryOfName('call-context')} finds all calls to \`read_csv\` that are not overwritten:

${await showQuery(shell, exampleQueryCode, [{ type: 'call-context', callName: '^read_csv$', callTargets: CallTargets.OnlyGlobal, kind: 'input', subkind: 'csv-file' }], { showCode: false })}

${await explainQueries(shell, 'active')}

${await explainQueries(shell, 'virtual')}

`;
}

/** if we run this script, we want a Markdown representation of the capabilities */
if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);

	const shell = new RShell();
	void getText(shell).then(str => {
		console.log(str);
	}).finally(() => {
		shell.close();
	});
}
