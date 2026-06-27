import type { BasicQueryData } from '../../base-query-format';
import type { DiceQuery, DiceQueryResult } from './dice-query-format';
import { staticDice } from '../../../slicing/static/static-slicer';
import { reconstructToCode } from '../../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../../reconstruct/auto-select/auto-select-defaults';
import { makeMagicCommentHandler } from '../../../reconstruct/auto-select/magic-comments';
import { SlicingCriteria } from '../../../slicing/criterion/parse';
import { log } from '../../../util/log';

/**
 * Execute dice queries. Each dice computes the intersection of a forward slice from `from`
 * and a backward slice from `to`, yielding only those program points that lie on a path
 * from the start criteria to the end criteria.
 */
export async function executeDiceQuery({ analyzer }: BasicQueryData, queries: readonly DiceQuery[]): Promise<DiceQueryResult> {
	const start = Date.now();
	const results: DiceQueryResult['results'] = {};
	const ast = await analyzer.normalize();
	const df = await analyzer.dataflow();

	for(const query of queries) {
		const key = JSON.stringify(query);
		if(results[key]) {
			log.warn(`Duplicate key for dice-query: ${key}, skipping...`);
			continue;
		}

		const { from, to, noReconstruction, noMagicComments } = query;
		const startIds = SlicingCriteria.convertAll(from, ast.idMap);
		const endIds = SlicingCriteria.convertAll(to, ast.idMap);

		const sliceStart = Date.now();
		const slice = staticDice(analyzer.inspectContext(), df, ast, startIds, endIds, analyzer.flowrConfig.solver.slicer?.threshold);
		const sliceEnd = Date.now();

		if(noReconstruction) {
			results[key] = { slice: { ...slice, '.meta': { timing: sliceEnd - sliceStart } } };
		} else {
			const reconstructStart = Date.now();
			const reconstruct = reconstructToCode(ast, { nodes: slice.result }, noMagicComments ? doNotAutoSelect : makeMagicCommentHandler(doNotAutoSelect));
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
