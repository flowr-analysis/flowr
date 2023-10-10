import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'


describe('Variables', withShell(shell => {
	testForFeatureForInput(shell, 'variables', [
		{
			name:     'no variables',
			code:     '2 + 3',
			expected: {},
			written:  'nothing'
		},
		{
			name:     'one variable use',
			code:     'a',
			expected: {
				numberOfVariableUses: 1
			},
			written: [['usedVariables', [{ value: JSON.stringify({
				name:     'a',
				location: { line: 1, column: 1 }
			}) }]]]
		},
		{
			name:     'one variable definition',
			code:     'a <- 3',
			expected: {
				numberOfDefinitions: 1
			},
			written: [
				['definedVariables', [{ value: JSON.stringify({
					name:     'a',
					location: { line: 1, column: 1 }
				}) }]],
			]
		}
	])
}))
