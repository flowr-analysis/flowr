import { defaultConfigOptions, VariableResolve } from '../../../config';
import { type ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
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
import type { RParseRequest } from '../../../r-bridge/retriever';
import { requestFromInput } from '../../../r-bridge/retriever';
import { assertUnreachable } from '../../../util/assert';
import { readLineByLineSync } from '../../../util/files';
import type { AbstractInterpretationInfo, DataFrameInfo, DataFrameOperation } from '../absint-info';
import { resolveIdToAbstractValue } from '../absint-visitor';
import { DataFrameTop } from '../domain';
import { resolveIdToArgName, resolveIdToArgValue, resolveIdToArgValueSymbolName, resolveIdToArgVectorLength, unescapeSpecialChars, unquoteArgument } from '../resolve-args';

enum DataFrameType {
	DataFrame = 'data.frame',
	Tibble = 'tibble',
	DataTable = 'data.table'
}

const MaxReadLines = 1e7;
const ColNamesRegex = /^[A-Za-z.][A-Za-z0-9_.]*$/;

const DataFrameFunctionMapper = {
	'data.frame':    { mapper: mapDataFrameCreate },
	'as.data.frame': { mapper: mapDataFrameConvert },
	'read.table':    { mapper: mapDataFrameRead },
	'read.csv':      { mapper: mapDataFrameRead },
	'read.csv2':     { mapper: mapDataFrameRead },
	'read.delim':    { mapper: mapDataFrameRead },
	'read.delim2':   { mapper: mapDataFrameRead },
	'read_table':    { mapper: mapDataFrameRead, library: 'readr', type: DataFrameType.Tibble },
	'read_csv':      { mapper: mapDataFrameRead, library: 'readr', type: DataFrameType.Tibble },
	'read_csv2':     { mapper: mapDataFrameRead, library: 'readr', type: DataFrameType.Tibble },
	'read_tsv':      { mapper: mapDataFrameRead, library: 'readr', type: DataFrameType.Tibble },
	'read_delim':    { mapper: mapDataFrameRead, library: 'readr', type: DataFrameType.Tibble },
	'cbind':         { mapper: mapDataFrameColBind },
	'rbind':         { mapper: mapDataFrameRowBind },
	'head':          { mapper: mapDataFrameHeadTail },
	'tail':          { mapper: mapDataFrameHeadTail },
	'subset':        { mapper: mapDataFrameSubset },
	'filter':        { mapper: mapDataFrameFilter, library: 'dplyr' },
	'select':        { mapper: mapDataFrameSelect, library: 'dplyr' },
	'mutate':        { mapper: mapDataFrameMutate, library: 'dplyr' },
	'transform':     { mapper: mapDataFrameMutate },
	'group_by':      { mapper: mapDataFrameGroupBy, library: 'dplyr', type: DataFrameType.Tibble },
	'summarise':     { mapper: mapDataFrameSummarize, library: 'dplyr' },
	'summarize':     { mapper: mapDataFrameSummarize, library: 'dplyr' },
	'left_join':     { mapper: mapDataFrameLeftJoin, library: 'dplyr' },
	'merge':         { mapper: mapDataFrameLeftJoin },
	'relocate':      { mapper: mapDataFrameIdentity, library: 'dplyr' },
	'arrange':       { mapper: mapDataFrameIdentity, library: 'dplyr' }
} as const satisfies Record<string, DataFrameFunctionMapperInfo<never>>;

const DataFrameFunctionParamsMapper: DataFrameFunctionParamsMapping = {
	'data.frame': {
		checkNames: { pos: -1, name: 'check.names', default: true },
		noDupNames: { pos: -1, name: 'check.names', default: true },
		special:    ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'],
		critical:   [{ pos: -1, name: 'row.names' }]
	},
	'as.data.frame': {
		critical:  [],
		dataFrame: { pos: 0, name: 'x' }
	},
	'read.table': {
		fileName:   { pos: 0, name: 'file' },
		header:     { pos: 1, name: 'header', default: false },
		separator:  { pos: 2, name: 'sep', default: '\\s' },
		quote:      { pos: 3, name: 'quote', default: '"\'' },
		skipLines:  { pos: 12, name: 'skip', default: 0 },
		checkNames: { pos: 13, name: 'check.names', default: true },
		noDupNames: { pos: 13, name: 'check.names', default: true },
		comment:    { pos: 17, name: 'comment.char', default: '#' },
		text:       { pos: 23, name: 'text' },
		critical:   [
			{ pos: 6, name: 'row.names' },
			{ pos: 7, name: 'col.names' },
			{ pos: 11, name: 'nrows', default: -1 },
			{ pos: 15, name: 'strip.white', default: false },
			{ pos: 16, name: 'blank.lines.skip', default: true },
			{ pos: 18, name: 'allow.escapes', default: false },
		]
	},
	'read.csv': {
		fileName:   { pos: 0, name: 'file' },
		header:     { pos: 1, name: 'header', default: true },
		separator:  { pos: 2, name: 'sep', default: ',' },
		quote:      { pos: 3, name: 'quote', default: '"' },
		comment:    { pos: 6, name: 'comment.char', default: '' },
		skipLines:  { pos: -1, name: 'skip', default: 0 },
		checkNames: { pos: -1, name: 'check.names', default: true },
		noDupNames: { pos: -1, name: 'check.names', default: true },
		text:       { pos: -1, name: 'text' },
		critical:   [
			{ pos: -1, name: 'row.names' },
			{ pos: -1, name: 'col.names' },
			{ pos: -1, name: 'nrows', default: -1 },
			{ pos: -1, name: 'strip.white', default: false },
			{ pos: -1, name: 'blank.lines.skip', default: true },
			{ pos: -1, name: 'allow.escapes', default: false },
		]
	},
	'read.csv2': {
		fileName:   { pos: 0, name: 'file' },
		header:     { pos: 1, name: 'header', default: true },
		separator:  { pos: 2, name: 'sep', default: ';' },
		quote:      { pos: 3, name: 'quote', default: '"' },
		comment:    { pos: 6, name: 'comment.char', default: '' },
		skipLines:  { pos: -1, name: 'skip', default: 0 },
		checkNames: { pos: -1, name: 'check.names', default: true },
		noDupNames: { pos: -1, name: 'check.names', default: true },
		text:       { pos: -1, name: 'text' },
		critical:   [
			{ pos: -1, name: 'row.names' },
			{ pos: -1, name: 'col.names' },
			{ pos: -1, name: 'nrows', default: -1 },
			{ pos: -1, name: 'strip.white', default: false },
			{ pos: -1, name: 'blank.lines.skip', default: true },
			{ pos: -1, name: 'allow.escapes', default: false },
		]
	},
	'read.delim': {
		fileName:   { pos: 0, name: 'file' },
		header:     { pos: 1, name: 'header', default: true },
		separator:  { pos: 2, name: 'sep', default: '\\t' },
		quote:      { pos: 3, name: 'quote', default: '"' },
		comment:    { pos: 6, name: 'comment.char', default: '' },
		skipLines:  { pos: -1, name: 'skip', default: 0 },
		checkNames: { pos: -1, name: 'check.names', default: true },
		noDupNames: { pos: -1, name: 'check.names', default: true },
		text:       { pos: -1, name: 'text' },
		critical:   [
			{ pos: -1, name: 'row.names' },
			{ pos: -1, name: 'col.names' },
			{ pos: -1, name: 'nrows', default: -1 },
			{ pos: -1, name: 'strip.white', default: false },
			{ pos: -1, name: 'blank.lines.skip', default: true },
			{ pos: -1, name: 'allow.escapes', default: false },
		]
	},
	'read.delim2': {
		fileName:   { pos: 0, name: 'file' },
		header:     { pos: 1, name: 'header', default: true },
		separator:  { pos: 2, name: 'sep', default: '\\t' },
		quote:      { pos: 3, name: 'quote', default: '"' },
		comment:    { pos: 6, name: 'comment.char', default: '' },
		skipLines:  { pos: -1, name: 'skip', default: 0 },
		checkNames: { pos: -1, name: 'check.names', default: true },
		noDupNames: { pos: -1, name: 'check.names', default: true },
		text:       { pos: -1, name: 'text' },
		critical:   [
			{ pos: -1, name: 'row.names' },
			{ pos: -1, name: 'col.names' },
			{ pos: -1, name: 'nrows', default: -1 },
			{ pos: -1, name: 'strip.white', default: false },
			{ pos: -1, name: 'blank.lines.skip', default: true },
			{ pos: -1, name: 'allow.escapes', default: false },
		]
	},
	'read_table': {
		fileName:   { pos: 0, name: 'file' },
		header:     { pos: 1, name: 'col_names', default: true },
		separator:  { pos: -1, default: '\\s' },
		quote:      { pos: -1, default: '"' },
		skipLines:  { pos: 5, name: 'skip', default: 0 },
		comment:    { pos: 9, name: 'comment', default: '' },
		checkNames: { pos: -1, default: false },
		noDupNames: { pos: -1, default: true },
		critical:   [
			{ pos: 6, name: 'n_max', default: Infinity },
			{ pos: 11, name: 'skip_empty_rows', default: true }
		],
		noEmptyNames: true
	},
	'read_csv': {
		fileName:   { pos: 0, name: 'file' },
		header:     { pos: 1, name: 'col_names', default: true },
		separator:  { pos: -1, default: ',' },
		quote:      { pos: 8, name: 'quote', default: '"' },
		comment:    { pos: 9, name: 'comment', default: '' },
		skipLines:  { pos: 11, name: 'skip', default: 0 },
		checkNames: { pos: -1, default: false },
		noDupNames: { pos: -1, default: true },
		critical:   [
			{ pos: 3, name: 'col_select' },
			{ pos: 4, name: 'id' },
			{ pos: 10, name: 'trim_ws', default: true },
			{ pos: 12, name: 'n_max', default: Infinity },
			{ pos: 14, name: 'name_repair', default: 'unique' },
			{ pos: 18, name: 'skip_empty_rows', default: true }
		],
		noEmptyNames: true
	},
	'read_csv2': {
		fileName:   { pos: 0, name: 'file' },
		header:     { pos: 1, name: 'col_names', default: true },
		separator:  { pos: -1, default: ';' },
		quote:      { pos: 8, name: 'quote', default: '"' },
		comment:    { pos: 9, name: 'comment', default: '' },
		skipLines:  { pos: 11, name: 'skip', default: 0 },
		checkNames: { pos: -1, default: false },
		noDupNames: { pos: -1, default: true },
		critical:   [
			{ pos: 3, name: 'col_select' },
			{ pos: 4, name: 'id' },
			{ pos: 10, name: 'trim_ws', default: true },
			{ pos: 12, name: 'n_max', default: Infinity },
			{ pos: 14, name: 'name_repair', default: 'unique' },
			{ pos: 18, name: 'skip_empty_rows', default: true }
		],
		noEmptyNames: true
	},
	'read_tsv': {
		fileName:   { pos: 0, name: 'file' },
		header:     { pos: 1, name: 'col_names', default: true },
		separator:  { pos: -1, default: '\\t' },
		quote:      { pos: 8, name: 'quote', default: '"' },
		comment:    { pos: 9, name: 'comment', default: '' },
		skipLines:  { pos: 11, name: 'skip', default: 0 },
		checkNames: { pos: -1, default: false },
		noDupNames: { pos: -1, default: true },
		critical:   [
			{ pos: 3, name: 'col_select' },
			{ pos: 4, name: 'id' },
			{ pos: 10, name: 'trim_ws', default: true },
			{ pos: 12, name: 'n_max', default: Infinity },
			{ pos: 14, name: 'name_repair', default: 'unique' },
			{ pos: 18, name: 'skip_empty_rows', default: true }
		],
		noEmptyNames: true
	},
	'read_delim': {
		fileName:   { pos: 0, name: 'file' },
		separator:  { pos: 1, name: 'delim', default: '\t' },
		quote:      { pos: 2, name: 'quote', default: '"' },
		header:     { pos: 5, name: 'col_names', default: true },
		comment:    { pos: 12, name: 'comment', default: '' },
		skipLines:  { pos: 14, name: 'skip', default: 0 },
		checkNames: { pos: -1, default: false },
		noDupNames: { pos: -1, default: true },
		critical:   [
			{ pos: 3, name: 'escape_backslash', default: false },
			{ pos: 4, name: 'escape_double', default: true },
			{ pos: 7, name: 'col_select' },
			{ pos: 8, name: 'id' },
			{ pos: 13, name: 'trim_ws', default: false },
			{ pos: 15, name: 'n_max', default: Infinity },
			{ pos: 17, name: 'name_repair', default: 'unique' },
			{ pos: 21, name: 'skip_empty_rows', default: true }
		],
		noEmptyNames: true
	},
	'cbind': {
		special: ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude']
	},
	'rbind': {
		special: ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude']
	},
	'head': {
		dataFrame: { pos: 0, name: 'x' },
		amount:    { pos: 1, name: 'n', default: 6 }
	},
	'tail': {
		dataFrame: { pos: 0, name: 'x' },
		amount:    { pos: 1, name: 'n', default: 6 }
	},
	'subset': {
		dataFrame: { pos: 0, name: 'x' },
		subset:    { pos: 1, name: 'subset' },
		select:    { pos: 2, name: 'select' },
		drop:      { pos: 3, name: 'drop', default: false }
	},
	'filter': {
		dataFrame: { pos: 0, name: '.data' },
		special:   ['.by', '.preserve']
	},
	'select': {
		dataFrame: { pos: 0, name: '.data' },
		special:   []
	},
	'mutate': {
		dataFrame: { pos: 0, name: '.data' },
		special:   ['.by', '.keep', '.before', '.after'],
		critical:  [{ pos: -1, name: '.keep' }]
	},
	'transform': {
		dataFrame: { pos: 0, name: '_data' },
		special:   []
	},
	'group_by': {
		dataFrame: { pos: 0, name: '.data' },
		by:        { pos: 1 },
		special:   ['.add', '.drop']
	},
	'summarise': {
		dataFrame: { pos: 0, name: '.data' },
		special:   ['.by', '.groups']
	},
	'summarize': {
		dataFrame: { pos: 0, name: '.data' },
		special:   ['.by', '.groups']
	},
	'left_join': {
		dataFrame:      { pos: 0, name: 'x' },
		otherDataFrame: { pos: 1, name: 'y' },
		by:             { pos: 2, name: 'by' },
		critical:       [
			{ pos: 4, name: 'suffix', default: ['.x', '.y'] },
			{ pos: -1, name: 'keep' }
		]
	},
	'merge': {
		dataFrame:      { pos: 0, name: 'x' },
		otherDataFrame: { pos: 1, name: 'y' },
		by:             { pos: 3, name: 'by' },
		minRows:        true,
		critical:       [
			{ pos: 3, name: 'by.x' },
			{ pos: 4, name: 'by.y' },
			{ pos: 5, name: 'all' },
			{ pos: 6, name: 'all.x' },
			{ pos: 7, name: 'all.y' },
			{ pos: 9, name: 'suffixes' },
			{ pos: 10, name: 'no.dups' }
		]
	},
	'relocate': {
		dataFrame: { pos: 0, name: '.data' },
		special:   ['.before', '.after']
	},
	'arrange': {
		dataFrame: { pos: 0, name: '.data' },
		special:   ['.by_group', '.locale']
	}
};

type DataFrameFunctionMapping<Params extends object> = (
    args: readonly RFunctionArgument<ParentInformation>[],
	params: Params,
    info: ResolveInfo
) => DataFrameOperation[] | undefined;

type DataFrameFunctionMapperInfo<Params extends object> = {
	readonly mapper:   DataFrameFunctionMapping<Params>,
	readonly library?: string,
	readonly type?:    Exclude<DataFrameType, DataFrameType.DataFrame>
};

type DataFrameFunction = keyof typeof DataFrameFunctionMapper;
type DataFrameFunctionParams<N extends DataFrameFunction> = Parameters<typeof DataFrameFunctionMapper[N]['mapper']>[1];

type DataFrameFunctionParamsMapping = {
	[Name in DataFrameFunction]: DataFrameFunctionParams<Name> & { critical?: FunctionParameterLocation<unknown>[] }
}

interface FunctionParameterLocation<T = undefined> {
	pos:      number,
	name?:    string
	default?: T
}

export function mapDataFrameFunctionCall<Name extends DataFrameFunction>(
	node: RNode<ParentInformation>,
	dfg: DataflowGraph
): DataFrameInfo | undefined {
	if(node.type === RType.FunctionCall && node.named && Object.prototype.hasOwnProperty.call(DataFrameFunctionMapper, node.functionName.content)) {
		const functionName = node.functionName.content as Name;
		const mapper = DataFrameFunctionMapper[functionName].mapper as DataFrameFunctionMapping<DataFrameFunctionParams<Name>>;
		const params = DataFrameFunctionParamsMapper[functionName] as DataFrameFunctionParams<Name>;
		const args = getFunctionArguments(node, dfg);
		const critical = (params as { critical?: FunctionParameterLocation<unknown>[] }).critical;
		const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias };
		let operations: DataFrameOperation[] | undefined;

		if(hasCriticalArgument(args, critical, resolveInfo)) {
			operations = [{ operation: 'unknown', operand: undefined }];
		} else {
			operations = mapper(args, params, resolveInfo);
		}
		if(operations !== undefined) {
			return { type: 'expression', operations: operations };
		}
	}
}

