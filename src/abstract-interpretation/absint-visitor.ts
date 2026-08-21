import { CfgEdge, CfgVertex, type ControlFlowInformation, NoNeighbors, type ReadOnlyControlFlowGraph } from '../control-flow/control-flow-graph';
import { SemanticCfgGuidedVisitor, type SemanticCfgGuidedVisitorConfiguration, type OnCall } from '../control-flow/semantic-cfg-guided-visitor';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { Dataflow } from '../dataflow/graph/df-helper';
import { FunctionArgument, NoEdges, type DataflowGraph } from '../dataflow/graph/graph';
import { DfEdge, EdgeType } from '../dataflow/graph/edge';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexVariableDefinition, FunctionCallVertex, FunctionDefinitionVertex } from '../dataflow/graph/vertex';
import { OriginType } from '../dataflow/origin/dfg-get-origin';
import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../dataflow/info';
import { guard, isNotUndefined } from '../util/assert';
import { AbstractDomain } from './domains/abstract-domain';
import type { AnyStateDomain, ValueDomain } from './domains/state-domain-like';
import { UnsupportedFunctions } from './unsupported-functions';
import { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RPipe } from '../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { RSymbol } from '../r-bridge/lang-4.x/ast/model/nodes/r-symbol';

export type DomainOfVisitor<AbsintVisitor extends AbstractInterpretationVisitor<AnyStateDomain>> =
	AbsintVisitor extends AbstractInterpretationVisitor<infer StateDomain> ? StateDomain : never;

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

/**
 * A control flow graph visitor to perform abstract interpretation.
 *
 * The worklist below stays within the function it starts in: a function definition produces a closure and its
 * body is a region of its own, which nothing flows into.
 *
 * Calls are not followed by default: flip {@link AbstractInterpretationVisitor#shouldEnterCall|shouldEnterCall()} to
 * step into what a call dispatches to and continue with the state at the function's exit points.
 * Condition semantics are not applied by default either, but everything needed for them is there:
 * {@link AbstractInterpretationVisitor#getPredecessorState|getPredecessorState()} is handed the branch that was
 * taken, and {@link BasicCfgGuidedVisitor#getDecidedConstructs|getDecidedConstructs()} names the construct a
 * condition belongs to.
 */
