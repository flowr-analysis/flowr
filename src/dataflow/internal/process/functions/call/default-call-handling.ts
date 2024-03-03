import type { DataflowInformation } from '../../../../info'
import type { DataflowProcessorInformation } from '../../../../processor'
import type { ParentInformation, RFunctionCall } from '../../../../../r-bridge'
import { processKnownFunctionCall } from './known-call-handling'
import { processUnnamedFunctionCall } from './unnamed-call-handling'


export function processFunctionCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	// TODO: track name
	if(functionCall.flavor === 'named') {
		return processKnownFunctionCall(functionCall, data)
	} else {
		return processUnnamedFunctionCall(functionCall, data)
	}
}
