import { VariableResolve } from '../../config';
import { Identifier } from '../../dataflow/environments/identifier';
import type { ResolveInfo } from '../../dataflow/eval/resolve/alias-tracking';
import { toUnnamedArgument } from '../../dataflow/internal/process/functions/call/argument/make-argument';
import { findSource } from '../../dataflow/internal/process/functions/call/built-in/built-in-source';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { EmptyArgument, RFunctionCall, type PotentiallyEmptyRArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { requestFromInput, type RParseRequest } from '../../r-bridge/retriever';
import { isNotUndefined, isUndefined } from '../../util/assert';
import type { AbstractSemantics, SemanticsContext } from '../abstract-semantics';
import type { StateDomain } from '../domains/state-domain-like';
import type { SemanticsDefinition } from '../value-semantics';
import { DataFrameDomain } from './dataframe-domain';
import { escapeRegExp, filterValidNames, getArgumentValue, getEffectiveArgs, getFunctionArgument, getFunctionArguments, getUnresolvedSymbolsInExpression, hasCriticalArgument, isDataFrameArgument, isRNull, parseRequestContent, type FunctionParameterLocation } from './mappers/arguments';
import { resolveIdToArgName, resolveIdToArgValue, resolveIdToArgValueSymbolName, resolveIdToArgVectorLength, unescapeSpecialChars } from './resolve-args';
import { applyDataFrameSemantics, ConstraintType, getConstraintType } from './semantics';
import type { DataFrameOperations } from './shape-inference';

/**
 * Represents the different types of data frames in R
 */
enum DataFrameType {
	DataFrame = 'data.frame',
	Tibble = 'tibble',
	DataTable = 'data.table'
}

/**
 * The abstract semantics of the supported concrete data frame functions,
 * mapping each supported function to the abstract data frame operations the function is composed of,
 * including information about the origin library of the function, the type of the returned data frame,
 * and the location of all relevant function parameters (see {@link FunctionParameterLocation}).
 */
export const DataFrameSemantics = {
	functionCalls: {
		'base::data.frame': applyFunctionCall(mapDataFrameCreate, {
			checkNames: { pos: -1, name: 'check.names', default: true },
			noDupNames: { pos: -1, name: 'check.names', default: true },
			special:    ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'],
			critical:   [{ pos: -1, name: 'row.names' }]
		}, DataFrameType.DataFrame, true),
		'base::as.data.frame': applyFunctionCall(mapDataFrameConvert, {
			dataFrame: { pos: 0, name: 'x' },
			critical:  []
		}, DataFrameType.DataFrame, true),
		'utils::read.table': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.DataFrame, true),
		'utils::read.csv': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.DataFrame, true),
		'utils::read.csv2': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.DataFrame, true),
		'utils::read.delim': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.DataFrame, true),
		'utils::read.delim2': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.DataFrame, true),
		'readr::read_table': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.Tibble, true),
		'readr::read_csv': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.Tibble, true),
		'readr::read_csv2': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.Tibble, true),
		'readr::read_tsv': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.Tibble, true),
		'readr::read_delim': applyFunctionCall(mapDataFrameRead, {
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
		}, DataFrameType.Tibble, true),
		'base::cbind': applyFunctionCall(mapDataFrameColBind, {
			special: ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude']
		}, DataFrameType.DataFrame),
		'base::rbind': applyFunctionCall(mapDataFrameRowBind, {
			special: ['deparse.level', 'make.row.names', 'stringsAsFactors', 'factor.exclude']
		}, DataFrameType.DataFrame),
		'utils::head': applyFunctionCall(mapDataFrameHeadTail, {
			dataFrame: { pos: 0, name: 'x' },
			amount:    { pos: 1, name: 'n', default: 6 }
		}, DataFrameType.DataFrame),
		'utils::tail': applyFunctionCall(mapDataFrameHeadTail, {
			dataFrame: { pos: 0, name: 'x' },
			amount:    { pos: 1, name: 'n', default: 6 }
		}, DataFrameType.DataFrame),
		'base::subset': applyFunctionCall(mapDataFrameSubset, {
			dataFrame: { pos: 0, name: 'x' },
			subset:    { pos: 1, name: 'subset' },
			select:    { pos: 2, name: 'select' },
			drop:      { pos: 3, name: 'drop', default: false }
		}, DataFrameType.DataFrame),
		'dplyr::filter': applyFunctionCall(mapDataFrameFilter, {
			dataFrame: { pos: 0, name: '.data' },
			special:   ['.by', '.preserve']
		}, DataFrameType.DataFrame, true),
		'dplyr::select': applyFunctionCall(mapDataFrameSelect, {
			dataFrame: { pos: 0, name: '.data' },
			special:   []
		}, DataFrameType.DataFrame, true),
		'dplyr::mutate': applyFunctionCall(mapDataFrameMutate, {
			dataFrame:  { pos: 0, name: '.data' },
			special:    ['.by', '.keep', '.before', '.after'],
			critical:   [{ pos: -1, name: '.keep' }],
			checkNames: false,
			noDupNames: false
		}, DataFrameType.DataFrame, true),
		'base::transform': applyFunctionCall(mapDataFrameMutate, {
			dataFrame:  { pos: 0, name: '_data' },
			special:    [],
			checkNames: true,
			noDupNames: true
		}, DataFrameType.DataFrame, true),
		'dplyr::group_by': applyFunctionCall(mapDataFrameGroupBy, {
			dataFrame: { pos: 0, name: '.data' },
			by:        { pos: 1 },
			special:   ['.add', '.drop']
		}, DataFrameType.Tibble, true),
		'dplyr::summarise': applyFunctionCall(mapDataFrameSummarize, {
			dataFrame: { pos: 0, name: '.data' },
			special:   ['.by', '.groups']
		}, DataFrameType.DataFrame, true),
		'dplyr::summarize': applyFunctionCall(mapDataFrameSummarize, {
			dataFrame: { pos: 0, name: '.data' },
			special:   ['.by', '.groups']
		}, DataFrameType.DataFrame, true),
		'dplyr::inner_join': applyFunctionCall(mapDataFrameJoin, {
			dataFrame:      { pos: 0, name: 'x' },
			otherDataFrame: { pos: 1, name: 'y' },
			by:             { pos: 2, name: 'by' },
			joinAll:        { pos: -1, default: false },
			joinLeft:       { pos: -1, default: false },
			joinRight:      { pos: -1, default: false },
			critical:       [{ pos: -1, name: 'keep' }]
		}, DataFrameType.DataFrame, true),
		'dplyr::left_join': applyFunctionCall(mapDataFrameJoin, {
			dataFrame:      { pos: 0, name: 'x' },
			otherDataFrame: { pos: 1, name: 'y' },
			by:             { pos: 2, name: 'by' },
			joinAll:        { pos: -1, default: false },
			joinLeft:       { pos: -1, default: true },
			joinRight:      { pos: -1, default: false },
			critical:       [{ pos: -1, name: 'keep' }]
		}, DataFrameType.DataFrame, true),
		'dplyr::right_join': applyFunctionCall(mapDataFrameJoin, {
			dataFrame:      { pos: 0, name: 'x' },
			otherDataFrame: { pos: 1, name: 'y' },
			by:             { pos: 2, name: 'by' },
			joinAll:        { pos: -1, default: false },
			joinLeft:       { pos: -1, default: false },
			joinRight:      { pos: -1, default: true },
			critical:       [{ pos: -1, name: 'keep' }]
		}, DataFrameType.DataFrame, true),
		'dplyr::full_join': applyFunctionCall(mapDataFrameJoin, {
			dataFrame:      { pos: 0, name: 'x' },
			otherDataFrame: { pos: 1, name: 'y' },
			by:             { pos: 2, name: 'by' },
			joinAll:        { pos: -1, default: true },
			joinLeft:       { pos: -1, default: false },
			joinRight:      { pos: -1, default: false },
			critical:       [{ pos: -1, name: 'keep' }]
		}, DataFrameType.DataFrame, true),
		'base::merge': applyFunctionCall(mapDataFrameJoin, {
			dataFrame:      { pos: 0, name: 'x' },
			otherDataFrame: { pos: 1, name: 'y' },
			by:             { pos: 2, name: 'by' },
			joinAll:        { pos: 5, name: 'all', default: false },
			joinLeft:       { pos: 6, name: 'all.x', default: false },
			joinRight:      { pos: 7, name: 'all.y', default: false },
			critical:       [
				{ pos: 3, name: 'by.x' },
				{ pos: 4, name: 'by.y' }
			]
		}, DataFrameType.DataFrame, true),
		'dplyr::relocate': applyFunctionCall(mapDataFrameIdentity, {
			dataFrame:         { pos: 0, name: '.data' },
			special:           ['.before', '.after'],
			disallowNamedArgs: true
		}, DataFrameType.DataFrame, true),
		'dplyr::arrange': applyFunctionCall(mapDataFrameIdentity, {
			dataFrame: { pos: 0, name: '.data' },
			special:   ['.by_group', '.locale']
		}, DataFrameType.DataFrame, true)
	}
} satisfies SemanticsDefinition<StateDomain<DataFrameDomain>>;

