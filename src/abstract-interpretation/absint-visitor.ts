import type { ControlFlowInformation, CfgSimpleVertex, CfgBasicBlockVertex } from '../control-flow/control-flow-graph';
import { getVertexRootId, isMarkerVertex, CfgVertexType } from '../control-flow/control-flow-graph';
import type { SemanticCfgGuidedVisitorConfiguration } from '../control-flow/semantic-cfg-guided-visitor';
import { SemanticCfgGuidedVisitor } from '../control-flow/semantic-cfg-guided-visitor';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { type DataflowGraphVertexVariableDefinition, type DataflowGraphVertexFunctionCall, VertexType } from '../dataflow/graph/vertex';
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
	 * The old domain of an AST node before processing the node retrieved from the current {@link state}.
	 * This is used to check whether the state has changed and successors should be visited again, and is also required for widening.
	 */
	private oldDomain: StateAbstractDomain<Domain>;
	/**
	 * The new domain of an AST node during and after processing the node.
	 * This information is stored in the current {@link state} afterward.
	 */
	private newDomain: StateAbstractDomain<Domain>;

	constructor(config: Config) {
		super({ ...config, defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' });

		this.oldDomain = config.domain.bottom();
		this.newDomain = config.domain.bottom();
	}

	/**
	 * Resolves the inferred abstract value of an AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 *
	 * @param id     - The ID of the node to get the inferred value for
	 * @param domain - An optional state abstract domain used to resolve the inferred abstract value (defaults to the state at the requested node)
	 * @returns The inferred abstract value of the node, or `undefined` if no value was inferred for the node
	 */
	public getValue(id: RNode<ParentInformation & OtherInfo> | NodeId | undefined, domain?: StateAbstractDomain<Domain>): Domain | undefined {
		const node = (id === undefined || typeof id === 'object') ? id : this.getNormalizedAst(id);
		domain ??= node !== undefined ? this.state.get(node.info.id) : undefined;

		if(node === undefined || domain === undefined) {
			return;
		} else if(domain.has(node.info.id)) {
			return domain.get(node.info.id);
		}
		const vertex = this.getDataflowGraph(node.info.id);
		const call = vertex?.tag === VertexType.FunctionCall ? vertex : undefined;
		const origins = Array.isArray(call?.origin) ? call.origin : [];

		if(node.type === RType.Symbol) {
			const values = this.getVariableOrigins(node.info.id).map(origin => domain.get(origin));

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

	public override start(): void {
		guard(this.state.size === 0, 'Abstract interpretation visitor has already been started');
		super.start();
	}

	protected override visitNode(nodeId: NodeId): boolean {
		const vertex = this.getCfgVertex(nodeId);

		// skip vertices representing entries of complex nodes
		if(vertex === undefined || this.shouldSkipVertex(vertex)) {
			return true;
		}
		const predecessors = this.getPredecessorNodes(vertex.id);
		const predecessorDomains = predecessors.map(pred => this.state.get(pred)).filter(isNotUndefined);
		this.newDomain = this.config.domain.bottom().joinAll(predecessorDomains);

		this.onVisitNode(nodeId);

		const visitedCount = this.visited.get(vertex.id) ?? 0;
		this.visited.set(vertex.id, visitedCount + 1);

		// only continue visiting if the node has not been visited before or the abstract state of the node changed
		return visitedCount === 0 || !this.oldDomain.equals(this.newDomain);
	}

	protected override visitDataflowNode(vertex: Exclude<CfgSimpleVertex, CfgBasicBlockVertex>): void {
		const nodeId = getVertexRootId(vertex);
		this.oldDomain = this.state.get(nodeId) ?? this.config.domain.bottom();

		super.visitDataflowNode(vertex);

		if(this.config.dfg.unknownSideEffects.has(nodeId)) {
			this.newDomain = this.newDomain.bottom();
		}
		if(this.shouldWiden(vertex)) {
			this.newDomain = this.oldDomain.widen(this.newDomain);
		}
		this.state.set(nodeId, this.newDomain);
	}

	protected override onVariableDefinition({ vertex }: { vertex: DataflowGraphVertexVariableDefinition; }): void {
		this.unassigned.add(vertex.id);
	}

	protected override onAssignmentCall({ target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(target === undefined || source === undefined) {
			return;
		}
		const value = this.getValue(target);
		this.unassigned.delete(target);

		if(value !== undefined) {
			this.newDomain.set(source, value);
			this.state.set(source, this.newDomain.create(this.newDomain.value));
		}
	}

	protected override onReplacementCall({ call, target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(source === undefined || target === undefined) {
			return;
		}
		this.evalReplacementCall(call, target, source, this.newDomain);
		this.unassigned.delete(target);
	}

	protected override onAccessCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalAccessCall(call, this.newDomain);
	}

	protected override onUnnamedCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onEvalFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onApplyFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onSourceCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onGetCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onRmCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onListCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onVectorCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onSpecialBinaryOpCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onQuoteCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onLibraryCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
	}

	protected override onDefaultFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall }): void {
		this.evalFunctionCall(call, this.newDomain);
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
			.filter(isNotUndefined)
			.toArray() ?? [];
	}

	/** Gets each variable origin that has already been visited and whose assignment has already been processed */
	protected getVariableOrigins(nodeId: NodeId): NodeId[] {
		return getOriginInDfg(this.config.dfg, nodeId)
			?.filter(origin => origin.type === OriginType.ReadVariableOrigin)
			.map(origin => origin.id)
			.filter(origin => this.state.has(origin) && !this.unassigned.has(origin)) ?? [];
	}

	/** We only process vertices of leaf nodes and exit vertices (no entry nodes of complex nodes) */
	protected shouldSkipVertex(vertex: CfgSimpleVertex): boolean {
		return isMarkerVertex(vertex) ? vertex.type !== CfgVertexType.EndMarker : vertex.end !== undefined;
	}

	protected shouldWiden(vertex: Exclude<CfgSimpleVertex, CfgBasicBlockVertex>): boolean {
		return (this.visited.get(vertex.id) ?? 0) >= this.config.ctx.config.abstractInterpretation.wideningThreshold;
	}
}
