import { assertSliced, withShell } from '../../_helper/shell'
import type { SlicingCriteria } from '../../../../src/slicing/criterion/parse'

describe.only('Simple', withShell(shell => {
	describe('Base Dicing Cases', () => {
		const testcases: [{ name: string, input: string, endCriterion: SlicingCriteria, startCriterion: SlicingCriteria, expected: string }] 
		= [
			{ name: 'Simple Example', input: 'a = 3\nb = 4\nc = a + b', endCriterion: ['3@c'], startCriterion: ['1@a'], expected: 'a = 3\nc = a + b' }
		]

		for(const testcase of testcases) {
			assertSliced(testcase.name, shell, testcase.input, testcase.endCriterion, testcase.expected)
		}
	})
}))