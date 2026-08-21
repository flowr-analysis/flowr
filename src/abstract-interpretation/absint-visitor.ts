import { CfgEdge, CfgVertex, type ControlFlowInformation, NoNeighbors, type ReadOnlyControlFlowGraph } from '../control-flow/control-flow-graph';
import { visitCfgInOrder } from '../control-flow/simple-visitor';
import { SemanticCfgGuidedVisitor, type SemanticCfgGuidedVisitorConfiguration, type OnCall } from '../control-flow/semantic-cfg-guided-visitor';
import { BuiltInProcName } from '../dataflow/environments/built-in-proc-name';
import { Dataflow } from '../dataflow/graph/df-helper';
import { FunctionArgument, NoEdges, type DataflowGraph } from '../dataflow/graph/graph';
import { DfEdge, EdgeType } from '../dataflow/graph/edge';
import { type DataflowGraphVertexFunctionCall, type DataflowGraphVertexVariableDefinition, FunctionCallVertex, FunctionDefinitionVertex, VertexType } from '../dataflow/graph/vertex';
import { OriginType } from '../dataflow/origin/dfg-get-origin';
import type { NoInfo, RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NormalizedAst, ParentInformation } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../dataflow/info';
import { guard, isNotUndefined } from '../util/assert';
import { AbstractDomain, type AnyAbstractDomain } from './domains/abstract-domain';
import type { AnyStateDomain, ValueDomain } from './domains/state-domain-like';
import { UnsupportedFunctions } from './unsupported-functions';
import { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import { RPipe } from '../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { RParameter } from '../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
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

/** Whether two rounds of a fixpoint bound the same values, `undefined` standing for nothing known yet. */
function sameValues(a: readonly (AnyAbstractDomain | undefined)[], b: readonly (AnyAbstractDomain | undefined)[] | undefined): boolean {
	return b !== undefined && a.length === b.length
		&& a.every((value, at) => value === undefined ? b[at] === undefined : b[at] !== undefined && value.equals(b[at]));
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
	 * What leads to a vertex, without the call a body was entered from.
	 * {@link AbstractInterpretationVisitor#shouldSkipVertex|shouldSkipVertex()} is asked once per vertex, so
	 * an override of it has to say the same thing every time.
	 */
	private readonly predecessorsOf: Map<NodeId, readonly AbsintPredecessor[]> = new Map();

	/** What the control flow may reach from a vertex, asked only by a read with several definitions. */
	private readonly reachableFrom: Map<NodeId, ReadonlySet<NodeId>> = new Map();

	/**
	 * The state each vertex was left in when it was last visited, so a re-visit can tell whether anything moved.
	 * The trace cannot say that: entering a call seeds it before the parameters and the call are visited.
	 */
	private readonly lastState: Map<NodeId, StateDomain> = new Map();

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
	private readonly returns: Map<NodeId, ValueDomain<StateDomain>> = new Map();

	/** The calls that lead back into a definition still being interpreted, and the definition they reach. */
	private readonly recursiveCalls: Map<NodeId, NodeId> = new Map();


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
		}
		const reached = this.recursiveCalls.get(node.info.id);

		if(reached !== undefined) {
			/* it is worth what the definition it reaches was last seen to leave behind, nothing in round one */
			return this.returns.get(reached) ?? this.currentState.domain.bottom() as ValueDomain<StateDomain>;
		}
		if(state?.has(node.info.id)) {
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
		} else if(origins.includes(BuiltInProcName.Return)) {
			/* leaving with `return(x)` is worth what `x` is worth, which is what a function that does it exits with */
			if(call?.args.length === 1 && call.args[0] !== EmptyArgument) {
				return this.getAbstractValue(call.args[0].nodeId, state);
			}
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

	protected override onVariableDefinition({ vertex }: { vertex: DataflowGraphVertexVariableDefinition; }): void {
		if(!this.trace.has(vertex.id)) {
			this.unassigned.add(vertex.id);
		}
		/*
		 * `bindParameters` hands the arguments over before the function is entered, so a parameter still without
		 * a value is one the call passed nothing for and is worth the default it names. That default runs before
		 * the body, so standing on the parameter is the moment to read it.
		 */
		if(this.currentState.has(vertex.id)) {
			return;
		}
		const declaration = this.getNormalizedAst(this.getNormalizedAst(vertex.id)?.info.parent);

		if(!RParameter.isWithDefault(declaration)) {
			return;
		}
		const value = this.getAbstractValue(declaration.defaultValue, this.currentState);

		if(value !== undefined) {
			this.currentState.set(vertex.id, value);
			this.unassigned.delete(vertex.id);
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
		for(const [id, edge] of this.config.controlFlow.graph.ingoingEdges(vertexId) ?? NoEdges) {
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
	private runFunction(callId: NodeId, def: NodeId, entry: NodeId, outerState: StateDomain): { states: StateDomain[], value: ValueDomain<StateDomain> | undefined } {
		const threshold = this.config.ctx.config.abstractInterpretation.wideningThreshold;
		/* the counts drive the widening within the body, and belong to this call rather than to the program */
		const counts = this.regionVisits(entry);
		let settled: ValueDomain<StateDomain> | undefined = undefined;
		let bound: (ValueDomain<StateDomain> | undefined)[] | undefined = undefined;

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

			const states: StateDomain[] = [];
			const exits: ValueDomain<StateDomain>[] = [];
			let complete = true;

			for(const exit of this.getFunctionExits(def)) {
				const state = this.trace.get(exit);
				if(state === undefined) {
					continue;
				}
				states.push(state);
				const value = this.getAbstractValue(exit, state);
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
			const next: ValueDomain<StateDomain> = settled !== undefined && round >= threshold ? settled.widen(left) : left;
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
	private parameterValues(defId: NodeId): (ValueDomain<StateDomain> | undefined)[] {
		const definition = this.getDataflowGraph(defId);

		if(!FunctionDefinitionVertex.is(definition)) {
			return [];
		}
		return Object.keys(definition.params).map(key => this.currentState.get(NodeId.normalize(key)) as ValueDomain<StateDomain> | undefined);
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
				/* a call that is not the one being entered is read where it stands, not from the state here */
				let value = add === undefined ? this.getAbstractValue(target, this.currentState) : this.getAbstractValue(target);
				const previous = add === undefined ? undefined : this.currentState.get(parameter) as ValueDomain<StateDomain> | undefined;

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
