import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'


describe('Used Function Definitions', withShell(shell => {
	testForFeatureForInput(shell, 'definedFunctions', [
		{
			name:     'no definitions',
			code:     'a <- 1',
			expected: {},
			written:  'nothing'
		},
		{
			name:     'the identity function',
			code:     'function(x) { x }',
			expected: {
				total: 1
			},
			written: [
				['usedParameterNames', [{ value: 'x' }]],
				['all-definitions', [ { value: JSON.stringify({
					location:           { line: 1, column: 1 },
					callsites:          [],
					numberOfParameters: 1,
					returns:            [
						{ explicit: false, location: { line: 1, column: 15 } }
					],
					length: {
						lines:                   1,
						characters:              17,
						nonWhitespaceCharacters: 14
					}
				})}]]
			]
		},
		{
			name:     'the identity lambda function',
			code:     '\\(x) x',
			expected: {
				total:       1,
				lambdasOnly: 1
			},
			written: [
				['usedParameterNames', [{ value: 'x' }]],
				['allLambdas', [{ value: '\\(x) x' }]],
				['all-definitions', [ { value: JSON.stringify({
					location:           { line: 1, column: 1 },
					callsites:          [],
					numberOfParameters: 1,
					returns:            [
						{ explicit: false, location: { line: 1, column: 6 } }
					],
					length: {
						lines:                   1,
						characters:              6,
						nonWhitespaceCharacters: 5
					}
				})}]]
			]
		},
		{
			name:     'nested function definition',
			code:     'function(x) { function(y) { x + y } }',
			expected: {
				total:           2,
				nestedFunctions: 1
			},
			written: [
				['usedParameterNames', [{ value: 'x' }, { value: 'y' }]],
				['nested-definitions', [{ value: 'function(y) { x + y }' }]],
				['all-definitions', [ { value: JSON.stringify({
					location:           { line: 1, column: 1 },
					callsites:          [],
					numberOfParameters: 1,
					returns:            [
						{ explicit: false, location: { line: 1, column: 15 } }
					],
					length: {
						lines:                   1,
						characters:              37,
						nonWhitespaceCharacters: 29
					}
				})}, { value: JSON.stringify({
					location:           { line: 1, column: 15 },
					callsites:          [],
					numberOfParameters: 1,
					returns:            [
						{ explicit: false, location: { line: 1, column: 31 } }
					],
					length: {
						lines:                   1,
						characters:              21,
						nonWhitespaceCharacters: 16
					}
				})}]]
				// multiple, explicit return points
			]
		}
		// TODO: count recursive, nested, ...
	])
}))

