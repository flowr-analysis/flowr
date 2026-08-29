import { CfgEdge, CfgVertex, type ControlFlowInformation, NoNeighbors, type ReadOnlyControlFlowGraph } from '../control-flow/control-flow-graph';
import { Fn } from '../dataflow/fn/fn';
import { type OnCall, SemanticCfgGuidedVisitor, type SemanticCfgGuidedVisitorConfiguration } from '../control-flow/semantic-cfg-guided-visitor';
import { visitCfgInOrder } from '../control-flow/simple-visitor';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { Identifier } from '../dataflow/environments/identifier';
import { Dataflow } from '../dataflow/graph/df-helper';
import { DfEdge, EdgeType } from '../dataflow/graph/edge';
import { type DataflowGraph, FunctionArgument } from '../dataflow/graph/graph';
import { type DataflowGraphVertexArgument, type DataflowGraphVertexFunctionCall, type DataflowGraphVertexFunctionDefinition, type DataflowGraphVertexUse, type DataflowGraphVertexValue, type DataflowGraphVertexVariableDefinition, DfgVertex, VertexType } from '../dataflow/graph/vertex';
import type { ControlDependency } from '../dataflow/info';
import { OriginType } from '../dataflow/origin/dfg-get-origin';
import type { NoInfo } from '../r-bridge/lang-4.x/ast/model/model';
import { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RParameter } from '../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RPipe } from '../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NormalizedAst, ParentInformation, RNodeWithParent } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RoleInParent } from '../r-bridge/lang-4.x/ast/model/processing/role';
import type { RNull } from '../r-bridge/lang-4.x/convert-values';
import { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';
import { guard, isNotUndefined } from '../util/assert';
import { Record } from '../util/record';
import type { AbsintContext, AbstractSemantics } from './abstract-semantics';
import { AbstractDomain, type AnyAbstractDomain } from './domains/abstract-domain';
import type { MultiValueDomain } from './domains/multi-value-state-domain';
import { MultiValueStateDomain } from './domains/multi-value-state-domain';
import type { AbstractProduct, ProductReduction } from './domains/partial-product-domain';
import type { StateDomain } from './domains/state-domain';

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
 * The configuration of an {@link AbstractInterpreter},
 * i.e. the configuration of a semantic control flow graph visitor without the visiting order (which is fixed by the abstract interpreter).
 */
export type AbsintVisitorConfiguration = Omit<SemanticCfgGuidedVisitorConfiguration<NoInfo, ControlFlowInformation, NormalizedAst>, 'defaultVisitingOrder'>;

/**
 * Where an abstract state arrives from, and which way the branch went if the step was one.
 *
 * For `if(u) a else b` the step onto `a` carries `{ id: <u>, branch: { id: <the if>, when: true } }`,
 * so the predecessor is the condition and `when` is the outcome it had.
 */
export interface AbsintPredecessor {
	/** the vertex the abstract state comes from */
	readonly id:      NodeId;
	/** the branch taken to get here, `undefined` if control simply flows on */
	readonly branch?: ControlDependency;
}

/** One step of the search for back edges: a vertex, and the successors of it that are still to be looked at. */
interface WideningSearchStep {
	readonly node:       NodeId;
	readonly successors: readonly NodeId[];
	/** the successor to continue with */
	at:                  number;
}

function stepFrom(graph: ReadOnlyControlFlowGraph, node: NodeId): WideningSearchStep {
	return { node, successors: [...graph.successors(node)], at: 0 };
}

/** Whether two rounds of a fixpoint bound the same values, `undefined` standing for nothing known yet. */
function sameValues(a: readonly (AnyAbstractDomain | undefined)[], b: readonly (AnyAbstractDomain | undefined)[] | undefined): boolean {
	return b !== undefined && a.length === b.length
		&& a.every((value, at) => value === undefined ? b[at] === undefined : b[at] !== undefined && value.equals(b[at]));
}

/**
 * An abstract interpreter that visits the control flow graph to perform abstract interpretation using fixpoint iteration.
 *
 * The visitor infers the abstract values of multiple abstract domains in a single traversal.
 * The abstract state maps each AST node to the abstract values of all domains of the {@link AbsintAnalysis},
 * and whenever a node is visited, the {@link AbstractSemantics} of every domain of the analysis are applied to that state.
 * @template Domains - Type of the abstract product mapping the names of the abstract domains of the analysis to the respective domains
 * @template Config  - Type of the configuration of the abstract interpretation visitor
 */
export class AbstractInterpreter<Domains extends AbstractProduct, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration>
	extends SemanticCfgGuidedVisitor<NoInfo, ControlFlowInformation, NormalizedAst, DataflowGraph, Config & { defaultVisitingOrder: 'forward' }> {

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
	 * The cached abstract interpretation contexts of the abstract domains of the analysis (see {@link getContext}).
	 */
	private readonly contexts: Map<keyof Domains, AbsintContext<StateDomain<Domains[keyof Domains]>>> = new Map();

	/**
	 * The nodes a back edge of the control flow graph leads to, computed on demand.
	 * @see {@link AbstractInterpreter#isWideningPoint|isWideningPoint()}
	 */
	private wideningPoints: ReadonlySet<NodeId> | undefined;

	/**
	 * What leads to a vertex, without the call a body was entered from.
	 * {@link AbstractInterpreter#shouldSkipVertex|shouldSkipVertex()} is asked once per vertex, so
	 * an override of it has to say the same thing every time.
	 */
	private readonly predecessorsOf: Map<NodeId, readonly AbsintPredecessor[]> = new Map();

	/** What the control flow may reach from a vertex, asked only by a read with several definitions. */
	private readonly reachableFrom: Map<NodeId, ReadonlySet<NodeId>> = new Map();

	/**
	 * The state each vertex was left in when it was last visited, so a re-visit can tell whether anything moved.
	 * The trace cannot say that: entering a call seeds it before the parameters and the call are visited.
	 */
	private readonly lastState: Map<NodeId, MultiValueStateDomain<Partial<Domains>>> = new Map();

	/**
	 * A set of nodes representing variable definitions that have already been visited but whose assignment has not yet been processed.
	 */
	private readonly unassigned: Set<NodeId> = new Set();

	/** The call a function body is currently being interpreted for, mapping the body's entry to it. */
	private readonly enteredFrom: Map<NodeId, NodeId> = new Map();

	/** The function definitions currently being interpreted, which is what makes a call back into one recursive. */
	private readonly running: Set<NodeId> = new Set();

	/** The definitions that turned out to call themselves, which are the ones run more than once. */
	private readonly recursive: Set<NodeId> = new Set();

	/** What a definition being interpreted was last seen to leave behind, which is what its own calls are worth. */
	private readonly returns: Map<NodeId, MultiValueDomain<Partial<Domains>>> = new Map();

	/** The calls that lead back into a definition still being interpreted, and the definition they reach. */
	private readonly recursiveCalls: Map<NodeId, NodeId> = new Map();

	/**
	 * Creates an abstract interpretation visitor performing the given analysis.
	 * @param config   - The configuration of the visitor (containing the normalized AST, the dataflow graph, and the control flow graph of the program to analyze)
	 * @param analysis - The abstract interpretation analysis to perform, i.e. the abstract domains, their abstract semantics, and the reductions between them
	 */
	constructor(config: Config, analysis: AbsintAnalysis<Domains>) {
		super({ ...config, defaultVisitingOrder: 'forward' });

		this.analysis = analysis;
		this.stateDomain = new MultiValueStateDomain(new Map(), analysis.domains, analysis.reductions);
		this.currentState = this.stateDomain.top();
	}

	/**
	 * Creates the abstract interpretation context that is passed to the abstract semantics of one of the abstract domains of the analysis.
	 * The context provides access to the analyzed program and to the abstract states and values inferred for the requested abstract domain so far.
	 * @param type - The name of the abstract domain to create the context for
	 * @returns    The abstract interpretation context for the requested abstract domain
	 */
	public getContext<Key extends keyof Domains>(type: Key): AbsintContext<StateDomain<Domains[Key]>> {
		const cached = this.contexts.get(type);

		if(cached !== undefined) {
			return cached as AbsintContext<StateDomain<Domains[Key]>>;
		}
		const context: AbsintContext<StateDomain<Domains[Key]>> = {
			ast:                this.config.normalizedAst,
			dfg:                this.config.dfg,
			cfg:                this.config.controlFlow.graph,
			context:            this.config.ctx,
			domain:             this.analysis.domains[type],
			getAstNode:         nodeId => this.getNormalizedAst(nodeId),
			getDfgVertex:       vertexId => vertexId !== undefined ? this.getDataflowGraph(vertexId) : undefined,
			getCfgVertex:       vertexId => vertexId !== undefined ? this.getCfgVertex(vertexId) : undefined,
			getAbstractState:   nodeId => this.getAbstractState(nodeId, type),
			getAbstractValue:   (nodeId, state) => this.getAbstractValue(nodeId, type, state),
			getVariableOrigins: nodeId => this.getVariableOrigins(nodeId)
		};
		this.contexts.set(type, context);

		return context;
	}

	/**
	 * Creates a view of a multi-value abstract state that only exposes the abstract values of one of the abstract domains of the analysis.
	 * All modifications of the returned view are applied to the underlying multi-value abstract state.
	 * @param type  - The name of the abstract domain to create the state view for
	 * @param state - The multi-value abstract state to create the view for (defaults to the current abstract state)
	 * @returns     The state abstract domain of the requested abstract domain
	 */
	public getState<Key extends keyof Domains>(type: Key, state = this.currentState): StateDomain<Domains[Key]> {
		return {
			domain:   this.analysis.domains[type],
			get:      id => state.getValue(id, type),
			has:      id => state.hasValue(id, type),
			set:      (id, value) => state.setValue(id, type, value),
			remove:   id => state.removeValue(id, type),
			entries:  () => state.entries(type) as readonly [NodeId, Domains[Key]][],
			isBottom: () => state.isBottom()
		};
	}

	/**
	 * Resolves the inferred abstract value of an AST node for one of the abstract domains of the analysis,
	 * by following symbols to their variable origins, arguments to their values, expression lists to their last expression,
	 * and pipes and `if` expressions to their results.
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param nodeId - The node (or ID of the node) to get the inferred abstract value for
	 * @param type   - The name of the abstract domain to get the inferred abstract value for
	 * @returns      The inferred abstract value of the node, or `undefined` if no value was inferred for the node
	 */
	public getAbstractValue<Key extends keyof Domains>(nodeId: RNodeWithParent | NodeId | undefined, type: Key, state?: StateDomain<Domains[Key]>): Domains[Key] | undefined;
	public getAbstractValue(nodeId: RNodeWithParent | NodeId | undefined, type?: undefined, state?: MultiValueStateDomain<Partial<Domains>>): MultiValueDomain<Partial<Domains>> | undefined;
	public getAbstractValue<Key extends keyof Domains>(nodeId: RNodeWithParent | NodeId | undefined, type?: Key, state?: StateDomain<Domains[Key]> | MultiValueStateDomain<Partial<Domains>>): Domains[Key] | MultiValueDomain<Partial<Domains>> | undefined;
	public getAbstractValue<Key extends keyof Domains>(nodeId: RNodeWithParent | NodeId | undefined, type?: Key, state?: StateDomain<Domains[Key]> | MultiValueStateDomain<Partial<Domains>>): Domains[Key] | MultiValueDomain<Partial<Domains>> | undefined {
		const node = (nodeId === undefined || typeof nodeId === 'object') ? nodeId : this.getNormalizedAst(nodeId);
		state ??= node !== undefined ? this.getAbstractState(node.info.id, type) : undefined;

		if(state?.isBottom()) {
			return state.domain.bottom();
		} else if(node === undefined) {
			return;
		}
		const reached = this.recursiveCalls.get(node.info.id);

		if(reached !== undefined) {
			/* it is worth what the definition it reaches was last seen to leave behind, nothing in round one */
			return this.getReturnValue(reached, type) ?? state?.domain.bottom();
		}
		if(state?.has(node.info.id)) {
			return state.get(node.info.id);
		}
		const vertex = this.getDataflowGraph(node.info.id);
		const call = DfgVertex.isFunctionCall(vertex) ? vertex : undefined;
		const origins = Array.isArray(call?.origin) ? call.origin : [];

		if(RSymbol.is(node)) {
			if(node.info.role === RoleInParent.FunctionCallName) {
				return this.getAbstractValue(node.info.parent, type, vertex !== undefined ? state : undefined);
			}
			const values = this.getVariableOrigins(node.info.id)
				.map(origin => (this.getAbstractState(origin)?.isBottom() ? state?.domain.bottom() : state?.get(origin)));

			if(values.length > 0 && values.every(isNotUndefined)) {
				return AbstractDomain.joinAll(values);
			}
		} else if(RArgument.isWithValue(node)) {
			return this.getAbstractValue(node.value, type, state);
		} else if(RExpressionList.is(node) && node.children.length > 0) {
			return this.getAbstractValue(node.children.at(-1), type, state);
		} else if(origins.includes(BuiltInProcName.Return)) {
			/* leaving with `return(x)` is worth what `x` is worth, which is what a function that does it exits with */
			if(call?.args.length === 1 && call.args[0] !== EmptyArgument) {
				return this.getAbstractValue(call.args[0].nodeId, type, state);
			}
		} else if(origins.includes(BuiltInProcName.Pipe)) {
			if(RPipe.is(node) || RBinaryOp.is(node)) {
				return this.getAbstractValue(node.rhs, type, state);
			} else if(call?.args.length === 2 && call?.args[1] !== EmptyArgument) {
				return this.getAbstractValue(call.args[1].nodeId, type, state);
			}
		} else if(origins.includes(BuiltInProcName.IfThenElse)) {
			let values: (MultiValueDomain<Partial<Domains>> | Domains[Key] | undefined)[] = [];

			if(RIfThenElse.is(node) && node.otherwise !== undefined) {
				values = [node.then, node.otherwise].map(entry => this.getAbstractValue(entry, type, state));
			} else if(call?.args.every(arg => arg !== EmptyArgument) && call.args.length === 3) {
				values = call.args.slice(1, 3).map(entry => this.getAbstractValue(entry.nodeId, type, state));
			}
			if(values.length > 0 && values.every(isNotUndefined)) {
				return AbstractDomain.joinAll(values);
			}
		}
	}

	/**
	 * Gets the inferred abstract state at the location of a specific AST node.
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param nodeId - The ID of the node to get the abstract state at
	 * @param type   - The name of the abstract domain to get the abstract state for
	 * @returns      The abstract state at the node, or `undefined` if the node has no abstract state for the abstract domain
	 */
	public getAbstractState<Key extends keyof Domains>(nodeId: NodeId | undefined, type: Key): StateDomain<Domains[Key]> | undefined;
	public getAbstractState(nodeId: NodeId | undefined): MultiValueStateDomain<Partial<Domains>> | undefined;
	public getAbstractState<Key extends keyof Domains>(nodeId: NodeId | undefined, type?: Key): StateDomain<Domains[Key]> | MultiValueStateDomain<Partial<Domains>> | undefined;
	public getAbstractState<Key extends keyof Domains>(nodeId: NodeId | undefined, type?: Key): StateDomain<Domains[Key]> | MultiValueStateDomain<Partial<Domains>> | undefined {
		if(nodeId === undefined) {
			return;
		}
		const state = this.trace.get(nodeId);

		if(type !== undefined && state !== undefined) {
			return this.getState(type, state);
		}
		return state;
	}

	/**
	 * Gets the inferred abstract state at the end of the program (exit nodes of the control flow graph).
	 * This requires that the abstract interpretation visitor has been completed, or at least started.
	 * @param type - The name of the abstract domain to get the abstract state for
	 * @returns    The inferred abstract state at the end of the program
	 */
	public getEndState<Key extends keyof Domains>(type: Key): StateDomain<Domains[Key]>;
	public getEndState(): MultiValueStateDomain<Partial<Domains>>;
	public getEndState<Key extends keyof Domains>(type?: Key): StateDomain<Domains[Key]> | MultiValueStateDomain<Partial<Domains>> {
		const states = this.config.controlFlow.exitPoints.map(node => this.trace.get(node)).filter(isNotUndefined);
		const state = AbstractDomain.joinAll(states, this.stateDomain.bottom());

		if(type !== undefined && state !== undefined) {
			return this.getState(type, state);
		}
		return state;
	}

	/**
	 * Gets the inferred abstract trace mapping AST nodes to the inferred abstract state at the respective node.
	 * @returns The inferred abstract trace of the program
	 */
	public getAbstractTrace(): ReadonlyMap<NodeId, MultiValueStateDomain<Partial<Domains>>> {
		return this.trace;
	}

	/** What a definition currently being interpreted was last seen to leave behind, projected to one of the domains if asked for one. */
	private getReturnValue<Key extends keyof Domains>(def: NodeId, type?: Key): Domains[Key] | MultiValueDomain<Partial<Domains>> | undefined {
		const value = this.returns.get(def);

		if(type === undefined || value === undefined) {
			return value;
		}
		return value.isValue() ? value.value[type] : undefined;
	}

	public override start(): void {
		guard(this.trace.size === 0, 'Abstract interpretation visitor has already been started');
		super.start();
		this.unassigned.clear();
		this.lastState.clear();
	}

	protected override startVisitor(start: readonly NodeId[]): void {
		this.stack = Array.from(start);
		const queued = new Set(this.stack);

		while(this.stack.length > 0) {
			const current = this.stack.pop() as NodeId;
			queued.delete(current);

			if(!this.visitNode(current)) {
				continue;
			}
			const successors = [...this.config.controlFlow.graph.successors(current)].reverse();

			for(const next of successors) {
				if(!queued.has(next)) {  // prevent double entries in working list
					queued.add(next);
					this.stack.push(next);
				}
			}
		}
	}

	protected override visitNode(vertexId: NodeId): boolean {
		const vertex = this.getCfgVertex(vertexId);

		if(vertex === undefined || this.shouldSkipVertex(vertex)) {
			return true;
		}
		// retrieve new abstract state by joining states of predecessor nodes
		const nodeId = CfgVertex.getId(vertex);
		const predecessors = this.getPredecessors(nodeId);
		const predecessorStates = predecessors.map(pred => this.getPredecessorState(pred)).filter(isNotUndefined);
		this.currentState = AbstractDomain.joinAll(predecessorStates, this.currentState.top());

		const oldState = this.lastState.get(nodeId);

		/*
		 * A widening point is a node of the program like any other: the head of a `while` is its condition, of a
		 * `repeat` its first statement. The iteration is bounded here, the node still says what it says.
		 */
		if(oldState !== undefined && this.isWideningPoint(nodeId) && this.shouldWiden(vertex)) {
			this.currentState = oldState.widen(this.currentState);
		}
		this.onVisitNode(vertexId);

		// discard the inferred abstract state when encountering unsupported function calls
		if(this.isUnsupportedFunctionCall(nodeId)) {
			this.currentState = this.currentState.top();
		}
		this.trace.set(nodeId, this.currentState);
		this.lastState.set(nodeId, this.currentState);

		const visitedCount = this.visited.get(nodeId) ?? 0;
		this.visited.set(nodeId, visitedCount + 1);

		/*
		 * Carry on wherever the vertex is new or its state moved. Waiting for the branches of a join to arrive
		 * in step instead drops the rest of the program whenever they do not, three arms in a loop say.
		 */
		return visitedCount === 0 || !oldState?.equals(this.currentState);
	}

	protected override onDispatchFunctionCallOrigin(call: DataflowGraphVertexFunctionCall, origin: BuiltInProcName) {
		if(origin === BuiltInProcName.Replacement) {
			/*
			 * A replacement is the last thing its statement does (the target and the value are evaluated first),
			 * so it is handled where it is visited; the `<-` it was rewritten from has no vertex to defer to.
			 */
			this.onReplacementCall({ call, ...this.getSourceAndTarget(call) });
			return;
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
			case BuiltInProcName.Access:
			case BuiltInProcName.Pipe:
			case BuiltInProcName.Break:
			case BuiltInProcName.Return:
				return;
			default:
				return this.onFunctionCall({ call });
		}
	}

	protected override onExpressionList({ call }: OnCall): void {
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

	protected override onIfThenElseCall({ call, condition, yes, no }: OnCall & { condition: NodeId | undefined; yes: NodeId | undefined; no: NodeId | undefined; }): void {
		if(condition === undefined || yes === undefined) {
			return;
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleIfThenElse?.(this.getState(type), call, this.getContext(type), condition, yes, no);
		}
	}

	protected override onForLoopCall({ call, variable, vector, body }: OnCall & { variable: FunctionArgument; vector: FunctionArgument; body: FunctionArgument; }): void {
		if(FunctionArgument.isEmpty(variable) || FunctionArgument.isEmpty(vector) || FunctionArgument.isEmpty(body)) {
			return;
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleForLoop?.(this.getState(type), call, this.getContext(type), variable.nodeId, vector.nodeId, body.nodeId);
		}
	}

	protected override onWhileLoopCall({ call, condition, body }: OnCall & { condition: FunctionArgument; body: FunctionArgument; }): void {
		if(FunctionArgument.isEmpty(condition) || FunctionArgument.isEmpty(body)) {
			return;
		}
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleWhileLoop?.(this.getState(type), call, this.getContext(type), condition.nodeId, body.nodeId);
		}
	}

	protected override onRepeatLoopCall({ call, body }: OnCall & { body: FunctionArgument; }): void {
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
	protected onFunctionCall({ call }: OnCall) {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleFunctionCall?.(this.getState(type), call, this.getContext(type));
		}
	}

	protected override onAssignmentCall({ call, target, source }: OnCall & { target?: NodeId, source?: NodeId }): void {
		if(target === undefined || source === undefined) {
			return;
		}
		this.unassigned.delete(target);

		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleAssignmentCall?.(this.getState(type), call, this.getContext(type), target, source);
		}
		// the assignment target is visited before the assignment, so we update its state with the assigned values
		this.trace.set(target, this.currentState);
	}

	protected override onReplacementCall({ call, target, source }: OnCall & { target?: NodeId, source?: NodeId }): void {
		if(target === undefined || source === undefined) {
			return;
		}
		this.unassigned.delete(target);

		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleReplacementCall?.(this.getState(type), call, this.getContext(type), target, source);
		}
	}

	protected override onAccessCall({ call }: OnCall): void {
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

	protected override onPipeCall({ call }: OnCall) {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handlePipeCall?.(this.getState(type), call, this.getContext(type));
		}
	}

	protected override onBreakCall({ call }: OnCall) {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleBreakCall?.(this.getState(type), call, this.getContext(type));
		}
	}

	protected override onReturnCall({ call }: OnCall) {
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
		this.bindParameterDefault(vertex.id);
	}

	protected override onFunctionDefinition({ vertex, parameters }: { vertex: DataflowGraphVertexFunctionDefinition; parameters?: readonly NodeId[]; }): void {
		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleFunctionDefinition?.(this.getState(type), vertex, this.getContext(type), parameters ?? Record.keys(vertex.params));
		}
	}

	/**
	 * `bindParameters` hands the arguments over before the function is entered, so a parameter still without
	 * a value is one the call passed nothing for and is worth the default it names. That default runs before
	 * the body, so standing on the parameter is the moment to read it.
	 */
	private bindParameterDefault(nodeId: NodeId): void {
		if(this.currentState.has(nodeId)) {
			return;
		}
		const declaration = this.getNormalizedAst(this.getNormalizedAst(nodeId)?.info.parent);

		if(!RParameter.isWithDefault(declaration)) {
			return;
		}
		const value = this.getAbstractValue(declaration.defaultValue, undefined, this.currentState);

		if(value !== undefined) {
			this.currentState.set(nodeId, value);
			this.unassigned.delete(nodeId);
		}
	}

	protected handleConditionBranch(state: MultiValueStateDomain<Partial<Domains>>, conditionVertex: DataflowGraphVertexArgument, branch: typeof RTrue | typeof RFalse): MultiValueStateDomain<Partial<Domains>> {
		if(DfgVertex.isFunctionCall(conditionVertex) && conditionVertex.args.every(FunctionArgument.isNotEmpty)) {
			const name = Identifier.getName(conditionVertex.name);
			const isNot = Identifier.matches(name, ['base', '!']);
			const isAnd = Identifier.matches(name, ['base', '&&']) || Identifier.matches(name, ['base', '&']);
			const isOr = Identifier.matches(name, ['base', '||']) || Identifier.matches(name, ['base', '|']);

			if(isNot && conditionVertex.args.length === 1) {
				const childVertex = this.getDataflowGraph(conditionVertex.args[0].nodeId);

				if(childVertex !== undefined) {
					return this.handleConditionBranch(state, childVertex, branch === RTrue ? RFalse : RTrue);
				}
			} else if((isAnd || isOr) && conditionVertex.args.length === 2) {
				const leftVertex = this.getDataflowGraph(conditionVertex.args[0].nodeId);
				const rightVertex = this.getDataflowGraph(conditionVertex.args[1].nodeId);

				if(leftVertex !== undefined && rightVertex !== undefined) {
					const leftState = this.handleConditionBranch(state, leftVertex, branch);
					const rightState = this.handleConditionBranch(state, rightVertex, branch);

					if(branch === RTrue && isAnd || branch === RFalse && isOr) {
						return leftState.meet(rightState);
					} else if(branch === RTrue && isOr || branch === RFalse && isAnd) {
						return leftState.join(rightState);
					}
				}
			}
		}
		const newState = state.create(state.value);

		for(const [type, semantics] of Record.properties(this.analysis.semantics)) {
			semantics.handleConditionBranch?.(this.getState(type, newState), conditionVertex, this.getContext(type), branch);
		}
		return newState;
	}

	/**
	 * Everything the control flow may come from to reach this vertex, together with the branch it took to get here.
	 * Skipped vertices hold no state of their own, so what led into them is reported instead.
	 */
	protected getPredecessors(vertexId: NodeId): readonly AbsintPredecessor[] {
		let result = this.predecessorsOf.get(vertexId);

		if(result === undefined) {
			result = this.collectPredecessors(vertexId);
			this.predecessorsOf.set(vertexId, result);
		}
		/* a body has no predecessor of its own, so what runs before it is the call we stepped in from */
		const enteredFrom = this.enteredFrom.get(vertexId);
		return enteredFrom === undefined ? result : [...result, { id: enteredFrom }];
	}

	/** What the control flow graph itself says leads here, which is the same however often it is asked. */
	private collectPredecessors(vertexId: NodeId): readonly AbsintPredecessor[] {
		const result: AbsintPredecessor[] = [];
		for(const [id, edge] of this.config.controlFlow.graph.edgesTo(vertexId)) {
			const branch = CfgEdge.isControlDependency(edge) ? edge : undefined;
			const vertex = this.getCfgVertex(id);
			if(vertex === undefined) {
				continue;
			} else if(this.shouldSkipVertex(vertex)) {
				/* the branch closest to us is the one that decided we get here at all, so it wins */
				result.push(...this.collectPredecessors(id).map(pred => branch ? { ...pred, branch } : pred));
			} else {
				result.push({ id, branch });
			}
		}
		return result;
	}

	/**
	 * The abstract state one predecessor contributes, joined into the state at the current vertex.
	 *
	 * The condition semantics of the analysis are applied at branches: on the then-branch of `if(u) a else b`
	 * the predecessor is `u` and `branch.when` is `true`, so `u` held.
	 */
	protected getPredecessorState({ id, branch }: AbsintPredecessor): MultiValueStateDomain<Partial<Domains>> | undefined {
		const predState = this.trace.get(id);

		if(predState === undefined || branch === undefined) {
			return predState;
		}
		const conditionVertex = this.getDataflowGraph(branch.id);

		if(conditionVertex === undefined) {
			return predState;
		}
		return this.handleConditionBranch(predState, conditionVertex, branch.when ? RTrue : RFalse);
	}

	protected override visitFunctionCall(call: DataflowGraphVertexFunctionCall): void {
		super.visitFunctionCall(call);

		if(this.shouldEnterCall(call)) {
			this.currentState = this.enterCall(call.id) ?? this.currentState;
		}
	}

	/**
	 * Whether to step into what the given call dispatches to, which is what makes the analysis interprocedural.
	 * Defaults to `abstractInterpretation.followCalls`; override it to decide per call. A call that reaches no
	 * definition is left alone either way.
	 */
	protected shouldEnterCall(_call: DataflowGraphVertexFunctionCall): boolean {
		return this.config.ctx.config.abstractInterpretation.followCalls;
	}

	/**
	 * The function definitions the given call may dispatch to.
	 * Built-in functions have no definition in the source, so they are not part of this.
	 */
	protected getCallTargets(callId: NodeId): readonly NodeId[] {
		const targets = CfgVertex.getCallTargets(this.getCfgVertex(callId));
		return targets === undefined ? NoNeighbors : [...targets];
	}

	/** Where a function definition starts, i.e. the first thing that runs when it is called. */
	protected getFunctionEntry(defId: NodeId): NodeId | undefined {
		const def = this.getDataflowGraph(defId);
		return DfgVertex.isFunctionDefinition(def) ? def.subflow.cfgEntry ?? def.subflow.entryPoint : undefined;
	}

	/** Where a function definition is left, i.e. its last expressions and `return` calls. */
	protected getFunctionExits(defId: NodeId): readonly NodeId[] {
		const def = this.getDataflowGraph(defId);
		return DfgVertex.isFunctionDefinition(def) ? def.exitPoints.map(exit => exit.nodeId) : NoNeighbors;
	}

	/**
	 * Runs the bodies the given call dispatches to, starting from the state at the call, and returns the state
	 * control comes back with: the states at their exit points joined.
	 * A call already being interpreted is not entered again, so recursion stops at the second entry.
	 * @returns the state at the exit points, or `undefined` if the call reaches nothing to step into
	 */
	protected enterCall(callId: NodeId): MultiValueStateDomain<Partial<Domains>> | undefined {
		const states: MultiValueStateDomain<Partial<Domains>>[] = [];
		const values: MultiValueDomain<Partial<Domains>>[] = [];
		const outerState = this.currentState;

		/* the entry picks its state up from the call, which is what makes the arguments visible in the body */
		this.trace.set(callId, outerState);

		/*
		 * The call is worth something only if every way out of every function it reaches is: one that leaves a
		 * frame on one path and something else on another says as little as `if(u) df else 42` does.
		 */
		let known = true;

		for(const def of this.getCallTargets(callId)) {
			const entry = this.getFunctionEntry(def);

			if(entry === undefined) {
				continue;
			} else if(this.running.has(def)) {
				/* it is worth what it leaves behind, which is only known once it is done; see `getAbstractValue` */
				this.recursive.add(def);
				this.recursiveCalls.set(callId, def);
				continue;
			}
			this.running.add(def);
			const left = this.runFunction(callId, def, entry, outerState);
			this.running.delete(def);
			this.recursive.delete(def);
			this.returns.delete(def);

			states.push(...left.states);
			if(left.value === undefined) {
				known = false;
			} else {
				values.push(left.value);
			}
		}
		this.currentState = outerState;

		if(states.length === 0) {
			return undefined;
		}
		const returned = AbstractDomain.joinAll(states);
		if(known && values.length > 0) {
			/* what the call is worth is what its function leaves behind at its exits */
			returned.set(callId, AbstractDomain.joinAll(values));
		}
		return returned;
	}

	/**
	 * Runs one definition for one call until what it leaves behind stops moving.
	 *
	 * One that does not call itself is run once. One that does is a fixpoint in two halves: what it leaves
	 * behind, which its own calls read, and what its parameters are worth, which those calls decide, since
	 * `shrink(head(x, nrow(x) - 1))` hands over fewer rows than it was given. Both are widened so they stop.
	 * @returns the states at the exit points, and what the definition leaves behind if every way out says
	 */
	private runFunction(callId: NodeId, def: NodeId, entry: NodeId, outerState: MultiValueStateDomain<Partial<Domains>>): { states: MultiValueStateDomain<Partial<Domains>>[], value: MultiValueDomain<Partial<Domains>> | undefined } {
		const threshold = this.config.ctx.config.abstractInterpretation.wideningThreshold;
		/* the counts drive the widening within the body, and belong to this call rather than to the program */
		const counts = this.regionVisits(entry);
		let settled: MultiValueDomain<Partial<Domains>> | undefined = undefined;
		let bound: (MultiValueDomain<Partial<Domains>> | undefined)[] | undefined = undefined;

		for(let round = 0; ; round++) {
			/* the parameters are the definition's own, so they are bound in a state of its own */
			const inner = outerState.create(outerState.value);
			this.currentState = inner;
			this.bindParameters(callId, def);

			/*
			 * The calls a definition makes to itself enter it too, so its parameters are worth what either they
			 * or the outer call say. Widening them is what stops the rounds: a recursion that keeps adding to
			 * what it is handed would otherwise be described by the first step it takes.
			 */
			for(const [call, reached] of this.recursiveCalls) {
				if(reached === def) {
					this.bindParameters(call, def, round > 0 ? 'widen' : 'join');
				}
			}
			const handed = this.parameterValues(def);
			this.trace.set(callId, inner);
			this.enteredFrom.set(entry, callId);

			/* what a recursive call is worth is no part of the state, so the traversal has to be made to re-read */
			if(round > 0) {
				for(const id of this.reachableSet(entry)) {
					this.lastState.delete(id);
				}
			}
			const outerStack = this.stack;
			this.startVisitor([entry]);
			this.stack = outerStack;
			this.enteredFrom.delete(entry);

			const states: MultiValueStateDomain<Partial<Domains>>[] = [];
			const exits: MultiValueDomain<Partial<Domains>>[] = [];
			let complete = true;

			for(const exit of this.getFunctionExits(def)) {
				const state = this.trace.get(exit);
				if(state === undefined) {
					continue;
				}
				states.push(state);
				const value = this.getAbstractValue(exit, undefined, state);
				if(value === undefined) {
					complete = false;
				} else {
					exits.push(value);
				}
			}
			const left = complete && exits.length > 0 ? AbstractDomain.joinAll(exits) : undefined;

			if(!this.recursive.has(def)) {
				this.restoreVisits(counts);
				return { states, value: left };
			} else if(left === undefined) {
				/* one way out of the recursion says nothing, so neither does the recursion */
				this.restoreVisits(counts);
				return { states, value: undefined };
			}
			/* widening bounds the rounds, the same way it bounds the rounds of a loop */
			const next: MultiValueDomain<Partial<Domains>> = settled !== undefined && round >= threshold ? settled.widen(left) : left;
			const moved = settled === undefined || !next.equals(settled) || !sameValues(handed, bound);

			settled = next;
			bound = handed;
			this.returns.set(def, next);

			if(!moved) {
				this.restoreVisits(counts);
				return { states, value: settled };
			}
		}
	}

	/** What the parameters of a definition are worth in the state they were just bound in. */
	private parameterValues(defId: NodeId): (MultiValueDomain<Partial<Domains>> | undefined)[] {
		const definition = this.getDataflowGraph(defId);

		if(!DfgVertex.isFunctionDefinition(definition)) {
			return [];
		}
		return Object.keys(definition.params).map(key => this.currentState.get(NodeId.normalize(key)));
	}

	/** How often each vertex of a function has been visited, so one call does not widen the next one early. */
	private regionVisits(entry: NodeId): Map<NodeId, number | undefined> {
		const counts = new Map<NodeId, number | undefined>();
		for(const id of this.reachableSet(entry)) {
			counts.set(id, this.visited.get(id));
		}
		return counts;
	}

	/** Puts the visit counts back as they were before a function was run for one call. */
	private restoreVisits(counts: ReadonlyMap<NodeId, number | undefined>): void {
		for(const [id, count] of counts) {
			if(count === undefined) {
				this.visited.delete(id);
			} else {
				this.visited.set(id, count);
			}
		}
	}

	/**
	 * Hand the arguments of the call to the parameters of the function it enters, so the body can read them.
	 * Only the arguments of this very call are used, whichever other calls the function has.
	 */
	protected bindParameters(callId: NodeId, defId: NodeId, add?: 'join' | 'widen'): void {
		const call = this.getDataflowGraph(callId);
		const definition = this.getDataflowGraph(defId);

		if(!DfgVertex.isFunctionCall(call) || !DfgVertex.isFunctionDefinition(definition)) {
			return;
		}
		const args = new Set(call.args.filter(FunctionArgument.isNotEmpty).map(arg => arg.nodeId));
		for(const key of Object.keys(definition.params)) {
			/* object keys are strings, the graph keys its vertices by the id itself */
			const parameter = NodeId.normalize(key);
			for(const [target, edge] of this.config.dfg.edgesFrom(parameter)) {
				if(!DfEdge.includesType(edge, EdgeType.DefinedByOnCall) || !args.has(target)) {
					continue;
				}
				/* a call that is not the one being entered is read where it stands, not from the state here */
				let value = add === undefined ? this.getAbstractValue(target, undefined, this.currentState) : this.getAbstractValue(target);
				const previous = add === undefined ? undefined : this.currentState.get(parameter);

				if(value !== undefined && previous !== undefined) {
					value = (add === 'widen' ? previous.widen(value) : previous.join(value));
				}
				if(value !== undefined) {
					this.currentState.set(parameter, value);
					/* the parameter is a definition like any other, so the body only reads it once it counts as assigned */
					this.trace.set(parameter, this.currentState);
					this.unassigned.delete(parameter);
				}
			}
		}
	}

	/** Gets each variable origin that has already been visited and whose assignment has already been processed */
	protected getVariableOrigins(nodeId: NodeId): NodeId[] {
		const origins = Dataflow.origin(this.config.dfg, nodeId)
			?.filter(origin => origin.type === OriginType.ReadVariableOrigin)
			.map(origin => origin.id)
			.filter(origin => this.trace.has(origin) && !this.unassigned.has(origin)) ?? [];

		/*
		 * A read with a single definition takes it whatever the control flow does. One with several only sees
		 * those that can reach it: `x` within `for(i in 1:nrow(x)) x$a[i] <- 1` is a definition of the `x` in
		 * the head of the loop, but the head runs before the body ever does.
		 */
		return origins.length > 1 ? origins.filter(origin => this.reaches(origin, nodeId)) : origins;
	}

	/** Whether the control flow may get from one vertex to another, answered from one traversal per source. */
	private reaches(from: NodeId, to: NodeId): boolean {
		return this.reachableSet(from).has(to);
	}

	/** Everything the control flow may reach from a vertex, walked once per source and kept. */
	private reachableSet(from: NodeId): ReadonlySet<NodeId> {
		let reachable = this.reachableFrom.get(from);

		if(reachable === undefined) {
			reachable = visitCfgInOrder(this.config.controlFlow.graph, [from], () => { /* only collect */ });
			this.reachableFrom.set(from, reachable);
		}
		return reachable;
	}

	/** Checks whether a node represents a unsupported (environment-changing) function call (e.g. `eval`, `load`, `attach`, `rm`, ...) */
	protected isUnsupportedFunctionCall(nodeId: NodeId): boolean {
		return Fn.call.unsupported.isUnsupportedCall(this.getDataflowGraph(nodeId), this.config.dfg);
	}

	/**
	 * We widen wherever the control flow comes back around, i.e. at the node a back edge leads to.
	 * That is what makes the iteration terminate, and it is the loop head whichever loop the code used:
	 * the condition of a `while`, the binding of a `for`, or the first statement of a `repeat`.
	 */
	protected isWideningPoint(nodeId: NodeId): boolean {
		this.wideningPoints ??= this.findWideningPoints();
		return this.wideningPoints.has(nodeId);
	}

	/** The targets of the back edges of the control flow graph, found with one depth-first search. */
	private findWideningPoints(): ReadonlySet<NodeId> {
		const graph = this.config.controlFlow.graph;
		const heads = new Set<NodeId>();
		const onPath = new Set<NodeId>();
		const done = new Set<NodeId>();

		for(const start of this.startingPoints()) {
			if(done.has(start)) {
				continue;
			}
			const stack: WideningSearchStep[] = [stepFrom(graph, start)];
			onPath.add(start);

			while(stack.length > 0) {
				const step = stack[stack.length - 1];

				if(step.at >= step.successors.length) {
					onPath.delete(step.node);
					done.add(step.node);
					stack.pop();
					continue;
				}
				const next = step.successors[step.at++];

				if(onPath.has(next)) {
					/* the path leads back to a node it already runs through, so this is where the loop closes */
					heads.add(next);
				} else if(!done.has(next)) {
					onPath.add(next);
					stack.push(stepFrom(graph, next));
				}
			}
		}
		return heads;
	}

	/** Everywhere the control flow may start: the program itself, and every function body, as nothing flows into one. */
	private startingPoints(): NodeId[] {
		const graph = this.config.controlFlow.graph;
		const starts = [...this.config.controlFlow.entryPoints];
		/* asking the control flow for all of its vertices copies it out of the dataflow graph, which already has them */
		for(const [id] of this.config.dfg.verticesOfType(VertexType.FunctionDefinition)) {
			starts.push(...graph.childrenOf(id) ?? NoNeighbors);
		}
		return starts;
	}

	/**
	 * Checks whether a control flow graph vertex should be skipped during visitation.
	 * Every node has exactly one vertex, reached once its operands are evaluated, so nothing is skipped
	 * by default; overriding this lets an analysis ignore parts of the program.
	 */
	protected shouldSkipVertex(_vertex: CfgVertex): boolean {
		return false;
	}

	/**
	 * Whether widening should be performed at a widening point.
	 * By default, we perform widening when the number of visits of the widening point reaches the widening threshold of the config.
	 */
	protected shouldWiden(wideningPoint: CfgVertex): boolean {
		return (this.visited.get(CfgVertex.getId(wideningPoint)) ?? 0) >= this.config.ctx.config.abstractInterpretation.wideningThreshold;
	}
}
