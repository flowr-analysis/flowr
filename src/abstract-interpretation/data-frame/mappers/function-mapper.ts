import type { ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { isUseVertex, VertexType } from '../../../dataflow/graph/vertex';
import { toUnnamedArgument } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import { findSource, getSourceProvider } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RFunctionArgument, RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { requestFromInput } from '../../../r-bridge/retriever';
import { readLineByLineSync } from '../../../util/files';
import type { AbstractInterpretationInfo, DataFrameInfo, DataFrameOperations } from '../absint-info';
import { resolveIdToAbstractValue } from '../absint-visitor';
import { DataFrameTop } from '../domain';
import { resolveIdToArgName, resolveIdToArgValue, resolveIdToArgValueSymbolName, resolveIdToArgVectorLength, unescapeArgument } from '../resolve-args';

const MaxReadLines = 1e7;
const ColNamesRegex = /^[A-Za-z.][A-Za-z0-9_.]*$/;

const DataFrameFunctionMapper = {
	'data.frame':    mapDataFrameCreate,
	'as.data.frame': mapDataFrameConvert,
	'read.table':    mapDataFrameRead,
	'read.csv':      mapDataFrameRead,
	'read.csv2':     mapDataFrameRead,
	'read.delim':    mapDataFrameRead,
	'read.delim2':   mapDataFrameRead,
	'cbind':         mapDataFrameColBind,
	'rbind':         mapDataFrameRowBind,
	'head':          mapDataFrameHeadTail,
	'tail':          mapDataFrameHeadTail,
	'subset':        mapDataFrameSubset,
	'filter':        mapDataFrameFilter,
	'select':        mapDataFrameSelect,
	'transform':     mapDataFrameMutate,
	'mutate':        mapDataFrameMutate,
	'group_by':      mapDataFrameGroupBy,
	'summarise':     mapDataFrameSummarize,
	'summarize':     mapDataFrameSummarize,
	'left_join':     mapDataFrameLeftJoin,
	'merge':         mapDataFrameMerge,
	'relocate':      mapDataFrameIdentity,
	'arrange':       mapDataFrameIdentity
} as const satisfies Record<string, DataFrameFunctionMapping<never>>;

const DataFrameFunctionParamsMapper: DataFrameFunctionParamsMapping = {
	'data.frame':    { special: ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'] },
	'as.data.frame': { dataFrame: { pos: 0, name: 'x' } },
	'read.table':    { fileName: { pos: 0, name: 'file' }, header: { pos: 1, name: 'header' }, separator: { pos: 2, name: 'sep' } },
	'read.csv':      { fileName: { pos: 0, name: 'file' }, header: { pos: 1, name: 'header' }, separator: { pos: 2, name: 'sep' } },
	'read.csv2':     { fileName: { pos: 0, name: 'file' }, header: { pos: 1, name: 'header' }, separator: { pos: 2, name: 'sep' } },
	'read.delim':    { fileName: { pos: 0, name: 'file' }, header: { pos: 1, name: 'header' }, separator: { pos: 2, name: 'sep' } },
	'read.delim2':   { fileName: { pos: 0, name: 'file' }, header: { pos: 1, name: 'header' }, separator: { pos: 2, name: 'sep' } },
	'cbind':         { special: ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude'] },
	'rbind':         { special: ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude'] },
	'head':          { dataFrame: { pos: 0, name: 'x' }, amount: { pos: 1, name: 'n' } },
	'tail':          { dataFrame: { pos: 0, name: 'x' }, amount: { pos: 1, name: 'n' } },
	'subset':        { dataFrame: { pos: 0, name: 'x' }, subset: { pos: 1, name: 'subset' }, select: { pos: 2, name: 'select' }, drop: { pos: 3, name: 'drop' } },
	'filter':        { dataFrame: { pos: 0, name: '.data' }, special: ['.by', '.preserve'] },
	'select':        { dataFrame: { pos: 0, name: '.data' }, special: [] },
	'transform':     { dataFrame: { pos: 0, name: '_data' }, special: [] },
	'mutate':        { dataFrame: { pos: 0, name: '.data' }, special: ['.by', '.keep', '.before', '.after'] },
	'group_by':      { dataFrame: { pos: 0, name: '.data' }, by: { pos: 1 }, special: ['.add', '.drop'] },
	'summarise':     { dataFrame: { pos: 0, name: '.data' }, special: ['.by', '.groups'] },
	'summarize':     { dataFrame: { pos: 0, name: '.data' }, special: ['.by', '.groups'] },
	'left_join':     { dataFrame: { pos: 0, name: 'x' }, otherDataFrame: { pos: 1, name: 'y' }, by: { pos: 3, name: 'by' } },
	'merge':         { dataFrame: { pos: 0, name: 'x' }, otherDataFrame: { pos: 1, name: 'y' }, by: { pos: 3, name: 'by' } },
	'relocate':      { dataFrame: { pos: 0, name: '.data' }, special: ['.before', '.after'] },
	'arrange':       { dataFrame: { pos: 0, name: '.data' }, special: ['.by_group', '.locale'] }
};

type DataFrameFunctionMapping<Params extends object> = (
    args: readonly RFunctionArgument<ParentInformation>[],
	params: Params,
    info: ResolveInfo
) => DataFrameOperations[] | undefined;

type DataFrameFunction = keyof typeof DataFrameFunctionMapper;
type DataFrameFunctionParams<N extends DataFrameFunction> = Parameters<typeof DataFrameFunctionMapper[N]>[1];

type DataFrameFunctionParamsMapping = {
	[Name in DataFrameFunction]: DataFrameFunctionParams<Name>
}

interface FunctionParameterLocation {
	pos:   number,
	name?: string
}

export function mapDataFrameFunctionCall<Name extends DataFrameFunction>(
	node: RNode<ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.FunctionCall && node.named && Object.prototype.hasOwnProperty.call(DataFrameFunctionMapper, node.functionName.content)) {
		const functionName = node.functionName.content as Name;
		const mapper = DataFrameFunctionMapper[functionName] as DataFrameFunctionMapping<DataFrameFunctionParams<Name>>;
		const params = DataFrameFunctionParamsMapper[functionName] as DataFrameFunctionParams<Name>;
		const args = getFunctionArguments(node, dfg);
		const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true };

		const operations = mapper(args, params, resolveInfo);

		if(operations !== undefined) {
			return { type: 'expression', operations: operations };
		}
	}
}

function mapDataFrameCreate(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { special: string[] },
	info: ResolveInfo
): DataFrameOperations[] {
	args = getEffectiveArgs(args, params.special);
	const argNames = args.map(arg => resolveIdToArgName(arg, info));
	const argLengths = args.map(arg => resolveIdToArgVectorLength(arg, info));
	const allVectors = argLengths.every(len => len !== undefined);
	const colnames = argNames.map(arg => isValidColName(arg) ? arg : undefined);
	const rows = allVectors ? Math.max(...argLengths, 0) : undefined;

	return [{
		operation: 'create',
		operand:   undefined,
		args:      { colnames: allVectors ? colnames : undefined, rows: rows }
	}];
}

function mapDataFrameConvert(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(dataFrame === EmptyArgument || dataFrame?.value === undefined) {
		return;
	}
	return [{
		operation: 'identity',
		operand:   dataFrame.value.info.id,
		args:      {}
	}];
}

function mapDataFrameRead(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { fileName: FunctionParameterLocation, header: FunctionParameterLocation, separator: FunctionParameterLocation },
	info: ResolveInfo
): DataFrameOperations[] {
	const fileNameArg = getFunctionArgument(args, params.fileName, info);
	const fileName = resolveIdToArgValue(fileNameArg, info);

	if(fileNameArg === undefined || fileNameArg === EmptyArgument || typeof fileName !== 'string') {
		return [{
			operation: 'create',
			operand:   undefined,
			args:      { colnames: undefined, rows: undefined }
		}];
	}
	const referenceChain = fileNameArg.info.file ? [requestFromInput(`file://${fileNameArg.info.file}`)] : [];
	const sources = findSource(fileName, { referenceChain: referenceChain });
	const source = sources?.[0];

	if(source === undefined) {
		return [{
			operation: 'create',
			operand:   undefined,
			args:      { colnames: undefined, rows: undefined }
		}];
	}
	const headerArg = getFunctionArgument(args, params.header, info);
	const separatorArg = getFunctionArgument(args, params.separator, info);
	const headerValue = resolveIdToArgValue(headerArg, info);
	const separatorValue = resolveIdToArgValue(separatorArg, info);
	const header = typeof headerValue === 'boolean' ? headerValue : true;
	const separator = typeof separatorValue === 'string' ? separatorValue : ',';

	const request = getSourceProvider().createRequest(source);
	let firstLine: (string | undefined)[] | undefined = undefined;
	let rowCount = 0;
	let allLines = true;

	const parseLine = (line: Buffer | string, lineNumber: number) => {
		if(firstLine === undefined) {
			firstLine = getEntriesFromCsvLine(line.toString(), separator);
		}
		if((!header || lineNumber > 0) && line.length > 0) {
			rowCount++;
		}
	};

	if(request.request === 'text') {
		request.content.split('\n').forEach(parseLine);
	} else if(request.request === 'file') {
		allLines = readLineByLineSync(request.content, parseLine, MaxReadLines);
	}

	return [{
		operation: 'create',
		operand:   undefined,
		args:      {
			colnames: header || firstLine === undefined ? firstLine : Array((firstLine as unknown[]).length).fill(undefined),
			rows:     allLines ? rowCount : undefined
		}
	}];
}

function mapDataFrameColBind(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { special: string[] },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = args.find(arg => isDataFrameArgument(arg, info));

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
			if(isDataFrameArgument(arg, info)) {
				const otherDataFrame = resolveIdToAbstractValue(arg.value, info.graph) ?? DataFrameTop;

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
	params: { special: string[] },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = args.find(arg => isDataFrameArgument(arg, info));

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
			if(isDataFrameArgument(arg, info)) {
				const otherDataFrame = resolveIdToAbstractValue(arg.value, info.graph) ?? DataFrameTop;

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
	params: { dataFrame: FunctionParameterLocation, amount: FunctionParameterLocation },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const amountArg = getFunctionArgument(args, params.amount, info);
	const amountValue = resolveIdToArgValue(amountArg, info);
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
	params: { dataFrame: FunctionParameterLocation, subset: FunctionParameterLocation, select: FunctionParameterLocation, drop: FunctionParameterLocation },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
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

	const filterArg = getFunctionArgument(args, params.subset, info);
	const filterValue = resolveIdToArgValue(filterArg, info);
	const selectArg = getFunctionArgument(args, params.select, info);

	const accessedNames = [...getUnresolvedSymbolsInExpression(filterArg, info), ...getUnresolvedSymbolsInExpression(selectArg, info)];
	const condition = typeof filterValue === 'boolean' ? filterValue : undefined;
	let selectedCols: (string | undefined)[] | undefined = [];
	let unselectedCols: (string | undefined)[] = [];

	if(selectArg !== undefined && selectArg !== EmptyArgument) {
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

	if(filterArg !== undefined && filterArg !== EmptyArgument) {
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
	if(selectedCols === undefined || selectedCols.length > 0) {
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
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
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
	const accessedNames = args.filter(arg => arg !== dataFrame).flatMap(arg => getUnresolvedSymbolsInExpression(arg, info));
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
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
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
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const accessedNames = args.filter(arg => arg !== dataFrame).flatMap(arg => getUnresolvedSymbolsInExpression(arg, info));
	const mutatedCols = args.filter(arg => arg !== dataFrame).map(arg => resolveIdToArgName(arg, info));

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
		args:      { colnames: mutatedCols }
	});
	return result;
}

function mapDataFrameGroupBy(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, by: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const byArg = getFunctionArgument(args, params.by, info);
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
		args:      { by: byName }
	});
	return result;
}

function mapDataFrameSummarize(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const accessedNames = args.filter(arg => arg !== dataFrame).flatMap(arg => getUnresolvedSymbolsInExpression(arg, info));
	const summarizedCols = args.filter(arg => arg !== dataFrame).map(arg => resolveIdToArgName(arg, info));

	if(accessedNames.length > 0) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			args:      { columns: accessedNames }
		});
	}

	result.push({
		operation: 'summarize',
		operand:   dataFrame.value.info.id,
		args:      { colnames: summarizedCols }
	});
	return result;
}

