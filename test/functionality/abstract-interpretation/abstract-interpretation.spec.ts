import {doIntervalsOverlap, Interval} from '../../../src/abstract-interpretation/processor'
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
})
