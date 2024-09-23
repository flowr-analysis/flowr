import { type DataflowInformation } from '../../info'
import type { DataflowProcessorInformation } from '../../processor'
import { processDataflowFor } from '../../processor'
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate'
import type { RFiles } from '../../../r-bridge/lang-4.x/ast/model/model'
import { guard } from '../../../util/assert'
import type { RParseRequests } from '../../../r-bridge/retriever'
import { isMultiFileRequest ,
	isSingleRequest
	, requestFingerprint } from '../../../r-bridge/retriever'
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import { overwriteEnvironment } from '../../environments/overwrite'

export function processFiles<OtherInfo>(value: RFiles<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const files = value.children
	const requests = data.currentRequest

	guard(isMultiFileRequest(requests) && requests.length === files.length, 'Mismatch between number of files and requests')

	let information = processDataflowFor<OtherInfo>(value.children[0], data)
	for(const file of files) {
		const i = file.info.index
		const request = requests[i] as RParseRequests
		const rootId: NodeId = `root-${i}`

		guard(isSingleRequest(request), 'Expected a single request')

		const dataflow = processDataflowFor<OtherInfo>(file, {
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

		information = newInformation
	}

	return information
}
