import { describe, test, expect } from 'vitest';
import { DataflowGraph } from '../../../../src/dataflow/graph/graph';

describe('DataflowGraph Merge Callbacks', () => {
	test('should return current graph when callback is called', () => {
		const graph1 = new DataflowGraph(undefined);
		const graph2 = new DataflowGraph(undefined);

		const callback = graph2.createGraphCallback();

		// Initially, callback returns graph2
		expect(callback()).toBe(graph2);

		// Merge graph2 into graph1
		graph1.mergeWith(graph2);

		// After merge, callback now returns graph1 (the unified graph)
		expect(callback()).toBe(graph1);
	});

	test('should support multiple callbacks on same graph', () => {
		const graph1 = new DataflowGraph(undefined);
		const graph2 = new DataflowGraph(undefined);

		const callback1 = graph2.createGraphCallback();
		const callback2 = graph2.createGraphCallback();

		expect(callback1()).toBe(graph2);
		expect(callback2()).toBe(graph2);

		// Merge graph2 into graph1
		graph1.mergeWith(graph2);

		// Both callbacks now return the unified graph
		expect(callback1()).toBe(graph1);
		expect(callback2()).toBe(graph1);
	});

	test('should handle nested merges correctly', () => {
		const graph1 = new DataflowGraph(undefined);
		const graph2 = new DataflowGraph(undefined);
		const graph3 = new DataflowGraph(undefined);

		const callback2 = graph2.createGraphCallback();
		const callback3 = graph3.createGraphCallback();

		// Merge graph2 into graph1, then graph3 into graph1
		graph1.mergeWith(graph2);
		expect(callback2()).toBe(graph1);

		graph1.mergeWith(graph3);
		expect(callback3()).toBe(graph1);
		expect(callback2()).toBe(graph1);  // Still points to graph1
	});

	test('should return original graph if never merged', () => {
		const graph1 = new DataflowGraph(undefined);
		const callback = graph1.createGraphCallback();

		// If never merged, should return the original graph
		expect(callback()).toBe(graph1);
	});
});
