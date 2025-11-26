import { assert, test } from 'vitest';
import { DEFAULT_INFERENCE_LIMIT, type AnyAbstractDomain, type ConcreteDomain } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { Top } from '../../../../src/abstract-interpretation/domains/lattice';

export interface DomainTestExpectation<ConcreteValue, AbstractValue>{
    readonly equal:     boolean,
    readonly leq:       boolean,
    readonly join:      AbstractValue,
    readonly meet:      AbstractValue,
    readonly widen:     AbstractValue,
    readonly narrow:    AbstractValue,
    readonly concrete:  ConcreteValue[] | typeof Top,
    readonly abstract?: AbstractValue
}


/**
 *
 */
export function assertAbstractDomain<AbstractValue, Domain extends AnyAbstractDomain>(
	create: (value: AbstractValue) => Domain,
	value1: AbstractValue,
	value2: AbstractValue,
	expected: DomainTestExpectation<ConcreteDomain<Domain>, AbstractValue>
) {
	const domain1 = create(value1);
	const domain2 = create(value2);
	const join = create(expected.join);
	const meet = create(expected.meet);
	const widen = create(expected.widen);
	const narrow = create(expected.narrow);
	const concrete = expected.concrete === Top ? Top : new Set(expected.concrete);
	const abstract = create(expected.abstract ?? value1);

	test(`${domain1.toString()} = ${domain2.toString()}`, () => {
		assert.strictEqual(domain1.equals(domain2), expected.equal);
	});
	test(`${domain1.toString()} ⊑ ${domain2.toString()}`, () => {
		assert.strictEqual(domain1.leq(domain2), expected.leq);
	});
	test(`${domain1.toString()} ⊔ ${domain2.toString()}`, () => {
		assert.isTrue(domain1.join(domain2).equals(join), `expected ${join.toString()} but was ${domain1.join(domain2).toString()}`);
		assert.isTrue(domain1.leq(domain1.join(domain2)), `expected ${domain1.toString()} to be less than or equal to join ${domain1.join(domain2).toString()}`);
		assert.isTrue(domain2.leq(domain1.join(domain2)), `expected ${domain2.toString()} to be less than or equal to join ${domain1.join(domain2).toString()}`);
	});
	test(`${domain1.toString()} ⊓ ${domain2.toString()}`, () => {
		assert.isTrue(domain1.meet(domain2).equals(meet), `expected ${meet.toString()} but was ${domain1.meet(domain2).toString()}`);
		assert.isTrue(domain1.meet(domain2).leq(domain1), `expected meet ${domain1.meet(domain2).toString()} to be less than or equal to ${domain1.toString()}`);
		assert.isTrue(domain1.meet(domain2).leq(domain2), `expected meet ${domain1.meet(domain2).toString()} to be less than or equal to ${domain2.toString()}`);
	});
	test(`${domain1.toString()} ▽ ${domain2.toString()}`, () => {
		assert.isTrue(domain1.widen(domain2).equals(widen), `expected ${widen.toString()} but was ${domain1.widen(domain2).toString()}`);
		assert.isTrue(domain1.join(domain2).leq(domain1.widen(domain2)), `expected join ${domain1.join(domain2).toString()} to be less than or equal to widening ${domain1.widen(domain2).toString()}`);
		assert.isTrue(domain1.leq(domain1.widen(domain2)), `expected ${domain1.toString()} to be less than or equal to widening ${domain1.widen(domain2).toString()}`);
		assert.isTrue(domain2.leq(domain1.widen(domain2)), `expected ${domain2.toString()} to be less than or equal to widening ${domain1.widen(domain2).toString()}`);
	});
	test(`${domain1.toString()} △ ${domain2.toString()}`, () => {
		assert.isTrue(domain1.narrow(domain2).equals(narrow), `expected ${narrow.toString()} but was ${domain1.narrow(domain2).toString()}`);
		assert.isTrue(domain1.meet(domain2).leq(domain1.narrow(domain2)), `expected meet ${domain1.meet(domain2).toString()} to be less than or equal to narrowing ${domain1.narrow(domain2).toString()}`);
		assert.isTrue(domain1.narrow(domain2).leq(domain1), `expected narrowing ${domain1.narrow(domain2).toString()} to be less than or equal to ${domain1.toString()}`);
		assert.isTrue(domain2.narrow(domain2).leq(domain2), `expected narrowing ${domain1.narrow(domain2).toString()} to be less than or equal to ${domain2.toString()}`);
	});
	test(`γ(${domain1.toString()})`, () => {
		assert.deepStrictEqual(domain1.concretize(DEFAULT_INFERENCE_LIMIT), concrete, `expected ${toString(concrete)} but was ${toString(domain1.concretize(DEFAULT_INFERENCE_LIMIT))}`);
	});
	test(`α(γ(${domain1.toString()}))`, () => {
		assert.isTrue(domain1.abstract(domain1.concretize(DEFAULT_INFERENCE_LIMIT)).equals(abstract), `expected ${abstract.toString()} but was ${domain1.abstract(domain1.concretize(DEFAULT_INFERENCE_LIMIT)).toString()}`);
	});
}

function toString(set: ReadonlySet<unknown> | typeof Top): string {
	if(set === Top) {
		return '⊤';
	}
	return `{${set.values().map(value => JSON.stringify(value)).toArray().join(', ')}}`;
}
