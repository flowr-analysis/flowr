import { describe } from 'vitest';
import type { AbstractClosedPentagon } from '../../../../src/abstract-interpretation/interval/closed-pentagon-domain';
import { ClosedPentagonDomain } from '../../../../src/abstract-interpretation/interval/closed-pentagon-domain';
import { assertAbstractDomain } from '../domains/domain';
import { IntervalDomain } from '../../../../src/abstract-interpretation/domains/interval-domain';
import { UpperBoundsDomain } from '../../../../src/abstract-interpretation/interval/upper-bounds-domain';
import { StateAbstractDomain } from '../../../../src/abstract-interpretation/domains/state-abstract-domain';
import { Top } from '../../../../src/abstract-interpretation/domains/lattice';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('Weakly Relational Closed Pentagon Domain', () => {
	const createDomain = (value: AbstractClosedPentagon) => {
		return new ClosedPentagonDomain(value);
	};

	const pentagon = (entries: [NodeId, [interval: [l: number, r: number], upperBounds: NodeId[]]][]): AbstractClosedPentagon => {
		return {
			interval:    new StateAbstractDomain(new Map(entries.map(([key, [interval, _]]) => [key, new IntervalDomain(interval)])), IntervalDomain.top()),
			upperBounds: new UpperBoundsDomain(new Map(entries.map(([key, [_, upperBounds]]) => [key, new Set(upperBounds)])))
		};
	};

	const ClosedPentagonTop = { interval: StateAbstractDomain.top(IntervalDomain.top()), upperBounds: UpperBoundsDomain.top() } satisfies AbstractClosedPentagon;
	const ClosedPentagonBottom = { interval: StateAbstractDomain.bottom(IntervalDomain.bottom()), upperBounds: UpperBoundsDomain.bottom() } satisfies  AbstractClosedPentagon;

	assertAbstractDomain(createDomain, ClosedPentagonTop, ClosedPentagonTop, {
		equal: true, leq: true, join: ClosedPentagonTop, meet: ClosedPentagonTop, concrete: Top, abstract: ClosedPentagonTop, widen: ClosedPentagonTop
	});

	assertAbstractDomain(createDomain, ClosedPentagonTop, ClosedPentagonBottom, {
		equal: false, leq: false, join: ClosedPentagonTop, meet: ClosedPentagonBottom, concrete: Top, abstract: ClosedPentagonTop, widen: ClosedPentagonTop
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