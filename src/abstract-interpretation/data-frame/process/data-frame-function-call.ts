import type { BuiltInIdentifierProcessorDecorator } from '../../../dataflow/environments/built-in';
import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { AbstractInterpretationInfo } from '../absint-info';

const DataFrameFunctionMapper = {
	'data.frame': processDataFrameCreate
} as const satisfies Record<string, BuiltInIdentifierProcessorDecorator<never>>;

const DataFrameSpecialArgumentsMapper: Partial<Record<DataFrameFunction, string[]>> = {
	'data.frame': ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors']
};

type DataFrameFunction = keyof typeof DataFrameFunctionMapper;

export function processDataFrameFunctionCall<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	if(name.content in DataFrameFunctionMapper) {
		const functionName = name.content as DataFrameFunction;
		const functionProcessor = DataFrameFunctionMapper[functionName];
		functionProcessor(name, getEffectiveArgs(functionName, args));
	} else {
		processDataFrameUnknownCall(name, args);
	}
}

function processDataFrameCreate<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	name.info.dataFrame = {
		type:       'expression',
		operations: [{
			operation: 'create',
			operand:   undefined,
			arguments: args.map(arg => arg !== EmptyArgument ? arg.info.id : undefined)
		}]
	};
}

function processDataFrameUnknownCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	name.info.dataFrame = {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   undefined,
			arguments: args.map(arg => arg !== EmptyArgument ? arg.info.id : undefined)
		}]
	};
}

function getEffectiveArgs<OtherInfo>(
	funct: DataFrameFunction,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): readonly RFunctionArgument<OtherInfo & ParentInformation>[] {
	const specialArgs = DataFrameSpecialArgumentsMapper[funct] ?? [];

	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !specialArgs.includes(arg.name.content));
}
