import { withShell } from '../../_helper/shell';
import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';


describe('Compound Query', withShell(shell => {
	assertQuery(label('Compound Virtual Query'),
		shell, 'print(1); foo(2)', [{
			type:            'compound',
			query:           'call-context',
			commonArguments: {
				kind:    'visualize',
				subkind: 'print'
			},
			arguments: [{
				callName: /print/,
			}, {
				callName: /foo/,
			}]
		}], {
			'call-context': {
				kinds: {
					'visualize': {
						subkinds: {
							'print': [{ id: 3 }, { id: 7 }]
						}
					}
				}
			}
		});
}));
