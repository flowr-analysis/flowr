import { assertUnreachable, guard } from '../../util/assert';
import { log } from '../../util/log';
import type { SliceResult } from './slicer-types';
import type { Fingerprint } from './fingerprint';
import { VisitingQueue } from './visiting-queue';
import { handleReturns, includeCalleesOfDefinition, sliceForCall, sliceReachesFunctionInterface } from './slice-call';
import type { AstIdMap, NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DfgVertex, type DataflowGraphVertexFunctionDefinition } from '../../dataflow/graph/vertex';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { DfEdge, EdgeType, shouldTraverseEdge, TraverseEdge } from '../../dataflow/graph/edge';
import type { DataflowInformation } from '../../dataflow/info';
import type { DataflowGraph, ReadonlyOutgoingEdges } from '../../dataflow/graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { SliceDirection } from '../../util/slice-direction';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { GasOverrides } from '../../gas';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';

export const slicerLogger = log.getSubLogger({ name: 'slicer' });

/** Options for {@link staticSlice}. */
export interface StaticSliceOptions {
	/** The analyzer context (environments, configuration). */
	readonly ctx:             ReadOnlyFlowrAnalyzerContext
	/** Dataflow information including the graph to traverse. */
	readonly info:            DataflowInformation
	/** Normalized AST, used for id resolution and nesting info. */
	readonly ast:             NormalizedAst
	/** Seed node ids to start the BFS from. At least one is required. */
	readonly ids:             readonly NodeId[]
	/** Whether to slice forward or backward. Defaults to {@link SliceDirection.Backward}. */
	readonly direction?:      SliceDirection
	/**
	 * Maximum BFS visits before the algorithm switches to over-approximation (includes everything).
	 * Defaults to 75.
	 */
	readonly threshold?:      number
	/** Memoization cache that can be shared across multiple slices on the same graph. */
	readonly cache?:          Map<Fingerprint, Set<NodeId>>
	/**
	 * Pre-built graph to use for BFS traversal instead of (possibly inverting) `info.graph`.
	 * `info.graph` is still consulted for function-call resolution, so it must remain the non-inverted original.
	 * Used by {@link staticDice} to pass a reduced-and-inverted graph in a single allocation.
	 */
	readonly sliceGraph?:     DataflowGraph
	/**
	 * If set (and slicing backward), continue the slice past a function-definition boundary: whenever the
	 * slice reaches a node that lives inside a function definition, also include the vertex that binds/defines
	 * the function (e.g. `f <- function(...)`) as well as all of its call sites (and their arguments).
	 * Defaults to `false` (slicing stops at the function-definition boundary, the historic behavior).
	 */
	readonly includeCallees?: boolean
	/**
	 * Gas bounds for this slice (see {@link GasOverrides}), on top of the enclosing operation's.
	 * A slice always gets a contingent of its own, so it is never billed for the analysis or the slices before it.
	 */
	readonly gas?:            GasOverrides
}

/**
 * Computes the node ids to include in a static slice, starting from the given seed ids.
 * The returned ids can be used with {@link reconstructToCode} to reproduce executable R code.
 */
