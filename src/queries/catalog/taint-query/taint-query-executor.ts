import { log } from '../../../util/log';
import type { BasicQueryData } from '../../base-query-format';
import type { TaintQuery, TaintQueryResult } from './taint-query-format';
import type {
	AllPredefinedTaintAnalyses,
} from '../../../taint-analysis/builder/taint-analysis';

/**
 * Executes the given taint queries using the provided analyzer.
 */
export async function executeTaintQuery({ analyzer }: BasicQueryData, queries: readonly TaintQuery[]): Promise<TaintQueryResult> {
	const flattened = queries.flatMap(q => q.defs);

	if(flattened.length == 0) {
		log.warn('Missing taint query definition');
	}

	const start = Date.now();
	const analysis = analyzer.taint() as unknown as AllPredefinedTaintAnalyses;
	for(const def of flattened) {
		analysis.addPredefined(def);
	}

	const visitors = await analysis.run();
	const results = new Map(
		Array.from(visitors, ([k, r]) => [k, r])
	);

	return {
		results: results,
		'.meta': {
			timing: Date.now() - start
		},
	};
}
