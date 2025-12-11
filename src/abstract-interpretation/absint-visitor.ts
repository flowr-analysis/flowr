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
 */
export abstract class AbstractInterpretationVisitor<Domain extends AnyAbstractDomain, OtherInfo = NoInfo, Config extends AbsintVisitorConfiguration<Domain, OtherInfo> = AbsintVisitorConfiguration<Domain, OtherInfo>>
	extends SemanticCfgGuidedVisitor<OtherInfo, ControlFlowInformation, NormalizedAst<OtherInfo>, DataflowGraph, Config & { defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' }> {
	/**
	 * The state of the abstract interpretation visitor mapping node IDs to the abstract state at the respective node.
	 */
	protected readonly state: Map<NodeId, StateAbstractDomain<Domain>> = new Map();

	/**
	 * A set of nodes representing variable definitions that have already been visited but whose assignment has not yet been processed.
	 */
	private readonly unassigned: Set<NodeId> = new Set();

	/**
	 * The current state domain at the currently processed AST node.
	 */
	private currentDomain: StateAbstractDomain<Domain>;

	constructor(config: Config) {
		super({ ...config, defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' });

		this.currentDomain = config.domain.bottom();
	}

	/**
	 * Resolves the inferred abstract value of an AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param id     - The ID of the node to get the inferred value for
	 * @param domain - An optional state abstract domain used to resolve the inferred abstract value (defaults to the state at the requested node)
	 * @returns The inferred abstract value of the node, or `undefined` if no value was inferred for the node
	 */
	public getValue(id: RNode<ParentInformation & OtherInfo> | NodeId | undefined, domain?: StateAbstractDomain<Domain>): Domain | undefined {
		const node = (id === undefined || typeof id === 'object') ? id : this.getNormalizedAst(id);
		domain ??= node !== undefined ? this.getState(node.info.id) : undefined;

		if(node === undefined) {
			return;
		} else if(domain?.has(node.info.id)) {
			return domain.get(node.info.id);
		}
		const vertex = this.getDataflowGraph(node.info.id);
		const call = vertex?.tag === VertexType.FunctionCall ? vertex : undefined;
		const origins = Array.isArray(call?.origin) ? call.origin : [];

		if(node.type === RType.Symbol) {
			const values = this.getVariableOrigins(node.info.id).map(origin => domain?.get(origin));

			if(values.length > 0 && values.every(isNotUndefined)) {
				return AbstractDomain.joinAll(values);
			}
		} else if(node.type === RType.Argument && node.value !== undefined) {
			return this.getValue(node.value, domain);
		} else if(node.type === RType.ExpressionList && node.children.length > 0) {
			return this.getValue(node.children[node.children.length - 1], domain);
		} else if(node.type === RType.Pipe) {
			return this.getValue(node.rhs, domain);
		} else if(origins.includes('builtin:pipe')) {
			if(node.type === RType.BinaryOp) {
				return this.getValue(node.rhs, domain);
			} else if(call?.args.length === 2 && call?.args[1] !== EmptyArgument) {
				return this.getValue(call.args[1].nodeId, domain);
			}
		} else if(node.type === RType.IfThenElse) {
			if(node.otherwise !== undefined) {
				const values = [node.then, node.otherwise].map(entry => this.getValue(entry, domain));

				if(values.length > 0 && values.every(isNotUndefined)) {
					return AbstractDomain.joinAll(values);
				}
			}
		} else if(origins.includes('builtin:if-then-else') && call?.args.every(arg => arg !== EmptyArgument)) {
			if(call.args.length === 3) {
				const values = call.args.slice(1, 3).map(entry => this.getValue(entry.nodeId, domain));

				if(values.length > 0 && values.every(isNotUndefined)) {
					return AbstractDomain.joinAll(values);
				}
			}
		}
	}

	/**
	 * Gets the inferred abstract state at the location of a specific AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param id - The ID of the node to get the abstract state at
	 * @returns The abstract state at the node, or `undefined` if the node has no abstract state (i.e. the node has not been visited or is unreachable).
	 */
	public getState(id: NodeId | undefined): StateAbstractDomain<Domain> | undefined {
		return id !== undefined ? this.state.get(id) : undefined;
	}

	/**
	 * Gets the inferred abstract state at the end of the program (exit nodes of the control flow graph).
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @returns The inferred abstract state at the end of the program
	 */
	public getResult(): StateAbstractDomain<Domain> {
		const exitPoints = this.config.controlFlow.exitPoints.map(id => this.getCfgVertex(id)).filter(isNotUndefined);
		const exitNodes = exitPoints.map(vertex => getVertexRootId(vertex)).filter(isNotUndefined);
		const domains = exitNodes.map(node => this.getState(node)).filter(isNotUndefined);

		return this.config.domain.bottom().joinAll(domains);
	}

	public override start(): void {
		guard(this.state.size === 0, 'Abstract interpretation visitor has already been started');
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
			const oldDomain = this.getState(nodeId) ?? this.config.domain.bottom();
			const predecessorDomains = this.getPredecessorNodes(vertex.id).map(pred => this.getState(pred)).filter(isNotUndefined);
			this.currentDomain = this.config.domain.bottom().joinAll(predecessorDomains);

			if(this.shouldWiden(vertex)) {
				this.currentDomain = oldDomain.widen(this.currentDomain);
			}
			this.state.set(nodeId, this.currentDomain);

			const visitedCount = this.visited.get(vertex.id) ?? 0;
			this.visited.set(vertex.id, visitedCount + 1);

			// only continue visiting if the widening point is visited for the first time or the abstract state at the widening point changed
			return visitedCount === 0 || !oldDomain.equals(this.currentDomain);
		} else if(this.shouldSkipVertex(vertex)) {
			return true;
		}
		const predecessorDomains = this.getPredecessorNodes(vertex.id).map(pred => this.getState(pred)).filter(isNotUndefined);
		this.currentDomain = this.config.domain.bottom().joinAll(predecessorDomains);

		this.onVisitNode(vertexId);

		// discard the inferred abstract state when encountering functions with unknown side effects (e.g. `eval`)
		if(this.config.dfg.unknownSideEffects.has(nodeId)) {
			this.currentDomain = this.currentDomain.bottom();
		}
		this.state.set(nodeId, this.currentDomain);

		return true;
	}

	protected override onVariableDefinition({ vertex }: { vertex: DataflowGraphVertexVariableDefinition; }): void {
		if(this.getState(vertex.id) === undefined) {
			this.unassigned.add(vertex.id);
		}
	}

	protected override onAssignmentCall({ target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(target === undefined || source === undefined) {
			return;
		}
		const value = this.getValue(source);
		this.unassigned.delete(target);

		if(value !== undefined) {
			this.currentDomain.set(target, value);
			this.state.set(target, this.currentDomain.create(this.currentDomain.value));
		}
	}

	protected override onReplacementCall({ call, target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(source === undefined || target === undefined) {
			return;
		}
		this.currentDomain = this.evalReplacementCall(call, target, source, this.currentDomain);
		this.unassigned.delete(target);
	}

	protected override onAccessCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalAccessCall(call, this.currentDomain);
	}

	protected override onUnnamedCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onEvalFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onApplyFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onSourceCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onGetCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onRmCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onListCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onVectorCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onSpecialBinaryOpCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onQuoteCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onLibraryCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	protected override onDefaultFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.currentDomain = this.evalFunctionCall(call, this.currentDomain);
	}

	/**
	 * Evaluates any function call visited by the abstract interpretation visitor by applying the abstract semantics of the function call to the current abstract state.
	 * @param call   - The data flow vertex of the function call to evaluate
	 * @param domain - The current abstract state before the evaluation of the function call
	 * @returns The abstract state after applying the abstract semantics of the function call
	 */
	protected abstract evalFunctionCall(call: DataflowGraphVertexFunctionCall, domain: StateAbstractDomain<Domain>): StateAbstractDomain<Domain>;

	/**
	 * Evaluates any replacement function call visited by the abstract interpretation visitor by applying the abstract semantics of the replacement call to the current abstract state (e.g. for `$<-`, `[<-`, `names<-`, ...).
	 * @param call   - The data flow vertex of the replacement call to evaluate
	 * @param source - The node ID of the assignment target of the replacement call
	 * @param target - The node ID of the assigned expression of the replacement call
	 * @param domain - The current abstract state before the evaluation of the replacement call
	 * @returns The abstract state after applying the abstract semantics of the replacement call
	 */
	protected abstract evalReplacementCall(call: DataflowGraphVertexFunctionCall, target: NodeId, source: NodeId, domain: StateAbstractDomain<Domain>): StateAbstractDomain<Domain>;

	/**
	 * Evaluates any access operation call visited by the abstract interpretation visitor by applying the abstract semantics of the access operation to the current abstract stat (e.g. for `$`, `[`, `[[`, ...).
	 * @param call   - The data flow vertex of the access operation to evaluate
	 * @param domain - The current abstract state before the evaluation of the access operation
	 * @returns The abstract state after applying the abstract semantics of the access operation
	 */
	protected abstract evalAccessCall(call: DataflowGraphVertexFunctionCall, domain: StateAbstractDomain<Domain>): StateAbstractDomain<Domain>;

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
			.filter(origin => this.state.has(origin) && !this.unassigned.has(origin)) ?? [];
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

	/** We only process vertices of leaf nodes and exit vertices (no entry nodes of complex nodes) */
	protected shouldSkipVertex(vertex: CfgSimpleVertex): boolean {
		return vertex.type !== CfgVertexType.EndMarker && vertex.end !== undefined;
	}

	protected shouldWiden(vertex: CfgSimpleVertex): boolean {
		return (this.visited.get(vertex.id) ?? 0) >= this.config.ctx.config.abstractInterpretation.wideningThreshold;
	}
}