export function staticSlice(options: StaticSliceOptions): Readonly<SliceResult> {
	const { ctx, info, ids, cache, sliceGraph } = options;
	const { idMap } = options.ast;
	const direction = options.direction ?? SliceDirection.Backward;
	guard(ids.length > 0, 'must have at least one seed id to calculate slice');
	// includeCallees only makes sense on the original (non-reduced) graph, backward
	const trackCallees = (options.includeCallees ?? false) && direction === SliceDirection.Backward && sliceGraph === undefined;
	// enclosing function definitions whose callees still need to be considered, mapped to the env to enqueue them in
	const pendingCalleeBoundaries = new Map<NodeId, [REnvironmentInformation, string]>();
	const resolvedCalleeBoundaries = new Set<NodeId>();
	/* a body entered through a call gets its arguments from that call, so only bodies the slice starts in open their callers */
	const openedBodies = new Set<NodeId>();
	const openBodiesAround = (from: NodeId): void => {
		for(let fn = RNode.findEnclosing(from, idMap, RFunctionDefinition.is); fn !== undefined; fn = RNode.strictlyEnclosingFunction(fn, idMap)) {
			openedBodies.add(fn);
		}
	};
	const graph = sliceGraph ?? (direction === SliceDirection.Forward ? Dataflow.invertGraph(info.graph, ctx.env.makeCleanEnv()) : info.graph);
	const emptyEnv = ctx.env.makeCleanEnv();
	const basePrint = ctx.env.getCleanEnvFingerprint();
	const queue = new VisitingQueue(options.threshold ?? 75, cache, graph, ctx.gas.scope(options.gas), [emptyEnv, basePrint]);
	const enclosingHandled = new Set<NodeId | undefined>();
	const missesSeeds = sliceGraph === undefined ? outsideSeedRun(ids, idMap, direction, graph) : undefined;
	const enqueue = (id: NodeId, env: REnvironmentInformation, print: Fingerprint): void => {
		if(!queue.hasId(id)) {
			queue.add(id, env, print, true);
		}
	};

	let minNesting = Number.MAX_SAFE_INTEGER;
	const sliceSeedIds = new Set<NodeId>();
	for(const startId of ids) {
		queue.add(startId, emptyEnv, basePrint, false);
		// retrieve the minimum nesting of all nodes to only add control dependencies if they are "part" of the current execution
		minNesting = Math.min(minNesting, idMap.get(startId)?.info.nest ?? minNesting);
		sliceSeedIds.add(startId);
		openBodiesAround(startId);
	}
	/* include all the implicit side effects that we have to consider as we are unable to narrow them down */
	for(const id of graph.unknownSideEffects) {
		/* a linked side effect is no vertex of its own, its target is just missing */
		if(typeof id !== 'object') {
			queue.add(id, emptyEnv, basePrint, true);
		}
	}
	/* a call asked about does what the functions it runs do, which includes what they print */
	for(const id of outputWithinCallees(ids, graph)) {
		queue.add(id, emptyEnv, basePrint, false);
	}

	/* a drained queue completes the body slice, only then can a boundary decide whether its callers matter */
	do{
		while(queue.nonEmpty()) {
			processNode();
		}
		resolveCalleeBoundaries();
	} while(queue.nonEmpty());

	function processNode(): void {
		const current = queue.next();
		const { baseEnvironment, id, onlyForSideEffects, envFingerprint: baseEnvFingerprint } = current;
		const currentInfo = graph.get(id, true);
		if(currentInfo === undefined) {
			slicerLogger.warn(`id: ${id} must be in graph but can not be found, keep in slice to be sure`);
			return;
		}
		const [currentVertex, allEdges] = currentInfo;
		const strictlyEnclosing = RNode.strictlyEnclosingFunction(id, idMap);
		/* code in a function links to what it meets at all its calls, so also to what cannot meet the seeds; forward,
		   a function links to all its calls, and none running before the seeds can */
		const currentEdges = missesSeeds !== undefined && (strictlyEnclosing !== undefined || direction === SliceDirection.Forward)
			? withoutMissed(allEdges, missesSeeds) : allEdges;
		if(!enclosingHandled.has(strictlyEnclosing)) {
			enclosingHandled.add(strictlyEnclosing);
			definitionWithHolders(strictlyEnclosing, idMap, graph, trackCallees ? undefined : openedBodies).forEach(outer => enqueue(outer, emptyEnv, basePrint));
		}
		// includeCallees: note the enclosing function definition (if any) so its callees can be considered once the body slice is complete
		if(trackCallees) {
			const enclosingFnDef = RFunctionDefinition.is(idMap.get(id)) ? id : strictlyEnclosing;
			if(enclosingFnDef !== undefined && openedBodies.has(enclosingFnDef) && !resolvedCalleeBoundaries.has(enclosingFnDef) && !pendingCalleeBoundaries.has(enclosingFnDef)) {
				pendingCalleeBoundaries.set(enclosingFnDef, [baseEnvironment, baseEnvFingerprint]);
			}
		}
		/* control dependencies count only in a different call or at least at the nesting of the seeds; a read or a constant
		   is the same value whether or not its promise is forced, only what runs within one depends on its call */
		const topLevel = graph.isRoot(id) || sliceSeedIds.has(id);
		const plain = DfgVertex.isUse(currentVertex) || DfgVertex.isValue(currentVertex);
		for(const cd of currentVertex.cds?.filter(cd => !(plain && cd.byPromise) && !queue.hasId(cd.id)) ?? []) {
			if(!topLevel || (idMap.get(cd.id)?.info.nest ?? 0) >= minNesting) {
				queue.add(cd.id, baseEnvironment, baseEnvFingerprint, false);
			}
		}
		/* a call or a definition within a promise runs only when the promise is forced, within captured code only when it is evaluated */
		if(DfgVertex.isFunctionCall(currentVertex) || DfgVertex.isVariableDefinition(currentVertex)) {
			const dependencies = FunctionSemantics.promiseDependencies(id, graph);
			if(graph.isQuoted(id)) {
				dependencies.push(...FunctionSemantics.call.quoted.evaluationDependencies(graph, id));
			}
			for(const dep of dependencies) {
				enqueue(dep, baseEnvironment, baseEnvFingerprint);
			}
		}
		if(DfgVertex.isFunctionCall(currentVertex)) {
			sliceForCall(current, currentVertex, info, queue, ctx);
		}
		/* forward, a definition a call hands to a read in its body has both edges itself */
		if(direction === SliceDirection.Forward) {
			for(const target of handedOnCall(currentEdges)) {
				queue.add(target, baseEnvironment, baseEnvFingerprint, false);
			}
		}
		if(!onlyForSideEffects && handleReturns(id, queue, currentEdges, baseEnvFingerprint, baseEnvironment)) {
			return;
		}
		for(const [target, e] of currentEdges) {
			const t = shouldTraverseEdge(e);
			switch(t) {
				case TraverseEdge.Never:
					continue;
				case TraverseEdge.Always:
					queue.add(target, baseEnvironment, baseEnvFingerprint, false);
					continue;
				case TraverseEdge.OnlyIfBoth:
					updatePotentialAddition(queue, id, target, baseEnvironment, baseEnvFingerprint);
					continue;
				case TraverseEdge.SideEffect:
					queue.add(target, baseEnvironment, baseEnvFingerprint, true);
					continue;
				default:
					assertUnreachable(t);
			}
		}
	}

	function resolveCalleeBoundaries(): void {
		const boundaries = [...pendingCalleeBoundaries];
		pendingCalleeBoundaries.clear();
		for(const [fnDefId, [env, fingerprint]] of boundaries) {
			resolvedCalleeBoundaries.add(fnDefId);
			// only continue past the boundary if the callers can actually influence the sliced result
			if(sliceReachesFunctionInterface(fnDefId, info.graph, queue, idMap, ctx)) {
				includeCalleesOfDefinition(fnDefId, info.graph, queue, env, fingerprint).forEach(openBodiesAround);
			}
		}
	}

	const status = queue.status();
	const result = ctx.config.solver.slicer?.autoExtend ? extendSlices(status.result, idMap) : status.result;
	return { ...status, slicedFor: ids, result, freeNames: freeNamesOf(result, info.graph) };
}

