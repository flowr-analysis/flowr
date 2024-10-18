import { initializeCleanEnvironments } from '../../dataflow/environments/environment'
import { edgeIncludesType, EdgeType, shouldTraverseEdge, TraverseEdge } from '../../dataflow/graph/edge'
import type { DataflowGraph } from '../../dataflow/graph/graph'
import { VertexType } from '../../dataflow/graph/vertex'
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { guard } from '../../util/assert'
import { jsonReplacer } from '../../util/json'
import { expensiveTrace } from '../../util/log'
import { convertAllSlicingCriteriaToIds, type DicingCriterion, type SlicingCriteria } from '../criterion/parse'
import { envFingerprint } from './fingerprint'
import { handleReturns, sliceForCall } from './slice-call'
import type { SliceResult } from './slicer-types'
import { slicerLogger, staticSlicing } from './static-slicer'
import { VisitingQueue } from './visiting-queue'



export function staticDicing(graph: DataflowGraph, ast: NormalizedAst, endCriteria: DicingCriterion | undefined, startCriteria: DicingCriterion | undefined, threshold = 75):  Readonly<SliceResult> {
	guard(endCriteria !== undefined || startCriteria !== undefined, 'We need at least a starting or ending Criteria')
	
	let backwardsSlice: Readonly<SliceResult> | undefined = undefined
	let forwardSlice: Readonly<SliceResult> | undefined = undefined
	
	if(endCriteria !== undefined) {
		switch(endCriteria.type) {
			case 'union': {
				backwardsSlice = staticSlicing(graph, ast, endCriteria.criteria as SlicingCriteria, threshold)
				break
			}

			case 'intersection': {
				const slices: Readonly<SliceResult>[] = []
				for(const criteria of endCriteria.criteria) {
					slices.push(staticSlicing(graph, ast, [criteria], threshold))
				}
				backwardsSlice = slices.reduceRight((previousValue, currentValue, _currentIndex, _array) => {
					return {
						timesHitThreshold: previousValue.timesHitThreshold + currentValue.timesHitThreshold,
						result: 		         new Set([...previousValue.result].filter(i => currentValue.result.has(i))),
						decodedCriteria:   previousValue.decodedCriteria.concat(currentValue.decodedCriteria)
					}
				})
				console.log('slices: %s\nintersection: %s', JSON.stringify(slices.filter(s => s.result), jsonReplacer), JSON.stringify(backwardsSlice.result, jsonReplacer))
				break
			}
		
			case 'symetrical difference': {
				const union = staticSlicing(graph, ast, endCriteria.criteria as SlicingCriteria, threshold)
			
				const slices: Readonly<SliceResult>[] = []
				for(const criteria of endCriteria.criteria) {
					const partialSlice = staticSlicing(graph, ast, [criteria], threshold)
					slices.push(partialSlice)
				}
				const intersection = slices.reduceRight((previousValue, currentValue, _currentIndex, _array) => {
					return {
						timesHitThreshold: previousValue.timesHitThreshold + currentValue.timesHitThreshold,
						result: 		         new Set([...previousValue.result].filter(i => currentValue.result.has(i))),
						decodedCriteria:   previousValue.decodedCriteria.concat(currentValue.decodedCriteria)
					}
				})
			
				backwardsSlice = {
					timesHitThreshold: union.timesHitThreshold - intersection.timesHitThreshold,
					result:            new Set([...union.result].filter(i => !intersection.result.has(i))),
					decodedCriteria:   union.decodedCriteria.filter(i => !intersection.decodedCriteria.includes(i))
				}
				console.log('union: %s\nintersection: %s\ndifference: %s', JSON.stringify(union.result, jsonReplacer), JSON.stringify(intersection.result, jsonReplacer), JSON.stringify(backwardsSlice.result, jsonReplacer))
				break
			}
		}
	}
	if(startCriteria !== undefined) {
		switch(startCriteria.type) {
			case 'union': {
				forwardSlice = forwardSlicing(graph, ast, startCriteria.criteria as SlicingCriteria, threshold)
				break
			}

			case 'intersection': {
				const slices: Readonly<SliceResult>[] = []
				for(const criteria of startCriteria.criteria) {
					const partialSlice = forwardSlicing(graph, ast, [criteria], threshold)
					slices.push(partialSlice)
				}
				forwardSlice = slices.reduceRight((previousValue, currentValue, _currentIndex, _array) => {
					return {
						timesHitThreshold: previousValue.timesHitThreshold + currentValue.timesHitThreshold,
						result: 		         new Set([...previousValue.result].filter(i => currentValue.result.has(i))),
						decodedCriteria:   previousValue.decodedCriteria.concat(currentValue.decodedCriteria)
					}
				})
				console.log('slices: %s\nintersection: %s', JSON.stringify(slices.filter(s => s.result), jsonReplacer), JSON.stringify(forwardSlice.result, jsonReplacer))
				break
			}

			case 'symetrical difference': {
				const union = forwardSlicing(graph, ast, startCriteria.criteria as SlicingCriteria, threshold)

				const slices: Readonly<SliceResult>[] = []
				for(const criteria of startCriteria.criteria) {
					const partialSlice = forwardSlicing(graph, ast, [criteria], threshold)
					slices.push(partialSlice)
				}
				const intersection = slices.reduceRight((previousValue, currentValue, _currentIndex, _array) => {
					return {
						timesHitThreshold: previousValue.timesHitThreshold + currentValue.timesHitThreshold,
						result: 		         new Set([...previousValue.result].filter(i => currentValue.result.has(i))),
						decodedCriteria:   previousValue.decodedCriteria.concat(currentValue.decodedCriteria)
					}
				})

				forwardSlice = {
					timesHitThreshold: union.timesHitThreshold - intersection.timesHitThreshold,
					result:            new Set([...union.result].filter(i => !intersection.result.has(i))),
					decodedCriteria:   union.decodedCriteria.filter(i => !intersection.decodedCriteria.includes(i))
				}
				console.log('union: %s\nintersection: %s\ndifference: %s', JSON.stringify(union.result, jsonReplacer), JSON.stringify(intersection.result, jsonReplacer), JSON.stringify(forwardSlice.result, jsonReplacer))
				break
			}
		}
	}

	let dicingResult: Readonly<SliceResult> | undefined = undefined
	if(backwardsSlice === undefined) {
		dicingResult = forwardSlice
	} else if(forwardSlice === undefined) {
		dicingResult = backwardsSlice
	} else {
		const diceResult = new Set([...backwardsSlice.result].filter(i => forwardSlice.result.has(i)))
		//console.log(diceResult)
		dicingResult = { timesHitThreshold: backwardsSlice.timesHitThreshold + forwardSlice.timesHitThreshold, result: diceResult, decodedCriteria: backwardsSlice.decodedCriteria.concat(forwardSlice.decodedCriteria) }
	}
	return dicingResult as Readonly<SliceResult>
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

	for(const vertex of graph.vertices(true)) {
		if(vertex[1].tag === VertexType.FunctionDefinition) {
			console.log('functiondefinition: %s\nsubflow: %s', JSON.stringify(graph.get(vertex[0], true)), JSON.stringify(vertex[1].subflow.graph, jsonReplacer))
			for(const vertexId of vertex[1].subflow.graph) {
				if(queue.hasId(vertexId)) {
					console.log('Subflow in queue')
					//look at sliceForCall to add to queue
					const current = queue.potentialArguments.get(vertexId)
					if(current === undefined) {
						continue
					}
					console.log('current: %s', JSON.stringify(graph.get(current.id, true), jsonReplacer))
					const { baseEnvironment, id, onlyForSideEffects } = current
					const baseEnvFingerprint = envFingerprint(baseEnvironment)

					queue.add(id, baseEnvironment, baseEnvFingerprint, onlyForSideEffects)
				}
			}
		}
	}

	return { ...queue.status(), decodedCriteria }
}