import type { RShell } from '../../r-bridge/shell';
import type { Queries, QueryResults, SupportedQueryTypes } from '../../queries/query';
import { executeQueries } from '../../queries/query';
import { PipelineExecutor } from '../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
import { jsonReplacer } from '../../util/json';
import { markdownFormatter } from '../../util/ansi';
import { asciiSummaryOfQueryResult } from '../../cli/repl/commands/repl-query';
import { FlowrWikiBaseRef, getFilePathMd } from './doc-files';
import type { SupportedVirtualQueryTypes } from '../../queries/virtual-query/virtual-queries';
import type { VirtualCompoundConstraint } from '../../queries/virtual-query/compound-query';
import { printDfGraphForCode } from './doc-dfg';
import { jsonWithLimit } from './doc-code';
import { printAsMs } from '../../util/time';

export interface ShowQueryOptions {
	readonly showCode?:       boolean;
	readonly collapseResult?: boolean;
}

export async function showQuery<
	Base extends SupportedQueryTypes,
	VirtualArguments extends VirtualCompoundConstraint<Base> = VirtualCompoundConstraint<Base>
>(shell: RShell, code: string, queries: Queries<Base, VirtualArguments>, { showCode, collapseResult }: ShowQueryOptions = {}): Promise<string> {
	const now = performance.now();
	const analysis = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(code)
	}).allRemainingSteps();
	const results = executeQueries({ graph: analysis.dataflow.graph, ast: analysis.normalize }, queries);
	const duration = performance.now() - now;

	const metaInfo = `
The analysis required _${printAsMs(duration)}_ (including parsing and normalization and the query) within the generation environment.
	`.trim();

	return `

\`\`\`json
${JSON.stringify(queries, jsonReplacer, 2)}
\`\`\`

${collapseResult ? ' <details> <summary style="color:gray">Show Results</summary>' : ''}

_Results (prettified and summarized):_

${
	asciiSummaryOfQueryResult(markdownFormatter, duration, results as QueryResults<SupportedQueryTypes>, analysis)
}

<details> <summary style="color:gray">Show Detailed Results as Json</summary>

${metaInfo}	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information on how to get those.

${jsonWithLimit(results)}

</details>

${
	showCode ? `
<details> <summary style="color:gray">Original Code</summary>

${await printDfGraphForCode(shell, code, { switchCodeAndGraph: true })}

</details>
	` : ''
}

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

export function tocForQueryType(type: 'active' | 'virtual') {
	const queries = RegisteredQueries[type];
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
	const queries = RegisteredQueries[type];
	const result: string[] = [];
	for(const doc of queries.values()) {
		result.push(await explainQuery(shell, doc));
	}
	return result.join('\n\n\n');
}
