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
			written: [['usedVariables', [{ value: {
				name:     'a',
				location: { line: 1, column: 1 }
			}}]]]
		},
		{
			name:     'one variable definition',
			code:     'a <- 3',
			expected: {
				numberOfDefinitions: 1
			},
			written: [
				['definedVariables', [{ value: {
					name:     'a',
					location: { line: 1, column: 1 }
				}}]],
			]
		},
		{
			name:     'one variable use and re-definitions',
			code:     'abc <- 3\nabc <- abc + 3\nabc <- x',
			expected: {
				numberOfDefinitions:   3,
				numberOfRedefinitions: 2,
				numberOfVariableUses:  2
			},
			written: [
				['definedVariables', [{ value: {
					name:     'abc',
					location: { line: 1, column: 1 }
				}}, { value: {
					name:     'abc',
					location: { line: 2, column: 1 }
				}}, { value: {
					name:     'abc',
					location: { line: 3, column: 1 }
				}}]],
				['redefinedVariables', [{ value: {
					name:     'abc',
					location: { line: 1, column: 1 }
				}}, { value: {
					name:     'abc',
					location: { line: 2, column: 1 }
				}}]],
				['usedVariables', [{ value: {
					name:     'abc',
					location: { line: 2, column: 8 }
				}}, { value: {
					name:     'x',
					location: { line: 3, column: 8 }
				}}]]
			]
		}
	])
}))
