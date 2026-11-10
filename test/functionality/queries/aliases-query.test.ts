import { describe } from 'vitest';
import type { AliasesQuery } from '../../../src/queries/catalog/aliases-query/aliases-query-format';
import { assertQuery } from '../_helper/query';
import { label } from '../_helper/label';
import type { QueryResultsWithoutMeta } from '../../../src/queries/query';
import { withTreeSitter } from '../_helper/shell';
import type { SourceLocation } from '../../../src';

describe('Aliases Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly AliasesQuery[], expected: QueryResultsWithoutMeta<AliasesQuery>) {
		assertQuery(label(name), parser, code, query, expected);
	}

	testQuery('Basic', 'f <- function(...) 42\ng <- f', [{ type: 'aliases', criteria: ['1@f'] }], { aliases: { result: [['1@f', [[2, 1, 2, 1] as SourceLocation]]] } });
	testQuery('Basic 2', 'f <- function(...) 42\ng <- f\nh <- g', [{ type: 'aliases', criteria: ['1@f', '2@g'] }], { aliases: { result: [['1@f', [[2, 1, 2, 1] as SourceLocation, [3, 1, 3, 1] as SourceLocation]], ['2@g', [[3, 1, 3, 1] as SourceLocation]]] } });
	testQuery('several levels of aliases', 'f <- function(...){g <- h}\nh <- f\nf()', [{ type: 'aliases', criteria: ['3@f'] }], { aliases: { result: [['3@f', [[2, 1, 2, 1] as SourceLocation, [1, 20, 1, 20] as SourceLocation]]] } });
	testQuery('several levels of aliases - interrupted', 'f <- 5\ng <- f\nf <- f+1\nh <- g', [{ type: 'aliases', criteria: ['1@f', '3@f', '2@g'] }], { aliases: { result: [['1@f', [[2, 1, 2, 1] as SourceLocation, [4, 1, 4, 1] as SourceLocation]], ['3@f', []], ['2@g', [[4, 1, 4, 1] as SourceLocation]]] } });
}));