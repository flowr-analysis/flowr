import { withShell } from '../../helper/shell'
import { testForFeatureForInput } from '../statistics.spec'


describe('Controlflow', withShell(shell => {
	testForFeatureForInput(shell, 'controlflow', [
		{
			name:     'no control flow',
			code:     'a <- 1',
			expected: {},
			written:  'nothing'
		},
		{
			name:     'if-then with constant condition',
			code:     'if(TRUE) { x }',
			expected: {
				ifThen:         1,
				constantIfThen: 1
			},
			written: [
				['IfThen', [['TRUE']]],
				['constantIfThen', [['TRUE']]]
			]
		},
		{
			name:     'if-then-else with constant condition',
			code:     'if(FALSE) { x } else { y }',
			expected: {
				ifThenElse:         1,
				constantIfThenElse: 1
			},
			written: [
				['IfThenElse', [['FALSE']]],
				['constantIfThenElse', [['FALSE']]]
			]
		},
		{
			name:     'if-then with single variable',
			code:     'if(c) { x }',
			expected: {
				ifThen:               1,
				singleVariableIfThen: 1
			},
			written: [
				['IfThen', [['c']]],
				['singleVariableIfThen', [['c']]]
			]
		},
		{
			name:     'if-then-else with single variable',
			code:     'if(c) { x } else { y }',
			expected: {
				ifThenElse:               1,
				singleVariableIfThenElse: 1
			},
			written: [
				['IfThenElse', [['c']]],
				['singleVariableIfThenElse', [['c']]]
			]
		},
		{
			name:     'if-then with simple condition',
			code:     'if(c == 1) { x }',
			expected: {
				ifThen: 1
			},
			written: [
				['IfThen', [['c == 1']]]
			]
		},
		{
			name:     'if-then-else with simple condition',
			code:     'if(c == "alpha") { x } else { y }',
			expected: {
				ifThenElse: 1
			},
			written: [
				['IfThenElse', [['c == "alpha"']]]
			]
		},
		{
			name:     'remain constant with call',
			code:     'if (!require("XX")) install.packages("XX")',
			expected: {
				ifThen: 1
			},
			written: [
				['IfThen', [['!require("XX")']]]
			]
		},
		{
			name:     'switch with constant condition',
			code:     'switch(1, x)',
			expected: {
				switchCase:         1,
				constantSwitchCase: 1
			},
			written: [
				['SwitchCase', [['1']]],
				['constantSwitchCase', [['1']]]
			]
		},
		{
			name:     'switch with single variable condition',
			code:     'switch(x, y, z)',
			expected: {
				switchCase:               1,
				singleVariableSwitchCase: 1
			},
			written: [
				['SwitchCase', [['x']]],
				['singleVariableSwitchCase', [['x']]]
			]
		}
	])
}))

