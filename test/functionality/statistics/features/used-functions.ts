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
				['all-calls', [{ value: JSON.stringify({
					name:              'b',
					named:             true,
					location:          { line: 1, column: 1 },
					numberOfArguments: 0
				}) }]],
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
				['all-calls', [{ value: JSON.stringify({
					name:              'sin',
					named:             true,
					location:          { line: 1, column: 1 },
					numberOfArguments: 1
				}) }]],
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
					{ value: JSON.stringify({
						name:              'a',
						named:             true,
						location:          { line: 1, column: 1 },
						numberOfArguments: 2
					}) },
					{ value: JSON.stringify({
						name:              'b',
						named:             true,
						location:          { line: 1, column: 3 },
						numberOfArguments: 0
					}) },
					{ value: JSON.stringify({
						name:              'c',
						named:             true,
						location:          { line: 1, column: 8 },
						numberOfArguments: 2
					}) },
					{ value: JSON.stringify({
						name:              'd',
						named:             true,
						location:          { line: 1, column: 13 },
						numberOfArguments: 0
					}) },
					{ value: JSON.stringify({
						name:              'a',
						named:             true,
						// atm, links columns from the start of the input :C
						location:          { line: 2, column: 36 },
						numberOfArguments: 2
					}) },
					{ value: JSON.stringify({
						name:              'b',
						named:             true,
						location:          { line: 2, column: 38 },
						numberOfArguments: 0
					}) },
					{ value: JSON.stringify({
						name:              'd',
						named:             true,
						location:          { line: 2, column: 43 },
						numberOfArguments: 1
					}) },
					{ value: JSON.stringify({
						name:              'f',
						named:             true,
						location:          { line: 3, column: 41 },
						numberOfArguments: 0
					}) }
				]]]
		}
	])
}))

