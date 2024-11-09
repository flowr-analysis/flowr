import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import type {
	NormalizedAstQuery
} from '../../../../src/queries/catalog/normalized-ast-query/normalized-ast-query-format';
import { describe } from 'vitest';

describe.sequential('Normalized AST Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly NormalizedAstQuery[]) {
		assertQuery(label(name), shell, code, query, ({ normalize }) => ({ 'normalized-ast': { normalized: normalize } }));
	}

	testQuery('Single AST', 'x + 1', [{ type: 'normalized-ast' }]);
	testQuery('Multiple Queries', 'x + 1', [{ type: 'normalized-ast' }, { type: 'normalized-ast' }, { type: 'normalized-ast' }]);
}));