function mapDataFrameCreate(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		checkNames: FunctionParameterLocation<boolean>,
		noDupNames: FunctionParameterLocation<boolean>,
		special:    string[]
	},
	info: ResolveInfo
): DataFrameOperation[] {
	const checkNames = getArgumentValue(args, params.checkNames, info);
	const noDupNames = getArgumentValue(args, params.noDupNames, info);
	args = getEffectiveArgs(args, params.special);

	const argNames = args.map(arg => resolveIdToArgName(arg, info));
	const argLengths = args.map(arg => resolveIdToArgVectorLength(arg, info));
	const allVectors = argLengths.every(len => len !== undefined);
	let colnames: (string | undefined)[] | undefined = argNames;

	if(typeof checkNames !== 'boolean' || typeof noDupNames !== 'boolean') {
		colnames = undefined;
	} else {
		if(checkNames) {  // map all invalid column names to top
			colnames = colnames.map(entry => isValidColName(entry) ? entry : undefined);
		}
		if(noDupNames) {  // map all duplicate column names to top
			colnames = colnames.map((entry, _, list) => entry !== undefined && list.filter(other => other === entry).length === 1 ? entry : undefined);
		}
	}
	return [{
		operation: 'create',
		operand:   undefined,
		colnames:  allVectors ? colnames : undefined,
		rows:      allVectors ? Math.max(...argLengths, 0) : undefined
	}];
}

