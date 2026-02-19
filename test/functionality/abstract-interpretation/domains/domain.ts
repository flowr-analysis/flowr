import { assert, test } from 'vitest';
import { type AnyAbstractDomain, type ConcreteDomain } from '../../../../src/abstract-interpretation/domains/abstract-domain';
import { Top, TopSymbol } from '../../../../src/abstract-interpretation/domains/lattice';

const ConcretizationLimit = 12;

export interface DomainTestExpectation<AbstractValue, ConcreteValue>{
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
	expected: DomainTestExpectation<AbstractValue, ConcreteDomain<Domain>>
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
		assert.strictEqual(domain1.equals(domain2), expected.equal, `expected ${domain1.toString()} to ${expected.equal ? '' : 'not '}equal ${domain2.toString()}`);
		assert.strictEqual(domain2.equals(domain1), expected.equal, `expected ${domain2.toString()} to ${expected.equal ? '' : 'not '}equal ${domain1.toString()}`);
	});
	test(`${domain1.toString()} ⊑ ${domain2.toString()}`, () => {
		assert.strictEqual(domain1.leq(domain2), expected.leq, `expected ${domain1.toString()} to ${expected.leq ? '' : 'not '}less than or equal to ${domain2.toString()}`);
		assert.isTrue(!expected.leq || domain1.equals(domain2) || !domain2.leq(domain1), `expected ${domain2.toString()} to be greater than or equal to ${domain1.toString()}`);
	});
	test(`${domain1.toString()} ⊔ ${domain2.toString()}`, () => {
		assert.isTrue(domain1.join(domain2).equals(join), `expected ${join.toString()} but was ${domain1.join(domain2).toString()}`);
		assert.isTrue(domain2.join(domain1).equals(join), `expected ${join.toString()} but was ${domain2.join(domain1).toString()}`);
		assert.isTrue(domain1.leq(domain1.join(domain2)), `expected ${domain1.toString()} to be less than or equal to join ${domain1.join(domain2).toString()}`);
		assert.isTrue(domain2.leq(domain1.join(domain2)), `expected ${domain2.toString()} to be less than or equal to join ${domain1.join(domain2).toString()}`);
	});
	test(`${domain1.toString()} ⊓ ${domain2.toString()}`, () => {
		assert.isTrue(domain1.meet(domain2).equals(meet), `expected ${meet.toString()} but was ${domain1.meet(domain2).toString()}`);
		assert.isTrue(domain2.meet(domain1).equals(meet), `expected ${meet.toString()} but was ${domain2.meet(domain1).toString()}`);
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
		assert.deepStrictEqual(domain1.concretize(ConcretizationLimit), concrete, `expected ${toString(concrete)} but was ${toString(domain1.concretize(ConcretizationLimit))}`);
	});
	test(`α(γ(${domain1.toString()}))`, () => {
		assert.isTrue(domain1.abstract(domain1.concretize(ConcretizationLimit)).equals(abstract), `expected ${abstract.toString()} but was ${domain1.abstract(domain1.concretize(ConcretizationLimit)).toString()}`);
	});
}

function toString(value: ReadonlySet<unknown> | typeof Top | unknown): string {
	if(value instanceof Map) {
		return `{${value.entries().map(([key, value]) => `${toString(key)} -> ${toString(value)}`).toArray().join(', ')}}`;
	} else if(value instanceof Set) {
		return `{${value.values().map(value => toString(value)).toArray().join(', ')}}`;
	} else if(value === Top) {
		return TopSymbol;
	}
	return JSON.stringify(value);
}
