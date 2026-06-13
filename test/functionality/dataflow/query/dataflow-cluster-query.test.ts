import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { findAllClusters } from '../../../../src/dataflow/cluster';
import type { DataflowClusterQuery } from '../../../../src/queries/catalog/cluster-query/cluster-query-format';
import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';

describe('Dataflow Cluster Query', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly DataflowClusterQuery[]) {
		assertQuery(label(name), parser, code, query, ({ dataflow }) => ({ 'dataflow-cluster': { clusters: findAllClusters(dataflow.graph) } }));
	}

	testQuery('Single Expression', 'x + 1', [{ type: 'dataflow-cluster' }]);
	testQuery('Multiple Queries', 'x + 1', [{ type: 'dataflow-cluster' }, { type: 'dataflow-cluster' }, { type: 'dataflow-cluster' }]);
}));