/**
 * Creates the abstract semantics of a data frame function, by mapping calls of the function to abstract data frame operations and applying their semantics.
 * @param mapper                 - The mapper function mapping the arguments of the function call to abstract data frame operations
 * @param params                 - The expected location of all relevant function parameters, including all `critical` parameters whose presence makes the call unsupported
 * @param returnType             - The type of the data frame returned by the function
 * @param alwaysReturnsDataFrame - Whether the function always returns a data frame, so that unsuccessful mappings are over-approximated by the `unknown` operation
 * @returns The function call semantics applying the abstract data frame operations of the function
 */
function applyFunctionCall<Params extends object, Mapper extends DataFrameFunctionMapping<Params>>(
	mapper: Mapper,
	params: Params & { critical?: FunctionParameterLocation<unknown>[] },
	returnType: DataFrameType,
	alwaysReturnsDataFrame?: boolean
): AbstractSemantics<StateDomain<DataFrameDomain>>['handleFunctionCall'] {
	return (state, vertex, ctx) => {
		const resolveInfo = { graph: ctx.dfg, idMap: ctx.ast.idMap, full: true, resolve: VariableResolve.Alias, ctx: ctx.context };
		const node = ctx.ast.idMap.get(vertex.id);

		if(!RFunctionCall.isNamed(node)) {
			return;
		}
		let operations: DataFrameOperations;
		const args = getFunctionArguments(node, ctx.dfg);

		if(hasCriticalArgument(args, params.critical, resolveInfo)) {
			operations = [{ operation: 'unknown', operand: undefined }];
		} else {
			operations = mapper(args, params, ctx, resolveInfo) ?? (alwaysReturnsDataFrame ? [{ operation: 'unknown', operand: undefined }] : undefined);
		}
		applyDataFrameExpression(state, node, operations, ctx);
	};
}

