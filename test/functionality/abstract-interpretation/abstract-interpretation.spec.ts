import {
	addDomains,
	doIntervalsOverlap,
	Domain,
	domainFromScalar,
	Interval,
	subtractDomains,
	unifyIntervals
} from '../../../src/abstract-interpretation/domain'
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

	it('Interval unification', () => {
		assert.isEmpty(unifyIntervals([]), 'Unifying no intervals results in nothing')

		let intervals = [...domainFromScalar(1).intervals, ...domainFromScalar(2).intervals]
		assert.deepEqual(
			unifyIntervals(intervals),
			intervals,
			'Unifying two non overlapping intervals results in no change'
		)

		intervals = [
			new Interval({value: 1, inclusive: true}, {value: 3, inclusive: true}),
			new Interval({value: 5, inclusive: true}, {value: 7, inclusive: true}),
			new Interval({value: 2, inclusive: true}, {value: 4, inclusive: true}),
			new Interval({value: 6, inclusive: true}, {value: 8, inclusive: true}),
		]
		assert.deepEqual(
			unifyIntervals(intervals),
			[
				new Interval({value: 1, inclusive: true}, {value: 4, inclusive: true}),
				new Interval({value: 5, inclusive: true}, {value: 8, inclusive: true}),
			],
		)

		// TODO: more tests for in and excluded bounds
	})

	// TODO: Maybe add tests for domain unification (even though it's just a wrapper around interval unification)

	it('Domain addition', () => {
		assert.isEmpty(addDomains(new Domain(), new Domain()).intervals, 'Adding two empty domains results in an empty domain')

		let domain1 = domainFromScalar(4)
		let domain2 = domainFromScalar(2)
		assert.deepEqual(
			addDomains(domain1, domain2),
			new Domain(new Interval({value: 6, inclusive: true}, {value: 6, inclusive: true})),
			'Adding two domains of a scalar, results in a domain containing the sum of the scalars'
		)

		domain2 = new Domain(new Interval({value: 6, inclusive: true}, {value: 9, inclusive: true}))
		assert.deepEqual(
			addDomains(domain1, domain2),
			new Domain(new Interval({value: 10, inclusive: true}, {value: 13, inclusive: true})),
			'Adding one scalar-domain to a wider domain, adds the scalar to the start and end of the wider domain'
		)

		domain1 = new Domain(new Interval({value: 6, inclusive: true}, {value: 9, inclusive: true}))
		domain2 = new Domain(new Interval({value: 4, inclusive: true}, {value: 7, inclusive: true}))
		assert.deepEqual(
			addDomains(domain1, domain2),
			new Domain(new Interval({value: 10, inclusive: true}, {value: 16, inclusive: true})),
			'Adding two domains with overlapping intervals, adds the intervals'
		)

		// TODO: more tests for in and excluded bounds
	})

	it('Domain subtraction', () => {
		assert.isEmpty(subtractDomains(new Domain(), new Domain()).intervals, 'Subtracting two empty domains results in an empty domain')

		let domain1 = domainFromScalar(4)
		let domain2 = domainFromScalar(2)
		assert.deepEqual(
			subtractDomains(domain1, domain2),
			new Domain(new Interval({value: 2, inclusive: true}, {value: 2, inclusive: true})),
			'Subtracting two domains of a scalar, results in a domain containing the difference of the scalars'
		)

		domain2 = new Domain(new Interval({value: 6, inclusive: true}, {value: 9, inclusive: true}))
		assert.deepEqual(
			subtractDomains(domain2, domain1),
			new Domain(new Interval({value: 2, inclusive: true}, {value: 5, inclusive: true})),
			'Subtracting a scalar-domain from a wider domain, subtracts the scalar from the start and end of the wider domain'
		)

		domain2 = new Domain(new Interval({value: 1, inclusive: true}, {value: 3, inclusive: true}))
		assert.deepEqual(
			subtractDomains(domain1, domain2),
			new Domain(new Interval({value: 1, inclusive: true}, {value: 3, inclusive: true})),
			'Subtracting a wider domain from a scalar-domain, subtracts the start and end of the wider domain from the scalar'
		)

		domain1 = new Domain(new Interval({value: 6, inclusive: true}, {value: 9, inclusive: true}))
		domain2 = new Domain(new Interval({value: 4, inclusive: true}, {value: 5, inclusive: true}))
		assert.deepEqual(
			subtractDomains(domain1, domain2),
			new Domain(new Interval({value: 1, inclusive: true}, {value: 5, inclusive: true})),
			'Subtracting two domains with overlapping intervals, subtracts the intervals'
		)

		// TODO: more tests for in and excluded bounds
	})
})
