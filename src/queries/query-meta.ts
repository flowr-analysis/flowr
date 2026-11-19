import type { BaseQueryResult } from './base-query-format';
import { log } from '../util/log';

/** The `.meta` of a result whose computation started at `start` (a `Date.now()` value) */
export function metaSince(start: number): BaseQueryResult {
	return { '.meta': { timing: Date.now() - start } };
}

/** Warns unless a query type that is answered once per request got exactly one query, `name` starts the warning */
export function warnUnlessSingleQuery(name: string, queries: readonly unknown[]): void {
	if(queries.length !== 1) {
		log.warn(`${name} query expects only up to one query, but got`, queries.length);
	}
}