/**
 * Applies the semantics of abstract data frame operations to an abstract state,
 * by storing the inferred abstract value either at the modified operand or at the result of the expression, depending on the {@link ConstraintType} of the operation.
 * @param state      - The abstract state to apply the semantics to
 * @param node       - The R node of the expression the abstract operations were mapped from
 * @param operations - The abstract data frame operations to apply
 * @param ctx        - The semantics context of the analysis
 */
function applyDataFrameExpression(state: StateDomain<DataFrameDomain>, node: RNode<ParentInformation>, operations: DataFrameOperations, ctx: SemanticsContext<StateDomain<DataFrameDomain>>): void {
	if(operations === undefined) {
		return;
	}
	const maxColNames = ctx.context.config.abstractInterpretation.dataFrame.maxColNames;
	let value = DataFrameDomain.top(maxColNames);

	for(const { operation, operand, type, options, ...args } of operations) {
		const operandValue = operand !== undefined ? ctx.getAbstractValue(operand, state) : value;
		value = applyDataFrameSemantics(operation, operandValue ?? DataFrameDomain.top(maxColNames), args, options);
		const constraintType = type ?? getConstraintType(operation);

		if(operand !== undefined && constraintType === ConstraintType.OperandModification) {
			state.set(operand, value);

			for(const origin of ctx.getVariableOrigins(operand)) {
				state.set(origin, value);
			}
		} else if(constraintType === ConstraintType.ResultPostcondition) {
			state.set(node.info.id, value);
		}
	}
}

