import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { AbstractInterpretationInfo } from '../absint-info';

export function processDataFrameAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	const leftArg = args[0] !== EmptyArgument ? args[0] : undefined;
	const rightArg = args[1] !== EmptyArgument ? args[1] : undefined;

	if(args.length === 2 && leftArg?.value?.type === RType.Symbol && rightArg?.value !== undefined) {
		name.info.dataFrame = {
			type:       'assignment',
			identifier: leftArg.value.info.id,
			expression: rightArg.value.info.id
		};
	} else {
		processDataFrameUnknownAssignment(name, args);
	}
}

function processDataFrameUnknownAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	name.info.dataFrame = {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   args[0] !== EmptyArgument ? args[0]?.value?.info.id : undefined,
			arguments: args.slice(1).map(arg => arg !== EmptyArgument ? arg.info.id : undefined),
			modify:    true
		}]
	};
}
