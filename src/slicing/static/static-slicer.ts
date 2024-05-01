import type {
	DataflowGraph,
	OutgoingEdges,
	REnvironmentInformation } from '../../dataflow'
import {
	BuiltIn,
	EdgeType,
	initializeCleanEnvironments,
	shouldTraverseEdge,
	TraverseEdge,
	VertexType
} from '../../dataflow'
import { guard } from '../../util/assert'
import type { NormalizedAst } from '../../r-bridge'
import { expensiveTrace, log } from '../../util/log'
import type { SlicingCriteria } from '../criterion'
import { convertAllSlicingCriteriaToIds } from '../criterion'
import type { SliceResult } from './slicer-types'
import type { Fingerprint } from './fingerprint'
import { envFingerprint } from './fingerprint'
import { VisitingQueue } from './visiting-queue'
import { sliceForCall } from './slice-call'

export const slicerLogger = log.getSubLogger({ name: 'slicer' })

/** Returns true if we found at least one return edge */
function handleReturns(queue: VisitingQueue, currentEdges: OutgoingEdges, baseEnvFingerprint: Fingerprint, baseEnvironment: REnvironmentInformation): boolean {
	let found = false
	for(const [, edge] of currentEdges) {
		if(edge.types.has(EdgeType.Returns)) {
			found = true
			break
		}
	}
	if(!found) {
		return false
	}
	for(const [target, edge] of currentEdges) {
		if(edge.types.has(EdgeType.Returns)) {
			queue.add(target, baseEnvironment, baseEnvFingerprint, false)
		} else if(edge.types.has(EdgeType.Reads)) {
			queue.add(target, baseEnvironment, baseEnvFingerprint, false)
		} else if(edge.types.has(EdgeType.Argument)) {
			queue.potentialArguments.add(target)
		}
	}
	return true
}

/**
 * This returns the ids to include in the slice, when slicing with the given seed id's (must be at least one).
 * <p>
 * The returned ids can be used to {@link reconstructToCode|reconstruct the slice to R code}.
 */
export function staticSlicing(dataflowGraph: DataflowGraph, ast: NormalizedAst, criteria: SlicingCriteria, threshold = 75): Readonly<SliceResult> {
	guard(criteria.length > 0, 'must have at least one seed id to calculate slice')
	const decodedCriteria = convertAllSlicingCriteriaToIds(criteria, ast)
	expensiveTrace(slicerLogger, () =>`calculating slice for ${decodedCriteria.length} seed criteria: ${decodedCriteria.map(s => JSON.stringify(s)).join(', ')}`)
	const queue = new VisitingQueue(threshold)

	// every node ships the call environment which registers the calling environment
	{
		const emptyEnv = initializeCleanEnvironments()
		const basePrint = envFingerprint(emptyEnv)
		for(const startId of decodedCriteria) {
			queue.add(startId.id, emptyEnv, basePrint, false)
		}
	}

	while(queue.nonEmpty()) {
		const current = queue.next()

		const baseEnvironment = current.baseEnvironment
		const baseId = current.id
		const baseEnvFingerprint = envFingerprint(baseEnvironment)

		const currentInfo = dataflowGraph.get(baseId, true)
		if(currentInfo === undefined) {
			slicerLogger.warn(`id: ${baseId} must be in graph but can not be found, keep in slice to be sure`)
			continue
		}

		const [currentVertex, currentEdges] = currentInfo

		if(!current.onlyForSideEffects) {
			if(currentVertex.tag === VertexType.FunctionCall && !currentVertex.onlyBuiltin) {
				sliceForCall(current, currentVertex, dataflowGraph, queue)
			}

			const ret = handleReturns(queue, currentEdges, baseEnvFingerprint, baseEnvironment)
			if(ret) {
				continue
			}
		}

		for(const [target, edge] of currentEdges) {
			if(target === BuiltIn || edge.types.has(EdgeType.NonStandardEvaluation)) {
				continue
			}
			const t = shouldTraverseEdge(edge.types)
			if(t === TraverseEdge.Always) {
				queue.add(target, baseEnvironment, baseEnvFingerprint, false)
			} else if(t === TraverseEdge.DefinedByOnCall && queue.potentialArguments.has(target)) {
				queue.add(target, baseEnvironment, baseEnvFingerprint, false)
				queue.potentialArguments.delete(target)
			} else if(t === TraverseEdge.SideEffect) {
				queue.add(target, baseEnvironment, baseEnvFingerprint, true)
			}
		}

		if(currentVertex.controlDependency) {
			for(const cd of currentVertex.controlDependency) {
				queue.add(cd, baseEnvironment, baseEnvFingerprint, false)
			}
		}
	}

	return { ...queue.status(), decodedCriteria }
}


