import { log } from '../../../util/log';
import type { ProjectQuery, ProjectQueryResult } from './project-query-format';
import type { BasicQueryData } from '../../base-query-format';

export function executeProjectQuery({ dataflow }: BasicQueryData, queries: readonly ProjectQuery[]): ProjectQueryResult {
	if(queries.length !== 1) {
		log.warn('Project query expects only up to one query, but got', queries.length);
	}
	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		files: dataflow.graph.sourced
	};
}