/**
 * Data frame function mapper for mapping a concrete data frame function to abstract data frame operations.
 * - `args` contains the function call arguments
 * - `params` contains the expected argument location for each parameter of the function
 * - `ctx` contains the semantics context of the analysis
 * - `info` contains the resolve information
 */
type DataFrameFunctionMapping<Params extends object> = (
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: Params,
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
) => DataFrameOperations;

/**
 * Maps a data frame creation function, such as `data.frame(id = 1:5, name = c("A", "B"))`, to abstract data frame operations.
 */
function mapDataFrameCreate(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: {
		checkNames: FunctionParameterLocation<boolean>,
		noDupNames: FunctionParameterLocation<boolean>,
		special:    string[]
	},
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	const checkNames = getArgumentValue(args, params.checkNames, info);
	const noDupNames = getArgumentValue(args, params.noDupNames, info);
	args = getEffectiveArgs(args, params.special);

	const argNames = args.map(arg => resolveIdToArgName(arg, info));
	const argLengths = args.map(arg => resolveIdToArgVectorLength(arg, info));
	const allVectors = argLengths.every(isNotUndefined);
	const rows = allVectors ? Math.max(...argLengths, 0) : undefined;
	let colnames: (string | undefined)[] | undefined = argNames;

	// over-approximate the column names if arguments are present but cannot be resolved to values
	if(!allVectors || typeof checkNames !== 'boolean' || typeof noDupNames !== 'boolean') {
		colnames = undefined;
	} else if(rows === 0) {
		colnames = [];
	} else {
		colnames = filterValidNames(colnames, checkNames, noDupNames);
	}
	return [{
		operation: 'create',
		operand:   undefined,
		colnames,
		rows
	}];
}

/**
 * Maps a data frame conversion function, such as `as.data.frame(x)`, to abstract data frame operations.
 */
function mapDataFrameConvert(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation },
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(dataFrame === EmptyArgument || dataFrame?.value === undefined) {
		return [{ operation: 'unknown', operand: undefined }];
	}
	return [{
		operation: 'identity',
		operand:   dataFrame.value.info.id
	}];
}

/**
 * Maps a data frame read function, such as `read.csv("file.csv")`, to abstract data frame operations.
 * If reading external files is enabled in the configuration, the content of the read file or text is parsed to infer the column names and the number of rows.
 */