/** The `edges` without those to what `misses` names. */
function withoutMissed(edges: ReadonlyOutgoingEdges, misses: (id: NodeId) => boolean): ReadonlyOutgoingEdges {
	for(const [target] of edges) {
		if(misses(target)) {
			return new Map([...edges].filter(([t]) => !misses(t)));
		}
	}
	return edges;
}

/** The calls handing a definition over and the reads it is handed to, if its edges have both. */
function handedOnCall(edges: ReadonlyOutgoingEdges): NodeId[] {
	let defines = false;
	let definedBy = false;
	const targets: NodeId[] = [];
	for(const [target, e] of edges) {
		if(DfEdge.includesType(e, EdgeType.DefinesOnCall)) {
			defines = true;
			targets.push(target);
		} else if(DfEdge.includesType(e, EdgeType.DefinedByOnCall)) {
			definedBy = true;
			targets.push(target);
		}
	}
	return defines && definedBy ? targets : [];
}

/** The top-level statement `id` is part of, as its file root and its index there. */
function topLevelStatement(id: NodeId, idMap: AstIdMap): [NodeId, number] | undefined {
	let node = idMap.get(id);
	for(let parent = node && RNode.directParent(node, idMap); node !== undefined && parent !== undefined; node = parent, parent = RNode.directParent(parent, idMap)) {
		if(parent.info.parent === undefined) {
			return [parent.info.id, node.info.index];
		}
	}
	return undefined;
}

