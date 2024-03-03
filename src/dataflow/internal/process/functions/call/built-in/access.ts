import type { NodeId, ParentInformation, RFunctionArgument, RSymbol } from '../../../../../../r-bridge'
import { EmptyArgument } from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import { processDataflowFor } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import { EdgeType } from '../../../../../graph'
import { makeAllMaybe } from '../../../../../environments'
import { dataflowLogger } from '../../../../../index'
import { guard } from '../../../../../../util/assert'

export function processAccess<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	information: DataflowInformation
): DataflowInformation {
	if(args.length < 2) {
		dataflowLogger.warn(`Access ${name.content} has less than 2 arguments, skipping`)
		return information
	}
	guard(args[0] !== EmptyArgument, () => `Access ${name.content} has no source, impossible!`)

	const processedAccessed = processDataflowFor(args[0], data)
	const nextGraph = processedAccessed.graph
	const outgoing = processedAccessed.out
	const ingoing = processedAccessed.in
	let environment = processedAccessed.environment

	const accessedNodes = processedAccessed.unknownReferences

	if(name.content === '[' || name.content === '[[') {
		for(const access of args.slice(1)) {
			if(access === EmptyArgument) {
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
