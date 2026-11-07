import { VariableResolve } from '../../../config';
import type { LinkTo } from '../../../queries/catalog/call-context-query/call-context-query-format';
import type { AstIdMap, ParentInformation, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { VisitingQueue } from '../../../slicing/static/visiting-queue';
import { guard } from '../../../util/assert';
import type { BuiltInIdentifierConstant } from '../../environments/built-in';
import type { IEnvironment, REnvironmentInformation } from '../../environments/environment';
import { Identifier, ReferenceType } from '../../environments/identifier';
import { DfEdge, EdgeType } from '../../graph/edge';
import { RForLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RBreak } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-break';
import { RNext } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-next';
import { ControlDependency } from '../../info';
import type { DataflowGraph } from '../../graph/graph';
import { RParameter } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { onReplacementOperator, type ReplacementOperatorHandlerArgs } from '../../graph/unknown-replacement';
import { onUnknownSideEffect } from '../../graph/unknown-side-effect';
import { type DataflowGraphVertexFunctionCall, DfgVertex, VertexType } from '../../graph/vertex';
import { valueFromRNodeConstant, valueFromTsValue, valueSetGuard } from '../values/general';
import { Bottom, isTop, isValue, type Lift, RValue, Top, type Value, type ValueSet } from '../values/r-value';
import { BuiltInProcName } from '../../environments/built-in-proc-name';
import { RIfThenElse } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { setFrom, setOf } from '../values/sets/set-constants';
import { resolveNode } from './resolve';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { EmptyArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RPipe } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';
import { Resolve } from '../../environments/resolve-helper';
import { NodeValue } from './node-value';
import { Dataflow } from '../../graph/df-helper';
import { ClosureFrames } from '../../graph/closure-frames';

export type ResolveResult = Lift<ValueSet<Value[]>>;

type AliasHandler = (s: NodeId, d: DataflowGraph, e: REnvironmentInformation, def: IEnvironment) => NodeId[] | undefined;
const AliasHandler = {
	[VertexType.Value]:              (sourceId: NodeId) => [sourceId],
	[VertexType.Use]:                getUseAlias,
	[VertexType.FunctionCall]:       getFunctionCallAlias,
	[VertexType.FunctionDefinition]: () => undefined,
	[VertexType.VariableDefinition]: () => undefined
} as const satisfies Record<VertexType, AliasHandler>;

export interface ResolveInfo {
	/** The current environment used for name resolution */
	environment?: REnvironmentInformation;
	/** The id map to resolve the node if given as an id */
	idMap?:       AstIdMap;
	/** The graph to resolve in */
	graph?:       DataflowGraph;
	/** Whether to track variables */
	full?:        boolean;
	/** Variable resolve mode */
	resolve?:     VariableResolve;
	/** Context used for resolving */
	ctx:          ReadOnlyFlowrAnalyzerContext;
	/** If set, the ids that should not be considered during resolution (=&gt; top) */
	blocked?:     Set<NodeId>;
	/** If set, resolves the parameters of the functions it names for one of their calls only, see {@link CallContext} */
	callContext?: CallContext;
	/** The frames of calls the node is resolved in, innermost last, see {@link CallFrame} */
	frames?:      readonly CallFrame[];
	/** The iterations of loops the node is resolved in, innermost last, see {@link LoopIteration} */
	iterations?:  readonly LoopIteration[];
}

/**
 * The `k`-th run of the body of the `for` loop at `loop`, out of a number of runs known in advance. The value walk
 * enters the last one when it follows a read after the loop into the body, and steps back one run whenever a read
 * in the body sees what the body defines only later on, in the run before.
 */
export interface LoopIteration {
	readonly loop: NodeId
	readonly k:    number
}

/**
 * A frame a run of the function `fn` makes when `call` calls it: a parameter of `fn` read in that frame holds what
 * `call` hands it. The value walk enters one when it follows a call into the function it returns from, and leaves
 * it again when it follows a parameter to its argument.
 */
export interface CallFrame {
	readonly fn:   NodeId
	readonly call: NodeId
}

/**
 * The call each of some functions is resolved for, keyed by the id of the function definition: a parameter of such a
 * function holds only what that call hands it, or its default when the call hands it nothing. Without one, a
 * parameter holds what any call of its function may hand it, which is what a value in the function body has to
 * expect. With one, `save <- function(n) write.csv(d, n)` writes `"a.csv"` for `save("a.csv")` and nothing else.
 */
export type CallContext = ReadonlyMap<NodeId, NodeId>;

/** the call the context resolves the function of the parameter named by `id` for, if `id` names a parameter at all */
function contextCallOf(id: NodeId, idMap: AstIdMap, callContext: CallContext | undefined): NodeId | undefined {
	if(callContext === undefined) {
		return undefined;
	}
	const node = idMap.get(id);
	const parameter = node?.info.role === RoleInParent.ParameterName && node.info.parent !== undefined ? idMap.get(node.info.parent) : undefined;
	return parameter?.info.parent === undefined ? undefined : callContext.get(parameter.info.parent);
}

/**
 * The call an argument value is handed to: the closest call around it, or the call a pipe feeds it into.
 * @example
 * ```ts
 * // f(g(1)) |> h()
 * callOfArgument(idOfGCall, idMap); // the id of `f(...)`
 * callOfArgument(idOfFCall, idMap); // the id of `h()`
 * ```
 */
export function callOfArgument(value: NodeId, idMap: AstIdMap): NodeId | undefined {
	for(const parent of RNode.iterateParents(idMap.get(value), idMap)) {
		if(RFunctionCall.is(parent)) {
			return parent.info.id;
		} else if(RPipe.is(parent)) {
			return parent.rhs.info.id;
		}
	}
	return undefined;
}

/**
 * Whether the walk may follow `edge` from the parameter `id` of a function the context resolves for `call`: an argument
 * only if that call hands it, the default only if that call hands none.
 */
function followsInCall(edges: ReadonlyMap<NodeId, DfEdge>, target: NodeId, edge: DfEdge, call: NodeId, idMap: AstIdMap): boolean {
	const handed = (t: NodeId, e: DfEdge) => DfEdge.isOnlyType(e, EdgeType.DefinedByOnCall) && callOfArgument(t, idMap) === call;
	if(DfEdge.isOnlyType(edge, EdgeType.DefinedByOnCall)) {
		return handed(target, edge);
	}
	return !DfEdge.isOnlyType(edge, EdgeType.DefinedBy) || !edges.entries().some(([t, e]) => handed(t, e));
}

function environmentNameOf(sourceId: NodeId, idMap: AstIdMap | undefined): Identifier | undefined {
	const node = idMap?.get(sourceId);
	return RSymbol.is(node) ? node.content : node?.lexeme;
}

function getFunctionCallAlias(sourceId: NodeId, dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	const vertex = dataflow.getVertex(sourceId);
	/* the lexeme of an infix call like `a %% b` is the whole expression, so we prefer the effective name of the vertex */
	const identifier = DfgVertex.isFunctionCall(vertex) ? vertex.name : environmentNameOf(sourceId, dataflow.idMap);
	if(identifier === undefined) {
		return undefined;
	}

	const defs = Resolve.byNameAndType(identifier, environment, ReferenceType.Function);
	if(defs?.length !== 1) {
		return undefined;
	}

	return [sourceId];
}

function getUseAlias(sourceId: NodeId, dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	const definitions: NodeId[] = [];

	// Source is Symbol -> resolve definitions of symbol
	const identifier = environmentNameOf(sourceId, dataflow.idMap);
	if(identifier === undefined) {
		return undefined;
	}

	const defs = Resolve.byName(identifier, environment);
	if(defs === undefined) {
		return undefined;
	}

	for(const def of defs) {
		// If one definition is not constant (or a variable aliasing a constant)
		// we can't say for sure what value the source has
		if(def.type === ReferenceType.Variable) {
			if(def.value === undefined) {
				return undefined;
			}
			definitions.push(...def.value);
		} else if(def.type === ReferenceType.Constant || def.type === ReferenceType.BuiltInConstant) {
			definitions.push(def.nodeId);
		} else {
			return undefined;
		}
	}

	return definitions;
}

/**
 * Gets the definitions / aliases of a node
 *
 * This function is called by the built-in-assignment processor so that we can
 * track assignments inside the environment. The returned ids are stored in
 * the sourceIds value field of their InGraphIdentifierDefinition. This enables
 * us later, in the {@link trackAliasInEnvironments} function, to get all the
 * aliases of an identifier.
 * @param sourceIds   - node ids to get the definitions for
 * @param dataflow    - dataflow graph
 * @param environment - environment
 * @returns           node id of alias
 */
export function getAliases(sourceIds: readonly NodeId[], dataflow: DataflowGraph, environment: REnvironmentInformation): NodeId[] | undefined {
	const definitions: Set<NodeId> = new Set<NodeId>();

	for(const sourceId of sourceIds) {
		const info = dataflow.getVertex(sourceId);
		if(info === undefined) {
			return undefined;
		} else if(DfgVertex.isFunctionDefinition(info)) {
			definitions.add(sourceId);
			continue;
		}

		const defs = AliasHandler[info.tag](sourceId, dataflow, environment);
		for(const def of defs ?? []) {
			definitions.add(def);
		}
	}

	return Array.from(definitions);
}

/**
 * Evaluates the value of a node in the set domain.
 *
 * resolveIdToValue tries to resolve the value using the data it has been given.
 * If the environment is provided the approximation is more precise, as we can
 * track aliases in the environment.
 * Otherwise, the graph is used to try and resolve the nodes value.
 * If neither is provided the value cannot be resolved.
 *
 * This function is also used by the Resolve Value Query and the Dependency Query
 * to resolve values. For e.g. in the Dependency Query it is used to resolve calls
 * like `lapply(c("a", "b", "c"), library, character.only = TRUE)`
 * @param  id          - The node id or node to resolve
 * @param  environment - The current environment used for name resolution
 * @param  graph       - The graph to resolve in
 * @param  idMap       - The id map to resolve the node if given as an id
 * @param  full        - Whether to track aliases on resolve
 * @param  resolve     - Variable resolve mode
 * @param  ctx         - Context used for clean environment
 * @param  blocked     - If set, the ids that should not be considered during resolution (=&gt;top)
 * @useInstead {@link Resolve.toValue}
 */
export function resolveIdToValue(id: NodeId | RNodeWithParent | undefined, { environment, graph, idMap, full = true, ctx, resolve = ctx.config.solver.variables, blocked, callContext, frames, iterations }: ResolveInfo): ResolveResult {
	blocked ??= new Set<NodeId>();

	if(id === undefined) {
		return Top;
	}

	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);
	/* the same node in another run of a loop is another value */
	const key = iterations === undefined || iterations.length === 0 ? node?.info.id : `${node?.info.id}@${iterations.map(i => `${i.loop}:${i.k}`).join('/')}` as NodeId;
	if(node === undefined || key === undefined || blocked.has(key)) {
		return Top;
	}
	blocked.add(key);

	switch(node.type) {
		case RType.Argument:
			/* a missing argument (`f(x=)`) carries no value, and it is no symbol to resolve either */
			return node.value ? resolveIdToValue(node.value.info.id, { environment, graph, idMap, full, resolve, ctx, blocked, callContext, frames, iterations }) : Top;
		case RType.Symbol:
			if(full) {
				if(environment) {
					return trackAliasInEnvironments(Identifier.toString((node as RSymbol).content), environment, { idMap, resolve, ctx, graph, blocked, callContext });
				} else if(graph && resolve === VariableResolve.Alias) {
					return trackAliasesInGraph(node.info.id, graph, ctx, idMap, blocked, callContext, frames, iterations);
				}
			}
			return Top;
		case RType.FunctionDefinition:
			return setFrom({ type: 'function-definition' });
		case RType.FunctionCall:
		case RType.BinaryOp:
		case RType.UnaryOp:
		case RType.ExpressionList:
		case RType.Access:
			return setFrom(resolveNode({
				resolve, node, ctx, environment, graph, idMap, blocked, callContext, frames, iterations
			}));
		case RType.String:
		case RType.Number:
		case RType.Logical:
			return setFrom(valueFromRNodeConstant(node));
		default:
			return Top;
	}
}

