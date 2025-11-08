import { log } from '../../../util/log';
import type { ProjectQuery, ProjectQueryResult } from './project-query-format';
import type { BasicQueryData } from '../../base-query-format';

/**
 * Executes the given project queries.
 */
export async function executeProjectQuery({ analyzer }: BasicQueryData, queries: readonly ProjectQuery[]): Promise<ProjectQueryResult> {
	if(queries.length !== 1) {
		log.warn('Project query expects only up to one query, but got', queries.length);
	}
	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		files: (await analyzer.dataflow()).graph.sourced
	};
}
