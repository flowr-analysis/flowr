import type { ResolveInfo } from '../../../dataflow/environments/resolve-by-name';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { isUseVertex, VertexType } from '../../../dataflow/graph/vertex';
import { toUnnamedArgument } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RFunctionArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { startAndEndsWith } from '../../../util/strings';
import type { AbstractInterpretationInfo, DataFrameInfo, DataFrameOperations } from '../absint-info';
import { DataFrameTop } from '../domain';
import { resolveIdToArgName, resolveIdToArgValue, resolveIdToArgValueSymbolName, resolveIdToArgVectorLength } from '../resolve-args';

const ColNamesRegex = /^[A-Za-z.][A-Za-z0-9_.]*$/;

const DataFrameFunctionMapper = {
	'data.frame':    mapDataFrameCreate,
	'as.data.frame': mapDataFrameUnknownCreate,
	'read.csv':      mapDataFrameUnknownCreate,
	'read.table':    mapDataFrameUnknownCreate,
	'cbind':         mapDataFrameColBind,
	'rbind':         mapDataFrameRowBind,
	'head':          mapDataFrameHeadTail,
	'tail':          mapDataFrameHeadTail,
	'subset':        mapDataFrameSubset,
	'filter':        mapDataFrameFilter,
	'select':        mapDataFrameSelect
} as const satisfies Record<string, DataFrameFunctionMapping>;

const SpecialFunctionArgumentsMapper: Partial<Record<DataFrameFunction, string[]>> = {
	'data.frame': ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'],
	'cbind':      ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude'],
	'rbind':      ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude'],
	'head':       ['addrownums'],
	'tail':       ['addrownums'],
	'subset':     ['drop'],
	'filter':     ['.by', '.preserve'],
	'select':     []
};

type DataFrameFunctionMapping = <OtherInfo>(
    args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	effectiveArgs: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
    info: ResolveInfo
) => DataFrameOperations[] | undefined;

type DataFrameFunction = keyof typeof DataFrameFunctionMapper;

export function mapDataFrameFunctionCall<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.FunctionCall && node.named && node.functionName.content in DataFrameFunctionMapper) {
		const functionName = node.functionName.content as DataFrameFunction;
		const args = getFunctionArguments(node, dfg);
		const effectiveArgs = getEffectiveArgs(functionName, args);
		const functionProcessor = DataFrameFunctionMapper[functionName];

		const operations = functionProcessor(args, effectiveArgs, { graph: dfg, idMap: dfg.idMap, full: true });

		if(operations !== undefined) {
			return { type: 'expression', operations: operations };
		}
	}
}

function mapDataFrameCreate<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	effectiveArgs: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] {
	const argNames = effectiveArgs.map(arg => arg ? resolveIdToArgName(arg, info) : undefined).map(unescapeArgument);
	const argLengths = effectiveArgs.map(arg => arg ? resolveIdToArgVectorLength(arg, info) : undefined);
	const colnames = argNames.map(arg => isValidColName(arg) ? arg : undefined);
	const rows = argLengths.every(arg => arg !== undefined) ? Math.max(...argLengths, 0) : undefined;

	return [{
		operation: 'create',
		operand:   undefined,
		args:      { colnames, rows }
	}];
}

function mapDataFrameUnknownCreate(): DataFrameOperations[] {
	return [{
		operation: 'unknown',
		operand:   undefined,
		args:      { creation: true }
	}];
}

