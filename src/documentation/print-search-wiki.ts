import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { FlowrWikiBaseRef } from './doc-util/doc-files';


import { autoGenHeader } from './doc-util/doc-auto-gen';
import { showSearch } from './doc-util/doc-search';
import { FlowrSearchBuilder, Q } from '../search/flowr-search-builder';
import { VertexType } from '../dataflow/graph/vertex';
import { getDocumentationForType, getTypesFromFolderAsMermaid, mermaidHide, shortLink } from './doc-util/doc-types';
import path from 'path';
import type { FlowrSearchGeneratorNode } from '../search/search-executor/search-generators';

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';

	const types = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('./src/search/'),
		typeName:    'FlowrSearchGenerator',
		inlineTypes: mermaidHide
	});

	return `${autoGenHeader({ filename: module.filename, purpose: 'search API', rVersion: rversion })}

This page briefly summarizes flowR's search API which provides a set of functions to search for nodes in the [Dataflow Graph](${FlowrWikiBaseRef}/Dataflow%20Graph) and the 
[Normalized AST](${FlowrWikiBaseRef}/Normalized%20AST) of a given R code.
Please see the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information on how to access this API.

For an initial motivation, let's have a look at the following example:

${await showSearch(shell, 'x <- x * x', Q.var('x'))}

This returns all references to the variable \`x\` in the code.
However, the search API is not limited to simple variable references and can do much more.

For example, let's have every definition of \`x\` in the code but the first one:

${await showSearch(shell, 'x <- x * x\nprint(x)\nx <- y <- 3\nprint(x)\nx <- 2', Q.var('x').filter(VertexType.VariableDefinition).skip(1))}

In summary, every search has two parts. It is initialized with a _generator_ (such as \`Q.var('x')\`)
and can be further redefined with _transformers_ or _modifiers_.
Such queries can be constructed starting from the ${shortLink('Q', types.info)} object (backed by ${shortLink('FlowrSearchGenerator', types.info)}) and
are fully serializable so you can use them when communicating with the [Query API](${FlowrWikiBaseRef}/Query%20API).

We offer the following generators:

${
	Object.keys(Q).sort().map(
		key => `- ${shortLink(`FlowrSearchGenerator::${key}`, types.info)}\\\n${getDocumentationForType(`FlowrSearchGenerator::${key}`, types.info)}`
	).join('\n')	
}

Likewise, we have a palette of _transformers_ and _modifiers_:

${
	/* let's iterate over all methods of FlowrSearchBuilder */
	Object.getOwnPropertyNames(Object.getPrototypeOf(new FlowrSearchBuilder(undefined as unknown as FlowrSearchGeneratorNode)))
		.filter(n => n !== 'constructor').sort().map(
			key => `- ${shortLink(`FlowrSearchBuilder::${key}`, types.info)}\\\n${getDocumentationForType(`FlowrSearchBuilder::${key}`, types.info)}`
		).join('\n')
}

TODO: internally, uses flowr search element, strives for type safety, has optimizer passes, explain .build

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
