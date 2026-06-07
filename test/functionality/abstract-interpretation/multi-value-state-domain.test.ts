import { assert, describe, test } from 'vitest';
import { MultiValueDomain, MultiValueStateDomain } from '../../../src/abstract-interpretation/domains/multi-value-state-domain';
import type { Reduction } from '../../../src/abstract-interpretation/domains/multi-value-state-domain';
import { IntervalDomain, IntervalTop } from '../../../src/abstract-interpretation/domains/interval-domain';
import { Bottom } from '../../../src/abstract-interpretation/domains/lattice';

type Shape = { a: IntervalDomain, b: IntervalDomain };

const template = (): Shape => ({ a: new IntervalDomain(IntervalTop), b: new IntervalDomain(IntervalTop) });

/** Reduction that collapses both components to Bottom as soon as one of them is Bottom. */
const collapseToBottom: Reduction<Shape> = ({ a, b }) =>
	(a?.isBottom() || b?.isBottom()) ? { a: new IntervalDomain(Bottom), b: new IntervalDomain(Bottom) } : { a, b };

describe('MultiValueDomain', () => {
	test('constructs without reductions (regression: reduce must not throw during construction)', () => {
		const domain = template();
		// would previously throw "Cannot read properties of undefined (reading 'reduce')"
		assert.doesNotThrow(() => new MultiValueDomain<Shape>(domain, domain));
		assert.doesNotThrow(() => new MultiValueStateDomain<Shape>(new Map(), domain));
	});

	test('applies a reduction when constructing a value', () => {
		const domain = template();
		const value = new MultiValueDomain<Shape>({ a: new IntervalDomain([1, 2]), b: new IntervalDomain(Bottom) }, domain, [collapseToBottom]);

		assert.ok(value.value.a?.isBottom(), 'expected component a to be reduced to Bottom');
		assert.ok(value.value.b?.isBottom(), 'expected component b to remain Bottom');
	});

	test('applies a reduction through product operations (meet)', () => {
		const domain = template();
		const left = new MultiValueDomain<Shape>({ a: new IntervalDomain([1, 2]), b: new IntervalDomain([3, 4]) }, domain, [collapseToBottom]);
		const right = new MultiValueDomain<Shape>({ a: new IntervalDomain(Bottom), b: new IntervalDomain([3, 4]) }, domain, [collapseToBottom]);

		// meet of component a is Bottom -> the reduction must also collapse component b
		const result = left.meet(right);

		assert.ok(result.value.a?.isBottom(), 'expected component a to be Bottom after meet');
		assert.ok(result.value.b?.isBottom(), 'expected component b to be reduced to Bottom');
	});
});

describe('MultiValueStateDomain', () => {
	test('applies a reduction across setValue updates', () => {
		const domain = template();
		const state = new MultiValueStateDomain<Shape>(new Map(), domain, [collapseToBottom]);

		state.setValue(0, 'a', new IntervalDomain([1, 2]));
		state.setValue(0, 'b', new IntervalDomain(Bottom));

		assert.ok(state.getValue(0, 'a')?.isBottom(), 'expected component a to be reduced to Bottom');
		assert.ok(state.getValue(0, 'b')?.isBottom(), 'expected component b to be Bottom');
	});
});