function mapDataFrameRead(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
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
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
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

	const validArguments = typeof header === 'boolean' && typeof separator === 'string' && typeof quote === 'string' && typeof comment === 'string' &&
		typeof skipLines === 'number' && typeof checkNames === 'boolean' && typeof noDupNames === 'boolean';

	if(request === undefined || !info.ctx.config.abstractInterpretation.dataFrame.readLoadedData.readExternalFiles || !validArguments) {
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
	const allLines = parseRequestContent(request, parseLine, info.ctx.config.abstractInterpretation.dataFrame.readLoadedData.maxReadLines);
	let colnames: (string | undefined)[] | undefined;

	if(header) {
		colnames = filterValidNames(firstLine, checkNames, noDupNames, params.noEmptyNames);
	} else if(firstLine !== undefined) {
		colnames = Array(firstLine.length).fill(undefined);
	}
	return [{
		operation: 'read',
		operand:   undefined,
		source,
		colnames,
		rows:      allLines ? rowCount : [rowCount, Infinity]
	}];
}

/**
 * Maps a function adding columns to a data frame, such as `cbind(df, id = 1:5)`, to abstract data frame operations.
 */
function mapDataFrameColBind(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: { special: string[] },
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = args.find(arg => isDataFrameArgument(arg, ctx));

	if(dataFrame === undefined) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;
	let colnames: (string | undefined)[] | undefined = [];

	for(const arg of args) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			const otherDataFrame = ctx.getAbstractValue(arg.value);

			if(otherDataFrame !== undefined) {
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

/**
 * Maps a function adding rows to a data frame, such as `rbind(df, c(1, "A"))`, to abstract data frame operations.
 */
function mapDataFrameRowBind(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: { special: string[] },
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = args.find(arg => isDataFrameArgument(arg, ctx));

	if(dataFrame === undefined) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;
	let rows: number | undefined = 0;

	for(const arg of args) {
		if(arg !== dataFrame && arg !== EmptyArgument) {
			const otherDataFrame = ctx.getAbstractValue(arg.value);

			if(otherDataFrame !== undefined) {
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

/**
 * Maps a function returning the first or last rows of a data frame, such as `head(df, 3)` or `tail(df, 3)`, to abstract data frame operations.
 */
function mapDataFrameHeadTail(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, amount: FunctionParameterLocation<number> },
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, ctx)) {
		return;
	}
	const result: DataFrameOperations = [];
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

/**
 * Maps a function subsetting the rows and columns of a data frame, such as `subset(df, id > 1, select = c(id, name))`, to abstract data frame operations.
 */
function mapDataFrameSubset(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: {
		dataFrame: FunctionParameterLocation,
		subset:    FunctionParameterLocation,
		select:    FunctionParameterLocation,
		drop:      FunctionParameterLocation<boolean>
	},
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, ctx)) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;

	const filterArg = getFunctionArgument(args, params.subset, info);
	const filterValue = resolveIdToArgValue(filterArg, info);
	const selectArg = getFunctionArgument(args, params.select, info);
	const dropArg = getFunctionArgument(args, params.drop, info);

	const condition = typeof filterValue === 'boolean' ? filterValue : undefined;
	const filterNames = getUnresolvedSymbolsInExpression(filterArg, info.graph);
	const { selectedCols, unselectedCols } = getSelectedColumns([selectArg], info);
	const accessedCols = [...filterNames, ...selectedCols ?? [], ...unselectedCols ?? []];

	const mixedAccess = accessedCols.some(col => typeof col === 'string') && accessedCols.some(col => typeof col === 'number');
	const duplicateCols = accessedCols.some((col, index, list) => col !== undefined && list.indexOf(col) !== index);

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
			columns:   accessedCols.filter(col => typeof col === 'number').map(Math.abs)
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
				...(duplicateCols || mixedAccess ? { options: { duplicateCols: true } } : {})
			});
			// eslint-disable-next-line no-useless-assignment -- ends the chain
			operand = undefined;
		}
	}
	return result;
}

/**
 * Maps a function filtering the rows of a data frame, such as `filter(df, id > 1)`, to abstract data frame operations.
 */
function mapDataFrameFilter(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, ctx)) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];

	const filterArgs = args.filter(arg => arg !== dataFrame);
	const filterValues = filterArgs.map(arg => resolveIdToArgValue(arg, info));

	const accessedNames = filterArgs.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info.graph).map(Identifier.getName));
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

/**
 * Maps a function selecting the columns of a data frame, such as `select(df, id, name)` or `select(df, -id)`, to abstract data frame operations.
 */
