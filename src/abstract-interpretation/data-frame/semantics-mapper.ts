import type { BuiltInMappingName, ConfigOfBuiltInMappingName } from '../../dataflow/environments/built-in';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { RFunctionArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { startAndEndsWith } from '../../util/strings';
import type { DataFrameInfo } from './absint-info';
import { resolveIdToArgName, resolveIdToArgVectorLength } from './resolve-args';

const ColNamesRegex = /^[A-Za-z.][A-Za-z0-9_.]*$/;

export const DataFrameProcessorMapper = {
	'builtin:default': mapDataFrameFunctionCall,
	// 'builtin:assignment': mapDataFrameAssignment
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
    args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	dfg: DataflowGraph,
) => DataFrameInfo;

type DataFrameFunction = keyof typeof DataFrameFunctionMapper;

function mapDataFrameFunctionCall<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.FunctionCall && node.named && node.functionName.content in DataFrameFunctionMapper) {
		const functionName = node.functionName.content as DataFrameFunction;
		const functionProcessor = DataFrameFunctionMapper[functionName];

		return functionProcessor(node.arguments, dfg);
	}
}

function mapDataFrameCreate<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	dfg: DataflowGraph
): DataFrameInfo {
	const info = { graph: dfg, idMap: dfg.idMap };
	const effectiveArgs = getEffectiveArgs('data.frame', args);

	const argNames = effectiveArgs.map(arg => arg ? resolveIdToArgName(arg, info) : undefined);
	const argLengths = effectiveArgs.map(arg => arg ? resolveIdToArgVectorLength(arg, info) : undefined);
	const colnames = argNames.map(unescapeArgument).map(arg => isValidColName(arg) ? arg : undefined);
	const rows = argLengths.every(arg => arg !== undefined) ? Math.max(...argLengths, 0) : undefined;

	return {
		type:       'expression',
		operations: [{
			operation: 'create',
			operand:   undefined,
			args:      { colnames, rows }
		}]
	};
}

function mapDataFrameUnknownCreate(): DataFrameInfo {
	return {
		type:       'expression',
		operations: [{
			operation: 'unknown',
			operand:   undefined,
			args:      undefined
		}]
	};
}

function getEffectiveArgs<OtherInfo>(
	funct: keyof typeof DataFrameIgnoredArgumentsMapper,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): readonly RFunctionArgument<OtherInfo & ParentInformation>[] {
	const ignoredArgs = DataFrameIgnoredArgumentsMapper[funct] ?? [];

	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !ignoredArgs.includes(arg.name.content));
}

function isValidColName(colname: string | undefined): boolean {
	return colname !== undefined && ColNamesRegex.test(colname);
}

function unescapeArgument(argument: undefined): undefined;
function unescapeArgument(argument: string): string;
function unescapeArgument(argument: string | undefined): string | undefined;
function unescapeArgument(argument: string | undefined): string | undefined {
	if(argument === undefined) {
		return undefined;
	} else if(startAndEndsWith(argument, '`') || startAndEndsWith(argument, '"') || startAndEndsWith(argument, '\'')) {
		return argument.slice(1, -1);
	}
	return argument;
}
