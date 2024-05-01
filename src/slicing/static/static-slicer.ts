import type { DataflowGraph } from '../../dataflow'
import { BuiltIn, shouldTraverseEdge, EdgeType, initializeCleanEnvironments } from '../../dataflow'
import { guard } from '../../util/assert'
import type { NormalizedAst } from '../../r-bridge'
import { expensiveTrace, log } from '../../util/log'
import type { SlicingCriteria } from '../criterion'
import { convertAllSlicingCriteriaToIds } from '../criterion'
import type { SliceResult } from './slicer-types'
import { envFingerprint } from './fingerprint'
import { VisitingQueue } from './visiting-queue'
import { sliceForCall } from './slice-call'

export const slicerLogger = log.getSubLogger({ name: 'slicer' })

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

		if(currentVertex.tag === 'function-call' && !currentVertex.onlyBuiltin && !current.onlyForSideEffects) {
			sliceForCall(current, currentVertex, dataflowGraph, queue)
		}

		if(!current.onlyForSideEffects) {
			const returns = [...currentEdges].filter(([_, edge]) => edge.types.has(EdgeType.Returns))
			if(returns.length >= 1) {

				for(const [target, _] of returns) {
					queue.add(target, baseEnvironment, baseEnvFingerprint, false)
				}
				// add all arguments to the list of 'maybes' - they will be added when we get them with a 'defined-by-on-call' edge
				for(const [target, edge] of currentEdges) {
					if(edge.types.has(EdgeType.Reads)) {
						queue.add(target, baseEnvironment, baseEnvFingerprint, false)
					} else if(edge.types.has(EdgeType.Argument)) {
						queue.potentialArguments.add(target)
					}
				}
				continue
			}
		}

		for(const [target, edge] of currentEdges) {
			if(target === BuiltIn || edge.types.has(EdgeType.NonStandardEvaluation)) {
				continue
			}
			if(shouldTraverseEdge(edge.types)) {
				queue.add(target, baseEnvironment, baseEnvFingerprint, false)
			} else if(edge.types.has(EdgeType.SideEffectOnCall)) {
				queue.add(target, baseEnvironment, baseEnvFingerprint, true)
			} else if(edge.types.has(EdgeType.DefinedByOnCall) && queue.potentialArguments.has(target)) {
				queue.add(target, baseEnvironment, baseEnvFingerprint, false)
				queue.potentialArguments.delete(target)
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


