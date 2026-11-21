import type { Guards } from './database';

/**
 * The formals of a contract in a stable order: those of the signature a row shows, then those the database declares, then any
 * other the contract speaks of, as a stated signature may miss some (`commandArgs` is stated as `(...)`), so none is dropped
 * and each keeps its hue wherever it shows.
 */
export function contractFormals(this: void, shown: readonly string[], declared: readonly string[], [, claims, , , , required = [], , named = []]: Guards): string[] {
	return [...new Set([...shown, ...declared, ...required, ...claims.map(([formal]) => formal), ...named])];
}

/** The formals of `formals` the contract speaks of, in that order. */
export function spokenOf(this: void, [, claims, , , , required = [], , named = []]: Guards, formals: readonly string[]): string[] {
	const spoken = new Set([...required, ...claims.map(([formal]) => formal), ...named]);
	return formals.filter(f => spoken.has(f));
}
