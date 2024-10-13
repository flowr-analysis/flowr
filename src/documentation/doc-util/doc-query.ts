import type { RShell } from '../../r-bridge/shell';
import type { Queries, QueryResults, SupportedQueryTypes } from '../../queries/query';
import { executeQueries } from '../../queries/query';
import { PipelineExecutor } from '../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
import { jsonReplacer } from '../../util/json';
import { bold, italic, markdownFormatter, type OutputFormatter } from '../../util/ansi';
import { FlowrWikiBaseRef, getFilePathMd } from './doc-files';
import type { SupportedVirtualQueryTypes } from '../../queries/virtual-query/virtual-queries';
import type { VirtualCompoundConstraint } from '../../queries/virtual-query/compound-query';
import { printDfGraphForCode } from './doc-dfg';
import { jsonWithLimit } from './doc-code';
import { printAsMs } from '../../util/time';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { PipelineOutput } from '../../core/steps/pipeline/pipeline';
import { BuiltIn } from '../../dataflow/environments/built-in';
import { graphToMermaidUrl } from '../../util/mermaid/dfg';
import { normalizedAstToMermaidUrl } from '../../util/mermaid/ast';
import type { StaticSliceQuery } from '../../queries/catalog/static-slice-query/static-slice-query-format';
import type { BaseQueryMeta } from '../../queries/base-query-format';
import { textWithTooltip } from './doc-hover-over';
import type { CallContextQuerySubKindResult } from '../../queries/catalog/call-context-query/call-context-query-format';

export interface ShowQueryOptions {
	readonly showCode?:       boolean;
	readonly collapseResult?: boolean;
}

function nodeString(id: NodeId, formatter: OutputFormatter, processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>): string {
	if(id === BuiltIn) {
		return italic('built-in', formatter);
	}
	const node = processed.normalize.idMap.get(id);
	if(node === undefined) {
		return `UNKNOWN: ${id}`;
	}
	return `${italic('`' + (node.lexeme ?? node.info.fullLexeme ?? 'UNKNOWN') + '`', formatter)} (L.${node.location?.[0]})`;
}

function asciiCallContextSubHit(formatter: OutputFormatter, results: readonly CallContextQuerySubKindResult[], processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>): string {
	const result: string[] = [];
	for(const { id, calls = [], linkedIds = [], aliasRoots = [] } of results) {
		const node = processed.normalize.idMap.get(id);
		if(node === undefined) {
			result.push(` ${bold('UNKNOWN: ' + JSON.stringify({ calls, linkedIds }))}`);
			continue;
		}
		let line = nodeString(id, formatter, processed);
		if(calls.length > 0) {
			line += ` with ${calls.length} call${calls.length > 1 ? 's' : ''} (${calls.map(c => nodeString(c, formatter, processed)).join(', ')})`;
		}
		if(linkedIds.length > 0) {
			line += ` with ${linkedIds.length} link${linkedIds.length > 1 ? 's' : ''} (${linkedIds.map(c => nodeString(c, formatter, processed)).join(', ')})`;
		}
		if(aliasRoots.length > 0) {
			line += ` with ${aliasRoots.length} alias root${aliasRoots.length > 1 ? 's' : ''} (${aliasRoots.map(c => nodeString(c, formatter, processed)).join(', ')})`;
		}
		result.push(line);
	}
	return result.join(', ');
}

function asciiCallContext(formatter: OutputFormatter, results: QueryResults<'call-context'>['call-context'], processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>): string {
	/* traverse over 'kinds' and within them 'subkinds' */
	const result: string[] = [];
	for(const [kind, { subkinds }] of Object.entries(results['kinds'])) {
		result.push(`   ╰ ${bold(kind, formatter)}`);
		for(const [subkind, values] of Object.entries(subkinds)) {
			result.push(`     ╰ ${bold(subkind, formatter)}: ${asciiCallContextSubHit(formatter, values, processed)}`);
		}
	}
	return result.join('\n');
}

