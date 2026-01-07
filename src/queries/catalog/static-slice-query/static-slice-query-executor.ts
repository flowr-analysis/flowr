import type { StaticSliceQuery, StaticSliceQueryResult } from './static-slice-query-format';
import { staticSlice } from '../../../slicing/static/static-slicer';
import { reconstructToCode } from '../../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../../reconstruct/auto-select/auto-select-defaults';
import { makeMagicCommentHandler } from '../../../reconstruct/auto-select/magic-comments';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { SliceDirection } from '../../../core/steps/all/static-slicing/00-slice';

/**
 * Produce a fingerprint string for a static slice query
 */
export function fingerPrintOfQuery(query: StaticSliceQuery): string {
	return JSON.stringify(query);
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
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);
		if(results[key]) {
			log.warn(`Duplicate Key for slicing-query: ${key}, skipping...`);
		}
		const { criteria, noReconstruction, noMagicComments } = query;
		const sliceStart = Date.now();
		const slice = staticSlice(analyzer.inspectContext(), await analyzer.dataflow(), await analyzer.normalize(), criteria, query.direction ?? SliceDirection.Backward, analyzer.flowrConfig.solver.slicer?.threshold);
		const sliceEnd = Date.now();
		if(noReconstruction) {
			results[key] = { slice: { ...slice, '.meta': { timing: sliceEnd - sliceStart } } };
		} else {
			const reconstructStart = Date.now();
			const reconstruct = reconstructToCode(await analyzer.normalize(), { nodes: slice.result }, noMagicComments ? doNotAutoSelect : makeMagicCommentHandler(doNotAutoSelect));
			const reconstructEnd = Date.now();
			results[key] = {
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
