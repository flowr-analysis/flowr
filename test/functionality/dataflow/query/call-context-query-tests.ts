import {
	CallTargets
} from '../../../../src/queries/call-context-query/call-context-query-format';
import { withShell } from '../../_helper/shell';
import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';


/** TODO: check what happens if builtin if may be override */
describe('Call Context Query', withShell(shell => {
	assertQuery(label('Print calls'),
		shell, 'print(1)', [{
			type:        'call-context',
			callName:    /print/,
			kind:        'visualize',
			subkind:     'print',
			callTargets: CallTargets.OnlyGlobal
		}], {
			'call-context': {
				kinds: {
					'visualize': {
						subkinds: {
							'print': [{
								id:    3,
								calls: []
							}]
						}
					}
				}
			}
		});
}));
