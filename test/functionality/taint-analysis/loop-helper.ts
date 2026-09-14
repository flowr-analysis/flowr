import { test } from 'vitest';
import type { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import type { TaintAnalysisExpectation } from './helper';
import { testTaintAnalysis } from './helper';

export const loopKinds = ['for', 'while', 'repeat'] as const;
export type LoopKind = typeof loopKinds[number];

/**
 * `for`-loop iterables. `1:5` is statically bound, the rest is unbound.
 */
export const forRanges = {
	'known bounds':    '1:5',
	'unknown vector':  'v',
	'unknown range':   '1:n',
	'unknown seq_len': 'seq_len(n)'
} as const;

/**
 * Wraps the given body in the requested kind of loop.
 * @param kind  - The kind of loop (i.e. for, while, repeat)
 * @param body  - The loop body
 * @param cond  - The loop condition (while and repeat loops only)
 * @param range - The iterable of the for-loop, statically bounded by default
 */
export function wrapLoop(kind: LoopKind, body: string, cond = 'cond', range: string = forRanges['known bounds']): string {
	switch(kind) {
		case 'for':    return `for (i in ${range}) {\n${body}\n}`;
		case 'while':  return `while (${cond}) {\n${body}\n}`;
		case 'repeat': return `repeat {\n${body}\nif (${cond}) break\n}`;
	}
}

export interface LoopVariant {
	/** The kind of loop */
	readonly kind:  LoopKind;
	/** For test names */
	readonly label: string;
	/** Wraps a body in the chosen kind of loop; `cond` overrides the while/repeat condition (ignored by `for`). */
	wrap(body: string, cond?: string): string;
}

/**
 * Every loop header a fixpoint scenario runs through: the `for`-loop over each iterable of
 * {@link forRanges} (its bounded and unbounded forms), plus a `while` and a `repeat`. The `kind` is
 * what decides the fixpoint outcome, so callers with per-kind expectations can index them by it.
 */
export function loopVariants(): LoopVariant[] {
	const forVariants: LoopVariant[] = Object.entries(forRanges).map(([bound, range]) => ({
		kind:  'for',
		label: `for ${bound}`,
		wrap:  body => wrapLoop('for', body, 'cond', range)
	}));
	return [
		...forVariants,
		{ kind: 'while',  label: 'while',  wrap: (body, cond = 'cond') => wrapLoop('while', body, cond) },
		{ kind: 'repeat', label: 'repeat', wrap: (body, cond = 'cond') => wrapLoop('repeat', body, cond) }
	];
}

/**
 * Runs `pre; loop { body }; y <- x` through every {@link loopVariants} loop header — including the
 * `for`-loop in both its statically bounded and its unbounded forms — at several widening thresholds,
 * asserting the taint at `y` is `expected` regardless of the header or the threshold.
 * @param analysis   - The taint analysis definition to run
 * @param name       - Test name prefix
 * @param pre        - Statement establishing the pre-loop taint of `x`
 * @param body       - The loop body
 * @param expected   - The expected taint of `x` after the loop
 * @param thresholds - Widening thresholds to assert the fixpoint is invariant
 */
export function testLoopFixpoint(
	analysis: TaintAnalysisDefinition,
	name: string,
	pre: string,
	body: string,
	expected: symbol | undefined,
	thresholds: readonly number[] = [1, 2]
): void {
	for(const variant of loopVariants()) {
		const code = `${pre}\n${variant.wrap(body)}\ny <- x`;
		const criterion = `${code.split('\n').length}@y` as SlicingCriterion;
		const expectation: TaintAnalysisExpectation = { [criterion]: expected };
		for(const threshold of thresholds) {
			test(`${name} [${variant.label}] (threshold=${threshold})`, async() => {
				await testTaintAnalysis(code, analysis, expectation, threshold);
			});
		}
	}
}
