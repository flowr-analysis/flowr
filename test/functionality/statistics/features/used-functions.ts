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
				['all-calls', [[[
					'b',
					[1, 1],
					0,
					'',
					0
				]]]],
			]
		},
		{
			name:     'one call with multiple arguments and namespace',
			code:     'a::b(3, 4)',
			expected: {
				allFunctionCalls: 1
			},
			written: [
				['all-calls', [[[
					'b',
					[1,1],
					2,
					'a',
					0
				]]]],
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
					['(function(x) { x })']
				]],
				['all-calls', [[[
					undefined,
					[1,1],
					1,
					'',
					1
				]]]],
			]
		},
		{
			name:     'calling a math function',
			code:     'sin(3)',
			expected: {
				allFunctionCalls: 1,
			},
			written: [
				['all-calls', [[[
					'sin',
					[1,1],
					1,
					'',
					0
				]]]],
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
				deepestNesting:      2
			},
			written: [
				['nested-calls', [
					['b'],
					['c'],
					['d'],
					['b'],
					['d']
				]],
				['all-calls', [
					[[
						'a',
						[1, 1],
						2,
						'',
						0
					]],
					[[
						'b',
						[1,3],
						0,
						'',
						0
					]],
					[[
						'c',
						[1,8],
						2,
						'',
						0
					]],
					[[
						'd',
						[1,13],
						0,
						'',
						0
					]],
					[[
						'a',
						[2, 36],
						2,
						'',
						0
					]],
					[[
						'b',
						[2,38],
						0,
						'',
						0
					]],
					[[
						'd',
						[2,43],
						1,
						'',
						0
					]],
					[[
						'f',
						[3,41],
						0,
						'',
						0
					]]
				]]]
		}
	])
}))

