import { describe } from 'vitest';
import type { AbstractValue, AnyAbstractDomain } from '../../../src/abstract-interpretation/domains/abstract-domain';
import { assertAbstractDomain } from '../abstract-interpretation/domains/domain';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import type { SetLiftDomain } from '../../../src/taint-analysis/set-lift-domain';

function topAndBottomCases(create: (d: ReadonlySet<symbol>) => AnyAbstractDomain, top: ReadonlySet<symbol> = new Set([Top]), bottom: ReadonlySet<symbol> = new Set([Bottom])) {
	assertAbstractDomain(create, bottom, bottom, {
		equal: true, leq: true, join: bottom, meet: bottom, widen: bottom, narrow: bottom
	});
	assertAbstractDomain(create, top, top, {
		equal: true, leq: true, join: top, meet: top, widen: top, narrow: top
	});
	assertAbstractDomain(create, bottom, top, {
		equal: false, leq: true, join: top, meet: bottom, widen: top, narrow: bottom
	});
	assertAbstractDomain(create, top, bottom, {
		equal: false, leq: false, join: top, meet: bottom, widen: top, narrow: bottom
	});
	assertAbstractDomain(create, new Set([]), new Set([]), {
		equal: true, leq: true, join: bottom, meet: bottom, widen: bottom, narrow: bottom
	});
}

describe('SetLift Domain', () => {
	describe('Minimal Lattice', () => {
		const minimalDomain = new FiniteDomainBuilder().addLeqOrder(Bottom, Top).build().setLift();
		const create = (value: AbstractValue<SetLiftDomain<Top, Bottom, [symbol]>>) => minimalDomain.create(value);
		topAndBottomCases(create);
	});

	describe('Custom Top and Bottom', () => {
		const T = Symbol('T');
		const B = Symbol('B');

		const customTopAndBottom = new FiniteDomainBuilder()
			.setBottom(B)
			.setTop(T)
			.addLeqOrder(B, T)
			.build()
			.setLift();

		const create = (value: AbstractValue<SetLiftDomain<Top, Bottom, [symbol]>>) => customTopAndBottom.create(new Set(value));
		topAndBottomCases(create, new Set([T]), new Set([B]));
	});

	describe('More complex Lattice', () => {
		const A = Symbol('A');
		const B = Symbol('B');
		const C = Symbol('C');
		const D = Symbol('D');
		const E = Symbol('E');
		const F = Symbol('F');

		const lattice = new FiniteDomainBuilder() //           Top
			.addLeqOrder(Bottom, [A, B, C, D])    //          /   \
			.addLeqOrder(A, E)                    //         E     F
			.addLeqOrder(B, E)                    //       /  \   /  \
			.addLeqOrder(C, F)                    //      A    B C    D
			.addLeqOrder(D, F)                    //      \    | |    /
			.addLeqOrder(E, Top)                  //       \   | |   /
			.addLeqOrder(F, Top)                  //        \  | |  /
			.build()                              //           Bot
			.setLift();

		const create = (value: AbstractValue<SetLiftDomain<Top, Bottom, [symbol]>>) => lattice.create(new Set(value));
		topAndBottomCases(create);

		assertAbstractDomain(create, new Set([Bottom]), new Set([A]), {
			equal:  false,
			leq:    true,
			join:   new Set([A]),
			meet:   new Set([Bottom]),
			widen:  new Set([A]),
			narrow: new Set([Bottom])
		});

		assertAbstractDomain(create, new Set([A]), new Set([E]), {
			equal:  false,
			leq:    true,
			join:   new Set([E]),
			meet:   new Set([A]),
			widen:  new Set([E]),
			narrow: new Set([A])
		});

		assertAbstractDomain(create, new Set([A]), new Set([B]), {
			equal:  false,
			leq:    false,
			join:   new Set([E]),
			meet:   new Set([Bottom]),
			widen:  new Set([E]),
			narrow: new Set([Bottom])
		});

		assertAbstractDomain(create, new Set([E]), new Set([F]), {
			equal:  false,
			leq:    false,
			join:   new Set([E, F]),
			meet:   new Set([Bottom]),
			widen:  new Set([E, F]),
			narrow: new Set([Bottom])
		});

		assertAbstractDomain(create, new Set([A, B]), new Set([F]), {
			equal:  false,
			leq:    true,
			join:   new Set([A, B, F]), // or [E, F]
			meet:   new Set([Bottom]),
			widen:  new Set([A, B, F]),
			narrow: new Set([Bottom])
		});

		assertAbstractDomain(create, new Set([B]), new Set([C]), {
			equal:  false,
			leq:    false,
			join:   new Set([B, C]),
			meet:   new Set([Bottom]),
			widen:  new Set([B, C]),
			narrow: new Set([Bottom])
		});

	});
});
