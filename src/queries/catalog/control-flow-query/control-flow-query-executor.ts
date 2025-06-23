import { log } from '../../../util/log';
import type { ControlFlowQuery, ControlFlowQueryResult } from './control-flow-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { extractCfg } from '../../../control-flow/extract-cfg';


export function executeControlFlowQuery({ dataflow: { graph }, ast, config }: BasicQueryData, queries: readonly ControlFlowQuery[]): ControlFlowQueryResult {
	if(queries.length !== 1) {
		log.warn('The control flow query expects only up to one query, but got', queries.length);
	}

	const query = queries[0];

	const start = Date.now();
	const controlFlow = extractCfg(ast, config, graph, query.config?.simplificationPasses);
	return {
		'.meta': {
			timing: Date.now() - start
		},
		controlFlow
	};
}
