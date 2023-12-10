import {
	doIntervalsOverlap,
	Domain,
	domainFromScalar,
	Interval,
	unifyDomains
} from '../../../src/abstract-interpretation/processor'
import {assert} from 'chai'

describe('Abstract Interpretation', () => {
	it('Interval overlapping', () => {
		assert.isFalse(doIntervalsOverlap(
			new Interval({value: 1, inclusive: true}, {value: 2, inclusive: true}),
			new Interval({value: 3, inclusive: true}, {value: 4, inclusive: true})
		), 'Trivially non-overlapping')

		assert.isTrue(doIntervalsOverlap(
			new Interval({value: 1, inclusive: true}, {value: 3, inclusive: true}),
			new Interval({value: 2, inclusive: true}, {value: 4, inclusive: false})
		), 'Trivially overlapping')

		assert.isTrue(doIntervalsOverlap(
			new Interval({value: 1, inclusive: true}, {value: 3, inclusive: true}),
			new Interval({value: 3, inclusive: true}, {value: 4, inclusive: false})
		), 'Intervals touching, with the touching bounds being inclusive are overlapping')

		assert.isFalse(doIntervalsOverlap(
			new Interval({value: 1, inclusive: true}, {value: 3, inclusive: false}),
			new Interval({value: 3, inclusive: true}, {value: 4, inclusive: false})
		), 'Intervals touching, with one of the touching bounds being exclusive are not overlapping')

		assert.isFalse(doIntervalsOverlap(
			new Interval({value: 1, inclusive: true}, {value: 3, inclusive: true}),
			new Interval({value: 3, inclusive: false}, {value: 4, inclusive: false})
		), 'Intervals touching, with one of the touching bounds being exclusive are not overlapping')

		assert.isFalse(doIntervalsOverlap(
			new Interval({value: 1, inclusive: true}, {value: 3, inclusive: false}),
			new Interval({value: 3, inclusive: false}, {value: 4, inclusive: false})
		), 'Intervals touching, with both touching bounds being exclusive are not overlapping')
	})

	it('Domain unification', () => {
		assert.isEmpty(unifyDomains([]).intervals, 'Unifying no domains results in an empty domain')

		const nonOverlappingDomain1 = domainFromScalar(1)
		const nonOverlappingDomain2 = domainFromScalar(2)
		assert.deepEqual(
			unifyDomains([nonOverlappingDomain1, nonOverlappingDomain2]),
			new Domain(...nonOverlappingDomain1.intervals, ...nonOverlappingDomain2.intervals),
			'Unifying two non overlapping domains results in a domain containing all intervals of the original domains'
		)

		const overlappingDomain1 = new Domain(
			new Interval({value: 1, inclusive: true}, {value: 3, inclusive: true}),
			new Interval({value: 5, inclusive: true}, {value: 7, inclusive: true}),
		)
		const overlappingDomain2 = new Domain(
			new Interval({value: 2, inclusive: true}, {value: 4, inclusive: true}),
			new Interval({value: 6, inclusive: true}, {value: 8, inclusive: true}),
		)
		assert.deepEqual(
			unifyDomains([overlappingDomain1, overlappingDomain2]),
			new Domain(
				new Interval({value: 1, inclusive: true}, {value: 4, inclusive: true}),
				new Interval({value: 5, inclusive: true}, {value: 8, inclusive: true}),
			),
			'Unifying two overlapping domains results in unifying the domains intervals'
		)

		// TODO: more tests for in and exluded bounds
	})
})