/**
 * Resolves an id to a single constant string value, or `undefined` if it is not a unique string constant.
 * @useInstead {@link Resolve.toSingleString}
 */
export function resolveIdToSingleString(id: NodeId | RNodeWithParent | undefined, info: ResolveInfo): string | undefined {
	const element = NodeValue.sole(valueSetGuard(resolveIdToValue(id, info)), 'string');
	return element !== undefined && isValue(element.value) ? element.value.str : undefined;
}

/** the values one element of a sequence may take: a vector contributes its elements, a set what its members do */
function iteratedElements(value: Value): readonly Value[] {
	if(value.type === 'vector' && isValue(value.elements)) {
		return value.elements.flatMap(iteratedElements);
	} else if(value.type === 'set' && isValue(value.elements)) {
		return value.elements.flatMap(iteratedElements);
	}
	return [value];
}

/**
 * Please use {@link resolveIdToValue}
 *
 * Uses the aliases that were tracked in the environments (by the
 * {@link getAliases} function) to resolve a node to a value.
 * The third argument is the {@link ResolveInfo} (ctx, idMap, ...) minus the environment, which is passed on its own.
 * @param identifier  - Identifier to resolve
 * @param environment - Environment to use
 * @returns           Value of Identifier or Top
 */
export function trackAliasInEnvironments(identifier: Identifier | undefined, environment: REnvironmentInformation, { blocked, idMap, resolve = VariableResolve.Alias, ctx, graph, callContext }: Omit<ResolveInfo, 'environment'>): ResolveResult {
	if(identifier === undefined) {
		return Top;
	}

	const defs = Resolve.byName(identifier, environment);

	if(defs === undefined) {
		return Top;
	}

	const values: Set<Value> = new Set<Value>();
	for(const def of defs) {
		if(def.type === ReferenceType.BuiltInConstant) {
			values.add(valueFromTsValue(def.value));
		} else if(def.type === ReferenceType.BuiltInFunction) {
			// Tracked in #1207
		} else if(def.value === undefined && graph !== undefined && !NodeId.isBuiltIn(def.nodeId)) {
			const value = trackAliasesInGraph(def.nodeId, graph, ctx, idMap, blocked, callContext);
			if(isTop(value)) {
				return Top;
			}
			values.add(value);
		} else if(def.value !== undefined) {
			/* if there is at least one location for which we have no idea, we have to give up for now! */
			if(def.value.length === 0) {
				return Top;
			}

			for(const alias of def.value) {
				const definitionOfAlias = idMap?.get(alias);
				if(definitionOfAlias !== undefined) {
					/* the environment attempt below marks what it visited as blocked, so the retry starts from a copy */
					const beforeAttempt = blocked === undefined ? undefined : new Set(blocked);
					let value = resolveNode({ resolve, node: definitionOfAlias, ctx, environment, graph, idMap, blocked, callContext });
					if(isTop(value) && graph?.unknownSideEffects.size === 0) {
						/* `x <- x + 1`: the environment holds only the definition we are resolving, so its own operand
						 * finds nothing there, while the graph still knows which definition that operand reads. Only
						 * when nothing unknown happened, as then the environment is right to give up */
						value = resolveNode({ resolve, node: definitionOfAlias, ctx, graph, idMap, blocked: beforeAttempt, callContext });
					}
					if(isTop(value)) {
						return Top;
					}

					/* the sequence is what it runs over, so what the name holds is one of its elements */
					if(def.iterated) {
						iteratedElements(value).forEach(e => values.add(e));
					} else {
						values.add(value);
					}
				}
			}
		}
	}

	if(values.size === 0) {
		return Top;
	}

	return setOf([...values]);
}

