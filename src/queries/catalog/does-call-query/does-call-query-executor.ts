import type { DoesCallQuery, DoesCallQueryResult } from './does-call-query-format';
import type { BasicQueryData } from '../../base-query-format';

/**
 * Execute does call queries on the given analyzer.
 */
export async function executeDoesCallQuery({ analyzer }: BasicQueryData, queries: readonly DoesCallQuery[]): Promise<DoesCallQueryResult> {
	const start = Date.now();
	// TODO
	return {
		'.meta': {
			timing: Date.now() - start
		},
		results: {}
	};
}
