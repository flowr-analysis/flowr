import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import type { IdMapQuery } from '../../../../src/queries/catalog/id-map-query/id-map-query-format';
import { describe } from 'vitest';

describe.sequential('Normalized AST Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly IdMapQuery[]) {
		assertQuery(label(name), shell, code, query, (({ normalize }) => ({ 'id-map': { idMap: normalize.idMap } })));
	}

	testQuery('Single normalized AST', 'x + 1', [{ type: 'id-map' }]);
	testQuery('Multiple Queries', 'x + 1', [{ type: 'id-map' }, { type: 'id-map' }, { type: 'id-map' }]);
}));
