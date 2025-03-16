import { assert, describe, test } from 'vitest';
import type { ColNamesDomain, IntervalDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { ColNamesBottom, ColNamesTop, IntervalBottom, IntervalTop, joinColNames, joinInterval, leqColNames, leqInterval, meetColNames, meetInterval, subtractColNames } from '../../../../src/abstract-interpretation/data-frame/domain';

describe('Data Frame Domain', () => {
	describe('Column Names Domain', () => {
		const toSet = (value: ColNamesDomain) => value === ColNamesTop ? value : new Set(value);
		const check = (X1: ColNamesDomain, X2: ColNamesDomain, leq: boolean, join: ColNamesDomain, meet: ColNamesDomain, difference: ColNamesDomain) => {
			test(`${JSON.stringify(X1)} ⊑ ${JSON.stringify(X2)}`, () => {
				assert.strictEqual(leqColNames(X1, X2), leq);
			});
			test(`${JSON.stringify(X1)} ⊔ ${JSON.stringify(X2)}`, () => {
				assert.deepStrictEqual(toSet(joinColNames(X1, X2)), toSet(join));
			});
			test(`${JSON.stringify(X1)} ⊓ ${JSON.stringify(X2)}`, () => {
				assert.deepStrictEqual(toSet(meetColNames(X1, X2)), toSet(meet));
			});
			test(`${JSON.stringify(X1)} ∖ ${JSON.stringify(X2)}`, () => {
				assert.deepStrictEqual(toSet(subtractColNames(X1, X2)), toSet(difference));
			});
		};
		check(ColNamesBottom, ColNamesBottom, true, ColNamesBottom, ColNamesBottom, ColNamesBottom);
		check(ColNamesTop, ColNamesTop, true, ColNamesTop, ColNamesTop, ColNamesBottom);
		check(ColNamesBottom, ColNamesTop, true, ColNamesTop, ColNamesBottom, ColNamesBottom);
		check(ColNamesTop, ColNamesBottom, false, ColNamesTop, ColNamesBottom, ColNamesTop);
		check(ColNamesBottom, ['id', 'age'], true, ['id', 'age'], ColNamesBottom, ColNamesBottom);
		check(['id', 'age'], ColNamesBottom, false, ['id', 'age'], ColNamesBottom, ['id', 'age']);
		check(['id', 'age'], ['id', 'age'], true, ['id', 'age'], ['id', 'age'], ColNamesBottom);
		check(['id', 'age'], ['id', 'age', 'score'], true, ['id', 'age', 'score'], ['id', 'age'], ColNamesBottom);
		check(['id', 'age', 'score'], ['id', 'age'], false, ['id', 'age', 'score'], ['id', 'age'], ['score']);
		check(['id', 'age', 'score'], ['id', 'category'], false, ['id', 'age', 'score', 'category'], ['id'], ['age', 'score']);
		check(['id', 'category'], ['id', 'age', 'score'], false, ['id', 'age', 'score', 'category'], ['id'], ['category']);
		check(['id', 'age'], ColNamesTop, true, ColNamesTop, ['id', 'age'], ColNamesBottom);
		check(ColNamesTop, ['id', 'age'], false, ColNamesTop, ['id', 'age'], ColNamesTop);
	});

	describe('Interval Domain', () => {
		const check = (X1: IntervalDomain, X2: IntervalDomain, leq: boolean, join: IntervalDomain, meet: IntervalDomain) => {
			test(`${JSON.stringify(X1)} ⊑ ${JSON.stringify(X2)}`, () => {
				assert.strictEqual(leqInterval(X1, X2), leq);
			});
			test(`${JSON.stringify(X1)} ⊔ ${JSON.stringify(X2)}`, () => {
				assert.deepStrictEqual(joinInterval(X1, X2), join);
			});
			test(`${JSON.stringify(X1)} ⊓ ${JSON.stringify(X2)}`, () => {
				assert.deepStrictEqual(meetInterval(X1, X2), meet);
			});
		};
		check(IntervalBottom, IntervalBottom, true, IntervalBottom, IntervalBottom);
		check(IntervalTop, IntervalTop, true, IntervalTop, IntervalTop);
		check(IntervalBottom, IntervalTop, true, IntervalTop, IntervalBottom);
		check(IntervalTop, IntervalBottom, false, IntervalTop, IntervalBottom);
		check(IntervalBottom, [2, 2], true, [2, 2], IntervalBottom);
		check([2, 2], IntervalBottom, false, [2, 2], IntervalBottom);
		check(IntervalBottom, [2, 8], true, [2, 8], IntervalBottom);
		check([2, 8], IntervalBottom, false, [2, 8], IntervalBottom);
		check([2, 8], [0, 4], false, [0, 8], [2, 4]);
		check([0, 4], [2, 8], false, [0, 8], [2, 4]);
		check([2, 8], [4, 12], false, [2, 12], [4, 8]);
		check([4, 12], [2, 8], false, [2, 12], [4, 8]);
		check([2, 8], [8, Infinity], false, [2, Infinity], [8, 8]);
		check([8, Infinity], [2, 8], false, [2, Infinity], [8, 8]);
		check([2, 8], [2, 4], false, [2, 8], [2, 4]);
		check([2, 4], [2, 8], true, [2, 8], [2, 4]);
		check([2, 8], [2, 2], false, [2, 8], [2, 2]);
		check([2, 2], [2, 8], true, [2, 8], [2, 2]);
		check([2, 8], [0, 0], false, [0, 8], IntervalBottom);
		check([0, 0], [2, 8], false, [0, 8], IntervalBottom);
		check([2, 8], [10, 12], false, [2, 12], IntervalBottom);
		check([10, 12], [2, 8], false, [2, 12], IntervalBottom);
		check([0, 0], [12, Infinity], false, IntervalTop, IntervalBottom);
		check([12, Infinity], [0, 0], false, IntervalTop, IntervalBottom);
		check([4, Infinity], [12, Infinity], false, [4, Infinity], [12, Infinity]);
		check([12, Infinity], [4, Infinity], true, [4, Infinity], [12, Infinity]);
		check([2, 8], IntervalTop, true, IntervalTop, [2, 8]);
		check(IntervalTop, [2, 8], false, IntervalTop, [2, 8]);
		check([12, Infinity], IntervalTop, true, IntervalTop, [12, Infinity]);
		check(IntervalTop, [12, Infinity], false, IntervalTop, [12, Infinity]);
	});
});
