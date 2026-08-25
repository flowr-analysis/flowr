import type { StaticSliceQuery, StaticSliceQueryResult } from './static-slice-query-format';
import { staticSlice } from '../../../slicing/static/static-slicer';
import { reconstructSlice, resolveSliceCriteria, sliceResultKey, sliceResultKeys } from '../slice-query-options';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { SliceDirection } from '../../../util/slice-direction';
import { Dataflow } from '../../../dataflow/graph/df-helper';

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
 * @param queries - The static slice queries to execute
 * @returns The results of the static slice queries
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
		const { criteria, noReconstruction, includeCallees } = query;
		const sliceStart = Date.now();
		const n = await analyzer.normalize();
		const df = await analyzer.dataflow();
		const slice = staticSlice({ ctx: analyzer.inspectContext(), info: df, ast: n, ids: resolveSliceCriteria(criteria, n), direction: query.direction ?? SliceDirection.Backward, threshold: analyzer.flowrConfig.solver.slicer?.threshold, includeCallees });
		const sliceEnd = Date.now();
		const packages = query.reportPackages ? [...Dataflow.packagesOf(slice.result, df.graph)] : undefined;
		if(noReconstruction) {
			results[key] = { packages, slice: { ...slice, '.meta': { timing: sliceEnd - sliceStart } } };
		} else {
			const reconstructStart = Date.now();
			const reconstruct = reconstructSlice(n, df.graph, slice.result, query);
			const reconstructEnd = Date.now();
			results[key] = {
				packages,
				slice:       { ...slice, '.meta': { timing: sliceEnd - sliceStart } },
				reconstruct: { ...reconstruct, '.meta': { timing: reconstructEnd - reconstructStart } }
			};
		}
	}
	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
