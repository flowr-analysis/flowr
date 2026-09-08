import { test } from 'vitest';
import type { TaintAnalysisDefinition } from '../../../src/taint-analysis/builder/taint-analysis-definition';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import type { TaintAnalysisExpectation } from './helper';
import { testTaintAnalysis } from './helper';

export const loopKinds = ['for', 'while', 'repeat'] as const;
export type LoopKind = typeof loopKinds[number];

/**
 * Wraps the given body in the requested kind of loop.
 * For while and repeat loops, a condition can be specified.
 * @param kind - The kind of loop (i.e. for, while, repeat)
 * @param body - The loop body
 * @param cond - The loop condition (for while and repeat loops only
 */
export function wrapLoop(kind: LoopKind, body: string, cond = 'cond'): string {
	switch(kind) {
		case 'for':    return `for (i in 1:5) {\n${body}\n}`;
		case 'while':  return `while (${cond}) {\n${body}\n}`;
		case 'repeat': return `repeat {\n${body}\nif (${cond}) break\n}`;
	}
}

/**
 * Runs `pre; loop { body }; y <- x` in every loop kind
 * at several widening thresholds and asserts the taint at `y` is `expected`.
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
	for(const kind of loopKinds) {
		const code = `${pre}\n${wrapLoop(kind, body)}\ny <- x`;
		const criterion = `${code.split('\n').length}@y` as SlicingCriterion;
		const expectation: TaintAnalysisExpectation = { [criterion]: expected };
		for(const threshold of thresholds) {
			test(`${name} [${kind}] (threshold=${threshold})`, async() => {
				await testTaintAnalysis(code, analysis, expectation, threshold);
			});
		}
	}
}
