import { assert, describe, test } from 'vitest';
import type { ColNamesDomain, DataFrameDomain, DataFrameStateDomain, IntervalDomain } from '../../../../src/abstract-interpretation/data-frame/domain';
import { ColNamesBottom, ColNamesTop, DataFrameBottom, DataFrameTop, equalColNames, equalDataFrameDomain, equalDataFrameState, equalInterval, IntervalBottom, IntervalTop, joinColNames, joinDataFrames, joinDataFrameStates, joinInterval, leqColNames, leqInterval, meetColNames, meetDataFrames, meetDataFrameStates, meetInterval, subtractColNames } from '../../../../src/abstract-interpretation/data-frame/domain';

describe('Data Frame Domain', () => {
	describe('Column Names Domain', () => {
		const toSet = (value: ColNamesDomain) => value === ColNamesTop ? value : new Set(value);
		const check = (X1: ColNamesDomain, X2: ColNamesDomain, equal: boolean, leq: boolean, join: ColNamesDomain, meet: ColNamesDomain, difference: ColNamesDomain) => {
			test(`${JSON.stringify(X1)} = ${JSON.stringify(X2)}`, () => {
				assert.strictEqual(equalColNames(X1, X2), equal);
			});
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
		check(ColNamesBottom, ColNamesBottom, true, true, ColNamesBottom, ColNamesBottom, ColNamesBottom);
		check(ColNamesTop, ColNamesTop, true, true, ColNamesTop, ColNamesTop, ColNamesBottom);
		check(ColNamesBottom, ColNamesTop, false, true, ColNamesTop, ColNamesBottom, ColNamesBottom);
		check(ColNamesTop, ColNamesBottom, false, false, ColNamesTop, ColNamesBottom, ColNamesTop);
		check(ColNamesBottom, ['id', 'age'], false, true, ['id', 'age'], ColNamesBottom, ColNamesBottom);
		check(['id', 'age'], ColNamesBottom, false, false, ['id', 'age'], ColNamesBottom, ['id', 'age']);
		check(['id', 'age'], ['age', 'id'], true, true, ['id', 'age'], ['id', 'age'], ColNamesBottom);
		check(['id', 'age'], ['id', 'age', 'score'], false, true, ['id', 'age', 'score'], ['id', 'age'], ColNamesBottom);
		check(['id', 'age', 'score'], ['id', 'age'], false, false, ['id', 'age', 'score'], ['id', 'age'], ['score']);
		check(['id', 'age', 'score'], ['id', 'category'], false, false, ['id', 'age', 'score', 'category'], ['id'], ['age', 'score']);
		check(['id', 'category'], ['id', 'age', 'score'], false, false, ['id', 'age', 'score', 'category'], ['id'], ['category']);
		check(['id', 'age'], ColNamesTop, false, true, ColNamesTop, ['id', 'age'], ColNamesBottom);
		check(ColNamesTop, ['id', 'age'], false, false, ColNamesTop, ['id', 'age'], ColNamesTop);
	});

	describe('Interval Domain', () => {
		const check = (X1: IntervalDomain, X2: IntervalDomain, equal: boolean, leq: boolean, join: IntervalDomain, meet: IntervalDomain) => {
			test(`${JSON.stringify(X1)} = ${JSON.stringify(X2)}`, () => {
				assert.strictEqual(equalInterval(X1, X2), equal);
			});
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
		check(IntervalBottom, IntervalBottom, true, true, IntervalBottom, IntervalBottom);
		check(IntervalTop, IntervalTop, true, true, IntervalTop, IntervalTop);
		check(IntervalBottom, IntervalTop, false, true, IntervalTop, IntervalBottom);
		check(IntervalTop, IntervalBottom, false, false, IntervalTop, IntervalBottom);
		check(IntervalBottom, [2, 2], false, true, [2, 2], IntervalBottom);
		check([2, 2], IntervalBottom, false, false, [2, 2], IntervalBottom);
		check(IntervalBottom, [2, 8], false, true, [2, 8], IntervalBottom);
		check([2, 8], IntervalBottom, false, false, [2, 8], IntervalBottom);
		check([2, 8], [2, 8], true, true, [2, 8], [2, 8]);
		check([2, 8], [0, 4], false, false, [0, 8], [2, 4]);
		check([0, 4], [2, 8], false, false, [0, 8], [2, 4]);
		check([2, 8], [4, 12], false, false, [2, 12], [4, 8]);
		check([4, 12], [2, 8], false, false, [2, 12], [4, 8]);
		check([2, 8], [8, Infinity], false, false, [2, Infinity], [8, 8]);
		check([8, Infinity], [2, 8], false, false, [2, Infinity], [8, 8]);
		check([2, 8], [2, 4], false, false, [2, 8], [2, 4]);
		check([2, 4], [2, 8], false, true, [2, 8], [2, 4]);
		check([2, 8], [2, 2], false, false, [2, 8], [2, 2]);
		check([2, 2], [2, 8], false, true, [2, 8], [2, 2]);
		check([2, 8], [0, 0], false, false, [0, 8], IntervalBottom);
		check([0, 0], [2, 8], false, false, [0, 8], IntervalBottom);
		check([2, 8], [10, 12], false, false, [2, 12], IntervalBottom);
		check([10, 12], [2, 8], false, false, [2, 12], IntervalBottom);
		check([0, 0], [12, Infinity], false, false, IntervalTop, IntervalBottom);
		check([12, Infinity], [0, 0], false, false, IntervalTop, IntervalBottom);
		check([4, Infinity], [12, Infinity], false, false, [4, Infinity], [12, Infinity]);
		check([12, Infinity], [4, Infinity], false, true, [4, Infinity], [12, Infinity]);
		check([2, 8], IntervalTop, false, true, IntervalTop, [2, 8]);
		check(IntervalTop, [2, 8], false, false, IntervalTop, [2, 8]);
		check([12, Infinity], IntervalTop, false, true, IntervalTop, [12, Infinity]);
		check(IntervalTop, [12, Infinity], false, false, IntervalTop, [12, Infinity]);
	});

	describe('Data Frame Domain', () => {
		const check = (X1: DataFrameDomain, X2: DataFrameDomain, equal: boolean, join: DataFrameDomain, meet: DataFrameDomain) => {
			test(`${JSON.stringify(X1)} = ${JSON.stringify(X2)}`, () => {
				assert.strictEqual(equalDataFrameDomain(X1, X2), equal);
			});
			test(`${JSON.stringify(X1)} ⊔ ${JSON.stringify(X2)}`, () => {
				const result = joinDataFrames(X1, X2);
				assert.isTrue(equalDataFrameDomain(result, join), `expected domain ${JSON.stringify(result)} to equal domain ${JSON.stringify(join)}`);
			});
			test(`${JSON.stringify(X1)} ⊓ ${JSON.stringify(X2)}`, () => {
				const result = meetDataFrames(X1, X2);
				assert.isTrue(equalDataFrameDomain(result, meet), `expected domain ${JSON.stringify(result)} to equal domain ${JSON.stringify(meet)}`);
			});
		};
		const join = (X1: DataFrameDomain, X2: DataFrameDomain): DataFrameDomain => {
			return { colnames: joinColNames(X1.colnames, X2.colnames), cols: joinInterval(X1.cols, X2.cols), rows: joinInterval(X1.rows, X2.rows) };
		};
		const meet = (X1: DataFrameDomain, X2: DataFrameDomain): DataFrameDomain => {
			return { colnames: meetColNames(X1.colnames, X2.colnames), cols: meetInterval(X1.cols, X2.cols), rows: meetInterval(X1.rows, X2.rows) };
		};
		const domain1: DataFrameDomain = { colnames: ['id', 'name', 'age'], cols: [3, 5], rows: [5, 5] };
		const domain2: DataFrameDomain = { colnames: ['id', 'category'], cols: [2, 2], rows: [0, 6] };

		check(DataFrameBottom, DataFrameBottom, true, DataFrameBottom, DataFrameBottom);
		check(DataFrameTop, DataFrameTop, true, DataFrameTop, DataFrameTop);
		check(DataFrameBottom, DataFrameTop, false, DataFrameTop, DataFrameBottom);
		check(DataFrameTop, DataFrameBottom, false, DataFrameTop, DataFrameBottom);
		check(DataFrameBottom, domain1, false, domain1, DataFrameBottom);
		check(domain1, DataFrameBottom, false, domain1, DataFrameBottom);
		check(domain1, domain1, true, domain1, domain1);
		check(domain1, { ...domain1, colnames: ColNamesTop }, false, { ...domain1, colnames: ColNamesTop }, domain1);
		check({ ...domain1, colnames: ColNamesTop }, domain1, false, { ...domain1, colnames: ColNamesTop }, domain1);
		check(domain1, { ...domain1, cols: IntervalTop }, false, { ...domain1, cols: IntervalTop }, domain1);
		check({ ...domain1, cols: IntervalTop }, domain1, false, { ...domain1, cols: IntervalTop }, domain1);
		check(domain1, { ...domain1, rows: IntervalTop }, false, { ...domain1, rows: IntervalTop }, domain1);
		check({ ...domain1, rows: IntervalTop }, domain1, false, { ...domain1, rows: IntervalTop }, domain1);
		check(domain1, { ...domain1, colnames: ColNamesBottom }, false, domain1, { ...domain1, colnames: ColNamesBottom });
		check({ ...domain1, colnames: ColNamesBottom }, domain1, false, domain1, { ...domain1, colnames: ColNamesBottom });
		check(domain1, { ...domain1, cols: IntervalBottom }, false, domain1, { ...domain1, cols: IntervalBottom });
		check({ ...domain1, cols: IntervalBottom }, domain1, false, domain1, { ...domain1, cols: IntervalBottom });
		check(domain1, { ...domain1, rows: IntervalBottom }, false, domain1, { ...domain1, rows: IntervalBottom });
		check({ ...domain1, rows: IntervalBottom }, domain1, false, domain1, { ...domain1, rows: IntervalBottom });
		check(domain1, domain2, false, join(domain1, domain2), meet(domain1, domain2));
		check(domain2, domain1, false, join(domain2, domain1), meet(domain2, domain1));
		check(DataFrameTop, domain1, false, DataFrameTop, domain1);
		check(domain1, DataFrameTop, false, DataFrameTop, domain1);
	});

	describe('Data Frame State Domain', () => {
		const toString = (state: DataFrameStateDomain) => JSON.stringify(Object.fromEntries(state));
		const check = (R1: DataFrameStateDomain, R2: DataFrameStateDomain, equal: boolean, join: DataFrameStateDomain, meet: DataFrameStateDomain) => {
			test(`${toString(R1)} = ${toString(R2)}`, () => {
				assert.strictEqual(equalDataFrameState(R1, R2), equal);
			});
			test(`${toString(R1)} ⊔ ${toString(R2)}`, () => {
				const result = joinDataFrameStates(R1, R2);
				assert.isTrue(equalDataFrameState(result, join), `expected state ${toString(result)} to equal state ${toString(join)}`);
			});
			test(`${toString(R1)} ⊓ ${toString(R2)}`, () => {
				const result = meetDataFrameStates(R1, R2);
				assert.isTrue(equalDataFrameState(result, meet), `expected state ${toString(result)} to equal state ${toString(meet)}`);
			});
		};
		const domain1: DataFrameDomain = { colnames: ['id', 'name', 'age'], cols: [3, 5], rows: [5, 5] };
		const domain2: DataFrameDomain = { colnames: ['id', 'category'], cols: [2, 2], rows: [0, 6] };

		check(new Map([[0, DataFrameBottom]]), new Map([[0, DataFrameBottom]]), true, new Map([[0, DataFrameBottom]]), new Map([[0, DataFrameBottom]]));
		check(new Map([[0, DataFrameTop]]), new Map([[0, DataFrameTop]]), true, new Map([[0, DataFrameTop]]), new Map([[0, DataFrameTop]]));
		check(new Map([[0, DataFrameBottom]]), new Map([[0, DataFrameTop]]), false, new Map([[0, DataFrameTop]]), new Map([[0, DataFrameBottom]]));
		check(new Map([[0, DataFrameTop]]), new Map([[0, DataFrameBottom]]), false, new Map([[0, DataFrameTop]]), new Map([[0, DataFrameBottom]]));
		check(new Map([[0, DataFrameBottom]]), new Map([[0, domain1]]), false, new Map([[0, domain1]]), new Map([[0, DataFrameBottom]]));
		check(new Map([[0, domain1]]), new Map([[0, DataFrameBottom]]), false, new Map([[0, domain1]]), new Map([[0, DataFrameBottom]]));
		check(new Map([[0, domain1]]), new Map([[0, domain1]]), true, new Map([[0, domain1]]), new Map([[0, domain1]]));
		check(new Map([[0, domain1]]), new Map([[0, domain2]]), false, new Map([[0, joinDataFrames(domain1, domain2)]]), new Map([[0, meetDataFrames(domain1, domain2)]]));
		check(new Map([[0, domain2]]), new Map([[0, domain1]]), false, new Map([[0, joinDataFrames(domain2, domain1)]]), new Map([[0, meetDataFrames(domain2, domain1)]]));
		check(new Map([[0, domain1], [1, domain2]]), new Map([[0, domain1], [1, domain2]]), true, new Map([[0, domain1], [1, domain2]]), new Map([[0, domain1], [1, domain2]]));
		check(new Map([[1, DataFrameTop]]), new Map([[0, domain1], [1, domain2]]), false, new Map([[0, domain1], [1, DataFrameTop]]), new Map([[0, domain1], [1, domain2]]));
		check(new Map([[0, domain1], [1, domain2]]), new Map([[1, DataFrameTop]]), false, new Map([[0, domain1], [1, DataFrameTop]]), new Map([[0, domain1], [1, domain2]]));
		check(new Map([[0, domain1], [1, domain2]]), new Map([[0, DataFrameTop], [1, DataFrameBottom]]), false, new Map([[0, DataFrameTop], [1, domain2]]), new Map([[0, domain1], [1, DataFrameBottom]]));
		check(new Map([[0, DataFrameTop], [1, DataFrameBottom]]), new Map([[0, domain1], [1, domain2]]), false, new Map([[0, DataFrameTop], [1, domain2]]), new Map([[0, domain1], [1, DataFrameBottom]]));
		check(new Map([[0, domain1], [2, DataFrameBottom]]), new Map([[1, DataFrameTop]]), false, new Map([[0, domain1], [1, DataFrameTop], [2, DataFrameBottom]]), new Map([[0, domain1], [1, DataFrameTop], [2, DataFrameBottom]]));
		check(new Map([[1, DataFrameTop]]), new Map([[0, domain1], [2, DataFrameBottom]]), false, new Map([[0, domain1], [1, DataFrameTop], [2, DataFrameBottom]]), new Map([[0, domain1], [1, DataFrameTop], [2, DataFrameBottom]]));
		check(new Map([[0, DataFrameTop]]), new Map([[0, domain1]]), false, new Map([[0, DataFrameTop]]), new Map([[0, domain1]]));
		check(new Map([[0, domain1]]), new Map([[0, DataFrameTop]]), false, new Map([[0, DataFrameTop]]), new Map([[0, domain1]]));
	});
});
