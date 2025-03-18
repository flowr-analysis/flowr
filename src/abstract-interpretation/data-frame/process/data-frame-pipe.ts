import { EmptyArgument, type RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { AbstractInterpretationInfo } from '../absint-info';
import { processDataFrameFunctionCall } from './data-frame-function-call';

export function processDataFramePipe<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[]
): void {
	const leftArg = args[0] !== EmptyArgument ? args[0] : undefined;
	const rightArg = args[1] !== EmptyArgument ? args[1] : undefined;

	if(leftArg !== undefined && rightArg?.value?.type === RType.FunctionCall && rightArg.value.named) {
		processDataFrameFunctionCall(rightArg.value.functionName, [leftArg, ...rightArg.value.arguments]);
		name.info.dataFrame = rightArg.value.functionName.info.dataFrame;
	} else {
		processDataFrameUnknownPipe(name, args);
	}
}

function processDataFrameUnknownPipe<OtherInfo>(
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
