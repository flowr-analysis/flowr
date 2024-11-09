import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import type {
	LineageQuery,
	LineageQueryResult
} from '../../../../src/queries/catalog/lineage-query/lineage-query-format';
import { getLineage } from '../../../../src/cli/repl/commands/repl-lineage';
import { describe } from 'vitest';

describe.sequential('Lineage Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly LineageQuery[]) {
		assertQuery(label(name), shell, code, query, ({ dataflow }) => ({
			'lineage': {
				lineages: query.reduce((acc, { criterion }) => {
					acc[criterion] = getLineage(criterion, dataflow.graph);
					return acc;
				}, {} as LineageQueryResult['lineages'])
			}
		}));
	}

	testQuery('Single Expression', 'x + 1', [{ type: 'lineage', criterion: '1@x' }]);
	testQuery('Multiple Queries', 'x + 1', [{ type: 'lineage', criterion: '1@x' }, { type: 'lineage', criterion: '1@x' }, { type: 'lineage', criterion: '1@x' }]);
}));