function summarizeIdsIfTooLong(ids: readonly NodeId[]) {
	const naive = ids.join(', ');
	if(naive.length <= 20) {
		return naive;
	}
	let acc = '';
	let i = 0;
	while(acc.length <= 20) {
		acc += ids[i++] + ', ';
	}
	if(i < ids.length) {
		acc += '... (see JSON below)';
	}
	return textWithTooltip(acc, JSON.stringify(ids));
}

export function asciiSummaryOfQueryResult(formatter: OutputFormatter, totalInMs: number, results: QueryResults<SupportedQueryTypes>, processed: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>): string {
	const result: string[] = [];

	for(const [query, queryResults] of Object.entries(results)) {
		if(query === '.meta') {
			continue;
		}
		if(query === 'call-context') {
			const out = queryResults as QueryResults<'call-context'>['call-context'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(asciiCallContext(formatter, out, processed));
			continue;
		} else if(query === 'dataflow') {
			const out = queryResults as QueryResults<'dataflow'>['dataflow'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(`   ╰ [Dataflow Graph](${graphToMermaidUrl(out.graph)})`);
			continue;
		} else if(query === 'id-map') {
			const out = queryResults as QueryResults<'id-map'>['id-map'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(`   ╰ Id List: {${summarizeIdsIfTooLong([...out.idMap.keys()])}}`);
			continue;
		} else if(query === 'normalized-ast') {
			const out = queryResults as QueryResults<'normalized-ast'>['normalized-ast'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			result.push(`   ╰ [Normalized AST](${normalizedAstToMermaidUrl(out.normalized.ast)})`);
			continue;
		} else if(query === 'static-slice') {
			const out = queryResults as QueryResults<'static-slice'>['static-slice'];
			result.push(`Query: ${bold(query, formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
			for(const [fingerprint, obj] of Object.entries(out.results)) {
				const { criteria, noMagicComments, noReconstruction } = JSON.parse(fingerprint) as StaticSliceQuery;
				const addons = [];
				if(noReconstruction) {
					addons.push('no reconstruction');
				}
				if(noMagicComments) {
					addons.push('no magic comments');
				}
				result.push(`   ╰ Slice for {${criteria.join(', ')}} ${addons.join(', ')}`);
				if('reconstruct' in obj) {
					result.push('     ╰ Code (newline as <code>&#92;n</code>): <code>' + obj.reconstruct.code.split('\n').join('\\n') + '</code>');
				} else {
					result.push(`     ╰ Id List: {${summarizeIdsIfTooLong([...obj.slice.result])}}`);
				}
			}
			continue;
		} else if(query === 'dataflow-cluster') {
			const out = queryResults as QueryResults<'dataflow-cluster'>['dataflow-cluster'];
			result.push(`Query: ${bold(query, formatter)} (${out['.meta'].timing.toFixed(0)}ms)`);
			result.push(`   ╰ Found ${out.clusters.length} cluster${out.clusters.length === 1 ? '' : 's'}`);
			for(const cluster of out.clusters) {
				const unknownSideEffects = cluster.hasUnknownSideEffects ? '(has unknown side effect)' : '';
				result.push(`      ╰ ${unknownSideEffects} {${summarizeIdsIfTooLong(cluster.members)}} ([marked](${
					graphToMermaidUrl(processed.dataflow.graph, false, new Set(cluster.members))
				}))`);
			}
			continue;
		}

		result.push(`Query: ${bold(query, formatter)}`);

		let timing = -1;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		for(const [key, value] of Object.entries(queryResults)) {
			if(key === '.meta') {
				timing = (value as BaseQueryMeta).timing;
				continue;
			}
			result.push(` ╰ ${key}: ${JSON.stringify(value)}`);
		}
		result.push(`  - Took ${printAsMs(timing, 0)}`);
	}

	result.push(italic(`All queries together required ≈${printAsMs(results['.meta'].timing, 0)} (1ms accuracy, total ${printAsMs(totalInMs, 0)})`, formatter));
	return formatter.format(result.join('\n'));
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
	const queries = RegisteredQueries[type];
	const result: string[] = [];
	for(const doc of queries.values()) {
		result.push(await explainQuery(shell, doc));
	}
	return result.join('\n\n\n');
}
