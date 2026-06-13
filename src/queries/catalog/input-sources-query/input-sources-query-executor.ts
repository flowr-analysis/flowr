import type { BasicQueryData } from '../../base-query-format';
import { DefaultInputClassifierConfig, type InputSourcesQuery, type InputSourcesQueryResult } from './input-sources-query-format';
import { log } from '../../../util/log';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import type { InputClassifierConfig, InputClassifierFunctionIdentifiers, InputSources } from './simple-input-classifier';
import { classifyInput } from './simple-input-classifier';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { runSearch } from '../../../search/flowr-search-executor';
import { type FlowrSearchLike } from '../../../search/flowr-search-builder';
import { Record } from '../../../util/record';

/**
 * Execute an input sources query
 */
export async function executeInputSourcesQuery({ analyzer }: BasicQueryData, queries: readonly InputSourcesQuery[]): Promise<InputSourcesQueryResult> {
	const start = Date.now();
	const results: Record<string, InputSources> = {};
	const nast = await analyzer.normalize();
	const df = await analyzer.dataflow();
	const defaultConfig = await resolveSearches(analyzer, DefaultInputClassifierConfig);

	for(const query of queries) {
		const criteria: readonly SlicingCriterion[] = Array.isArray(query.criterion)
			? (query.criterion as readonly SlicingCriterion[])
			: [(query.criterion as SlicingCriterion)];
		const config = { ...defaultConfig, ...(await resolveSearches(analyzer, query.config ?? {})) };

		for(const criterion of criteria) {
			if(results[criterion]) {
				log.warn(`Duplicate key for input-sources query: ${criterion}, skipping...`);
				continue;
			}
			const criterionId = SlicingCriterion.tryParse(criterion, nast.idMap) ?? criterion;
			const provenanceNode = nast.idMap.get(criterionId);
			const fdef = RFunctionDefinition.rootFunctionDefinition(provenanceNode, nast.idMap);
			const provenance = Dataflow.provenanceGraph(
				criterionId,
				df.graph,
				fdef ? RNode.collectAllIds(fdef) : undefined
			);
			results[criterion] = classifyInput(criterionId, provenance, config, df.graph);
		}
	}

	return ({
		'.meta': {
			timing: Date.now() - start
		},
		results
	} as unknown) as InputSourcesQueryResult;
}

async function resolveSearches(analyzer: ReadonlyFlowrAnalysisProvider, config: InputClassifierConfig): Promise<InputClassifierConfig<InputClassifierFunctionIdentifiers>> {
	const result: InputClassifierConfig<InputClassifierFunctionIdentifiers> = {};

	for(const [key, value] of Record.entries(config)) {
		if(value === undefined || Array.isArray(value)) {
			result[key] = value;
		} else {
			const searchResult = await runSearch(value as FlowrSearchLike, analyzer);
			result[key] = searchResult.getElements().map(element => element.node.info.id);
		}
	}
	return result;
}
