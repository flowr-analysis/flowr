import { describe } from 'vitest';
import type { AbstractDataFrameShape } from '../../../../src/abstract-interpretation/data-frame/dataframe-domain';
import { DataFrameDomain, DateFrameStateDomain } from '../../../../src/abstract-interpretation/data-frame/dataframe-domain';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { PosIntervalDomain } from '../../../../src/abstract-interpretation/domains/positive-interval-domain';
import type { ConcreteProduct } from '../../../../src/abstract-interpretation/domains/product-domain';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { assertAbstractDomain } from '../domains/domain';
import { SetBoundedSetDomain } from '../../../../src/abstract-interpretation/domains/set-bounded-set-domain';

describe('Data Frame Domains', () => {
	type DataFrameValue = { colnames: string[] | typeof Bottom | typeof Top, cols: [number, number] | typeof Bottom, rows: [number, number] | typeof Bottom }
	type DataFrameState = [NodeId, DataFrameValue][];

	const createValue = ({ colnames, cols, rows }: DataFrameValue) => new DataFrameDomain({
		colnames: new SetBoundedSetDomain(colnames === Top || colnames === Bottom ? colnames : new Set(colnames)),
		cols:     new PosIntervalDomain(cols),
		rows:     new PosIntervalDomain(rows)
	});

	const DataFrameBottom = { colnames: Bottom, cols: Bottom, rows: Bottom } satisfies DataFrameValue;
	const DataFrameTop = { colnames: Top, cols: [0, +Infinity], rows: [0, +Infinity] } satisfies DataFrameValue;
	const DataFrameEmpty = { colnames: [], cols: [0, 0], rows: [0,0] } satisfies DataFrameValue;

	const domain1 = { colnames: ['id', 'name', 'age'], cols: [3, 5], rows: [5, 5] } satisfies DataFrameValue;
	const domain2 = { colnames: ['id', 'category'], cols: [2, 2], rows: [0, 6] } satisfies DataFrameValue;

	const join = { colnames: ['id', 'name', 'age', 'category'], cols: [2, 5], rows: [0, 6] } satisfies DataFrameValue;
	const meet = { colnames: ['id'], cols: Bottom, rows: [5, 5] } satisfies DataFrameValue;
	const widen1 = { colnames: Top, cols: [0, 5], rows: [0, +Infinity] } satisfies DataFrameValue;
	const narrow1 = { colnames: ['id', 'name', 'age'], cols: [3, 5], rows: [5, 5] } satisfies DataFrameValue;
	const widen2 = { colnames: Top, cols: [2, +Infinity], rows: [0, 6] } satisfies DataFrameValue;
	const narrow2 = { colnames: ['id', 'category'], cols: [2, 2], rows: [5, 6] } satisfies DataFrameValue;
	const concrete1 = [...createValue(domain1).concretize() as ReadonlySet<ConcreteProduct<AbstractDataFrameShape>>];
	const concrete2 = [...createValue(domain2).concretize() as ReadonlySet<ConcreteProduct<AbstractDataFrameShape>>];

	describe('Data Frame Shape Domain', () => {
		const create = createValue;

		assertAbstractDomain(create, DataFrameBottom, DataFrameBottom, {
			equal: true, leq: true, join: DataFrameBottom, meet: DataFrameBottom, widen: DataFrameBottom, narrow: DataFrameBottom, concrete: []
		});
		assertAbstractDomain(create, DataFrameTop, DataFrameTop, {
			equal: true, leq: true, join: DataFrameTop, meet: DataFrameTop, widen: DataFrameTop, narrow: DataFrameTop, concrete: Top
		});
		assertAbstractDomain(create, DataFrameBottom, DataFrameTop, {
			equal: false, leq: true, join: DataFrameTop, meet: DataFrameBottom, widen: DataFrameTop, narrow: DataFrameBottom, concrete: []
		});
		assertAbstractDomain(create, DataFrameTop, DataFrameBottom, {
			equal: false, leq: false, join: DataFrameTop, meet: DataFrameBottom, widen: DataFrameTop, narrow: DataFrameBottom, concrete: Top
		});
		assertAbstractDomain(create, DataFrameBottom, DataFrameEmpty, {
			equal: false, leq: true, join: DataFrameEmpty, meet: DataFrameBottom, widen: DataFrameEmpty, narrow: DataFrameBottom, concrete: []
		});
		assertAbstractDomain(create, DataFrameEmpty, DataFrameBottom, {
			equal: false, leq: false, join: DataFrameEmpty, meet: DataFrameBottom, widen: DataFrameEmpty, narrow: DataFrameBottom, concrete: [{ colnames: new Set<string>(), cols: 0, rows: 0 }]
		});
		assertAbstractDomain(create, DataFrameBottom, domain1, {
			equal: false, leq: true, join: domain1, meet: DataFrameBottom, widen: domain1, narrow: DataFrameBottom, concrete: []
		});
		assertAbstractDomain(create, domain1, DataFrameBottom, {
			equal: false, leq: false, join: domain1, meet: DataFrameBottom, widen: domain1, narrow: DataFrameBottom, concrete: concrete1
		});
		assertAbstractDomain(create, domain1, domain1, {
			equal: true, leq: true, join: domain1, meet: domain1, widen: domain1, narrow: domain1, concrete: concrete1
		});
		assertAbstractDomain(create, domain1, { ...domain1, colnames: Top }, {
			equal: false, leq: true, join: { ...domain1, colnames: Top }, meet: domain1, widen: { ...domain1, colnames: Top }, narrow: domain1, concrete: concrete1
		});
		assertAbstractDomain(create, { ...domain1, colnames: Top }, domain1, {
			equal: false, leq: false, join: { ...domain1, colnames: Top }, meet: domain1, widen: { ...domain1, colnames: Top }, narrow: domain1, concrete: Top, abstract: DataFrameTop
		});
		assertAbstractDomain(create, domain1, { ...domain1, cols: [0, +Infinity] }, {
			equal: false, leq: true, join: { ...domain1, cols: [0, +Infinity] }, meet: domain1, widen: { ...domain1, cols: [0, +Infinity] }, narrow: domain1, concrete: concrete1
		});
		assertAbstractDomain(create, { ...domain1, cols: [0, +Infinity] }, domain1, {
			equal: false, leq: false, join: { ...domain1, cols: [0, +Infinity] }, meet: domain1, widen: { ...domain1, cols: [0, +Infinity] }, narrow: domain1, concrete: Top, abstract: DataFrameTop
		});
		assertAbstractDomain(create, domain1, { ...domain1, rows: [0, +Infinity] }, {
			equal: false, leq: true, join: { ...domain1, rows: [0, +Infinity] }, meet: domain1, widen: { ...domain1, rows: [0, +Infinity] }, narrow: domain1, concrete: concrete1
		});
		assertAbstractDomain(create, { ...domain1, rows: [0, +Infinity] }, domain1, {
			equal: false, leq: false, join: { ...domain1, rows: [0, +Infinity] }, meet: domain1, widen: { ...domain1, rows: [0, +Infinity] }, narrow: domain1, concrete: Top, abstract: DataFrameTop
		});
		assertAbstractDomain(create, domain1, { ...domain1, colnames: Bottom }, {
			equal: false, leq: false, join: domain1, meet: { ...domain1, colnames: Bottom }, widen: domain1, narrow: { ...domain1, colnames: Bottom }, concrete: concrete1
		});
		assertAbstractDomain(create, { ...domain1, colnames: Bottom }, domain1, {
			equal: false, leq: true, join: domain1, meet: { ...domain1, colnames: Bottom }, widen: domain1, narrow: { ...domain1, colnames: Bottom }, concrete: [], abstract: DataFrameBottom
		});
		assertAbstractDomain(create, domain1, { ...domain1, cols: Bottom }, {
			equal: false, leq: false, join: domain1, meet: { ...domain1, cols: Bottom }, widen: domain1, narrow: { ...domain1, cols: Bottom }, concrete: concrete1
		});
		assertAbstractDomain(create, { ...domain1, cols: Bottom }, domain1, {
			equal: false, leq: true, join: domain1, meet: { ...domain1, cols: Bottom }, widen: domain1, narrow: { ...domain1, cols: Bottom }, concrete: [], abstract: DataFrameBottom
		});
		assertAbstractDomain(create, domain1, { ...domain1, rows: Bottom }, {
			equal: false, leq: false, join: domain1, meet: { ...domain1, rows: Bottom }, widen: domain1, narrow: { ...domain1, rows: Bottom }, concrete: concrete1
		});
		assertAbstractDomain(create, { ...domain1, rows: Bottom }, domain1, {
			equal: false, leq: true, join: domain1, meet: { ...domain1, rows: Bottom }, widen: domain1, narrow: { ...domain1, rows: Bottom }, concrete: [], abstract: DataFrameBottom
		});
		assertAbstractDomain(create, domain1, domain2, {
			equal: false, leq: false, join: join, meet: meet, widen: widen1, narrow: narrow1, concrete: concrete1
		});
		assertAbstractDomain(create, domain2, domain1, {
			equal: false, leq: false, join: join, meet: meet, widen: widen2, narrow: narrow2, concrete: concrete2
		});
		assertAbstractDomain(create, DataFrameTop, domain1, {
			equal: false, leq: false, join: DataFrameTop, meet: domain1, widen: DataFrameTop, narrow: domain1, concrete: Top
		});
		assertAbstractDomain(create, domain1, DataFrameTop, {
			equal: false, leq: true, join: DataFrameTop, meet: domain1, widen: DataFrameTop, narrow: domain1, concrete: concrete1
		});
	});

	describe('Data Frame State Domain', () => {
		const create = (state: DataFrameState) =>
			new DateFrameStateDomain(new Map(state.map(([id, value]) => [id, createValue(value)])));

		const concreteState1 = concrete1.map(concrete => new Map([[0, concrete]]));
		const concreteState2 = concrete2.map(concrete => new Map([[0, concrete]]));

		assertAbstractDomain(create, [[0, DataFrameBottom]], [[0, DataFrameBottom]], {
			equal: true, leq: true, join: [[0, DataFrameBottom]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameBottom]], narrow: [[0, DataFrameBottom]], concrete: [], abstract: []
		});
		assertAbstractDomain(create, [[0, DataFrameTop]], [[0, DataFrameTop]], {
			equal: true, leq: true, join: [[0, DataFrameTop]], meet: [[0, DataFrameTop]], widen: [[0, DataFrameTop]], narrow: [[0, DataFrameTop]], concrete: Top, abstract: []
		});
		assertAbstractDomain(create, [[0, DataFrameBottom]], [[0, DataFrameTop]], {
			equal: false, leq: true, join: [[0, DataFrameTop]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameTop]], narrow: [[0, DataFrameBottom]], concrete: [], abstract: []
		});
		assertAbstractDomain(create, [[0, DataFrameTop]], [[0, DataFrameBottom]], {
			equal: false, leq: false, join: [[0, DataFrameTop]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameTop]], narrow: [[0, DataFrameBottom]], concrete: Top, abstract: []
		});
		assertAbstractDomain(create, [[0, DataFrameBottom]], [[0, DataFrameEmpty]], {
			equal: false, leq: true, join: [[0, DataFrameEmpty]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameEmpty]], narrow: [[0, DataFrameBottom]], concrete: [], abstract: []
		});
		assertAbstractDomain(create, [[0, DataFrameEmpty]], [[0, DataFrameBottom]], {
			equal: false, leq: false, join: [[0, DataFrameEmpty]], meet: [[0, DataFrameBottom]], widen: [[0, DataFrameEmpty]], narrow: [[0, DataFrameBottom]], concrete: [new Map([[0, { colnames: new Set<string>(), cols: 0, rows: 0 }]])]
		});
		assertAbstractDomain(create, [[0, DataFrameBottom]], [[0, domain1]], {
			equal: false, leq: true, join: [[0, domain1]], meet: [[0, DataFrameBottom]], widen: [[0, domain1]], narrow: [[0, DataFrameBottom]], concrete: [], abstract: []
		});
		assertAbstractDomain(create, [[0, domain1]], [[0, DataFrameBottom]], {
			equal: false, leq: false, join: [[0, domain1]], meet: [[0, DataFrameBottom]], widen: [[0, domain1]], narrow: [[0, DataFrameBottom]], concrete: concreteState1
		});
		assertAbstractDomain(create, [[0, domain1]], [[0, domain1]], {
			equal: true, leq: true, join: [[0, domain1]], meet: [[0, domain1]], widen: [[0, domain1]], narrow: [[0, domain1]], concrete: concreteState1
		});
		assertAbstractDomain(create, [[0, domain1]], [[0, domain2]], {
			equal: false, leq: false, join: [[0, join]], meet: [[0, meet]], widen: [[0, widen1]], narrow: [[0, narrow1]], concrete: concreteState1
		});
		assertAbstractDomain(create, [[0, domain2]], [[0, domain1]], {
			equal: false, leq: false, join: [[0, join]], meet: [[0, meet]], widen: [[0, widen2]], narrow: [[0, narrow2]], concrete: concreteState2
		});
		assertAbstractDomain(create, [[0, domain1], [1, domain2]], [[0, domain1], [1, domain2]], {
			equal: true, leq: true, join: [[0, domain1], [1, domain2]], meet: [[0, domain1], [1, domain2]], widen: [[0, domain1], [1, domain2]], narrow: [[0, domain1], [1, domain2]], concrete: Top, abstract: []
		});
		assertAbstractDomain(create, [[0, domain1], [1, domain1]], [[0, domain1], [1, domain2]], {
			equal: false, leq: false, join: [[0, domain1], [1, join]], meet: [[0, domain1], [1, meet]], widen: [[0, domain1], [1, widen1]], narrow: [[0, domain1], [1, narrow1]], concrete: Top, abstract: []
		});
		assertAbstractDomain(create, [[1, DataFrameTop]], [[0, domain1], [1, domain2]], {
			equal: false, leq: false, join: [[0, domain1], [1, DataFrameTop]], meet: [[1, domain2]], widen: [[0, domain1], [1, DataFrameTop]], narrow: [[1, domain2]], concrete: Top, abstract: []
		});
		assertAbstractDomain(create, [[0, domain1], [1, domain2]], [[1, DataFrameTop]], {
			equal: false, leq: false, join: [[0, domain1], [1, DataFrameTop]], meet: [[1, domain2]], widen: [[0, domain1], [1, DataFrameTop]], narrow: [[1, domain2]], concrete: Top, abstract: []
		});
		assertAbstractDomain(create, [[0, domain1], [1, domain2]], [[0, DataFrameTop], [1, DataFrameBottom]], {
			equal: false, leq: false, join: [[0, DataFrameTop], [1, domain2]], meet: [[0, domain1], [1, DataFrameBottom]], widen: [[0, DataFrameTop], [1, domain2]], narrow: [[0, domain1], [1, DataFrameBottom]], concrete: Top, abstract: []
		});
		assertAbstractDomain(create, [[0, DataFrameTop], [1, DataFrameBottom]], [[0, domain1], [1, domain2]], {
			equal: false, leq: false, join: [[0, DataFrameTop], [1, domain2]], meet: [[0, domain1], [1, DataFrameBottom]], widen: [[0, DataFrameTop], [1, domain2]], narrow: [[0, domain1], [1, DataFrameBottom]], concrete: [], abstract: []
		});
		assertAbstractDomain(create, [[0, domain1], [2, DataFrameBottom]], [[1, DataFrameTop]], {
			equal: false, leq: false, join: [[0, domain1], [1, DataFrameTop], [2, DataFrameBottom]], meet: [], widen: [[0, domain1], [1, DataFrameTop], [2, DataFrameBottom]], narrow: [], concrete: [], abstract: []
		});
		assertAbstractDomain(create, [[1, DataFrameTop]], [[0, domain1], [2, DataFrameBottom]], {
			equal: false, leq: false, join: [[0, domain1], [1, DataFrameTop], [2, DataFrameBottom]], meet: [], widen: [[0, domain1], [1, DataFrameTop], [2, DataFrameBottom]], narrow: [], concrete: Top, abstract: []
		});
		assertAbstractDomain(create, [[0, DataFrameTop]], [[0, domain1]], {
			equal: false, leq: false, join: [[0, DataFrameTop]], meet: [[0, domain1]], widen: [[0, DataFrameTop]], narrow: [[0, domain1]], concrete: Top, abstract: []
		});
		assertAbstractDomain(create, [[0, domain1]], [[0, DataFrameTop]], {
			equal: false, leq: true, join: [[0, DataFrameTop]], meet: [[0, domain1]], widen: [[0, DataFrameTop]], narrow: [[0, domain1]], concrete: concreteState1
		});
	});
});
