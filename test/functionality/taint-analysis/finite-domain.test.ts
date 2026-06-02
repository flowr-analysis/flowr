import { describe } from 'vitest';
import type { AbstractValue, AnyAbstractDomain } from '../../../src/abstract-interpretation/domains/abstract-domain';
import { assertAbstractDomain } from '../abstract-interpretation/domains/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import type { FiniteDomain } from '../../../src/taint-analysis/finite-domain';

function topAndBottomCases(create: (d: symbol) => AnyAbstractDomain, top: symbol = Top, bottom: symbol = Bottom) {
	assertAbstractDomain(create, bottom, bottom, {
		equal: true, leq: true, join: bottom, meet: bottom, widen: bottom, narrow: bottom, concrete: [bottom]
	});
	assertAbstractDomain(create, top, top, {
		equal: true, leq: true, join: top, meet: top, widen: top, narrow: top, concrete: [top]
	});
	assertAbstractDomain(create, bottom, top, {
		equal: false, leq: true, join: top, meet: bottom, widen: top, narrow: bottom, concrete: [bottom]
	});
	assertAbstractDomain(create, top, bottom, {
		equal: false, leq: false, join: top, meet: bottom, widen: top, narrow: bottom, concrete: [top]
	});
}

describe('Finite Domain', () => {
	describe('Minimal Lattice', () => {
		const minimalDomain = new FiniteDomainBuilder().addLeqOrder(Bottom, Top).build();
		const create = (value: AbstractValue<FiniteDomain<Top, Bottom, [symbol]>>) => minimalDomain.create(value);
		topAndBottomCases(create);
	});


	describe('Custom Top and Bottom', () => {
		const T = Symbol('T');
		const B = Symbol('B');

		const customTopAndBottom = new FiniteDomainBuilder()
			.setBottom(B)
			.setTop(T)
			.addLeqOrder(B, T).build();

		const create = (value: AbstractValue<FiniteDomain<Top, Bottom, [symbol]>>) => customTopAndBottom.create(value);
		topAndBottomCases(create, T, B);
	});

	describe('More Complex Lattice', () => {
		const A = Symbol('A');
		const B = Symbol('B');
		const C = Symbol('C');
		const D = Symbol('D');

		const lattice = new FiniteDomainBuilder()
			.addLeqOrder(Bottom, [A, C])
			.addLeqOrder(A, B)
			.addLeqOrder(B, D)
			.addLeqOrder(C, D)
			.addLeqOrder(D, Top)
			.build();
		const create = (value: AbstractValue<FiniteDomain<Top, Bottom, [symbol]>>) => lattice.create(value);
		topAndBottomCases(create);

		assertAbstractDomain(create, Bottom, A, {
			equal: false, leq: true, join: A, meet: Bottom, widen: A, narrow: Bottom, concrete: [Bottom]
		});
		assertAbstractDomain(create, A, Bottom, {
			equal: false, leq: false, join: A, meet: Bottom, widen: A, narrow: Bottom, concrete: [A]
		});

		assertAbstractDomain(create, A, Top, {
			equal: false, leq: true, join: Top, meet: A, widen: Top, narrow: A, concrete: [A]
		});
		assertAbstractDomain(create, Top, A, {
			equal: false, leq: false, join: Top, meet: A, widen: Top, narrow: A, concrete: [Top]
		});

		assertAbstractDomain(create, A, C, {
			equal: false, leq: false, join: D, meet: Bottom, widen: D, narrow: Bottom, concrete: [A]
		});
		assertAbstractDomain(create, C, A, {
			equal: false, leq: false, join: D, meet: Bottom, widen: D, narrow: Bottom, concrete: [C]
		});

		assertAbstractDomain(create, B, C, {
			equal: false, leq: false, join: D, meet: Bottom, widen: D, narrow: Bottom, concrete: [B]
		});
		assertAbstractDomain(create, C, B, {
			equal: false, leq: false, join: D, meet: Bottom, widen: D, narrow: Bottom, concrete: [C]
		});
	});
});