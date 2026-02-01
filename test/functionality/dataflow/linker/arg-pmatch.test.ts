import { assert, describe, test } from 'vitest';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { linkArgumentsOnCall } from '../../../../src/dataflow/internal/linker';
import type { FunctionArgument, OutgoingEdges } from '../../../../src/dataflow/graph/graph';
import { ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { EmptyArgument } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RParameter } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import { rangeFrom } from '../../../../src/util/range';
import type { ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { RoleInParent } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/role';
import { EdgeType } from '../../../../src/dataflow/graph/edge';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { label } from '../../_helper/label';

describe('Dataflow Linker - Argument Matching', () => {
	/**
	 * Give the argument names (or pos for positional, null for missing),
	 * the parameters as their list of names (supporting `...`),
	 * and expected as an array of same length as args, indicating the matched parameter name for each argument.
	 * @param args     - The argument names (or 'pos' for positional, null for missing)
	 * @param params   - The parameter names
	 * @param expected - The expected matched parameter names (or ' ' for no match)
	 */
	function check(
		args: (string | 'pos' | null)[],
		params: string[],
		expected: string[]
	) {
		// resolve-arguments
		const testName = `args(${args.map(a => a === null ? ' ' : a).map(a => a === 'pos' ? '<>' : a).join(', ')}), params(${params.join(', ')}) => expected(${expected.join(', ')})`;
		test(label(testName, ['resolve-arguments'], ['dataflow']), () => {
			// we cheat by using the names as their ids!
			const graph = emptyGraph();
			const useArgs: FunctionArgument[] = args.map((name, idx) => (
				name === null ? EmptyArgument : {
					nodeId: `arg-${idx}`,
					type:   ReferenceType.Argument,
					name:   name === 'pos' ? undefined : name,
					cds:    undefined
				} satisfies FunctionArgument));

			const useParams: RParameter<ParentInformation>[] = params.map((name, idx) => ({
				type: RType.Parameter,
				name: {
					type:     RType.Symbol,
					content:  name,
					lexeme:   name,
					location: rangeFrom(0, 0, 0, 0),
					info:     {
						id:      'param-' + idx,
						role:    RoleInParent.ParameterName,
						parent:  'param-' + idx,
						nesting: 1,
						index:   0
					}
				},
				info: {
					id:      'param-wrap-' + idx,
					role:    RoleInParent.FunctionDefinitionParameter,
					parent:  'func-def',
					nesting: 1,
					index:   idx
				},
				location:     rangeFrom(0, 0, 0, 0),
				lexeme:       name,
				special:      name === '...',
				defaultValue: undefined
			} satisfies RParameter<ParentInformation>));

			linkArgumentsOnCall(useArgs, useParams, graph);

			const edges = new Map(graph.edges());
			for(let i = 0; i < expected.length; i++) {
				const exp = expected[i];
				if(exp === ' ') {
					continue; // no link1
				}
				const paramIdx = params.findIndex(p => p === exp);
				if(paramIdx === -1) {
					throw new Error(`Test setup error: expected parameter ${exp} not found in params ${params.join(', ')}`);
				}
				const param = useParams[paramIdx];
				const from = 'arg-' + i;
				const to = String(param.name.info.id);
				assertHasEdge(from, to, EdgeType.DefinesOnCall, edges);
				assertHasEdge(to, from, EdgeType.DefinedByOnCall, edges);
			}
			// assert that we have only as many edges as expected
			const expectedEdgeCount = expected.filter(e => e !== ' ').length * 2;
			assert.strictEqual(edges.size, expectedEdgeCount, `Expected ${expectedEdgeCount} edges, but got ${edges.size}`);
		});
		function assertHasEdge(from: string, to: string, type: EdgeType, edges: Map<NodeId, OutgoingEdges>): void {
			try {
				assert.isTrue(edges.has(from), `Expected edge from ${from} to ${to} (type ${type})`);
				const outEdge = edges.get(from)?.get(to);
				assert.isDefined(outEdge, `Expected edge from ${from} to ${to} (type ${type})`);
				assert.strictEqual(outEdge.types, type, `Expected edge from ${from} to ${to} to be of type ${type}`);
			} catch(err) {
				console.error(edges);
				throw err;
			}
		}
	}
	describe('Positional Fun', () => {
	// f(x); with f <- function(x) { ... }
		check(['x'], ['x'], ['x']);
		check(['pos'], ['x'], ['x']);
		check([null], ['x'], [' ']);
		check(['y'], ['x'], [' ']);
		check(['y'], ['x', 'y'], ['y']);
		check(['x', 'y'], ['x', 'y'], ['x', 'y']);
		check(['y', 'x'], ['x', 'y'], ['y', 'x']);
		check(['pos', 'pos'], ['x', 'y'], ['x', 'y']);
		check(['x', 'pos'], ['x', 'y'], ['x', 'y']);
		check(['pos', 'y'], ['x', 'y'], ['x', 'y']);
		check(['pos', 'x'], ['x', 'y'], ['y', 'x']);
		check(['y', 'pos'], ['x', 'y'], ['y', 'x']);
		check(['y', 'pos', 'x'], ['x', 'y', 'z'], ['y', 'z', 'x']);
		check(['y', 'pos', 'pos'], ['x', 'y', 'z'], ['y', 'x', 'z']);
	});
	describe('Partial Matches', () => {
		check(['x'], ['xylo'], ['xylo']);
		check(['xylo'], ['x'], [' ']);
		check(['x'], ['ylo'], [' ']);
		check(['x', 'pos'], ['xylo', 'x'], ['x', 'xylo']);
		check(['pos', 'x'], ['x', 'xylo'], ['xylo', 'x']);
		check(['x'], ['xylo', 'xander'], [' ']);
		check(['ab'], ['ab', 'abcd'], ['ab']);
		check(['ab'], ['abcd', 'ab'], ['ab']);
	});
	describe('with ... parameter', () => {
		check(['x'], ['...', 'x'], ['x']);
		check(['pos'], ['...', 'x'], ['...']);
		check([null], ['...', 'x'], [' ']);
		describe('with ... and prefixes', () => {
			// variables declared *after* ... should not be matched by prefix but only by exact name
			check(['xylo'], ['...', 'x'], ['...']);
			check(['x'], ['...', 'xylo'], ['...']);
			check(['x'], ['x', '...', 'xylo'], ['x']);
			check(['x', 'pos'], ['...', 'xylo', 'x'], ['x', '...']);
			check(['x'], ['xylo', '...', 'x'], ['x']);
			check(['x'], ['xylo', '...', 'xb'], ['xylo']);
		});
	});
});