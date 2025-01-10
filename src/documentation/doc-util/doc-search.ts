import type { RShell } from '../../r-bridge/shell';
import type { SupportedQueryTypes } from '../../queries/query';
import { PipelineExecutor } from '../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
import { getFilePathMd } from './doc-files';
import type { SupportedVirtualQueryTypes } from '../../queries/virtual-query/virtual-queries';
import { printDfGraphForCode } from './doc-dfg';
import { codeBlock } from './doc-code';
import { printAsMs } from '../../util/time';
import type { FlowrSearchLike } from '../../search/flowr-search-builder';
import { runSearch } from '../../search/flowr-search-executor';
import { flowrSearchToCode, flowrSearchToMermaid } from '../../search/flowr-search-printer';
import { recoverContent } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { formatRange } from '../../util/mermaid/dfg';

export interface ShowSearchOptions {
	readonly showCode?:       boolean;
	readonly collapseResult?: boolean;
}

export async function showSearch(shell: RShell, code: string, search: FlowrSearchLike, { collapseResult = true }: ShowSearchOptions = {}): Promise<string> {
	const now = performance.now();
	const analysis = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(code)
	}).allRemainingSteps();
	const result = runSearch(search, analysis);
	const duration = performance.now() - now;

	const metaInfo = `
The search required _${printAsMs(duration)}_ (including parsing and normalization and the query) within the generation environment.
	`.trim();

	return `

${codeBlock('ts', flowrSearchToCode(search))}

<details style="color:gray"> <summary>Search Visualization</summary>

${codeBlock('mermaid', flowrSearchToMermaid(search))}

In the code:

${codeBlock('r', code)}

<details style="color:gray"> <summary>JSON Representation</summary>

${codeBlock('json', JSON.stringify(search, null, 2))}

</details>

</details>


${collapseResult ? ' <details> <summary style="color:gray">Show Results</summary>' : ''}

The query returns the following vetices (all references to \`x\` in the code):
${
	result.map(({ node }) => `<b>${node.info.id} ('${recoverContent(node.info.id, analysis.dataflow.graph)}')</b> at L${formatRange(node.location)}`).join(', ')
}

${metaInfo}	

The returned results are highlighted thick and blue within the dataflow graph:

${await printDfGraphForCode(shell, code, { showCode: false, switchCodeAndGraph: false, mark: new Set(result.map(({ node }) => node.info.id )) } )}


${collapseResult ? '</details>' : ''}

	`;

}

export interface QueryDocumentation {
	readonly name:             string;
	readonly type:             'virtual' | 'active';
	readonly shortDescription: string;
	readonly functionName:     string;
	readonly functionFile:     string;
	readonly buildExplanation: (shell: RShell) => Promise<string>;
}

export const RegisteredQueries = {
	'active':  new Map<string, QueryDocumentation>(),
	'virtual': new Map<string, QueryDocumentation>()
};

export function registerQueryDocumentation(query: SupportedQueryTypes | SupportedVirtualQueryTypes, doc: QueryDocumentation) {
	const map = RegisteredQueries[doc.type];
	if(map.has(query)) {
		throw new Error(`Query ${query} already registered`);
	}
	map.set(query, doc);
}

function linkify(name: string) {
	return name.toLowerCase().replace(/ /g, '-');
}

export function linkToQueryOfName(id: SupportedQueryTypes | SupportedVirtualQueryTypes) {
	const query = RegisteredQueries.active.get(id) ?? RegisteredQueries.virtual.get(id);
	if(!query) {
		throw new Error(`Query ${id} not found`);
	}
	return `[${query.name}](#${linkify(query.name)})`;
}

export function tocForQueryType(type: 'active' | 'virtual') {
	const queries = [...RegisteredQueries[type].entries()].sort(([,{ name: a }], [, { name: b }]) => a.localeCompare(b));
	const result: string[] = [];
	for(const [id, { name, shortDescription }] of queries) {
		result.push(`1. [${name}](#${linkify(name)}) (\`${id}\`):\\\n    ${shortDescription}`);
	}
	return result.join('\n');
}

async function explainQuery(shell: RShell, { name, functionName, functionFile, buildExplanation }: QueryDocumentation) {
	return `
### ${name}

${await buildExplanation(shell)}

<details> 

<summary style="color:gray">Implementation Details</summary>

Responsible for the execution of the ${name} query is \`${functionName}\` in ${getFilePathMd(functionFile)}.

</details>	

`;
}

export async function explainQueries(shell: RShell, type: 'active' | 'virtual'): Promise<string> {
	const queries = [...RegisteredQueries[type].entries()].sort(([,{ name: a }], [, { name: b }]) => a.localeCompare(b));
	const result: string[] = [];
	for(const [,doc] of queries) {
		result.push(await explainQuery(shell, doc));
	}
	return result.join(`\n${'-'.repeat(5)}\n\n`);
}
