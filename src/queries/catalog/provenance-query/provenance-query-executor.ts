import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { ProvenanceQuery, ProvenanceQueryResult } from './provenance-query-format';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';

/**
 * Execute static slice queries, catching duplicates with the same fingerprint
 * @param analyzer - The basic query data containing the analyzer
 * @param queries - The static slice queries to execute
 * @returns The results of the static slice queries
 */
export async function executeProvenanceQuery({ analyzer }: BasicQueryData, queries: readonly ProvenanceQuery[]): Promise<ProvenanceQueryResult> {
	const start = Date.now();
	const results: ProvenanceQueryResult['results'] = {};
	const nast = await analyzer.normalize();
	const df = await analyzer.dataflow();
	for(const query of queries) {
		const key = query.criterion;
		if(results[key]) {
			log.warn(`Duplicate Key for provenance query: ${key}, skipping...`);
		}
		const criterionId = SingleSlicingCriterion.tryParse(key, nast.idMap) ?? key;

		const provenanceNode = nast.idMap.get(criterionId);
		const fdef = RFunctionDefinition.wrappingFunctionDefinition(provenanceNode, nast.idMap);
		results[key] = Array.from(Dataflow.provenance(
			criterionId,
			df.graph,
			fdef ? RNode.collectAllIds(fdef) : undefined
		));
	}
	return {
		'.meta': {
			timing: Date.now() - start
		},
		results
	};
}
