import type { BasicQueryData } from '../../base-query-format';
import type { InputSourcesQuery, InputSourcesQueryResult } from './input-sources-query-format';
import { log } from '../../../util/log';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { Dataflow } from '../../../dataflow/graph/df-helper';

/**
 * Execute an input sources query
 */
export async function executeInputSourcesQuery({ analyzer }: BasicQueryData, queries: readonly InputSourcesQuery[]): Promise<InputSourcesQueryResult> {
	const start = Date.now();
	const results: InputSourcesQueryResult['results'] = {};
	const nast = await analyzer.normalize();
	const df = await analyzer.dataflow();

	for(const query of queries) {
		const key = query.criterion;
		if(results[key]) {
			log.warn(`Duplicate key for provenance query: ${key}, skipping...`);
		}
		const criterionId = SlicingCriterion.tryParse(key, nast.idMap) ?? key;
		const provenanceNode = nast.idMap.get(criterionId);

		const fdef = RFunctionDefinition.wrappingFunctionDefinition(provenanceNode, nast.idMap);
		const provenance = Dataflow.provenance(
			criterionId,
			df.graph,
			fdef ? RNode.collectAllIds(fdef) : undefined
		);

		// TODO: run classification, we want to know:
		// all ultimate inputs, whether they pass thruogh trustworthy functiosn ( TODO: to be replaced by thomas taint tracking later)
		// TODO:for sources separate constant, random, unknown, etc.
		// TODO: get with `a.b.c` string for flowr config
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
