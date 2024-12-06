import { testForFeatureForInput } from '../statistics';
import { withShell } from '../../_helper/shell';
import { describe } from 'vitest';


describe.sequential('Variables', withShell(shell => {
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
				numberOfVariableUses: 1
			},
			written: [['usedVariables', [[[
				'a',
				[1,1]
			]]]]]
		},
		{
			name:     'one variable definition',
			code:     'a <- 3',
			expected: {
				numberOfDefinitions: 1
			},
			written: [
				['definedVariables', [[[
					'a',
					[1,1]
				]]]],
			]
		}
	]);
}));