function mapDataFrameConvert(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation },
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(dataFrame === EmptyArgument || dataFrame?.value === undefined) {
		return [{
			operation: 'unknown',
			operand:   undefined
		}];
	}
	return [{
		operation: 'identity',
		operand:   dataFrame.value.info.id
	}];
}

function mapDataFrameRead(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		fileName:      FunctionParameterLocation,
		text?:         FunctionParameterLocation,
		header:        FunctionParameterLocation<boolean>,
		separator:     FunctionParameterLocation<string>,
		quote:         FunctionParameterLocation<string>,
		comment:       FunctionParameterLocation<string>,
		skipLines:     FunctionParameterLocation<number>,
		checkNames:    FunctionParameterLocation<boolean>,
		noDupNames:    FunctionParameterLocation<boolean>,
		noEmptyNames?: boolean
	},
	info: ResolveInfo
): DataFrameOperation[] {
	const fileNameArg = getFunctionArgument(args, params.fileName, info);
	const textArg = params.text ? getFunctionArgument(args, params.text, info) : undefined;
	const { source, request } = getRequestFromRead(fileNameArg, textArg, params, info);

	const header = getArgumentValue(args, params.header, info);
	const separator = getArgumentValue(args, params.separator, info);
	const quote = getArgumentValue(args, params.quote, info);
	const comment = getArgumentValue(args, params.comment, info);
	const skipLines = getArgumentValue(args, params.skipLines, info);
	const checkNames = getArgumentValue(args, params.checkNames, info);
	const noDupNames = getArgumentValue(args, params.noDupNames, info);

	if(request === undefined || typeof header !== 'boolean' || typeof separator !== 'string' || typeof quote !== 'string' || typeof comment !== 'string' || typeof skipLines !== 'number' || typeof checkNames !== 'boolean' || typeof noDupNames !== 'boolean') {
		return [{
			operation: 'read',
			operand:   undefined,
			source,
			colnames:  undefined,
			rows:      undefined
		}];
	}
	const LineCommentRegex = new RegExp(`\\s*[${escapeRegExp(comment, true)}].*`);
	let firstLine = undefined as (string | undefined)[] | undefined;
	let firstLineNumber = 0;
	let rowCount = 0;

	const parseLine = (line: Buffer | string, lineNumber: number) => {
		const text = comment ? line.toString().replace(LineCommentRegex, '') : line.toString();

		if(text.length > 0 && lineNumber >= (skipLines ?? 0)) {
			if(firstLine === undefined) {
				firstLine = getEntriesFromCsvLine(text, separator, quote, comment);
				firstLineNumber = lineNumber;
			}
			if(!header || lineNumber > firstLineNumber) {
				rowCount++;
			}
		}
	};
	const allLines = parseRequestContent(request, parseLine);
	let colnames: (string | undefined)[] | undefined;

	if(header) {
		colnames = firstLine;

		if(checkNames) {  // map all invalid column names to top
			colnames = colnames?.map(entry => isValidColName(entry) ? entry : undefined);
		}
		if(noDupNames) {  // map all duplicate column names to top
			colnames = colnames?.map((entry, _, list) => entry !== undefined && list.filter(other => other === entry).length === 1 ? entry : undefined);
		}
		if(params.noEmptyNames) {  // map all empty column names to top
			colnames = colnames?.map(entry => entry?.length === 0 ? undefined : entry);
		}
	} else if(firstLine !== undefined) {
		colnames = Array((firstLine as unknown[]).length).fill(undefined);
	}
	return [{
		operation: 'read',
		operand:   undefined,
		source,
		colnames,
		rows:      allLines ? rowCount : undefined
	}];
}

