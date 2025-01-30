import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import { assert, describe } from 'vitest';
import type { ResolveValueQuery, ResolveValueQueryResult } from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-format';
import { fingerPrintOfQuery } from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-executor';
import { resolveToValues } from '../../../../src/dataflow/environments/resolve-by-name';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { recoverName } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { numVal } from '../../_helper/ast-builder';

describe.sequential('Resolve Value Query', withShell(shell => {
	function testQuery(name: string, code: string, queries: readonly ResolveValueQuery[], expected: readonly unknown[][]) {
		assertQuery(label(name), shell, code, queries, ({ dataflow }) => {
			const results: ResolveValueQueryResult['results'] = {};
			
			const idMap = dataflow.graph.idMap;
			assert(idMap !== undefined);
			
			queries.forEach((query, idx) => {
				const key = fingerPrintOfQuery(query);
				results[key] = {
					values: expected[idx]
				};
			});

			return {
				'resolve-value': { results }
			};
		});
	}

	testQuery('Single dataflow', 'x <- 1', [{ type: 'resolve-value', criteria: ['1@x'] }], [[numVal(1)]]);
	testQuery('Multiple Queries', 'x <- 1', [{ type: 'resolve-value', criteria: ['1@x'] }, { type: 'resolve-value', criteria: ['1@x'] }, { type: 'resolve-value', criteria: ['1@x'] }], [[numVal(1)],[numVal(1)],[numVal(1)]]);
}));