/** given an unknown alias, we have to clear all values in the environments */
onUnknownSideEffect((_graph: DataflowGraph, env: REnvironmentInformation, _id: NodeId, target?: LinkTo<RegExp | string>) => {
	if(target) {
		return;
	}

	let current = env.current;
	while(current) {
		current.memory.forEach(mem => mem.forEach((def) => {
			if(def.type !== ReferenceType.BuiltInConstant
				&& def.type !== ReferenceType.BuiltInFunction
				&& def.value !== undefined) {
				def.value.length = 0;
			}
		}));

		current = current.parent;
	}
});

onReplacementOperator((args: ReplacementOperatorHandlerArgs) => {
	if(!args.target) {
		return;
	}

	let current = args.env.current;
	while(current) {
		const defs = current.memory.get(args.target);
		defs?.forEach(def  => {
			if(def.type !== ReferenceType.BuiltInConstant
				&& def.type !== ReferenceType.BuiltInFunction
				&& def.value !== undefined) {
				def.value.length = 0;
			}
		});

		current = current.parent;
	}
});

function parameterDefaultState(node: RNodeWithParent | undefined, idMap: AstIdMap, graph: DataflowGraph): 'applies' | 'overridden' | 'unknown' {
	const parameter = node === undefined ? undefined
		: [node, ...RNode.iterateParents(node, idMap)].find(p => p.info.role === RoleInParent.ParameterDefaultValue)?.info.parent;
	const bound = parameter === undefined ? undefined : idMap.get(parameter);
	if(!RParameter.is(bound) || bound.info.parent === undefined) {
		return 'applies';
	}
	const calls = Dataflow.sourcesOf(graph, bound.info.parent, EdgeType.Calls).length;
	return calls === 0 ? 'unknown' : Dataflow.targetsOf(graph, bound.name.info.id, EdgeType.DefinedByOnCall).length >= calls ? 'overridden' : 'applies';
}