/**
 * Whether a node cannot meet the seeds: backward, it runs only after them, as its top-level statement follows
 * theirs; forward, it is a call running only before them, outside of any function. `undefined` if a seed is in a
 * function, which may run any time.
 */
function outsideSeedRun(ids: readonly NodeId[], idMap: AstIdMap, direction: SliceDirection, graph: DataflowGraph): ((id: NodeId) => boolean) | undefined {
	const backward = direction === SliceDirection.Backward;
	const bounds = new Map<NodeId, number>();
	for(const id of ids) {
		const at = topLevelStatement(id, idMap);
		if(at === undefined || RNode.findEnclosing(id, idMap, RFunctionDefinition.is) !== undefined) {
			return undefined;
		}
		const bound = bounds.get(at[0]) ?? at[1];
		bounds.set(at[0], backward ? Math.max(bound, at[1]) : Math.min(bound, at[1]));
	}
	const known = new Map<NodeId, boolean>();
	return id => {
		let misses = known.get(id);
		if(misses === undefined) {
			const at = topLevelStatement(id, idMap);
			const bound = at === undefined ? undefined : bounds.get(at[0]);
			misses = at !== undefined && bound !== undefined && (backward ? at[1] > bound
				: at[1] < bound && DfgVertex.isFunctionCall(graph.getVertex(id)) && RNode.findEnclosing(id, idMap, RFunctionDefinition.is) === undefined);
			known.set(id, misses);
		}
		return misses;
	};
}

/** The calls writing output (`cat`, `print`, ...: a side effect linked to `sink`) within the functions the call `seeds` run, transitively. */
function outputWithinCallees(seeds: Iterable<NodeId>, graph: DataflowGraph): NodeId[] {
	const writers = new Set<NodeId>();
	for(const effect of graph.unknownSideEffects) {
		if(typeof effect === 'object') {
			writers.add(effect.id);
		}
	}
	if(writers.size === 0) {
		return [];
	}
	const found: NodeId[] = [];
	const seen = new Set<NodeId>();
	const calls = [...seeds].filter(id => DfgVertex.isFunctionCall(graph.getVertex(id)));
	while(calls.length > 0) {
		for(const target of Dataflow.calleeIdsOf(graph, calls.pop() as NodeId).filter(t => !seen.has(t))) {
			seen.add(target);
			const callee = graph.getVertex(target) as DataflowGraphVertexFunctionDefinition;
			found.push(...[...callee.subflow.graph].filter(inner => writers.has(inner)));
			calls.push(...[...Dataflow.callsIn(callee, graph)].map(([inner]) => inner));
		}
	}
	return found;
}

/**
 * The function `definition` and what holds it, up to its statement, as a body only runs as part of its definition.
 * The `opened` bodies the slice starts in stop at an argument holding them or handed to a call of them: that call is a caller.
 */
function definitionWithHolders(definition: NodeId | undefined, idMap: AstIdMap, graph: DataflowGraph, opened?: ReadonlySet<NodeId>): NodeId[] {
	const definitionNode = definition === undefined ? undefined : idMap.get(definition);
	if(definitionNode === undefined) {
		return [];
	}
	const outer = [definitionNode.info.id];
	for(const node of RNode.iterateParents(definitionNode, idMap)) {
		if(RFunctionDefinition.is(node) || (RExpressionList.is(node) && node.grouping?.[0].lexeme !== '(')
			|| (opened !== undefined && RArgument.is(node) && (opened.has(definitionNode.info.id) || Dataflow.targetsOf(graph, node.info.parent ?? '', EdgeType.Calls).some(fn => opened.has(fn))))) {
			break;
		}
		if(graph.hasVertex(node.info.id)) {
			outer.push(node.info.id);
		}
	}
	return outer;
}