function mapDataFrameLeftJoin(
	args: readonly RFunctionArgument<ParentInformation & AbstractInterpretationInfo>[],
	params: { dataFrame: FunctionParameterLocation, otherDataFrame: FunctionParameterLocation, by: FunctionParameterLocation },
	info: ResolveInfo,
	minRows?: boolean
): DataFrameOperations[] | undefined {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id,
			args:      {}
		}];
	}
	const result: DataFrameOperations[] = [];
	const otherArg = getFunctionArgument(args, params.otherDataFrame, info);
	const otherDataFrame = resolveIdToAbstractValue(otherArg, info.graph);
	const byArg = getFunctionArgument(args, params.by, info);
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
			by:      byName,
			minRows: minRows
		}
	});
	return result;
}

function mapDataFrameMerge(
	args: readonly RFunctionArgument<ParentInformation & AbstractInterpretationInfo>[],
	params: { dataFrame: FunctionParameterLocation, otherDataFrame: FunctionParameterLocation, by: FunctionParameterLocation },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	return mapDataFrameLeftJoin(args, params, info, true);
}

function mapDataFrameIdentity(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperations[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	}
	return [{
		operation: 'identity',
		operand:   dataFrame.value.info.id,
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
			.map(arg => arg === EmptyArgument ? arg : idMap.get(arg.nodeId))
			.map(arg => arg === EmptyArgument || arg?.type === RType.Argument ? arg : toUnnamedArgument(arg, idMap));
	}
	return node.arguments;
}

function getFunctionArgument(
	args: readonly RFunctionArgument<ParentInformation>[],
	argument: FunctionParameterLocation,
	info: ResolveInfo
): RFunctionArgument<ParentInformation> | undefined {
	const pos = argument.pos;
	let arg = undefined;

	if(argument.name !== undefined) {
		arg = args.find(arg => resolveIdToArgName(arg, info) === argument.name);
	}
	if(arg === undefined && pos < args.length && args[pos] !== EmptyArgument && args[pos].name === undefined) {
		arg = args[pos];
	}
	return arg;
}

function getEffectiveArgs(
	args: readonly RFunctionArgument<ParentInformation>[],
	excluded: string[]
): readonly RFunctionArgument<ParentInformation>[] {
	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !excluded.includes(unescapeArgument(arg.name.content)));
}

function getEntriesFromCsvLine(line: string, sep: string = ',', quote: string = '"'): (string | undefined)[] {
	const CsvEntryRegex = new RegExp(`(?<=^|${sep})(?:${quote}((?:[^${quote}]|${quote}${quote})*)${quote}|([^${sep}]*))`, 'g');

	return line.matchAll(CsvEntryRegex).map(match => match[1]?.replaceAll('""', '"') ?? match[2]).toArray();
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
	arg: RFunctionArgument<ParentInformation> | undefined,
	info: ResolveInfo
): arg is RArgument<ParentInformation & Required<AbstractInterpretationInfo>> & { value: RNode<ParentInformation & Required<AbstractInterpretationInfo>> } {
	return arg !== EmptyArgument && arg?.value !== undefined && resolveIdToAbstractValue(arg.value, info.graph) !== undefined;
}

function isValidColName(colname: string | undefined): boolean {
	return colname !== undefined && ColNamesRegex.test(colname);
}
