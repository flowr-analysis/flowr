import { log } from '../../../util/log';
import type {
	CallGraphQuery,
	CallGraphQueryResult
} from './call-graph-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { CallGraph } from '../../../dataflow/call-graph/call-graph';


export function executeCallGraphQuery({ dataflow: { graph } }: BasicQueryData, queries: readonly CallGraphQuery[]): CallGraphQueryResult {
	if(queries.length !== 1) {
		log.warn('The dataflow cluster query expects only up to one query, but got', queries.length);
	}

	const start = Date.now();
	const cg = CallGraph.create(graph);
	return {
		'.meta': {
			timing: Date.now() - start
		},
		cg
	};
}
