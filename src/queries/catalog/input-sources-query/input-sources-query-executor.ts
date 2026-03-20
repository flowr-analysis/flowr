import type { BasicQueryData } from '../../base-query-format';
import type { InputSourcesQuery, InputSourcesQueryResult } from './input-sources-query-format';
import { log } from '../../../util/log';
import { SlicingCriterion } from '../../../slicing/criterion/parse';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import type { InputSources } from './simple-input-classifier';
import { classifyInput } from './simple-input-classifier';
import { NETWORK_FUNCTIONS } from '../../../linter/rules/network-functions';
import { SEEDED_RANDOMNESS } from '../../../linter/rules/seeded-randomness';
import { ReadFunctions } from '../dependencies-query/function-info/read-functions';



/**
 * Execute an input sources query
 */
export async function executeInputSourcesQuery({ analyzer }: BasicQueryData, queries: readonly InputSourcesQuery[]): Promise<InputSourcesQueryResult> {
	const start = Date.now();
	const results: Record<string, InputSources> = {};
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
		const provenance = Dataflow.provenanceGraph(
			criterionId,
			df.graph,
			fdef ? RNode.collectAllIds(fdef) : undefined
		);

		results[key] = classifyInput(criterionId, provenance, {
			networkFns: query.config?.networkFns ?? NETWORK_FUNCTIONS.info.defaultConfig.fns,
			randomFns:  query.config?.randomFns ?? SEEDED_RANDOMNESS.info.defaultConfig.randomnessConsumers,
			pureFns:    query.config?.pureFns ?? ['paste', 'paste0', 'parse', '+', '-', '*',
				'/', '^', '%%', '%/%', '&', '|', '!', '&&', '||',
				'<', '>', '<=', '>=', '==', '!=', ':',
				'abs', 'sign', 'sqrt', 'exp', 'log', 'log10', 'log2',
				'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
				'length', 'nchar', 'dim', 'nrow', 'ncol',
				'c', 'list', 'data.frame',
				'ifelse', 'switch', 'factor', 'as.factor',
				'round', 'floor', 'ceiling', 'trunc',
				'substr', 'substring', 'strsplit',
				'min', 'max', 'range', 'sum', 'prod', 'mean', 'median', 'var', 'sd',
				'head', 'tail', 'seq', 'rep',
				'apply', 'lapply', 'sapply', 'vapply', 'tapply',
				'matrix', 'array',
				'rownames', 'colnames',
				'list.files', 'tolower', 'toupper', 'printf',
				'<-', '->', '=', '<<-', '->>', 'assign', 'get'
			],
			readFileFns: query.config?.readFileFns ?? ReadFunctions.map(f => f.name)
		});
	}

	return ({
		'.meta': {
			timing: Date.now() - start
		},
		results
	} as unknown) as InputSourcesQueryResult;
}
