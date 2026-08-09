import { describe, test, assert } from 'vitest';
import { BiMap } from '../../../src/util/collections/bimap';

describe('BiMap', () => {
	const a = { v: 'a' };
	const b = { v: 'b' };

	test('resolves both directions', () => {
		const map = new BiMap<string, { v: string }>([['x', a], ['y', b]]);
		assert.strictEqual(map.get('x'), a);
		assert.strictEqual(map.getKey(a), 'x');
		assert.strictEqual(map.getKey(b), 'y');
		assert.isTrue(map.hasValue(a));
		assert.isFalse(map.hasValue({ v: 'a' }));
	});

	// the reverse direction is only built once someone asks for it, so it has to see writes from before that
	test('reverse lookups see writes made before and after the first one', () => {
		const map = new BiMap<string, { v: string }>();
		map.set('x', a);
		assert.strictEqual(map.getKey(a), 'x');
		map.set('y', b);
		assert.strictEqual(map.getKey(b), 'y');
		assert.strictEqual(map.getKey(a), 'x');
	});

	test('delete and clear drop the reverse entry too', () => {
		const map = new BiMap<string, { v: string }>([['x', a], ['y', b]]);
		assert.isTrue(map.delete('x'));
		assert.isUndefined(map.getKey(a));
		assert.strictEqual(map.getKey(b), 'y');
		assert.strictEqual(map.size, 1);
		map.clear();
		assert.isUndefined(map.getKey(b));
		assert.strictEqual(map.size, 0);
	});

	// the eager variant must answer exactly like the lazy one, it only fills the reverse direction sooner
	test('eager and lazy agree', () => {
		for(const mode of ['lazy', 'eager'] as const) {
			const map = new BiMap<string, { v: string }>([['x', a]], mode);
			map.set('y', b);
			assert.strictEqual(map.getKey(a), 'x', mode);
			assert.strictEqual(map.getKey(b), 'y', mode);
			assert.isTrue(map.hasValue(b), mode);
			map.delete('y');
			assert.isUndefined(map.getKey(b), mode);
			map.clear();
			assert.isUndefined(map.getKey(a), mode);
			map.set('z', a);
			assert.strictEqual(map.getKey(a), 'z', mode);
		}
	});

	test('a later key for the same value wins', () => {
		const map = new BiMap<string, { v: string }>();
		map.set('x', a);
		map.set('y', a);
		assert.strictEqual(map.getKey(a), 'y');
	});
});