function mapDataFrameSelect(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, ctx)) {
		return;
	}
	const result: DataFrameOperations = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;

	const selectArgs = args.filter(arg => arg !== dataFrame);

	let { selectedCols, unselectedCols } = getSelectedColumns(selectArgs, info);
	const accessedCols = [...selectedCols ?? [], ...unselectedCols ?? []];

	const mixedAccess = accessedCols.some(col => typeof col === 'string') && accessedCols.some(col => typeof col === 'number');
	const duplicateAccess = accessedCols.some((col, _, list) => col !== undefined && list.filter(other => other === col).length > 1);
	const renamedCols = selectArgs.some(RArgument.isNamed);

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
			columns:   accessedCols.filter(col => typeof col === 'number').map(Math.abs)
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
			colnames:  selectedCols?.map(col => typeof col === 'string' ? col : undefined),
			...(renamedCols ? { options: { renamedCols: true } } : {})
		});
		// eslint-disable-next-line no-useless-assignment -- ends the chain
		operand = undefined;
	}
	return result;
}

/**
 * Maps a function creating, modifying, or deleting the columns of a data frame, such as `mutate(df, id = id + 1)` or `transform(df, id = NULL)`, to abstract data frame operations.
 */
function mapDataFrameMutate(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: {
		dataFrame:   FunctionParameterLocation,
		special:     string[],
		checkNames?: boolean,
		noDupNames?: boolean
	},
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, ctx)) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;

	const mutateArgs = args.filter(arg => arg !== dataFrame);

	let deletedCols: (string | undefined)[] | undefined = mutateArgs
		.filter(isRNull)
		.map(arg => resolveIdToArgName(arg, info));
	let mutatedCols: (string | undefined)[] | undefined = mutateArgs
		.filter(arg => !isRNull(arg))
		.map(arg => resolveIdToArgName(arg, info));

	// only column names that are not created by mutation are preconditions on the operand
	const accessedNames = mutateArgs
		.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info.graph).map(Identifier.toString))
		.filter(arg => !mutatedCols?.includes(arg));

	deletedCols = filterValidNames(deletedCols, params.checkNames, params.noDupNames, undefined, true);
	mutatedCols = filterValidNames(mutatedCols, params.checkNames, params.noDupNames, undefined, true);

	if(accessedNames.length > 0) {
		result.push({
			operation: 'accessCols',
			operand:   operand?.info.id,
			columns:   accessedNames
		});
	}

	if(mutatedCols === undefined || mutatedCols.length > 0 || deletedCols?.length === 0) {
		result.push({
			operation: 'mutateCols',
			operand:   operand?.info.id,
			colnames:  mutatedCols
		});
		operand = undefined;
	}
	if(deletedCols === undefined || deletedCols.length > 0) {
		result.push({
			operation: 'removeCols',
			operand:   operand?.info.id,
			colnames:  deletedCols,
			options:   { maybe: true }
		});
		// eslint-disable-next-line no-useless-assignment -- ends the chain
		operand = undefined;
	}
	return result;
}

/**
 * Maps a function grouping the rows of a data frame by columns, such as `group_by(df, id)`, to abstract data frame operations.
 */
function mapDataFrameGroupBy(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: {
		dataFrame: FunctionParameterLocation,
		by:        FunctionParameterLocation,
		special:   string[]
	},
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, ctx)) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];
	const byArgs = args.filter(arg => arg !== dataFrame);

	const accessedNames = byArgs.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info.graph)).map(Identifier.toString);
	const byNames = byArgs.map(arg => RArgument.isNamed(arg) ? resolveIdToArgName(arg, info) : resolveIdToArgValueSymbolName(arg, info));

	const mutatedCols = byArgs.some(RArgument.isNamed) || byNames.some(isUndefined);

	if(accessedNames.length > 0) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			columns:   accessedNames
		});
	}

	result.push({
		operation: 'groupBy',
		operand:   dataFrame.value.info.id,
		by:        byNames,
		...(mutatedCols ? { options: { mutatedCols: true } } : {})
	});
	return result;
}

/**
 * Maps a function summarizing the columns of a data frame, such as `summarize(df, mean = mean(score))`, to abstract data frame operations.
 */
