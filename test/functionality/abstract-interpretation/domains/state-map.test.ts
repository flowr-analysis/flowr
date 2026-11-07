import { assert, describe, test } from 'vitest';
import { StateMap } from '../../../../src/abstract-interpretation/domains/state-map';
import { IntervalDomain } from '../../../../src/abstract-interpretation/domains/interval-domain';
import { StateAbstractDomain } from '../../../../src/abstract-interpretation/domains/state-abstract-domain';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

type Value = IntervalDomain;

/** a deterministic stream of numbers, so a failing run can be repeated */
function numbers(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1103515245 + 12345) % 2147483648;
		return state;
	};
}

function same(map: StateMap<Value>, reference: ReadonlyMap<NodeId, Value>): void {
	assert.deepStrictEqual([...map.entries()], [...reference.entries()]);
	assert.strictEqual(map.size, reference.size);
	assert.strictEqual(map.bottoms, [...reference.values()].filter(v => v.isBottom()).length);
	for(let key = 0; key < 40; key++) {
		assert.strictEqual(map.get(key), reference.get(key));
		assert.strictEqual(map.has(key), reference.has(key));
	}
}

describe('State Map', () => {
	test.each([1, 2, 3, 4, 5])('behaves like a copied map (seed %d)', seed => {
		const next = numbers(seed);
		const values: Value[] = [IntervalDomain.bottom(), ...Array.from({ length: 5 }, (_, i) => new IntervalDomain([i, i + 1]))];
		/* every map is checked against a plain map that was copied and changed the same way */
		const maps: [StateMap<Value>, Map<NodeId, Value>][] = [[StateMap.of<Value>([]), new Map<NodeId, Value>()]];
		for(let step = 0; step < 3000; step++) {
			const at = next() % maps.length;
			const [map, reference] = maps[at];
			const key = next() % 40;
			switch(next() % 4) {
				case 0:
				case 1: {
					const value = values[next() % values.length];
					map.set(key, value);
					reference.set(key, value);
					break;
				}
				case 2:
					assert.strictEqual(map.delete(key), reference.delete(key));
					break;
				default:
					maps.push([map.fork(), new Map(reference)]);
					if(maps.length > 8) {
						maps.splice(next() % maps.length, 1);
					}
			}
			for(const [m, r] of maps) {
				same(m, r);
			}
		}
	});
	test('a state collapses on a Bottom entry once copied', () => {
		const state = new StateAbstractDomain<Value>(new Map([[1, new IntervalDomain([1, 2])]]), IntervalDomain.top());
		state.set(2, IntervalDomain.bottom());
		assert.isFalse(state.isBottom());
		assert.isTrue(state.create(state.value).isBottom());
		state.remove(2);
		assert.isFalse(state.create(state.value).isBottom());
	});
	test('states sharing their entries compare on what they changed', () => {
		const state = new StateAbstractDomain(new Map([[1, new IntervalDomain([1, 2])], [2, new IntervalDomain([3, 4])]]), IntervalDomain.top());
		const copy = state.create(state.value);
		assert.isTrue(state.equals(copy));
		copy.set(2, new IntervalDomain([3, 5]));
		assert.isFalse(state.equals(copy));
		assert.isTrue(state.leq(copy));
		assert.isFalse(copy.leq(state));
		copy.set(2, new IntervalDomain([3, 4]));
		assert.isTrue(state.equals(copy));
	});
});
