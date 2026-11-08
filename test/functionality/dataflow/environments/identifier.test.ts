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
	describe('undefined-tolerant accessors', () => {
		test('an absent identifier yields undefined instead of throwing', () => {
			assert.isUndefined(Identifier.getName(undefined));
			assert.isUndefined(Identifier.getNamespace(undefined));
			assert.isUndefined(Identifier.accessesInternal(undefined));
			assert.isUndefined(Identifier.toString(undefined));
			assert.isUndefined(Identifier.view(undefined));
		});
		test('stays precise where the identifier is there', () => {
			const ids: Identifier[] = [Identifier.parse('a'), Identifier.parse('pkg::b')];
			assert.deepStrictEqual(ids.map(Identifier.getName), ['a', 'b']);
			assert.deepStrictEqual(ids.map(Identifier.toString), ['a', 'pkg::b']);
		});
	});
	describe('IdentifierView', () => {
		const qualified = Identifier.view(Identifier.parse('pkg:::b'));
		const bare = Identifier.view(Identifier.parse('a'));
		test('exposes the identifier as properties', () => {
			assert.strictEqual(qualified.name, 'b');
			assert.strictEqual(qualified.namespace, 'pkg');
			assert.isTrue(qualified.isInternal);
			assert.isTrue(qualified.isQualified);
			assert.isFalse(qualified.isDotDotDot);
			assert.strictEqual(bare.name, 'a');
			assert.isUndefined(bare.namespace);
			assert.isFalse(bare.isQualified);
			assert.isTrue(Identifier.view(Identifier.parse('...')).isDotDotDot);
		});
		test('serializes back to the plain identifier', () => {
			assert.strictEqual(qualified.toString(), 'pkg:::b');
			assert.strictEqual(JSON.stringify(qualified), JSON.stringify(qualified.raw));
			assert.deepStrictEqual(qualified.raw, Identifier.parse('pkg:::b'));
		});
		test('predicates accept both views and bare identifiers', () => {
			assert.isTrue(Identifier.view(Identifier.parse('b')).matches(qualified));
			assert.isTrue(Identifier.view(Identifier.parse('b')).matches(qualified.raw));
			assert.isFalse(Identifier.view(Identifier.parse('c')).matches(qualified));
			assert.isTrue(qualified.equals(Identifier.parse('pkg:::b')));
			assert.isFalse(qualified.equals(Identifier.parse('pkg::b')));
			assert.isFalse(qualified.equals(bare));
		});
		test('mapping keeps the rest of the identifier', () => {
			assert.strictEqual(qualified.mapName(n => n + '2').toString(), 'pkg:::b2');
			assert.strictEqual(qualified.mapNamespace(n => n + '2').toString(), 'pkg2:::b');
			assert.strictEqual(bare.mapNamespace(n => n + '2').toString(), 'a');
		});
	});
});
