import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'

describe('Used Ways to assign', withShell(shell => {
	testForFeatureForInput(shell, 'assignments', [
		{
			name:     'no assignment',
			code:     '4 * x; foo(a); a[3]; # a <- 1',
			expected: {},
			written:  'nothing'
		},
		{
			name:     'default assign left',
			code:     'a <- 1',
			expected: {

			},
			written: [
				['dataAccess', [['a[1]'], ['a[]']]],
			]
		}
	])
}))

