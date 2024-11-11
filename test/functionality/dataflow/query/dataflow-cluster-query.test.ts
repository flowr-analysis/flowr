import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withShell } from '../../_helper/shell';
import { findAllClusters } from '../../../../src/dataflow/cluster';
import type { DataflowClusterQuery } from '../../../../src/queries/catalog/cluster-query/cluster-query-format';
import { describe } from 'vitest';

describe.sequential('Dataflow Cluster Query', withShell(shell => {
	function testQuery(name: string, code: string, query: readonly DataflowClusterQuery[]) {
		assertQuery(label(name), shell, code, query, ({ dataflow }) => ({ 'dataflow-cluster': { clusters: findAllClusters(dataflow.graph) } }));
	}

	testQuery('Single Expression', 'x + 1', [{ type: 'dataflow-cluster' }]);
	testQuery('Multiple Queries', 'x + 1', [{ type: 'dataflow-cluster' }, { type: 'dataflow-cluster' }, { type: 'dataflow-cluster' }]);
}));
