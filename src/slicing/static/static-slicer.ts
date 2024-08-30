import { guard } from '../../util/assert'
import { expensiveTrace, log } from '../../util/log'
import type { SliceResult } from './slicer-types'
import { envFingerprint } from './fingerprint'
import { VisitingQueue } from './visiting-queue'
import { handleReturns, sliceForCall } from './slice-call'
import type { DataflowGraph } from '../../dataflow/graph/graph'
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { SlicingCriteria } from '../criterion/parse'
import { convertAllSlicingCriteriaToIds } from '../criterion/parse'
import { initializeCleanEnvironments } from '../../dataflow/environments/environment'
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { VertexType } from '../../dataflow/graph/vertex'
import { edgeIncludesType, EdgeType, shouldTraverseEdge, TraverseEdge } from '../../dataflow/graph/edge'

export const slicerLogger = log.getSubLogger({ name: 'slicer' })

/**
 * This returns the ids to include in the static backward slice, when slicing with the given seed id's (must be at least one).
 * <p>
 * The returned ids can be used to {@link reconstructToCode|reconstruct the slice to R code}.
 *
 * @param graph     - The dataflow graph to conduct the slicing on.
 * @param ast       - The normalized AST of the code (used to get static depth information of the lexemes in case of control flow dependencies that may have no effect on the slicing scope).
 * @param criteria  - The criteras to slice on.
 * @param threshold - The maximum number of nodes to visit in the graph. If the threshold is reached, the slice will side with inclusion and drop its minimal guarantee. The limit ensures that the algorithm halts.
 */
export function staticSlicing(graph: DataflowGraph, { idMap }: NormalizedAst, criteria: SlicingCriteria, threshold = 75): Readonly<SliceResult> {
	guard(criteria.length > 0, 'must have at least one seed id to calculate slice')
	const decodedCriteria = convertAllSlicingCriteriaToIds(criteria, idMap)
	expensiveTrace(slicerLogger,
		() => `calculating slice for ${decodedCriteria.length} seed criteria: ${decodedCriteria.map(s => JSON.stringify(s)).join(', ')}`
	)

	const queue = new VisitingQueue(threshold)

	let minDepth = Number.MAX_SAFE_INTEGER
	const sliceSeedIds = new Set<NodeId>()
	// every node ships the call environment which registers the calling environment
	{
		const emptyEnv = initializeCleanEnvironments()
		const basePrint = envFingerprint(emptyEnv)
		for(const { id: startId } of decodedCriteria) {
			queue.add(startId, emptyEnv, basePrint, false)
			// retrieve the minimum depth of all nodes to only add control dependencies if they are "part" of the current execution
			minDepth = Math.min(minDepth, idMap.get(startId)?.info.depth ?? minDepth)
			sliceSeedIds.add(startId)
		}

		/* additionally,
		 * include all the implicit side effects that we have to consider as we are unable to narrow them down
		 */
		for(const id of graph.unknownSideEffects) {
			queue.add(id, emptyEnv, basePrint, true)
		}
	}

	while(queue.nonEmpty()) {
		const current = queue.next()

		const { baseEnvironment, id, onlyForSideEffects } = current
		const baseEnvFingerprint = envFingerprint(baseEnvironment)

		const currentInfo = graph.get(id, true)
		if(currentInfo === undefined) {
			slicerLogger.warn(`id: ${id} must be in graph but can not be found, keep in slice to be sure`)
			continue
		}

		const [currentVertex, currentEdges] = currentInfo

		// we only add control dependencies iff 1) we are in different function call or 2) they have, at least, the same depth as the slicing seed
		if(currentVertex.controlDependencies && currentVertex.controlDependencies.length > 0) {
			const topLevel = graph.isRoot(id) || sliceSeedIds.has(id)
			for(const cd of currentVertex.controlDependencies.filter(({ id }) => !queue.hasId(id))) {
				if(!topLevel || (idMap.get(cd.id)?.info.depth ?? 0) <= minDepth) {
					queue.add(cd.id, baseEnvironment, baseEnvFingerprint, false)
				}
			}
		}

		if(!onlyForSideEffects) {
			if(currentVertex.tag === VertexType.FunctionCall && !currentVertex.onlyBuiltin) {
				sliceForCall(current, currentVertex, graph, queue)
			}

			const ret = handleReturns(queue, currentEdges, baseEnvFingerprint, baseEnvironment)
			if(ret) {
				continue
			}
		}

		for(const [target, { types }] of currentEdges) {
			if(edgeIncludesType(types, EdgeType.NonStandardEvaluation)) {
				continue
			}
			const t = shouldTraverseEdge(types)
			if(t === TraverseEdge.Always) {
				queue.add(target, baseEnvironment, baseEnvFingerprint, false)
			} else if(t === TraverseEdge.DefinedByOnCall) {
				const n = queue.potentialArguments.get(target)
				if(n) {
					queue.add(target, n.baseEnvironment, envFingerprint(n.baseEnvironment), n.onlyForSideEffects)
					queue.potentialArguments.delete(target)
				}
			} else if(t === TraverseEdge.SideEffect) {
				queue.add(target, baseEnvironment, baseEnvFingerprint, true)
			}
		}
	}

	return { ...queue.status(), decodedCriteria }
}