function getRequestFromRead(
	fileNameArg: RFunctionArgument<ParentInformation> | undefined,
	textArg: RFunctionArgument<ParentInformation> | undefined,
	params: DataFrameFunctionParams<'read.table'>,
	info: ResolveInfo
) {
	let source: string | undefined;
	let request: RParseRequest | undefined;

	if(fileNameArg !== undefined && fileNameArg !== EmptyArgument) {
		const fileName = resolveIdToArgValue(fileNameArg, info);

		if(typeof fileName === 'string') {
			source = fileName;
			const referenceChain = fileNameArg.info.file ? [requestFromInput(`file://${fileNameArg.info.file}`)] : [];
			const sources = findSource(defaultConfigOptions.solver.resolveSource, fileName, { referenceChain: referenceChain });

			if(sources?.length === 1) {
				source = sources[0];
				// create request from resolved source file path
				request = getSourceProvider().createRequest(source);
			} else if(params.text === undefined && unescapeSpecialChars(fileName).includes('\n')) {
				// create request from string if file name argument contains newline
				request = requestFromInput(unescapeSpecialChars(fileName));
			}
		}
	} else if(textArg !== undefined && textArg !== EmptyArgument) {
		const text = resolveIdToArgValue(textArg, info);

		if(typeof text === 'string') {
			source = text;
			request = requestFromInput(unescapeSpecialChars(text));
		}
	}
	return { source, request };
}

