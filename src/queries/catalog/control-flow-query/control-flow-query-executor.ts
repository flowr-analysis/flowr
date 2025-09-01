import { log } from '../../../util/log';
import type { ControlFlowQuery, ControlFlowQueryResult } from './control-flow-query-format';
import type { BasicQueryData } from '../../base-query-format';


export async function executeControlFlowQuery({ input }: BasicQueryData, queries: readonly ControlFlowQuery[]): Promise<ControlFlowQueryResult> {
	if(queries.length !== 1) {
		log.warn('The control flow query expects only up to one query, but got', queries.length);
	}

	const query = queries[0];

	const start = Date.now();
	const controlFlow = await input.controlFlow(query.config?.simplificationPasses, true);
	return {
		'.meta': {
			timing: Date.now() - start
		},
		controlFlow
	};
}
