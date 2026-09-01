import type { DataflowInformation } from '../../../../info';
import type { DataflowProcessorInformation } from '../../../../processor';
import { processNamedCall } from './named-call-handling';
import { processUnnamedFunctionCall } from './unnamed-call-handling';
import { processChainedCall } from '../../process-named-call';
import type { ParentInformation } from '../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionCall } from '../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

/**
 * Processes a function call, either named or unnamed.
 * @see {@link processNamedCall}
 * @see {@link processUnnamedFunctionCall}
 */
export function processFunctionCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	if(functionCall.named) {
		// magrittr-style `%op%` calls (e.g. `%>%`) are normalized as named calls, but chain left-associatively
		// through their first argument just like a binary operator or pipe, so they fold instead of recursing
		if(functionCall.infixSpecial === true && functionCall.arguments.length === 2) {
			return processChainedCall(functionCall, data);
		}
		return processNamedCall(functionCall.functionName, functionCall.arguments, functionCall.info.id, data);
	} else {
		return processUnnamedFunctionCall(functionCall, data);
	}
}
