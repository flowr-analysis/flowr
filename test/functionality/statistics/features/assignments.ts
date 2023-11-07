import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'

describe('Used Ways to Assign', withShell(shell => {
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
				assignmentOperator: {
					'<-': 1n
				},
				assigned: {
					total:  1n,
					number: {
						'1': 1n
					}
				}
			},
			written: 'nothing'
		}
	])
}))

