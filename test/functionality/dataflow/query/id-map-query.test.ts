import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type { IdMapQuery } from '../../../../src/queries/catalog/id-map-query/id-map-query-format';
import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';

describe('Id Map Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly IdMapQuery[]) {
		assertQuery(label(name), parser, code, query,
			(({ normalize }) => ({ 'id-map': { idMap: normalize.idMap } })),
			true
		);
	}

	testQuery('Single normalized AST', 'x + 1', [{ type: 'id-map' }]);
	testQuery('Multiple Queries', 'x + 1', [{ type: 'id-map' }, { type: 'id-map' }, { type: 'id-map' }]);
}));
