import type { LineageQuery, LineageQueryResult } from './lineage-query-format';
import { log } from '../../../util/log';
import { getLineage } from '../../../cli/repl/commands/repl-lineage';
import type { BasicQueryData } from '../../base-query-format';

/**
 *
 */
export async function executeLineageQuery({ analyzer }: BasicQueryData, queries: readonly LineageQuery[]): Promise<LineageQueryResult> {
	const start = Date.now();
	const result: LineageQueryResult['lineages'] = {};
	for(const { criterion } of queries) {
		if(result[criterion]) {
			log.warn('Duplicate criterion in lineage query:', criterion);
		}
		result[criterion] = getLineage(criterion, (await analyzer.dataflow()).graph, (await analyzer.normalize()).idMap);
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		lineages: result
	};
}
