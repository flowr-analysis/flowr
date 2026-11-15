import { SourceLocation, SourceRange } from '../util/range';
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
import fs from 'fs';

/** The first line of a query's ascii summary: its name and how long it took (`plainMs` for a plain `ms` suffix). */
export function queryHeader(name: string, formatter: OutputFormatter, timing: number, plainMs = false): string {
	return `Query: ${bold(name, formatter)} (${plainMs ? `${timing.toFixed(0)}ms` : printAsMs(timing, 0)})`;
}

/** The bullet naming a function definition of an `inspect-*` summary with its location. */
export function functionBullet(id: NodeId, formatter: OutputFormatter, idMap: AstIdMap<ParentInformation>): string {
	return `  - Function ${bold(id, formatter)} (${SourceLocation.format(SourceLocation.fromNode(idMap.get(NodeId.normalize(id))))})`;
}

function nodeString(nodeId: NodeId | { id: NodeId, info?: object }, formatter: OutputFormatter, idMap: AstIdMap<ParentInformation>): string {
	const isObj = typeof nodeId === 'object' && nodeId !== null && 'id' in nodeId;
	const id = isObj ? nodeId.id : nodeId;
	const info = isObj ? nodeId.info : undefined;
	if(NodeId.isBuiltIn(id)) {
		return italic(id, formatter) + (info ? ` (${JSON.stringify(info)})` : '');
	}
	const node = idMap.get(id);
	if(node === undefined) {
		return `UNKNOWN: ${id} (info: ${JSON.stringify(info)})`;
	}
	return `${italic('`' + (RNode.lexeme(node) ?? 'UNKNOWN') + '`', formatter)} (L.${SourceRange.getStartLine(node.location)}${info ? ', ' + JSON.stringify(info) : ''})`;
}

function asciiCallContextSubHit(formatter: OutputFormatter, results: readonly CallContextQuerySubKindResult[], idMap: AstIdMap<ParentInformation>): string {
	const withAll = (items: readonly (NodeId | { id: NodeId, info?: object })[], noun: string) =>
		items.length > 0 ? ` with ${items.length} ${noun}${items.length > 1 ? 's' : ''} (${items.map(c => nodeString(c, formatter, idMap)).join(', ')})` : '';
	const result = results.slice(0, 20).map(({ id, calls = [], linkedIds = [], aliasRoots = [] }) => idMap.get(id) === undefined
		? ` ${bold('UNKNOWN: ' + JSON.stringify({ calls, linkedIds }))}`
		: nodeString(id, formatter, idMap) + withAll(calls, 'call') + withAll(linkedIds, 'link') + withAll(aliasRoots, 'alias root'));
	if(results.length > 20) {
		result.push(` ... and ${results.length - 20} more hits`);
	}
	return result.join(', ');
}

/** Converts call context query results to an ASCII representation */
export function asciiCallContext(formatter: OutputFormatter, results: QueryResults<'call-context'>['call-context'], idMap: AstIdMap<ParentInformation>): string {
	const hits = (n: number) => `${n} hit${n === 1 ? '' : 's'}`;
	return Object.entries(results['kinds']).flatMap(([kind, { subkinds }]) => [
		`   ╰ ${bold(kind, formatter)} (${hits(Object.values(subkinds).reduce((acc, cur) => acc + cur.length, 0))}):`,
		...Object.entries(subkinds).map(([subkind, values]) => `     ╰ ${bold(subkind, formatter)} (${hits(values.length)}): ${asciiCallContextSubHit(formatter, values, idMap)}`)
	]).join('\n');
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

/** Generates an ASCII summary of the given query results */
export async function asciiSummaryOfQueryResult<S extends SupportedQueryTypes>(formatter: OutputFormatter, totalInMs: number, results: QueryResults<S>, analyzer: ReadonlyFlowrAnalysisProvider, queries: Queries<S>): Promise<string> {
	const result: string[] = [];
	for(const [query, queryResults] of Object.entries(results)) {
		if(query === '.meta') {
			continue;
		}
		if(queryResults === undefined || (typeof queryResults === 'object' && queryResults !== null && 'error' in queryResults)) {
			const message = (queryResults as { error?: string } | undefined)?.error ?? 'unknown error';
			result.push(`Query: ${bold(query, formatter)} ${bold('failed', formatter)}: ${message}`);
			continue;
		}
		const queryType = SupportedQueries[query as SupportedQueryTypes];
		const relevantQueries = queries.filter(q => q.type === query as SupportedQueryTypes) as Query[];
		if(await queryType.asciiSummarizer(formatter, analyzer, queryResults as BaseQueryResult, result, relevantQueries)) {
			continue;
		}

		result.push(`Query: ${bold(query, formatter)}`);
		const { '.meta': meta, ...rest } = queryResults as Awaited<QueryResult<S>> & { '.meta'?: BaseQueryMeta };
		result.push(...Object.entries(rest).map(([key, value]) => ` ╰ ${key}: ${JSON.stringify(value)}`), `  - Took ${printAsMs(meta?.timing ?? -1, 0)}`);
	}
	if(analyzer.flowrConfig.repl.queryStats !== false) {
		result.push(italic(`All queries together required ≈${printAsMs(results['.meta'].timing, 0)} (1ms accuracy, total ${printAsMs(totalInMs, 0)})`, formatter));
	}
	return formatter.format(result.join('\n'));
}

/** The requested roots that do not exist, if the analyzer found no requests to analyze at all (`undefined` otherwise). */
export function missingRootsWithoutRequests(analyzer: ReadonlyFlowrAnalysisProvider): string[] | undefined {
	const files = analyzer.inspectContext().files;
	return !files.hasRequests() ? files.getRequestedRoots().filter(p => !fs.existsSync(p)) : undefined;
}
