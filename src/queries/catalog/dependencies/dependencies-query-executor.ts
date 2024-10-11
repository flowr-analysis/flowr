import type { BasicQueryData } from '../../query';
import type { DependenciesQuery, DependenciesQueryResult } from './dependencies-query-format';

export function executeDependenciesQuery({ ast, graph }: BasicQueryData, queries: readonly DependenciesQuery[]): DependenciesQueryResult {
	const now = Date.now();
	// TODO execute the query
	return {
		'.meta': {
			timing: Date.now() - now
		}
	};
}
