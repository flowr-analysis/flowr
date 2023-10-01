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
				chainedOrNestedAccess: 1
			}
		},
		{
			name:     'Deeply nested mixed access',
			code:     'a[[1]][2]$x[y]@z',
			expected: {
				doubleBracket:               1,
				singleBracket:               2,
				byName:                      1,
				bySlot:                      1,
				doubleBracketConstant:       1,
				singleBracketConstant:       1,
				singleBracketSingleVariable: 1,
				chainedOrNestedAccess:       4
			}
		},
		{
			name:     'nested named and slotted access',
			code:     'a$hello$"world"; a@hello@"world"',
			expected: {
				byName:                2,
				bySlot:                2,
				chainedOrNestedAccess: 2
			}
		}
	])
}))

