import { assert, describe, test } from 'vitest';
import { Monoid } from '../../../src/util/monoid';
import { Relation } from '../../../src/util/collections/relation';
import { AmbientAccess } from '../../../src/dataflow/graph/ambient-access';

describe('Monoids', () => {
	function lawsHold<T>(name: string, monoid: Monoid<T>, [a, b, c]: readonly [T, T, T], shown: (t: T) => unknown): void {
		describe(name, () => {
			test('empty changes nothing', () => {
				assert.deepStrictEqual(shown(monoid.concat(a, monoid.empty)), shown(a));
				assert.deepStrictEqual(shown(monoid.concat(monoid.empty, a)), shown(a));
			});
			test('concat is associative', () => {
				assert.deepStrictEqual(shown(monoid.concat(monoid.concat(a, b), c)), shown(monoid.concat(a, monoid.concat(b, c))));
			});
			test('folding agrees with concat', () => {
				assert.deepStrictEqual(shown(Monoid.fold(monoid, [a, b, c])), shown(monoid.concat(monoid.concat(a, b), c)));
				assert.deepStrictEqual(shown(Monoid.fold(monoid, [])), shown(monoid.empty));
			});
		});
	}

	const pairs = (r: Relation<string, number>) => [...r].map(([k, v]) => [k, [...v].sort()]).sort();
	lawsHold('Relation', Relation.monoid<string, number>(), [
		Relation.fromPairs([['x', 1], ['y', 2]]), Relation.fromPairs([['x', 3]]), Relation.fromPairs([['z', 1], ['y', 2]])
	], pairs);
	lawsHold('any', Monoid.any, [true, false, false], b => b);
	lawsHold('set', Monoid.set<number>(), [new Set([1]), new Set([1, 2]), new Set([3])], s => [...s].sort());
	lawsHold('AmbientAccess', AmbientAccess.monoid, [
		AmbientAccess.ofCall(1, { reads: ['#rng'], assumed: ['#options'] }),
		AmbientAccess.ofCall(2, { writes: ['#options'] }),
		{ ...AmbientAccess.ofCall(3, { assumed: ['#sink'], local: ['#wd'] }), draws: new Set([3]) }
	], a => ({ ...AmbientAccess.names(a), draws: [...a.draws] }));

	test('a write outranks what is only assumed, whoever comes first', () => {
		const assumes = AmbientAccess.ofCall(1, { assumed: ['#rng'] });
		const writes = AmbientAccess.ofCall(2, { writes: ['#rng'] });
		for(const both of [AmbientAccess.monoid.concat(assumes, writes), AmbientAccess.monoid.concat(writes, assumes)]) {
			assert.isFalse(both.assumed.has('#rng'));
			assert.deepStrictEqual(both.writes.get('#rng'), new Set([2]));
		}
	});
	test('a union keeps the only relation holding anything', () => {
		const only = Relation.fromPairs([['x', 1]]);
		assert.strictEqual(Relation.unionAll([Relation.empty(), only]), only);
	});
	test('foldMap maps before it combines', () => {
		assert.isTrue(Monoid.foldMap(Monoid.any, [1, 2], n => n > 1));
		assert.isFalse(Monoid.foldMap(Monoid.any, [1, 2], n => n > 2));
	});
});
