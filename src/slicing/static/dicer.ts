import { initializeCleanEnvironments } from '../../dataflow/environments/environment'
import { edgeIncludesType, EdgeType, shouldTraverseEdge, TraverseEdge } from '../../dataflow/graph/edge'
import type { DataflowGraph } from '../../dataflow/graph/graph'
import { VertexType } from '../../dataflow/graph/vertex'
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { guard } from '../../util/assert'
import { expensiveTrace } from '../../util/log'
import { convertAllSlicingCriteriaToIds, type SlicingCriteria } from '../criterion/parse'
import { envFingerprint } from './fingerprint'
import { handleReturns, sliceForCall } from './slice-call'
import type { SliceResult } from './slicer-types'
import { slicerLogger, staticSlicing } from './static-slicer'
import { VisitingQueue } from './visiting-queue'



export function staticDicing(graph: DataflowGraph, ast: NormalizedAst, endCriteria: SlicingCriteria, startCriteria: SlicingCriteria, threshold = 75):  Readonly<SliceResult> {
	const backwardsSlice = staticSlicing(graph, ast, endCriteria, threshold)
	const forwardSlice = forwardSlicing(graph, ast, startCriteria, threshold)

	const dicingResult = { timesHitThreshold: backwardsSlice.timesHitThreshold + forwardSlice.timesHitThreshold, result: new Set([...backwardsSlice.result].filter(i => forwardSlice.result.has(i))), decodedCriteria: backwardsSlice.decodedCriteria.concat(forwardSlice.decodedCriteria) }
	return dicingResult
}

function forwardSlicing(graph: DataflowGraph, ast: NormalizedAst, criteria: SlicingCriteria, threshold = 75): Readonly<SliceResult> {
	const idMap = ast.idMap

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
	}

	const visitedIds = []
	while(queue.nonEmpty()) {
		const current = queue.next()
		const { baseEnvironment, id, onlyForSideEffects } = current
		const baseEnvFingerprint = envFingerprint(baseEnvironment)

		//This is for debug only
		visitedIds.push(id)

		const currentInfo = graph.get(id, true)
		if(currentInfo === undefined) {
			slicerLogger.warn(`id: ${id} must be in graph but can not be found, keep in slice to be sure`)
			continue
		}

		const [currentVertex, currentEdges] = currentInfo
		const ingoingEdges = graph.ingoingEdges(id)
		if(ingoingEdges === undefined) {
			continue
		}

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

		for(const [target, { types }] of ingoingEdges) {
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
	//console.log('\n\nvisitedIds: %s\n\n', visitedIds)

	return { ...queue.status(), decodedCriteria }
}