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
		/* Value: describes a constant value (numbers, logicals, strings, ...) */
		test('1) Value Vertex', '42', emptyGraph().constant('0'));
		/* Use: describes symbol/variable references */
		test('2) Use Vertex', 'x', emptyGraph().use('1@x', 'x'));
		/* Function Call: describes any kind of function call, these can happen implicitly as well! (see the notable cases) */
		test('3) Function Call Vertex', 'foo()', emptyGraph().call('1@foo', 'foo', []));
		/* Defined Variable: describes a defined variable. Not just `<-` causes this! */
		test('4) Define Variable Vertex', 'x <- 1', emptyGraph().defineVariable('1@x', 'x'));
		/* Function Definition: are always anonymous at first; although they can be bound to a name, the id `0` refers to the '1' in the body */
		test('5) Function Definition Vertex', 'function() 1', emptyGraph().defineFunction('1@function', [0], { graph: new Set('0'), in: [], out: [], unknownReferences: [], entryPoint: 0, environment: defaultEnv() }));
		describe('Notable Cases', () => {
			/* although this changes the way we resolve it, this has no effect on the type of vertex! */
			test('Globally Defined Variable', 'x <<- 1', emptyGraph().defineVariable('1@x', 'x'));
			/* control structures like `if` are desugared into function calls (we omit the arguments of `if`(TRUE, 1) for simplicity). */
			test('If', 'if(TRUE) 1', emptyGraph().call('1@if', 'if', [], { onlyBuiltIn: true }));
		});
	});
	describe('Edges', () => {
		/* Reads: The source vertex is usually a `use` that reads from the respective target definition */
		test('1.1) Reads Edge (Variable)', 'x <- 2\nprint(x)', emptyGraph().reads('2@x', '1@x'));
		test('1.2) Reads Edge (Call)', 'foo <- function() {}\nfoo()', emptyGraph().reads('2@foo', '1@foo'));
		/* Defined By: The source vertex is usually a `define variable` that is defined by the respective target use.
		 * However, nested definitions can carry it (in the nested case, `x` is defined by the return value of `<-`(y, z)).
		 * Additionally, we link the assignment.
		 */
		test('2.1) Defined By (Variable)', 'x <- y', emptyGraph().definedBy('1@x', '1@y').definedBy('1@x', '1:3') /* link to `<-` */);
		test('2.2) Defined By (Nested)', 'x <- y <- z', emptyGraph().definedBy('1@x', '1:3').definedBy('1@x', '1:8').definedBy('1@y', '1:8'));
		/* Calls: link the function call to the (anonymous) function definition. */
		test('3) Calls Edge', 'foo <- function() {}\nfoo()', emptyGraph().calls('2@foo', '1@function'));
		/* Returns: link the function call to the exit points of the target definition (this may incorporate the call-context). */
		test('4) Returns Edge', 'foo <- function() x\nfoo()', emptyGraph().returns('2@foo', '1@x'));
		/* Defines on Call:
		 * link an Argument to whichever parameter they cause to be defined if the related function call is invoked
		 * (here we use the ids as the argument wrappers are not easily selected with slicing criteria).
		 */
		test('5) Defines on Call', 'f <- function(x) {}\nf(x=1)', emptyGraph().definesOnCall('$11', '$1'));
		/* Defined By on Call: represents the other direction of `defines on call`
		 * (i.e., links the parameter to the argument).
		 * The Dataflow Builder Already inserts both edges :D!
		 * This test is just for completeness.
		 */
		test('6) Defines By on Call', 'f <- function(x) {}\nf(x=1)', emptyGraph().definesOnCall('$11', '$1'));
		/* Argument: links a function call to the entry point of its arguments.
		 * If we do not know the target of such a call,
		 * we automatically assume that all arguments are read by the call as well!
		 */
		test('7) Argument Edge', 'f(x,y)', emptyGraph().argument('1@f', '1@x').reads('1@f', '1@x').argument('1@f', '1@y').reads('1@f', '1@y'));
		/* Side Effect on Call: Links a global side effect to an affected function call (e.g., a super definition within the function body) */
		test('8) Side Effect on Call', 'f <- function() { x <<- 2 }\nf()', emptyGraph().sideEffectOnCall('1@x', '2@f'));
		/* Non-Standard Evaluation: Marks cases in which R's non-standard evaluation mechanisms cause the default semantics to deviate */
		test('9) Non-Standard Evaluation', 'quote(x)', emptyGraph().argument('1@quote', '1@x').nse('1@quote', '1@x'));
		describe('Notable Cases', () => {
			test('Parameter Values May Read Each-Other', 'f <- function(x, y=x) {}', emptyGraph().reads('1:20', '1@x'));
			/* here, we are defined by the `+` */
			test('Define By Expressions', 'x <- y + z', emptyGraph().definedBy('1@x', '1:8'));
		});
	});
}));
