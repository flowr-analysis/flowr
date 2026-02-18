import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import { CfgVertex } from '../control-flow/control-flow-graph';
import type { SemanticCfgGuidedVisitorConfiguration } from '../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../control-flow/semantic-cfg-guided-visitor';
import { BuiltInProcName } from '../dataflow/environments/built-in';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexVariableDefinition, isFunctionCallVertex, VertexType } from '../dataflow/graph/vertex';
import { getOriginInDfg, OriginType } from '../dataflow/origin/dfg-get-origin';
import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { RLoopConstructs } from '../r-bridge/lang-4.x/ast/model/model';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { guard, isNotUndefined } from '../util/assert';
import { AbstractDomain, type AnyAbstractDomain } from './domains/abstract-domain';
import type { StateAbstractDomain } from './domains/state-abstract-domain';
import { MutableStateAbstractDomain } from './domains/state-abstract-domain';

export type AbsintVisitorConfiguration = Omit<SemanticCfgGuidedVisitorConfiguration<NoInfo, ControlFlowInformation, NormalizedAst>, 'defaultVisitingOrder' | 'defaultVisitingType'>;

/**
 * A control flow graph visitor to perform abstract interpretation.
 *
 * However, the visitor does not yet support inter-procedural abstract interpretation and abstract condition semantics.
 */
