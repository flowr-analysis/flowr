import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
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
		processDataFrameSymbolAssignment(name, leftArg.value, rightArg.value);
	} else if(args.length === 2 && leftArg?.value?.type === RType.Access && rightArg !== undefined) {
		processDataFrameAccessAssignment(name, leftArg.value, rightArg);
	} else {
		processDataFrameUnknownAssignment(name, leftArg?.value, args.slice(1));
	}
}

function processDataFrameSymbolAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	leftArg: RSymbol<OtherInfo & ParentInformation>,
	rightArg: RNode<OtherInfo & ParentInformation>
) {
	name.info.dataFrame = {
		type:       'assignment',
		identifier: leftArg.info.id,
		expression: rightArg.info.id
	};
}

function processDataFrameAccessAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	leftArg: RAccess<OtherInfo & ParentInformation>,
	rightArg: RArgument<OtherInfo & ParentInformation>
) {
	if(leftArg.accessed.type === RType.Symbol && leftArg.operator === '$' && leftArg.access.length === 1) {
		return processDataFrameStringBasedColumnAssignment(name, leftArg.accessed, leftArg.access[0], rightArg);
	} else {
		return processDataFrameUnknownAssignment(name, leftArg.accessed, [...leftArg.access, rightArg]);
	}
}

function processDataFrameStringBasedColumnAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	leftArg: RSymbol<OtherInfo & ParentInformation>,
	accessArg: RArgument<OtherInfo & ParentInformation>,
	rightArg: RArgument<OtherInfo & ParentInformation>
) {
	name.info.dataFrame = {
		type:       'expression',
		operations: [{
			operation: 'assignCol',
			operand:   leftArg.info.id,
			arguments: [accessArg.info.id, rightArg.info.id],
			modify:    true
		}]
	};
}

function processDataFrameUnknownAssignment<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	operand: RNode<OtherInfo & ParentInformation> | undefined,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	name.info.dataFrame = {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   operand?.info.id,
			arguments: args.map(arg => arg !== EmptyArgument ? arg.info.id : undefined),
			modify:    true
		}]
	};
}
