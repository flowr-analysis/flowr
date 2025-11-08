import type { DataFrameDomain } from '../../../abstract-interpretation/data-frame/dataframe-domain';
import { inferDataFrameShapes, resolveIdToDataFrameShape } from '../../../abstract-interpretation/data-frame/shape-inference';
import { type SingleSlicingCriterion , slicingCriterionToId } from '../../../slicing/criterion/parse';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { DfShapeQuery, DfShapeQueryResult } from './df-shape-query-format';


/**
 *
 */
export async function executeDfShapeQuery({ analyzer }: BasicQueryData, queries: readonly DfShapeQuery[]): Promise<DfShapeQueryResult> {
	if(queries.length !== 1 && queries.some(query => query.criterion === undefined)) {
		log.warn('The dataframe shape query expects only up to one query without slicing criterion, but got', queries.length);
		queries = [{ type: 'df-shape' }];
	}

	const ast = await analyzer.normalize();
	const dfg = (await analyzer.dataflow()).graph;
	const cfg = await analyzer.controlflow();

	const start = Date.now();
	const domains = inferDataFrameShapes(cfg, dfg, ast, analyzer.flowrConfig);

	if(queries.length === 1 && queries[0].criterion === undefined) {
		return {
			'.meta': {
				timing: Date.now() - start
			},
			domains: domains
		};
	}
	const result = new Map<SingleSlicingCriterion, DataFrameDomain | undefined>();

	for(const query of queries) {
		if(query.criterion === undefined) {
			log.warn('Missing criterion in dataframe shape query');
			continue;
		} else if(result.has(query.criterion)) {
			log.warn('Duplicate criterion in dataframe shape query:', query.criterion);
			continue;
		}
		const nodeId = slicingCriterionToId(query.criterion, ast.idMap);
		const node = ast.idMap.get(nodeId);
		const value = resolveIdToDataFrameShape(node?.info.id, dfg);
		result.set(query.criterion, value);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		domains: result
	};
}
