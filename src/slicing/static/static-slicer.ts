import { assertUnreachable, guard } from '../../util/assert';
import { expensiveTrace, log } from '../../util/log';
import type { SliceResult } from './slicer-types';
import { type Fingerprint } from './fingerprint';
import { VisitingQueue } from './visiting-queue';
import { handleReturns, sliceForCall } from './slice-call';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { convertAllSlicingCriteriaToIds, type SlicingCriteria } from '../criterion/parse';
import { type REnvironmentInformation } from '../../dataflow/environments/environment';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { VertexType } from '../../dataflow/graph/vertex';
import { shouldTraverseEdge, TraverseEdge } from '../../dataflow/graph/edge';
import { SliceDirection } from '../../core/steps/all/static-slicing/00-slice';
import { invertDfg } from '../../dataflow/graph/invert-dfg';
import type { DataflowInformation } from '../../dataflow/info';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';

export const slicerLogger = log.getSubLogger({ name: 'slicer' });

/**
 * This returns the ids to include in the static slice of the given type, when slicing with the given seed id's (must be at least one).
 * <p>
 * The returned ids can be used to {@link reconstructToCode|reconstruct the slice to R code}.
 * @param ctx  - The analyzer context used for slicing.
 * @param info      - The dataflow information used for slicing.
 * @param idMap     - The mapping from node ids to their information in the AST.
 * @param criteria  - The criteria to slice on.
 * @param direction - The direction to slice in.
 * @param threshold - The maximum number of nodes to visit in the graph. If the threshold is reached, the slice will side with inclusion and drop its minimal guarantee. The limit ensures that the algorithm halts.
 * @param cache     - A cache to store the results of the slice. If provided, the slice may use this cache to speed up the slicing process.
 */
export function staticSlice(
	ctx: ReadOnlyFlowrAnalyzerContext,
	info: DataflowInformation,
	{ idMap }: NormalizedAst,
	criteria: SlicingCriteria,
	direction: SliceDirection,
	threshold = 75,
	cache?: Map<Fingerprint, Set<NodeId>>
): Readonly<SliceResult> {
	guard(criteria.length > 0, 'must have at least one seed id to calculate slice');
	const decodedCriteria = convertAllSlicingCriteriaToIds(criteria, idMap);
	expensiveTrace(slicerLogger,
		() => `calculating ${direction} slice for ${decodedCriteria.length} seed criteria: ${decodedCriteria.map(s => JSON.stringify(s)).join(', ')}`
	);

	let { graph } = info;

	if(direction === SliceDirection.Forward){
		graph = invertDfg(graph, ctx.env.makeCleanEnv());
	}

	const queue = new VisitingQueue(threshold, cache);

	let minNesting = Number.MAX_SAFE_INTEGER;
	const sliceSeedIds = new Set<NodeId>();
	// every node ships the call environment which registers the calling environment
	{
		const emptyEnv = ctx.env.makeCleanEnv();
		const basePrint = ctx.env.getCleanEnvFingerprint();
		for(const { id: startId } of decodedCriteria) {
			queue.add(startId, emptyEnv, basePrint, false);
			// retrieve the minimum nesting of all nodes to only add control dependencies if they are "part" of the current execution
			minNesting = Math.min(minNesting, idMap.get(startId)?.info.nesting ?? minNesting);
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

	while(queue.nonEmpty()) {
		const current = queue.next();

		const { baseEnvironment, id, onlyForSideEffects, envFingerprint: baseEnvFingerprint } = current;

		const currentInfo = graph.get(id, true);
		if(currentInfo === undefined) {
			slicerLogger.warn(`id: ${id} must be in graph but can not be found, keep in slice to be sure`);
			continue;
		}

		const [currentVertex, currentEdges] = currentInfo;

		// we only add control dependencies iff 1) we are in different function call or 2) they have, at least, the same nesting as the slicing seed
		if(currentVertex.controlDependencies && currentVertex.controlDependencies.length > 0) {
			const topLevel = graph.isRoot(id) || sliceSeedIds.has(id);
			for(const cd of currentVertex.controlDependencies.filter(({ id }) => !queue.hasId(id))) {
				if(!topLevel || (idMap.get(cd.id)?.info.nesting ?? 0) >= minNesting) {
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
				continue;
			}
		}

		for(const [target, { types }] of currentEdges) {
			const t = shouldTraverseEdge(types);
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

	return { ...queue.status(), decodedCriteria };
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
