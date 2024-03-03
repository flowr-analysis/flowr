import {
	linkCircularRedefinitionsWithinALoop,
	linkIngoingVariablesInSameScope,
	produceNameSharedIdMap
} from '../../linker'
import type { DataflowInformation } from '../../../info'
import type { DataflowProcessorInformation } from '../../../processor'
import { processDataflowFor } from '../../../processor'
import { appendEnvironment, define, makeAllMaybe, overwriteEnvironment } from '../../../environments'
import type { ParentInformation, RForLoop } from '../../../../r-bridge'
import { EdgeType } from '../../../graph'

export function processForLoop<OtherInfo>(
	loop: RForLoop<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	const variable = processDataflowFor(loop.variable, data)
	const vector = processDataflowFor(loop.vector, data)
	let headEnvironments = overwriteEnvironment(vector.environment, variable.environment)
	const headGraph= variable.graph.mergeWith(vector.graph)

	const writtenVariable = variable.unknownReferences
	for(const write of writtenVariable) {
		headEnvironments = define({ ...write, used: 'always', definedAt: loop.info.id, kind: 'variable' }, false, headEnvironments)
	}
	data = { ...data, environment: headEnvironments }
	const body = processDataflowFor(loop.body, data)

	const nextGraph = headGraph.mergeWith(body.graph)

	const outEnvironment = appendEnvironment(headEnvironments, body.environment)

	// again within an if-then-else we consider all actives to be read
	// currently i add it at the end, but is this correct?
	const ingoing = [...vector.in, ...makeAllMaybe(body.in, nextGraph, outEnvironment), ...vector.unknownReferences, ...makeAllMaybe(body.unknownReferences, nextGraph, outEnvironment)]


	// now we have to bind all open reads with the given name to the locally defined writtenVariable!
	const nameIdShares = produceNameSharedIdMap(ingoing)

	for(const write of writtenVariable) {
		for(const link of [...vector.in, ...vector.unknownReferences]) {
			nextGraph.addEdge(write.nodeId, link.nodeId, EdgeType.DefinedBy, 'always', true)
		}

		const name = write.name
		const readIdsToLink = nameIdShares.get(name)
		for(const readId of readIdsToLink) {
			nextGraph.addEdge(readId.nodeId, write.nodeId, EdgeType.Reads, 'always', true)
		}
		// now, we remove the name from the id shares as they are no longer needed
		nameIdShares.delete(name)
		nextGraph.setDefinitionOfVertex(write)
	}

	const outgoing = [...variable.out, ...writtenVariable, ...makeAllMaybe(body.out, nextGraph, outEnvironment)]

	linkIngoingVariablesInSameScope(nextGraph, ingoing)

	linkCircularRedefinitionsWithinALoop(nextGraph, nameIdShares, body.out)

	return {
		unknownReferences: [],
		// we only want those not bound by a local variable
		in:                [...variable.in, ...[...nameIdShares.values()].flat()],
		out:               outgoing,
		graph:             nextGraph,
		environment:       outEnvironment
	}
}
