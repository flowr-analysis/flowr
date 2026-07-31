import type { CfgVertex, ControlFlowGraph } from '../control-flow/control-flow-graph';
import type { Identifier } from '../dataflow/environments/identifier';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { DataflowGraphVertexArgument, DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition, DataflowGraphVertexUse, DataflowGraphVertexValue, DataflowGraphVertexVariableDefinition } from '../dataflow/graph/vertex';
import type { ReadOnlyFlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import type { RLogicalValue } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { NormalizedAst, RNodeWithParent } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RFalse, RNull, RNumberValue, RStringValue, RTrue } from '../r-bridge/lang-4.x/convert-values';
import type { StateDomain, ValueDomain } from './domains/state-domain-like';

/**
 * The context passed to the {@link AbstractSemantics} handlers of an abstract domain,
 * providing access to the analyzed program (AST, DFG, CFG), the analyzer context, the value domain of the analysis,
 * as well as to the abstract states and values inferred so far.
 * @template Domain - Type of the state abstract domain the semantics are defined for
 */
export interface SemanticsContext<Domain extends StateDomain> {
	/** The normalized AST of the analyzed program */
	readonly ast:     NormalizedAst;
	/** The dataflow graph of the analyzed program */
	readonly dfg:     DataflowGraph;
	/** The control flow graph of the analyzed program */
	readonly cfg:     ControlFlowGraph;
	/** The current flowR analyzer context (e.g. for accessing the configuration or loaded files) */
	readonly context: ReadOnlyFlowrAnalyzerContext;
	/** The value abstract domain the semantics are defined for (e.g. to create Top or Bottom values) */
	readonly domain:  ValueDomain<Domain>;

	/**
	 * Gets the normalized AST node with the given node ID.
	 * @param nodeId - The ID of the node to get the AST node for
	 * @returns The normalized AST node, or `undefined` if there is no such node
	 */
	getAstNode(nodeId: NodeId | undefined): RNodeWithParent | undefined;

	/**
	 * Gets the dataflow graph vertex with the given node ID.
	 * @param vertexId - The ID of the vertex to get the dataflow graph vertex for
	 * @returns The dataflow graph vertex, or `undefined` if there is no such vertex
	 */
	getDfgVertex(vertexId: NodeId | undefined): DataflowGraphVertexArgument | undefined;

	/**
	 * Gets the control flow graph vertex with the given node ID.
	 * @param vertexId - The ID of the vertex to get the control flow graph vertex for
	 * @returns The control flow graph vertex, or `undefined` if there is no such vertex
	 */
	getCfgVertex(vertexId: NodeId | undefined): CfgVertex | undefined;

	/**
	 * Gets the abstract state inferred at the location of an AST node.
	 * @param nodeId - The ID of the node to get the abstract state at
	 * @returns The abstract state at the node, or `undefined` if the node has no abstract state (i.e. the node has not been visited or is unreachable)
	 */
	getAbstractState(nodeId: NodeId | undefined): Domain | undefined;

	/**
	 * Gets the origins of a variable use, i.e. the definitions the variable may be read from.
	 * @param nodeId - The ID of the node to get the variable origins for
	 * @returns The IDs of the definitions the variable may be read from
	 */
	getVariableOrigins(nodeId: NodeId): readonly NodeId[];

	/**
	 * Resolves the abstract value inferred for an AST node, by following symbols to their variable origins,
	 * arguments to their values, expression lists to their last expression, and pipes and `if` expressions to their results.
	 * @param node  - The node (or ID of the node) to get the inferred abstract value for
	 * @param state - An optional abstract state used to resolve the inferred value (defaults to the state at the requested node)
	 * @returns The inferred abstract value of the node, or `undefined` if no value was inferred for the node
	 */
	getAbstractValue(node: RNodeWithParent | NodeId | undefined, state?: Domain): ValueDomain<Domain> | undefined;
}

