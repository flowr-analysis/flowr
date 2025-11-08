import { type OutputFormatter , bold, italic, markdownFormatter } from '../util/text/ansi';
import { type Queries, type Query, type QueryResult, type QueryResults, type SupportedQueryTypes , SupportedQueries } from './query';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { textWithTooltip } from '../util/html-hover-over';
import type { CallContextQuerySubKindResult } from './catalog/call-context-query/call-context-query-format';
import type { BaseQueryMeta, BaseQueryResult } from './base-query-format';
import { printAsMs } from '../util/text/time';
import { isBuiltIn } from '../dataflow/environments/built-in';
import type { AstIdMap, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';

function nodeString(nodeId: NodeId | { id: NodeId, info?: object}, formatter: OutputFormatter, idMap: AstIdMap<ParentInformation>): string {
	const isObj = typeof nodeId === 'object' && nodeId !== null && 'id' in nodeId;
	const id = isObj ? nodeId.id : nodeId;
	const info = isObj ? nodeId.info : undefined;
	if(isBuiltIn(id)) {
		return italic(id, formatter) + (info ? ` (${JSON.stringify(info)})` : '');
	}
	const node = idMap.get(id);
	if(node === undefined) {
		return `UNKNOWN: ${id} (info: ${JSON.stringify(info)})`;
	}
	return `${italic('`' + (node.lexeme ?? node.info.fullLexeme ?? 'UNKNOWN') + '`', formatter)} (L.${node.location?.[0]}${info ? ', ' + JSON.stringify(info) : ''})`;
}

function asciiCallContextSubHit(formatter: OutputFormatter, results: readonly CallContextQuerySubKindResult[], idMap: AstIdMap<ParentInformation>): string {
	const result: string[] = [];
	for(const { id, calls = [], linkedIds = [], aliasRoots = [] } of results) {
		const node = idMap.get(id);
		if(node === undefined) {
			result.push(` ${bold('UNKNOWN: ' + JSON.stringify({ calls, linkedIds }))}`);
			continue;
		}
		let line = nodeString(id, formatter, idMap);
		if(calls.length > 0) {
			line += ` with ${calls.length} call${calls.length > 1 ? 's' : ''} (${calls.map(c => nodeString(c, formatter, idMap)).join(', ')})`;
		}
		if(linkedIds.length > 0) {
			line += ` with ${linkedIds.length} link${linkedIds.length > 1 ? 's' : ''} (${linkedIds.map(c => nodeString(c, formatter, idMap)).join(', ')})`;
		}
		if(aliasRoots.length > 0) {
			line += ` with ${aliasRoots.length} alias root${aliasRoots.length > 1 ? 's' : ''} (${aliasRoots.map(c => nodeString(c, formatter, idMap)).join(', ')})`;
		}
		result.push(line);
	}
	return result.join(', ');
}

/**
 *
 */
export function asciiCallContext(formatter: OutputFormatter, results: QueryResults<'call-context'>['call-context'], idMap: AstIdMap<ParentInformation>): string {
	/* traverse over 'kinds' and within them 'subkinds' */
	const result: string[] = [];
	for(const [kind, { subkinds }] of Object.entries(results['kinds'])) {
		result.push(`   ╰ ${bold(kind, formatter)}`);
		for(const [subkind, values] of Object.entries(subkinds)) {
			result.push(`     ╰ ${bold(subkind, formatter)}: ${asciiCallContextSubHit(formatter, values, idMap)}`);
		}
	}
	return result.join('\n');
}

/**
 *
 */
export function summarizeIdsIfTooLong(formatter: OutputFormatter, ids: readonly NodeId[]) {
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
		acc += '... (see JSON)';
	}
	return formatter === markdownFormatter ? textWithTooltip(acc, JSON.stringify(ids)) : acc;
}

/**
 *
 */
export async function asciiSummaryOfQueryResult<S extends SupportedQueryTypes>(
	formatter: OutputFormatter, totalInMs: number, results: QueryResults<S>,
	analyzer: ReadonlyFlowrAnalysisProvider, queries: Queries<S>
): Promise<string> {
	const result: string[] = [];

	for(const [query, queryResults] of Object.entries(results)) {
		if(query === '.meta') {
			continue;
		}

		const queryType = SupportedQueries[query as SupportedQueryTypes];
		const relevantQueries = queries.filter(q => q.type === query as SupportedQueryTypes) as Query[];
		if(await queryType.asciiSummarizer(formatter, analyzer, queryResults as BaseQueryResult, result, relevantQueries)) {
			continue;
		}

		result.push(`Query: ${bold(query, formatter)}`);

		let timing = -1;

		for(const [key, value] of Object.entries(queryResults as Awaited<QueryResult<S>>)) {
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