/**
 * The sequence a use of a `for` loop's variable runs over, `undefined` when `id` is no such use. Every
 * definition it reads has to be that variable: once anything else writes the name (`i <- i + 1` in the body),
 * the sequence no longer states what the name holds.
 */
function iteratedSequence(id: NodeId, graph: DataflowGraph, idMap: AstIdMap): RNodeWithParent | undefined {
	let sequence: RNodeWithParent | undefined;
	for(const [target, edge] of graph.edgesFrom(id)) {
		if(!DfEdge.includesType(edge, EdgeType.Reads)) {
			continue;
		}
		const definition = idMap.get(target);
		const loop = definition?.info.parent === undefined ? undefined : idMap.get(definition.info.parent);
		if(!RForLoop.is(loop) || loop.variable.info.id !== definition?.info.id
			|| (sequence !== undefined && sequence.info.id !== loop.vector.info.id)) {
			return undefined;
		}
		sequence = loop.vector;
	}
	return sequence;
}

/** How many runs of a loop the value walk tells apart at most. */
const MaxUnrolledRuns = 16;

/** The processors that evaluate what they are given in the frame they are called in. */
const SameFrameProcessors: readonly BuiltInProcName[] = [BuiltInProcName.ExpressionList, BuiltInProcName.Assignment, BuiltInProcName.IfThenElse, BuiltInProcName.ForLoop];

/** Where a node runs relative to another one in the same run of a loop body, see {@link LoopRuns#along}. */
const enum RunOrder {
	Before,
	After,
	Unknown
}

/**
 * The runs of the `for` loops a value walk passes, see {@link LoopIteration}: a loop over a sequence known in advance,
 * whose runs no `break` or `next` cuts short, runs its body once per element, so a definition the body surely makes
 * is what a read after the loop sees from the last run, and what a read in the body sees from the run before.
 */
class LoopRuns {
	private readonly graph: DataflowGraph;
	private readonly idMap: AstIdMap;
	private readonly info:  ResolveInfo;
	private sequences:      Map<NodeId, readonly Value[] | undefined> | undefined;

	constructor(graph: DataflowGraph, idMap: AstIdMap, info: ResolveInfo) {
		this.graph = graph;
		this.idMap = idMap;
		this.info = info;
	}

	/** The loop whose variable the definition is. */
	loopOfVariable(id: NodeId): NodeId | undefined {
		const parent = this.idMap.get(this.idMap.get(id)?.info.parent ?? -1);
		return RForLoop.is(parent) && parent.variable.info.id === id ? parent.info.id : undefined;
	}

	/** The elements the variable of the loop may hold. */
	elementsOf(loop: NodeId): readonly Value[] | undefined {
		const node = this.idMap.get(loop);
		const value = RForLoop.is(node) ? resolveIdToValue(node.vector.info.id, { ...this.info, blocked: new Set(this.info.blocked) }) : Top;
		return isTop(value) ? undefined : iteratedElements(value);
	}

	/** The element the variable of the loop holds in its `k`-th run. */
	elementAt(loop: NodeId, k: number): Value | undefined {
		return this.runsOf(loop)?.[k - 1];
	}

	/** The element of each run, if the loop surely runs through all of them. */
	private runsOf(loop: NodeId): readonly Value[] | undefined {
		this.sequences ??= new Map();
		if(this.sequences.has(loop)) {
			return this.sequences.get(loop);
		}
		const node = this.idMap.get(loop);
		let runs: readonly Value[] | undefined;
		if(RForLoop.is(node) && !this.cutShort(node.body)) {
			const values = valueSetGuard(resolveIdToValue(node.vector.info.id, { ...this.info, blocked: new Set(this.info.blocked) }))?.elements;
			const sequence = values?.length === 1 ? values[0] : undefined;
			runs = sequence?.type === 'vector' && isValue(sequence.elements) && sequence.elements.length <= MaxUnrolledRuns ? iteratedElements(sequence) : undefined;
		}
		this.sequences.set(loop, runs);
		return runs;
	}

	/** Whether a `break` or `next` may end a run of the body early. */
	private cutShort(body: RNodeWithParent): boolean {
		let found = false;
		RNode.visitAst(body, node => {
			found ||= RBreak.is(node) || RNext.is(node);
			return found || RFunctionDefinition.is(node);
		});
		return found;
	}

	/** The loop body the node is in, as the statement of the body that holds it. */
	private statementIn(id: NodeId, loop: NodeId): RNodeWithParent | undefined {
		const body = (this.idMap.get(loop) as RForLoop<ParentInformation> | undefined)?.body;
		for(const node of [this.idMap.get(id), ...RNode.iterateParents(this.idMap.get(id), this.idMap)]) {
			if(node === undefined || RFunctionDefinition.is(node)) {
				return undefined;
			} else if(node.info.parent === body?.info.id) {
				return node;
			}
		}
		return undefined;
	}

	/** The loops the node is in the body of, within its function, innermost first. */
	private loopsAround(id: NodeId): NodeId[] {
		const loops: NodeId[] = [];
		let child = this.idMap.get(id);
		for(const node of RNode.iterateParents(child, this.idMap)) {
			if(RFunctionDefinition.is(node)) {
				break;
			} else if(RForLoop.is(node) && node.body.info.id === child?.info.id) {
				loops.push(node.info.id);
			}
			child = node;
		}
		return loops;
	}

	/** The last run of the loop, if the node runs only once the loop is done. */
	lastRunBefore(id: NodeId, loop: NodeId): LoopIteration | undefined {
		const runs = this.after(id, loop) ? this.runsOf(loop)?.length ?? 0 : 0;
		return runs > 0 ? { loop, k: runs } : undefined;
	}

