import type { StaticSliceQuery, StaticSliceQueryResult } from './static-slice-query-format';
import { staticBackwardSlice, staticForwardSlice } from '../../../slicing/static/static-slicer';
import { reconstructToCode } from '../../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../../reconstruct/auto-select/auto-select-defaults';
import { makeMagicCommentHandler } from '../../../reconstruct/auto-select/magic-comments';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { SliceDirection } from '../../../core/steps/all/static-slicing/00-slice';

export function fingerPrintOfQuery(query: StaticSliceQuery): string {
	return JSON.stringify(query);
}

export function executeStaticSliceQuery({ dataflow: { graph }, ast }: BasicQueryData, queries: readonly StaticSliceQuery[]): StaticSliceQueryResult {
	const start = Date.now();
	const results: StaticSliceQueryResult['results'] = {};
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);
		if(results[key]) {
			log.warn(`Duplicate Key for slicing-query: ${key}, skipping...`);
		}
		const { criteria, noReconstruction, noMagicComments } = query;
		const sliceStart = Date.now();
		const slice = query.direction === SliceDirection.Forward ? staticForwardSlice(graph, ast, criteria) : staticBackwardSlice(graph, ast, criteria);
		const sliceEnd = Date.now();
		if(noReconstruction) {
			results[key] = { slice: { ...slice, '.meta': { timing: sliceEnd - sliceStart } } };
		} else {
			const reconstructStart = Date.now();
			const reconstruct = reconstructToCode(ast, slice.result, noMagicComments ? doNotAutoSelect : makeMagicCommentHandler(doNotAutoSelect));
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
