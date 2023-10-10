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
				allFunctionCalls: 1
			},
			written: []
		},
		{
			name:     'one variable definition',
			code:     'a <- 3',
			expected: {
				allFunctionCalls: 1
			},
			written: [
				['all-calls', [{
					value: JSON.stringify({
						name:              'b',
						location:          { line: 1, column: 1 },
						numberOfArguments: 2,
						namespace:         'a'
					})
				}]],
			]
		}
	])
}))