	/** Whether the node runs only once the loop is done: after it in a block of the same function. */
	private after(id: NodeId, loop: NodeId): boolean {
		const node = this.idMap.get(id);
		if(node === undefined || RNode.findEnclosing(id, this.idMap, RFunctionDefinition.is) !== RNode.findEnclosing(loop, this.idMap, RFunctionDefinition.is)) {
			return false;
		}
		/* the child on the way down to the node, for each of its ancestors */
		const towards = new Map<NodeId, RNodeWithParent>();
		let child: RNodeWithParent = node;
		for(const parent of RNode.iterateParents(node, this.idMap)) {
			towards.set(parent.info.id, child);
			child = parent;
		}
		let loopChild = this.idMap.get(loop);
		for(const parent of RNode.iterateParents(loopChild, this.idMap)) {
			const other = towards.get(parent.info.id);
			if(other !== undefined) {
				return RExpressionList.is(parent) && loopChild !== undefined && other.info.index > loopChild.info.index;
			}
			loopChild = parent;
		}
		return false;
	}

	/** Whether the body of the loop surely makes the node in every run, where it stands under no other condition. */
	private surelyIn(id: NodeId, loop: NodeId): boolean {
		const own = this.graph.getVertex(loop)?.cds ?? [];
		return ControlDependency.minus(this.graph.getVertex(id)?.cds ?? [], own).every(cd => cd.id === loop) && this.inLoopFrame(id, loop);
	}

	/** Whether the node binds in the environment the loop runs in, rather than one a call in the body makes per run (`local`). */
	private inLoopFrame(id: NodeId, loop: NodeId): boolean {
		for(const node of RNode.iterateParents(this.idMap.get(id), this.idMap)) {
			if(node.info.id === loop) {
				return true;
			}
			const vertex = this.graph.getVertex(node.info.id);
			if(DfgVertex.isFunctionCall(vertex) && !SameFrameProcessors.some(p => DfgVertex.hasOrigin(vertex, p))) {
				return false;
			}
		}
		return false;
	}

	/** Whether `to` runs before or after `from` in a run of the loop: by the statements holding them, or as the value an assignment defines its target by. */
	private order(to: NodeId, from: NodeId, loop: NodeId): RunOrder {
		const [a, b] = [this.statementIn(to, loop), this.statementIn(from, loop)];
		if(a === undefined || b === undefined) {
			return RunOrder.Unknown;
		} else if(a !== b) {
			return a.info.index < b.info.index ? RunOrder.Before : RunOrder.After;
		}
		const assigns = (target: NodeId, value: NodeId) => {
			const assignment = this.idMap.get(this.idMap.get(target)?.info.parent ?? -1);
			return DfgVertex.isVariableDefinition(this.graph.getVertex(target)) && DfgVertex.hasOrigin(this.graph.getVertex(assignment?.info.id ?? -1), BuiltInProcName.Assignment)
				&& RNode.iterateParents(this.idMap.get(value), this.idMap).some(p => p.info.id === assignment?.info.id);
		};
		return assigns(to, from) ? RunOrder.After : assigns(from, to) ? RunOrder.Before : RunOrder.Unknown;
	}

	/**
	 * The runs the walk is in once it follows the edge from `from` to `to`, `undefined` if no run lets it: a read in the
	 * first run cannot see what its body only defines later on, nor a read in a later run what came before the loop
	 * if the body surely redefines it in the run before.
	 */
	along(from: NodeId, to: NodeId, edges: ReadonlyMap<NodeId, DfEdge>, iterations: readonly LoopIteration[]): readonly LoopIteration[] | undefined {
		const top = iterations.at(-1);
		if(top === undefined) {
			/* a read after the loop sees its last run, be it a definition of the body or the variable of the loop */
			const vertex = this.graph.getVertex(to);
			const variableOf = DfgVertex.isVariableDefinition(vertex) ? this.loopOfVariable(to) : undefined;
			if(variableOf === undefined && vertex?.cds?.some(cd => RForLoop.is(this.idMap.get(cd.id))) !== true) {
				/* the body of a loop runs under the loop as its condition, so a node without one is in none */
				return iterations;
			}
			const loop = this.loopsAround(to)[0] ?? variableOf;
			if(loop === undefined || !this.after(from, loop)) {
				return iterations;
			}
			const runs = this.runsOf(loop)?.length ?? 0;
			return runs > 0 && (variableOf === loop || this.surelyIn(to, loop)) ? [{ loop, k: runs }] : iterations;
		}
		const fromInRun = this.loopsAround(from).includes(top.loop);
		const around = this.loopsAround(to);
		if(fromInRun && this.loopOfVariable(to) === top.loop) {
			return iterations;
		} else if(around.includes(top.loop)) {
			const order = fromInRun ? this.order(to, from, top.loop) : RunOrder.Unknown;
			if(order === RunOrder.Before) {
				return iterations;
			} else if(order === RunOrder.After) {
				if(top.k === 1) {
					return undefined;
				}
				return this.surelyIn(to, top.loop) ? [...iterations.slice(0, -1), { loop: top.loop, k: top.k - 1 }] : iterations.slice(0, -1);
			}
			return [];
		}
		const redefined = top.k > 1 && fromInRun && [...edges].some(([t, e]) => DfEdge.includesType(e, EdgeType.Reads)
			&& this.loopsAround(t).includes(top.loop) && this.order(t, from, top.loop) === RunOrder.After && this.surelyIn(t, top.loop));
		return redefined ? undefined : iterations.filter(i => around.includes(i.loop));
	}
}

/** whether the call may run a built-in as well as a definition of the program, so that what it yields is open */
function callsBuiltInAndDefinition(edges: ReadonlyMap<NodeId, DfEdge>): boolean {
	let builtIn = false;
	let defined = false;
	for(const [target, edge] of edges) {
		if(DfEdge.includesType(edge, EdgeType.Calls)) {
			builtIn ||= NodeId.isBuiltIn(target);
			defined ||= !NodeId.isBuiltIn(target);
		}
	}
	return builtIn && defined;
}

/** The frames and runs the walk is in at a node, see {@link CallFrame} and {@link LoopIteration}. */
type WalkContext = readonly [frames: readonly CallFrame[], iterations: readonly LoopIteration[]];
const NoWalkContext: WalkContext = [[], []];

