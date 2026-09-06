import { describe, assert, test } from 'vitest';
import type { DataflowGraphJson } from '../../../../src/dataflow/graph/graph';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../../../src/dataflow/graph/vertex';
import { VertexType } from '../../../../src/dataflow/graph/vertex';
import { EdgeType } from '../../../../src/dataflow/graph/edge';
import { BuiltInProcName } from '../../../../src/dataflow/environments/built-in-proc-name';
import { Identifier, ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { Environment } from '../../../../src/dataflow/environments/environment';
import type { REnvironmentInformation } from '../../../../src/dataflow/environments/environment';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

/**
 * `verticesOfType` answers from an index keyed by tag. A stale entry hands out a vertex without the fields its
 * tag promises (a `fcall` without an `origin`, say), a duplicate hands the same vertex out twice, and an index
 * that was never built hands out nothing at all. These pin all three.
 */
describe('DataflowGraph vertex type index', () => {
	const env = (): REnvironmentInformation => ({ current: new Environment(undefined as unknown as Environment), level: 0 });
	const ids = (graph: DataflowGraph, type: VertexType): NodeId[] => [...graph.verticesOfType(type)].map(([id]) => id);

	function withUse(id: NodeId): DataflowGraph {
		const graph = new DataflowGraph(undefined);
		graph.addVertex({ tag: VertexType.Use, id, cds: undefined }, env());
		return graph;
	}

	function makeCall(id: NodeId): DataflowGraphVertexFunctionCall {
		return {
			tag:         VertexType.FunctionCall,
			id,
			name:        Identifier.make('f'),
			args:        [],
			onlyBuiltin: false,
			environment: undefined,
			cds:         undefined,
			origin:      [BuiltInProcName.Function]
		};
	}

	test('an overwrite retags instead of listing the vertex twice', () => {
		const graph = withUse('x');
		graph.addVertex(makeCall('x'), env(), true, true);
		assert.deepEqual(ids(graph, VertexType.Use), [], 'the use is gone, so the index must not name it');
		assert.deepEqual(ids(graph, VertexType.FunctionCall), ['x']);
	});

	test('an overwrite keeping the tag does not list the vertex twice', () => {
		const graph = new DataflowGraph(undefined);
		graph.addVertex(makeCall('x'), env());
		graph.addVertex(makeCall('x'), env(), true, true);
		assert.deepEqual(ids(graph, VertexType.FunctionCall), ['x']);
	});

	test('updateToFunctionCall moves the vertex over', () => {
		const graph = withUse('x');
		graph.updateToFunctionCall(makeCall('x'));
		assert.deepEqual(ids(graph, VertexType.Use), []);
		assert.deepEqual(ids(graph, VertexType.FunctionCall), ['x']);
	});

	test('setDefinitionOfVertex moves the vertex over', () => {
		const graph = new DataflowGraph(undefined);
		graph.addVertex(makeCall('x'), env());
		graph.setDefinitionOfVertex({ nodeId: 'x', name: Identifier.make('x'), type: ReferenceType.Variable, cds: undefined }, undefined);
		assert.deepEqual(ids(graph, VertexType.FunctionCall), [], 'a call that became a definition must not be named as a call');
		assert.deepEqual(ids(graph, VertexType.VariableDefinition), ['x']);
	});

	test('a merge keeps the tag the receiving graph settled on', () => {
		const other = withUse('x');
		const graph = new DataflowGraph(undefined);
		graph.addVertex(makeCall('x'), env());
		graph.mergeWith(other);
		assert.deepEqual(ids(graph, VertexType.Use), [], 'the other graph seeing the vertex as a use must not make it one here');
		assert.deepEqual(ids(graph, VertexType.FunctionCall), ['x'], 'and it must stay named exactly once');
	});

	test('a merge brings the vertices it adds into the index', () => {
		const other = withUse('y');
		const graph = withUse('x');
		graph.mergeWith(other);
		assert.deepEqual(ids(graph, VertexType.Use).sort(), ['x', 'y']);
	});

	test('skips a vertex another graph retagged in the object they share', () => {
		const built = new DataflowGraph(undefined);
		built.addVertex(makeCall('x'), env());
		const merged = new DataflowGraph(undefined).mergeWith(built);
		/* retags the very object `merged` holds, and only `built` hears about it */
		built.setDefinitionOfVertex({ nodeId: 'x', name: Identifier.make('x'), type: ReferenceType.Variable, cds: undefined }, undefined);
		assert.deepEqual(ids(merged, VertexType.FunctionCall), [], 'it is no call any more, so it must not be handed out as one');
		assert.deepEqual(merged.vertexIdsOfType(VertexType.FunctionCall), [], 'and the id list must not name it either');
	});

	test('a consumed graph refuses to be changed or merged again', () => {
		const given = withUse('x');
		new DataflowGraph(undefined).mergeWith(given, true, true);
		assert.throws(() => given.addEdge('x', 'y', EdgeType.Reads), /consumed/, 'writing to it would show up in the graph that took it');
		assert.throws(() => new DataflowGraph(undefined).mergeWith(given), /consumed/, 'and so would handing it on');
	});

	test('a round trip through json rebuilds the index', () => {
		const graph = withUse('x');
		graph.addVertex(makeCall('f'), env());
		const back = DataflowGraph.fromJson(JSON.parse(JSON.stringify(graph.toJSON())) as DataflowGraphJson);
		assert.deepEqual(ids(back, VertexType.Use), ['x']);
		assert.deepEqual(ids(back, VertexType.FunctionCall), ['f']);
	});
});
