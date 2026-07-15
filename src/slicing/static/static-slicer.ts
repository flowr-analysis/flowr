import { assertUnreachable, guard } from '../../util/assert';
import { log } from '../../util/log';
import type { SliceResult } from './slicer-types';
import { type Fingerprint } from './fingerprint';
import { VisitingQueue } from './visiting-queue';
import { findEnclosingFunctionDefinition, handleReturns, includeCalleesOfDefinition, sliceForCall, sliceReachesFunctionInterface } from './slice-call';
import type { AstIdMap, NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type REnvironmentInformation } from '../../dataflow/environments/environment';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../dataflow/graph/vertex';
import { shouldTraverseEdge, TraverseEdge } from '../../dataflow/graph/edge';
import type { DataflowInformation } from '../../dataflow/info';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { SliceDirection } from '../../util/slice-direction';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';

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
}

/**
 * Computes the node ids to include in a static slice, starting from the given seed ids.
 * The returned ids can be used with {@link reconstructToCode} to reproduce executable R code.
 */
export function staticSlice(options: StaticSliceOptions): Readonly<SliceResult> {
	const { ctx, info, ids, cache, sliceGraph } = options;
	const { idMap } = options.ast;
	const direction = options.direction ?? SliceDirection.Backward;
	const threshold = options.threshold ?? 75;
	guard(ids.length > 0, 'must have at least one seed id to calculate slice');
	// includeCallees only makes sense on the original (non-reduced) graph, backward
	const trackCallees = (options.includeCallees ?? false) && direction === SliceDirection.Backward && sliceGraph === undefined;
	// enclosing function definitions whose callees still need to be considered, mapped to the env to enqueue them in
	const pendingCalleeBoundaries = new Map<NodeId, [REnvironmentInformation, string]>();
	const resolvedCalleeBoundaries = new Set<NodeId>();
	let graph: DataflowGraph;
	if(sliceGraph !== undefined) {
		graph = sliceGraph;
	} else {
		graph = info.graph;
		if(direction === SliceDirection.Forward) {
			graph = Dataflow.invertGraph(graph, ctx.env.makeCleanEnv());
		}
	}

	const queue = new VisitingQueue(threshold, cache);

	let minNesting = Number.MAX_SAFE_INTEGER;
	const sliceSeedIds = new Set<NodeId>();
	// every node ships the call environment which registers the calling environment
	{
		const emptyEnv = ctx.env.makeCleanEnv();
		const basePrint = ctx.env.getCleanEnvFingerprint();
		for(const startId of ids) {
			queue.add(startId, emptyEnv, basePrint, false);
			// retrieve the minimum nesting of all nodes to only add control dependencies if they are "part" of the current execution
			minNesting = Math.min(minNesting, idMap.get(startId)?.info.nest ?? minNesting);
			sliceSeedIds.add(startId);
		}

		/* additionally,
		 * include all the implicit side effects that we have to consider as we are unable to narrow them down
		 */
		for(const id of graph.unknownSideEffects) {
			if(typeof id !== 'object') {
				/* otherwise, their target is just missing */
				queue.add(id, emptyEnv, basePrint, true);
			}
		}
	}

	do{
		while(queue.nonEmpty()) {
			processNode();
		}
		// the queue drained: only now do we know the full body slice, so decide per boundary whether the callers
		// can actually influence the result (i.e., the slice reaches a parameter or a captured scope variable).
		// resolving a boundary may enqueue new nodes, hence the surrounding do-while re-enters the traversal.
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

		const [currentVertex, currentEdges] = currentInfo;

		// includeCallees: note the enclosing function definition (if any) so its callees can be considered once the body slice is complete
		if(trackCallees) {
			const enclosingFnDef = findEnclosingFunctionDefinition(id, idMap);
			if(enclosingFnDef !== undefined && !resolvedCalleeBoundaries.has(enclosingFnDef) && !pendingCalleeBoundaries.has(enclosingFnDef)) {
				pendingCalleeBoundaries.set(enclosingFnDef, [baseEnvironment, baseEnvFingerprint]);
			}
		}

		// we only add control dependencies iff 1) we are in different function call or 2) they have, at least, the same nesting as the slicing seed
		if(currentVertex.cds && currentVertex.cds.length > 0) {
			const topLevel = graph.isRoot(id) || sliceSeedIds.has(id);
			for(const cd of currentVertex.cds.filter(({ id }) => !queue.hasId(id))) {
				if(!topLevel || (idMap.get(cd.id)?.info.nest ?? 0) >= minNesting) {
					queue.add(cd.id, baseEnvironment, baseEnvFingerprint, false);
				}
			}
		}

		if(!onlyForSideEffects) {
			if(currentVertex.tag === VertexType.FunctionCall && !currentVertex.onlyBuiltin) {
				sliceForCall(current, currentVertex, info, queue, ctx);
			}

			const ret = handleReturns(id, queue, currentEdges, baseEnvFingerprint, baseEnvironment);
			if(ret) {
				return;
			}
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
		if(pendingCalleeBoundaries.size === 0) {
			return;
		}
		const boundaries = [...pendingCalleeBoundaries];
		pendingCalleeBoundaries.clear();
		for(const [fnDefId, [env, fingerprint]] of boundaries) {
			resolvedCalleeBoundaries.add(fnDefId);
			// only continue past the boundary if the callers can actually influence the sliced result
			if(sliceReachesFunctionInterface(fnDefId, info.graph, queue, idMap, ctx)) {
				includeCalleesOfDefinition(fnDefId, info.graph, queue, env, fingerprint);
			}
		}
	}

	if(ctx.config.solver.slicer?.autoExtend) {
		return { ...queue.status(), slicedFor: ids, result: extendSlices(queue.status().result, idMap) };
	} else {
		return { ...queue.status(), slicedFor: ids };
	}
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
): Readonly<SliceResult> {
	guard(startIds.length > 0 && endIds.length > 0, 'must have at least one start and one end id for dicing');
	const backward = staticSlice({ ctx, info, ast, ids: endIds, direction: SliceDirection.Backward, threshold });
	// reduce to backward result and invert edges in one pass; original info kept for sliceForCall
	const invertedReduced = Dataflow.reduceAndInvertGraph(info.graph, backward.result, ctx.env.makeCleanEnv());
	const forward = staticSlice({ ctx, info, ast, ids: startIds, direction: SliceDirection.Backward, threshold, sliceGraph: invertedReduced });
	// explicit intersection handles seed nodes that landed outside the reduced graph
	const result = new Set<NodeId>();
	for(const id of forward.result) {
		if(backward.result.has(id)) {
			result.add(id);
		}
	}
	return {
		timesHitThreshold: forward.timesHitThreshold + backward.timesHitThreshold,
		result,
		slicedFor:         [...startIds, ...endIds],
	};
}

function extendSlices(
	results: ReadonlySet<NodeId>,
	ast: AstIdMap,
): Set<NodeId> {
	const res = new Set<NodeId>();
	for(const id of results) {
		res.add(id);
		let parent = ast.get(id);

		while(parent && parent.info.role !== RoleInParent.Root && parent.info.role !== RoleInParent.ExpressionListChild) {
			parent = parent.info.parent ? ast.get(parent.info.parent) : undefined;
		}
		if(!parent) {
			continue; // no parent, no need to extend
		}
		for(const id of RNode.collectAllIds(parent)) {
			res.add(id);
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
