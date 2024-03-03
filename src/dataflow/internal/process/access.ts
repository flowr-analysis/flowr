import type { DataflowProcessorInformation } from '../../processor'
import { processDataflowFor } from '../../processor'
import type { ParentInformation, RAccess } from '../../../r-bridge'
import type { DataflowInformation } from '../../info'
import { makeAllMaybe } from '../../environments'
import { EdgeType } from '../../graph'

export function processAccess<OtherInfo>(node: RAccess<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const processedAccessed = processDataflowFor(node.accessed, data)
	const nextGraph = processedAccessed.graph
	const outgoing = processedAccessed.out
	const ingoing = processedAccessed.in
	let environment = processedAccessed.environment

	const accessedNodes = processedAccessed.unknownReferences

	if(node.operator === '[' || node.operator === '[[') {
		for(const access of node.access) {
			if(!access?.value) {
				continue
			}
			data = { ...data, environment: environment }
			const processedAccess = processDataflowFor(access, data)

			nextGraph.mergeWith(processedAccess.graph)
			// outgoing.push()
			// we link to *out* instead of *in*, as access uses arguments for parsing and the arguments are defined
			for(const newIn of [...processedAccess.out, ...processedAccess.unknownReferences]) {
				for(const accessedNode of accessedNodes) {
					nextGraph.addEdge(accessedNode, newIn, EdgeType.Reads, 'always')
				}
			}
			ingoing.push(...processedAccess.in, ...processedAccess.unknownReferences)
			environment = processedAccess.environment
		}
	}

	return {
		/*
     * keep active nodes in case of assignments etc.
     * We make them maybe as a kind of hack.
     * This way when using
     * ```ts
     * a[[1]] <- 3
     * a[[2]] <- 4
     * a
     * ```
     * the read for a will use both accesses as potential definitions and not just the last one!
     */
		unknownReferences: makeAllMaybe(processedAccessed.unknownReferences, nextGraph, environment),
		in:                ingoing,
		out:               outgoing,
		environment:       environment,
		graph:             nextGraph
	}
}