function parseRequestContent(
	request: RParseRequest,
	parser: (line: Buffer | string, lineNumber: number) => void
): boolean {
	const requestType = request.request;

	if(requestType === 'text') {
		request.content.split('\n').forEach(parser);
		return true;
	} else if(requestType === 'file') {
		return readLineByLineSync(request.content, parser, MaxReadLines);
	}
	assertUnreachable(requestType);
}

function mapDataFrameColBind(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { special: string[] },
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = args.find(arg => isDataFrameArgument(arg, info));

	if(dataFrame === undefined) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id
		}];
	}
	const result: DataFrameOperation[] = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;
	let colnames: (string | undefined)[] | undefined = [];

	for(const arg of args) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			if(isDataFrameArgument(arg, info)) {
				const otherDataFrame = resolveIdToAbstractValue(arg.value, info.graph) ?? DataFrameTop;

				result.push({
					operation: 'concatCols',
					operand:   operand?.info.id,
					other:     otherDataFrame
				});
				operand = undefined;
			// added columns are top if argument cannot be resolved to constant (vector-like) value
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
			colnames
		});
	}
	return result;
}

function mapDataFrameRowBind(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { special: string[] },
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = args.find(arg => isDataFrameArgument(arg, info));

	if(dataFrame === undefined) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id
		}];
	}
	const result: DataFrameOperation[] = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;
	let rows: number | undefined = 0;

	for(const arg of args) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			if(isDataFrameArgument(arg, info)) {
				const otherDataFrame = resolveIdToAbstractValue(arg.value, info.graph) ?? DataFrameTop;

				result.push({
					operation: 'concatRows',
					operand:   operand?.info.id,
					other:     otherDataFrame
				});
				operand = undefined;
			// number of added rows is top if arguments cannot be resolved to constant (vector-like) value
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
			rows
		});
	}
	return result;
}

