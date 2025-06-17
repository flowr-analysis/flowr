import { assert, describe, test } from 'vitest';
import { DataFrameDomain, DateFrameStateDomain } from '../../../../src/abstract-interpretation/data-frame/data-frame-domain';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { BoundedSetDomain } from '../../../../src/abstract-interpretation/domains/bounded-set-domain';
import { PosIntervalDomain } from '../../../../src/abstract-interpretation/domains/positive-interval-domain';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('Data Frame Domain', () => {
	type ColNamesValue = string[] | typeof Top | typeof Bottom;
	type PosIntervalValue = readonly [number, number] | typeof Top | typeof Bottom;
	type DataFrameValue = { colnames: ColNamesValue, cols: PosIntervalValue, rows: PosIntervalValue } | typeof Top | typeof Bottom;
	type DataFrameState = [NodeId, DataFrameValue][];

	const toSetDomain = (value: ColNamesValue) => new BoundedSetDomain(value === Bottom ? [] : value);
	const toIntervalDomain = (value: PosIntervalValue) => new PosIntervalDomain(value === Top ? [0, Infinity] : value);
	const toDataFrameDomain = (value: DataFrameValue) => {
		if(value === Bottom) {
			return DataFrameDomain.bottom();
		} else if(value === Top) {
			return DataFrameDomain.top();
		}
		return new DataFrameDomain({ colnames: toSetDomain(value.colnames), cols: toIntervalDomain(value.cols), rows: toIntervalDomain(value.rows) });
	};
	const toStateDomain = (value: DataFrameState) => new DateFrameStateDomain(new Map(value.map(([id, value]) => [id, toDataFrameDomain(value)])));

	const toColNames = (domain: BoundedSetDomain<string>): ColNamesValue => {
		if(domain.isBottom()) {
			return Bottom;
		} else if(domain.isValue()) {
			return domain.value.values().toArray();
		}
		return Top;
	};
	const toInterval = (domain: PosIntervalDomain): PosIntervalValue => {
		if(domain.isTop()) {
			return Top;
		} else if(domain.isValue()) {
			return domain.value;
		}
		return Bottom;
	};
	const toDataFrame = (domain: DataFrameDomain): DataFrameValue => ({
		colnames: toColNames(domain.value.colnames),
		cols:     toInterval(domain.value.cols),
		rows:     toInterval(domain.value.rows)
	});

	describe('Column Names Domain', () => {
		const check = (value1: ColNamesValue, value2: ColNamesValue, equal: boolean, leq: boolean, join: ColNamesValue, meet: ColNamesValue, difference: ColNamesValue) => {
			const domain1 = toSetDomain(value1);
			const domain2 = toSetDomain(value2);

			test(`${domain1.toString()} = ${domain2.toString()}`, () => {
				assert.strictEqual(domain1.equals(domain2), equal);
			});
			test(`${domain1.toString()} ⊑ ${domain2.toString()}`, () => {
				assert.strictEqual(domain1.leq(domain2), leq);
			});
			test(`${domain1.toString()} ⊔ ${domain2.toString()}`, () => {
				assert.deepStrictEqual(domain1.join(domain2).value, toSetDomain(join).value);
			});
			test(`${domain1.toString()} ⊓ ${domain2.toString()}`, () => {
				assert.deepStrictEqual(domain1.meet(domain2).value, toSetDomain(meet).value);
			});
			test(`${domain1.toString()} ∖ ${domain2.toString()}`, () => {
				assert.deepStrictEqual(domain1.subtract(domain2).value, toSetDomain(difference).value);
			});
		};
		check(Bottom, Bottom, true, true, Bottom, Bottom, Bottom);
		check(Top, Top, true, true, Top, Top, Top);
		check(Bottom, Top, false, true, Top, Bottom, Bottom);
		check(Top, Bottom, false, false, Top, Bottom, Top);
		check(Bottom, ['id', 'age'], false, true, ['id', 'age'], Bottom, Bottom);
		check(['id', 'age'], Bottom, false, false, ['id', 'age'], Bottom, ['id', 'age']);
		check(['id', 'age'], ['age', 'id'], true, true, ['id', 'age'], ['id', 'age'], Bottom);
		check(['id', 'age'], ['id', 'age', 'score'], false, true, ['id', 'age', 'score'], ['id', 'age'], Bottom);
		check(['id', 'age', 'score'], ['id', 'age'], false, false, ['id', 'age', 'score'], ['id', 'age'], ['score']);
		check(['id', 'age', 'score'], ['id', 'category'], false, false, ['id', 'age', 'score', 'category'], ['id'], ['age', 'score']);
		check(['id', 'category'], ['id', 'age', 'score'], false, false, ['id', 'age', 'score', 'category'], ['id'], ['category']);
		check(['id', 'age'], Top, false, true, Top, ['id', 'age'], ['id', 'age']);
		check(Top, ['id', 'age'], false, false, Top, ['id', 'age'], Top);
	});

	describe('Interval Domain', () => {
		const check = (value1: PosIntervalValue, value2: PosIntervalValue, equal: boolean, leq: boolean, join: PosIntervalValue, meet: PosIntervalValue) => {
			const domain1 = toIntervalDomain(value1);
			const domain2 = toIntervalDomain(value2);

			test(`${domain1.toString()} = ${domain2.toString()}`, () => {
				assert.strictEqual(domain1.equals(domain2), equal);
			});
			test(`${domain1.toString()} ⊑ ${domain2.toString()}`, () => {
				assert.strictEqual(domain1.leq(domain2), leq);
			});
			test(`${domain1.toString()} ⊔ ${domain2.toString()}`, () => {
				assert.deepStrictEqual(domain1.join(domain2).value, toIntervalDomain(join).value);
			});
			test(`${domain1.toString()} ⊓ ${domain2.toString()}`, () => {
				assert.deepStrictEqual(domain1.meet(domain2).value, toIntervalDomain(meet).value);
			});
		};
		check(Bottom, Bottom, true, true, Bottom, Bottom);
		check(Top, Top, true, true, Top, Top);
		check(Bottom, Top, false, true, Top, Bottom);
		check(Top, Bottom, false, false, Top, Bottom);
		check(Bottom, [2, 2], false, true, [2, 2], Bottom);
		check([2, 2], Bottom, false, false, [2, 2], Bottom);
		check(Bottom, [2, 8], false, true, [2, 8], Bottom);
		check([2, 8], Bottom, false, false, [2, 8], Bottom);
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
		check([2, 8], [0, 0], false, false, [0, 8], Bottom);
		check([0, 0], [2, 8], false, false, [0, 8], Bottom);
		check([2, 8], [10, 12], false, false, [2, 12], Bottom);
		check([10, 12], [2, 8], false, false, [2, 12], Bottom);
		check([0, 0], [12, Infinity], false, false, Top, Bottom);
		check([12, Infinity], [0, 0], false, false, Top, Bottom);
		check([4, Infinity], [12, Infinity], false, false, [4, Infinity], [12, Infinity]);
		check([12, Infinity], [4, Infinity], false, true, [4, Infinity], [12, Infinity]);
		check([2, 8], Top, false, true, Top, [2, 8]);
		check(Top, [2, 8], false, false, Top, [2, 8]);
		check([12, Infinity], Top, false, true, Top, [12, Infinity]);
		check(Top, [12, Infinity], false, false, Top, [12, Infinity]);
	});

	describe('Data Frame Domain', () => {
		const check = (value1: DataFrameValue, value2: DataFrameValue, equal: boolean, join: DataFrameValue, meet: DataFrameValue) => {
			const domain1 = toDataFrameDomain(value1);
			const domain2 = toDataFrameDomain(value2);

			test(`${domain1.toString()} = ${domain2.toString()}`, () => {
				assert.strictEqual(domain1.equals(domain2), equal);
			});
			test(`${domain1.toString()} ⊔ ${domain2.toString()}`, () => {
				const result = domain1.join(domain2);
				assert.isTrue(result.equals(toDataFrameDomain(join)), `expected domain ${result.toString()} to equal domain ${toDataFrameDomain(join).toString()}`);
			});
			test(`${domain1.toString()} ⊓ ${domain2.toString()}`, () => {
				const result = domain1.meet(domain2);
				assert.isTrue(result.equals(toDataFrameDomain(meet)), `expected domain ${result.toString()} to equal domain ${toDataFrameDomain(meet).toString()}`);
			});
		};
		type ActualDataFrameValue = Exclude<DataFrameValue, typeof Top | typeof Bottom>;
		const join = (value1: ActualDataFrameValue, value2: ActualDataFrameValue): DataFrameValue => {
			return {
				colnames: toColNames(toSetDomain(value1.colnames).join(toSetDomain(value2.colnames))),
				cols:     toIntervalDomain(value1.cols).join(toIntervalDomain(value2.cols)).value,
				rows:     toIntervalDomain(value1.rows).join(toIntervalDomain(value2.rows)).value,
			};
		};
		const meet = (value1: ActualDataFrameValue, value2: ActualDataFrameValue): DataFrameValue => {
			return {
				colnames: toColNames(toSetDomain(value1.colnames).meet(toSetDomain(value2.colnames))),
				cols:     toInterval(toIntervalDomain(value1.cols).meet(toIntervalDomain(value2.cols))),
				rows:     toInterval(toIntervalDomain(value1.rows).meet(toIntervalDomain(value2.rows))),
			};
		};
		const domain1: ActualDataFrameValue = { colnames: ['id', 'name', 'age'], cols: [3, 5], rows: [5, 5] };
		const domain2: ActualDataFrameValue = { colnames: ['id', 'category'], cols: [2, 2], rows: [0, 6] };

		check(Bottom, Bottom, true, Bottom, Bottom);
		check(Top, Top, true, Top, Top);
		check(Bottom, Top, false, Top, Bottom);
		check(Top, Bottom, false, Top, Bottom);
		check(Bottom, domain1, false, domain1, Bottom);
		check(domain1, Bottom, false, domain1, Bottom);
		check(domain1, domain1, true, domain1, domain1);
		check(domain1, { ...domain1, colnames: Top }, false, { ...domain1, colnames: Top }, domain1);
		check({ ...domain1, colnames: Top }, domain1, false, { ...domain1, colnames: Top }, domain1);
		check(domain1, { ...domain1, cols: Top }, false, { ...domain1, cols: Top }, domain1);
		check({ ...domain1, cols: Top }, domain1, false, { ...domain1, cols: Top }, domain1);
		check(domain1, { ...domain1, rows: Top }, false, { ...domain1, rows: Top }, domain1);
		check({ ...domain1, rows: Top }, domain1, false, { ...domain1, rows: Top }, domain1);
		check(domain1, { ...domain1, colnames: Bottom }, false, domain1, { ...domain1, colnames: Bottom });
		check({ ...domain1, colnames: Bottom }, domain1, false, domain1, { ...domain1, colnames: Bottom });
		check(domain1, { ...domain1, cols: Bottom }, false, domain1, { ...domain1, cols: Bottom });
		check({ ...domain1, cols: Bottom }, domain1, false, domain1, { ...domain1, cols: Bottom });
		check(domain1, { ...domain1, rows: Bottom }, false, domain1, { ...domain1, rows: Bottom });
		check({ ...domain1, rows: Bottom }, domain1, false, domain1, { ...domain1, rows: Bottom });
		check(domain1, domain2, false, join(domain1, domain2), meet(domain1, domain2));
		check(domain2, domain1, false, join(domain2, domain1), meet(domain2, domain1));
		check(Top, domain1, false, Top, domain1);
		check(domain1, Top, false, Top, domain1);
	});

	describe('Data Frame State Domain', () => {
		const check = (value1: DataFrameState, value2: DataFrameState, equal: boolean, join: DataFrameState, meet: DataFrameState) => {
			const domain1 = toStateDomain(value1);
			const domain2 = toStateDomain(value2);

			test(`${domain1.toString()} = ${domain2.toString()}`, () => {
				assert.strictEqual(domain1.equals(domain2), equal);
			});
			test(`${domain1.toString()} ⊔ ${domain2.toString()}`, () => {
				const result = domain1.join(domain2);
				assert.isTrue(result.equals(toStateDomain(join)), `expected state ${result.toString()} to equal state ${toStateDomain(join).toString()}`);
			});
			test(`${domain1.toString()} ⊓ ${domain2.toString()}`, () => {
				const result = domain1.meet(domain2);
				assert.isTrue(result.equals(toStateDomain(meet)), `expected state ${result.toString()} to equal state ${toStateDomain(meet).toString()}`);
			});
		};
		const join = (value1: DataFrameValue, value2: DataFrameValue): DataFrameValue => toDataFrame(toDataFrameDomain(value1).join(toDataFrameDomain(value2)));
		const meet = (value1: DataFrameValue, value2: DataFrameValue): DataFrameValue => toDataFrame(toDataFrameDomain(value1).meet(toDataFrameDomain(value2)));
		const domain1: DataFrameValue = { colnames: ['id', 'name', 'age'], cols: [3, 5], rows: [5, 5] };
		const domain2: DataFrameValue = { colnames: ['id', 'category'], cols: [2, 2], rows: [0, 6] };

		check([[0, Bottom]], [[0, Bottom]], true, [[0, Bottom]], [[0, Bottom]]);
		check([[0, Top]], [[0, Top]], true, [[0, Top]], [[0, Top]]);
		check([[0, Bottom]], [[0, Top]], false, [[0, Top]], [[0, Bottom]]);
		check([[0, Top]], [[0, Bottom]], false, [[0, Top]], [[0, Bottom]]);
		check([[0, Bottom]], [[0, domain1]], false, [[0, domain1]], [[0, Bottom]]);
		check([[0, domain1]], [[0, Bottom]], false, [[0, domain1]], [[0, Bottom]]);
		check([[0, domain1]], [[0, domain1]], true, [[0, domain1]], [[0, domain1]]);
		check([[0, domain1]], [[0, domain2]], false, [[0, join(domain1, domain2)]], [[0, meet(domain1, domain2)]]);
		check([[0, domain2]], [[0, domain1]], false, [[0, join(domain2, domain1)]], [[0, meet(domain2, domain1)]]);
		check([[0, domain1], [1, domain2]], [[0, domain1], [1, domain2]], true, [[0, domain1], [1, domain2]], [[0, domain1], [1, domain2]]);
		check([[1, Top]], [[0, domain1], [1, domain2]], false, [[0, domain1], [1, Top]], [[0, domain1], [1, domain2]]);
		check([[0, domain1], [1, domain2]], [[1, Top]], false, [[0, domain1], [1, Top]], [[0, domain1], [1, domain2]]);
		check([[0, domain1], [1, domain2]], [[0, Top], [1, Bottom]], false, [[0, Top], [1, domain2]], [[0, domain1], [1, Bottom]]);
		check([[0, Top], [1, Bottom]], [[0, domain1], [1, domain2]], false, [[0, Top], [1, domain2]], [[0, domain1], [1, Bottom]]);
		check([[0, domain1], [2, Bottom]], [[1, Top]], false, [[0, domain1], [1, Top], [2, Bottom]], [[0, domain1], [1, Top], [2, Bottom]]);
		check([[1, Top]], [[0, domain1], [2, Bottom]], false, [[0, domain1], [1, Top], [2, Bottom]], [[0, domain1], [1, Top], [2, Bottom]]);
		check([[0, Top]], [[0, domain1]], false, [[0, Top]], [[0, domain1]]);
		check([[0, domain1]], [[0, Top]], false, [[0, Top]], [[0, domain1]]);
	});
});
