import { FlowrWikiBaseRef } from './doc-util/doc-files';
import { showSearch } from './doc-util/doc-search';
import { FlowrSearchBuilder, Q } from '../search/flowr-search-builder';
import { VertexType } from '../dataflow/graph/vertex';
import type { FlowrSearchGeneratorNode } from '../search/search-executor/search-generators';
import { runSearch } from '../search/flowr-search-executor';
import type { WikiMakerArgs } from './wiki-mk/wiki-maker';
import { WikiMaker } from './wiki-mk/wiki-maker';
import { FlowrSearchElements } from '../search/flowr-search';

/**
 * https://github.com/flowr-analysis/flowr/wiki/Search-API
 */
export class WikiSearch extends WikiMaker {
	constructor() {
		super('wiki/Search API.md', module.filename, 'search API');
	}

	public async text({ ctx, shell }: WikiMakerArgs): Promise<string> {
		return `
This page briefly summarizes flowR's search API which provides a set of functions to search for nodes in the [Dataflow Graph](${FlowrWikiBaseRef}/Dataflow-Graph) and the 
[Normalized AST](${FlowrWikiBaseRef}/Normalized-AST) of a given R code (the search will always consider both, with respect to your search query).
Please see the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information on how to access this API.
Within code, you can execute a search using the ${ctx.link(runSearch.name)} function.

For an initial motivation, let's have a look at the following example:

${await showSearch(shell, 'x <- x * x', Q.var('x'))}

This returns all references to the variable \`x\` in the code.
However, the search API is not limited to simple variable references and can do much more.

For example, let's have every definition of \`x\` in the code but the first one:

${await showSearch(shell, 'x <- x * x\nprint(x)\nx <- y <- 3\nprint(x)\nx <- 2', Q.var('x').filter(VertexType.VariableDefinition).skip(1))}

In summary, every search has two parts. It is initialized with a _generator_ (such as \`Q.var('x')\`)
and can be further refined with _transformers_ or _modifiers_.
Such queries can be constructed starting from the ${ctx.link('Q')} object (backed by ${ctx.link('FlowrSearchGenerator')}) and
are fully serializable so you can use them when communicating with the [Query API](${FlowrWikiBaseRef}/Query%20API).

We offer the following generators:

${
	Object.keys(Q).sort().map(
		key => `- ${ctx.link(`FlowrSearchGenerator::${key}`)}\\\n${ctx.doc(`FlowrSearchGenerator::${key}`)}`
	).join('\n')
}

Likewise, we have a palette of _transformers_ and _modifiers_:

${
	/* let's iterate over all methods of FlowrSearchBuilder */
	Object.getOwnPropertyNames(Object.getPrototypeOf(new FlowrSearchBuilder(undefined as unknown as FlowrSearchGeneratorNode)))
		.filter(n => n !== 'constructor').sort().map(
			key => `- ${ctx.link(`FlowrSearchBuilder::${key}`)}\\\n${ctx.doc(`FlowrSearchBuilder::${key}`)}`
		).join('\n')
}

Every search (and consequently the search pipeline) works with an array of ${ctx.link('FlowrSearchElement')} (neatly wrapped in ${ctx.link(FlowrSearchElements.name)}).
Hence, even operations such as \`.first\` or \`.last\` return an array of elements (albeit with a single or no element).
The search API does its best to stay typesafe wrt. to the return type and the transformers in use. 
In addition, it offers optimizer passes to optimize the search pipeline before execution.
They are executed with \`.build\` which may happen automatically, whenever you want to run a search using ${ctx.link(runSearch.name)}.
`;
	}
}
