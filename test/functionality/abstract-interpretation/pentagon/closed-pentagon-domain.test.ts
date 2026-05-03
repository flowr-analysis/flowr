import { describe } from 'vitest';
import { ClosedPentagonDomain } from '../../../../src/abstract-interpretation/pentagon/closed-pentagon-domain';
import { assertAbstractDomain } from '../domains/domain';
import { IntervalDomain } from '../../../../src/abstract-interpretation/domains/interval-domain';
import type {
	StateDomainBottom,
	StateDomainLift,
	StateDomainTop
} from '../../../../src/abstract-interpretation/domains/state-abstract-domain';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	UpperBoundsValueDomain
} from '../../../../src/abstract-interpretation/pentagon/upper-bounds/upper-bounds-value-domain';
import { ClosedPentagonValueDomain } from '../../../../src/abstract-interpretation/pentagon/closed-pentagon-value-domain';

describe('Weakly Relational Closed Pentagon Domain', () => {
	const createDomain = (value: StateDomainLift<ClosedPentagonValueDomain>) => {
		return new ClosedPentagonDomain(value, ClosedPentagonValueDomain.top());
	};

	const pentagon = (entries: [NodeId, [interval: [l: number, r: number], upperBounds: NodeId[]]][]): StateDomainLift<ClosedPentagonValueDomain> => {
		return new Map(entries.map(([key, [interval, upperBounds]]): [NodeId, ClosedPentagonValueDomain] => [key, new ClosedPentagonValueDomain({
			interval:    new IntervalDomain(interval),
			upperBounds: new UpperBoundsValueDomain(new Set(upperBounds))
		})]));
	};

	const ClosedPentagonTop: StateDomainTop = new Map<NodeId, never>();
	const ClosedPentagonBottom: StateDomainBottom = Bottom;

	assertAbstractDomain(createDomain, ClosedPentagonTop, ClosedPentagonTop, {
		equal: true, leq: true, join: ClosedPentagonTop, meet: ClosedPentagonTop, concrete: [new Map()], abstract: ClosedPentagonTop, widen: ClosedPentagonTop
	});

	assertAbstractDomain(createDomain, ClosedPentagonTop, ClosedPentagonBottom, {
		equal: false, leq: false, join: ClosedPentagonTop, meet: ClosedPentagonBottom, concrete: [new Map()], abstract: ClosedPentagonTop, widen: ClosedPentagonTop
	});

	assertAbstractDomain(createDomain, ClosedPentagonBottom, ClosedPentagonTop, {
		equal: false, leq: true, join: ClosedPentagonTop, meet: ClosedPentagonBottom, concrete: [], abstract: ClosedPentagonBottom, widen: ClosedPentagonTop
	});

	assertAbstractDomain(createDomain, ClosedPentagonBottom, ClosedPentagonBottom, {
		equal: true, leq: true, join: ClosedPentagonBottom, meet: ClosedPentagonBottom, concrete: [], abstract: ClosedPentagonBottom, widen: ClosedPentagonBottom
	});

	// Compare {V ∈ [0, 10], V <= {V, W}} and {V ∈ [0, 10], V <= {W}}
	assertAbstractDomain(createDomain, pentagon([['V', [[0, 10], ['V', 'W']]]]), pentagon([['V', [[0, 10], ['W']]]]), {
		equal: true, leq: true, join: pentagon([['V', [[0, 10], ['V', 'W']]]]), meet: pentagon([['V', [[0, 10], ['V', 'W']]]]), concrete: Top, abstract: ClosedPentagonTop, widen: pentagon([['V', [[0, 10], ['V', 'W']]]])
	});

	// Compare {V ∈ [0, 10], W ∈ [10, 15]} and {V ∈ [0, 10], W ∈ [10, 15]} => Should be equal and infer constraint V <= W
	assertAbstractDomain(createDomain, pentagon([['V', [[0, 10], []]], ['W', [[10, 15], []]]]), pentagon([['V', [[0, 10], []]], ['W', [[10, 15], []]]]), {
		equal: true, leq: true, join: pentagon([['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]]), meet: pentagon([['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]]), widen: pentagon([['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]]), abstract: ClosedPentagonTop
	});

	// Compare {V ∈ [0, 10], W ∈ [10, 15]} and {V ∈ [0, 10], W ∈ [10, 15], V <= {W}} => Should be equal
	assertAbstractDomain(createDomain, pentagon([['V', [[0, 10], []]], ['W', [[10, 15], []]]]), pentagon([['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]]), {
		equal: true, leq: true, join: pentagon([['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]]), meet: pentagon([['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]]), widen: pentagon([['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]]), abstract: ClosedPentagonTop
	});

	// Compare {V ∈ [1, 1], W ∈ [1, 1]} and {V ∈ [1, 1], W ∈ [1, 1]} => Should be equal and infer constraint V <= W and W <= V
	assertAbstractDomain(createDomain, pentagon([['V', [[1, 1], []]], ['W', [[1, 1], []]]]), pentagon([['V', [[1, 1], []]], ['W', [[1, 1], []]]]), {
		equal: true, leq: true, join: pentagon([['V', [[1, 1], ['W']]], ['W', [[1, 1], ['V']]]]), meet: pentagon([['V', [[1, 1], ['W']]], ['W', [[1, 1], ['V']]]]), widen: pentagon([['V', [[1, 1], ['W']]], ['W', [[1, 1], ['V']]]]), abstract: ClosedPentagonTop
	});
});