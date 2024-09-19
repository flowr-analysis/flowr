import { assertDataflow, withShell } from '../../_helper/shell';
import type { DataflowGraph } from '../../../../src/dataflow/graph/graph';
import { emptyGraph } from '../../_helper/dataflow/dataflowgraph-builder';
import { defaultEnv } from '../../_helper/dataflow/environment-builder';

/** subgraph tests to show every vertex and edge in action */
describe('Graph Components', withShell(shell => {
	function test(name: string, code: string, graph: DataflowGraph) {
		/* we do not need labels as these tests are systematic for the dataflow graph */
		assertDataflow(name,
			shell, code,  graph,
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true
			});
	}
	test('0) Empty graph', '', emptyGraph());
	describe('Vertices', () => {
		/* describes a constant value (numbers, logicals, strings, ...) */
		test('1) Value Vertex', '42', emptyGraph().constant('0'));
		/* describes variable references */
		test('2) Use vertex', 'x', emptyGraph().use('1@x', 'x'));
		/* describes any kind of function call, these can happen implicitly as well! (see the extra cases) */
		test('3) Function Call', 'foo()', emptyGraph().call('1@foo', 'foo', []));
		/* describes a defined variable. Not just `<-` causes this! */
		test('4) Define vertex', 'x <- 1', emptyGraph().defineVariable('1@x', 'x'));
		/* function definitions are always anonymous at first; although they can be bound to a name, the id `0` refers to the '1' in the body */
		test('5) Function Definition', 'function() 1', emptyGraph().defineFunction('1@function', [0], { graph: new Set('0'), in: [], out: [], unknownReferences: [], entryPoint: 0, environment: defaultEnv() }));
		describe('Extra Cases', () => {
			/* although this changes the way we resolve it, this has no effect on the type of vertex! */
			test('Globally Defined Variable', 'x <<- 1', emptyGraph().defineVariable('1@x', 'x'));
			/* control structures like `if` are desugared into function calls (we omit the arguments of `if`(TRUE, 1) for simplicity). */
			test('If', 'if(TRUE) 1', emptyGraph().call('1@if', 'if', [], { onlyBuiltIn: true }));
		});
	});
	describe('Edges', () => {
		/** The source vertex is usually a `use` that reads from the respective target definition */
		test('1) Reads Edge (Variable)', 'x <- 2\nprint(x)', emptyGraph().reads('2@x', '1@x'));
		test('1) Reads Edge (Call)', 'x <- 2\nprint(x)', emptyGraph().reads('2@x', '1@x'));
	});
}));
