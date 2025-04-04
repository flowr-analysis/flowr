import type { ForceArguments } from '../../../dataflow/internal/process/functions/call/common';
import type { DataflowProcessorInformation } from '../../../dataflow/processor';
import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AbstractInterpretationInfo } from '../absint-info';

export function processDataFrameAccess<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { treatIndicesAsString: boolean } & ForceArguments
) {
	if(config.treatIndicesAsString) {
		processDataFrameStringBasedAccess(name, args);
	} else {
		processDataFrameUnknownAccess(name, args);
	}
}

function processDataFrameStringBasedAccess<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	const leftArg = args[0] !== EmptyArgument ? args[0] : undefined;
	const rightArg = args[1] !== EmptyArgument ? args[1] : undefined;

	if(args.length === 2 && leftArg?.value !== undefined && rightArg !== undefined) {
		name.info.dataFrame = {
			type:       'expression',
			operations: [{
				operation: 'accessCol',
				operand:   leftArg.value.info.id,
				arguments: [rightArg.info.id]
			}]
		};
	} else {
		processDataFrameUnknownAccess(name, args);
	}
}

function processDataFrameUnknownAccess<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	name.info.dataFrame = {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   args[0] !== EmptyArgument ? args[0]?.value?.info.id : undefined,
			arguments: args.slice(1).map(arg => arg !== EmptyArgument ? arg.info.id : undefined)
		}]
	};
}