function mapDataFrameHeadTail(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, amount: FunctionParameterLocation<number> },
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	}
	const result: DataFrameOperation[] = [];
	const amount = getArgumentValue(args, params.amount, info);
	let rows: number | undefined = undefined;
	let cols: number | undefined = undefined;

	if(typeof amount === 'number') {
		rows = amount;
	} else if(Array.isArray(amount) && amount.length <= 2 && amount.every(value => typeof value === 'number')) {
		rows = amount[0];
		cols = amount[1];
	}
	result.push({
		operation: rows === undefined || rows >= 0 ? 'subsetRows' : 'removeRows',
		operand:   dataFrame.value.info.id,
		rows:      rows !== undefined ? Math.abs(rows) : undefined
	});

	if(cols !== undefined) {
		result.push({
			operation: cols >= 0 ? 'subsetCols' : 'removeCols',
			operand:   undefined,
			colnames:  Array(Math.abs(cols)).fill(undefined)
		});
	}
	return result;
}

function mapDataFrameSubset(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		dataFrame: FunctionParameterLocation,
		subset:    FunctionParameterLocation,
		select:    FunctionParameterLocation,
		drop:      FunctionParameterLocation<boolean>
	},
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id
		}];
	}
	const result: DataFrameOperation[] = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;

	const filterArg = getFunctionArgument(args, params.subset, info);
	const filterValue = resolveIdToArgValue(filterArg, info);
	const selectArg = getFunctionArgument(args, params.select, info);
	const dropArg = getFunctionArgument(args, params.drop, info);

	const condition = typeof filterValue === 'boolean' ? filterValue : undefined;
	const { selectedCols, unselectedCols } = getSelectedColumns([selectArg], info);
	const accessedCols = [...selectedCols ?? [], ...unselectedCols ?? []];

	const duplicateCols = accessedCols.some((col, _, list) => col !== undefined && list.filter(other => other === col).length > 1);

	if(accessedCols.some(col => typeof col === 'string')) {
		result.push({
			operation: 'accessCols',
			operand:   operand?.info.id,
			columns:   accessedCols.filter(col => typeof col === 'string')
		});
	}
	if(accessedCols.some(col => typeof col === 'number')) {
		result.push({
			operation: 'accessCols',
			operand:   operand?.info.id,
			columns:   accessedCols.filter(col => typeof col === 'number')
		});
	}

	if(filterArg !== undefined && filterArg !== EmptyArgument) {
		result.push({
			operation: 'filterRows',
			operand:   operand?.info.id,
			condition: condition
		});
		operand = undefined;
	}
	if(!dropArg || accessedCols.length > 1) {
		if(unselectedCols === undefined || unselectedCols.length > 0) {
			result.push({
				operation: 'removeCols',
				operand:   operand?.info.id,
				colnames:  unselectedCols?.map(col => typeof col === 'string' ? col : undefined)
			});
			operand = undefined;
		}
		if(selectedCols === undefined || selectedCols.length > 0) {
			result.push({
				operation: 'subsetCols',
				operand:   operand?.info.id,
				colnames:  selectedCols?.map(col => typeof col === 'string' ? col : undefined),
				...(duplicateCols ? { options: { colnamesChange: true } } : {})
			});
			operand = undefined;
		}
	}
	return result;
}

function mapDataFrameFilter(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id
		}];
	}
	const result: DataFrameOperation[] = [];

	const filterArgs = args.filter(arg => arg !== dataFrame);
	const filterValues = filterArgs.map(arg => resolveIdToArgValue(arg, info));

	const accessedNames = filterArgs.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info));
	const condition = filterValues.every(value => typeof value === 'boolean') ? filterValues.every(cond => cond) : undefined;

	if(accessedNames.length > 0) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			columns:   accessedNames
		});
	}

	result.push({
		operation: 'filterRows',
		operand:   dataFrame.value.info.id,
		condition: condition
	});
	return result;
}

