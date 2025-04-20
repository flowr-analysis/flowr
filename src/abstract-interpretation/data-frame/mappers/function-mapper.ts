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
import type { AbstractInterpretationInfo, DataFrameInfo, DataFrameOperations } from '../absint-info';
import { DataFrameTop } from '../domain';
import { resolveIdToArgName, resolveIdToArgValue, resolveIdToArgValueSymbolName, resolveIdToArgVectorLength, unescapeArgument } from '../resolve-args';

const ColNamesRegex = /^[A-Za-z.][A-Za-z0-9_.]*$/;

const DataFrameFunctionMapper = {
	'data.frame':    { mapper: mapDataFrameCreate, specialArgs: ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'] },
	'as.data.frame': { mapper: mapDataFrameIdentity, specialArgs: ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'] },
	'read.csv':      { mapper: mapDataFrameUnknownCreate, specialArgs: [] },
	'read.table':    { mapper: mapDataFrameUnknownCreate, specialArgs: [] },
	'cbind':         { mapper: mapDataFrameColBind, specialArgs: ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude'] },
	'rbind':         { mapper: mapDataFrameRowBind, specialArgs: ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude'] },
	'head':          { mapper: mapDataFrameHeadTail, specialArgs: ['addrownums'] },
	'tail':          { mapper: mapDataFrameHeadTail, specialArgs: ['addrownums'] },
	'subset':        { mapper: mapDataFrameSubset, specialArgs: ['drop'] },
	'filter':        { mapper: mapDataFrameFilter, specialArgs: ['.by', '.preserve'] },
	'select':        { mapper: mapDataFrameSelect, specialArgs: [] },
	'transform':     { mapper: mapDataFrameMutate, specialArgs: [] },
	'mutate':        { mapper: mapDataFrameMutate, specialArgs: ['.by', '.keep', '.before', '.after'] },
	'group_by':      { mapper: mapDataFrameGroupBy, specialArgs: ['.add', '.drop'] },
	'left_join':     { mapper: mapDataFrameLeftJoin, specialArgs: ['copy', 'suffix', 'keep'] },
	'merge':         { mapper: (...args) => mapDataFrameLeftJoin(...args, true), specialArgs: ['by.x', 'bx.y', 'all', 'all.x', 'all.y', 'sort', 'suffixes', 'no.dups', 'incomparables'] },
	'summarise':     { mapper: mapDataFrameMutate, specialArgs: ['.by', '.groups'] },
	'summarize':     { mapper: mapDataFrameMutate, specialArgs: ['.by', '.groups'] },
	'relocate':      { mapper: mapDataFrameIdentity, specialArgs: ['.before', '.after'] },
	'arrange':       { mapper: mapDataFrameIdentity, specialArgs: ['.by_group', '.locale'] }
} as const satisfies Record<string, DataFrameFunctionMapperInfo>;

type DataFrameFunctionMapperInfo = {
	readonly mapper:      DataFrameFunctionMapping,
	readonly specialArgs: string[]
}

type DataFrameFunctionMapping = (
    args: readonly RFunctionArgument<ParentInformation>[],
    info: ResolveInfo
) => DataFrameOperations[] | undefined;

type DataFrameFunction = keyof typeof DataFrameFunctionMapper;

export function mapDataFrameFunctionCall(
	node: RNode<ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.FunctionCall && node.named && node.functionName.content in DataFrameFunctionMapper) {
		const functionName = node.functionName.content as DataFrameFunction;
		const args = getFunctionArguments(node, dfg);
		const effectiveArgs = getEffectiveArgs(functionName, args);
		const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true };
		const functionMapping = DataFrameFunctionMapper[functionName];

		const operations = functionMapping.mapper(effectiveArgs, resolveInfo);

		if(operations !== undefined) {
			return { type: 'expression', operations: operations };
		}
	}
}

function mapDataFrameCreate(
	args: readonly RFunctionArgument<ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] {
	const argNames = args.map(arg => arg ? resolveIdToArgName(arg, info) : undefined);
	const argLengths = args.map(arg => arg ? resolveIdToArgVectorLength(arg, info) : undefined);
	const colnames = argNames.map(arg => isValidColName(arg) ? arg : undefined);
	const rows = argLengths.every(arg => arg !== undefined) ? Math.max(...argLengths, 0) : undefined;

	return [{
		operation: 'create',
		operand:   undefined,
		args:      { colnames: colnames, rows: rows }
	}];
}

function mapDataFrameUnknownCreate(): DataFrameOperations[] {
	return [{
		operation: 'unknownCreate',
		operand:   undefined,
		args:      {}
	}];
}

function mapDataFrameColBind(
	args: readonly RFunctionArgument<ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = args.find(isDataFrameArgument);

	if(dataFrame === undefined) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;
	let colnames: (string | undefined)[] | undefined = [];

	for(const arg of args) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			if(isDataFrameArgument(arg)) {
				const otherDataFrame = arg.value.info.dataFrame.domain?.get(arg.value.info.id) ?? DataFrameTop;

				result.push({
					operation: 'concatCols',
					operand:   operand?.info.id,
					args:      { other: otherDataFrame }
				});
				operand = undefined;
			// Added columns are undefined if argument cannot be resolved to constant (vector-like) value
			} else if(resolveIdToArgValue(arg, info) !== undefined) {
				const colname = resolveIdToArgName(arg, info);
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

function mapDataFrameRowBind(
	args: readonly RFunctionArgument<ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = args.find(isDataFrameArgument);

	if(dataFrame === undefined) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;
	let rows: number | undefined = 0;

	for(const arg of args) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			if(isDataFrameArgument(arg)) {
				const otherDataFrame = arg.value.info.dataFrame.domain?.get(arg.value.info.id) ?? DataFrameTop;

				result.push({
					operation: 'concatRows',
					operand:   operand?.info.id,
					args:      { other: otherDataFrame }
				});
				operand = undefined;
			// Number of added rows is undefined if arguments cannot be resolved to constant (vector-like) value
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

function mapDataFrameHeadTail(
	args: readonly RFunctionArgument<ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = args[0];

	if(!isDataFrameArgument(dataFrame)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const amountArg = args.find(arg => resolveIdToArgName(arg, info) === 'n') ?? args[1];
	const amountValue: unknown = resolveIdToArgValue(amountArg, info);
	let rows: number | undefined = undefined;
	let cols: number | undefined = undefined;

	if(typeof amountValue === 'number') {
		rows = amountValue;
	} else if(Array.isArray(amountValue) && amountValue.length <= 2 && amountValue.every(value => typeof value === 'number')) {
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

function mapDataFrameSubset(
	args: readonly RFunctionArgument<ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = args[0];

	if(!isDataFrameArgument(dataFrame)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;

	const filterArg = args.find(arg => resolveIdToArgName(arg, info) === 'subset')
		?? args.find(arg => arg !== dataFrame && resolveIdToArgName(arg, info) === undefined)
		?? EmptyArgument;
	const filterValue = resolveIdToArgValue(filterArg, info);

	const selectArg = args.find(arg => resolveIdToArgName(arg, info) === 'select')
		?? args.find(arg => arg !== dataFrame && arg !== filterArg && resolveIdToArgName(arg, info) === undefined)
		?? EmptyArgument;

	const accessedNames = [...getUnresolvedSymbolsInExpression(filterArg, info), ...getUnresolvedSymbolsInExpression(selectArg, info)];
	const condition = typeof filterValue === 'boolean' ? filterValue : undefined;
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

	if(accessedNames.length > 0) {
		result.push({
			operation: 'accessCols',
			operand:   operand?.info.id,
			args:      { columns: accessedNames }
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

function mapDataFrameFilter(
	args: readonly RFunctionArgument<ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = args[0];

	if(!isDataFrameArgument(dataFrame)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const filterArg = args[1];
	const filterValue = resolveIdToArgValue(filterArg, info);
	const accessedNames = args.slice(1).flatMap(arg => getUnresolvedSymbolsInExpression(arg, info));
	const condition = typeof filterValue === 'boolean' && args.length === 2 ? filterValue : undefined;

	if(accessedNames.length > 0) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			args:      { columns: accessedNames }
		});
	}

	result.push({
		operation: 'filterRows',
		operand:   dataFrame.value.info.id,
		args:      { condition: condition }
	});
	return result;
}

function mapDataFrameSelect(
	args: readonly RFunctionArgument<ParentInformation & AbstractInterpretationInfo>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = args[0];

	if(!isDataFrameArgument(dataFrame)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;
	const selectedCols: (string | undefined)[] = [];
	const unselectedCols: (string | undefined)[] = [];

	for(const arg of args) {
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
			operation: 'accessCols',
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

function mapDataFrameMutate(
	args: readonly RFunctionArgument<ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = args[0];

	if(!isDataFrameArgument(dataFrame)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const accessedNames = args.slice(1).flatMap(arg => getUnresolvedSymbolsInExpression(arg, info));
	const columns = args.slice(1).map(arg => resolveIdToArgName(arg, info));

	if(accessedNames.length > 0) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			args:      { columns: accessedNames }
		});
	}

	result.push({
		operation: 'mutateCols',
		operand:   dataFrame.value.info.id,
		args:      { columns: columns.every(col => col !== undefined) ? columns : undefined }
	});
	return result;
}

function mapDataFrameGroupBy(
	args: readonly RFunctionArgument<ParentInformation>[],
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = args[0];

	if(!isDataFrameArgument(dataFrame)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const byArg = args[1];
	const byName = resolveIdToArgValueSymbolName(byArg, info);

	if(byName !== undefined) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			args:      { columns: [byName] }
		});
	}

	result.push({
		operation: 'groupBy',
		operand:   dataFrame.value.info.id,
		args:      { by: typeof byName === 'string' ? byName : undefined }
	});
	return result;
}

function mapDataFrameLeftJoin(
	args: readonly RFunctionArgument<ParentInformation & AbstractInterpretationInfo>[],
	info: ResolveInfo,
	minRows?: boolean
): DataFrameOperations[] | undefined {
	const dataFrame = args[0];

	if(!isDataFrameArgument(dataFrame)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const otherArg = args[1];
	const otherDataFrame = isDataFrameArgument(otherArg) ? otherArg.value.info.dataFrame.domain?.get(otherArg.value.info.id) : undefined;

	const byArg = args.find(arg => resolveIdToArgName(arg, info) === 'by')
		?? args.find(arg => arg !== dataFrame && resolveIdToArgName(arg, info) === undefined)
		?? EmptyArgument;
	const byName = resolveIdToArgValueSymbolName(byArg, info);

	if(byName !== undefined) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			args:      { columns: [byName] }
		});
	}

	result.push({
		operation: 'leftJoin',
		operand:   dataFrame.value.info.id,
		args:      {
			other:   otherDataFrame ?? DataFrameTop,
			by:      typeof byName === 'string' ? byName : undefined,
			minRows: minRows
		}
	});
	return result;
}

function mapDataFrameIdentity(
	args: readonly RFunctionArgument<ParentInformation>[]
): DataFrameOperations[] | undefined {
	const dataFrame = args.find(isDataFrameArgument);

	return [{
		operation: 'identity',
		operand:   dataFrame?.value.info.id,
		args:      {}
	}];
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

function getEffectiveArgs(
	funct: DataFrameFunction,
	args: readonly RFunctionArgument<ParentInformation>[]
): readonly RFunctionArgument<ParentInformation>[] {
	const specialArgs: string[] = DataFrameFunctionMapper[funct].specialArgs;

	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !specialArgs.includes(unescapeArgument(arg.name.content)));
}

function getUnresolvedSymbolsInExpression(
	expression: RNode<ParentInformation> | typeof EmptyArgument | undefined,
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
				return [unescapeArgument(expression.content)];
			} else {
				return [];
			}
		default:
			return [];
	}
}

function isDataFrameArgument(
	arg: RFunctionArgument<ParentInformation & AbstractInterpretationInfo> | undefined
): arg is RArgument<ParentInformation & Required<AbstractInterpretationInfo>> & {value: RNode<ParentInformation & Required<AbstractInterpretationInfo>>} {
	if(arg === EmptyArgument || arg?.value === undefined) {
		return false;
	}
	return arg.value.info.dataFrame?.domain?.get(arg.value.info.id) !== undefined;
}

function isValidColName(colname: string | undefined): boolean {
	return colname !== undefined && ColNamesRegex.test(colname);
}