/** How many frames of calls the walk keeps apart before it no longer tells them apart. */
const MaxFrames = 8;
/** The edges a value flows along from a use or definition to where it comes from. */
const ValueFlowEdges = EdgeType.Reads | EdgeType.DefinedBy | EdgeType.DefinedByOnCall;
/** The edges the value of a definition flows along to where it comes from. */
const DefinitionValueFlowEdges = EdgeType.DefinedBy | EdgeType.DefinedByOnCall;

function isParameterOf(id: NodeId, fn: NodeId, idMap: AstIdMap): boolean {
	const node = idMap.get(id);
	return node?.info.role === RoleInParent.ParameterName && node.info.parent !== undefined && idMap.get(node.info.parent)?.info.parent === fn;
}

/**
 * Whether the walk stays in the frame of `fn` when it moves to `target`: a node of the body of `fn` itself, whose
 * definitions a run of `fn` makes in its own frame, unless they go elsewhere (`<<-`, `assign`).
 */
function inSameFrame(target: NodeId, fn: NodeId, graph: DataflowGraph, idMap: AstIdMap): boolean {
	if(RNode.strictlyEnclosingFunction(target, idMap) !== fn) {
		return false;
	} else if(!DfgVertex.isVariableDefinition(graph.getVertex(target))) {
		return true;
	}
	const parent = idMap.get(target)?.info.parent;
	return isParameterOf(target, fn, idMap) || (parent !== undefined && DfgVertex.hasOrigin(graph.getVertex(parent), BuiltInProcName.Assignment));
}

/**
 * The frames the walk is in once it follows the `Returns` edge of `call` to `target`: a new frame of the function
 * called, the same frame for what the call hands back of its own arguments, and none it knows otherwise.
 * A function already in a frame is called recursively, and its frames are no longer told apart.
 */
function framesIntoReturn(call: NodeId, target: NodeId, edges: ReadonlyMap<NodeId, DfEdge>, frames: readonly CallFrame[], idMap: AstIdMap): readonly CallFrame[] {
	if(!edges.entries().some(([t, e]) => !NodeId.isBuiltIn(t) && DfEdge.includesType(e, EdgeType.Calls))) {
		/* a built-in hands back what it was given in the frame it was called in */
		return frames;
	}
	const fn = RNode.strictlyEnclosingFunction(target, idMap);
	if(fn !== undefined && edges.get(fn) !== undefined && DfEdge.includesType(edges.get(fn) as DfEdge, EdgeType.Calls)) {
		return frames.length >= MaxFrames || frames.some(f => f.fn === fn) ? [] : [...frames, { fn, call }];
	}
	return fn === RNode.strictlyEnclosingFunction(call, idMap) ? frames : [];
}

/**
 * What the call binds a free variable of the function it calls to, if it binds any of the definitions the variable
 * is linked to on calls (`DefinedByOnCall`): read in the frame of that call, the variable sees those and none of
 * the ones other calls bind, such as the call creating the closure (`g <- f(); x <- 2; g()` reads `x` of `g()`).
 */
function boundByCall(id: NodeId, call: NodeId, edges: ReadonlyMap<NodeId, DfEdge>, graph: DataflowGraph): ReadonlySet<NodeId> | undefined {
	let bound: Set<NodeId> | undefined;
	for(const [target, edge] of edges) {
		if(DfEdge.isOnlyType(edge, EdgeType.DefinedByOnCall) && Dataflow.hasEdge(graph, call, target, EdgeType.DefinesOnCall)) {
			(bound ??= new Set()).add(target);
		}
	}
	return id === call ? undefined : bound;
}

/** The argument `switch` picks for a selector value, `null` if it picks none (and hands back `NULL`) or fails. */
function switchPick(args: readonly (RArgument<ParentInformation> | typeof EmptyArgument)[], value: Value): NodeId | null | undefined {
	if(value.type === 'vector') {
		return isValue(value.elements) && value.elements.length === 1 ? switchPick(args, value.elements[0]) : undefined;
	}
	const alternatives = args.slice(1);
	const str = value.type === 'string' ? RValue.stringOf(value) : undefined;
	const filled = (a: RArgument<ParentInformation> | typeof EmptyArgument | undefined): a is RArgument<ParentInformation> => a !== undefined && a !== EmptyArgument && a.value !== undefined;
	if(str !== undefined) {
		/* a named alternative without a value falls through to the next one that has one */
		const at = alternatives.findIndex(a => a !== EmptyArgument && a.name !== undefined && Identifier.getName(a.name.content) === str);
		const picked = at < 0 ? undefined : alternatives.slice(at).find(filled);
		if(at >= 0) {
			return picked?.info.id ?? null;
		}
		const defaults = alternatives.filter(a => a !== EmptyArgument && a.name === undefined);
		return defaults.length === 1 && filled(defaults[0]) ? defaults[0].info.id : null;
	}
	const num = value.type === 'logical' ? undefined : RValue.numberOf(value);
	if(num === undefined || !Number.isFinite(num)) {
		return undefined;
	}
	const picked = alternatives[Math.trunc(num) - 1];
	return filled(picked) ? picked.info.id : null;
}

/**
 * The argument a call choosing one of its arguments by a value (`if`, `switch`) hands back, if that value is
 * known: `undefined` if it may hand back any of them, `null` if it hands back none (`NULL`) or fails.
 */
