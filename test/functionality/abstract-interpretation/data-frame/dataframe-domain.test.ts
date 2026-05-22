import { describe } from 'vitest';
import { DataFrameDomain } from '../../../../src/abstract-interpretation/data-frame/dataframe-domain';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { PosIntervalDomain, PosIntervalTop } from '../../../../src/abstract-interpretation/domains/positive-interval-domain';
import { SetRangeDomain } from '../../../../src/abstract-interpretation/domains/set-range-domain';
import { StateAbstractDomain } from '../../../../src/abstract-interpretation/domains/state-abstract-domain';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { assertAbstractDomain } from '../domains/domain';
import type { ExpectedDataFrameShape } from './data-frame';

describe('Data Frame Domains', () => {
	const createDomain = ({ colnames, cols, rows }: ExpectedDataFrameShape) => new DataFrameDomain({
		colnames: new SetRangeDomain(colnames === Bottom ? colnames : { must: colnames[0], may: colnames[1] === Top ? Top : colnames[1] }),
		cols:     new PosIntervalDomain(cols),
		rows:     new PosIntervalDomain(rows)
	});

	const createState = (state: [NodeId, ExpectedDataFrameShape][] | typeof Bottom) =>
		new StateAbstractDomain(state === Bottom ? Bottom : new Map(state.map(([id, value]) => [id, createDomain(value)])), DataFrameDomain.top());

	const DataFrameBottom = { colnames: Bottom, cols: Bottom, rows: Bottom } satisfies ExpectedDataFrameShape;
	const DataFrameTop = { colnames: [[], Top], cols: PosIntervalTop, rows: PosIntervalTop } satisfies ExpectedDataFrameShape;
	const DataFrameEmpty = { colnames: [[], []], cols: [0, 0], rows: [0, 0] } satisfies ExpectedDataFrameShape;

	const domain1 = { colnames: [['id', 'name'], ['age']], cols: [2, 3], rows: [5, 5] } satisfies ExpectedDataFrameShape;
	const domain2 = { colnames: [['id'], ['name', 'category']], cols: [1, 3], rows: [4, 6] } satisfies ExpectedDataFrameShape;

	const join = { colnames: [['id'], ['name', 'age', 'category']], cols: [1, 3], rows: [4, 6] } satisfies ExpectedDataFrameShape;
	const meet = { colnames: [['id', 'name'], []], cols: [2, 2], rows: [5, 5] } satisfies ExpectedDataFrameShape;
	const widen1 = { colnames: [[], Top], cols: [0, 3], rows: PosIntervalTop } satisfies ExpectedDataFrameShape;
	const narrow1 = { colnames: [['id', 'name'], ['age']], cols: [2, 3], rows: [5, 5] } satisfies ExpectedDataFrameShape;
	const widen2 = { colnames: [['id'], Top], cols: [1, 3], rows: [4, 6] } satisfies ExpectedDataFrameShape;
	const narrow2 = { colnames: [['id'], ['name', 'category']], cols: [1, 3], rows: [4, 6] } satisfies ExpectedDataFrameShape;

	describe('Data Frame Shape Domain', () => {
		const create = createDomain;

		assertAbstractDomain(create, DataFrameBottom, DataFrameBottom, {
			equal: true, leq: true, join: DataFrameBottom, meet: DataFrameBottom, widen: DataFrameBottom, narrow: DataFrameBottom
		});
		assertAbstractDomain(create, DataFrameTop, DataFrameTop, {
			equal: true, leq: true, join: DataFrameTop, meet: DataFrameTop, widen: DataFrameTop, narrow: DataFrameTop
		});
		assertAbstractDomain(create, DataFrameBottom, DataFrameTop, {
			equal: false, leq: true, join: DataFrameTop, meet: DataFrameBottom, widen: DataFrameTop, narrow: DataFrameBottom
		});
		assertAbstractDomain(create, DataFrameTop, DataFrameBottom, {
			equal: false, leq: false, join: DataFrameTop, meet: DataFrameBottom, widen: DataFrameTop, narrow: DataFrameBottom
		});
		assertAbstractDomain(create, DataFrameBottom, DataFrameEmpty, {
			equal: false, leq: true, join: DataFrameEmpty, meet: DataFrameBottom, widen: DataFrameEmpty, narrow: DataFrameBottom
		});
		assertAbstractDomain(create, DataFrameEmpty, DataFrameBottom, {
			equal: false, leq: false, join: DataFrameEmpty, meet: DataFrameBottom, widen: DataFrameEmpty, narrow: DataFrameBottom
		});
		assertAbstractDomain(create, DataFrameBottom, domain1, {
			equal: false, leq: true, join: domain1, meet: DataFrameBottom, widen: domain1, narrow: DataFrameBottom
		});
		assertAbstractDomain(create, domain1, DataFrameBottom, {
			equal: false, leq: false, join: domain1, meet: DataFrameBottom, widen: domain1, narrow: DataFrameBottom
		});
		assertAbstractDomain(create, domain1, domain1, {
			equal: true, leq: true, join: domain1, meet: domain1, widen: domain1, narrow: domain1
		});
		assertAbstractDomain(create, domain1, { ...domain1, colnames: [[], Top] }, {
			equal: false, leq: true, join: { ...domain1, colnames: [[], Top] }, meet: domain1, widen: { ...domain1, colnames: [[], Top] }, narrow: domain1
		});
		assertAbstractDomain(create, { ...domain1, colnames: [[], Top] }, domain1, {
			equal: false, leq: false, join: { ...domain1, colnames: [[], Top] }, meet: domain1, widen: { ...domain1, colnames: [[], Top] }, narrow: domain1
		});
		assertAbstractDomain(create, domain1, { ...domain1, colnames: [domain1.colnames[0], Top], cols: [2, +Infinity] }, {
			equal: false, leq: true, join: { ...domain1, colnames: [domain1.colnames[0], Top], cols: [2, +Infinity] }, meet: domain1, widen: { ...domain1, colnames: [domain1.colnames[0], Top], cols: [2, +Infinity] }, narrow: domain1
		});
		assertAbstractDomain(create, { ...domain1, colnames: [domain1.colnames[0], Top], cols: [2, +Infinity] }, domain1, {
			equal: false, leq: false, join: { ...domain1, colnames: [domain1.colnames[0], Top], cols: [2, +Infinity] }, meet: domain1, widen: { ...domain1, colnames: [domain1.colnames[0], Top], cols: [2, +Infinity] }, narrow: domain1
		});
		assertAbstractDomain(create, domain1, { ...domain1, rows: PosIntervalTop }, {
			equal: false, leq: true, join: { ...domain1, rows: PosIntervalTop }, meet: domain1, widen: { ...domain1, rows: PosIntervalTop }, narrow: domain1
		});
		assertAbstractDomain(create, { ...domain1, rows: PosIntervalTop }, domain1, {
			equal: false, leq: false, join: { ...domain1, rows: PosIntervalTop }, meet: domain1, widen: { ...domain1, rows: PosIntervalTop }, narrow: domain1
		});
		assertAbstractDomain(create, domain1, { ...domain1, colnames: Bottom }, {
			equal: false, leq: false, join: domain1, meet: { ...domain1, colnames: Bottom }, widen: domain1, narrow: { ...domain1, colnames: Bottom }
		});
		assertAbstractDomain(create, { ...domain1, colnames: Bottom }, domain1, {
			equal: false, leq: true, join: domain1, meet: { ...domain1, colnames: Bottom }, widen: domain1, narrow: { ...domain1, colnames: Bottom }
		});
		assertAbstractDomain(create, domain1, { ...domain1, cols: Bottom }, {
			equal: false, leq: false, join: domain1, meet: { ...domain1, cols: Bottom }, widen: domain1, narrow: { ...domain1, cols: Bottom }
		});
		assertAbstractDomain(create, { ...domain1, cols: Bottom }, domain1, {
			equal: false, leq: true, join: domain1, meet: { ...domain1, cols: Bottom }, widen: domain1, narrow: { ...domain1, cols: Bottom }
		});
		assertAbstractDomain(create, domain1, { ...domain1, rows: Bottom }, {
			equal: false, leq: false, join: domain1, meet: { ...domain1, rows: Bottom }, widen: domain1, narrow: { ...domain1, rows: Bottom }
		});
		assertAbstractDomain(create, { ...domain1, rows: Bottom }, domain1, {
			equal: false, leq: true, join: domain1, meet: { ...domain1, rows: Bottom }, widen: domain1, narrow: { ...domain1, rows: Bottom }
		});
		assertAbstractDomain(create, domain1, domain2, {
			equal: false, leq: false, join: join, meet: meet, widen: widen1, narrow: narrow1
		});
		assertAbstractDomain(create, domain2, domain1, {
			equal: false, leq: false, join: join, meet: meet, widen: widen2, narrow: narrow2
		});
		assertAbstractDomain(create, DataFrameTop, domain1, {
			equal: false, leq: false, join: DataFrameTop, meet: domain1, widen: DataFrameTop, narrow: domain1
		});
		assertAbstractDomain(create, domain1, DataFrameTop, {
			equal: false, leq: true, join: DataFrameTop, meet: domain1, widen: DataFrameTop, narrow: domain1
		});
	});

	describe('Data Frame State Domain', () => {
		const create = createState;

		assertAbstractDomain(create, [[0, DataFrameBottom]], [[0, DataFrameBottom]], {
			equal: true, leq: true, join: [[0, DataFrameBottom]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameBottom]], narrow: [[0, DataFrameBottom]]
		});
		assertAbstractDomain(create, [[0, DataFrameTop]], [[0, DataFrameTop]], {
			equal: true, leq: true, join: [[0, DataFrameTop]], meet: [[0, DataFrameTop]], widen: [[0, DataFrameTop]], narrow: [[0, DataFrameTop]]
		});
		assertAbstractDomain(create, [[0, DataFrameBottom]], [[0, DataFrameTop]], {
			equal: false, leq: true, join: [[0, DataFrameTop]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameTop]], narrow: [[0, DataFrameBottom]]
		});
		assertAbstractDomain(create, [[0, DataFrameTop]], [[0, DataFrameBottom]], {
			equal: false, leq: false, join: [[0, DataFrameTop]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameTop]], narrow: [[0, DataFrameBottom]]
		});
		assertAbstractDomain(create, [[0, DataFrameBottom]], [[0, DataFrameEmpty]], {
			equal: false, leq: true, join: [[0, DataFrameEmpty]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameEmpty]], narrow: [[0, DataFrameBottom]]
		});
		assertAbstractDomain(create, [[0, DataFrameEmpty]], [[0, DataFrameBottom]], {
			equal: false, leq: false, join: [[0, DataFrameEmpty]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameEmpty]], narrow: [[0, DataFrameBottom]]
		});
		assertAbstractDomain(create, [[0, DataFrameBottom]], [[0, domain1]], {
			equal: false, leq: true, join: [[0, domain1]], meet: [[0, DataFrameBottom]], widen: [[0, domain1]], narrow: [[0, DataFrameBottom]]
		});
		assertAbstractDomain(create, [[0, domain1]], [[0, DataFrameBottom]], {
			equal: false, leq: false, join: [[0, domain1]], meet: [[0, DataFrameBottom]], widen: [[0, domain1]], narrow: [[0, DataFrameBottom]]
		});
		assertAbstractDomain(create, [[0, domain1]], [[0, domain1]], {
			equal: true, leq: true, join: [[0, domain1]], meet: [[0, domain1]], widen: [[0, domain1]], narrow: [[0, domain1]]
		});
		assertAbstractDomain(create, [[0, domain1]], [[0, domain2]], {
			equal: false, leq: false, join: [[0, join]], meet: [[0, meet]], widen: [[0, widen1]], narrow: [[0, narrow1]]
		});
		assertAbstractDomain(create, [[0, domain2]], [[0, domain1]], {
			equal: false, leq: false, join: [[0, join]], meet: [[0, meet]], widen: [[0, widen2]], narrow: [[0, narrow2]]
		});
		assertAbstractDomain(create, [[0, domain1], [1, domain2]], [[0, domain1], [1, domain2]], {
			equal: true, leq: true, join: [[0, domain1], [1, domain2]], meet: [[0, domain1], [1, domain2]], widen: [[0, domain1], [1, domain2]], narrow: [[0, domain1], [1, domain2]]
		});
		assertAbstractDomain(create, [[0, domain1], [1, domain1]], [[0, domain1], [1, domain2]], {
			equal: false, leq: false, join: [[0, domain1], [1, join]], meet: [[0, domain1], [1, meet]], widen: [[0, domain1], [1, widen1]], narrow: [[0, domain1], [1, narrow1]]
		});
		assertAbstractDomain(create, [[1, DataFrameTop]], [[0, domain1], [1, domain2]], {
			equal: false, leq: false, join: [[0, domain1], [1, DataFrameTop]], meet: [[1, domain2]], widen: [[0, domain1], [1, DataFrameTop]], narrow: [[1, domain2]]
		});
		assertAbstractDomain(create, [[0, domain1], [1, domain2]], [[1, DataFrameTop]], {
			equal: false, leq: false, join: [[0, domain1], [1, DataFrameTop]], meet: [[1, domain2]], widen: [[0, domain1], [1, DataFrameTop]], narrow: [[1, domain2]]
		});
		assertAbstractDomain(create, [[0, domain1], [1, domain2]], [[0, DataFrameTop], [1, domain2]], {
			equal: false, leq: true, join: [[0, DataFrameTop], [1, domain2]], meet: [[0, domain1], [1, domain2]], widen: [[0, DataFrameTop], [1, domain2]], narrow: [[0, domain1], [1, domain2]]
		});
		assertAbstractDomain(create, [[0, DataFrameTop], [1, domain2]], [[0, domain1], [1, domain2]], {
			equal: false, leq: false, join: [[0, DataFrameTop], [1, domain2]], meet: [[0, domain1], [1, domain2]], widen: [[0, DataFrameTop], [1, domain2]], narrow: [[0, domain1], [1, domain2]]
		});
		assertAbstractDomain(create, [[0, domain1], [2, DataFrameBottom]], [[1, DataFrameTop]], {
			equal: false, leq: true, join: [[1, DataFrameTop]], meet: Bottom, widen: [[1, DataFrameTop]], narrow: Bottom
		});
		assertAbstractDomain(create, [[1, DataFrameTop]], [[0, domain1], [2, DataFrameBottom]], {
			equal: false, leq: false, join: [[1, DataFrameTop]], meet: Bottom, widen: [[1, DataFrameTop]], narrow: Bottom
		});
		assertAbstractDomain(create, [[0, DataFrameTop]], [[0, domain1]], {
			equal: false, leq: false, join: [[0, DataFrameTop]], meet: [[0, domain1]], widen: [[0, DataFrameTop]], narrow: [[0, domain1]]
		});
		assertAbstractDomain(create, [[0, domain1]], [[0, DataFrameTop]], {
			equal: false, leq: true, join: [[0, DataFrameTop]], meet: [[0, domain1]], widen: [[0, DataFrameTop]], narrow: [[0, domain1]]
		});
	});
});
