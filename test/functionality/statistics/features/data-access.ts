import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'


describe('Used Ways to Access Data', withShell(shell => {
	testForFeatureForInput(shell, 'dataAccess', [
		{
			name:     'no data access',
			code:     'a <- 1; 4 * x; foo(a) # a[3]',
			expected: {}
		},
		{
			name:     'single bracket access, including empty',
			code:     'a[1]; a[]',
			expected: {
				singleBracket:         2,
				singleBracketConstant: 1,
				singleBracketEmpty:    1
			}
		},
		{
			name:     'double bracket access, including empty',
			code:     'a[[1]]; a[[]]',
			expected: {
				doubleBracket:         2,
				doubleBracketConstant: 1,
				doubleBracketEmpty:    1
			}
		},
		{
			name:     'using an expression',
			code:     'a[[x + y]]; a[x - 3]',
			expected: {
				doubleBracket: 1,
				singleBracket: 1
			}
		},
		{
			name:     'using only a single variable',
			code:     'a[x]; a[[x]]',
			expected: {
				doubleBracket:               1,
				singleBracket:               1,
				doubleBracketSingleVariable: 1,
				singleBracketSingleVariable: 1
			}
		},
		{
			name:     'named and slotted access',
			code:     'a$hello; a$"world"; a@hello; a@"world"',
			expected: {
				byName: 2,
				bySlot: 2
			}
		},
		{
			name:     'nested double bracket access',
			code:     'a[[1]][[2]]',
			expected: {
				doubleBracket:         2,
				doubleBracketConstant: 2,
				chainedOrNestedAccess: 1,
				longestChain:          1
			}
		},
		{
			name:     'comma access',
			code:     'a[1,x,3]; b[[2,name=3]]',
			expected: {
				singleBracket:               1,
				singleBracketCommaAccess:    1,
				singleBracketConstant: 	     2, // contains a constant
				doubleBracket:               1,
				doubleBracketCommaAccess:    1,
				doubleBracketConstant: 	     2,
				singleBracketSingleVariable: 1,
				namedArguments:              1
			}
		},
		{
			name:     'deeply nested mixed access',
			code:     'a[[1]][2]$x[y]@z',
			expected: {
				doubleBracket:               1,
				singleBracket:               2,
				byName:                      1,
				bySlot:                      1,
				doubleBracketConstant:       1,
				singleBracketConstant:       1,
				singleBracketSingleVariable: 1,
				chainedOrNestedAccess:       4,
				longestChain:                4
			}
		},
		{
			name:     'nested in the argument',
			code:     'a[[ x[ y[3] ] ]]',
			expected: {
				doubleBracket:         1,
				singleBracket:         2,
				singleBracketConstant: 1,
				chainedOrNestedAccess: 2,
				deepestNesting:        2
			}
		},
		{
			name:     'nested and chained',
			code:     'a[[ x[ y[3]$b ] ]]$c$d$e',
			expected: {
				doubleBracket:         1,
				singleBracket:         2,
				singleBracketConstant: 1,
				chainedOrNestedAccess: 6,
				deepestNesting:        2,
				longestChain:          4,
				byName:                4
			}
		},
		{
			name:     'nested named and slotted access',
			code:     'a$hello$"world"; a@hello@"world"',
			expected: {
				byName:                2,
				bySlot:                2,
				chainedOrNestedAccess: 2,
				longestChain:          1
			}
		}
	])
}))

