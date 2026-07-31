import { CfgEdge, type CfgExpressionVertex, type CfgStatementVertex, CfgVertex, type ControlFlowInformation } from '../control-flow/control-flow-graph';
import { SemanticCfgGuidedVisitor, type SemanticCfgGuidedVisitorConfiguration } from '../control-flow/semantic-cfg-guided-visitor';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { Dataflow } from '../dataflow/graph/df-helper';
import { type DataflowGraph, FunctionArgument } from '../dataflow/graph/graph';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition, type DataflowGraphVertexUse, type DataflowGraphVertexValue, type DataflowGraphVertexVariableDefinition, FunctionCallVertex, VertexType } from '../dataflow/graph/vertex';
import { OriginType } from '../dataflow/origin/dfg-get-origin';
import { type NoInfo, RLoopConstructs, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NormalizedAst, ParentInformation, RNodeWithParent } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RoleInParent } from '../r-bridge/lang-4.x/ast/model/processing/role';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { RNull } from '../r-bridge/lang-4.x/convert-values';
import { guard, isNotUndefined } from '../util/assert';
import { Record } from '../util/record';
import type { AbstractSemantics, SemanticsContext } from './abstract-semantics';
import { AbstractDomain } from './domains/abstract-domain';
import { MultiValueStateDomain } from './domains/multi-value-state-domain';
import type { AbstractProduct, ProductReduction } from './domains/partial-product-domain';
import type { StateDomain } from './domains/state-domain-like';
import { UnsupportedFunctions } from './unsupported-functions';

/**
 * Represents the abstract semantics for each abstract domain in an analysis.
 * @template Domains - Type of the abstract product mapping the names of the abstract domains of the analysis to the respective domains
 */
export type DomainSemantics<Domains extends AbstractProduct> = {
	readonly [Key in keyof Domains]: AbstractSemantics<StateDomain<Domains[Key]>>;
};

/**
 * Represents an abstract interpretation analysis with the given domains, abstract semantics, and reduction functions.
 * @template Domains - Type of the abstract product mapping the names of the abstract domains of the analysis to the respective domains
 */
export interface AbsintAnalysis<Domains extends AbstractProduct> {
	/** The value abstract domains inferred by the analysis, mapping each domain name to an instance of the respective abstract domain */
	readonly domains:     Required<Domains>;
	/** The abstract semantics to apply for each of the abstract domains of the analysis */
	readonly semantics:   DomainSemantics<Domains>;
	/** Optional reduction functions of the reduced product domain, refining the inferred abstract values based on the values of the other abstract domains */
	readonly reductions?: readonly ProductReduction<Partial<Domains>>[];
}

/**
 * The configuration of an {@link AbstractInterpretationVisitor},
 * i.e. the configuration of a semantic control flow graph visitor without the visiting order and type (which are fixed by the abstract interpretation visitor).
 */
export type AbsintVisitorConfiguration =  Omit<SemanticCfgGuidedVisitorConfiguration<NoInfo, ControlFlowInformation, NormalizedAst>, 'defaultVisitingOrder' | 'defaultVisitingType'>;

/**
 * A control flow graph visitor to perform abstract interpretation.
 *
 * The visitor infers the abstract values of multiple abstract domains in a single traversal:
 * the abstract state maps each AST node to the abstract values of all domains of the {@link AbsintAnalysis},
 * and whenever a node is visited, the {@link AbstractSemantics} of every domain of the analysis are applied to that state.
 *
 * However, the visitor does not yet support inter-procedural abstract interpretation and abstract condition semantics.
 * @template Domains - Type of the abstract product mapping the names of the abstract domains of the analysis to the respective domains
 * @template Config  - Type of the configuration of the abstract interpretation visitor
 */
