import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type { DataflowQuery } from '../../../../src/queries/catalog/dataflow-query/dataflow-query-format';
import { withTreeSitter } from '../../_helper/shell';
import { assert, describe } from 'vitest';
import { jsonReplacer } from '../../../../src/util/json';

describe('Dataflow Query', { concurrent: false }, withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly DataflowQuery[]) {
		assertQuery(label(name), parser, code, query, ({ dataflow }) => ({ dataflow: { graph: dataflow.graph } }));
	}

	testQuery('Single dataflow', 'x + 1', [{ type: 'dataflow' }]);
	testQuery('Multiple Queries', 'x + 1', [{ type: 'dataflow' }, { type: 'dataflow' }, { type: 'dataflow' }]);
	assertQuery(label('Without environments'), parser, 'f <- function(x) x + 1\nf(2)', [{ type: 'dataflow', environments: false }], ({ dataflow }) => {
		const graph = dataflow.graph.withoutEnvironments();
		assert.notInclude(JSON.stringify(graph, jsonReplacer), '"environment"');
		assert.deepStrictEqual([...graph.vertices(true)].map(([id]) => id), [...dataflow.graph.vertices(true)].map(([id]) => id));
		assert.deepStrictEqual([...graph.rootIds()], [...dataflow.graph.rootIds()]);
		assert.strictEqual(JSON.stringify([...graph.edges()], jsonReplacer), JSON.stringify([...dataflow.graph.edges()], jsonReplacer));
		return { dataflow: { graph } };
	});
}));
