import { describe, expect, test } from 'vitest';
import { ClosedPentagonDomain } from '../../../../src/abstract-interpretation/pentagon/closed-pentagon-domain';
import { assertAbstractDomain } from '../domains/domain';
import { IntervalDomain } from '../../../../src/abstract-interpretation/domains/interval-domain';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	UpperBoundsValueDomain
} from '../../../../src/abstract-interpretation/pentagon/upper-bounds/upper-bounds-value-domain';
import { ClosedPentagonValueDomain } from '../../../../src/abstract-interpretation/pentagon/closed-pentagon-value-domain';
import { isNotUndefined } from '../../../../src/util/assert';

type PentagonTestType = typeof Bottom | [NodeId, [interval: [l: number, r: number], upperBounds: NodeId[]]][];

describe('Weakly Relational Closed Pentagon Domain', () => {
	const createDomain = (entries: PentagonTestType) => {
		if(entries === Bottom) {
			return ClosedPentagonDomain.bottom(ClosedPentagonValueDomain.bottom());
		}
		return new ClosedPentagonDomain(
			new Map(entries.map(([key, [interval, upperBounds]]): [NodeId, ClosedPentagonValueDomain] => [key, new ClosedPentagonValueDomain({
				interval:    new IntervalDomain(interval),
				upperBounds: new UpperBoundsValueDomain(new Set(upperBounds))
			})])),
			ClosedPentagonValueDomain.top()
		);
	};

	const ClosedPentagonTop: PentagonTestType = [];
	const ClosedPentagonBottom: PentagonTestType = Bottom;

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
	assertAbstractDomain(createDomain, [['V', [[0, 10], ['V', 'W']]]], [['V', [[0, 10], ['W']]]], {
		equal: true, leq: true, join: [['V', [[0, 10], ['V', 'W']]]], meet: [['V', [[0, 10], ['V', 'W']]]], concrete: Top, abstract: ClosedPentagonTop, widen: [['V', [[0, 10], ['V', 'W']]]]
	});

	// Compare {V ∈ [0, 10], W ∈ [10, 15]} and {V ∈ [0, 10], W ∈ [10, 15]} => Should be equal and infer constraint V <= W
	assertAbstractDomain(createDomain, [['V', [[0, 10], []]], ['W', [[10, 15], []]]], [['V', [[0, 10], []]], ['W', [[10, 15], []]]], {
		equal: true, leq: true, join: [['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]], meet: [['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]], widen: [['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]], abstract: ClosedPentagonTop
	});

	// Compare {V ∈ [0, 10], W ∈ [10, 15]} and {V ∈ [0, 10], W ∈ [10, 15], V <= {W}} => Should be equal
	assertAbstractDomain(createDomain, [['V', [[0, 10], []]], ['W', [[10, 15], []]]], [['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]], {
		equal: true, leq: true, join: [['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]], meet: [['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]], widen: [['V', [[0, 10], ['W']]], ['W', [[10, 15], []]]], abstract: ClosedPentagonTop
	});

	// Compare {V ∈ [1, 1], W ∈ [1, 1]} and {V ∈ [1, 1], W ∈ [1, 1]} => Should be equal and infer constraint V <= W and W <= V
	assertAbstractDomain(createDomain, [['V', [[1, 1], []]], ['W', [[1, 1], []]]], [['V', [[1, 1], []]], ['W', [[1, 1], []]]], {
		equal: true, leq: true, join: [['V', [[1, 1], ['W']]], ['W', [[1, 1], ['V']]]], meet: [['V', [[1, 1], ['W']]], ['W', [[1, 1], ['V']]]], widen: [['V', [[1, 1], ['W']]], ['W', [[1, 1], ['V']]]], abstract: ClosedPentagonTop
	});

	describe('Class Tests', () => {
		test('All values shall be copied when creating a new ClosedPentagonDomain', () => {
			const a = new ClosedPentagonDomain(new Map([[ 1, new ClosedPentagonValueDomain( { interval: new IntervalDomain([1, 1]), upperBounds: new UpperBoundsValueDomain(new Set()) } ) ]]), ClosedPentagonValueDomain.top());

			const b = a.create(a.value);

			const pentagon = a.get(1);
			pentagon?.value.upperBounds.add(3);
			if(isNotUndefined(pentagon)) {
				a.set(1, pentagon);
			}

			expect(a).not.toEqual(b);
		});
	});
});