export abstract class AbstractInterpretationVisitor<StateDomain extends AnyStateDomain, Config extends AbsintVisitorConfiguration = AbsintVisitorConfiguration>
	extends SemanticCfgGuidedVisitor<NoInfo, ControlFlowInformation, NormalizedAst, DataflowGraph, Config & { defaultVisitingOrder: 'forward' }> {
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
	 * The nodes a back edge of the control flow graph leads to, computed on demand.
	 * @see {@link AbstractInterpretationVisitor#isWideningPoint|isWideningPoint()}
	 */
	private wideningPoints: ReadonlySet<NodeId> | undefined;

	/**
	 * A set of nodes representing variable definitions that have already been visited but whose assignment has not yet been processed.
	 */
	private readonly unassigned: Set<NodeId> = new Set();

	/** The call a function body is currently being interpreted for, mapping the body's entry to it. */
	private readonly enteredFrom: Map<NodeId, NodeId> = new Map();

	/** The function definitions currently being interpreted, which is what stops a recursive call from running forever. */
	private readonly running: Set<NodeId> = new Set();


	constructor(config: Config, stateDomain: StateDomain) {
		super({ ...config, defaultVisitingOrder: 'forward' });

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
		const call = FunctionCallVertex.is(vertex) ? vertex : undefined;
		const origins = Array.isArray(call?.origin) ? call.origin : [];

		if(RSymbol.is(node)) {
			const values = this.getVariableOrigins(node.info.id)
				.map(origin => (this.getAbstractState(origin)?.isBottom() ? this.currentState.domain.bottom() : state?.get(origin)) as ValueDomain<StateDomain>);

			if(values.length > 0 && values.every(isNotUndefined)) {
				return AbstractDomain.joinAll(values);
			}
		} else if(RArgument.isWithValue(node)) {
			return this.getAbstractValue(node.value, state);
		} else if(RExpressionList.is(node) && node.children.length > 0) {
			return this.getAbstractValue(node.children.at(-1), state);
		} else if(origins.includes(BuiltInProcName.Pipe)) {
			if(RPipe.is(node) || RBinaryOp.is(node)) {
				return this.getAbstractValue(node.rhs, state);
			} else if(call?.args.length === 2 && call?.args[1] !== EmptyArgument) {
				return this.getAbstractValue(call.args[1].nodeId, state);
			}
		} else if(origins.includes(BuiltInProcName.IfThenElse)) {
			let values: (ValueDomain<StateDomain> | undefined)[] = [];

			if(RIfThenElse.is(node) && node.otherwise !== undefined) {
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
		const states = this.config.controlFlow.exitPoints.map(node => this.trace.get(node)).filter(isNotUndefined);

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
			const successors = [...this.config.controlFlow.graph.successors(current)].reverse();

			for(const next of successors) {
				if(!this.stack.includes(next)) {  // prevent double entries in working list
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

	protected override onVariableDefinition({ vertex }: { vertex: DataflowGraphVertexVariableDefinition; }): void {
		if(!this.trace.has(vertex.id)) {
			this.unassigned.add(vertex.id);
		}
	}

	protected override onAssignmentCall({ target, source }: OnCall & { target?: NodeId, source?: NodeId }): void {
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

	protected override onReplacementCall({ target }: OnCall & { target?: NodeId, source?: NodeId }): void {
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
	protected onFunctionCall(_data: OnCall) {}

	/**
	 * Everything the control flow may come from to reach this vertex, together with the branch it took to get here.
	 * Skipped vertices hold no state of their own, so what led into them is reported instead.
	 */
	protected getPredecessors(vertexId: NodeId): readonly AbsintPredecessor[] {
		const result: AbsintPredecessor[] = [];
		for(const [id, edge] of this.config.controlFlow.graph.ingoingEdges(vertexId) ?? NoEdges) {
			const branch = CfgEdge.isControlDependency(edge) ? edge : undefined;
			const vertex = this.getCfgVertex(id);
			if(vertex === undefined) {
				continue;
			} else if(this.shouldSkipVertex(vertex)) {
				/* the branch closest to us is the one that decided we get here at all, so it wins */
				result.push(...this.getPredecessors(id).map(pred => branch ? { ...pred, branch } : pred));
			} else {
				result.push({ id, branch });
			}
		}
		/* a body has no predecessor of its own, so what runs before it is the call we stepped in from */
		const enteredFrom = this.enteredFrom.get(vertexId);
		if(enteredFrom !== undefined) {
			result.push({ id: enteredFrom });
		}
		return result;
	}

	/**
	 * The abstract state one predecessor contributes, joined into the state at the current vertex.
	 *
	 * By default, this is the state as the predecessor left it. Override it to apply condition semantics:
	 * on the then-branch of `if(u) a else b` the predecessor is `u` and `branch.when` is `true`, so `u` held.
	 */
	protected getPredecessorState({ id }: AbsintPredecessor): StateDomain | undefined {
		return this.trace.get(id);
	}

	protected override visitFunctionCall(call: DataflowGraphVertexFunctionCall): void {
		super.visitFunctionCall(call);

		if(this.shouldEnterCall(call)) {
			this.currentState = this.enterCall(call.id) ?? this.currentState;
		}
	}

	/**
	 * Whether the traversal should step into what the given call dispatches to.
	 * Returning `true` runs the bodies and continues with the state at their exit points.
	 */
	protected shouldEnterCall(_call: DataflowGraphVertexFunctionCall): boolean {
		return false;
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
		return FunctionDefinitionVertex.is(def) ? def.subflow.cfgEntry ?? def.subflow.entryPoint : undefined;
	}

	/** Where a function definition is left, i.e. its last expressions and `return` calls. */
	protected getFunctionExits(defId: NodeId): readonly NodeId[] {
		const def = this.getDataflowGraph(defId);
		return FunctionDefinitionVertex.is(def) ? def.exitPoints.map(exit => exit.nodeId) : NoNeighbors;
	}

	/**
	 * Runs the bodies the given call dispatches to, starting from the state at the call, and returns the state
	 * control comes back with: the states at their exit points joined.
	 * A call already being interpreted is not entered again, so recursion stops at the second entry.
	 * @returns the state at the exit points, or `undefined` if the call reaches nothing to step into
	 */
	protected enterCall(callId: NodeId): StateDomain | undefined {
		const states: StateDomain[] = [];
		const values: ValueDomain<StateDomain>[] = [];
		const outerState = this.currentState;

		for(const def of this.getCallTargets(callId)) {
			const entry = this.getFunctionEntry(def);

			if(entry === undefined || this.running.has(def)) {
				continue;
			}
			this.running.add(def);
			this.bindParameters(callId, def);
			/* the entry picks its state up from the call, which is what makes the arguments visible in the body */
			this.trace.set(callId, outerState);
			this.enteredFrom.set(entry, callId);

			const outerStack = this.stack;
			this.startVisitor([entry]);
			this.stack = outerStack;
			this.enteredFrom.delete(entry);
			this.running.delete(def);

			for(const exit of this.getFunctionExits(def)) {
				const state = this.trace.get(exit);
				if(state === undefined) {
					continue;
				}
				states.push(state);
				const value = this.getAbstractValue(exit, state);
				if(value !== undefined) {
					values.push(value);
				}
			}
		}
		this.currentState = outerState;

		if(states.length === 0) {
			return undefined;
		}
		const returned = AbstractDomain.joinAll(states);
		if(values.length > 0) {
			/* what the call is worth is what its function leaves behind at its exits */
			returned.set(callId, AbstractDomain.joinAll(values));
		}
		return returned;
	}

	/**
	 * Hand the arguments of the call to the parameters of the function it enters, so the body can read them.
	 * Only the arguments of this very call are used, whichever other calls the function has.
	 */
	protected bindParameters(callId: NodeId, defId: NodeId): void {
		const call = this.getDataflowGraph(callId);
		const definition = this.getDataflowGraph(defId);

		if(!FunctionCallVertex.is(call) || !FunctionDefinitionVertex.is(definition)) {
			return;
		}
		const args = new Set(call.args.filter(FunctionArgument.isNotEmpty).map(arg => arg.nodeId));
		for(const key of Object.keys(definition.params)) {
			/* object keys are strings, the graph keys its vertices by the id itself */
			const parameter = NodeId.normalize(key);
			for(const [target, edge] of this.config.dfg.outgoingEdges(parameter) ?? NoEdges) {
				if(!DfEdge.includesType(edge, EdgeType.DefinedByOnCall) || !args.has(target)) {
					continue;
				}
				const value = this.getAbstractValue(target, this.currentState);
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
		return Dataflow.origin(this.config.dfg, nodeId)
			?.filter(origin => origin.type === OriginType.ReadVariableOrigin)
			.map(origin => origin.id)
			.filter(origin => this.trace.has(origin) && !this.unassigned.has(origin)) ?? [];
	}

	/** Checks whether a node represents a unsupported (environment-changing) function call (e.g. `eval`, `load`, `attach`, `rm`, ...) */
	protected isUnsupportedFunctionCall(nodeId: NodeId): boolean {
		return UnsupportedFunctions.isUnsupportedCall(this.getDataflowGraph(nodeId), this.config.dfg);
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
		for(const [id] of graph.vertices(false)) {
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
