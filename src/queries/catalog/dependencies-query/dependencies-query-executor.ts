import type { BasicQueryData } from '../../query';
import type { DependenciesQuery, DependenciesQueryResult } from './dependencies-query-format';

export function executeDependenciesQuery({ ast, graph }: BasicQueryData, queries: readonly DependenciesQuery[]): DependenciesQueryResult {
	const now = Date.now();
	return {
		'.meta': {
			timing: Date.now() - now
		}
	};
}
