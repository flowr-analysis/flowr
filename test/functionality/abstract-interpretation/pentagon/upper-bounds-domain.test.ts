import { describe } from 'vitest';
import { assertAbstractDomain } from '../domains/domain';
import { UpperBoundsDomain } from '../../../../src/abstract-interpretation/pentagon/upper-bounds-domain';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';

describe('Weakly Relational Upper Bounds Domain', () => {
	const createDomain = (value: ReadonlyMap<NodeId, ReadonlySet<NodeId>> | typeof Bottom) => {
		return new UpperBoundsDomain(value);
	};

	const upperBounds = (entries: [NodeId, NodeId[]][]) => {
		return new Map(entries.map(([key, values]) => [key, new Set(values)]));
	};

	const UpperBoundsTop = new Map<NodeId, never>();

	assertAbstractDomain<ReadonlyMap<NodeId, ReadonlySet<NodeId>> | typeof Bottom, UpperBoundsDomain>(createDomain, Bottom, Bottom, {
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
		equal: false, leq: false, join: upperBounds([['V', ['W']]]), meet: upperBounds([['V', ['W']], ['W', ['V']]]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([['V', ['W']]])
	});

	// Compare {V <= {W}, W <= {V}} and V <= {W}
	assertAbstractDomain(createDomain, upperBounds([['V', ['W']], ['W', ['V']]]), upperBounds([['V', ['W']]]), {
		equal: false, leq: true, join: upperBounds([['V', ['W']]]), meet: upperBounds([['V', ['W']], ['W', ['V']]]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([['V', ['W']]])
	});

	// Compare V <= {W} and W <= {X}
	assertAbstractDomain(createDomain, upperBounds([['V', ['W']]]), upperBounds([['W', [3]]]), {
		equal: false, leq: false, join: UpperBoundsTop, meet: upperBounds([['V', ['W']], ['W', [3]]]), concrete: Top, abstract: UpperBoundsTop, widen: UpperBoundsTop
	});

	// Compare V <= {W} and {V <= {X}, W <= {X}}
	assertAbstractDomain(createDomain, upperBounds([['V', ['W']]]), upperBounds([['V', [3]], ['W', [3]]]), {
		equal: false, leq: false, join: UpperBoundsTop, meet: upperBounds([['V', ['W', 3]], ['W', [3]]]), concrete: Top, abstract: UpperBoundsTop, widen: UpperBoundsTop
	});
});