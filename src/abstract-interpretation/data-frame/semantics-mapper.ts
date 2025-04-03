import type { BuiltInMappingName, ConfigOfBuiltInMappingName } from '../../dataflow/environments/built-in';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import { wrapArgumentsUnnamed } from '../../dataflow/internal/process/functions/call/argument/make-argument';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RFunctionArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { guard } from '../../util/assert';
import type { DataFrameInfo } from './absint-info';

// eslint-disable-next-line unused-imports/no-unused-vars
const DataFrameProcessorMapper = {
	'builtin:default':    mapDataFrameFunctionCall,
	'builtin:assignment': mapDataFrameAssignment
} as const satisfies Partial<DataFrameProcessorMapping>;

const DataFrameFunctionMapper = {
	'data.frame':    mapDataFrameCreate,
	'as.data.frame': mapDataFrameUnknownCreate,
	'read.csv':      mapDataFrameUnknownCreate,
	'read.table':    mapDataFrameUnknownCreate
} as const satisfies Record<string, DataFrameFunctionMapping>;

const DataFrameIgnoredArgumentsMapper: Partial<Record<DataFrameFunction | RAccess['operator'], string[]>> = {
	'data.frame': ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'],
	'[':          ['drop'],
	'[[':         ['exact']
};

type DataFrameProcessorMapping = {
	[Name in BuiltInMappingName]: DataFrameProcessor<ConfigOfBuiltInMappingName<Name>>
}

type DataFrameProcessor<Config> = <OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph,
	config: Config
) => DataFrameInfo | undefined;

type DataFrameFunctionMapping = <OtherInfo>(
    args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
) => DataFrameInfo;

type DataFrameFunction = keyof typeof DataFrameFunctionMapper;

function mapDataFrameFunctionCall<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>
): DataFrameInfo | undefined {
	if(node.type === RType.FunctionCall && node.named && node.functionName.content in DataFrameFunctionMapper) {
		const functionName = node.functionName.content as DataFrameFunction;
		const functionProcessor = DataFrameFunctionMapper[functionName];

		return functionProcessor(getEffectiveArgs(functionName, node.arguments));
	}
}

function mapDataFrameAssignment<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph,
): DataFrameInfo | undefined {
	guard(dfg.idMap !== undefined, 'AST id map must not be undefined');
	const args = getArguments(node, dfg.idMap) ?? [];

	const identifier = args[0] !== EmptyArgument ? args[0] : undefined;
	const expression = args[1] !== EmptyArgument ? args[1] : undefined;

	if(args.length === 2 && identifier?.value !== undefined && expression?.value !== undefined) {
		if(identifier.value.type === RType.Symbol) {
			return {
				type:       'assignment',
				identifier: identifier.value.info.id,
				expression: expression.value.info.id
			};
		} else if(identifier.value.type === RType.Access) {
			return mapDataFrameColRowAssignment(identifier.value, expression);
		}
	}
	return {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   identifier?.value?.info.id,
			arguments: args.slice(1).map(arg => arg !== EmptyArgument ? arg.info.id : undefined),
			modify:    true
		}]
	};
}

function mapDataFrameColRowAssignment<OtherInfo>(
	access: RAccess<OtherInfo & ParentInformation>,
	expression: RArgument<OtherInfo & ParentInformation>
): DataFrameInfo {
	const operand = access.accessed;
	const args = getEffectiveArgs(access.operator, access.access);

	if(args.length > 0 && args.every(arg => arg === EmptyArgument)) {
		return {
			type:       'expression',
			operations: [{
				operation: 'identity',
				operand:   operand.info.id,
				arguments: []
			}]
		};
	} else if(args.length > 0 && args.length <= 2) {
		const rowArg = args.length < 2 ? undefined : args[0];
		const colArg = args.length < 2 ? args[0] : args[1];
		const result: DataFrameInfo = { type: 'expression', operations: [] };

		if(rowArg !== undefined && rowArg !== EmptyArgument) {
			result.operations.push({
				operation: 'assignRow',
				operand:   operand.info.id,
				arguments: [rowArg.info.id]
			});
		}
		if(colArg !== undefined && colArg !== EmptyArgument) {
			result.operations.push({
				operation: 'assignCol',
				operand:   operand.info.id,
				arguments: [colArg.info.id]
			});
		}
		return result;
	}
	return {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   operand.info.id,
			arguments: [...args.map(arg => arg !== EmptyArgument ? arg.info.id : undefined), expression.info.id],
			modify:    true
		}]
	};
}

function mapDataFrameCreate<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): DataFrameInfo {
	return {
		type:       'expression',
		operations: [{
			operation: 'create',
			operand:   undefined,
			arguments: args.map(arg => arg !== EmptyArgument ? arg.info.id : undefined)
		}]
	};
}

function mapDataFrameUnknownCreate<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): DataFrameInfo {
	return {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   undefined,
			arguments: args.map(arg => arg !== EmptyArgument ? arg.info.id : undefined)
		}]
	};
}

function getArguments(
	node: RNode<ParentInformation>,
	idMap: AstIdMap<ParentInformation>
): RFunctionArgument<ParentInformation>[] | undefined {
	switch(node.type) {
		case RType.Access:
			return wrapArgumentsUnnamed([node.accessed, ...node.access], idMap);
		case RType.BinaryOp:
			return wrapArgumentsUnnamed([node.lhs, node.rhs], idMap);
		case RType.Pipe:
			return wrapArgumentsUnnamed([node.lhs, node.rhs], idMap);
		case RType.UnaryOp:
			return wrapArgumentsUnnamed([node.operand], idMap);
		case RType.FunctionCall:
			return wrapArgumentsUnnamed(node.arguments, idMap);
		default:
			return undefined;
	}
}

function getEffectiveArgs<OtherInfo>(
	funct: keyof typeof DataFrameIgnoredArgumentsMapper,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): readonly RFunctionArgument<OtherInfo & ParentInformation>[] {
	const ignoredArgs = DataFrameIgnoredArgumentsMapper[funct] ?? [];

	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !ignoredArgs.includes(arg.name.content));
}
