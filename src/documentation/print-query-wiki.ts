import { RShell } from '../r-bridge/shell';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { executeQueries } from '../queries/query';
import { FlowrWikiBaseRef, getFilePathMd } from './doc-util/doc-files';
import { explainQueries, registerQueryDocumentation, showQuery, tocForQueryType } from './doc-util/doc-query';
import { CallTargets } from '../queries/catalog/call-context-query/call-context-query-format';
import { describeSchema } from '../util/schema';
import { QueriesSchema } from '../queries/query-schema';
import { markdownFormatter } from '../util/ansi';
import { executeCallContextQueries } from '../queries/catalog/call-context-query/call-context-query-executor';
import { executeCompoundQueries } from '../queries/virtual-query/compound-query';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { exampleQueryCode } from './data/query/example-query-code';
import { details } from './doc-util/doc-structure';
import { codeBlock } from './doc-util/doc-code';
import { executeDataflowQuery } from '../queries/catalog/dataflow-query/dataflow-query-executor';
import { executeIdMapQuery } from '../queries/catalog/id-map-query/id-map-query-executor';


registerQueryDocumentation('call-context', {
	name:             'Call-Context Query',
	type:             'active',
	shortDescription: 'Finds all calls in a set of files that matches specified criteria.',
	functionName:     executeCallContextQueries.name,
	functionFile:     '../queries/catalog/call-context-query/call-context-query-executor.ts',
	buildExplanation: async(shell: RShell) => {
		return `
Call context queries may be used to identify calls to specific functions that match criteria of your interest.
For now, we support two criteria:

1. **Function Name** (\`callName\`): The function name is specified by a regular expression. This allows you to find all calls to functions that match a specific pattern.
2. **Call Targets**  (\`callTargets\`): This specifies to what the function call targets. For example, you may want to find all calls to a function that is not defined locally.

Besides this we provide the following ways to automatically categorize and link identified invocations:

1. **Kind**         (\`kind\`): This is a general category that can be used to group calls together. For example, you may want to link all calls to \`plot\` to \`visualize\`.
2. **Subkind**      (\`subkind\`): This is used to uniquely identify the respective call type when grouping the output. For example, you may want to link all calls to \`ggplot\` to \`plot\`.
3. **Linked Calls** (\`linkTo\`): This links the current call to the last call of the given kind. This way, you can link a call like \`points\` to the latest graphics plot etc.
   For now, we _only_offer support for linking to the last call_ as the current flow dependency over-approximation is not stable.
4. **Aliases**      (\`includeAliases\`): Consider a case like \`f <- function_of_interest\`, do you want calls to \`f\` to be included in the results? There is probably no need to combine this with a global call target!

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
See the [Compound Query](#compound-query) for a way to structure your queries more compactly if you think it gets too verbose. 

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
		return `
Maybe you want to handle only the result of the query execution, or you just need the [dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph) again.
This query type does exactly that!

Using the example code from above, the following query returns the dataflow graph of the code:
${
	await showQuery(shell, exampleQueryCode, [{
		type: 'dataflow'
	}], { showCode: true })
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
		return `
This query provides access to all nodes in the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST) as a mapping from their id to the node itself. 

Using the example code from above, the following query returns all nodes from the code:
${
	await showQuery(shell, exampleQueryCode, [{
		type: 'id-map'
	}], { showCode: true })
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


async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	return `${autoGenHeader({ filename: module.filename, purpose: 'query API', rVersion: rversion })}

This page briefly summarizes flowR's query API, represented by the ${executeQueries.name} function in ${getFilePathMd('../queries/query.ts')}.
Please see the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information on how to access this API.

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
For the specific use-case stated, you could use the [Call-Context Query](#call-context-query) to find all calls to \`read_csv\` which refer functions that are not overwritten.

Just as an example, the following [Call-Context Query](#call-context-query) finds all calls to \`read_csv\` that are not overwritten:

${await showQuery(shell, exampleQueryCode, [{ type: 'call-context', callName: '^read_csv$', callTargets: CallTargets.OnlyGlobal, kind: 'input', subkind: 'csv-file' }], { showCode: false })}

## The Query Format

Queries are JSON arrays of query objects, each of which uses a \`type\` property to specify the query type.
In general, we separate two types of queries:

1. **Active Queries**: Are exactly what you would expect from a query (e.g., the [Call-Context Query](#call-context-query)). They fetch information from the dataflow graph.
2. **Virtual Queries**: Are used to structure your queries (e.g., the [Compound Query](#compound-query)). 

We separate these from a concept perspective. 
For now, we support the following **active** queries (which we will refer to simply as a \`query\`):

${tocForQueryType('active')}

Similarly, we support the following **virtual** queries: 

${tocForQueryType('virtual')}

<details>


<summary>Detailed Query Format (Automatically Generated)</summary>

Although it is probably better to consult the detailed explanations below, if you want to have a look at the scehma, here is its description:

${describeSchema(QueriesSchema, markdownFormatter)}

</details>

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
