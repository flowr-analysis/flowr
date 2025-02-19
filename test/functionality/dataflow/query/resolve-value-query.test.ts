import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import { assert, describe } from 'vitest';
import type {
	ResolveValueQuery,
	ResolveValueQueryResult
} from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-format';


import { fingerPrintOfQuery } from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-executor';
import { numVal } from '../../_helper/ast-builder';
import type { SlicingCriteria } from '../../../../src/slicing/criterion/parse';

describe.sequential('Resolve Value Query', withShell(shell => {
	function testQuery(name: string, code: string, criteria: SlicingCriteria, expected: readonly unknown[][]) {
		const queries: ResolveValueQuery[] = [{ type: 'resolve-value' as const, criteria }];
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


	testQuery('Single dataflow', 'x <- 1', ['1@x'], [[numVal(1)]]);

	describe('For now suboptimal', () =>  {
		testQuery('Unknown df', `
df <- data.frame(x = 1:10, y = 1:10)
print(df)
		`, ['3@df'], [[]]);

	});

}));