function mapDataFrameSummarize(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, ctx)) {
		return;
	}
	const result: DataFrameOperations = [];
	const summarizeArgs = args.filter(arg => arg !== dataFrame);

	const summarizedCols = summarizeArgs.map(arg => resolveIdToArgName(arg, info));

	// only column names that are not created by summarize are preconditions on the operand
	const accessedNames = summarizeArgs
		.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info.graph).map(Identifier.toString))
		.filter(arg => !summarizedCols.includes(arg));

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

/**
 * Maps a function joining two data frames, such as `left_join(df1, df2, by = "id")` or `merge(df1, df2)`, to abstract data frame operations.
 */
function mapDataFrameJoin(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: {
		dataFrame:      FunctionParameterLocation,
		otherDataFrame: FunctionParameterLocation,
		by:             FunctionParameterLocation,
		joinAll:        FunctionParameterLocation<boolean>,
		joinLeft:       FunctionParameterLocation<boolean>,
		joinRight:      FunctionParameterLocation<boolean>
	},
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);
	const joinAll = getArgumentValue(args, params.joinAll, info);
	const joinLeft = getArgumentValue(args, params.joinLeft, info);
	const joinRight = getArgumentValue(args, params.joinRight, info);

	if(!isDataFrameArgument(dataFrame, ctx)) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	} else if(typeof joinAll !== 'boolean' || typeof joinLeft !== 'boolean' || typeof joinRight !== 'boolean') {
		return [{ operation: 'unknown', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];

	const otherArg = getFunctionArgument(args, params.otherDataFrame, info);
	const byArg = getFunctionArgument(args, params.by, info);

	const otherDataFrame = ctx.getAbstractValue(otherArg) ?? DataFrameDomain.top(info.ctx.config.abstractInterpretation.dataFrame.maxColNames);
	let byCols: (string | number | undefined)[] | undefined;

	const joinType = getJoinType(joinAll, joinLeft, joinRight);

	if(byArg !== undefined) {
		const byValue = resolveIdToArgValue(byArg, info);

		if(typeof byValue === 'string' || typeof byValue === 'number') {
			byCols = [byValue];
		} else if(Array.isArray(byValue) && (byValue.every(by => typeof by === 'string') || byValue.every(by => typeof by === 'number'))) {
			byCols = byValue;
		}
	}

	if(byCols?.some(by => typeof by === 'string')) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			columns:   byCols.filter(by => typeof by === 'string')
		});
	}
	if(byCols?.some(by => typeof by === 'number')) {
		result.push({
			operation: 'accessCols',
			operand:   dataFrame.value.info.id,
			columns:   byCols.filter(by => typeof by === 'number')
		});
	}

	result.push({
		operation: 'join',
		operand:   dataFrame.value.info.id,
		other:     otherDataFrame,
		by:        byCols?.map(by => typeof by === 'string' ? by : undefined),
		options:   { join: joinType, natural: byArg === undefined }
	});
	return result;
}

/**
 * Maps a function that does not change the shape of a data frame, such as `relocate(df, id)` or `arrange(df, id)`, to abstract data frame operations.
 */
function mapDataFrameIdentity(
	args: readonly PotentiallyEmptyRArgument<ParentInformation>[],
	params: {
		dataFrame:          FunctionParameterLocation,
		special:            string[],
		disallowNamedArgs?: boolean
	},
	ctx: SemanticsContext<StateDomain<DataFrameDomain>>,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, ctx)) {
		return;
	} else if(params.disallowNamedArgs && args.some(RArgument.isNamed)) {
		return [{ operation: 'unknown', operand: dataFrame.value.info.id }];
	}
	return [{
		operation: 'identity',
		operand:   dataFrame.value.info.id
	}];
}

/**
 * Gets the source and the parse request of the file or text that is read by a data frame read function (see {@link mapDataFrameRead}).
 */
