import { assert, describe, test } from 'vitest';
import { bakeRoutine, nameArgumentAt, placeOf, routineNames, sourceUrl, unbakeRoutine } from '../../../scripts/playground/native-links';
import type { SigNativeRoutineInfo } from '../../../src/project/sigdb/schema';

describe('Native routines in the playground', () => {
	const fill: SigNativeRoutineInfo = { name: 'fill', iface: '.Call', lang: 'c', file: 'src/nat.c', line: 26, column: 6, endLine: 31, rNames: ['C_fill'] };

	test('a routine survives being baked into the page', () => {
		assert.deepStrictEqual(unbakeRoutine(bakeRoutine(fill)), fill);
		assert.deepStrictEqual(unbakeRoutine(bakeRoutine({ name: 'ghost' })), { name: 'ghost' });
	});

	test('the first argument of a foreign function call names a routine, a later one does not', () => {
		assert.deepInclude(nameArgumentAt('f <- function(x) .Call(C_fi', 27), { call: '.Call', written: 'C_fi', quoted: false });
		assert.deepInclude(nameArgumentAt('.C("dr", n = 1L, PACKAGE = "nat")', 6), { call: '.C', written: 'dr', quoted: true, pkg: 'nat' });
		assert.isUndefined(nameArgumentAt('.Call(C_fill, x', 15));
		assert.isUndefined(nameArgumentAt('sum(x', 5));
	});

	test('a symbol completes to the R names, a string to the registered name', () => {
		assert.deepStrictEqual(routineNames([fill], false).map(n => n.label), ['C_fill']);
		assert.deepStrictEqual(routineNames([fill], true).map(n => n.label), ['fill']);
		assert.strictEqual(placeOf(fill), 'src/nat.c:26');
	});

	test('the source opens on CRAN\'s mirror at the lines of the definition', () => {
		assert.strictEqual(sourceUrl('nat', '1.0', fill), 'https://github.com/cran/nat/blob/1.0/src/nat.c#L26-L31');
		assert.strictEqual(sourceUrl('nat', undefined, { name: 'f', file: 'src/f.c' }), 'https://github.com/cran/nat/blob/HEAD/src/f.c');
		assert.isUndefined(sourceUrl('nat', '1.0', { name: 'f' }));
	});
});
