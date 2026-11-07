import { describe, test } from 'vitest';
import { assert } from 'chai';
import { DemandSolver, FixpointSolver, ReachSummaries, StronglyConnected, unionOfSets } from '../../../src/util/fixpoint';

type Graph = Readonly<Record<string, readonly string[]>>;

function componentsOf(graph: Graph, starts: readonly string[]): string[][] {
	const found: string[][] = [];
	const components = new StronglyConnected<string>(n => graph[n] ?? [], members => found.push([...members].sort()));
	for(const s of starts) {
		components.visit(s);
	}
	return found;
}

describe('Fixpoint', () => {
	describe('StronglyConnected', () => {
		test.each([
			['chain', { a: ['b'], b: ['c'] }, ['a'], [['c'], ['b'], ['a']]],
			['self loop', { a: ['a'] }, ['a'], [['a']]],
			['cycle with tail', { a: ['b'], b: ['c'], c: ['a', 'd'] }, ['a'], [['d'], ['a', 'b', 'c']]],
			['two cycles', { a: ['b'], b: ['a', 'c'], c: ['d'], d: ['c'] }, ['a'], [['c', 'd'], ['a', 'b']]],
			['nested cycles', { a: ['b'], b: ['c', 'a'], c: ['b'] }, ['a'], [['a', 'b', 'c']]],
			['shared callee', { a: ['c'], b: ['c'] }, ['a', 'b'], [['c'], ['a'], ['b']]]
		] as const)('%s', (_, graph: Graph, starts, expected) => {
			assert.deepStrictEqual<readonly (readonly string[])[]>(componentsOf(graph, starts), expected);
		});

		test('asks for the successors of each node once', () => {
			const asked: string[] = [];
			const graph: Graph = { a: ['b', 'c'], b: ['c', 'a'], c: ['a'] };
			const components = new StronglyConnected<string>(n => {
				asked.push(n);
				return graph[n] ?? [];
			}, () => {});
			components.visit('a');
			components.visit('b');
			assert.deepStrictEqual(asked.sort(), ['a', 'b', 'c']);
			assert.isTrue(components.isComplete('c'));
		});

		test('handles deep chains without recursion', () => {
			const n = 100_000;
			let completed = 0;
			new StronglyConnected<number>(i => i < n ? [i + 1] : [], () => completed++).visit(0);
			assert.strictEqual(completed, n + 1);
		});
	});

	describe('ReachSummaries', () => {
		const graph: Graph = { a: ['b'], b: ['c', 'a'], c: ['d'], d: [] };
		const own: Record<string, ReadonlySet<string>> = { a: new Set(['x']), c: new Set(['y']), d: new Set(['z']) };
		test('joins what each node reaches, sharing the value within a cycle', () => {
			const summaries = new ReachSummaries<string, ReadonlySet<string>>(n => graph[n] ?? [], n => own[n], new Set(), unionOfSets);
			assert.deepStrictEqual([...summaries.of('b')].sort(), ['x', 'y', 'z']);
			assert.strictEqual(summaries.of('a'), summaries.of('b'));
			assert.deepStrictEqual([...summaries.of('c')].sort(), ['y', 'z']);
		});
	});

	describe('FixpointSolver', () => {
		/* the length of the longest path, capped at 10 */
		const longest = (graph: Graph, widen?: (a: number, b: number) => number) => new FixpointSolver<string, number>({
			next:       n => graph[n] ?? [],
			transfer:   (n, valueOf) => Math.min(10, Math.max(0, ...(graph[n] ?? []).map(s => valueOf(s) + 1))),
			equals:     (a, b) => a === b,
			initial:    () => 0,
			widen,
			widenAfter: 2,
			budget:     1000,
			exhausted:  () => -1
		});

		test('computes acyclic nodes once', () => {
			const solver = longest({ a: ['b', 'c'], b: ['c'], c: [] });
			assert.deepStrictEqual(['a', 'b', 'c'].map(n => solver.of(n)), [2, 1, 0]);
		});

		test('iterates a cycle to its fixpoint', () => {
			const solver = longest({ a: ['b'], b: ['a', 'c'], c: [] });
			assert.deepStrictEqual(['a', 'b', 'c'].map(n => solver.of(n)), [10, 10, 0]);
		});

		test('widens after the given number of visits', () => {
			const solver = longest({ a: ['b'], b: ['a'] }, (a, b) => b > a ? 10 : b);
			assert.deepStrictEqual([solver.of('a'), solver.of('b')], [10, 10]);
		});

		test('gives up once the budget is spent', () => {
			const solver = new FixpointSolver<string, number>({
				next:      n => n === 'a' ? ['a'] : [],
				transfer:  (n, valueOf) => valueOf(n) + 1,
				equals:    (a, b) => a === b,
				initial:   () => 0,
				budget:    5,
				exhausted: () => -1
			});
			assert.strictEqual(solver.of('a'), -1);
		});
	});

	describe('DemandSolver', () => {
		/* whether every path from a node ends in `end`, assumed true within a cycle: a greatest fixpoint */
		const allEnd = (graph: Graph, rounds = 10) => {
			const computed: string[] = [];
			const solver = new DemandSolver<string, boolean>({
				transfer: (n, valueOf) => {
					computed.push(n);
					const next = graph[n] ?? [];
					return n === 'end' || (next.length > 0 && next.map(valueOf).every(Boolean));
				},
				equals:    (a, b) => a === b,
				initial:   () => true,
				rounds,
				exhausted: () => false
			});
			return { solver, computed };
		};

		test('computes acyclic nodes once', () => {
			const { solver, computed } = allEnd({ a: ['b', 'c'], b: ['end'], c: ['end'] });
			assert.isTrue(solver.of('a'));
			assert.isTrue(solver.of('b'));
			assert.deepStrictEqual(computed, ['a', 'b', 'end', 'c']);
		});

		test('settles a cycle the same from every start', () => {
			const graph: Graph = { a: ['b'], b: ['a', 'c'], c: ['b', 'd'], d: [] };
			for(const start of ['a', 'b', 'c']) {
				const { solver } = allEnd(graph);
				assert.isFalse(solver.of(start), start);
				assert.deepStrictEqual(['a', 'b', 'c', 'd'].map(n => solver.of(n)), [false, false, false, false], start);
			}
		});

		test('keeps the assumption for a cycle that never leaves', () => {
			const { solver } = allEnd({ a: ['b'], b: ['a', 'end'] });
			assert.deepStrictEqual([solver.of('a'), solver.of('b')], [true, true]);
		});

		test('grows a cycle by what a later round reaches', () => {
			/* `a` only asks for `c` once `b` reached 2, and `c` leads back to `a` */
			const asked: string[] = [];
			const solver = new DemandSolver<string, number>({
				transfer: (n, valueOf) => {
					asked.push(n);
					if(n === 'a') {
						const b = valueOf('b');
						return b >= 2 ? valueOf('c') : b;
					}
					return Math.min(n === 'b' ? 2 : 3, valueOf('a') + 1);
				},
				equals:    (a, b) => a === b,
				initial:   () => 0,
				rounds:    10,
				exhausted: () => -1
			});
			assert.deepStrictEqual([solver.of('a'), solver.of('b'), solver.of('c')], [3, 2, 3]);
			assert.strictEqual(asked.filter(n => n === 'c').length, 4);
		});

		test('gives up once the rounds are spent', () => {
			let n = 0;
			const solver = new DemandSolver<string, number>({
				transfer:  (node, valueOf) => valueOf(node) + ++n,
				equals:    (a, b) => a === b,
				initial:   () => 0,
				rounds:    3,
				exhausted: () => -1
			});
			assert.strictEqual(solver.of('x'), -1);
		});
	});
});
