import { describe } from 'vitest';
import type { AbstractDomainValue, AnyAbstractDomain } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { BoundedSetDomain } from '../../../../src/abstract-interpretation/domains/bounded-set-domain';
import { IntervalDomain, IntervalTop } from '../../../../src/abstract-interpretation/domains/interval-domain';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { PosIntervalDomain, PosIntervalTop } from '../../../../src/abstract-interpretation/domains/positive-interval-domain';
import { SingletonDomain } from '../../../../src/abstract-interpretation/domains/singleton-domain';
import { assertAbstractDomain } from './domain';

describe('Abstract Domains', () => {
	describe('Singleton Domain', () => {
		const create = (value: AbstractDomainValue<SingletonDomain<number>>) => new SingletonDomain<number>(value);

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

	describe('Bounded Set Domain', () => {
		const create = (value: string[] | typeof Top) =>
			new BoundedSetDomain<string>(value === Top ? Top : new Set(value));

		assertAbstractDomain(create, [], [], {
			equal: true, leq: true, join: [], meet: [], widen: [], narrow: [], concrete: []
		});
		assertAbstractDomain(create, Top, Top, {
			equal: true, leq: true, join: Top, meet: Top, widen: Top, narrow: Top, concrete: Top
		});
		assertAbstractDomain(create, [], Top, {
			equal: false, leq: true, join: Top, meet: [], widen: Top, narrow: [], concrete: []
		});
		assertAbstractDomain(create, Top, [], {
			equal: false, leq: false, join: Top, meet: [], widen: Top, narrow: [], concrete: Top
		});
		assertAbstractDomain(create, [], ['id', 'age'], {
			equal: false, leq: true, join: ['id', 'age'], meet: [], widen: Top, narrow: [], concrete: []
		});
		assertAbstractDomain(create, ['id', 'age'], [], {
			equal: false, leq: false, join: ['id', 'age'], meet: [], widen: ['id', 'age'], narrow: ['id', 'age'], concrete: ['id', 'age']
		});
		assertAbstractDomain(create, ['id', 'age'], ['age', 'id'], {
			equal: true, leq: true, join: ['id', 'age'], meet: ['id', 'age'], widen: ['id', 'age'], narrow: ['id', 'age'], concrete: ['id', 'age']
		});
		assertAbstractDomain(create, ['id', 'age'], ['id', 'age', 'score'], {
			equal: false, leq: true, join: ['id', 'age', 'score'], meet: ['id', 'age'], widen: Top, narrow: ['id', 'age'], concrete: ['id', 'age']
		});
		assertAbstractDomain(create, ['id', 'age', 'score'], ['id', 'age'], {
			equal: false, leq: false, join: ['id', 'age', 'score'], meet: ['id', 'age'], widen: ['id', 'age', 'score'], narrow: ['id', 'age', 'score'], concrete: ['id', 'age', 'score']
		});
		assertAbstractDomain(create, ['id', 'age', 'score'], ['id', 'category'], {
			equal: false, leq: false, join: ['id', 'age', 'score', 'category'], meet: ['id'], widen: Top, narrow: ['id', 'age', 'score'], concrete: ['id', 'age', 'score']
		});
		assertAbstractDomain(create, ['id', 'category'], ['id', 'age', 'score'], {
			equal: false, leq: false, join: ['id', 'age', 'score', 'category'], meet: ['id'], widen: Top, narrow: ['id', 'category'], concrete: ['id', 'category']
		});
		assertAbstractDomain(create, ['id', 'age'], Top, {
			equal: false, leq: true, join: Top, meet: ['id', 'age'], widen: Top, narrow: ['id', 'age'], concrete: ['id', 'age']
		});
		assertAbstractDomain(create, Top, ['id', 'age'], {
			equal: false, leq: false, join: Top, meet: ['id', 'age'], widen: Top, narrow: ['id', 'age'], concrete: Top
		});
	});

	interface IntervalTest {
		name:   string,
		create: (value: AbstractDomainValue<IntervalDomain>) => AnyAbstractDomain,
		min:    number,
		max:    number
	}

	const intervalTests: IntervalTest[] = [{
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
			assertAbstractDomain(create, [2, 8], [0, 4], {
				equal: false, leq: false, join: [0, 8], meet: [2, 4], widen: [min, 8], narrow: [2, 8], concrete: [2, 3, 4, 5, 6, 7, 8]
			});
			assertAbstractDomain(create, [0, 4], [2, 8], {
				equal: false, leq: false, join: [0, 8], meet: [2, 4], widen: [0, max], narrow: [min === 0 ? 2 : 0, 4], concrete: [0, 1, 2, 3, 4]
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
