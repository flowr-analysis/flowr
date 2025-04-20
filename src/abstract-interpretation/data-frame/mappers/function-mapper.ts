import type { ResolveInfo } from '../../../dataflow/environments/resolve-by-name';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { VertexType } from '../../../dataflow/graph/vertex';
import { toUnnamedArgument } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RFunctionArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { startAndEndsWith } from '../../../util/strings';
import type { AbstractInterpretationInfo, DataFrameInfo } from '../absint-info';
import { DataFrameTop } from '../domain';
import { resolveIdToArgName, resolveIdToArgValue, resolveIdToArgVectorLength } from '../resolve-args';

const ColNamesRegex = /^[A-Za-z.][A-Za-z0-9_.]*$/;

const DataFrameFunctionMapper = {
	'data.frame':    mapDataFrameCreate,
	'as.data.frame': mapDataFrameUnknownCreate,
	'read.csv':      mapDataFrameUnknownCreate,
	'read.table':    mapDataFrameUnknownCreate,
	'cbind':         mapDataFrameColBind,
	'rbind':         mapDataFrameRowBind
} as const satisfies Record<string, DataFrameFunctionMapping>;

const SpecialFunctionArgumentsMapper: Partial<Record<DataFrameFunction, string[]>> = {
	'data.frame': ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors']
};

type DataFrameFunctionMapping = <OtherInfo>(
    args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
    info: ResolveInfo
) => DataFrameInfo | undefined;

type DataFrameFunction = keyof typeof DataFrameFunctionMapper;

export function mapDataFrameFunctionCall<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.FunctionCall && node.named && node.functionName.content in DataFrameFunctionMapper) {
		const args = getFunctionArguments(node, dfg);
		const functionName = node.functionName.content as DataFrameFunction;
		const functionProcessor = DataFrameFunctionMapper[functionName];

		return functionProcessor(args, { graph: dfg, idMap: dfg.idMap, full: true });
	}
}

function mapDataFrameCreate<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	info: ResolveInfo
): DataFrameInfo {
	const columnArgs = getEffectiveArgs('data.frame', args);

	const argNames = columnArgs.map(arg => arg ? resolveIdToArgName(arg, info) : undefined).map(unescapeArgument);
	const argLengths = columnArgs.map(arg => arg ? resolveIdToArgVectorLength(arg, info) : undefined);
	const colnames = argNames.map(arg => isValidColName(arg) ? arg : undefined);
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
			args:      { creation: true }
		}]
	};
}

function mapDataFrameColBind<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	info: ResolveInfo
): DataFrameInfo | undefined {
	const dataFrame = args.find(isDataFrameArgument);

	if(dataFrame === undefined || dataFrame === EmptyArgument || dataFrame.value === undefined) {
		return;
	} else if(args.length === 1) {
		return {
			type:       'expression',
			operations: [{
				operation: 'identity',
				operand:   dataFrame.value.info.id,
				args:      {}
			}]
		};
	}
	const result: DataFrameInfo = { type: 'expression', operations: [] };
	let operand: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo> | undefined = dataFrame.value;
	let colnames: (string | undefined)[] | undefined = [];

	for(const arg of args) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			if(arg.value !== undefined && isDataFrameArgument(arg)) {
				const other = arg.value.info.dataFrame?.domain?.get(arg.value.info.id) ?? DataFrameTop;

				result.operations.push({
					operation: 'concatCols',
					operand:   operand?.info.id,
					args:      { other: other }
				});
				operand = undefined;
			// Added columns are unknown if argument cannot be resolved to constant (vector-like) value
			} else if(resolveIdToArgValue(arg, info) !== undefined) {
				const colname = unescapeArgument(resolveIdToArgName(arg, info));
				colnames?.push(colname);
			} else {
				colnames = undefined;
			}
		}
	}
	if(colnames === undefined || colnames.length > 0) {
		result.operations.push({
			operation: 'addCols',
			operand:   operand?.info.id,
			args:      { colnames: colnames }
		});
	}
	return result;
}

function mapDataFrameRowBind<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	info: ResolveInfo
): DataFrameInfo | undefined {
	const dataFrame = args.find(isDataFrameArgument);

	if(dataFrame === undefined || dataFrame === EmptyArgument || dataFrame.value === undefined) {
		return;
	} else if(args.length === 1) {
		return {
			type:       'expression',
			operations: [{
				operation: 'identity',
				operand:   dataFrame.value.info.id,
				args:      {}
			}]
		};
	}
	const result: DataFrameInfo = { type: 'expression', operations: [] };
	let operand: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo> | undefined = dataFrame.value;
	let rows: number | undefined = 0;

	for(const arg of args) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			if(arg.value !== undefined && isDataFrameArgument(arg)) {
				const other = arg.value.info.dataFrame?.domain?.get(arg.value.info.id) ?? DataFrameTop;

				result.operations.push({
					operation: 'concatRows',
					operand:   operand?.info.id,
					args:      { other: other }
				});
				operand = undefined;
			// Number of added rows is unknown if arguments cannot be resolved to constant (vector-like) value
			} else if(resolveIdToArgValue(arg, info) !== undefined) {
				rows = rows !== undefined ? rows + 1 : undefined;
			} else {
				rows = undefined;
			}
		}
	}
	if(rows === undefined || rows > 0) {
		result.operations.push({
			operation: 'addRows',
			operand:   operand?.info.id,
			args:      { rows: rows }
		});
	}
	return result;
}

function getFunctionArguments(
	node: RFunctionCall<ParentInformation>,
	dfg: DataflowGraph
): readonly RFunctionArgument<ParentInformation>[] {
	const vertex = dfg.getVertex(node.info.id);

	if(vertex?.tag === VertexType.FunctionCall && dfg.idMap !== undefined) {
		const idMap = dfg.idMap;

		return vertex.args
			.map(arg => arg === EmptyArgument ? arg : dfg.idMap?.get(arg.nodeId))
			.map(arg => arg === EmptyArgument || arg?.type === RType.Argument ? arg : toUnnamedArgument(arg, idMap));
	}
	return node.arguments;
}

function getEffectiveArgs<OtherInfo>(
	funct: keyof typeof SpecialFunctionArgumentsMapper,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[]
): readonly RFunctionArgument<OtherInfo & ParentInformation>[] {
	const ignoredArgs = SpecialFunctionArgumentsMapper[funct] ?? [];

	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !ignoredArgs.includes(arg.name.content));
}

function isDataFrameArgument<OtherInfo>(
	arg: RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>
): boolean {
	if(arg === EmptyArgument || arg.value === undefined) {
		return false;
	}
	return arg.value.info.dataFrame?.domain?.get(arg.value.info.id) !== undefined;
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
