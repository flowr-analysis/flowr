import type { BaseQueryResult } from './base-query-format';

/** The `.meta` of a result whose computation started at `start` (a `Date.now()` value) */
export function metaSince(start: number): BaseQueryResult {
	return { '.meta': { timing: Date.now() - start } };
}
