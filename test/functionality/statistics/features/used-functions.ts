import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'


describe('Used Function Calls', withShell(shell => {
	testForFeatureForInput(shell, 'usedFunctions', [
		{
			name:     'no calls',
			code:     'a <- 1',
			expected: {},
			written:  'nothing'
		},
		{
			name:     'one call',
			code:     'b()',
			expected: {
				allFunctionCalls: 1
			},
			written: [
				['all-calls', [{ value: {
					name:              'b',
					location:          { line: 1, column: 1 },
					numberOfArguments: 0,
					namespace:         undefined
				}}]],
			]
		},
		{
			name:     'one call with multiple arguments and namespace',
			code:     'a::b(3, 4)',
			expected: {
				allFunctionCalls: 1
			},
			written: [
				['all-calls', [{ value: {
					name:              'b',
					location:          { line: 1, column: 1 },
					numberOfArguments: 2,
					namespace:         'a'
				}}]],
			]
		},
		{
			name:     'unnamed function call',
			code:     '(function(x) { x })(3)',
			expected: {
				allFunctionCalls: 1,
				unnamedCalls:     1
			},
			written: [
				['unnamed-calls', [
					{ value: '(function(x) { x })' }
				]],
				['all-calls', [{ value: {
					name:              undefined,
					location:          { line: 1, column: 1 },
					numberOfArguments: 1,
					namespace:         undefined
				}}]],
			]
		},
		{
			name:     'calling a math function',
			code:     'sin(3)',
			expected: {
				allFunctionCalls: 1,
				mathFunctions: 	  1
			},
			written: [
				['all-calls', [{ value: {
					name:              'sin',
					location:          { line: 1, column: 1 },
					numberOfArguments: 1,
					namespace:         undefined
				}}]],
			]
		},
		{
			name: 'nested function calls',
			code: `a(b(), c(3, d()))
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
			written: [
				['nested-calls', [
					{ value: 'b' },
					{ value: 'c' },
					{ value: 'd' },
					{ value: 'b' },
					{ value: 'd' }
				]],
				['all-calls', [
					{ value: {
						name:              'a',
						location:          { line: 1, column: 1 },
						numberOfArguments: 2,
						namespace:         undefined
					}},
					{ value: {
						name:              'b',
						location:          { line: 1, column: 3 },
						numberOfArguments: 0,
						namespace:         undefined
					}},
					{ value: {
						name:              'c',
						location:          { line: 1, column: 8 },
						numberOfArguments: 2,
						namespace:         undefined
					}},
					{ value: {
						name:              'd',
						location:          { line: 1, column: 13 },
						numberOfArguments: 0,
						namespace:         undefined
					}},
					{ value: {
						name:              'a',
						// atm, links columns from the start of the input :C
						location:          { line: 2, column: 36 },
						numberOfArguments: 2,
						namespace:         undefined
					}},
					{ value: {
						name:              'b',
						location:          { line: 2, column: 38 },
						numberOfArguments: 0,
						namespace:         undefined
					}},
					{ value: {
						name:              'd',
						location:          { line: 2, column: 43 },
						numberOfArguments: 1,
						namespace:         undefined
					}},
					{ value: {
						name:              'f',
						location:          { line: 3, column: 41 },
						numberOfArguments: 0,
						namespace:         undefined
					}}
				]]]
		}
	])
}))

