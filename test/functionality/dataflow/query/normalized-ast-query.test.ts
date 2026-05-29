import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type {
	NormalizedAstQuery
} from '../../../../src/queries/catalog/normalized-ast-query/normalized-ast-query-format';
import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';

describe('Normalized AST Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly NormalizedAstQuery[]) {
		assertQuery(label(name), parser, code, query,
			({ normalize }) => ({ 'normalized-ast': { normalized: normalize } }),
			true
		);
	}

	testQuery('Single AST', 'x + 1', [{ type: 'normalized-ast' }]);
	testQuery('Multiple Queries', 'x + 1', [{ type: 'normalized-ast' }, { type: 'normalized-ast' }, { type: 'normalized-ast' }]);
}));