function chosenArguments(id: NodeId, vertex: DataflowGraphVertexFunctionCall, info: ResolveInfo): ReadonlySet<NodeId> | null | undefined {
	const isIf = DfgVertex.hasOrigin(vertex, BuiltInProcName.IfThenElse);
	if(!isIf && !DfgVertex.hasOrigin(vertex, BuiltInProcName.Switch)) {
		return undefined;
	}
	info = { ...info, blocked: new Set(info.blocked) };
	const node = info.idMap?.get(id);
	const selector = RIfThenElse.is(node) ? node.condition : RFunctionCall.is(node) && node.arguments[0] !== EmptyArgument ? node.arguments[0]?.value : undefined;
	if(selector === undefined) {
		return undefined;
	}
	const values = valueSetGuard(resolveIdToValue(selector.info.id, info))?.elements;
	if(values === undefined || values.length === 0) {
		return undefined;
	}
	const picks = new Set(values.map(v => {
		if(RIfThenElse.is(node)) {
			const truth = RValue.truthOf(v);
			return truth === undefined ? undefined : truth ? node.then.info.id : node.otherwise?.info.id ?? null;
		}
		return RFunctionCall.is(node) ? switchPick(node.arguments, v) : undefined;
	}));
	if(picks.has(null)) {
		return null;
	}
	return picks.has(undefined) ? undefined : picks as ReadonlySet<NodeId>;
}

/**
 * Please use {@link resolveIdToValue}
 *
 * Tries to resolve the value of a node by traversing the dataflow graph
 * @param id      - node to resolve
 * @param ctx     - analysis context
 * @param graph   - dataflow graph
 * @param idMap   - idmap of dataflow graph
 * @param blocked - the ids already being resolved, so a cyclic definition stops
 * @param callContext - the calls to resolve parameters for, see {@link CallContext}
 * @returns       Value of node or Top/Bottom
 */