/**
 * The names the slice reads without defining them: a use whose definitions all stayed outside meets that name
 * undefined, and so does one that reads nothing at all (a name the program never defines). Reading a built-in
 * is no such case, as those are there whatever the slice contains.
 */
function freeNamesOf(slice: ReadonlySet<NodeId>, graph: DataflowGraph): readonly string[] {
	const free = new Set<string>();
	for(const id of slice) {
		if(!DfgVertex.isUse(graph.getVertex(id))) {
			continue;
		}
		const defined = Dataflow.targetsOf(graph, id, EdgeType.Reads).some(t => slice.has(t) || NodeId.isBuiltIn(t));
		const name = defined ? undefined : NodeId.recoverName(id, graph.idMap);
		if(name !== undefined) {
			free.add(name);
		}
	}
	return [...free].sort();
}

/**
 * Computes a program dice: only those nodes reachable forward from `startIds` that are also in the backward slice of `endIds`.
 * This effectively selects all paths from the given start nodes that lead to the given end nodes.
 *
 * For performance, the backward slice is computed first (typically the smaller set), then the graph is
 * reduced to that set and its edges are inverted in a single pass via {@link Dataflow.reduceAndInvertGraph}.
 * The forward traversal then runs only within that subgraph, avoiding nodes that cannot contribute to the dice.
 */
export function staticDice(
	ctx: ReadOnlyFlowrAnalyzerContext,
	info: DataflowInformation,
	ast: NormalizedAst,
	startIds: readonly NodeId[],
	endIds: readonly NodeId[],
	threshold = 75,
	includeCallees = false,
	gas?: GasOverrides,
): Readonly<SliceResult> {
	guard(startIds.length > 0 && endIds.length > 0, 'must have at least one start and one end id for dicing');
	const backward = staticSlice({ ctx, info, ast, ids: endIds, direction: SliceDirection.Backward, threshold, includeCallees, gas });
	// reduce to backward result and invert edges in one pass; original info kept for sliceForCall
	const sliceGraph = Dataflow.reduceAndInvertGraph(info.graph, backward.result, ctx.env.makeCleanEnv());
	const forward = staticSlice({ ctx, info, ast, ids: startIds, direction: SliceDirection.Backward, threshold, sliceGraph, gas });
	return {
		timesHitThreshold: forward.timesHitThreshold + backward.timesHitThreshold,
		// explicit intersection handles seed nodes that landed outside the reduced graph
		result:            new Set([...forward.result].filter(id => backward.result.has(id))),
		slicedFor:         [...startIds, ...endIds],
		...(forward.stoppedEarly || backward.stoppedEarly ? {
			stoppedEarly: true,
			progress:     {
				visited:  (forward.progress?.visited ?? 0) + (backward.progress?.visited ?? 0),
				frontier: (forward.progress?.frontier ?? 0) + (backward.progress?.frontier ?? 0)
			}
		} : {})
	};
}

function extendSlices(results: ReadonlySet<NodeId>, ast: AstIdMap): Set<NodeId> {
	const res = new Set(results);
	for(const id of results) {
		const statement = RNode.findEnclosing(id, ast, n => n.info.role === RoleInParent.Root || n.info.role === RoleInParent.ExpressionListChild);
		for(const inner of statement === undefined ? [] : RNode.collectAllIds(ast.get(statement))) {
			res.add(inner);
		}
	}
	return res;
}

/**
 * Updates the potential addition for the given target node in the visiting queue.
 * This describes vertices that might be added *if* another path reaches them.
 */
export function updatePotentialAddition(queue: VisitingQueue, id: NodeId, target: NodeId, baseEnvironment: REnvironmentInformation, envFingerprint: string): void {
	const n = queue.potentialAdditions.get(target);
	if(n) {
		const [addedBy, { baseEnvironment, onlyForSideEffects }] = n;
		if(addedBy !== id) {
			queue.add(target, baseEnvironment, envFingerprint, onlyForSideEffects);
			queue.potentialAdditions.delete(target);
		}
	} else {
		queue.potentialAdditions.set(target, [id, {
			id:                 target,
			baseEnvironment,
			envFingerprint,
			onlyForSideEffects: false
		}]);
	}
}
