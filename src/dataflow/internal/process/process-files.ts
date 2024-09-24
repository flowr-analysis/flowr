import { type DataflowInformation, initializeCleanDataflowInformation } from '../../info'
import type { DataflowProcessorInformation } from '../../processor'
import { processDataflowFor } from '../../processor'
import type {
	ParentInformation
} from '../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RFiles, RNode } from '../../../r-bridge/lang-4.x/ast/model/model'
import { guard } from '../../../util/assert'
import type { RParseRequest, RParseRequests } from '../../../r-bridge/retriever'
import {
	isMultiFileRequest,
	isSingleRequest,
	requestFingerprint
} from '../../../r-bridge/retriever'
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { overwriteEnvironment } from '../../environments/overwrite'

export function processFiles<OtherInfo>(value: RFiles<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const files = value.children
	const requests = data.currentRequest

	guard(isMultiFileRequest(requests) && requests.length === files.length, 'Mismatch between number of files and requests')

	let information = initializeCleanDataflowInformation(value.info.id, data)
	for(const file of files) {
		const i = file.info.index
		const request = requests[i] as RParseRequests
		guard(isSingleRequest(request), 'Expected a single request')

		information = processSingleFile(file, file.info.id, request, data, information)
	}

	return information
}

function processSingleFile<OtherInfo>(ast: RNode<OtherInfo & ParentInformation>, rootId: NodeId, request: RParseRequest, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, information: DataflowInformation): DataflowInformation {
	const dataflow = processDataflowFor(ast, {
		...data,
		currentRequest: request,
		environment:    information.environment,
		referenceChain: [...data.referenceChain, requestFingerprint(request)]
	})

	// take the entry point as well as all the written references, and give them a control dependency to the source call to show that they are conditional
	dataflow.graph.addControlDependency(dataflow.entryPoint, rootId)
	for(const out of dataflow.out) {
		dataflow.graph.addControlDependency(out.nodeId, rootId)
	}

	// update our graph with the sourced file's information
	const newInformation = { ...information }
	newInformation.environment = overwriteEnvironment(information.environment, dataflow.environment)
	newInformation.graph.mergeWith(dataflow.graph)
	return newInformation
}