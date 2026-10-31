import { describe } from 'vitest';
import type { AbstractValue, AnyAbstractDomain } from '../../../src/abstract-interpretation/domains/abstract-domain';
import { assertAbstractDomain } from '../abstract-interpretation/domains/domain';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import type { FiniteDomain } from '../../../src/taint-analysis/finite-domain';

function topAndBottomCases(create: (d: symbol) => AnyAbstractDomain, top: symbol = Top, bottom: symbol = Bottom) {
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
}

describe('Finite Domain', () => {
	describe('Minimal Lattice', () => {
		const minimalDomain = new FiniteDomainBuilder().addLeqOrder(Bottom, Top).build().setLift();
		const create = (value: AbstractValue<FiniteDomain<Top, Bottom, [symbol]>>) => minimalDomain.create(value);
		topAndBottomCases(create);
	});
});
