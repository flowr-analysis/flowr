import { describe } from 'vitest';
import type { AbstractValue } from '../../../src/abstract-interpretation/domains/abstract-domain';
import { assertAbstractDomain } from '../abstract-interpretation/domains/domain';
import { Bottom, Top } from '../../../src/abstract-interpretation/domains/lattice';
import { FiniteDomainBuilder } from '../../../src/taint-analysis/builder/domain';
import type { FiniteDomain } from '../../../src/taint-analysis/finite-domain';

describe('Finite Domain', () => {
	const minimalDomain = new FiniteDomainBuilder().addLeqOrder(Bottom, Top).build();
	const create = (value: AbstractValue<FiniteDomain<symbol, typeof Top, typeof Bottom>>) => minimalDomain.create(value);

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

	// TODO More complex cases
});