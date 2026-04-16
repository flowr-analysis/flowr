import { describe } from 'vitest';
import { assertAbstractDomain } from '../domains/domain';
import { UpperBoundsDomain } from '../../../../src/abstract-interpretation/interval/upper-bounds-domain';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';

describe('Weakly Relational Upper Bounds Domain', () => {
	const createDomain = (value: ReadonlyMap<NodeId, ReadonlySet<NodeId>> | typeof Bottom) => {
		return new UpperBoundsDomain(value);
	};

	const upperBounds = (entries: [number, number[]][]) => {
		return new Map(entries.map(([key, values]) => [key as NodeId, new Set(values as NodeId[])]));
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
	assertAbstractDomain(createDomain, new Map([[1 as NodeId, new Set([1 as NodeId, 2 as NodeId])]]), new Map([[1 as NodeId, new Set([2 as NodeId])]]), {
		equal: true, leq: true, join: new Map([[1 as NodeId, new Set([2 as NodeId])]]), meet: new Map([[1 as NodeId, new Set([1 as NodeId, 2 as NodeId])]]), concrete: Top, abstract: UpperBoundsTop, widen: new Map([[1 as NodeId, new Set([1 as NodeId, 2 as NodeId])]])
	});

	assertAbstractDomain(createDomain, new Map([[1 as NodeId, new Set([2 as NodeId])]]), new Map([[1 as NodeId, new Set([1 as NodeId, 2 as NodeId])]]), {
		equal: true, leq: true, join: new Map([[1 as NodeId, new Set([2 as NodeId])]]), meet: new Map([[1 as NodeId, new Set([1 as NodeId, 2 as NodeId])]]), concrete: Top, abstract: UpperBoundsTop, widen: new Map([[1 as NodeId, new Set([1 as NodeId, 2 as NodeId])]])
	});

	// Compare V <= {W} and {V <= {W}, W <= {V}}
	assertAbstractDomain(createDomain, new Map([[1 as NodeId, new Set<NodeId>([2 as NodeId])]]), new Map([[1 as NodeId, new Set<NodeId>([2 as NodeId])], [2 as NodeId, new Set<NodeId>([1 as NodeId])]]), {
		equal: false, leq: false, join: new Map([[1 as NodeId, new Set([2 as NodeId])]]), meet: new Map([[1 as NodeId, new Set([2 as NodeId])], [2 as NodeId, new Set([1 as NodeId])]]), concrete: Top, abstract: UpperBoundsTop, widen: new Map([[1 as NodeId, new Set([2 as NodeId])]])
	});

	// Compare {V <= {W}, W <= {V}} and V <= {W}
	assertAbstractDomain(createDomain, upperBounds([[1, [2]], [2, [1]]]), upperBounds([[1, [2]]]), {
		equal: false, leq: true, join: upperBounds([[1, [2]]]), meet: upperBounds([[1, [2]], [2, [1]]]), concrete: Top, abstract: UpperBoundsTop, widen: upperBounds([[1, [2]]])
	});

	// Compare V <= {W} and W <= {X}
	assertAbstractDomain(createDomain, upperBounds([[1, [2]]]), upperBounds([[2, [3]]]), {
		equal: false, leq: false, join: UpperBoundsTop, meet: upperBounds([[1, [2]], [2, [3]]]), concrete: Top, abstract: UpperBoundsTop, widen: UpperBoundsTop
	});

	// Compare V <= {W} and {V <= {X}, W <= {X}}
	assertAbstractDomain(createDomain, upperBounds([[1, [2]]]), upperBounds([[1, [3]], [2, [3]]]), {
		equal: false, leq: false, join: UpperBoundsTop, meet: upperBounds([[1, [2, 3]], [2, [3]]]), concrete: Top, abstract: UpperBoundsTop, widen: UpperBoundsTop
	});
});