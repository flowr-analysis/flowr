import type { BasicQueryData } from '../../query';
import type { StaticSliceQuery, StaticSliceQueryResult } from './static-slice-query-format';
import { staticSlicing } from '../../../slicing/static/static-slicer';
import { reconstructToCode } from '../../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../../reconstruct/auto-select/auto-select-defaults';
import { makeMagicCommentHandler } from '../../../reconstruct/auto-select/magic-comments';
import { log } from '../../../util/log';

export function fingerPrintOfQuery(query: StaticSliceQuery): `{${string}}` {
	return JSON.stringify(query) as `{${string}}`;
}

export function executeStaticSliceClusterQuery({ graph, ast }: BasicQueryData, queries: readonly StaticSliceQuery[]): StaticSliceQueryResult {
	const start = Date.now();
	const results: StaticSliceQueryResult['results'] = {};
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);
		if(results[key]) {
			log.warn(`Duplicate Key for slicing-query: ${key}, skipping...`);
		}
		const { criteria, noReconstruction, noMagicComments } = query;
		const slice = staticSlicing(graph, ast, criteria);
		if(noReconstruction) {
			results[key] = { slice };
		} else {
			results[key] = {
				slice,
				reconstruct: reconstructToCode(ast, slice.result, noMagicComments ? doNotAutoSelect : makeMagicCommentHandler(doNotAutoSelect))
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
