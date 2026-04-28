import { describe } from 'vitest';
import { assertAbstractDomain } from '../domains/domain';
import { UpperBoundsDomain } from '../../../../src/abstract-interpretation/pentagon/upper-bounds-domain';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import type { StateDomainLift } from '../../../../src/abstract-interpretation/domains/state-abstract-domain';
import { UpperBoundsValueDomain } from '../../../../src/abstract-interpretation/pentagon/upper-bounds-value-domain';

describe('Weakly Relational Upper Bounds Domain', () => {
	const createDomain = (value: StateDomainLift<UpperBoundsValueDomain>) => {
		return new UpperBoundsDomain(value);
	};

	const upperBounds = (entries: [NodeId, NodeId[]][]): StateDomainLift<UpperBoundsValueDomain> => {
		return new Map(entries.map(([key, values]): [NodeId, UpperBoundsValueDomain] => [key, new UpperBoundsValueDomain(new Set(values))]));
	};

	const UpperBoundsTop = new Map<NodeId, never>();

	assertAbstractDomain(createDomain, Bottom, Bottom, {
		equal: true, leq: true, join: Bottom, meet: Bottom, concrete: [], abstract: Bottom, widen: Bottom
	});

	assertAbstractDomain(createDomain, UpperBoundsTop, UpperBoundsTop, {
		equal: true, leq: true, join: UpperBoundsTop, meet: UpperBoundsTop, concrete: Top, abstract: UpperBoundsTop, widen: UpperBoundsTop
	});

	assertAbstractDomain(createDomain, Bottom, UpperBoundsTop, {
		equal: false, leq: true, join: UpperBoundsTop, meet: Bottom, concrete: [], abstract: Bottom, widen: UpperBoundsTop
	});

	assertAbstractDomain(createDomain, UpperBoundsTop, Bottom, {
		equal: false, leq: false, join: UpperBoundsTop, meet: Bottom, concrete: Top, abstract: UpperBoundsTop, widen: UpperBoundsTop
	});

	// Demonstrate that V <= {V, W} is treated the same as V <= {W}
	assertAbstractDomain(createDomain, upperBounds([['V', ['V', 'W']]]), upperBounds([['V', ['W']]]), {
		equal: true, leq: true, join: upperBounds([['V', ['W']]]), meet: upperBounds([['V', ['V', 'W']]]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([['V', ['V', 'W']]])
	});

	assertAbstractDomain(createDomain, upperBounds([['V', ['W']]]), upperBounds([['V', ['V', 'W']]]), {
		equal: true, leq: true, join: upperBounds([['V', ['W']]]), meet: upperBounds([['V', ['V', 'W']]]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([['V', ['V', 'W']]])
	});

	// Compare V <= {W} and {V <= {W}, W <= {V}}
	assertAbstractDomain(createDomain, upperBounds([['V', ['W']]]), upperBounds([['V', ['W']], ['W', ['V']]]), {
		equal: false, leq: true, join: upperBounds([['V', ['W']], ['W', ['V']]]), meet: upperBounds([['V', ['W']]]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([['V', ['W']], ['W', ['V']]])
	});

	// Compare {V <= {W}, W <= {}} and {V <= {W}, W <= {V}}
	assertAbstractDomain(createDomain, upperBounds([['V', ['W']], ['W', []]]), upperBounds([['V', ['W']], ['W', ['V']]]), {
		equal: false, leq: false, join: upperBounds([['V', ['W']], ['W', []]]), meet: upperBounds([['V', ['W']], ['W', ['V']]]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([['V', ['W']], ['W', []]])
	});

	// Compare {V <= {W}, W <= {V}} and V <= {W}
	assertAbstractDomain(createDomain, upperBounds([['V', ['W']], ['W', ['V']]]), upperBounds([['V', ['W']]]), {
		equal: false, leq: false, join: upperBounds([['V', ['W']], ['W', ['V']]]), meet: upperBounds([['V', ['W']]]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([['V', ['W']], ['W', ['V']]])
	});

	// Compare V <= {W} and W <= {X}
	assertAbstractDomain(createDomain, upperBounds([['V', ['W']]]), upperBounds([['W', ['X']]]), {
		equal: false, leq: false, join: upperBounds([['V', ['W']], ['W', ['X']]]), meet: upperBounds([]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([['V', ['W']], ['W', ['X']]])
	});

	// Compare V <= {W} and {V <= {X}, W <= {X}}
	assertAbstractDomain(createDomain, upperBounds([['V', ['W']]]), upperBounds([['V', ['X']], ['W', ['X']]]), {
		equal: false, leq: false, join: upperBounds([['V', []], ['W', ['X']]]), meet: upperBounds([['V', ['W', 'X']]]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([['V', []], ['W', ['X']]])
	});
});