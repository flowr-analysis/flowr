import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { TaintQuery, TaintQueryResult } from './taint-query-format';
import type { AllPredefinedTaintAnalysisNames } from '../../../taint-analysis/predefined/predefined';



/**
 * Executes the given taint queries using the provided analyzer.
 */
export async function executeTaintQuery({ analyzer }: BasicQueryData, queries: readonly TaintQuery[]): Promise<TaintQueryResult<AllPredefinedTaintAnalysisNames>> {
	const flattened = queries.flatMap(q => q.defs);
	const start = Date.now();

	if(flattened.length === 0) {
		log.warn('Missing taint query definition');
		return {
			results: new Map(),
			'.meta': {
				timing: Date.now() - start
			},
		};
	}

	const [firstDef, ...restDefs] = flattened;
	const analysis = analyzer
		.taint<AllPredefinedTaintAnalysisNames>()
		.addPredefined(firstDef);

	for(const def of restDefs) {
		analysis.addPredefined(def);
	}

	return {
		results: await analysis.run(),
		'.meta': {
			timing: Date.now() - start
		},
	};
}
