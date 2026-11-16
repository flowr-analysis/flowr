/*
 * How a condition of a contract groups, with nothing of flowR but a collection helper, so the pages showing contracts can use it as well.
 */
import { uniqueArrayMerge } from '../../../util/collections/arrays';

/** The parts of `text` separated by `separator` outside of any parentheses, brackets, braces, or strings. */
export function splitTopLevel(this: void, text: string, separator: string): string[] {
	const parts: string[] = [];
	let depth = 0, quote: string | undefined, start = 0;
	for(let i = 0; i < text.length; i++) {
		const c = text[i];
		if(quote !== undefined) {
			quote = c === '\\' ? (i++, quote) : c === quote ? undefined : quote;
		} else if(c === '"' || c === "'" || c === '`') {
			quote = c;
		} else if('([{'.includes(c)) {
			depth++;
		} else if(')]}'.includes(c)) {
			depth--;
		} else if(depth === 0 && text.startsWith(separator, i)) {
			parts.push(text.slice(start, i));
			start = i + separator.length;
			i += separator.length - 1;
		}
	}
	return [...parts, text.slice(start)];
}

/** the connectives a condition is written with, from the one binding loosest */
const Connectives = [' and ', ' unless ', ' || ', ' && '] as const;

/** `text`, in parentheses if it has a connective outside of any other than the one it is joined by, so the two never mix */
function enclosed(this: void, text: string, within: typeof Connectives[number]): string {
	return Connectives.some(c => c !== within && splitTopLevel(text, c).length > 1) ? `(${text})` : text;
}

/**
 * The condition with its grouping made explicit, so no reader has to know how `and`, `unless`, `||`, and `&&` bind:
 * `a && b || c unless d && e` reads as `((a && b) || c) unless (d && e)`. A connective binds tighter the later it is in {@link Connectives},
 * and a case `if (w): c` keeps its condition `w` and groups what holds then.
 */