/**
 * The abstract semantics of an abstract domain, defining the abstract effect of the different R constructs on the abstract state.
 *
 * All handlers are optional, so only the semantics of the constructs relevant for the respective abstract domain have to be defined.
 * The handlers are called by the abstract interpretation visitor whenever the respective construct is visited,
 * and are expected to apply their effect by updating the passed abstract `state` in place.
 * @template Domain - Type of the state abstract domain the semantics are defined for
 */
export interface AbstractSemantics<Domain extends StateDomain> {
	/**
	 * Handles an expression list, such as the body of a function or a `{ ... }` block.
	 * @param state       - The abstract state to apply the semantics to
	 * @param vertex      - The dataflow graph vertex of the expression list
	 * @param ctx         - The semantics context of the analysis
	 * @param expressions - The IDs of the expressions contained in the expression list
	 */
	handleExpressionList?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>, expressions: readonly NodeId[]): void;

	/**
	 * Handles an `if`-`then`-`else` expression.
	 * @param state     - The abstract state to apply the semantics to
	 * @param vertex    - The dataflow graph vertex of the `if` expression
	 * @param ctx       - The semantics context of the analysis
	 * @param condition - The ID of the condition of the `if` expression
	 * @param then      - The ID of the branch taken if the condition holds
	 * @param otherwise - The ID of the branch taken if the condition does not hold (may be `undefined` if there is no `else` branch)
	 */
	handleIfThenElse?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>, condition: NodeId, then: NodeId, otherwise?: NodeId): void;

	/**
	 * Handles a `for` loop.
	 * @param state    - The abstract state to apply the semantics to
	 * @param vertex   - The dataflow graph vertex of the `for` loop
	 * @param ctx      - The semantics context of the analysis
	 * @param variable - The ID of the loop variable
	 * @param vector   - The ID of the vector the loop iterates over
	 * @param body     - The ID of the body of the loop
	 */
	handleForLoop?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>, variable: NodeId, vector: NodeId, body: NodeId): void;

	/**
	 * Handles a `while` loop.
	 * @param state     - The abstract state to apply the semantics to
	 * @param vertex    - The dataflow graph vertex of the `while` loop
	 * @param ctx       - The semantics context of the analysis
	 * @param condition - The ID of the condition of the loop
	 * @param body      - The ID of the body of the loop
	 */
	handleWhileLoop?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>, condition: NodeId, body: NodeId): void;

	/**
	 * Handles a `repeat` loop.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the `repeat` loop
	 * @param ctx    - The semantics context of the analysis
	 * @param body   - The ID of the body of the loop
	 */
	handleRepeatLoop?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>, body: NodeId): void;

	/**
	 * Handles a function call that is not covered by any of the other, more specific handlers (e.g. `data.frame(id = 1:5)`).
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the function call
	 * @param ctx    - The semantics context of the analysis
	 */
	handleFunctionCall?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>): void;

	/**
	 * Handles an assignment, such as `x <- 42` or `assign("x", 42)`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the assignment call
	 * @param ctx    - The semantics context of the analysis
	 * @param target - The ID of the assignment target the value is assigned to
	 * @param source - The ID of the assigned source expression
	 */
	handleAssignmentCall?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>, target: NodeId, source: NodeId): void;

	/**
	 * Handles a replacement call, i.e. an assignment to a function call such as `names(x) <- "id"` or `x$id <- 1:5`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the replacement call
	 * @param ctx    - The semantics context of the analysis
	 * @param target - The ID of the assignment target the value is assigned to
	 * @param source - The ID of the assigned source expression
	 */
	handleReplacementCall?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>, target: NodeId, source: NodeId): void;

	/**
	 * Handles an access operation, such as `x[1]`, `x[[1]]`, or `x$id`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the access call
	 * @param ctx    - The semantics context of the analysis
	 * @param target - The ID of the accessed expression
	 */
	handleAccessCall?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>, target: NodeId): void;

	/**
	 * Handles a pipe expression, such as `x |> head()`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the pipe call
	 * @param ctx    - The semantics context of the analysis
	 */
	handlePipeCall?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>): void;

	/**
	 * Handles a `break` (or `next`) call within a loop.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the `break` call
	 * @param ctx    - The semantics context of the analysis
	 */
	handleBreakCall?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>): void;

	/**
	 * Handles a `return` call within a function definition.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the `return` call
	 * @param ctx    - The semantics context of the analysis
	 */
	handleReturnCall?(state: Domain, vertex: DataflowGraphVertexFunctionCall, ctx: SemanticsContext<Domain>): void;

	/**
	 * Handles a string constant, such as `"id"`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the constant
	 * @param ctx    - The semantics context of the analysis
	 * @param value  - The concrete value of the string constant
	 */
	handleStringConstant?(state: Domain, vertex: DataflowGraphVertexValue, ctx: SemanticsContext<Domain>, value: RStringValue): void;

	/**
	 * Handles a numeric constant, such as `42`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the constant
	 * @param ctx    - The semantics context of the analysis
	 * @param value  - The concrete value of the number constant
	 */
	handleNumberConstant?(state: Domain, vertex: DataflowGraphVertexValue, ctx: SemanticsContext<Domain>, value: RNumberValue): void;

	/**
	 * Handles a logical constant, i.e. `TRUE` or `FALSE`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the constant
	 * @param ctx    - The semantics context of the analysis
	 * @param value  - The concrete value of the logical constant
	 */
	handleLogicalConstant?(state: Domain, vertex: DataflowGraphVertexValue, ctx: SemanticsContext<Domain>, value: RLogicalValue): void;

	/**
	 * Handles the `NULL` constant.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the constant
	 * @param ctx    - The semantics context of the analysis
	 * @param value  - The concrete value of the constant (always `NULL`)
	 */
	handleNullConstant?(state: Domain, vertex: DataflowGraphVertexValue, ctx: SemanticsContext<Domain>, value: typeof RNull): void;

	/**
	 * Handles a symbol constant, i.e. a symbol that is not a variable use, such as `NA` or `Inf`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the constant
	 * @param ctx    - The semantics context of the analysis
	 * @param value  - The identifier of the symbol constant
	 */
	handleSymbolConstant?(state: Domain, vertex: DataflowGraphVertexValue, ctx: SemanticsContext<Domain>, value: Identifier): void;

	/**
	 * Handles the use of a variable, such as `x` in `print(x)`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the variable use
	 * @param ctx    - The semantics context of the analysis
	 */
	handleVariableUse?(state: Domain, vertex: DataflowGraphVertexUse, ctx: SemanticsContext<Domain>): void;

	/**
	 * Handles the definition of a variable, such as `x` in `x <- 42`.
	 * @param state  - The abstract state to apply the semantics to
	 * @param vertex - The dataflow graph vertex of the variable definition
	 * @param ctx    - The semantics context of the analysis
	 */
	handleVariableDefinition?(state: Domain, vertex: DataflowGraphVertexVariableDefinition, ctx: SemanticsContext<Domain>): void;

	/**
	 * Handles a function definition, such as `function(x) x + 1`.
	 * @param state      - The abstract state to apply the semantics to
	 * @param vertex     - The dataflow graph vertex of the function definition
	 * @param ctx        - The semantics context of the analysis
	 * @param parameters - The IDs of the parameters of the defined function
	 */
	handleFunctionDefinition?(state: Domain, vertex: DataflowGraphVertexFunctionDefinition, ctx: SemanticsContext<Domain>, parameters: readonly NodeId[]): void;

	/**
	 * Handles a control flow edge that is only taken if a condition evaluates to a specific value,
	 * allowing to refine the abstract state with the information gained from the taken branch.
	 * @param state     - The abstract state to apply the semantics to
	 * @param vertex    - The dataflow graph vertex of the node the branch leads to
	 * @param ctx       - The semantics context of the analysis
	 * @param condition - The ID of the condition guarding the branch
	 * @param branch    - Whether the branch is taken if the condition evaluates to `TRUE` or to `FALSE`
	 */
	handleConditionBranch?(state: Domain, vertex: DataflowGraphVertexArgument, ctx: SemanticsContext<Domain>, condition: NodeId, branch: typeof RTrue | typeof RFalse): void;
}
