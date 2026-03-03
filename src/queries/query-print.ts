import { type OutputFormatter, bold, italic, markdownFormatter } from '../util/text/ansi';
import { type Queries, type Query, type QueryResult, type QueryResults, type SupportedQueryTypes, SupportedQueries } from './query';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { textWithTooltip } from '../util/html-hover-over';
import type { CallContextQuerySubKindResult } from './catalog/call-context-query/call-context-query-format';
import type { BaseQueryMeta, BaseQueryResult } from './base-query-format';
import { printAsMs } from '../util/text/time';
import type { AstIdMap, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { ReadonlyFlowrAnalysisProvider } from '../project/flowr-analyzer';
import { RNode } from '../r-bridge/lang-4.x/ast/model/model';

function nodeString(nodeId: NodeId | { id: NodeId, info?: object }, formatter: OutputFormatter, idMap: AstIdMap<ParentInformation>): string {
	const isObj = typeof nodeId === 'object' && nodeId !== null && 'id' in nodeId;
	const id = isObj ? nodeId?.id : nodeId;
	const info = isObj ? nodeId?.info : undefined;
	if(NodeId.isBuiltIn(id)) {
		return italic(id, formatter) + (info ? ` (${JSON.stringify(info)})` : '');
	}
	const node = idMap.get(id);
	if(node === undefined) {
		return `UNKNOWN: ${id} (info: ${JSON.stringify(info)})`;
	}
	return `${italic('`' + (RNode.lexeme(node) ?? 'UNKNOWN') + '`', formatter)} (L.${node.location?.[0]}${info ? ', ' + JSON.stringify(info) : ''})`;
}

function asciiCallContextSubHit(formatter: OutputFormatter, results: readonly CallContextQuerySubKindResult[], idMap: AstIdMap<ParentInformation>): string {
	const result: string[] = [];
	for(const { id, calls = [], linkedIds = [], aliasRoots = [] } of results.slice(0, 20)) {
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
	if(results.length > 20) {
		result.push(` ... and ${results.length - 20} more hits`);
	}
	return result.join(', ');
}

/**
 * Converts call context query results to an ASCII representation
 */
export function asciiCallContext(formatter: OutputFormatter, results: QueryResults<'call-context'>['call-context'], idMap: AstIdMap<ParentInformation>): string {
	/* traverse over 'kinds' and within them 'subkinds' */
	const result: string[] = [];
	for(const [kind, { subkinds }] of Object.entries(results['kinds'])) {
		const amountOfHits = Object.values(subkinds).reduce((acc, cur) => acc + cur.length, 0);
		result.push(`   ╰ ${bold(kind, formatter)} (${amountOfHits} hit${amountOfHits === 1 ? '' : 's'}):`);
		for(const [subkind, values] of Object.entries(subkinds)) {
			const amountOfSubHits = values.length;
			result.push(`     ╰ ${bold(subkind, formatter)} (${amountOfSubHits} hit${amountOfSubHits === 1 ? '' : 's'}): ${asciiCallContextSubHit(formatter, values, idMap)}`);
		}
	}
	return result.join('\n');
}

/**
 * Summarizes a list of node IDs, shortening the output if it is too long
 * @example
 * ```ts
 * summarizeIdsIfTooLong(markdownFormatter, ['id1', 'id2', 'id3']);
 * // returns 'id1, id2, id3'
 * summarizeIdsIfTooLong(markdownFormatter, [<array of many ids>]);
 * // returns 'id1, id2, id3, ... (see JSON)' with a tooltip containing the full JSON array
 * ```
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
 * Generates an ASCII summary of the given query results
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
