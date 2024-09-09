import type { DataflowProcessorInformation } from '../../../../../processor'
import { processDataflowFor } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import { filterOutLoopExitPoints, alwaysExits } from '../../../../../info'
import {
	findNonLocalReads,
	linkCircularRedefinitionsWithinALoop,
	produceNameSharedIdMap
} from '../../../../linker'
import { processKnownFunctionCall } from '../known-call-handling'
import { guard } from '../../../../../../util/assert'
import { patchFunctionCall } from '../common'
import { unpackArgument } from '../argument/unpack-argument'
import { dataflowLogger } from '../../../../../logger'
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call'
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { overwriteEnvironment } from '../../../../../environments/overwrite'
import { define } from '../../../../../environments/define'
import { appendEnvironment } from '../../../../../environments/append'
import { makeAllMaybe } from '../../../../../environments/environment'
import { EdgeType } from '../../../../../graph/edge'
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol'

export function processForLoop<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(args.length !== 3) {
		dataflowLogger.warn(`For-Loop ${name.content} does not have three arguments, skipping`)
		return processKnownFunctionCall({ name, args, rootId, data }).information
	}

	const [variableArg, vectorArg, bodyArg] = args.map(unpackArgument)

	guard(variableArg !== undefined && vectorArg !== undefined && bodyArg !== undefined, () => `For-Loop ${JSON.stringify(args)} has missing arguments! Bad!`)
	const vector = processDataflowFor(vectorArg, data)
	if(alwaysExits(vector)) {
		dataflowLogger.warn(`For-Loop ${rootId} forces exit in vector, skipping rest`)
		return vector
	}

	const variable = processDataflowFor(variableArg, data)
	// this should not be able to exit always!

	const originalDependency = data.controlDependencies
	data = { ...data, controlDependencies: [...data.controlDependencies ?? [], { id: name.info.id, when: true }] }

	let headEnvironments = overwriteEnvironment(vector.environment, variable.environment)
	const headGraph = variable.graph.mergeWith(vector.graph)

	const writtenVariable = [...variable.unknownReferences, ...variable.in]
	for(const write of writtenVariable) {
		headEnvironments = define({ ...write, definedAt: name.info.id, kind: 'variable' }, false, headEnvironments)
	}
	data = { ...data, environment: headEnvironments }

	const body = processDataflowFor(bodyArg, data)

	const nextGraph = headGraph.mergeWith(body.graph)
	const outEnvironment = appendEnvironment(headEnvironments, body.environment)

	// now we have to identify all reads that may be effected by a circular redefinition
	// for this, we search for all reads with a non-local read resolve!
	const nameIdShares = produceNameSharedIdMap(findNonLocalReads(nextGraph))

	for(const write of writtenVariable) {
		nextGraph.addEdge(write.nodeId, vector.entryPoint, { type: EdgeType.DefinedBy })
		nextGraph.setDefinitionOfVertex(write)
	}

	const outgoing = [...variable.out, ...writtenVariable, ...makeAllMaybe(body.out, nextGraph, outEnvironment, true)]

	linkCircularRedefinitionsWithinALoop(nextGraph, nameIdShares, body.out)

	patchFunctionCall({
		nextGraph,
		rootId,
		name,
		data:                  { ...data, controlDependencies: originalDependency },
		argumentProcessResult: [variable, vector, body]
	})
	/* mark the last argument as nse */
	nextGraph.addEdge(rootId, body.entryPoint, { type: EdgeType.NonStandardEvaluation })
	// as the for-loop always evaluates its variable and condition
	nextGraph.addEdge(name.info.id, variable.entryPoint, { type: EdgeType.Reads })
	nextGraph.addEdge(name.info.id, vector.entryPoint, { type: EdgeType.Reads })

	return {
		unknownReferences: [],
		// we only want those not bound by a local variable
		in:                [{ nodeId: rootId, name: name.content, controlDependencies: originalDependency }, ...variable.in, ...vector.in, ...vector.unknownReferences, ...[...nameIdShares.values()].flat()],
		out:               outgoing,
		graph:             nextGraph,
		entryPoint:        name.info.id,
		exitPoints:        filterOutLoopExitPoints(body.exitPoints),
		environment:       outEnvironment
	}
}
