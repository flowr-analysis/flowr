import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type { DataflowQuery } from '../../../../src/queries/catalog/dataflow-query/dataflow-query-format';
import { withShell } from '../../_helper/shell';
import { describe } from 'vitest';

describe.sequential('Dataflow Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly DataflowQuery[]) {
		assertQuery(label(name), shell, code, query, ({ dataflow }) => ({ dataflow: { graph: dataflow.graph } }));
	}

	testQuery('Single dataflow', 'x + 1', [{ type: 'dataflow' }]);
	testQuery('Multiple Queries', 'x + 1', [{ type: 'dataflow' }, { type: 'dataflow' }, { type: 'dataflow' }]);
}));
