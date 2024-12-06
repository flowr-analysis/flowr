import { RNumberPool, RStringPool } from '../../_helper/provider';
import { boolean2ts, isBoolean, number2ts, string2ts, ts2r } from '../../../../src/r-bridge/lang-4.x/convert-values';
import { describe, assert, test } from 'vitest';

describe('Bidirectional Value Translation', () => {
	describe('TS value to R', () => {
		test('undefined', () => {
			assert.equal(ts2r(undefined), 'NA');
		});
		test('null', () => {
			assert.equal(ts2r(null), 'NULL');
		});
		test('booleans', () => {
			assert.equal(ts2r(true), 'TRUE');
			assert.equal(ts2r(false), 'FALSE');
		});
		test('numbers', () => {
			assert.equal(ts2r(1), '1');
			assert.equal(ts2r(1.1), '1.1');
		});
		test('Infinity and NaN', () => {
			assert.equal(ts2r(Infinity), 'Inf');
			assert.equal(ts2r(10 ** 1000), 'Inf');
			assert.equal(ts2r(NaN), 'NA');
			assert.equal(ts2r(Math.sqrt(-1)), 'NA');
		});
		test('strings', () => {
			assert.equal(ts2r(''), '""', 'empty string');
			assert.equal(ts2r('abc'), '"abc"');
		});
		test('arrays', () => {
			assert.equal(ts2r([]), 'c()', 'empty array');
			assert.equal(ts2r([1, 2, 3]), 'c(1, 2, 3)');
		});
		test('objects', () => {
			assert.equal(ts2r({}), 'list()', 'empty object');
			assert.equal(ts2r({ a: 1, b: 2 }), 'list(a = 1, b = 2)');
			assert.equal(ts2r({ a: 1, b: { c: 2, d: 3 } }), 'list(a = 1, b = list(c = 2, d = 3))');
		});
		test('error for unknown conversions', () => {
			assert.throws(() => ts2r(() => 1), Error, undefined, 'function');
		});
	});
	describe('R value to TS', () => {
		describe('booleans', () => {
			describe('isBoolean', () => {
				test('identify booleans', () => {
					assert.isTrue(isBoolean('TRUE'));
					assert.isTrue(isBoolean('FALSE'));
				});
				test('reject lowercase variants', () => {
					// R is case-sensitive
					assert.isFalse(isBoolean('true'));
					assert.isFalse(isBoolean('false'));
				});
				test('reject numbers', () => {
					// R is case-sensitive
					assert.isFalse(isBoolean('0'));
					assert.isFalse(isBoolean('1'));
				});
				test('reject others', () => {
					// R is case-sensitive
					assert.isFalse(isBoolean('boolean'));
					assert.isFalse(isBoolean('x'));
				});
			});
			describe('boolean2ts', () => {
				test('convert positive', () => {
					assert.isTrue(boolean2ts('TRUE'));
					assert.isFalse(boolean2ts('FALSE'));
				});
				test('throw for others', () => {
					assert.throw(() => boolean2ts('true'), Error);
					assert.throw(() => boolean2ts('false'), Error);
					assert.throw(() => boolean2ts('0'), Error);
					assert.throw(() => boolean2ts('1'), Error);
					assert.throw(() => boolean2ts('boolean'), Error);
					assert.throw(() => boolean2ts('x'), Error);
				});
			});
		});
		describe('numbers', () => {
			for(const number of RNumberPool) {
				test(`${number.str} => ${number.val.num}`, () => {
					assert.deepStrictEqual(number2ts(number.str), number.val);
				});
			}
		});
		describe('strings', () => {
			test('deny string which is too short to have both quotes', () => {
				assert.throws(() => string2ts(''), Error);
				assert.throws(() => string2ts('"'), Error);
			});
			test('deny wrongly quoted strings', () => {
				assert.throws(() => string2ts('abc'), Error);
			});
			for(const string of RStringPool) {
				test(`${string.str} => ${string.val.str}`, () => {
					assert.deepStrictEqual(string2ts(string.str), string.val);
				});
			}
		});
	});
});
