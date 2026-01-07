import type { CfgSimpleVertex, ControlFlowInformation } from '../control-flow/control-flow-graph';
import { CfgVertexType, getVertexRootId } from '../control-flow/control-flow-graph';
import type { SemanticCfgGuidedVisitorConfiguration } from '../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexVariableDefinition, VertexType } from '../dataflow/graph/vertex';
import { getOriginInDfg, OriginType } from '../dataflow/origin/dfg-get-origin';
import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { guard, isNotUndefined } from '../util/assert';
import { AbstractDomain, type AnyAbstractDomain } from './domains/abstract-domain';
import type { StateAbstractDomain } from './domains/state-abstract-domain';

export interface AbsintVisitorConfiguration<Domain extends AnyAbstractDomain, OtherInfo = NoInfo>
extends Omit<SemanticCfgGuidedVisitorConfiguration<OtherInfo, ControlFlowInformation, NormalizedAst<OtherInfo>>, 'defaultVisitingOrder' | 'defaultVisitingType'> {
	readonly domain: StateAbstractDomain<Domain>;
}

/**
 * A control flow graph visitor to perform abstract interpretation.
 *
 * However, the visitor does not yet support inter-procedural abstract interpretation and abstract condition semantics.
 */
export abstract class AbstractInterpretationVisitor<Domain extends AnyAbstractDomain, OtherInfo = NoInfo, Config extends AbsintVisitorConfiguration<Domain, OtherInfo> = AbsintVisitorConfiguration<Domain, OtherInfo>>
	extends SemanticCfgGuidedVisitor<OtherInfo, ControlFlowInformation, NormalizedAst<OtherInfo>, DataflowGraph, Config & { defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' }> {
	/**
	 * The abstract trace of the abstract interpretation visitor mapping node IDs to the abstract state at the respective node.
	 */
	protected readonly trace: Map<NodeId, StateAbstractDomain<Domain>> = new Map();

	/**
	 * A set of nodes representing variable definitions that have already been visited but whose assignment has not yet been processed.
	 */
	private readonly unassigned: Set<NodeId> = new Set();

	/**
	 * The current abstract state domain at the currently processed AST node.
	 */
	private currentState: StateAbstractDomain<Domain>;

	constructor(config: Config) {
		super({ ...config, defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' });

		this.currentState = config.domain.bottom();
	}

	/**
	 * Resolves the inferred abstract value of an AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param id    - The ID of the node to get the inferred value for
	 * @param state - An optional state abstract domain used to resolve the inferred abstract value (defaults to the state at the requested node)
	 * @returns The inferred abstract value of the node, or `undefined` if no value was inferred for the node
	 */
	public getAbstractValue(id: RNode<ParentInformation & OtherInfo> | NodeId | undefined, state?: StateAbstractDomain<Domain>): Domain | undefined {
		const node = (id === undefined || typeof id === 'object') ? id : this.getNormalizedAst(id);
		state ??= node !== undefined ? this.getAbstractState(node.info.id) : undefined;

		if(node === undefined) {
			return;
		} else if(state?.has(node.info.id)) {
			return state.get(node.info.id);
		}
		const vertex = this.getDataflowGraph(node.info.id);
		const call = vertex?.tag === VertexType.FunctionCall ? vertex : undefined;
		const origins = Array.isArray(call?.origin) ? call.origin : [];

		if(node.type === RType.Symbol) {
			const values = this.getVariableOrigins(node.info.id).map(origin => state?.get(origin));

			if(values.length > 0 && values.every(isNotUndefined)) {
				return AbstractDomain.joinAll(values);
			}
		} else if(node.type === RType.Argument && node.value !== undefined) {
			return this.getAbstractValue(node.value, state);
		} else if(node.type === RType.ExpressionList && node.children.length > 0) {
			return this.getAbstractValue(node.children[node.children.length - 1], state);
		} else if(origins.includes('builtin:pipe')) {
			if(node.type === RType.Pipe || node.type === RType.BinaryOp) {
				return this.getAbstractValue(node.rhs, state);
			} else if(call?.args.length === 2 && call?.args[1] !== EmptyArgument) {
				return this.getAbstractValue(call.args[1].nodeId, state);
			}
		} else if(origins.includes('builtin:if-then-else')) {
			let values: (Domain | undefined)[] = [];

			if(node.type === RType.IfThenElse && node.otherwise !== undefined) {
				values = [node.then, node.otherwise].map(entry => this.getAbstractValue(entry, state));
			} else if(call?.args.every(arg => arg !== EmptyArgument) && call.args.length === 3) {
				values = call.args.slice(1, 3).map(entry => this.getAbstractValue(entry.nodeId, state));
			}
			if(values.length > 0 && values.every(isNotUndefined)) {
				return AbstractDomain.joinAll(values);
			}
		}
	}

	/**
	 * Gets the inferred abstract state at the location of a specific AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param id - The ID of the node to get the abstract state at
	 * @returns The abstract state at the node, or `undefined` if the node has no abstract state (i.e. the node has not been visited or is unreachable).
	 */
	public getAbstractState(id: NodeId | undefined): StateAbstractDomain<Domain> | undefined {
		return id !== undefined ? this.trace.get(id) : undefined;
	}

	/**
	 * Gets the inferred abstract state at the end of the program (exit nodes of the control flow graph).
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @returns The inferred abstract state at the end of the program
	 */
	public getEndState(): StateAbstractDomain<Domain> {
		const exitPoints = this.config.controlFlow.exitPoints.map(id => this.getCfgVertex(id)).filter(isNotUndefined);
		const exitNodes = exitPoints.map(vertex => getVertexRootId(vertex)).filter(isNotUndefined);
		const states = exitNodes.map(node => this.getAbstractState(node)).filter(isNotUndefined);

		return this.config.domain.bottom().joinAll(states);
	}

	/**
	 * Gets the inferred abstract trace mapping AST nodes to the inferred abstract state at the respective node.
	 * @returns The inferred abstract trace of the program
	 */
	public getAbstractTrace(): ReadonlyMap<NodeId, StateAbstractDomain<Domain>> {
		return this.trace;
	}

	public override start(): void {
		guard(this.trace.size === 0, 'Abstract interpretation visitor has already been started');
		super.start();
		this.unassigned.clear();
	}

	protected override visitNode(vertexId: NodeId): boolean {
		const vertex = this.getCfgVertex(vertexId);

		if(vertex === undefined) {
			return true;
		}
		const nodeId = getVertexRootId(vertex);

		if(this.isWideningPoint(nodeId)) {
			// only check widening points at the entry vertex
			if(vertex.type === CfgVertexType.EndMarker) {
				return true;
			}
			const oldState = this.getAbstractState(nodeId) ?? this.config.domain.bottom();
			const predecessorDomains = this.getPredecessorNodes(vertex.id).map(pred => this.getAbstractState(pred)).filter(isNotUndefined);
			this.currentState = this.config.domain.bottom().joinAll(predecessorDomains);

			if(this.shouldWiden(vertex)) {
				this.currentState = oldState.widen(this.currentState);
			}
			this.trace.set(nodeId, this.currentState);

			return this.shouldContinueVisiting(vertex, oldState);
		} else if(this.shouldSkipVertex(vertex)) {
			return true;
		}
		const predecessorDomains = this.getPredecessorNodes(vertex.id).map(pred => this.getAbstractState(pred)).filter(isNotUndefined);
		this.currentState = this.config.domain.bottom().joinAll(predecessorDomains);

		this.onVisitNode(vertexId);

		// discard the inferred abstract state when encountering functions with unknown side effects (e.g. `eval`)
		if(this.config.dfg.unknownSideEffects.has(nodeId)) {
			this.currentState = this.currentState.bottom();
		}
		this.trace.set(nodeId, this.currentState);

		return true;
	}

	protected override onVariableDefinition({ vertex }: { vertex: DataflowGraphVertexVariableDefinition; }): void {
		if(this.getAbstractState(vertex.id) === undefined) {
			this.unassigned.add(vertex.id);
		}
	}

	protected override onAssignmentCall({ target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(target === undefined || source === undefined) {
			return;
		}
		const value = this.getAbstractValue(source);
		this.unassigned.delete(target);

		if(value !== undefined) {
			this.currentState.set(target, value);
			this.trace.set(target, this.currentState.create(this.currentState.value));
		}
	}

	protected override onReplacementCall({ call, target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(source === undefined || target === undefined) {
			return;
		}
		this.currentState = this.evalReplacementCall(call, target, source, this.currentState);
		this.unassigned.delete(target);
	}

	protected override onAccessCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalAccessCall(call, this.currentState);
	}

	protected override onUnnamedCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onEvalFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onApplyFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onSourceCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onGetCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onRmCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onListCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onVectorCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onSpecialBinaryOpCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onQuoteCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onLibraryCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	protected override onDefaultFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentState = this.evalFunctionCall(call, this.currentState);
	}

	/**
	 * Evaluates any function call visited by the abstract interpretation visitor by applying the abstract semantics of the function call to the current abstract state.
	 * @param call  - The data flow vertex of the function call to evaluate
	 * @param state - The current abstract state before the evaluation of the function call
	 * @returns The abstract state after applying the abstract semantics of the function call
	 */
	protected abstract evalFunctionCall(call: DataflowGraphVertexFunctionCall, state: StateAbstractDomain<Domain>): StateAbstractDomain<Domain>;

	/**
	 * Evaluates any replacement function call visited by the abstract interpretation visitor by applying the abstract semantics of the replacement call to the current abstract state (e.g. for `$<-`, `[<-`, `names<-`, ...).
	 * @param call   - The data flow vertex of the replacement call to evaluate
	 * @param source - The node ID of the assignment target of the replacement call
	 * @param target - The node ID of the assigned expression of the replacement call
	 * @param state  - The current abstract state before the evaluation of the replacement call
	 * @returns The abstract state after applying the abstract semantics of the replacement call
	 */
	protected abstract evalReplacementCall(call: DataflowGraphVertexFunctionCall, target: NodeId, source: NodeId, state: StateAbstractDomain<Domain>): StateAbstractDomain<Domain>;

	/**
	 * Evaluates any access operation call visited by the abstract interpretation visitor by applying the abstract semantics of the access operation to the current abstract stat (e.g. for `$`, `[`, `[[`, ...).
	 * @param call  - The data flow vertex of the access operation to evaluate
	 * @param state - The current abstract state before the evaluation of the access operation
	 * @returns The abstract state after applying the abstract semantics of the access operation
	 */
	protected abstract evalAccessCall(call: DataflowGraphVertexFunctionCall, state: StateAbstractDomain<Domain>): StateAbstractDomain<Domain>;

	/** Gets all AST nodes for the predecessor vertices that are leaf nodes and exit vertices */
	protected getPredecessorNodes(vertexId: NodeId): NodeId[] {
		return this.config.controlFlow.graph.outgoingEdges(vertexId)?.keys()  // outgoing dependency edges are incoming CFG edges
			.map(id => this.getCfgVertex(id))
			.flatMap(vertex => {
				if(vertex === undefined) {
					return [];
				} else if(this.shouldSkipVertex(vertex)) {
					return this.getPredecessorNodes(vertex.id);
				} else {
					return [getVertexRootId(vertex)];
				}
			})
			.toArray() ?? [];
	}

	/** Gets each variable origin that has already been visited and whose assignment has already been processed */
	protected getVariableOrigins(nodeId: NodeId): NodeId[] {
		return getOriginInDfg(this.config.dfg, nodeId)
			?.filter(origin => origin.type === OriginType.ReadVariableOrigin)
			.map(origin => origin.id)
			.filter(origin => this.trace.has(origin) && !this.unassigned.has(origin)) ?? [];
	}

	/** We only perform widening at `for`, `while`, or `repeat` loops with more than one incoming CFG edge */
	protected isWideningPoint(nodeId: NodeId): boolean {
		const incomingEdges = this.config.controlFlow.graph.outgoingEdges(nodeId)?.size;  // outgoing dependency edges are incoming CFG edges

		if(incomingEdges === undefined || incomingEdges <= 1) {
			return false;
		}
		const node = this.getNormalizedAst(nodeId);

		if(node?.type === RType.ForLoop || node?.type === RType.WhileLoop || node?.type === RType.RepeatLoop) {
			return true;
		}
		const dataflowVertex = this.getDataflowGraph(nodeId);

		if(dataflowVertex?.tag !== VertexType.FunctionCall || !Array.isArray(dataflowVertex.origin)) {
			return false;
		}
		const origin = dataflowVertex.origin;

		return origin.includes('builtin:for-loop') || origin.includes('builtin:while-loop') || origin.includes('builtin:repeat-loop');
	}

	/**
	 * Checks whether to continue visiting the control flow graph after a widening point.
	 * By default, we only continue visiting if the widening point is visited for the first time or the abstract state at the widening point changed.
	 */
	protected shouldContinueVisiting(wideningPoint: CfgSimpleVertex, oldState: StateAbstractDomain<Domain>) {
		const visitedCount = this.visited.get(wideningPoint.id) ?? 0;
		this.visited.set(wideningPoint.id, visitedCount + 1);

		return visitedCount === 0 || !oldState.equals(this.currentState);
	}

	/**
	 * Checks whether a control flow graph vertex should be skipped during visitation.
	 * By default, we only process vertices of leaf nodes and exit vertices (no entry nodes of complex nodes).
	 */
	protected shouldSkipVertex(vertex: CfgSimpleVertex): boolean {
		return vertex.type !== CfgVertexType.EndMarker && vertex.end !== undefined;
	}

	/**
	 * Whether widening should be performed at a widening point.
	 * By default, we perform widening when the number of visitation of the widening point reaches the widening threshold of the config.
	 */
	protected shouldWiden(wideningPoint: CfgSimpleVertex): boolean {
		return (this.visited.get(wideningPoint.id) ?? 0) >= this.config.ctx.config.abstractInterpretation.wideningThreshold;
	}
}
