import { describe } from 'vitest';
import type { AbstractDomainValue, AnyAbstractDomain } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { BoundedSetDomain } from '../../../../src/abstract-interpretation/domains/bounded-set-domain';
import { IntervalDomain, IntervalTop } from '../../../../src/abstract-interpretation/domains/interval-domain';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { PosIntervalDomain, PosIntervalTop } from '../../../../src/abstract-interpretation/domains/positive-interval-domain';
import type { ArrayRangeValue } from '../../../../src/abstract-interpretation/domains/set-range-domain';
import { SetRangeDomain } from '../../../../src/abstract-interpretation/domains/set-range-domain';
import { SetUpperBoundDomain } from '../../../../src/abstract-interpretation/domains/set-upper-bound-domain';
import { SingletonDomain } from '../../../../src/abstract-interpretation/domains/singleton-domain';
import { assertAbstractDomain } from './domain';

describe('Abstract Domains', () => {
	describe('Singleton Domain', () => {
		const create = (value: AbstractDomainValue<SingletonDomain<number>>) => new SingletonDomain(value);

		assertAbstractDomain(create, Bottom, Bottom, {
			equal: true, leq: true, join: Bottom, meet: Bottom, widen: Bottom, narrow: Bottom, concrete: []
		});
		assertAbstractDomain(create, Top, Top, {
			equal: true, leq: true, join: Top, meet: Top, widen: Top, narrow: Top, concrete: Top
		});
		assertAbstractDomain(create, Bottom, Top, {
			equal: false, leq: true, join: Top, meet: Bottom, widen: Top, narrow: Bottom, concrete: []
		});
		assertAbstractDomain(create, Top, Bottom, {
			equal: false, leq: false, join: Top, meet: Bottom, widen: Top, narrow: Bottom, concrete: Top
		});
		assertAbstractDomain(create, Bottom, 42, {
			equal: false, leq: true, join: 42, meet: Bottom, widen: 42, narrow: Bottom, concrete: []
		});
		assertAbstractDomain(create, 42, Bottom, {
			equal: false, leq: false, join: 42, meet: Bottom, widen: 42, narrow: Bottom, concrete: [42]
		});
		assertAbstractDomain(create, 42, 42, {
			equal: true, leq: true, join: 42, meet: 42, widen: 42, narrow: 42, concrete: [42]
		});
		assertAbstractDomain(create, 12, 42, {
			equal: false, leq: true, join: Top, meet: Bottom, widen: Top, narrow: Bottom, concrete: [12]
		});
		assertAbstractDomain(create, 42, 12, {
			equal: false, leq: false, join: Top, meet: Bottom, widen: Top, narrow: Bottom, concrete: [42]
		});
		assertAbstractDomain(create, 42, Top, {
			equal: false, leq: true, join: Top, meet: 42, widen: Top, narrow: 42, concrete: [42]
		});
		assertAbstractDomain(create, Top, 42, {
			equal: false, leq: false, join: Top, meet: 42, widen: Top, narrow: 42, concrete: Top
		});
	});

	const setTests = [{
		name:     'Bounded Set Domain',
		create:   (value: string[] | typeof Top) => new BoundedSetDomain(value) as AnyAbstractDomain,
		concrete: (...values: string[]) => values
	}, {
		name:     'Set Upper Bound Domain',
		create:   (value: string[] | typeof Top) => new SetUpperBoundDomain(value) as AnyAbstractDomain,
		concrete: (...values: string[]) => values.reduce((sets, value) => [...sets, ...sets.map(set => new Set([...set, value]))], [new Set()])
	}];

	for(const { name, create, concrete } of setTests) {
		describe(name, () => {
			assertAbstractDomain(create, [], [], {
				equal: true, leq: true, join: [], meet: [], widen: [], narrow: [], concrete: concrete()
			});
			assertAbstractDomain(create, Top, Top, {
				equal: true, leq: true, join: Top, meet: Top, widen: Top, narrow: Top, concrete: Top
			});
			assertAbstractDomain(create, [], Top, {
				equal: false, leq: true, join: Top, meet: [], widen: Top, narrow: [], concrete: concrete()
			});
			assertAbstractDomain(create, Top, [], {
				equal: false, leq: false, join: Top, meet: [], widen: Top, narrow: [], concrete: Top
			});
			assertAbstractDomain(create, [], ['id', 'age'], {
				equal: false, leq: true, join: ['id', 'age'], meet: [], widen: Top, narrow: [], concrete: concrete()
			});
			assertAbstractDomain(create, ['id', 'age'], [], {
				equal: false, leq: false, join: ['id', 'age'], meet: [], widen: ['id', 'age'], narrow: ['id', 'age'], concrete: concrete('id', 'age')
			});
			assertAbstractDomain(create, ['id', 'age'], ['age', 'id'], {
				equal: true, leq: true, join: ['id', 'age'], meet: ['id', 'age'], widen: ['id', 'age'], narrow: ['id', 'age'], concrete: concrete('id', 'age')
			});
			assertAbstractDomain(create, ['id', 'age'], ['id', 'age', 'score'], {
				equal: false, leq: true, join: ['id', 'age', 'score'], meet: ['id', 'age'], widen: Top, narrow: ['id', 'age'], concrete: concrete('id', 'age')
			});
			assertAbstractDomain(create, ['id', 'age', 'score'], ['id', 'age'], {
				equal: false, leq: false, join: ['id', 'age', 'score'], meet: ['id', 'age'], widen: ['id', 'age', 'score'], narrow: ['id', 'age', 'score'], concrete: concrete('id', 'age', 'score')
			});
			assertAbstractDomain(create, ['id', 'age', 'score'], ['id', 'category'], {
				equal: false, leq: false, join: ['id', 'age', 'score', 'category'], meet: ['id'], widen: Top, narrow: ['id', 'age', 'score'], concrete: concrete('id', 'age', 'score')
			});
			assertAbstractDomain(create, ['id', 'category'], ['id', 'age', 'score'], {
				equal: false, leq: false, join: ['id', 'age', 'score', 'category'], meet: ['id'], widen: Top, narrow: ['id', 'category'], concrete: concrete('id', 'category')
			});
			assertAbstractDomain(create, ['id', 'age'], Top, {
				equal: false, leq: true, join: Top, meet: ['id', 'age'], widen: Top, narrow: ['id', 'age'], concrete: concrete('id', 'age')
			});
			assertAbstractDomain(create, Top, ['id', 'age'], {
				equal: false, leq: false, join: Top, meet: ['id', 'age'], widen: Top, narrow: ['id', 'age'], concrete: Top
			});
		});
	}

	describe('Set Range Domain', () => {
		const create = (value: ArrayRangeValue<string> | typeof Bottom) => new SetRangeDomain(value);

		const concrete = (...lists: string[][]) => lists.map(list => new Set(list));

		assertAbstractDomain(create, Bottom, Bottom, {
			equal: true, leq: true, join: Bottom, meet: Bottom, widen: Bottom, narrow: Bottom, concrete: []
		});
		assertAbstractDomain(create, [[], Top], [[], Top], {
			equal: true, leq: true, join: [[], Top], meet: [[], Top], widen: [[], Top], narrow: [[], Top], concrete: Top
		});
		assertAbstractDomain(create, Bottom, [[], Top], {
			equal: false, leq: true, join: [[], Top], meet: Bottom, widen: [[], Top], narrow: Bottom, concrete: []
		});
		assertAbstractDomain(create, [[], Top], Bottom, {
			equal: false, leq: false, join: [[], Top], meet: Bottom, widen: [[], Top], narrow: Bottom, concrete: Top
		});
		assertAbstractDomain(create, Bottom, [['id'], ['name', 'age']], {
			equal: false, leq: true, join: [['id'], ['name', 'age']], meet: Bottom, widen: [['id'], ['name', 'age']], narrow: Bottom, concrete: []
		});
		assertAbstractDomain(create, [['id'], ['name', 'age']], Bottom, {
			equal: false, leq: false, join: [['id'], ['name', 'age']], meet: Bottom, widen: [['id'], ['name', 'age']], narrow: Bottom, concrete: concrete(['id'], ['id', 'name'], ['id', 'age'], ['id', 'name', 'age'])
		});
		assertAbstractDomain(create, [[], []], [['id'], ['name', 'age']], {
			equal: false, leq: false, join: [[], ['id', 'name', 'age']], meet: Bottom, widen: [[], Top], narrow: Bottom, concrete: concrete([])
		});
		assertAbstractDomain(create, [['id'], ['name', 'age']], [[], []], {
			equal: false, leq: false, join: [[], ['id', 'name', 'age']], meet: Bottom, widen: [[], ['id', 'name', 'age']], narrow: Bottom, concrete: concrete(['id'], ['id', 'name'], ['id', 'age'], ['id', 'name', 'age'])
		});
		assertAbstractDomain(create, [[], ['id']], [['id'], ['name', 'age']], {
			equal: false, leq: false, join: [[], ['id', 'name', 'age']], meet: [['id'], []], widen: [[], Top], narrow: [['id'], []], concrete: concrete([], ['id'])
		});
		assertAbstractDomain(create, [['id'], ['name', 'age']], [[], ['id']], {
			equal: false, leq: false, join: [[], ['id', 'name', 'age']], meet: [['id'], []], widen: [[], ['id', 'name', 'age']], narrow: [['id'], ['name', 'age']], concrete: concrete(['id'], ['id', 'name'], ['id', 'age'], ['id', 'name', 'age'])
		});
		assertAbstractDomain(create, [['id'], ['name']], [[], ['id', 'name', 'age']], {
			equal: false, leq: true, join: [[], ['id', 'name', 'age']], meet: [['id'], ['name']], widen: [[], Top], narrow: [['id'], ['name']], concrete: concrete(['id'], ['id', 'name'])
		});
		assertAbstractDomain(create, [[], ['id', 'name', 'age']], [['id'], ['name']], {
			equal: false, leq: false, join: [[], ['id', 'name', 'age']], meet: [['id'], ['name']], widen: [[], ['id', 'name', 'age']], narrow: [['id'], ['name', 'age']], concrete: concrete([], ['id'], ['name'], ['id', 'name'], ['age'], ['id', 'age'], ['name', 'age'], ['id', 'name', 'age'])
		});
		assertAbstractDomain(create, [[], ['score']], [['id'], ['name', 'age']], {
			equal: false, leq: false, join: [[], ['id', 'name', 'age', 'score']], meet: Bottom, widen: [[], Top], narrow: Bottom, concrete: concrete([], ['score'])
		});
		assertAbstractDomain(create, [['id'], ['name', 'age']], [[], ['score']], {
			equal: false, leq: false, join: [[], ['id', 'name', 'age', 'score']], meet: Bottom, widen: [[], Top], narrow: Bottom, concrete: concrete(['id'], ['id', 'name'], ['id', 'age'], ['id', 'name', 'age'])
		});
		assertAbstractDomain(create, [['id'], []], [['id'], ['name', 'age']], {
			equal: false, leq: true, join: [['id'], ['name', 'age']], meet: [['id'], []], widen: [['id'], Top], narrow: [['id'], []], concrete: concrete(['id'])
		});
		assertAbstractDomain(create, [['id'], ['name', 'age']], [['id'], []], {
			equal: false, leq: false, join: [['id'], ['name', 'age']], meet: [['id'], []], widen: [['id'], ['name', 'age']], narrow: [['id'], ['name', 'age']], concrete: concrete(['id'], ['id', 'name'], ['id', 'age'], ['id', 'name', 'age'])
		});
		assertAbstractDomain(create, [['id'], ['name', 'age', 'score']], [['id', 'name'], ['age']], {
			equal: false, leq: false, join: [['id'], ['name', 'age', 'score']], meet: [['id', 'name'], ['age']], widen: [['id'], ['name', 'age', 'score']], narrow: [['id'], ['name', 'age', 'score']], concrete: concrete(['id'], ['id', 'name'], ['id', 'age'], ['id', 'name', 'age'], ['id', 'score'], ['id', 'name', 'score'], ['id', 'age', 'score'], ['id', 'name', 'age', 'score'])
		});
		assertAbstractDomain(create, [['id', 'name'], ['age']], [['id'], ['name', 'age', 'score']], {
			equal: false, leq: true, join: [['id'], ['name', 'age', 'score']], meet: [['id', 'name'], ['age']], widen: [[], Top], narrow: [['id', 'name'], ['age']], concrete: concrete(['id', 'name'], ['id', 'name', 'age'])
		});
		assertAbstractDomain(create, [['id'], []], [[], ['name', 'age']], {
			equal: false, leq: false, join: [[], ['id', 'name', 'age']], meet: Bottom, widen: [[], Top], narrow: Bottom, concrete: concrete(['id'])
		});
		assertAbstractDomain(create, [[], ['name', 'age']], [['id'], []], {
			equal: false, leq: false, join: [[], ['id', 'name', 'age']], meet: Bottom, widen: [[], Top], narrow: Bottom, concrete: concrete([], ['name'], ['age'], ['name', 'age'])
		});
		assertAbstractDomain(create, [['id', 'name'], Top], [['id'], []], {
			equal: false, leq: false, join: [['id'], Top], meet: Bottom, widen: [[], Top], narrow: Bottom, concrete: Top, abstract: [[], Top]
		});
		assertAbstractDomain(create, [['id'], []], [['id', 'name'], Top], {
			equal: false, leq: false, join: [['id'], Top], meet: Bottom, widen: [['id'], Top], narrow: Bottom, concrete: concrete(['id'])
		});
		assertAbstractDomain(create, [['id'], Top], [['id', 'name'], ['age']], {
			equal: false, leq: false, join: [['id'], Top], meet: [['id', 'name'], ['age']], widen: [['id'], Top], narrow: [['id'], ['name', 'age']], concrete: Top, abstract: [[], Top]
		});
		assertAbstractDomain(create, [['id', 'name'], ['age']], [['id'], Top], {
			equal: false, leq: true, join: [['id'], Top], meet: [['id', 'name'], ['age']], widen: [[], Top], narrow: [['id', 'name'], ['age']], concrete: concrete(['id', 'name'], ['id', 'name', 'age'])
		});
		assertAbstractDomain(create, [[], Top], [['id'], ['name', 'age']], {
			equal: false, leq: false, join: [[], Top], meet: [['id'], ['name', 'age']], widen: [[], Top], narrow: [['id'], ['name', 'age']], concrete: Top, abstract: [[], Top]
		});
		assertAbstractDomain(create, [['id'], ['name', 'age']], [[], Top], {
			equal: false, leq: true, join: [[], Top], meet: [['id'], ['name', 'age']], widen: [[], Top], narrow: [['id'], ['name', 'age']], concrete: concrete(['id'], ['id', 'name'], ['id', 'age'], ['id', 'name', 'age'])
		});
	});

	const intervalTests = [{
		name:   'Interval Domain',
		create: (value: AbstractDomainValue<IntervalDomain>) => new IntervalDomain(value),
		min:    IntervalTop[0],
		max:    IntervalTop[1]
	}, {
		name:   'Positive Interval Domain',
		create: (value: AbstractDomainValue<PosIntervalDomain>) => new PosIntervalDomain(value),
		min:    PosIntervalTop[0],
		max:    PosIntervalTop[1]
	}];

	for(const { name, create, min, max } of intervalTests) {
		describe(name, () => {
			assertAbstractDomain(create, Bottom, Bottom, {
				equal: true, leq: true, join: Bottom, meet: Bottom, widen: Bottom, narrow: Bottom, concrete: []
			});
			assertAbstractDomain(create, [min, max], [min, max], {
				equal: true, leq: true, join: [min, max], meet: [min, max], widen: [min, max], narrow: [min, max], concrete: Top
			});
			assertAbstractDomain(create, Bottom, [min, max], {
				equal: false, leq: true, join: [min, max], meet: Bottom, widen: [min, max], narrow: Bottom, concrete: []
			});
			assertAbstractDomain(create, [min, max], Bottom, {
				equal: false, leq: false, join: [min, max], meet: Bottom, widen: [min, max], narrow: Bottom, concrete: Top
			});
			assertAbstractDomain(create, Bottom, [2, 2], {
				equal: false, leq: true, join: [2, 2], meet: Bottom, widen: [2, 2], narrow: Bottom, concrete: []
			});
			assertAbstractDomain(create, [2, 2], Bottom, {
				equal: false, leq: false, join: [2, 2], meet: Bottom, widen: [2, 2], narrow: Bottom, concrete: [2]
			});
			assertAbstractDomain(create, Bottom, [2, 8], {
				equal: false, leq: true, join: [2, 8], meet: Bottom, widen: [2, 8], narrow: Bottom, concrete: []
			});
			assertAbstractDomain(create, [2, 8], Bottom, {
				equal: false, leq: false, join: [2, 8], meet: Bottom, widen: [2, 8], narrow: Bottom, concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [2, 8], [2, 8], {
				equal: true, leq: true, join: [2, 8], meet: [2, 8], widen: [2, 8], narrow: [2, 8], concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [0, 4], [2, 8], {
				equal: false, leq: false, join: [0, 8], meet: [2, 4], widen: [0, max], narrow: [min === 0 ? 2 : 0, 4], concrete: [0, 1, 2, 3, 4]
			});
			assertAbstractDomain(create, [2, 8], [0, 4], {
				equal: false, leq: false, join: [0, 8], meet: [2, 4], widen: [min, 8], narrow: [2, 8], concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [0, 0], [1, 3], {
				equal: false, leq: false, join: [0, 3], meet: Bottom, widen: [0, max], narrow: Bottom, concrete: [0]
			});
			assertAbstractDomain(create, [1, 3], [0, 0], {
				equal: false, leq: false, join: [0, 3], meet: Bottom, widen: [min, 3], narrow: Bottom, concrete: [1, 2, 3]
			});
			assertAbstractDomain(create, [2, 8], [4, 12], {
				equal: false, leq: false, join: [2, 12], meet: [4, 8], widen: [2, max], narrow: [2, 8], concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [4, 12], [2, 8], {
				equal: false, leq: false, join: [2, 12], meet: [4, 8], widen: [min, 12], narrow: [4, 12], concrete: [4, 5, 6, 7, 8, 9, 10, 11, 12]
			});
			assertAbstractDomain(create, [2, 8], [8, max], {
				equal: false, leq: false, join: [2, max], meet: [8, 8], widen: [2, max], narrow: [2, 8], concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [8, max], [2, 8], {
				equal: false, leq: false, join: [2, max], meet: [8, 8], widen: [min, max], narrow: [8, 8], concrete: Top, abstract: [min, max]
			});
			assertAbstractDomain(create, [2, 8], [2, 4], {
				equal: false, leq: false, join: [2, 8], meet: [2, 4], widen: [2, 8], narrow: [2, 8], concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [2, 4], [2, 8], {
				equal: false, leq: true, join: [2, 8], meet: [2, 4], widen: [2, max], narrow: [2, 4], concrete: [2, 3, 4]
			});
			assertAbstractDomain(create, [2, 8], [2, 2], {
				equal: false, leq: false, join: [2, 8], meet: [2, 2], widen: [2, 8], narrow: [2, 8], concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [2, 2], [2, 8], {
				equal: false, leq: true, join: [2, 8], meet: [2, 2], widen: [2, max], narrow: [2, 2], concrete: [2]
			});
			assertAbstractDomain(create, [2, 8], [0, 0], {
				equal: false, leq: false, join: [0, 8], meet: Bottom, widen: [min, 8], narrow: Bottom, concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [0, 0], [2, 8], {
				equal: false, leq: false, join: [0, 8], meet: Bottom, widen: [0, max], narrow: Bottom, concrete: [0]
			});
			assertAbstractDomain(create, [2, 8], [10, 12], {
				equal: false, leq: false, join: [2, 12], meet: Bottom, widen: [2, max], narrow: Bottom, concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [10, 12], [2, 8], {
				equal: false, leq: false, join: [2, 12], meet: Bottom, widen: [min, 12], narrow: Bottom, concrete: [10, 11, 12]
			});
			assertAbstractDomain(create, [0, 0], [12, max], {
				equal: false, leq: false, join: [0, max], meet: Bottom, widen: [0, max], narrow: Bottom, concrete: [0]
			});
			assertAbstractDomain(create, [12, max], [0, 0], {
				equal: false, leq: false, join: [0, max], meet: Bottom, widen: [min, max], narrow: Bottom, concrete: Top, abstract: [min, max]
			});
			assertAbstractDomain(create, [4, max], [12, max], {
				equal: false, leq: false, join: [4, max], meet: [12, max], widen: [4, max], narrow: [4, max], concrete: Top, abstract: [min, max]
			});
			assertAbstractDomain(create, [12, max], [4, max], {
				equal: false, leq: true, join: [4, max], meet: [12, max], widen: [min, max], narrow: [12, max], concrete: Top, abstract: [min, max]
			});
			assertAbstractDomain(create, [2, 8], [min, max], {
				equal: false, leq: true, join: [min, max], meet: [2, 8], widen: [min, max], narrow: [2, 8], concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [min, max], [2, 8], {
				equal: false, leq: false, join: [min, max], meet: [2, 8], widen: [min, max], narrow: [2, 8], concrete: Top
			});
			assertAbstractDomain(create, [12, max], [min, max], {
				equal: false, leq: true, join: [min, max], meet: [12, max], widen: [min, max], narrow: [12, max], concrete: Top, abstract: [min, max]
			});
			assertAbstractDomain(create, [min, max], [12, max], {
				equal: false, leq: false, join: [min, max], meet: [12, max], widen: [min, max], narrow: [12, max], concrete: Top
			});
		});
	}
});