export abstract class AbstractInterpretationVisitor<Domain extends AnyAbstractDomain, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration>
	extends SemanticCfgGuidedVisitor<NoInfo, ControlFlowInformation, NormalizedAst, DataflowGraph, Config & { defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' }> {
	/**
	 * The abstract trace of the abstract interpretation visitor mapping node IDs to the abstract state at the respective node.
	 */
	protected readonly trace: Map<NodeId, MutableStateAbstractDomain<Domain>> = new Map();

	/**
	 * The current abstract state domain at the currently processed AST node.
	 */
	private _currentState: MutableStateAbstractDomain<Domain>;

	/**
	 * A set of nodes representing variable definitions that have already been visited but whose assignment has not yet been processed.
	 */
	private readonly unassigned: Set<NodeId> = new Set();

	/**
	 * Whether the current abstract state has been copied/cloned and is save to modify in place.
	 */
	private stateCopied: boolean = false;

	constructor(config: Config) {
		super({ ...config, defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' });

		this._currentState = new MutableStateAbstractDomain<Domain>(new Map());
	}

	public get currentState(): StateAbstractDomain<Domain> {
		return this._currentState;
	}

	public removeState(node: NodeId): void {
		if(!this.stateCopied) {
			this._currentState = this._currentState.create(this.currentState.value);
			this.stateCopied = true;
		}
		this._currentState.remove(node);
	}

	public updateState(node: NodeId, value: Domain): void {
		if(!this.stateCopied) {
			this._currentState = this._currentState.create(this.currentState.value);
			this.stateCopied = true;
		}
		this._currentState.set(node, value);
	}

	/**
	 * Resolves the inferred abstract value of an AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param id    - The ID of the node to get the inferred value for
	 * @param state - An optional state abstract domain used to resolve the inferred abstract value (defaults to the state at the requested node)
	 * @returns The inferred abstract value of the node, or `undefined` if no value was inferred for the node
	 */
	public getAbstractValue(id: RNode<ParentInformation> | NodeId | undefined, state?: StateAbstractDomain<Domain>): Domain | undefined {
		const node = (id === undefined || typeof id === 'object') ? id : this.getNormalizedAst(id);
		state ??= node !== undefined ? this.getAbstractState(node.info.id) : undefined;

		if(node === undefined) {
			return;
		} else if(state?.has(node.info.id)) {
			return state.get(node.info.id);
		}
		const vertex = this.getDataflowGraph(node.info.id);
		const call = isFunctionCallVertex(vertex) ? vertex : undefined;
		const origins = Array.isArray(call?.origin) ? call.origin : [];

		if(node.type === RType.Symbol) {
			const values = this.getVariableOrigins(node.info.id).map(origin => state?.get(origin));

			if(values.length > 0 && values.every(isNotUndefined)) {
				return AbstractDomain.joinAll(values);
			}
		} else if(node.type === RType.Argument && node.value !== undefined) {
			return this.getAbstractValue(node.value, state);
		} else if(node.type === RType.ExpressionList && node.children.length > 0) {
			return this.getAbstractValue(node.children.at(-1), state);
		} else if(origins.includes(BuiltInProcName.Pipe)) {
			if(node.type === RType.Pipe || node.type === RType.BinaryOp) {
				return this.getAbstractValue(node.rhs, state);
			} else if(call?.args.length === 2 && call?.args[1] !== EmptyArgument) {
				return this.getAbstractValue(call.args[1].nodeId, state);
			}
		} else if(origins.includes(BuiltInProcName.IfThenElse)) {
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
		return id === undefined ? undefined : this.trace.get(id);
	}

	/**
	 * Gets the inferred abstract state at the end of the program (exit nodes of the control flow graph).
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @returns The inferred abstract state at the end of the program
	 */
	public getEndState(): StateAbstractDomain<Domain> {
		const exitPoints = this.config.controlFlow.exitPoints.map(id => this.getCfgVertex(id)).filter(isNotUndefined);
		const exitNodes = exitPoints.map(CfgVertex.getRootId).filter(isNotUndefined);
		const states = exitNodes.map(node => this.trace.get(node)).filter(isNotUndefined);

		return AbstractDomain.joinAll(states, this._currentState.top());
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

	protected override startVisitor(start: readonly NodeId[]): void {
		const stack = Array.from(start);

		while(stack.length > 0) {
			const current = stack.pop() as NodeId;

			if(!this.visitNode(current)) {
				continue;
			}
			for(const next of this.config.controlFlow.graph.ingoingEdges(current)?.keys().toArray().reverse() ?? []) {
				if(!stack.includes(next)) {  // prevent double entries in working list
					stack.push(next);
				}
			}
		}
	}

	protected override visitNode(vertexId: NodeId): boolean {
		const vertex = this.getCfgVertex(vertexId);

		// skip exit vertices of widening points and entry vertices of complex nodes
		if(vertex === undefined || this.shouldSkipVertex(vertex)) {
			return true;
		}
		const predecessors = this.getPredecessorNodes(CfgVertex.getId(vertex));
		const predecessorStates = predecessors.map(pred => this.trace.get(pred)).filter(isNotUndefined);

		// retrieve new abstract state by joining states of predecessor nodes
		if(predecessorStates.length === 1) {
			this._currentState = predecessorStates[0];
		} else {
			this._currentState = AbstractDomain.joinAll(predecessorStates, this._currentState.top());
			this.stateCopied = true;
		}
		const nodeId = CfgVertex.getRootId(vertex);

		// differentiate between widening points and other vertices
		if(this.isWideningPoint(nodeId)) {
			const oldState = this.trace.get(nodeId) ?? this._currentState.top();

			if(this.shouldWiden(vertex)) {
				this._currentState = oldState.widen(this._currentState);
				this.stateCopied = true;
			}
			this.trace.set(nodeId, this._currentState);
			this.stateCopied = false;

			const visitedCount = this.visited.get(nodeId) ?? 0;
			this.visited.set(nodeId, visitedCount + 1);

			// continue visiting after widening point if visited for the first time or the state changed
			return visitedCount === 0 || !oldState.equals(this._currentState);
		} else {
			this.onVisitNode(vertexId);

			// discard the inferred abstract state when encountering functions with unknown side effects (e.g. `eval`)
			if(this.config.dfg.unknownSideEffects.has(nodeId)) {
				this._currentState = this._currentState.top();
				this.stateCopied = true;
			}
			this.trace.set(nodeId, this._currentState);
			this.stateCopied = false;

			const predecessorVisits = predecessors.map(pred => this.visited.get(pred) ?? 0);
			const visitedCount = this.visited.get(nodeId) ?? 0;
			this.visited.set(nodeId, visitedCount + 1);

			// continue visiting if vertex is not a join vertex or number of visits of predecessors is the same
			return predecessors.length <= 1 || predecessorVisits.every(visits => visits === predecessorVisits[0]);
		}
	}

	protected override onDispatchFunctionCallOrigin(call: DataflowGraphVertexFunctionCall, origin: BuiltInProcName) {
		super.onDispatchFunctionCallOrigin(call, origin);

		switch(origin) {
			case BuiltInProcName.ExpressionList:
			case BuiltInProcName.IfThenElse:
			case BuiltInProcName.ForLoop:
			case BuiltInProcName.WhileLoop:
			case BuiltInProcName.RepeatLoop:
			case BuiltInProcName.FunctionDefinition:
			case BuiltInProcName.Assignment:
			case BuiltInProcName.AssignmentLike:
			case BuiltInProcName.TableAssignment:
			case BuiltInProcName.Replacement:
			case BuiltInProcName.Access:
			case BuiltInProcName.Pipe:
			case BuiltInProcName.Break:
			case BuiltInProcName.Return:
				return;
			default:
				return this.onFunctionCall({ call });
		}
	}

	protected override onVariableDefinition({ vertex }: { vertex: DataflowGraphVertexVariableDefinition; }): void {
		if(this.currentState.get(vertex.id) === undefined) {
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
			this.updateState(target, value);
			this.trace.set(target, this._currentState);
			this.stateCopied = false;

		}
	}

	protected override onReplacementCall({ target }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(target !== undefined) {
			this.unassigned.delete(target);
		}
	}

	/**
	 * This event triggers for every function call that is not a condition, loop, assignment, replacement call, or access operation.
	 *
	 *
	 * For example, this triggers for `data.frame` in `x <- data.frame(id = 1:5, name = letters[1:5])`.
	 *
	 * This bundles all function calls that are no conditions, loops, assignments, replacement calls, and access operations.
	 * @protected
	 */
	protected onFunctionCall(_data: { call: DataflowGraphVertexFunctionCall }) {}

	/** Gets all AST nodes for the predecessor vertices that are leaf nodes and exit vertices */
	protected getPredecessorNodes(vertexId: NodeId): NodeId[] {
		return this.config.controlFlow.graph.outgoingEdges(vertexId)?.keys()  // outgoing dependency edges are ingoing CFG edges
			.map(id => this.getCfgVertex(id))
			.flatMap(vertex => {
				if(vertex === undefined) {
					return [];
				} else if(this.shouldSkipVertex(vertex)) {
					return this.getPredecessorNodes(CfgVertex.getId(vertex));
				} else {
					return [CfgVertex.getRootId(vertex)];
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

	/** We only perform widening at `for`, `while`, or `repeat` loops with more than one ingoing CFG edge */
	protected isWideningPoint(nodeId: NodeId): boolean {
		const ingoingEdges = this.config.controlFlow.graph.outgoingEdges(nodeId)?.size;  // outgoing dependency edges are ingoing CFG edges

		if(ingoingEdges === undefined || ingoingEdges <= 1) {
			return false;
		}
		const node = this.getNormalizedAst(nodeId);

		if(RLoopConstructs.is(node)) {
			return true;
		}
		const dataflowVertex = this.getDataflowGraph(nodeId);

		if(dataflowVertex?.tag !== VertexType.FunctionCall || !Array.isArray(dataflowVertex.origin)) {
			return false;
		}
		const origin = dataflowVertex.origin;

		return origin.includes(BuiltInProcName.ForLoop) || origin.includes(BuiltInProcName.WhileLoop) || origin.includes(BuiltInProcName.RepeatLoop);
	}

	/**
	 * Checks whether a control flow graph vertex should be skipped during visitation.
	 * By default, we only process entry vertices of widening points, vertices of leaf nodes, and exit vertices (no entry nodes of complex nodes).
	 */
	protected shouldSkipVertex(vertex: CfgVertex): boolean {
		if(this.isWideningPoint(CfgVertex.getRootId(vertex))) {
			// skip exit vertices of widening points
			return CfgVertex.isMarker(vertex);
		}
		return !CfgVertex.isMarker(vertex) && !CfgVertex.isBlock(vertex) && CfgVertex.getEnd(vertex) !== undefined;
	}

	/**
	 * Whether widening should be performed at a widening point.
	 * By default, we perform widening when the number of visits of the widening point reaches the widening threshold of the config.
	 */
	protected shouldWiden(wideningPoint: CfgVertex): boolean {
		return (this.visited.get(CfgVertex.getId(wideningPoint)) ?? 0) >= this.config.ctx.config.abstractInterpretation.wideningThreshold;
	}
}