function mapDataFrameSelect(
	args: readonly RFunctionArgument<ParentInformation & AbstractInterpretationInfo>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	}
	const result: DataFrameOperation[] = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;

	const selectArgs = args.filter(arg => arg !== dataFrame);

	let { selectedCols, unselectedCols } = getSelectedColumns(selectArgs, info);
	const accessedCols = [...selectedCols ?? [], ...unselectedCols ?? []];

	const mixedAccess = accessedCols.some(col => typeof col === 'string') && accessedCols.some(col => typeof col === 'number');
	const duplicateAccess = accessedCols.some((col, _, list) => col !== undefined && list.filter(other => other === col).length > 1);

	// map to top if columns are selected mixed by string and number, or are selected duplicate
	if(mixedAccess || duplicateAccess) {
		selectedCols = undefined;
		unselectedCols = [];
	}
	if(accessedCols.some(col => typeof col === 'string')) {
		result.push({
			operation: 'accessCols',
			operand:   operand?.info.id,
			columns:   accessedCols.filter(col => typeof col === 'string')
		});
	}
	if(accessedCols.some(col => typeof col === 'number')) {
		result.push({
			operation: 'accessCols',
			operand:   operand?.info.id,
			columns:   accessedCols.filter(col => typeof col === 'number')
		});
	}

	if(unselectedCols === undefined || unselectedCols.length > 0) {
		result.push({
			operation: 'removeCols',
			operand:   operand?.info.id,
			colnames:  unselectedCols?.map(col => typeof col === 'string' ? col : undefined)
		});
		operand = undefined;
	}
	if(selectedCols === undefined || selectedCols.length > 0 || unselectedCols?.length === 0) {
		result.push({
			operation: 'subsetCols',
			operand:   operand?.info.id,
			colnames:  selectedCols?.map(col => typeof col === 'string' ? col : undefined)
		});
		operand = undefined;
	}
	return result;
}

function mapDataFrameMutate(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id
		}];
	}
	const result: DataFrameOperation[] = [];
	const accessedNames = args.filter(arg => arg !== dataFrame).flatMap(arg => getUnresolvedSymbolsInExpression(arg, info));
	const mutatedCols = args.filter(arg => arg !== dataFrame).map(arg => resolveIdToArgName(arg, info));

	if(accessedNames.length > 0) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			columns:   accessedNames
		});
	}

	result.push({
		operation: 'mutateCols',
		operand:   dataFrame.value.info.id,
		colnames:  mutatedCols
	});
	return result;
}

function mapDataFrameGroupBy(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		dataFrame: FunctionParameterLocation,
		by:        FunctionParameterLocation,
		special:   string[]
	},
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id
		}];
	}
	const result: DataFrameOperation[] = [];
	const byArg = getFunctionArgument(args, params.by, info);
	const byName = resolveIdToArgValueSymbolName(byArg, info);

	if(byName !== undefined) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			columns:   [byName]
		});
	}

	result.push({
		operation: 'groupBy',
		operand:   dataFrame.value.info.id,
		by:        byName
	});
	return result;
}

function mapDataFrameSummarize(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id
		}];
	}
	const result: DataFrameOperation[] = [];
	const accessedNames = args.filter(arg => arg !== dataFrame).flatMap(arg => getUnresolvedSymbolsInExpression(arg, info));
	const summarizedCols = args.filter(arg => arg !== dataFrame).map(arg => resolveIdToArgName(arg, info));

	if(accessedNames.length > 0) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			columns:   accessedNames
		});
	}

	result.push({
		operation: 'summarize',
		operand:   dataFrame.value.info.id,
		colnames:  summarizedCols
	});
	return result;
}

function mapDataFrameLeftJoin(
	args: readonly RFunctionArgument<ParentInformation & AbstractInterpretationInfo>[],
	params: {
		dataFrame:      FunctionParameterLocation,
		otherDataFrame: FunctionParameterLocation,
		by:             FunctionParameterLocation,
		minRows?:       boolean
	},
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	} else if(args.length === 1) {
		return [{
			operation: 'identity',
			operand:   dataFrame.value.info.id
		}];
	}
	const result: DataFrameOperation[] = [];
	const otherArg = getFunctionArgument(args, params.otherDataFrame, info);
	const otherDataFrame = resolveIdToAbstractValue(otherArg, info.graph);
	const byArg = getFunctionArgument(args, params.by, info);
	const byName = resolveIdToArgValueSymbolName(byArg, info);

	if(byName !== undefined) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			columns:   [byName]
		});
	}

	result.push({
		operation: 'leftJoin',
		operand:   dataFrame.value.info.id,
		other:     otherDataFrame ?? DataFrameTop,
		by:        byName,
		...(params.minRows ? { options: { minRows: true } } : {})
	});
	return result;
}

function mapDataFrameIdentity(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	info: ResolveInfo
): DataFrameOperation[] | undefined {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, info)) {
		return;
	}
	return [{
		operation: 'identity',
		operand:   dataFrame.value.info.id
	}];
}

function getArgumentValue<T>(
	args: readonly RFunctionArgument<ParentInformation>[],
	argument: FunctionParameterLocation<T>,
	info: ResolveInfo
) {
	const arg = getFunctionArgument(args, argument, info);

	return arg !== undefined ? resolveIdToArgValue(arg, info) : argument.default;
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
	argument: FunctionParameterLocation<unknown> | string,
	info: ResolveInfo
): RFunctionArgument<ParentInformation> | undefined {
	const pos = typeof argument !== 'string' ? argument.pos : -1;
	const name = typeof argument !== 'string' ? argument.name : argument;
	let arg = undefined;

	if(name !== undefined) {
		arg = args.find(arg => resolveIdToArgName(arg, info) === name);
	}
	if(arg === undefined && pos >= 0 && pos < args.length && args[pos] !== EmptyArgument && args[pos].name === undefined) {
		arg = args[pos];
	}
	return arg;
}

