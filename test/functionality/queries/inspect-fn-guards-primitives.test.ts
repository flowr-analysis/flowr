import { assert, describe, test } from 'vitest';
import { builtInGuards, namesWithGuards } from '../../../src/dataflow/fn/guards/built-in-guards';

/* what the contracts of the primitives of the language state, each checked against R by .scratch/primitives/oracle-lang.R */
describe('Contracts of the language primitives', () => {
	const stated = (name: string) => builtInGuards(name, 'base');

	test('an attribute is named by one string', () => {
		assert.deepStrictEqual(stated('attr')?.formals?.which, { types: ['character'], bounds: { length: [1, 1] } });
		assert.deepStrictEqual(stated('attr<-')?.formals?.which, { types: ['character'], bounds: { length: [1, 1], nchar: [1, null] }, notNA: true });
	});

	test('what an internal generic returns holds only for an unclassed value', () => {
		assert.deepStrictEqual(stated('dim')?.returns, { cases: [{ when: '!is.object(x)', claim: { types: ['NULL', 'integer'], notNA: true, whole: true } }] });
		assert.deepStrictEqual(stated('names')?.returns, { cases: [{ when: '!is.object(x)', claim: { types: ['NULL', 'character'] } }] });
		assert.deepStrictEqual(stated('class')?.returns, { types: ['character'], bounds: { length: [1, null] } });
		assert.strictEqual(stated('invisible')?.passes, 'x');
	});

	test('a replacement function relates the value to what it replaces in', () => {
		assert.deepStrictEqual(stated('dim<-')?.relations?.map(r => [r.holds, r.unless]), [['prod(as.integer(value)) == length(x)', 'is.object(x) || is.null(value)']]);
		assert.deepStrictEqual(stated('names<-')?.relations?.map(r => [r.holds, r.unless]), [['length(value) <= length(x)', 'is.object(x) || is.null(value)']]);
		assert.include(stated('class<-')?.requires, 'is.null(value) || !is.null(x)');
	});

	test('what decides control flow is one value', () => {
		assert.deepStrictEqual(stated('switch')?.formals?.EXPR?.bounds, { length: [1, 1] });
		assert.include(stated('for')?.requires, '!is.function(seq)');
		assert.include(stated('...elt')?.requires, 'trunc(n) <= ...length()');
	});

	test('a primitive stating no more than what it returns is listed', () => {
		const names = new Set(namesWithGuards().map(([pkg, name]) => `${pkg}::${name}`));
		for(const name of ['dim', 'class', 'globalenv', 'interactive', 'attr<-', ':']) {
			assert.isTrue(names.has(`base::${name}`), name);
		}
	});
});
