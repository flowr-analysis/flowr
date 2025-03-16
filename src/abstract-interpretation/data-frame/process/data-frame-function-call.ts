import type { BuiltInIdentifierProcessorDecorator } from '../../../dataflow/environments/built-in';
import type { RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { AbstractInterpretationInfo } from '../absint-info';

const DataFrameFunctionMapper = {
	'data.frame':    processDataFrameCreate,
	'as.data.frame': processDataFrameUnknownCreate,
	'read.csv':      processDataFrameUnknownCreate,
	'read.table':    processDataFrameUnknownCreate
} as const satisfies Record<string, BuiltInIdentifierProcessorDecorator<never>>;

const DataFrameSpecialArgumentsMapper = {
	'data.frame': ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'] as string[]
} as const satisfies Partial<Record<DataFrameFunction, string[]>>;

type DataFrameFunction = keyof typeof DataFrameFunctionMapper;

export function processDataFrameFunctionCall<OtherInfo>(
	name:   RSymbol<OtherInfo & ParentInformation>,
	args:   readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) {
	if(name.content in DataFrameFunctionMapper) {
		DataFrameFunctionMapper[name.content as DataFrameFunction]?.(name, args);
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
			arguments: args
				.filter(arg => !isSpecialArgument('data.frame', arg))
				.map(arg => arg !== EmptyArgument ? arg.info.id : undefined)
		}]
	};
}

function processDataFrameUnknownCreate<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>
) {
	name.info.dataFrame = {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   undefined,
			arguments: []
		}]
	};
}

function isSpecialArgument(funct: keyof typeof DataFrameSpecialArgumentsMapper, argument: RFunctionArgument<ParentInformation>) {
	if(argument === EmptyArgument || argument.name === undefined) {
		return false;
	}
	return DataFrameSpecialArgumentsMapper[funct].includes(argument.name.content);
}