function mapDataFrameColBind<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	effectiveArgs: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = effectiveArgs.find(isDataFrameArgument);

	if(dataFrame?.value === undefined) {
		return;
	} else if(effectiveArgs.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	let operand: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo> | undefined = dataFrame.value;
	let colnames: (string | undefined)[] | undefined = [];

	for(const arg of effectiveArgs) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			if(arg.value !== undefined && isDataFrameArgument(arg)) {
				const other = arg.value.info.dataFrame?.domain?.get(arg.value.info.id) ?? DataFrameTop;

				result.push({
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
		result.push({
			operation: 'addCols',
			operand:   operand?.info.id,
			args:      { colnames: colnames }
		});
	}
	return result;
}

function mapDataFrameRowBind<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	effectiveArgs: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = effectiveArgs.find(isDataFrameArgument);

	if(dataFrame?.value === undefined) {
		return;
	} else if(effectiveArgs.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	let operand: RNode<OtherInfo & ParentInformation & AbstractInterpretationInfo> | undefined = dataFrame.value;
	let rows: number | undefined = 0;

	for(const arg of effectiveArgs) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			if(arg.value !== undefined && isDataFrameArgument(arg)) {
				const other = arg.value.info.dataFrame?.domain?.get(arg.value.info.id) ?? DataFrameTop;

				result.push({
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
		result.push({
			operation: 'addRows',
			operand:   operand?.info.id,
			args:      { rows: rows }
		});
	}
	return result;
}

function mapDataFrameHeadTail<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	effectiveArgs: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = effectiveArgs[0];

	if(!isDataFrameArgument(dataFrame) || dataFrame.value === undefined) {
		return;
	} else if(effectiveArgs.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const amountArg = effectiveArgs.find(arg => resolveIdToArgName(arg, info) === 'n') ?? effectiveArgs[1];
	const amountValue: unknown = resolveIdToArgValue(amountArg, info);
	let rows: number | undefined = undefined;
	let cols: number | undefined = undefined;

	if(typeof amountValue === 'number') {
		rows = amountValue;
	} else if(Array.isArray(amountValue) && amountValue.length <= 2 && amountValue.every(entry => typeof entry === 'number')) {
		rows = amountValue[0];
		cols = amountValue[1];
	}
	result.push({
		operation: rows === undefined || rows >= 0 ? 'subsetRows' : 'removeRows',
		operand:   dataFrame.value.info.id,
		args:      { rows: rows !== undefined ? Math.abs(rows) : undefined }
	});

	if(cols !== undefined) {
		result.push({
			operation: cols >= 0 ? 'subsetCols' : 'removeCols',
			operand:   undefined,
			args:      { colnames: Array(Math.abs(cols)).fill(undefined) }
		});
	}
	return result;
}

function mapDataFrameSubset<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	effectiveArgs: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = effectiveArgs[0];

	if(!isDataFrameArgument(dataFrame) || dataFrame.value === undefined) {
		return;
	} else if(effectiveArgs.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	let operand: RNode<OtherInfo & ParentInformation> | undefined = dataFrame.value;

	const filterArg = effectiveArgs.find(arg => resolveIdToArgName(arg, info) === 'subset')
		?? effectiveArgs.find(arg => arg !== dataFrame && resolveIdToArgName(arg, info) === undefined)
		?? EmptyArgument;
	const filterValue = resolveIdToArgValue(filterArg, info);

	const selectArg = effectiveArgs.find(arg => resolveIdToArgName(arg, info) === 'select')
		?? effectiveArgs.find(arg => arg !== dataFrame && arg !== filterArg && resolveIdToArgName(arg, info) === undefined)
		?? EmptyArgument;

	const colnames = [...getUnresolvedSymbolsInExpression(filterArg, info), ...getUnresolvedSymbolsInExpression(selectArg, info)];
	const condition = typeof filterValue === 'boolean' ? filterValue : undefined;

	if(colnames.length > 0) {
		result.push({
			operation: 'accessCol',
			operand:   operand?.info.id,
			args:      { columns: colnames }
		});
	}

	if(filterArg !== EmptyArgument) {
		result.push({
			operation: 'filterRows',
			operand:   operand?.info.id,
			args:      { condition: condition }
		});
		operand = undefined;
	}
	let selectedCols: (string | undefined)[] | undefined = [];
	let unselectedCols: (string | undefined)[] = [];

	if(selectArg !== EmptyArgument) {
		if(selectArg.value?.type === RType.FunctionCall && selectArg.value.named && selectArg.value.functionName.content === 'c') {
			selectArg.value.arguments.forEach(arg => {
				if(arg !== EmptyArgument && arg.value?.type === RType.UnaryOp && arg.value.operator === '-' && info.idMap !== undefined) {
					const operandArg = toUnnamedArgument(arg.value.operand, info.idMap);
					unselectedCols?.push(resolveIdToArgValueSymbolName(operandArg, info));
				} else if(arg !== EmptyArgument && (arg.value?.type === RType.Symbol || arg.value?.type === RType.String)) {
					selectedCols?.push(resolveIdToArgValueSymbolName(arg, info));
				} else {
					selectedCols?.push(undefined);
				}
			});
		} else if(selectArg.value?.type === RType.UnaryOp && selectArg.value.operator === '-' && info.idMap !== undefined) {
			const operandArg = toUnnamedArgument(selectArg.value.operand, info.idMap);
			unselectedCols = [resolveIdToArgValueSymbolName(operandArg, info)];
		} else if(selectArg.value?.type === RType.Symbol || selectArg.value?.type === RType.String) {
			selectedCols = [resolveIdToArgValueSymbolName(selectArg, info)];
		} else {
			selectedCols = undefined;
		}
	}

	if(unselectedCols.length > 0) {
		result.push({
			operation: 'removeCols',
			operand:   operand?.info.id,
			args:      { colnames: unselectedCols }
		});
		operand = undefined;
	}
	if(selectedCols == undefined || selectedCols.length > 0) {
		result.push({
			operation: 'subsetCols',
			operand:   operand?.info.id,
			args:      { colnames: selectedCols }
		});
		operand = undefined;
	}
	return result;
}

function mapDataFrameFilter<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	effectiveArgs: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = effectiveArgs[0];

	if(!isDataFrameArgument(dataFrame) || dataFrame.value === undefined) {
		return;
	} else if(effectiveArgs.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const filterArg = effectiveArgs[1];
	const filterValue = resolveIdToArgValue(filterArg, info);
	const colnames = getUnresolvedSymbolsInExpression(filterArg, info);
	const condition = typeof filterValue === 'boolean' && effectiveArgs.length === 2 ? filterValue : undefined;

	if(colnames.length > 0) {
		result.push({
			operation: 'accessCol',
			operand:   dataFrame.value.info.id,
			args:      { columns: colnames }
		});
	}

	result.push({
		operation: 'filterRows',
		operand:   dataFrame.value.info.id,
		args:      { condition: condition }
	});
	return result;
}

function mapDataFrameSelect<OtherInfo>(
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	effectiveArgs: readonly RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = effectiveArgs[0];

	if(!isDataFrameArgument(dataFrame) || dataFrame.value === undefined) {
		return;
	} else if(effectiveArgs.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	let operand: RNode<OtherInfo & ParentInformation> | undefined = dataFrame.value;

	const selectedCols: (string | undefined)[] = [];
	const unselectedCols: (string | undefined)[] = [];

	for(const arg of effectiveArgs) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			if(arg.value?.type === RType.UnaryOp && arg.value.operator === '-' && info.idMap !== undefined) {
				const operandArg = toUnnamedArgument(arg.value.operand, info.idMap);
				unselectedCols.push(resolveIdToArgValueSymbolName(operandArg, info));
			} else {
				selectedCols.push(resolveIdToArgValueSymbolName(arg, info));
			}
		}
	}

	if([...selectedCols, ...unselectedCols].some(col => col !== undefined)) {
		result.push({
			operation: 'accessCol',
			operand:   operand?.info.id,
			args:      { columns: [...selectedCols, ...unselectedCols].filter(col => col !== undefined) }
		});
	}

	if(unselectedCols.length > 0) {
		result.push({
			operation: 'removeCols',
			operand:   operand?.info.id,
			args:      { colnames: unselectedCols }
		});
		operand = undefined;
	}
	if(selectedCols.length > 0) {
		result.push({
			operation: 'subsetCols',
			operand:   operand?.info.id,
			args:      { colnames: selectedCols }
		});
		operand = undefined;
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

function getUnresolvedSymbolsInExpression<OtherInfo>(
	expression: RNode<OtherInfo & ParentInformation> | typeof EmptyArgument | undefined,
	info: ResolveInfo
): string[] {
	if(expression === undefined || expression === EmptyArgument || info.graph === undefined) {
		return [];
	}
	switch(expression.type) {
		case RType.ExpressionList:
			return [...expression.children.flatMap(child => getUnresolvedSymbolsInExpression(child, info))];
		case RType.FunctionCall:
			return [...expression.arguments.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info))];
		case RType.UnaryOp:
			return [...getUnresolvedSymbolsInExpression(expression.operand, info)];
		case RType.BinaryOp:
			return [...getUnresolvedSymbolsInExpression(expression.lhs, info), ...getUnresolvedSymbolsInExpression(expression.rhs, info)];
		case RType.Access:
			return [...getUnresolvedSymbolsInExpression(expression.accessed, info), ...expression.access.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info))];
		case RType.Pipe:
			return [...getUnresolvedSymbolsInExpression(expression.lhs, info), ...getUnresolvedSymbolsInExpression(expression.rhs, info)];
		case RType.Argument:
			return [...getUnresolvedSymbolsInExpression(expression.value, info)];
		case RType.Symbol:
			if(isUseVertex(info.graph.getVertex(expression.info.id)) && (info.graph.outgoingEdges(expression.info.id)?.size ?? 0) === 0) {
				return [expression.content];
			} else {
				return [];
			}
		default:
			return [];
	}
}

function isDataFrameArgument<OtherInfo>(
	arg: RFunctionArgument<OtherInfo & ParentInformation & AbstractInterpretationInfo> | undefined
): arg is RArgument<OtherInfo & ParentInformation & Required<AbstractInterpretationInfo>> {
	if(arg === EmptyArgument || arg?.value === undefined) {
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
