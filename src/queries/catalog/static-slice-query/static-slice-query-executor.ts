import type { StaticSliceQuery, StaticSliceQueryResult } from './static-slice-query-format';
import { staticSlice } from '../../../slicing/static/static-slicer';
import { reconstructSlice, resolveSliceCriteria, sliceResultKey, sliceResultKeys, timedSliceEntry } from '../slice-query-options';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { SliceDirection } from '../../../util/slice-direction';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { keptAfterRemoval, staticRemovalSlice } from '../../../slicing/static/removal-slice';
import type { DependencyInfo } from '../dependencies-query/dependencies-query-format';

/** what a static slice is of, which is what its result is keyed by when it was given no name */
const slicedBy = (query: StaticSliceQuery): string => query.criteria.join(',');

/**
 * The key a static slice query's result is reported under: the {@link SliceQueryOptions#name|name} it was given,
 * else what it slices. Within a request use {@link sliceResultKeys}, which settles two queries wanting one key.
 */
export function fingerPrintOfQuery(query: StaticSliceQuery): string {
	return sliceResultKey(query, slicedBy);
}

/**
 * Execute static slice queries, catching duplicates with the same fingerprint
 * @param analyzer - The basic query data containing the analyzer
 * @param queries  - The static slice queries to execute
 * @returns        The results of the static slice queries
 */
export async function executeStaticSliceQuery({ analyzer }: BasicQueryData, queries: readonly StaticSliceQuery[]): Promise<StaticSliceQueryResult> {
	const start = Date.now();
	const results: StaticSliceQueryResult['results'] = {};
	const keys = sliceResultKeys(queries, slicedBy);
	for(const [at, query] of queries.entries()) {
		const key = keys[at];
		if(results[key]) {
			log.warn(`Duplicate Key for slicing-query: ${key}, skipping...`);
		}
		const { criteria, includeCallees } = query;
		const sliceStart = Date.now();
		const n = await analyzer.normalize();
		const df = await analyzer.dataflow();
		const ids = resolveSliceCriteria(criteria, n);
		const threshold = analyzer.flowrConfig.solver.slicer?.threshold;
		if(query.removal) {
			/* the plots, devices and saves the dependencies state are what a removed plot takes along */
			const { dependencies } = await analyzer.query([{ type: 'dependencies' }]);
			const removed = staticRemovalSlice(analyzer.inspectContext(), df, n, ids, Object.values(dependencies).filter(Array.isArray).flat() as DependencyInfo[], threshold).result;
			const kept = keptAfterRemoval(n, removed);
			results[key] = timedSliceEntry(query, { timesHitThreshold: 0, result: removed, slicedFor: ids }, Date.now() - sliceStart,
				() => reconstructSlice(n, df.graph, kept, query));
			continue;
		}
		const slice = staticSlice({ ctx: analyzer.inspectContext(), info: df, ast: n, ids, direction: query.direction ?? SliceDirection.Backward, threshold, includeCallees });
		const packages = query.reportPackages ? [...Dataflow.packagesOf(slice.result, df.graph)] : undefined;
		results[key] = { packages, ...timedSliceEntry(query, slice, Date.now() - sliceStart,
			() => reconstructSlice(n, df.graph, slice.result, query)) };
	}
	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
