import { assert, test } from 'vitest';
import { type AnyAbstractDomain } from '../../../../src/abstract-interpretation/domains/abstract-domain';

/**
 * The type of an object containing the expected results for the operations on abstract values of an abstract domain.
 */
export interface DomainTestExpectation<AbstractValue>{
	readonly equal:   boolean,
	readonly leq:     boolean,
	readonly join:    AbstractValue,
	readonly meet:    AbstractValue,
	readonly widen:   AbstractValue,
	readonly narrow?: AbstractValue
}

/**
 * Asserts that an abstract domain implementation satisfies the expected properties for the given abstract values.
 * @param create  - A function to create an instance of the abstract domain from an abstract value
 * @param value1  - The first abstract value to test
 * @param value2  - The second abstract value to test
 * @param expected - An object containing the expected results for the operations on the abstract values
 * @template AbstractValue - The type of the abstract values provided
 * @template Domain        - The type of the abstract domain being tested
 */
export function assertAbstractDomain<AbstractValue, Domain extends AnyAbstractDomain>(
	create: (value: AbstractValue) => Domain,
	value1: AbstractValue,
	value2: AbstractValue,
	expected: DomainTestExpectation<AbstractValue>
) {
	const domain1 = create(value1);
	const domain2 = create(value2);

	test(`${domain1.toString()} = ${domain2.toString()}`, () => {
		assert.strictEqual(domain1.equals(domain2), expected.equal, `expected ${domain1.toString()} to ${expected.equal ? '' : 'not '}equal ${domain2.toString()}`);
		assert.strictEqual(domain2.equals(domain1), expected.equal, `expected ${domain2.toString()} to ${expected.equal ? '' : 'not '}equal ${domain1.toString()}`);
	});
	test(`${domain1.toString()} ⊑ ${domain2.toString()}`, () => {
		assert.strictEqual(domain1.leq(domain2), expected.leq, `expected ${domain1.toString()} to ${expected.leq ? '' : 'not '}less than or equal to ${domain2.toString()}`);
		assert.isTrue(!expected.leq || domain1.equals(domain2) || !domain2.leq(domain1), `expected ${domain2.toString()} to be greater than or equal to ${domain1.toString()}`);
	});
	const join = create(expected.join);
	test(`${domain1.toString()} ⊔ ${domain2.toString()}`, () => {
		assert.isTrue(domain1.join(domain2).equals(join), `expected ${join.toString()} but was ${domain1.join(domain2).toString()}`);
		assert.isTrue(domain2.join(domain1).equals(join), `expected ${join.toString()} but was ${domain2.join(domain1).toString()}`);
		assert.isTrue(domain1.leq(domain1.join(domain2)), `expected ${domain1.toString()} to be less than or equal to join ${domain1.join(domain2).toString()}`);
		assert.isTrue(domain2.leq(domain1.join(domain2)), `expected ${domain2.toString()} to be less than or equal to join ${domain1.join(domain2).toString()}`);
	});
	const meet = create(expected.meet);
	test(`${domain1.toString()} ⊓ ${domain2.toString()}`, () => {
		assert.isTrue(domain1.meet(domain2).equals(meet), `expected ${meet.toString()} but was ${domain1.meet(domain2).toString()}`);
		assert.isTrue(domain2.meet(domain1).equals(meet), `expected ${meet.toString()} but was ${domain2.meet(domain1).toString()}`);
		assert.isTrue(domain1.meet(domain2).leq(domain1), `expected meet ${domain1.meet(domain2).toString()} to be less than or equal to ${domain1.toString()}`);
		assert.isTrue(domain1.meet(domain2).leq(domain2), `expected meet ${domain1.meet(domain2).toString()} to be less than or equal to ${domain2.toString()}`);
	});
	const widen = create(expected.widen);
	test(`${domain1.toString()} ▽ ${domain2.toString()}`, () => {
		assert.isTrue(domain1.widen(domain2).equals(widen), `expected ${widen.toString()} but was ${domain1.widen(domain2).toString()}`);
		assert.isTrue(domain1.join(domain2).leq(domain1.widen(domain2)), `expected join ${domain1.join(domain2).toString()} to be less than or equal to widening ${domain1.widen(domain2).toString()}`);
		assert.isTrue(domain1.leq(domain1.widen(domain2)), `expected ${domain1.toString()} to be less than or equal to widening ${domain1.widen(domain2).toString()}`);
		assert.isTrue(domain2.leq(domain1.widen(domain2)), `expected ${domain2.toString()} to be less than or equal to widening ${domain1.widen(domain2).toString()}`);
	});
	if(expected.narrow !== undefined) {
		const narrow = create(expected.narrow);
		test(`${domain1.toString()} △ ${domain2.toString()}`, () => {
			assert.isTrue(domain1.narrow(domain2).equals(narrow), `expected ${narrow.toString()} but was ${domain1.narrow(domain2).toString()}`);
			assert.isTrue(domain1.meet(domain2).leq(domain1.narrow(domain2)), `expected meet ${domain1.meet(domain2).toString()} to be less than or equal to narrowing ${domain1.narrow(domain2).toString()}`);
			assert.isTrue(domain1.narrow(domain2).leq(domain1), `expected narrowing ${domain1.narrow(domain2).toString()} to be less than or equal to ${domain1.toString()}`);
			assert.isTrue(domain2.narrow(domain2).leq(domain2), `expected narrowing ${domain1.narrow(domain2).toString()} to be less than or equal to ${domain2.toString()}`);
		});
	}
}
