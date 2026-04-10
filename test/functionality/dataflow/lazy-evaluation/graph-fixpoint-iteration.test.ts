import { describe, test, expect } from 'vitest';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import { VertexType } from '../../../../src/dataflow/graph/vertex';
import { EdgeType } from '../../../../src/dataflow/graph/edge';
import type { REnvironmentInformation } from '../../../../src/dataflow/environments/environment';
import { FlowrAnalyzerEnvironmentContext } from '../../../../src/project/context/flowr-analyzer-environment-context';
import { defaultConfigOptions } from '../../../../src/config';
import type { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';

describe('DataflowGraph Fixpoint Iteration', () => {
	function makeCleanEnv(): REnvironmentInformation {
		const ctx = new FlowrAnalyzerEnvironmentContext({ config: defaultConfigOptions } as FlowrAnalyzerContext);
		return ctx.makeCleanEnv();
	}

	describe('vertices() iterator', () => {
		test('should iterate over all vertices when new vertices are added during iteration', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			// Add initial vertices
			graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Use, id: 2, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Use, id: 3, cds: undefined }, env);

			const collected: number[] = [];
			let addedNewVertex = false;

			// Iterate and add a new vertex during iteration
			for(const [id] of graph.vertices(true)) {
				collected.push(id as number);

				// Add a new vertex after processing id 2
				if(id === 2 && !addedNewVertex) {
					graph.addVertex({ tag: VertexType.Use, id: 4, cds: undefined }, env);
					addedNewVertex = true;
				}
			}

			// Should include all 4 vertices, including the one added during iteration
			expect(collected).toHaveLength(4);
			expect(collected).toContain(1);
			expect(collected).toContain(2);
			expect(collected).toContain(3);
			expect(collected).toContain(4);
		});

		test('should handle root vertices iteration with additions during traversal', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			// Add initial root vertices
			graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env, true);
			graph.addVertex({ tag: VertexType.Use, id: 2, cds: undefined }, env, true);

			const collected: number[] = [];
			let addedNewVertex = false;

			// Iterate over root vertices only
			for(const [id] of graph.vertices(false)) {
				collected.push(id as number);

				// Add a new root vertex during iteration
				if(id === 1 && !addedNewVertex) {
					graph.addVertex({ tag: VertexType.Use, id: 3, cds: undefined }, env, true);
					addedNewVertex = true;
				}
			}

			// Should include the new root vertex added during iteration
			expect(collected).toHaveLength(3);
			expect(collected).toContain(1);
			expect(collected).toContain(2);
			expect(collected).toContain(3);
		});

		test('should handle multiple additions during iteration', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env);

			const collected: number[] = [];

			for(const [id] of graph.vertices(true)) {
				collected.push(id as number);

				// Each vertex triggers adding another vertex (up to a limit)
				const nextId = (id as number) + 1;
				if(nextId <= 5) {
					graph.addVertex({ tag: VertexType.Use, id: nextId, cds: undefined }, env);
				}
			}

			// Should have processed all cascaded additions
			expect(collected).toHaveLength(5);
			expect(collected).toEqual([1, 2, 3, 4, 5]);
		});
	});

	describe('verticesOfType() iterator', () => {
		test('should iterate over all vertices of a type when new vertices are added during iteration', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			// Add initial vertices of different types
			graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Use, id: 2, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Value, id: 10, cds: undefined }, env);

			const collected: number[] = [];
			let addedNewVertex = false;

			// Iterate over Use vertices and add a new Use vertex during iteration
			for(const [id] of graph.verticesOfType(VertexType.Use)) {
				collected.push(id as number);

				// Add a new Use vertex after processing id 1
				if(id === 1 && !addedNewVertex) {
					graph.addVertex({ tag: VertexType.Use, id: 3, cds: undefined }, env);
					addedNewVertex = true;
				}
			}

			// Should include all 3 Use vertices, including the one added during iteration
			expect(collected).toHaveLength(3);
			expect(collected).toContain(1);
			expect(collected).toContain(2);
			expect(collected).toContain(3);
		});

		test('should handle graph merge during iteration', () => {
			const graph1 = new DataflowGraph(undefined);
			const graph2 = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			// Add vertices to both graphs
			graph1.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env);
			graph1.addVertex({ tag: VertexType.Use, id: 2, cds: undefined }, env);

			graph2.addVertex({ tag: VertexType.Use, id: 3, cds: undefined }, env);
			graph2.addVertex({ tag: VertexType.Use, id: 4, cds: undefined }, env);

			const collected: number[] = [];
			let merged = false;

			// Iterate and merge another graph during iteration
			for(const [id] of graph1.verticesOfType(VertexType.Use)) {
				collected.push(id as number);

				// Merge graph2 after processing first vertex
				if(id === 1 && !merged) {
					graph1.mergeWith(graph2);
					merged = true;
				}
			}

			// Should include all vertices from both graphs
			expect(collected).toHaveLength(4);
			expect(collected).toContain(1);
			expect(collected).toContain(2);
			expect(collected).toContain(3);
			expect(collected).toContain(4);
		});

		test('should handle type changes during iteration', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			// Add vertices
			graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Value, id: 2, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Use, id: 3, cds: undefined }, env);

			const collected: number[] = [];
			let addedVertex = false;

			// Iterate over Use vertices
			for(const [id] of graph.verticesOfType(VertexType.Use)) {
				collected.push(id as number);

				// Add another Use vertex during iteration
				if(id === 1 && !addedVertex) {
					graph.addVertex({ tag: VertexType.Use, id: 4, cds: undefined }, env);
					addedVertex = true;
				}
			}

			// Should only include Use vertices
			expect(collected).toHaveLength(3);
			expect(collected).toContain(1);
			expect(collected).toContain(3);
			expect(collected).toContain(4);
			expect(collected).not.toContain(2); // Value vertex should not be included
		});

		test('should handle empty type with additions during iteration', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			// Start with no FunctionDefinition vertices
			graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env);

			const collected: number[] = [];
			let firstCheck = true;

			// Try to iterate over FunctionDefinition (initially empty)
			for(const [id] of graph.verticesOfType(VertexType.FunctionDefinition)) {
				collected.push(id as number);

				// This should not execute in first iteration
				if(firstCheck) {
					firstCheck = false;
				}
			}

			// Should be empty initially
			expect(collected).toHaveLength(0);
			expect(firstCheck).toBe(true);

			// Now add a FunctionDefinition and check if subsequent iteration works
			graph.addVertex({
				tag:     VertexType.FunctionDefinition,
				id:      10,
				cds:     undefined,
				subflow: {
					unknownReferences: [],
					in:                [],
					out:               [],
					entryPoint:        10,
					graph:             new Set(),
					environment:       env,
					hooks:             []
				},
				exitPoints: [],
				params:     {}
			}, env);

			const collected2: number[] = [];
			for(const [id] of graph.verticesOfType(VertexType.FunctionDefinition)) {
				collected2.push(id as number);
			}

			expect(collected2).toHaveLength(1);
			expect(collected2).toContain(10);
		});
	});

	describe('edges() iterator', () => {
		test('should iterate over all edges when new edges are added during iteration', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			// Add vertices
			graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Use, id: 2, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Use, id: 3, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Use, id: 4, cds: undefined }, env);

			// Add initial edges
			graph.addEdge(1, 2, EdgeType.Reads);
			graph.addEdge(2, 3, EdgeType.Reads);

			const collectedSources: number[] = [];
			let addedNewEdge = false;

			// Iterate and add a new edge during iteration
			for(const [sourceId] of graph.edges()) {
				collectedSources.push(sourceId as number);

				// Add a new edge after processing source 1
				if(sourceId === 1 && !addedNewEdge) {
					graph.addEdge(3, 4, EdgeType.Reads);
					addedNewEdge = true;
				}
			}

			// Should include all 3 edge sources, including the one added during iteration
			expect(collectedSources).toHaveLength(3);
			expect(collectedSources).toContain(1);
			expect(collectedSources).toContain(2);
			expect(collectedSources).toContain(3);
		});

		test('should handle multiple edge additions during iteration', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			// Add vertices
			for(let i = 1; i <= 10; i++) {
				graph.addVertex({ tag: VertexType.Use, id: i, cds: undefined }, env);
			}

			// Add initial edge
			graph.addEdge(1, 2, EdgeType.Reads);

			const collectedSources: number[] = [];

			for(const [sourceId] of graph.edges()) {
				collectedSources.push(sourceId as number);

				// Add more edges during iteration (up to a limit)
				const nextSource = (sourceId as number) + 1;
				if(nextSource <= 5) {
					graph.addEdge(nextSource, nextSource + 1, EdgeType.Reads);
				}
			}

			// Should have processed all cascaded edge additions
			expect(collectedSources).toHaveLength(5);
			expect(collectedSources).toEqual([1, 2, 3, 4, 5]);
		});
	});

	describe('combined scenarios', () => {
		test('should handle vertices and edges added simultaneously during iteration', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Use, id: 2, cds: undefined }, env);
			graph.addEdge(1, 2, EdgeType.Reads);

			const vertexIds: number[] = [];
			let addedDuringIteration = false;

			for(const [id] of graph.vertices(true)) {
				vertexIds.push(id as number);

				if(id === 1 && !addedDuringIteration) {
					// Add both a new vertex and a new edge
					graph.addVertex({ tag: VertexType.Use, id: 3, cds: undefined }, env);
					graph.addEdge(2, 3, EdgeType.Reads);
					addedDuringIteration = true;
				}
			}

			expect(vertexIds).toHaveLength(3);
			expect(vertexIds).toContain(3);

			// Verify the edge was added correctly
			const edgeSources: number[] = [];
			for(const [sourceId] of graph.edges()) {
				edgeSources.push(sourceId as number);
			}
			expect(edgeSources).toHaveLength(2);
			expect(edgeSources).toContain(2);
		});

		test('should not re-yield vertices already seen', () => {
			const graph = new DataflowGraph(undefined);
			const env = makeCleanEnv();

			graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env);
			graph.addVertex({ tag: VertexType.Use, id: 2, cds: undefined }, env);

			const vertexIds: number[] = [];

			for(const [id] of graph.vertices(true)) {
				vertexIds.push(id as number);

				// Try to re-add the same vertex (should be deduplicated)
				if(id === 1) {
					graph.addVertex({ tag: VertexType.Use, id: 1, cds: undefined }, env, true, false);
				}
			}

			// Each vertex should appear exactly once
			expect(vertexIds).toHaveLength(2);
			expect(vertexIds.filter(id => id === 1)).toHaveLength(1);
			expect(vertexIds.filter(id => id === 2)).toHaveLength(1);
		});
	});
});
