import { assert, describe, test } from 'vitest';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { label } from '../../_helper/label';

describe('Identifier', () => {
	describe('parse', () => {
		/** every case round-trips */
		function testParse(name: string, str: string, expected: Identifier) {
			test(label(name, ['name-normal'], ['other']), () => {
				assert.deepStrictEqual(Identifier.parse(str), expected);
				assert.strictEqual(Identifier.toString(Identifier.parse(str)), str);
			});
		}

		testParse('a plain name', 'x', 'x');
		testParse('a namespaced name', 'pkg::fn', ['fn', 'pkg', false]);
		testParse('an internal one', 'pkg:::fn', ['fn', 'pkg', true]);
		testParse('a backtick-quoted name carrying the separator', 'pkg::`odd::name`', ['`odd::name`', 'pkg', false]);
		testParse('a name of its own with backticks', '`odd name`', '`odd name`');

		test(label('a quoted separator does not separate', ['name-normal'], ['other']), () => {
			assert.strictEqual(Identifier.getName(Identifier.parse('pkg::`odd::name`')), '`odd::name`');
			assert.strictEqual(Identifier.getNamespace(Identifier.parse('pkg::`odd::name`')), 'pkg');
		});
	});
});
