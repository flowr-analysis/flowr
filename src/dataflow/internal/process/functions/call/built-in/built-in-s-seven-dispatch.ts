import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { ReferenceType } from '../../../../../environments/identifier';

/** Used to separate S7 dispatch info in identifiers */
export const S7DispatchSeparator = '﹕s3﹕';

/**
 * Process an S7 generic dispatch call like `S7_dispatch`.
 */
export function processS7Dispatch<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	if(!('currentS7name' in data) || !Array.isArray(data.currentS7name)) {
		return processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.S7Dispatch }).information;
	}
	const info = processKnownFunctionCall({ name, forceArgs: 'all', args, rootId, data, origin: BuiltInProcName.S7Dispatch }).information;
	for(const id of data.currentS7name as unknown[]) {
		if(typeof id === 'string') {
			const newIn = info.in.slice();
			newIn.push({ nodeId: rootId, name: id, cds: data.cds, type: ReferenceType.S7MethodPrefix });
			info.in = newIn;
		}
	}
	return info;
}
