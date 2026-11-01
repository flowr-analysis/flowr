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
});
