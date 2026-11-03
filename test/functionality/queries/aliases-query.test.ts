import { describe } from 'vitest';
import type { AliasesQuery } from '../../../src/queries/catalog/aliases-query/aliases-query-format';
import { assertQuery } from '../_helper/query';
import { label } from '../_helper/label';
import type { QueryResultsWithoutMeta } from '../../../src/queries/query';
import { withTreeSitter } from '../_helper/shell';
import { sliceCriteriaParser } from '../../../src/cli/repl/parser/slice-query-parser';
import type { NodeId, SlicingCriteria, SlicingCriterion } from '../../../src';

describe('Aliases Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly AliasesQuery[], expected: QueryResultsWithoutMeta<AliasesQuery>) {
		assertQuery(label(name), parser, code, query, expected);
	}

	testQuery('Basic', `f <- function(...) 42
g <- f`, [{ type: 'aliases', criteria: sliceCriteriaParser('1@f') as SlicingCriteria }],
	{ aliases: { result: new Map<SlicingCriterion, NodeId[] | undefined>() } });
}));