function getRequestFromRead(
	fileNameArg: PotentiallyEmptyRArgument<ParentInformation> | undefined,
	textArg: PotentiallyEmptyRArgument<ParentInformation> | undefined,
	params: Parameters<typeof mapDataFrameRead>[1],
	info: ResolveInfo
) {
	let source: string | undefined;
	let request: RParseRequest | undefined;

	if(fileNameArg !== undefined && fileNameArg !== EmptyArgument) {
		const fileName = resolveIdToArgValue(fileNameArg, info);

		if(typeof fileName === 'string') {
			const text = unescapeSpecialChars(fileName);
			source = fileName;
			const referenceChain = fileNameArg.info.file ? [fileNameArg.info.file] : [];
			const sources = findSource(info.ctx.config.solver.resolveSource, fileName, { referenceChain, ctx: info.ctx });

			if(sources?.length === 1) {
				source = sources[0];
				// create request from resolved source file path
				request = { request: 'file', content: sources[0] };
			} else if(params.text === undefined && text.includes('\n')) {
				// create request from string if file name argument contains newline
				request = requestFromInput(text);
			}
		}
	} else if(textArg !== undefined && textArg !== EmptyArgument) {
		const text = resolveIdToArgValue(textArg, info);

		if(typeof text === 'string') {
			request = requestFromInput(unescapeSpecialChars(text));
		}
	}
	if(request?.request === 'file' && info.ctx.files.hasCached(request.content)) {
		request = info.ctx.files.resolveRequest(request).r;
	}
	return { source, request };
}

/**
 * Gets all entries from a line of a CSV file using a custom separator char, quote char, and comment char
 */
function getEntriesFromCsvLine(line: string, sep: string = ',', quote: string = '"', comment: string = '', trim: boolean = true): (string | undefined)[] {
	sep = sep.length > 0 ? sep : '\\s';  // default to whitespace separator
	sep = escapeRegExp(sep, true);  // only allow tokens like `\s`, `\t`, or `\n` in separator, quote, and comment chars
	quote = escapeRegExp(quote);
	comment = escapeRegExp(comment);
	const quantifier = sep === '\\s' ? '+' : '*';  // do not allow unquoted empty entries in whitespace-separated files

	const LineCommentRegex = new RegExp(`[${comment}].*`);
	const CsvEntryRegex = new RegExp(`(?<=^|[${sep}])(?:[${quote}]((?:[^${quote}]|[${quote}]{2})*)[${quote}]|([^${sep}]${quantifier}))`, 'g');
	const DoubleQuoteRegex = new RegExp(`([${quote}])\\1`, 'g'); // regex for doubled quotes like `""` or `''`

	return (comment ? line.replace(LineCommentRegex, '') : line)
		.matchAll(CsvEntryRegex)
		.map(match => match[1]?.replace(DoubleQuoteRegex, '$1') ?? match[2])
		.map(entry => trim ? entry.trim() : entry)
		.toArray();
}

/**
 * Resolves all selected columns in a select expression, such as `id`, `"id"`, `1`, `c(id, name)`, `c("id", "name")`, `1:2`, `-id`, `-1`, `-c(id, name)`, `c(-1, -2)`, etc.
 */
function getSelectedColumns(args: readonly (PotentiallyEmptyRArgument<ParentInformation> | undefined)[], info: ResolveInfo) {
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
			} else if(arg.value?.type === RType.UnaryOp && arg.value.operator === '+' && info.idMap !== undefined) {
				const result = getSelectedColumns([toUnnamedArgument(arg.value.operand, info.idMap)], info);
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

/**
 * Gets the type of a join operation based on whether all rows of the left, the right, or both data frames are kept (see {@link mapDataFrameJoin}).
 */
function getJoinType(joinAll: boolean, joinLeft: boolean, joinRight: boolean): 'inner' | 'left' | 'right' | 'full' {
	if(joinAll || (joinLeft && joinRight)) {
		return 'full';
	} else if(joinLeft) {
		return 'left';
	} else if(joinRight) {
		return 'right';
	} else {
		return 'inner';
	}
}
