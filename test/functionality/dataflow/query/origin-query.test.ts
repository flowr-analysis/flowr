import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import { describe } from 'vitest';
import type { OriginQuery, OriginQueryResult } from '../../../../src/queries/catalog/origin-query/origin-query-format';
import { OriginType } from '../../../../src/dataflow/origin/dfg-get-origin';

describe.sequential('Origin Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly OriginQuery[], expected: OriginQueryResult) {
		assertQuery(label(name), shell, code, query, { 'origin': expected });
	}

	testQuery('Simple assign', 'x <- 1\nx', [{ type: 'origin', criterion: '2@x' }], {
		results: {
			'2@x': [{
				type: OriginType.ReadVariableOrigin,
				id:   0
			}]
		},
		'.meta': {
			timing: 0
		}
	});
}));