function getEffectiveArgs(
	args: readonly RFunctionArgument<ParentInformation>[],
	excluded: string[]
): readonly RFunctionArgument<ParentInformation>[] {
	return args.filter(arg => arg === EmptyArgument || arg.name === undefined || !excluded.includes(unquoteArgument(arg.name.content)));
}

function getEntriesFromCsvLine(line: string, sep: string = ',', quote: string = '"', comment: string = '', trim: boolean = true): (string | undefined)[] {
	sep = escapeRegExp(sep, true);  // only allow tokens like `\s`, `\t`, or `\n` in separator, quote, and comment chars
	quote = escapeRegExp(quote, true);
	comment = escapeRegExp(comment, true);
	const quantifier = sep === '\\s' ? '+' : '*';  // do not allow unquoted empty entries in whitespace-sparated files

	const LineCommentRegex = new RegExp(`[${comment}].*`);
	const CsvEntryRegex = new RegExp(`(?<=^|[${sep}])(?:[${quote}]((?:[^${quote}]|[${quote}]{2})*)[${quote}]|([^${sep}]${quantifier}))`, 'g');
	const DoubleQuoteRegex = new RegExp(`([${quote}])\\1`, 'g');

	return (comment ? line.replace(LineCommentRegex, '') : line)
		.matchAll(CsvEntryRegex)
		.map(match => match[1]?.replace(DoubleQuoteRegex, '$1') ?? match[2])
		.map(entry => trim ? entry.trim() : entry)
		.toArray();
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
				return [unquoteArgument(expression.content)];
			} else {
				return [];
			}
		default:
			return [];
	}
}

function hasCriticalArgument(
	args: readonly RFunctionArgument<ParentInformation>[],
	critical: (FunctionParameterLocation<unknown> | string)[] | undefined,
	info: ResolveInfo
): boolean {
	for(const param of critical ?? []) {
		const arg = getFunctionArgument(args, param, info);

		if(arg === undefined) {
			continue;
		} else if(typeof param !== 'string' && param.default !== undefined) {
			const value = resolveIdToArgValue(arg, info);

			if(value !== undefined && value === param.default) {
				continue;
			}
		}
		return true;
	}
	return false;
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

function escapeRegExp(text: string, allowTokens: boolean = false) {
	if(allowTokens) {
		return text.replace(/[.*+?^${}()|[\]]/g, '\\$&');
	} else {
		return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}

function getSelectedColumns(args: readonly (RFunctionArgument<ParentInformation> | undefined)[], info: ResolveInfo) {
	let selectedCols: (string | number | undefined)[] | undefined = [];
	let unselectedCols: (string | number | undefined)[] | undefined = [];
	const joinColumns = (columns1: (string | number | undefined)[] | undefined, columns2: (string | number | undefined)[] | undefined) =>
		columns1 !== undefined && columns2 !== undefined ? [...columns1, ...columns2] : undefined;

	for(const arg of args) {
		if(arg !== undefined && arg !== EmptyArgument) {
			if(arg.value?.type === RType.FunctionCall && arg.value.named && arg.value.functionName.content === 'c') {
				const result = getSelectedColumns(arg.value.arguments, info);
				selectedCols = joinColumns(selectedCols, result.selectedCols);
				unselectedCols = joinColumns(unselectedCols, result.unselectedCols);
			} else if(arg.value?.type === RType.UnaryOp && arg.value.operator === '-' && info.idMap !== undefined) {
				const result = getSelectedColumns([toUnnamedArgument(arg.value.operand, info.idMap)], info);
				selectedCols = joinColumns(selectedCols, result.unselectedCols);
				unselectedCols = joinColumns(unselectedCols, result.selectedCols);
			} else if(arg.value?.type === RType.BinaryOp && arg.value.operator === ':' && info.idMap !== undefined) {
				const values = resolveIdToArgValue(toUnnamedArgument(arg.value, info.idMap), { ...info, resolve: VariableResolve.Disabled });

				if(Array.isArray(values) && values.every(value => typeof value === 'number')) {
					selectedCols = joinColumns(selectedCols, values.filter(value => value >= 0));
					unselectedCols = joinColumns(unselectedCols, values.filter(value => value < 0).map(Math.abs));
				} else {
					selectedCols = undefined;
				}
			} else if(arg.value?.type === RType.Symbol || arg.value?.type === RType.String) {
				selectedCols?.push(resolveIdToArgValueSymbolName(arg, info));
			} else if(arg.value?.type === RType.Number) {
				selectedCols?.push(arg.value.content.num);
			} else {
				selectedCols = undefined;
			}
		}
	}
	return { selectedCols, unselectedCols };
}