export class AbstractInterpretationVisitor<Domains extends AbstractProduct, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration>
	extends SemanticCfgGuidedVisitor<NoInfo, ControlFlowInformation, NormalizedAst, DataflowGraph, Config & { defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' }> {

	/**
	 * The abstract interpretation analysis performed by the visitor, defining the abstract domains, their abstract semantics, and the reductions between them.
	 */
	public readonly analysis: Readonly<AbsintAnalysis<Domains>>;

	/**
	 * The state abstract domain used by the abstract interpretation visitor.
	 */
	protected readonly stateDomain: MultiValueStateDomain<Partial<Domains>>;

	/**
	 * The abstract trace of the abstract interpretation visitor mapping node IDs to the abstract state at the respective node.
	 */
	protected readonly trace: Map<NodeId, MultiValueStateDomain<Partial<Domains>>> = new Map();

	/**
	 * The current abstract state domain at the currently processed AST node.
	 */
	protected currentState: MultiValueStateDomain<Partial<Domains>>;

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

	/**
	 * Creates an abstract interpretation visitor performing the given analysis.
	 * @param config   - The configuration of the visitor (containing the normalized AST, the dataflow graph, and the control flow graph of the program to analyze)
	 * @param analysis - The abstract interpretation analysis to perform, i.e. the abstract domains, their abstract semantics, and the reductions between them
	 */
	constructor(config: Config, analysis: AbsintAnalysis<Domains>) {
		super({ ...config, defaultVisitingOrder: 'forward', defaultVisitingType: 'exit' });

		this.analysis = analysis;
		this.stateDomain = new MultiValueStateDomain(new Map(), analysis.domains, analysis.reductions);
		this.currentState = this.stateDomain.top();
	}

	/**
	 * Creates the semantics context that is passed to the abstract semantics of one of the abstract domains of the analysis.
	 * The context provides access to the analyzed program and to the abstract states and values inferred for the requested abstract domain so far.
	 * @param type - The name of the abstract domain to create the semantics context for
	 * @returns The semantics context for the requested abstract domain
	 */
	public getContext<Key extends keyof Domains>(type: Key): SemanticsContext<StateDomain<Domains[Key]>> {
		const domain = this.analysis.domains[type];

		const getAbstractState = (nodeId: NodeId | undefined) => {
			if(nodeId === undefined) {
				return;
			}
			const state = this.trace.get(nodeId);

			if(state !== undefined) {
				return this.getState(type, state);
			};
		};

		const getAbstractValue = (nodeId: RNodeWithParent | NodeId | undefined, state?: StateDomain<Domains[Key]>): Domains[Key] | undefined => {
			const node = (nodeId === undefined || typeof nodeId === 'object') ? nodeId : this.getNormalizedAst(nodeId);
			state ??= node !== undefined ? getAbstractState(node.info.id) : undefined;

			if(node === undefined || state === undefined) {
				return;
			} else if(state?.isBottom()) {
				return domain.bottom();
			} else if(state.has(node.info.id)) {
				return state.get(node.info.id);
			}
			const vertex = this.getDataflowGraph(node.info.id);
			const call = FunctionCallVertex.is(vertex) ? vertex : undefined;
			const origins = Array.isArray(call?.origin) ? call.origin : [];

			if(node.type === RType.Symbol) {
				if(node.info.role === RoleInParent.FunctionCallName) {
					return getAbstractValue(node.info.parent, state);
				}
				const values = getVariableOrigins(node.info.id)
					.map(origin => (getAbstractState(origin)?.isBottom() ? domain.bottom() : state.get(origin)));

				if(values.length > 0 && values.every(isNotUndefined)) {
					return AbstractDomain.joinAll(values);
				}
			} else if(node.type === RType.Argument && node.value !== undefined) {
				return getAbstractValue(node.value, state);
			} else if(node.type === RType.ExpressionList && node.children.length > 0) {
				return getAbstractValue(node.children.at(-1), state);
			} else if(origins.includes(BuiltInProcName.Pipe)) {
				if(node.type === RType.Pipe || node.type === RType.BinaryOp) {
					return getAbstractValue(node.rhs, state);
				} else if(call?.args.length === 2 && call?.args[1] !== EmptyArgument) {
					return getAbstractValue(call.args[1].nodeId, state);
				}
			} else if(origins.includes(BuiltInProcName.IfThenElse)) {
				let values: (Domains[Key] | undefined)[] = [];

				if(node.type === RType.IfThenElse && node.otherwise !== undefined) {
					values = [node.then, node.otherwise].map(entry => getAbstractValue(entry, state));
				} else if(call?.args.every(arg => arg !== EmptyArgument) && call.args.length === 3) {
					values = call.args.slice(1, 3).map(entry => getAbstractValue(entry.nodeId, state));
				}
				if(values.length > 0 && values.every(isNotUndefined)) {
					return AbstractDomain.joinAll(values);
				}
			}
		};

		const getVariableOrigins = (nodeId: NodeId): NodeId[] => {
			return Dataflow.origin(this.config.dfg, nodeId)
				?.filter(origin => origin.type === OriginType.ReadVariableOrigin)
				.map(origin => origin.id)
				.filter(origin => getAbstractState(origin) !== undefined) ?? [];
		};

		return {
			ast:                this.config.normalizedAst,
			dfg:                this.config.dfg,
			cfg:                this.config.controlFlow.graph,
			context:            this.config.ctx,
			domain:             this.analysis.domains[type],
			getAstNode:         nodeId => this.getNormalizedAst(nodeId),
			getDfgVertex:       vertexId => vertexId !== undefined ? this.getDataflowGraph(vertexId) : undefined,
			getCfgVertex:       vertexId => vertexId !== undefined ? this.getCfgVertex(vertexId) : undefined,
			getAbstractState:   getAbstractState,
			getAbstractValue:   getAbstractValue,
			getVariableOrigins: getVariableOrigins
		};
	}

	/**
	 * Creates a view of a multi-value abstract state that only exposes the abstract values of one of the abstract domains of the analysis.
	 * All modifications of the returned view are applied to the underlying multi-value abstract state.
	 * @param type  - The name of the abstract domain to create the state view for
	 * @param state - The multi-value abstract state to create the view for (defaults to the current abstract state)
	 * @returns The state abstract domain of the requested abstract domain
	 */
	public getState<Key extends keyof Domains>(type: Key, state = this.currentState): StateDomain<Domains[Key]> {
		return {
			domain:   this.analysis.domains[type],
			get:      id => state.getValue(id, type),
			has:      id => state.hasValue(id, type),
			set:      (id, value) => state.setValue(id, type, value),
			remove:   id => state.removeValue(id, type),
			isBottom: () => state.isBottom()
		};
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
		const predecessorStates = this.getPredecessorStates(vertex);
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

			const predecessorVisits = predecessors.map(pred => this.visited.get(pred.id) ?? 0);
			const visitedCount = this.visited.get(nodeId) ?? 0;
			this.visited.set(nodeId, visitedCount + 1);

			// continue visiting if vertex is not a join vertex or number of visits of predecessors is the same
			return predecessors.length <= 1 || this.stack.length === 0 || predecessorVisits.every(visits => visits === predecessorVisits[0]);
		}
	}

	protected override visitUnknown(vertex: CfgStatementVertex | CfgExpressionVertex): void {
		const nodeId = CfgVertex.getRootId(vertex);
		const replacements = this.replacements.get(nodeId);

		if(replacements !== undefined) {
			this.replacements.delete(nodeId);

			for(const replacement of replacements) {
				const call = this.getDataflowGraph(replacement);

				if(FunctionCallVertex.is(call)) {
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

	protected override onExpressionList({ call }: { call: DataflowGraphVertexFunctionCall; }): void {
		const node = this.getNormalizedAst(call.id);
		let expressions: NodeId[];

		if(RExpressionList.is(node)) {
			expressions = node.children.map(child => child.info.id);
		} else {
			expressions = call.args.map(arg => FunctionArgument.isNotEmpty(arg) ? arg.nodeId : undefined).filter(isNotUndefined);
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleExpressionList?.(this.getState(type), call, this.getContext(type), expressions);
		}
	}

	protected override onIfThenElseCall({ call, condition, yes, no }: { call: DataflowGraphVertexFunctionCall; condition: NodeId | undefined; yes: NodeId | undefined; no: NodeId | undefined; }): void {
		if(condition === undefined || yes === undefined) {
			return;
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleIfThenElse?.(this.getState(type), call, this.getContext(type), condition, yes, no);
		}
	}

	protected override onForLoopCall({ call, variable, vector, body }: { call: DataflowGraphVertexFunctionCall; variable: FunctionArgument; vector: FunctionArgument; body: FunctionArgument; }): void {
		if(FunctionArgument.isEmpty(variable) || FunctionArgument.isEmpty(vector) || FunctionArgument.isEmpty(body)) {
			return;
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleForLoop?.(this.getState(type), call, this.getContext(type), variable.nodeId, vector.nodeId, body.nodeId);
		}
	}

	protected override onWhileLoopCall({ call, condition, body }: { call: DataflowGraphVertexFunctionCall; condition: FunctionArgument; body: FunctionArgument; }): void {
		if(FunctionArgument.isEmpty(condition) || FunctionArgument.isEmpty(body)) {
			return;
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleWhileLoop?.(this.getState(type), call, this.getContext(type), condition.nodeId, body.nodeId);
		}
	}

	protected override onRepeatLoopCall({ call, body }: { call: DataflowGraphVertexFunctionCall; body: FunctionArgument; }): void {
		if(FunctionArgument.isEmpty(body)) {
			return;
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleRepeatLoop?.(this.getState(type), call, this.getContext(type), body.nodeId);
		}
	}

	/**
	 * This event triggers for every function call that is not a condition, loop, assignment, replacement call, or access operation.
	 *
	 * This bundles all function calls that are no conditions, loops, assignments, replacement calls, and access operations.
	 * @protected
	 */
	protected onFunctionCall({ call }: { call: DataflowGraphVertexFunctionCall; }) {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleFunctionCall?.(this.getState(type), call, this.getContext(type));
		}
	}

	protected override onAssignmentCall({ call, target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(target === undefined || source === undefined) {
			return;
		}
		this.unassigned.delete(target);

		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleAssignmentCall?.(this.getState(type), call, this.getContext(type), target, source);
		}
	}

	protected override onReplacementCall({ call, target, source }: { call: DataflowGraphVertexFunctionCall, target?: NodeId, source?: NodeId }): void {
		if(target === undefined || source === undefined) {
			return;
		}
		this.unassigned.delete(target);

		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleReplacementCall?.(this.getState(type), call, this.getContext(type), target, source);
		}
	}

	protected override onAccessCall({ call }: { call: DataflowGraphVertexFunctionCall; }): void {
		const node = this.getNormalizedAst(call.id);
		let target: NodeId;

		if(RAccess.is(node)) {
			target = node.accessed.info.id;
		} else {
			const accessed = call.args.at(0);

			if(accessed === undefined || FunctionArgument.isEmpty(accessed)) {
				return;
			}
			target = accessed.nodeId;
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleAccessCall?.(this.getState(type), call, this.getContext(type), target);
		}
	}

	protected override onPipeCall({ call }: { call: DataflowGraphVertexFunctionCall; }) {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handlePipeCall?.(this.getState(type), call, this.getContext(type));
		}
	}

	protected override onBreakCall({ call }: { call: DataflowGraphVertexFunctionCall; }) {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleBreakCall?.(this.getState(type), call, this.getContext(type));
		}
	}

	protected override onReturnCall({ call }: { call: DataflowGraphVertexFunctionCall; }) {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleReturnCall?.(this.getState(type), call, this.getContext(type));
		}
	}

	protected override onStringConstant({ vertex, node }: { vertex: DataflowGraphVertexValue; node: RString; }): void {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleStringConstant?.(this.getState(type), vertex, this.getContext(type), node.content);
		}
	}

	protected override onNumberConstant({ vertex, node }: { vertex: DataflowGraphVertexValue; node: RNumber; }): void {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleNumberConstant?.(this.getState(type), vertex, this.getContext(type), node.content);
		}
	}

	protected override onLogicalConstant({ vertex, node }: { vertex: DataflowGraphVertexValue; node: RLogical; }): void {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleLogicalConstant?.(this.getState(type), vertex, this.getContext(type), node.content);
		}
	}

	protected override onNullConstant({ vertex, node }: { vertex: DataflowGraphVertexValue; node: RSymbol<object & ParentInformation, typeof RNull>; }): void {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleNullConstant?.(this.getState(type), vertex, this.getContext(type), node.content);
		}
	}

	protected override onSymbolConstant({ vertex, node }: { vertex: DataflowGraphVertexValue; node: RSymbol; }): void {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleSymbolConstant?.(this.getState(type), vertex, this.getContext(type), node.content);
		}
	}

	protected override onVariableUse({ vertex }: { vertex: DataflowGraphVertexUse; }): void {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleVariableUse?.(this.getState(type), vertex, this.getContext(type));
		}
	}

	protected override onVariableDefinition({ vertex }: { vertex: DataflowGraphVertexVariableDefinition; }): void {
		if(!this.trace.has(vertex.id)) {
			this.unassigned.add(vertex.id);
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleVariableDefinition?.(this.getState(type), vertex, this.getContext(type));
		}
	}

	protected override onFunctionDefinition({ vertex, parameters }: { vertex: DataflowGraphVertexFunctionDefinition; parameters?: readonly NodeId[]; }): void {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleFunctionDefinition?.(this.getState(type), vertex, this.getContext(type), parameters ?? Record.keys(vertex.params));
		}
	}

	/** Gets all AST nodes for the predecessor vertices that are leaf nodes and exit vertices with the connecting edges */
	protected getPredecessorNodes(vertexId: NodeId, pathEdges: CfgEdge[] = []): { id: NodeId, edges: CfgEdge[] }[] {
		return this.config.controlFlow.graph.outgoingEdges(vertexId)?.entries()  // outgoing dependency edges are ingoing CFG edges
			.map(([id, edge]): [CfgVertex | undefined, CfgEdge[]] => [this.getCfgVertex(id), [...pathEdges, edge]])
			.flatMap(([vertex, edges]) => {
				if(vertex === undefined) {
					return [];
				} else if(this.shouldSkipVertex(vertex)) {
					return this.getPredecessorNodes(CfgVertex.getId(vertex), edges);
				} else {
					return [{ id: CfgVertex.getRootId(vertex), edges }];
				}
			})
			.toArray() ?? [];
	}

	/** Gets the abstract states of all predecessor vertices applying condition semantics at control flow edges */
	protected getPredecessorStates(vertex: CfgVertex): MultiValueStateDomain<Partial<Domains>>[] {
		return this.getPredecessorNodes(CfgVertex.getId(vertex))
			.map(pred => {
				const predState = this.trace.get(pred.id);
				const controlEdge = pred.edges.find(CfgEdge.isControlDependency);
				const dfgVertex = this.getDataflowGraph(CfgVertex.getRootId(vertex));

				if(predState !== undefined && controlEdge !== undefined && dfgVertex !== undefined) {
					const condition = CfgEdge.unpackCause(controlEdge);
					const branchType = CfgEdge.unpackWhen(controlEdge);

					const newState = predState.create(predState.value);

					for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
						semantics.handleConditionBranch?.(this.getState(type, newState), dfgVertex, this.getContext(type), condition, branchType);
					}
					return newState;
				}
				return predState;
			}).filter(isNotUndefined);
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
		if(this.isWideningPoint(CfgVertex.getRootId(vertex))) {  // skip exit vertices of widening points
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
