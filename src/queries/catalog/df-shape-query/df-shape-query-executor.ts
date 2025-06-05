import type { DfShapeQuery, DfShapeQueryResult } from './df-shape-query-format';
import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import { extractCfg } from '../../../control-flow/extract-cfg';
import { performDataFrameAbsint } from '../../../abstract-interpretation/data-frame/abstract-interpretation';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { DataFrameDomain } from '../../../abstract-interpretation/data-frame/domain';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { AbstractInterpretationInfo } from '../../../abstract-interpretation/data-frame/absint-info';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';

export function executeDfShapeQuery({ dataflow: { graph }, ast }: BasicQueryData, queries: readonly DfShapeQuery[]): DfShapeQueryResult {
	if(queries.length !== 1 && queries.some(query => query.criterion === undefined)) {
		log.warn('The dataframe shape query expects only up to one query without slicing criterion, but got', queries.length);
		queries = [{ type: 'df-shape' }];
	}

	const start = Date.now();
	const cfg = extractCfg(ast, graph);
	const domains = performDataFrameAbsint(cfg, graph);

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
		const node: RNode<ParentInformation & AbstractInterpretationInfo> | undefined = ast.idMap.get(nodeId);
		const value = node?.info.dataFrame?.domain?.get(node.info.id);
		result.set(query.criterion, value);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		domains: result
	};
}