export function grouped(this: void, text: string): string {
	const [head, ...rest] = /^if \(/.test(text) ? splitTopLevel(text, ': ') : [text];
	if(rest.length > 0) {
		return `${head}: ${grouped(rest.join(': '))}`;
	}
	for(const connective of Connectives) {
		const parts = splitTopLevel(text, connective);
		if(parts.length > 1) {
			return parts.map(part => enclosed(grouped(part), connective)).join(connective);
		}
	}
	return text;
}

/** The conditions joined by `&&`, those that would mix with it in parentheses. */
export function allOf(this: void, conditions: readonly string[]): string {
	return conditions.map(c => enclosed(c, ' && ')).join(' && ');
}

/** The formals in groups of those that `links` tie together, each group in the order of `formals` and the groups by their first formal, so what depends on each other reads together. */
export function linkedGroups(this: void, formals: readonly string[], links: readonly (readonly string[])[]): string[][] {
	const groupOf = new Map(formals.map(f => [f, new Set([f])]));
	for(const link of links) {
		const merged = new Set(link.filter(f => groupOf.has(f)).flatMap(f => [...groupOf.get(f) ?? []]));
		merged.forEach(f => groupOf.set(f, merged));
	}
	return formals.filter((f, at) => formals.findIndex(g => groupOf.get(g) === groupOf.get(f)) === at).map(first => formals.filter(f => groupOf.get(first) === groupOf.get(f)));
}

/** The condition and the `||`-joined ways through its outermost `unless`, none if it has no `unless`. */
function escapesOf(this: void, condition: string): [holds: string, escapes: string[]] {
	const [holds, ...unless] = splitTopLevel(bare(condition), ' unless ');
	return [holds, unless.flatMap(u => splitTopLevel(bare(u), ' || '))];
}

/** `condition unless unless`, one `unless` with every way through for a condition that has one of its own: `(a unless b) unless c` reads `a unless b || c`. */
export function withUnless(this: void, condition: string, unless: string): string {
	const [holds, own] = escapesOf(condition);
	const escapes = uniqueArrayMerge(own, splitTopLevel(bare(unless), ' || '));
	return grouped(`${holds} unless ${escapes.join(' || ')}`);
}

/**
 * The ways through that rows of a contract share, so they are said once for all of them: of what two conditions both offer, the ways through
 * that the most rows have times how many they are, none if fewer than two rows have any. A row is the conditions all of which have to hold.
 */
export function sharedEscapes(this: void, rows: readonly (readonly string[])[]): string[] {
	const escapes = rows.map(row => row.map(c => escapesOf(c)[1]));
	/* the candidates are what two conditions both offer, the best one shared by many rows and saying much */
	const offered = escapes.flat().filter(e => e.length > 0);
	let best: string[] = [], score = 0;
	for(let i = 0; i < offered.length; i++) {
		for(let j = i + 1; j < offered.length; j++) {
			const common = offered[i].filter(e => offered[j].includes(e));
			const having = common.length === 0 ? 0 : escapes.filter(row => row.length > 0 && row.every(c => common.every(e => c.includes(e)))).length;
			if(having >= 2 && common.length * having > score) {
				best = common;
				score = common.length * having;
			}
		}
	}
	return best;
}

/** Whether every condition of the row lets the call through by each of the `escapes`. */
export function hasEscapes(this: void, row: readonly string[], escapes: readonly string[]): boolean {
	return escapes.length > 0 && row.length > 0 && row.every(c => escapes.every(e => escapesOf(c)[1].includes(e)));
}

/** The condition without the given ways through its `unless`, without the `unless` if none is left. */
export function withoutEscapes(this: void, condition: string, escapes: readonly string[]): string {
	const [holds, own] = escapesOf(condition);
	const rest = own.filter(e => !escapes.includes(e));
	return own.length === 0 ? condition : rest.length === 0 ? grouped(holds) : grouped(`${holds} unless ${rest.join(' || ')}`);
}

/** the comparisons a relation is written with, each with the one that reads the same with its sides swapped */
const Mirrored: Readonly<Record<string, string>> = { ' == ': ' == ', ' != ': ' != ', ' <= ': ' >= ', ' >= ': ' <= ', ' < ': ' > ', ' > ': ' < ' };

/** `text` without parentheses around all of it */
function bare(this: void, text: string): string {
	if(!text.startsWith('(') || !text.endsWith(')')) {
		return text;
	}
	let depth = 0, quote: string | undefined;
	for(let i = 0; i < text.length - 1; i++) {
		const c = text[i];
		if(quote !== undefined) {
			quote = c === '\\' ? (i++, quote) : c === quote ? undefined : quote;
		} else if(c === '"' || c === "'" || c === '`') {
			quote = c;
		} else if(c === '(' || c === ')') {
			depth += c === '(' ? 1 : -1;
			if(depth === 0) {
				return text;
			}
		}
	}
	return bare(text.slice(1, -1));
}

/** the same comparison for `a == b` and `b == a`, and for `a <= b` and `b >= a` */
function sameComparison(this: void, holds: string): string {
	for(const [op, mirror] of Object.entries(Mirrored)) {
		const sides = splitTopLevel(holds, op);
		if(sides.length === 2) {
			return sides[0] <= sides[1] ? holds : sides[1] + mirror + sides[0];
		}
	}
	return holds;
}

/**
 * The relations with each comparison once: a comparison that holds unless `u1` and holds unless `u2` holds unless both do,
 * written with what both offer said once, `c || (a1 && a2)` for `c || a1` and `c || a2`, and a comparison stated as well with its sides swapped is the same one.
 */
export function mergedRelations<T extends { readonly holds: string, readonly unless?: string }>(this: void, relations: readonly T[]): T[] {
	const merged = new Map<string, { first: T, unless: (string[] | undefined)[] }>();
	for(const relation of relations) {
		const key = sameComparison(relation.holds);
		const entry = merged.get(key) ?? { first: relation, unless: [] };
		entry.unless.push(relation.unless === undefined || relation.unless === '' ? undefined : splitTopLevel(bare(relation.unless), ' || '));
		merged.set(key, entry);
	}
	return [...merged.values()].map(({ first, unless }) => {
		if(unless.length === 1) {
			return first;
		} else if(unless.includes(undefined)) {
			return { ...first, unless: undefined };
		}
		const offers = unless as string[][];
		const common = offers[0].filter(d => offers.every(u => u.includes(d)));
		const rests = offers.map(u => u.filter(d => !common.includes(d))).filter((rest, at, all) => all.findIndex(r => r.join() === rest.join()) === at);
		const own = rests.some(r => r.length === 0) ? [] : [rests.length === 1 ? rests[0].join(' || ') : `(${allOf(rests.map(r => r.join(' || ')))})`];
		return { ...first, unless: [...common, ...own].join(' || ') };
	});
}
