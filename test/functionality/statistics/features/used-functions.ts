import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'


describe('Used Function Calls', withShell(shell => {
	testForFeatureForInput(shell, 'usedFunctions', [
		{
			name:     'no calls',
			code:     'a <- 1',
			expected: {},
			written:  []
		},
		{
			name:     'one call',
			code:     'b()',
			expected: {
				allFunctionCalls: 1
			},
			written: []
		},
		{
			name:     'calling a math function',
			code:     'sin(3)',
			expected: {
				allFunctionCalls: 1,
				mathFunctions: 	  1
			},
			written: []
		},
		{
			name: 'nested function calls',
			code: `
				a(b(), c(3, d()))
				if(a(b(), d(e))) {
					f()
				}
			`,
			expected: {
				allFunctionCalls:    8,
				nestedFunctionCalls: 5,
				deepestNesting:      2,
				primitiveFunctions:  1 /* c is correctly classified ^^ */
			},
			written: []
		}
	])
}))