export function trackAliasesInGraph(id: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, idMap?: AstIdMap, blocked?: Set<NodeId>, callContext?: CallContext, frames: readonly CallFrame[] = [], iterations: readonly LoopIteration[] = []): ResolveResult {
	if(!graph.get(id)) {
		return Bottom;
	}

	idMap ??= graph.idMap;
	guard(idMap !== undefined, 'The ID map is required to get the lineage of a node');

	const loops = new LoopRuns(graph, idMap, { graph, idMap, ctx, callContext, frames, blocked });
	/* a loop makes the walk below give up, yet the variable of a `for` is precisely its sequence, elementwise */
	const sequence = iteratedSequence(id, graph, idMap);
	if(sequence !== undefined) {
		const loop = sequence.info.parent;
		const run = iterations.find(i => i.loop === loop) ?? (loop === undefined ? undefined : loops.lastRunBefore(id, loop));
		const element = run === undefined || loop === undefined ? undefined : loops.elementAt(loop, run.k);
		if(element !== undefined) {
			return setOf([element]);
		}
		const value = resolveIdToValue(sequence.info.id, { graph, idMap, ctx, blocked, callContext, frames });
		return isTop(value) ? Top : setOf(iteratedElements(value));
	}

	const queue = new VisitingQueue(10);
	const clean = ctx.env.makeCleanEnv();
	const cleanFingerprint = ctx.env.getCleanEnvFingerprint();
	/* the frames and runs each fingerprint stands for, so the same node is walked once per frame and run it is reached in */
	const contextOf = new Map<string, WalkContext>();
	const enqueue = (target: NodeId, at: readonly CallFrame[], runs: readonly LoopIteration[]) => {
		if(at.length === 0 && runs.length === 0) {
			queue.add(target, clean, cleanFingerprint, false);
			return;
		}
		const key = `${cleanFingerprint}|${at.map(f => `${f.fn}@${f.call}`).join('/')}|${runs.map(i => `${i.loop}:${i.k}`).join('/')}`;
		contextOf.set(key, [at, runs]);
		queue.add(target, clean, key, false);
	};
	enqueue(id, frames, iterations);

	const resultIds: NodeId[] = [];
	/* what a read in a closure frame knows is replaced stays so for the writes it leads to */
	const replaced = new Set<NodeId>();
	/* what a call the walk ended in folds to, see below */
	const folded: Value[] = [];
	while(queue.nonEmpty()) {
		const { id, envFingerprint } = queue.next();
		const [frames, iterations] = envFingerprint === cleanFingerprint ? NoWalkContext : contextOf.get(envFingerprint) ?? NoWalkContext;
		const vertex = graph.getVertex(id);
		if(!vertex) {
			continue;
		}
		/* a definition in a loop may hold the value of any iteration, and the walk collects all of them; one that
		 * depends on its own earlier value, like `x <- x + 1`, reaches itself again, is blocked, and stays unknown */
		const t = vertex.tag;
		/* a replacement (`df[1] <- v`) defines its target from just a part of it, so what it is defined by is not
		 * the value of the target */
		if(t === VertexType.VariableDefinition && idMap.get(id)?.info.role === RoleInParent.Accessed) {
			return Top;
		}
		if(t === VertexType.Value || t === VertexType.FunctionDefinition) {
			resultIds.push(id);
			continue;
		}
		const variableOf = t === VertexType.VariableDefinition ? loops.loopOfVariable(id) : undefined;
		if(variableOf !== undefined) {
			/* the variable of a `for` holds one element of its sequence per run */
			const run = iterations.find(i => i.loop === variableOf);
			const elements: readonly (Value | undefined)[] | undefined = run === undefined ? loops.elementsOf(variableOf) : [loops.elementAt(variableOf, run.k)];
			if(elements === undefined || elements.includes(undefined)) {
				return Top;
			}
			folded.push(...elements as Value[]);
			continue;
		}

		const isFn = t === VertexType.FunctionCall;
		/* an access hands back a part of what it accesses, `x[[2]]` an element of `x`, so its `Returns` edge to `x`
		 * says nothing about its value, which only the evaluation of the access knows */
		if(isFn && RAccess.is(idMap.get(id))) {
			const values = valueSetGuard(resolveIdToValue(id, { graph, idMap, ctx, resolve: VariableResolve.Alias, blocked: new Set(blocked), callContext, frames, iterations }));
			if(values === undefined || values.elements.some(isTop)) {
				return Top;
			}
			folded.push(...values.elements);
			continue;
		}
		const outgoingEdges = graph.edgesFrom(id);
		if(isFn && callsBuiltInAndDefinition(outgoingEdges)) {
			/* `if(u) toupper <- function(x) "z"`: the call may run the built-in just as well as the definition,
			 * and what the two hand back has nothing to do with each other, so following the one we can walk
			 * would state the value of a call that may never happen */
			return Top;
		}
		let foundRetuns = false;
		/* a closure reads the frame it holds, which the call it runs in pins down */
		const framed = isFn ? ClosureFrames.contextOf(graph, id, callContext) : undefined;
		if(framed !== undefined) {
			for(const [targetId, edge] of outgoingEdges) {
				if(DfEdge.includesType(edge, EdgeType.Returns)) {
					foundRetuns = true;
					const values = valueSetGuard(resolveIdToValue(targetId, { graph, idMap, ctx, resolve: VariableResolve.Alias, blocked, callContext: framed }));
					if(values === undefined || values.elements.some(isTop)) {
						return Top;
					}
					folded.push(...values.elements);
				}
			}
		} else if(isFn) {
			const chosen = chosenArguments(id, vertex, { graph, idMap, ctx, blocked, callContext, frames, iterations });
			if(chosen === null) {
				return Top;
			}
			for(const [targetId, edge] of outgoingEdges) {
				if(DfEdge.includesType(edge, EdgeType.Returns)) {
					foundRetuns = true;
					if(chosen === undefined || chosen.has(targetId) || RNode.iterateParents(idMap.get(targetId), idMap).some(p => chosen.has(p.info.id))) {
						const into = framesIntoReturn(id, targetId, outgoingEdges, frames, idMap);
						enqueue(targetId, into, into === frames ? iterations : []);
					}
				}
			}
		} else {
			const top = frames.at(-1);
			const ownParameter = top !== undefined && isParameterOf(id, top.fn, idMap);
			const inCall = ownParameter ? top.call : contextCallOf(id, idMap, callContext);
			/* a definition holds what it is defined by, what it reads (the binding a `<<-` replaces) is not its value */
			const flow = t === VertexType.VariableDefinition ? DefinitionValueFlowEdges : ValueFlowEdges;
			const bound = top === undefined || ownParameter ? undefined : boundByCall(id, top.call, outgoingEdges, graph);
			const inFrame = callContext === undefined ? undefined : ClosureFrames.readsInCall(id, graph, idMap, callContext);
			for(const frame of inFrame?.frames ?? []) {
				enqueue(frame, [], []);
			}
			inFrame?.replaced.forEach(r => replaced.add(r));
			for(const [targetId, edge] of outgoingEdges) {
				if((inCall !== undefined && !followsInCall(outgoingEdges, targetId, edge, inCall, idMap))
					|| (inFrame !== undefined && !inFrame.keeps(targetId)) || replaced.has(targetId)
					|| (bound !== undefined && DfEdge.isOnlyType(edge, EdgeType.DefinedByOnCall) && !bound.has(targetId))) {
					continue;
				}
				/* only edges the value flows along, a closure reading what its scope binds is linked both ways (`Reads` and `DefinedByOnCall`) */
				if(DfEdge.hasAnyType(edge) && DfEdge.doesNotIncludeType(edge, ~flow)) {
					const next = top === undefined ? frames
						: ownParameter && DfEdge.includesType(edge, EdgeType.DefinedByOnCall) ? frames.slice(0, -1)
							: inSameFrame(targetId, top.fn, graph, idMap) ? frames : [];
					/* a function reads what its scope binds when it is called, so leaving its frame that way, the read is where the call is */
					const runs = next === frames ? loops.along(id, targetId, outgoingEdges, iterations)
						: top !== undefined && !ownParameter ? loops.along(top.call, targetId, outgoingEdges, []) : [];
					if(runs !== undefined) {
						enqueue(targetId, next, runs);
					}
				}
			}
		}
		if(isFn && !foundRetuns) {
			/* a call that hands back none of its arguments has no `Returns` edge to follow, yet the value solver may
			 * well know what it produces (`p <- file.path("data", "x.csv")`), so we fold it instead of giving up */
			const node = idMap.get(id);
			const state = parameterDefaultState(node, idMap, graph);
			if(state === 'overridden') {
				continue;
			}
			const values = state === 'unknown' ? undefined : valueSetGuard(resolveIdToValue(node, { graph, idMap, ctx, resolve: VariableResolve.Alias, blocked, callContext, frames, iterations }));
			if(values === undefined || values.elements.some(isTop)) {
				return Top;
			}
			folded.push(...values.elements);
			continue;
		}
	}

	/* a node reached in more frames than the queue walks is left out, so what the walk collected is not all */
	if(queue.hitThreshold() || (resultIds.length === 0 && folded.length === 0)) {
		return Top;
	}

	const values: Set<Value> = new Set<Value>(folded);
	for(const id of resultIds) {
		const vertex = graph.getVertex(id);
		if(DfgVertex.isValue(vertex) && vertex.value !== undefined) {
			values.add(vertex.value);
			continue;
		}
		const node = idMap.get(id);
		if(node !== undefined) {
			const state = parameterDefaultState(node, idMap, graph);
			if(state === 'unknown') {
				return Top;
			} else if(state === 'overridden') {
				continue;
			}
			values.add(valueFromRNodeConstant(node));
		}
	}
	return values.size === 0 ? Top : setOf([...values]);
}

/**
 * Please use {@link resolveIdToValue}
 *
 * Resolve an Identifier to a constant, if the identifier is a constant
 * @param    name        - Identifier to resolve
 * @param    environment - Environment to use
 * @returns              Value of Constant or Top
 * @useInstead {@link Resolve.toConstants}
 */
export function resolveToConstants(name: Identifier | undefined, environment: REnvironmentInformation): ResolveResult {
	if(name === undefined) {
		return Top;
	}

	const definitions = Resolve.byNameAndType(name, environment, ReferenceType.Constant);
	if(definitions === undefined) {
		return Top;
	}

	const values: Set<Value> = new Set<Value>();
	definitions.forEach(def => {
		const d = (def as BuiltInIdentifierConstant).value;
		values.add(d === undefined ? Top : valueFromTsValue(d));
	});
	return setOf([...values]);
}
