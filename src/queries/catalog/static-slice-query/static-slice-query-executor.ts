import type { StaticSliceQuery, StaticSliceQueryResult } from './static-slice-query-format';
import { staticSlicing } from '../../../slicing/static/static-slicer';
import { reconstructToCode } from '../../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../../reconstruct/auto-select/auto-select-defaults';
import { makeMagicCommentHandler } from '../../../reconstruct/auto-select/magic-comments';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';

export function fingerPrintOfQuery(query: StaticSliceQuery): string {
	return JSON.stringify(query);
}

export async function executeStaticSliceQuery({ input }: BasicQueryData, queries: readonly StaticSliceQuery[]): Promise<StaticSliceQueryResult> {
	const start = Date.now();
	const results: StaticSliceQueryResult['results'] = {};
	for(const query of queries) {
		const key = fingerPrintOfQuery(query);
		if(results[key]) {
			log.warn(`Duplicate Key for slicing-query: ${key}, skipping...`);
		}
		const { criteria, noReconstruction, noMagicComments } = query;
		const sliceStart = Date.now();
		const slice = staticSlicing((await input.dataflow()).graph, await input.normalizedAst(), criteria, input.flowrConfig.solver.slicer?.threshold);
		const sliceEnd = Date.now();
		if(noReconstruction) {
			results[key] = { slice: { ...slice, '.meta': { timing: sliceEnd - sliceStart, cached: false } } };
		} else {
			const reconstructStart = Date.now();
			const reconstruct = reconstructToCode(await input.normalizedAst(), slice.result, noMagicComments ? doNotAutoSelect : makeMagicCommentHandler(doNotAutoSelect));
			const reconstructEnd = Date.now();
			results[key] = {
				slice:       { ...slice, '.meta': { timing: sliceEnd - sliceStart, cached: false } },
				reconstruct: { ...reconstruct, '.meta': { timing: reconstructEnd - reconstructStart, cached: false } }
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
