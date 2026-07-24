import { type CfgExpressionVertex, type CfgStatementVertex, CfgVertex, type ControlFlowInformation } from '../control-flow/control-flow-graph';
import { SemanticCfgGuidedVisitor, type SemanticCfgGuidedVisitorConfiguration } from '../control-flow/semantic-cfg-guided-visitor';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { Dataflow } from '../dataflow/graph/df-helper';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexVariableDefinition, isFunctionCallVertex, VertexType } from '../dataflow/graph/vertex';
import { OriginType } from '../dataflow/origin/dfg-get-origin';
import { type NoInfo, RLoopConstructs, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { guard, isNotUndefined } from '../util/assert';
import { AbstractDomain } from './domains/abstract-domain';
import type { AnyStateDomain, ValueDomain } from './domains/state-domain-like';
import { UnsupportedFunctions } from './unsupported-functions';

export type DomainOfVisitor<AbsintVisitor extends AbstractInterpretationVisitor<AnyStateDomain>> =
	AbsintVisitor extends AbstractInterpretationVisitor<infer StateDomain> ? StateDomain : never;

export type AbsintVisitorConfiguration = Omit<SemanticCfgGuidedVisitorConfiguration<NoInfo, ControlFlowInformation, NormalizedAst>, 'defaultVisitingOrder' | 'defaultVisitingType'>;

/**
 * A control flow graph visitor to perform abstract interpretation.
 *
 * However, the visitor does not yet support inter-procedural abstract interpretation and abstract condition semantics.
 */
export abstract class AbstractInterpretationVisitor<StateDomain extends AnyStateDomain, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration>
	extends SemanticCfgGuidedVisitor<NoInfo, ControlFlowInformation, NormalizedAst, DataflowGraph, Config & { defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' }> {
	/**
	 * The abstract trace of the abstract interpretation visitor mapping node IDs to the abstract state at the respective node.
	 */
	protected readonly trace: Map<NodeId, StateDomain> = new Map();

	/**
	 * The current abstract state domain at the currently processed AST node.
	 */
	protected currentState: StateDomain;

	/**
	 * The current worklist stack of next vertex IDs to visit.
	 */
	private stack: NodeId[] = [];

	/**
	 * A set of nodes representing variable definitions that have already been visited but whose assignment has not yet been processed.
	 */
	private readonly unassigned: Set<NodeId> = new Set();

	/**
	 * A map mapping assignments of replacement calls to their replacement calls for replacement calls that have already been visited but whose assignment has not yet been processed.
	 */
	private readonly replacements: Map<NodeId, NodeId[]> = new Map();

	constructor(config: Config, stateDomain: StateDomain) {
		super({ ...config, defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' });

		this.currentState = stateDomain.top();
	}

	/**
	 * Resolves the inferred abstract value of an AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param id    - The ID of the node to get the inferred value for
	 * @param state - An optional state abstract domain used to resolve the inferred abstract value (defaults to the state at the requested node)
	 * @returns The inferred abstract value of the node, or `undefined` if no value was inferred for the node
	 */
	public getAbstractValue(id: RNode<ParentInformation> | NodeId | undefined, state?: StateDomain): ValueDomain<StateDomain> | undefined {
		const node = (id === undefined || typeof id === 'object') ? id : this.getNormalizedAst(id);
		state ??= node !== undefined ? this.getAbstractState(node.info.id) : undefined;

		if(state?.isBottom()) {
			return this.currentState.domain.bottom() as ValueDomain<StateDomain>;
		} else if(node === undefined) {
			return;
		} else if(state?.has(node.info.id)) {
			return state.get(node.info.id) as ValueDomain<StateDomain>;
		}
		const vertex = this.getDataflowGraph(node.info.id);
		const call = isFunctionCallVertex(vertex) ? vertex : undefined;
		const origins = Array.isArray(call?.origin) ? call.origin : [];

		if(node.type === RType.Symbol) {
			const values = this.getVariableOrigins(node.info.id)
				.map(origin => (this.getAbstractState(origin)?.isBottom() ? this.currentState.domain.bottom() : state?.get(origin)) as ValueDomain<StateDomain>);

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
			let values: (ValueDomain<StateDomain> | undefined)[] = [];

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
	public getAbstractState(id: NodeId | undefined): StateDomain | undefined {
		return id === undefined ? undefined : this.trace.get(id);
	}

	/**
	 * Gets the inferred abstract state at the end of the program (exit nodes of the control flow graph).
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @returns The inferred abstract state at the end of the program
	 */
	public getEndState(): StateDomain {
		const exitPoints = this.config.controlFlow.exitPoints.map(id => this.getCfgVertex(id)).filter(isNotUndefined);
		const exitNodes = exitPoints.map(CfgVertex.getRootId).filter(isNotUndefined);
		const states = exitNodes.map(node => this.trace.get(node)).filter(isNotUndefined);

		return AbstractDomain.joinAll(states, this.currentState.bottom());
	}

	/**
	 * Gets the inferred abstract trace mapping AST nodes to the inferred abstract state at the respective node.
	 * @returns The inferred abstract trace of the program
	 */
	public getAbstractTrace(): ReadonlyMap<NodeId, StateDomain> {
		return this.trace;
	}

	public override start(): void {
		guard(this.trace.size === 0, 'Abstract interpretation visitor has already been started');
		super.start();
		this.unassigned.clear();
	}

	protected override startVisitor(start: readonly NodeId[]): void {
		this.stack = Array.from(start);

		while(this.stack.length > 0) {
			const current = this.stack.pop() as NodeId;

			if(!this.visitNode(current)) {
				continue;
			}
			const successors = this.config.controlFlow.graph.ingoingEdges(current)?.keys().toArray().reverse() ?? [];

			for(const next of successors) {
				if(!this.stack.includes(next)) {  // prevent double entries in working list
					this.stack.push(next);
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
		// retrieve new abstract state by joining states of predecessor nodes
		const predecessors = this.getPredecessorNodes(CfgVertex.getId(vertex));
		const predecessorStates = predecessors.map(pred => this.trace.get(pred)).filter(isNotUndefined);
		this.currentState = AbstractDomain.joinAll(predecessorStates, this.currentState.top());

		const nodeId = CfgVertex.getRootId(vertex);

		// differentiate between widening points and other vertices
		if(this.isWideningPoint(nodeId)) {
			const oldState = this.trace.get(nodeId);

			if(oldState !== undefined && this.shouldWiden(vertex)) {
				this.currentState = oldState.widen(this.currentState);
			}
			this.trace.set(nodeId, this.currentState);

			const visitedCount = this.visited.get(nodeId) ?? 0;
			this.visited.set(nodeId, visitedCount + 1);

			// continue visiting after widening point if visited for the first time or the state changed
			return visitedCount === 0 || !oldState?.equals(this.currentState);
		} else {
			this.onVisitNode(vertexId);

			// discard the inferred abstract state when encountering unsupported function calls
			if(this.isUnsupportedFunctionCall(nodeId)) {
				this.currentState = this.currentState.top();
			}
			this.trace.set(nodeId, this.currentState);

			const predecessorVisits = predecessors.map(pred => this.visited.get(pred) ?? 0);
			const visitedCount = this.visited.get(nodeId) ?? 0;
			this.visited.set(nodeId, visitedCount + 1);

			// continue visiting if vertex is not a join vertex or number of visits of predecessors is the same
			return predecessors.length <= 1 || this.stack.length === 0 || predecessorVisits.every(visits => visits === predecessorVisits[0]);
		}
	}

	protected visitUnknown(vertex: CfgStatementVertex | CfgExpressionVertex): void {
		const nodeId = CfgVertex.getRootId(vertex);
		const replacements = this.replacements.get(nodeId);

		if(replacements !== undefined) {
			this.replacements.delete(nodeId);

			for(const replacement of replacements) {
				const call = this.getDataflowGraph(replacement);

				if(isFunctionCallVertex(call)) {
					this.onReplacementCall({ call, ...this.getSourceAndTarget(call) });
				}
			}
		}
	}

	protected override onDispatchFunctionCallOrigin(call: DataflowGraphVertexFunctionCall, origin: BuiltInProcName) {
		if(origin === BuiltInProcName.Replacement) {
			const node = this.getNormalizedAst(call.id);
			const assignment = RNode.iterateParents(node, this.config.normalizedAst.idMap)
				.find(parent => this.getDataflowGraph(parent.info.id) === undefined);

			if(node !== undefined && assignment !== undefined) {
				const replacements = this.replacements.get(assignment.info.id) ?? [];
				replacements.push(node.info.id);
				this.replacements.set(assignment.info.id, replacements);
				return;
			}
		}
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
		if(!this.trace.has(vertex.id)) {
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
		} else {
			this.currentState.remove(target);
		}
		this.trace.set(target, this.currentState);
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
		return Dataflow.origin(this.config.dfg, nodeId)
			?.filter(origin => origin.type === OriginType.ReadVariableOrigin)
			.map(origin => origin.id)
			.filter(origin => this.trace.has(origin) && !this.unassigned.has(origin)) ?? [];
	}

	/** Checks whether a node represents a unsupported (environment-changing) function call (e.g. `eval`, `load`, `attach`, `rm`, ...) */
	protected isUnsupportedFunctionCall(nodeId: NodeId): boolean {
		return UnsupportedFunctions.isUnsupportedCall(this.getDataflowGraph(nodeId), this.config.dfg);
	}

	/** We only perform widening at `for`, `while`, or `repeat` loops with more than one ingoing CFG edge */
	protected isWideningPoint(nodeId: NodeId): boolean {
		const ingoingEdges = this.config.controlFlow.graph.outgoingEdges(nodeId)?.size;  // outgoing dependency edges are ingoing CFG edges

		if(ingoingEdges === undefined || ingoingEdges <= 1) {
			return false;
		} else if(RLoopConstructs.is(this.getNormalizedAst(nodeId))) {
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
