import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type { DataflowQuery } from '../../../../src/queries/catalog/dataflow-query/dataflow-query-format';
import { withShell } from '../../_helper/shell';
import { assert, describe } from 'vitest';
import { ResolveValueQuery, ResolveValueQueryResult } from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-format';
import { fingerPrintOfQuery } from '../../../../src/queries/catalog/resolve-value-query/resolve-value-query-executor';
import { resolveToValues } from '../../../../src/dataflow/environments/resolve-by-name';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { recoverName } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe.sequential('Resolve Value Query', withShell(shell => {
	function testQuery(name: string, code: string, queries: readonly ResolveValueQuery[]) {
		assertQuery(label(name), shell, code, queries, ({dataflow}) => {
			const results: ResolveValueQueryResult['results'] = {};
			
			const idMap = dataflow.graph.idMap;
			assert(idMap !== undefined);

			for (const query of queries) {
				const key = fingerPrintOfQuery(query);
				const identifiers = query.criteria
					.map(criteria => slicingCriterionToId(criteria, idMap))
					.map(id => recoverName(id, idMap));

				const values = identifiers
					.flatMap(id => resolveToValues(id, dataflow.environment, dataflow.graph));

				results[key] = {
					values: [... new Set(values)]
				}
			}

			return {
				'resolve-value': { results }
			}
		});
	}

	testQuery('Single dataflow', 'x <- 1', [{ type: 'resolve-value', criteria: ["1@x"] }]);
	testQuery('Multiple Queries', 'x <- 1', [{ type: 'resolve-value', criteria: ["1@x"] }, { type: 'resolve-value', criteria: ["1@x"] }, { type: 'resolve-value', criteria: ["1@x"] }]);
}));
