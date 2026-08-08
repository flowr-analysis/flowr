import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';

describe('Compound Query', withTreeSitter(parser => {
	assertQuery(label('Compound Virtual Query'),
		parser, 'print(1); foo(2)', [{
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
							'print': [{ id: 3, name: 'print' }, { id: 7, name: 'foo' }]
						}
					}
				}
			}
		});
}));
