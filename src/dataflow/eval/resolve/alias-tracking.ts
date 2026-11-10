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
import { RWhileLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import { RRepeatLoop } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
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
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { setFrom, setOf } from '../values/sets/set-constants';
import { resolveNode } from './resolve';
import { replacedValue } from './resolve-replacement';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { EmptyArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RPipe } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { RLoopConstructs, RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
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
	environment?:  REnvironmentInformation;
	/** The id map to resolve the node if given as an id */
	idMap?:        AstIdMap;
	/** The graph to resolve in */
	graph?:        DataflowGraph;
	/** Whether to track variables */
	full?:         boolean;
	/** Variable resolve mode */
	resolve?:      VariableResolve;
	/** Context used for resolving */
	ctx:           ReadOnlyFlowrAnalyzerContext;
	/** If set, the ids that should not be considered during resolution (=&gt; top) */
	blocked?:      Set<VisitKey>;
	/** If set, resolves the parameters of the functions it names for one of their calls only, see {@link CallContext} */
	callContext?:  CallContext;
	/** The frames of calls the node is resolved in, innermost last, see {@link CallFrame} */
	frames?:       readonly CallFrame[];
	/** The iterations of loops the node is resolved in, innermost last, see {@link LoopIteration} */
	iterations?:   readonly LoopIteration[];
	/** What the replacements one resolution walks hold, see {@link ReplacedValues} */
	replacements?: ReplacedValues;
}

/** What each replacement (`l$a <- v`) holds in a run of a loop and frame, for the one resolution that walks it: its value in run `k` is asked for by run `k + 1` both for the old value and for the value it assigns (`l$a <- l$a + 1`), which would otherwise walk the earlier runs over and over. */
export type ReplacedValues = Map<string, Value | undefined>;

/** The `k`-th run of the body of the loop at `loop` (a `for`, `while`, or `repeat`), out of a number of runs the value walk knows. */
export interface LoopIteration {
	readonly loop: NodeId
	readonly k:    number
}

/** A frame a run of the function `fn` makes when `call` calls it: a parameter of `fn` read in that frame holds what `call` hands it. */
export interface CallFrame {
	readonly fn:    NodeId
	readonly call:  NodeId
	readonly runs?: readonly LoopIteration[]
}

/** The call each of some functions is resolved for, keyed by the id of the function definition: a parameter of such a function holds only what that call hands it, or its default when the call hands it nothing. */
export type CallContext = ReadonlyMap<NodeId, NodeId>;

/** What a walk has seen already: a node, or a node in one run of the loops around it. */
export type VisitKey = NodeId | `${NodeId}@${string}`;

/** the call the context resolves the function of the parameter named by `id` for, if `id` names a parameter at all */
function contextCallOf(id: NodeId, idMap: AstIdMap, callContext: CallContext | undefined): NodeId | undefined {
	if(callContext === undefined) {
		return undefined;
	}
	const node = idMap.get(id);
	const parameter = node?.info.role === RoleInParent.ParameterName && node.info.parent !== undefined ? idMap.get(node.info.parent) : undefined;
	return parameter?.info.parent === undefined ? undefined : callContext.get(parameter.info.parent);
}

/** The call an argument value is handed to: the closest call around it, or the call a pipe feeds it into. */
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

/** Whether the walk may follow `edge` from the parameter `id` of a function the context resolves for `calls`, the call running it and those handing on their dots to it: an argument only if one of them hands it, the default only if none does. */
function followsInCall(edges: ReadonlyMap<NodeId, DfEdge>, target: NodeId, edge: DfEdge, calls: readonly NodeId[], idMap: AstIdMap): boolean {
	const handed = (t: NodeId, e: DfEdge) => DfEdge.isOnlyType(e, EdgeType.DefinedByOnCall) && calls.includes(callOfArgument(t, idMap) ?? '');
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

/** Gets the definitions / aliases of a node This function is called by the built-in-assignment processor so that we can track assignments inside the environment. */
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
 * @useInstead {@link Resolve.toValue}
 */
export function resolveIdToValue(id: NodeId | RNodeWithParent | undefined, { environment, graph, idMap, full = true, ctx, resolve = ctx.config.solver.variables, blocked, callContext, frames, iterations, replacements }: ResolveInfo): ResolveResult {
	blocked ??= new Set<VisitKey>();

	if(id === undefined) {
		return Top;
	}

	idMap ??= graph?.idMap;
	const node = typeof id === 'object' ? id : idMap?.get(id);
	/* the same node in another run of a loop is another value */
	const key: VisitKey | undefined = iterations === undefined || iterations.length === 0 ? node?.info.id : `${node?.info.id}@${iterations.map(i => `${i.loop}:${i.k}`).join('/')}`;
	if(node === undefined || key === undefined || blocked.has(key)) {
		return Top;
	}
	blocked.add(key);

	switch(node.type) {
		case RType.Argument:
			/* a missing argument (`f(x=)`) carries no value, and it is no symbol to resolve either */
			return node.value ? resolveIdToValue(node.value.info.id, { environment, graph, idMap, full, resolve, ctx, blocked, callContext, frames, iterations, replacements }) : Top;
		case RType.Symbol:
			if(full) {
				if(environment) {
					return trackAliasInEnvironments(Identifier.toString((node as RSymbol).content), environment, { idMap, resolve, ctx, graph, blocked, callContext });
				} else if(graph && resolve === VariableResolve.Alias) {
					return trackAliasesInGraph(node.info.id, graph, ctx, idMap, blocked, callContext, frames, iterations, replacements);
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
				resolve, node, ctx, environment, graph, idMap, blocked, callContext, frames, iterations, replacements
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
	return (value.type === 'vector' || value.type === 'set') && isValue(value.elements) ? value.elements.flatMap(iteratedElements) : [value];
}

/** Please use {@link resolveIdToValue} Uses the aliases that were tracked in the environments (by the {@link getAliases} function) to resolve a node to a value. */
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
						/* `x <- x + 1`: the environment holds only the definition we are resolving, so its own operand finds nothing there, while the graph still knows which definition that operand reads. */
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

/** Whether a parameter's default is what the parameter holds. */
enum ParameterDefault {
	Applies = 'applies',
	Overridden = 'overridden',
	Unknown = 'unknown'
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

function parameterDefaultState(node: RNodeWithParent | undefined, idMap: AstIdMap, graph: DataflowGraph): ParameterDefault {
	const parameter = node === undefined ? undefined
		: [node, ...RNode.iterateParents(node, idMap)].find(p => p.info.role === RoleInParent.ParameterDefaultValue)?.info.parent;
	const bound = parameter === undefined ? undefined : idMap.get(parameter);
	if(!RParameter.is(bound) || bound.info.parent === undefined) {
		return ParameterDefault.Applies;
	}
	const calls = Dataflow.sourcesOf(graph, bound.info.parent, EdgeType.Calls).length;
	return calls === 0 ? ParameterDefault.Unknown : Dataflow.targetsOf(graph, bound.name.info.id, EdgeType.DefinedByOnCall).length >= calls ? ParameterDefault.Overridden : ParameterDefault.Applies;
}

/** The sequence a use of a `for` loop's variable runs over, `undefined` when `id` is no such use. */
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
const SameFrameProcessors: readonly BuiltInProcName[] = [BuiltInProcName.ExpressionList, BuiltInProcName.Assignment, BuiltInProcName.Replacement, BuiltInProcName.IfThenElse, BuiltInProcName.ForLoop, BuiltInProcName.WhileLoop];

/** Where a node runs relative to another one in the same run of a loop body, see {@link LoopRuns#along}. */
const enum RunOrder {
	Before,
	After,
	Unknown
}

/** A loop whose runs the value walk counts: a `for` by its sequence, a `while` by its condition, a `repeat` by the condition it breaks on last. */
type CountedLoop = RForLoop<ParentInformation> | RWhileLoop<ParentInformation> | RRepeatLoop<ParentInformation>;

function isCountedLoop(node: RNodeWithParent | undefined): node is CountedLoop {
	return RForLoop.is(node) || RWhileLoop.is(node) || RRepeatLoop.is(node);
}

/** The `if(c) break` a `repeat` ends its body with, so each run of the body is a whole one. */
function finalBreakOf(loop: RNodeWithParent | undefined): RIfThenElse<ParentInformation> | undefined {
	const last = RRepeatLoop.is(loop) ? loop.body.children.at(-1) : undefined;
	return RIfThenElse.is(last) && last.otherwise === undefined && last.then.children.length === 1 && RBreak.is(last.then.children[0]) ? last : undefined;
}

/** The runs of the loops a value walk passes, see {@link LoopIteration}: a `for` over a sequence known in advance, or a `while` or `repeat` whose exit condition the value walk can tell for each run, and whose runs no `break` or `next` cuts short, runs its body a known number of times, so a read after the loop sees a definition the body surely makes from its last run, and a read in the body (or the condition of a `while`, which runs before the body) sees the last one before it, in the same run or the one before. */
class LoopRuns {
	private readonly graph: DataflowGraph;
	private readonly idMap: AstIdMap;
	private readonly info:  ResolveInfo;
	/** per loop, the element of each run of a `for`, or how many runs a `while` makes */
	private runs:           Map<NodeId, readonly Value[] | number | undefined> | undefined;

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
		const runs = this.runsOf(loop);
		return typeof runs === 'object' ? runs[k - 1] : undefined;
	}

	/** How many runs the loop surely makes. */
	private runCount(loop: NodeId): number | undefined {
		const runs = this.runsOf(loop);
		return typeof runs === 'object' ? runs.length : runs;
	}

	/** The element of each run of a `for`, or the number of runs of a `while`, if the loop surely runs through all of them. */
	private runsOf(loop: NodeId): readonly Value[] | number | undefined {
		this.runs ??= new Map();
		if(this.runs.has(loop)) {
			return this.runs.get(loop);
		}
		const node = this.idMap.get(loop);
		let runs: readonly Value[] | number | undefined;
		if(RForLoop.is(node) && !this.cutShort(node.body)) {
			const values = valueSetGuard(resolveIdToValue(node.vector.info.id, { ...this.info, blocked: new Set(this.info.blocked) }))?.elements;
			const sequence = values?.length === 1 ? values[0] : undefined;
			runs = sequence?.type === 'vector' && isValue(sequence.elements) && sequence.elements.length <= MaxUnrolledRuns ? iteratedElements(sequence) : undefined;
		} else if(RWhileLoop.is(node) && !this.cutShort(node.body)) {
			runs = this.runsUntil(node.condition.info.id, loop, false);
			runs = runs === undefined ? undefined : runs - 1;
		} else {
			const exit = finalBreakOf(node);
			runs = exit !== undefined && !this.cutShort((node as RRepeatLoop<ParentInformation>).body, exit.then.children[0].info.id) ? this.runsUntil(exit.condition.info.id, loop, true) : undefined;
		}
		this.runs.set(loop, runs);
		return runs;
	}

	/** The first run of the loop whose check of `condition` surely ends it, as the check is `exitsWhen`: that of a `while` comes before the body of the run and sees what the run before left behind, that of a `repeat` at the end of the body. */
	private runsUntil(condition: NodeId, loop: NodeId, exitsWhen: boolean): number | undefined {
		for(let k = 1; k <= MaxUnrolledRuns + 1; k++) {
			const values = valueSetGuard(resolveIdToValue(condition, { ...this.info, blocked: new Set(this.info.blocked), iterations: [{ loop, k }] }))?.elements;
			const truth = values?.length === 1 ? RValue.truthOf(values[0]) : undefined;
			if(truth === undefined) {
				return undefined;
			} else if(truth === exitsWhen) {
				return k;
			}
		}
		return undefined;
	}

	/** Whether a `break` or `next` other than `exit` may end a run of the body early. */
	private cutShort(body: RNodeWithParent, exit?: NodeId): boolean {
		let found = false;
		RNode.visitAst(body, node => {
			found ||= (RBreak.is(node) || RNext.is(node)) && node.info.id !== exit;
			return found || RFunctionDefinition.is(node);
		});
		return found;
	}

	/** The statement of the loop body that holds the node, or the condition of a `while` if that holds it. */
	private statementIn(id: NodeId, loop: NodeId): RNodeWithParent | undefined {
		const node = this.idMap.get(loop);
		const body = isCountedLoop(node) ? node.body.info.id : undefined;
		const condition = RWhileLoop.is(node) ? node.condition.info.id : undefined;
		for(const n of [this.idMap.get(id), ...RNode.iterateParents(this.idMap.get(id), this.idMap)]) {
			if(n === undefined || RFunctionDefinition.is(n)) {
				return undefined;
			} else if(n.info.parent === body || n.info.id === condition) {
				return n;
			}
		}
		return undefined;
	}

	/** The loops the node is in, within its function, innermost first: in their body, or with `conditions` in the condition of a `while` as well. */
	private loopsAround(id: NodeId, conditions = true): NodeId[] {
		const loops: NodeId[] = [];
		let child = this.idMap.get(id);
		for(const node of RNode.iterateParents(child, this.idMap)) {
			if(RFunctionDefinition.is(node)) {
				break;
			} else if(isCountedLoop(node) && (node.body.info.id === child?.info.id || (conditions && RWhileLoop.is(node) && node.condition.info.id === child?.info.id))) {
				loops.push(node.info.id);
			}
			child = node;
		}
		return loops;
	}

	/** Where the replacement at `id`, which reads its target in the very vertex that defines it (so no edge says so), reads what it wrote itself in the run of a loop before: `undefined` if no loop runs it again over a binding from before that loop (`targets` are the bindings it reads), the loop that does with the runs of the run before if the walk is in a later run of it (none in the first one) and whether a later definition of the body hides its own write, and `null` if the walk cannot tell. */
	ownEarlierRun(id: NodeId, targets: readonly NodeId[], iterations: readonly LoopIteration[]): { readonly loop: NodeId, readonly shadowed: boolean, readonly before?: readonly LoopIteration[] } | undefined | null {
		const within = (target: NodeId, loop: NodeId) => target === loop || RNode.iterateParents(this.idMap.get(target), this.idMap).some(p => p.info.id === loop);
		const carried: NodeId[] = [];
		let child = this.idMap.get(id);
		for(const node of RNode.iterateParents(child, this.idMap)) {
			if(RFunctionDefinition.is(node)) {
				break;
			} else if(RLoopConstructs.is(node) && !(RForLoop.is(node) && node.body.info.id !== child?.info.id) && targets.some(t => !within(t, node.info.id))) {
				carried.push(node.info.id);
			}
			child = node;
		}
		if(carried.length === 0) {
			return undefined;
		}
		const run = carried.length === 1 ? iterations.find(i => i.loop === carried[0]) : undefined;
		if(run === undefined || !this.surelyIn(id, run.loop)) {
			return null;
		}
		/* a definition the body surely makes after this one is what the run before leaves, and the replacement reads it */
		const shadowed = targets.some(t => t !== id && within(t, run.loop) && this.order(t, id, run.loop) === RunOrder.After && this.surelyIn(t, run.loop));
		return { loop: run.loop, shadowed, before: run.k === 1 ? undefined : iterations.map(i => i === run ? { loop: run.loop, k: run.k - 1 } : i) };
	}

	/** The last run of the loop, if the node runs only once the loop is done. */
	lastRunBefore(id: NodeId, loop: NodeId): LoopIteration | undefined {
		const runs = this.after(id, loop) ? this.runCount(loop) ?? 0 : 0;
		return runs > 0 ? { loop, k: runs } : undefined;
	}

	/** Whether the node runs only once the loop is done: after it in a block of the same function, `directly` a block that holds the loop itself. */
	private after(id: NodeId, loop: NodeId, directly = false): boolean {
		const [node, loopNode] = [this.idMap.get(id), this.idMap.get(loop)];
		return RNode.findEnclosing(id, this.idMap, RFunctionDefinition.is) === RNode.findEnclosing(loop, this.idMap, RFunctionDefinition.is) && RNode.precedesInBlock(loopNode, node, this.idMap)
			&& (!directly || RNode.iterateParents(node, this.idMap).some(p => p.info.id === loopNode?.info.parent));
	}

	/** Whether the body of the loop surely makes the node in every run, where it stands under no other condition than that the loop goes on. */
	private surelyIn(id: NodeId, loop: NodeId): boolean {
		const own = this.graph.getVertex(loop)?.cds ?? [];
		const exit = finalBreakOf(this.idMap.get(loop))?.info.id;
		return ControlDependency.minus(this.graph.getVertex(id)?.cds ?? [], own).every(cd => cd.id === loop || (cd.id === exit && cd.when === false))
			&& this.inLoopFrame(id, loop);
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

	/** Whether `to` runs before or after `from` in a run of the loop: by the statements holding them (the condition of a `while` first), or as the value an assignment defines its target by. */
	private order(to: NodeId, from: NodeId, loop: NodeId): RunOrder {
		const [a, b] = [this.statementIn(to, loop), this.statementIn(from, loop)];
		if(a === undefined || b === undefined) {
			return RunOrder.Unknown;
		} else if(a !== b) {
			const position = (s: RNodeWithParent) => s.info.parent === loop ? -1 : s.info.index;
			return position(a) < position(b) ? RunOrder.Before : RunOrder.After;
		}
		const assigns = (target: NodeId, value: NodeId) => {
			const vertex = this.graph.getVertex(target);
			/* a replacement evaluates all of its assignment, the value as well as the indices, before it rebinds */
			const assignment = DfgVertex.isVariableDefinition(vertex) && vertex.par ? RNode.findEnclosing(target, this.idMap, RBinaryOp.is)
				: this.idMap.get(target)?.info.parent;
			return DfgVertex.isVariableDefinition(vertex) && (vertex.par || DfgVertex.hasOrigin(this.graph.getVertex(assignment ?? -1), BuiltInProcName.Assignment))
				&& RNode.iterateParents(this.idMap.get(value), this.idMap).some(p => p.info.id === assignment);
		};
		return assigns(to, from) ? RunOrder.After : assigns(from, to) ? RunOrder.Before : RunOrder.Unknown;
	}

	/** Whether a loop that surely runs at least once, standing before the read `from` in a block that holds it, surely redefines what `to`, made before the loop, defines, so the read no longer sees `to`. */
	private redefinedByLoop(from: NodeId, to: NodeId, edges: ReadonlyMap<NodeId, DfEdge>): boolean {
		for(const [t, e] of edges) {
			if(t === to || !DfEdge.includesType(e, EdgeType.Reads | EdgeType.DefinedByOnCall) || this.graph.getVertex(t)?.cds?.some(cd => isCountedLoop(this.idMap.get(cd.id))) !== true
				|| !DfgVertex.isVariableDefinition(this.graph.getVertex(t))) {
				continue;
			}
			const loop = this.loopsAround(t, false)[0];
			if(loop !== undefined && this.surelyIn(t, loop) && this.after(from, loop, true) && !this.after(to, loop)
				&& RNode.strictlyEnclosingFunction(to, this.idMap) === RNode.strictlyEnclosingFunction(loop, this.idMap)
				&& !RNode.iterateParents(this.idMap.get(to), this.idMap).some(p => p.info.id === loop) && (this.runCount(loop) ?? 0) > 0) {
				return true;
			}
		}
		return false;
	}

	/** Whether another definition among the `edges` of the read `from` in run `k` of the loop surely runs after `to` (made in run `toRun`, or before the loop if that is `undefined`) and before `from`, so the read no longer sees `to`. */
	private redefinedBetween(from: NodeId, to: NodeId, toRun: number | undefined, k: number, loop: NodeId, edges: ReadonlyMap<NodeId, DfEdge>): boolean {
		for(const [t, e] of edges) {
			if(t === to || !DfEdge.includesType(e, EdgeType.Reads | EdgeType.DefinedByOnCall) || !DfgVertex.isVariableDefinition(this.graph.getVertex(t))
				|| !this.loopsAround(t).includes(loop) || !this.surelyIn(t, loop)) {
				continue;
			}
			const order = this.order(t, from, loop);
			const run = order === RunOrder.Before ? k : order === RunOrder.After ? k - 1 : 0;
			if(run > 0 && (toRun === undefined || run > toRun || (run === toRun && this.order(to, t, loop) === RunOrder.Before))) {
				return true;
			}
		}
		return false;
	}

	/** The runs the walk is in once it follows the edge from `from` to `to`, `undefined` if no run lets it: a read in the first run cannot see what its body only defines later on, nor any read a definition the body surely makes again between the two. */
	along(from: NodeId, to: NodeId, edges: ReadonlyMap<NodeId, DfEdge>, iterations: readonly LoopIteration[]): readonly LoopIteration[] | undefined {
		const top = iterations.at(-1);
		if(top === undefined) {
			/* a read after the loop sees its last run, be it a definition of the body or the variable of the loop */
			const vertex = this.graph.getVertex(to);
			const variableOf = DfgVertex.isVariableDefinition(vertex) ? this.loopOfVariable(to) : undefined;
			if(variableOf === undefined && vertex?.cds?.some(cd => isCountedLoop(this.idMap.get(cd.id))) !== true) {
				/* the body of a loop runs under the loop as its condition, so a node without one is in none */
				return this.redefinedByLoop(from, to, edges) ? undefined : iterations;
			}
			/* the condition of a `while` runs once more than its body */
			const loop = this.loopsAround(to, false)[0] ?? variableOf;
			if(loop === undefined || !this.after(from, loop)) {
				return iterations;
			}
			const runs = this.runCount(loop);
			if(runs === 0 && variableOf === undefined) {
				/* the body never runs */
				return undefined;
			}
			return runs !== undefined && runs > 0 && (variableOf === loop || this.surelyIn(to, loop)) ? [{ loop, k: runs }] : iterations;
		}
		const fromInRun = this.loopsAround(from).includes(top.loop);
		const around = this.loopsAround(to);
		if(fromInRun && this.loopOfVariable(to) === top.loop) {
			return iterations;
		} else if(around.includes(top.loop)) {
			const order = fromInRun ? this.order(to, from, top.loop) : RunOrder.Unknown;
			if(order === RunOrder.Before) {
				return this.redefinedBetween(from, to, top.k, top.k, top.loop, edges) ? undefined : iterations;
			} else if(order === RunOrder.After) {
				if(top.k === 1 || this.redefinedBetween(from, to, top.k - 1, top.k, top.loop, edges)) {
					return undefined;
				}
				return this.surelyIn(to, top.loop) ? [...iterations.slice(0, -1), { loop: top.loop, k: top.k - 1 }] : iterations.slice(0, -1);
			}
			return [];
		}
		const redefined = fromInRun && this.redefinedBetween(from, to, undefined, top.k, top.loop, edges);
		return redefined ? undefined : iterations.filter(i => around.includes(i.loop));
	}
}

/** Whether the `<<-` replacement at `id` may run again in a later call of its function, where it reads its own write (no edge says so, the vertex reading the target is the one defining it). */
function superReplacementRepeats(id: NodeId, graph: DataflowGraph, idMap: AstIdMap): boolean {
	const fn = RNode.findEnclosing(id, idMap, RFunctionDefinition.is);
	const replacement = idMap.get(id)?.info.parent;
	if(fn === undefined || replacement === undefined || !Dataflow.superAssigns(graph, replacement)) {
		return false;
	}
	const name = NodeId.recoverName(id, idMap);
	const calls = Dataflow.sourcesOf(graph, fn, EdgeType.Calls);
	const enclosingOrLoop = (n: RNodeWithParent) => RFunctionDefinition.is(n) || RLoopConstructs.is(n);
	const outer = idMap.get(fn)?.info.parent;
	return name === undefined || calls.length === 0 || (outer !== undefined && RNode.findEnclosing(outer, idMap, RFunctionDefinition.is) !== undefined)
		|| calls.some(call => {
			const vertex = graph.getVertex(call);
			const defs = DfgVertex.isFunctionCall(vertex) && vertex.environment !== undefined ? Resolve.byName(name, vertex.environment) : undefined;
			return defs === undefined || defs.length === 0 || defs.some(d => d.nodeId === id) || RNode.findEnclosing(call, idMap, enclosingOrLoop) !== undefined;
		});
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
/** The edges from the target of a replacement to the bindings it replaces, whose value it changes a part of. */
const OldValueFlowEdges = EdgeType.Reads | EdgeType.DefinedByOnCall;

function isParameterOf(id: NodeId, fn: NodeId, idMap: AstIdMap): boolean {
	const node = idMap.get(id);
	return node?.info.role === RoleInParent.ParameterName && node.info.parent !== undefined && idMap.get(node.info.parent)?.info.parent === fn;
}

/** Whether the walk stays in the frame of `fn` when it moves to `target`: a node of the body of `fn` itself, whose definitions a run of `fn` makes in its own frame, unless they go elsewhere (`<<-`, `assign`). */
function inSameFrame(target: NodeId, fn: NodeId, graph: DataflowGraph, idMap: AstIdMap): boolean {
	if(RNode.strictlyEnclosingFunction(target, idMap) !== fn) {
		return false;
	} else if(!DfgVertex.isVariableDefinition(graph.getVertex(target))) {
		return true;
	}
	const parent = idMap.get(target)?.info.parent;
	return isParameterOf(target, fn, idMap) || (parent !== undefined && DfgVertex.hasOrigin(graph.getVertex(parent), BuiltInProcName.Assignment));
}

/** The frames the walk is in once it follows the `Returns` edge of `call` to `target`: a new frame of the function called, the same frame for what the call hands back of its own arguments, and none it knows otherwise. */
function framesIntoReturn(call: NodeId, target: NodeId, edges: ReadonlyMap<NodeId, DfEdge>, frames: readonly CallFrame[], runs: readonly LoopIteration[], idMap: AstIdMap): readonly CallFrame[] {
	if(!edges.entries().some(([t, e]) => !NodeId.isBuiltIn(t) && DfEdge.includesType(e, EdgeType.Calls))) {
		/* a built-in hands back what it was given in the frame it was called in */
		return frames;
	}
	const fn = RNode.strictlyEnclosingFunction(target, idMap);
	if(fn !== undefined && edges.get(fn) !== undefined && DfEdge.includesType(edges.get(fn) as DfEdge, EdgeType.Calls)) {
		return frames.length >= MaxFrames || frames.some(f => f.fn === fn) ? [] : [...frames, { fn, call, runs }];
	}
	return fn === RNode.strictlyEnclosingFunction(call, idMap) ? frames : [];
}

/** The innermost frame whose call is made in the function that holds `target`, see {@link CallFrame}. */
function frameCalledBeside(frames: readonly CallFrame[], target: NodeId, idMap: AstIdMap): CallFrame | undefined {
	const scope = RNode.strictlyEnclosingFunction(target, idMap);
	return frames.findLast(f => RNode.strictlyEnclosingFunction(f.call, idMap) === scope);
}

/** The frame whose call hands the argument `argument`, the innermost one if none does. */
function handingFrame(frames: readonly CallFrame[], argument: NodeId, idMap: AstIdMap): number {
	const call = callOfArgument(argument, idMap);
	const at = frames.findLastIndex(f => f.call === call);
	return at < 0 ? frames.length - 1 : at;
}

/** What the call binds a free variable of the function it calls to, if it binds any of the definitions the variable is linked to on calls (`DefinedByOnCall`): read in the frame of that call, the variable sees those and none of the ones other calls bind, such as the call creating the closure (`g <- f(); x <- 2; g()` reads `x` of `g()`). */
function boundByCall(id: NodeId, call: NodeId, edges: ReadonlyMap<NodeId, DfEdge>, graph: DataflowGraph): ReadonlySet<NodeId> | undefined {
	let bound: Set<NodeId> | undefined;
	for(const [target, edge] of edges) {
		if(DfEdge.isOnlyType(edge, EdgeType.DefinedByOnCall) && Dataflow.hasEdge(graph, call, target, EdgeType.DefinesOnCall)) {
			(bound ??= new Set()).add(target);
		}
	}
	return id === call ? undefined : bound;
}

/** Which of the definitions the lookup `vertex` finds it may hand back in the frames the walk is in: those the calls of these frames find, and those no call states, see {@link DataflowGraphVertexFunctionCall#foundOnCall}. */
function foundInFrames(vertex: DataflowGraphVertexFunctionCall, frames: readonly CallFrame[], callContext: CallContext | undefined): ((target: NodeId) => boolean) | undefined {
	if(vertex.foundOnCall === undefined) {
		return undefined;
	}
	let found: Set<NodeId> | undefined;
	const stated = new Set<NodeId>();
	for(const { call, found: defs } of vertex.foundOnCall) {
		defs.forEach(d => stated.add(d));
		if(frames.some(f => f.call === call) || callContext?.values().some(c => c === call)) {
			found = found === undefined ? new Set(defs) : found.intersection(new Set(defs));
		}
	}
	return found === undefined ? undefined : target => found.has(target) || !stated.has(target);
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

/** The argument a call choosing one of its arguments by a value (`if`, `switch`) hands back, if that value is known: `undefined` if it may hand back any of them, `null` if it hands back none (`NULL`) or fails. */
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

/** Please use {@link resolveIdToValue} Tries to resolve the value of a node by traversing the dataflow graph */
export function trackAliasesInGraph(id: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext, idMap?: AstIdMap, blocked?: Set<NodeId>, callContext?: CallContext, frames: readonly CallFrame[] = [], iterations: readonly LoopIteration[] = [], replacements?: ReplacedValues): ResolveResult {
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
		const key = `${cleanFingerprint}|${at.map(f => `${f.fn}@${f.call}${f.runs?.map(i => `:${i.loop}:${i.k}`).join('') ?? ''}`).join('/')}|${runs.map(i => `${i.loop}:${i.k}`).join('/')}`;
		contextOf.set(key, [at, runs]);
		queue.add(target, clean, key, false);
	};
	enqueue(id, frames, iterations);

	/* what the replacement at `id` holds in the given runs and frames: its old value with the part it replaces changed */
	const replacementValueAt = (id: NodeId, key: string, frames: readonly CallFrame[], iterations: readonly LoopIteration[]): Value | undefined => {
		const inner = new Set(blocked);
		inner.add(key);
		const sources: (readonly [NodeId, readonly CallFrame[], readonly LoopIteration[]])[] = [];
		follow(id, OldValueFlowEdges, frames, iterations, (target, at, runs) => sources.push([target, at, runs]));
		const earlier = loops.ownEarlierRun(id, sources.map(([target]) => target), iterations);
		if(earlier === null || blocked?.has(key) || superReplacementRepeats(id, graph, idMap)) {
			return undefined;
		} else if(earlier?.before !== undefined) {
			/* a later run reads what the run before left, which this replacement surely wrote */
			const { loop, before, shadowed } = earlier;
			const inLoop = sources.filter(([target]) => RNode.iterateParents(idMap.get(target), idMap).some(p => p.info.id === loop));
			sources.splice(0, sources.length, ...inLoop, ...shadowed ? [] : [[id, frames, before] as const]);
		}
		const old: Value[] = [];
		for(const [target, at, runs] of sources) {
			const value = trackAliasesInGraph(target, graph, ctx, idMap, new Set(inner), callContext, at, runs, replacements);
			if(!isValue(value)) {
				return undefined;
			}
			old.push(...value.elements);
		}
		return old.length === 0 ? undefined : replacedValue(id, old, { graph, idMap, ctx, blocked: inner, callContext, frames, iterations, replacements });
	};
	const resultIds: NodeId[] = [];
	/* what a read in a closure frame knows is replaced stays so for the writes it leads to */
	const replaced = new Set<NodeId>();
	/* hands each node the value at `id` flows from along the `flow` edges to `visit`, with the frames and runs it is in there */
	const follow = (id: NodeId, flow: EdgeType, frames: readonly CallFrame[], iterations: readonly LoopIteration[], visit: (target: NodeId, frames: readonly CallFrame[], runs: readonly LoopIteration[]) => void) => {
		const outgoingEdges = graph.edgesFrom(id);
		const top = frames.at(-1);
		const ownParameter = top !== undefined && isParameterOf(id, top.fn, idMap);
		/* an argument handed on through the dots of the calls around comes from one of them */
		const contextCall = ownParameter ? undefined : contextCallOf(id, idMap, callContext);
		const inCalls = ownParameter ? frames.map(f => f.call) : contextCall === undefined ? undefined : [contextCall];
		const bound = top === undefined || ownParameter ? undefined : boundByCall(id, top.call, outgoingEdges, graph);
		const inFrame = callContext === undefined ? undefined : ClosureFrames.readsInCall(id, graph, idMap, callContext);
		for(const frame of inFrame?.frames ?? []) {
			visit(frame, [], []);
		}
		inFrame?.replaced.forEach(r => replaced.add(r));
		for(const [targetId, edge] of outgoingEdges) {
			if((inCalls !== undefined && !followsInCall(outgoingEdges, targetId, edge, inCalls, idMap))
				|| (inFrame !== undefined && !inFrame.keeps(targetId)) || replaced.has(targetId)
				|| (bound !== undefined && DfEdge.isOnlyType(edge, EdgeType.DefinedByOnCall) && !bound.has(targetId))) {
				continue;
			}
			/* only edges the value flows along, a closure reading what its scope binds is linked both ways (`Reads` and `DefinedByOnCall`) */
			if(DfEdge.hasAnyType(edge) && DfEdge.doesNotIncludeType(edge, ~flow)) {
				const handing = ownParameter && DfEdge.includesType(edge, EdgeType.DefinedByOnCall) ? handingFrame(frames, targetId, idMap) : undefined;
				const next = top === undefined ? frames
					: handing !== undefined ? frames.slice(0, handing)
						: inSameFrame(targetId, top.fn, graph, idMap) ? frames : [];
				/* a function reads what its scope binds when it is called, so leaving its frame that way, the read is where the call is, or, through calls of further functions, where the call made in the scope of the target is */
				const leaving = top === undefined || ownParameter ? undefined : frameCalledBeside(frames, targetId, idMap) ?? top;
				const runs = next === frames ? loops.along(id, targetId, outgoingEdges, iterations)
					: handing !== undefined ? frames[handing].runs ?? []
						: leaving !== undefined ? loops.along(leaving.call, targetId, outgoingEdges, leaving.runs ?? []) : [];
				if(runs !== undefined) {
					visit(targetId, next, runs);
				}
			}
		}
	};
	/* what a call the walk ended in folds to, see below */
	const folded: Value[] = [];
	while(queue.nonEmpty()) {
		const { id, envFingerprint } = queue.next();
		const [frames, iterations] = envFingerprint === cleanFingerprint ? NoWalkContext : contextOf.get(envFingerprint) ?? NoWalkContext;
		const vertex = graph.getVertex(id);
		if(!vertex) {
			continue;
		}
		/* a definition in a loop may hold the value of any iteration, and the walk collects all of them; one that depends on its own earlier value, like `x <- x + 1`, reaches itself again, is blocked, and stays unknown */
		const t = vertex.tag;
		/* a replacement (`l$a <- v`) rebinds its target to what it was with a part changed, so the target holds that change applied to the old value, which the target reads */
		if(t === VertexType.VariableDefinition && (vertex.par || idMap.get(id)?.info.role === RoleInParent.Accessed)) {
			const key = `${id}@${iterations.map(i => `${i.loop}:${i.k}`).join('/')}|${frames.map(f => `${f.fn}@${f.call}`).join('/')}`;
			const memo = callContext === undefined ? replacements ??= new Map<string, Value | undefined>() : undefined;
			const value = memo?.has(key) ? memo.get(key) : replacementValueAt(id, key, frames, iterations);
			memo?.set(key, value);
			if(value === undefined) {
				return Top;
			}
			folded.push(value);
			continue;
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
		/* an access hands back a part of what it accesses, `x[[2]]` an element of `x`, so its `Returns` edge to `x` says nothing about its value, which only the evaluation of the access knows */
		if(isFn && RAccess.is(idMap.get(id))) {
			const values = valueSetGuard(resolveIdToValue(id, { graph, idMap, ctx, resolve: VariableResolve.Alias, blocked: new Set(blocked), callContext, frames, iterations, replacements }));
			if(values === undefined || values.elements.some(isTop)) {
				return Top;
			}
			folded.push(...values.elements);
			continue;
		}
		const outgoingEdges = graph.edgesFrom(id);
		if(isFn && callsBuiltInAndDefinition(outgoingEdges)) {
			/* `if(u) toupper <- function(x) "z"`: the call may run the built-in just as well as the definition, and what the two hand back has nothing to do with each other, so following the one we can walk would state the value of a call that may never happen */
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
			const found = foundInFrames(vertex, frames, callContext);
			for(const [targetId, edge] of outgoingEdges) {
				if(DfEdge.includesType(edge, EdgeType.Returns)) {
					foundRetuns = true;
					if(found?.(targetId) === false) {
						continue;
					} else if(chosen === undefined || chosen.has(targetId) || RNode.iterateParents(idMap.get(targetId), idMap).some(p => chosen.has(p.info.id))) {
						const into = framesIntoReturn(id, targetId, outgoingEdges, frames, iterations, idMap);
						enqueue(targetId, into, into === frames ? iterations : []);
					}
				}
			}
		} else {
			/* a definition holds what it is defined by, what it reads (the binding a `<<-` replaces) is not its value */
			follow(id, t === VertexType.VariableDefinition ? DefinitionValueFlowEdges : ValueFlowEdges, frames, iterations, enqueue);
		}
		if(isFn && !foundRetuns) {
			/* a call that hands back none of its arguments has no `Returns` edge to follow, yet the value solver may well know what it produces (`p <- file.path("data", "x.csv")`), so we fold it instead of giving up */
			const node = idMap.get(id);
			const state = parameterDefaultState(node, idMap, graph);
			if(state === ParameterDefault.Overridden) {
				continue;
			}
			const values = state === ParameterDefault.Unknown ? undefined : valueSetGuard(resolveIdToValue(node, { graph, idMap, ctx, resolve: VariableResolve.Alias, blocked, callContext, frames, iterations, replacements }));
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
			if(state === ParameterDefault.Unknown) {
				return Top;
			} else if(state === ParameterDefault.Overridden) {
				continue;
			}
			values.add(valueFromRNodeConstant(node));
		}
	}
	return values.size === 0 ? Top : setOf([...values]);
}

/**
 * Please use {@link resolveIdToValue} Resolve an Identifier to a constant, if the identifier is a constant
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
