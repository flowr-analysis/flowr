import { VariableResolve } from '../../../config';
import { type ResolveInfo } from '../../../dataflow/eval/resolve/alias-tracking';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { toUnnamedArgument } from '../../../dataflow/internal/process/functions/call/argument/make-argument';
import { findSource } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { EmptyArgument, type RFunctionArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { requestFromInput, type RParseRequest } from '../../../r-bridge/retriever';
import { assertUnreachable, isNotUndefined, isUndefined } from '../../../util/assert';
import { readLineByLineSync } from '../../../util/files';
import { DataFrameDomain } from '../dataframe-domain';
import { resolveIdToArgName, resolveIdToArgValue, resolveIdToArgValueSymbolName, resolveIdToArgVectorLength, unescapeSpecialChars } from '../resolve-args';
import type { ConstraintType } from '../semantics';
import type { DataFrameOperations, DataFrameShapeInferenceVisitor } from '../shape-inference';
import { escapeRegExp, filterValidNames, getArgumentValue, getEffectiveArgs, getFunctionArgument, getFunctionArguments, getUnresolvedSymbolsInExpression, hasCriticalArgument, isDataFrameArgument, isNamedArgument, isRNull, type FunctionParameterLocation } from './arguments';

/**
 * Represents the different types of data frames in R
 */
enum DataFrameType {
	DataFrame = 'data.frame',
	Tibble = 'tibble',
	DataTable = 'data.table'
}

/**
 * Mapper for mapping the supported concrete data frame functions to mapper functions,
 * including information about the origin library of the functions and the type of the returned data frame.
 */
const DataFrameFunctionMapper = {
	'data.frame':    { mapper: mapDataFrameCreate,    library: 'base',  returnType: DataFrameType.DataFrame },
	'as.data.frame': { mapper: mapDataFrameConvert,   library: 'base',  returnType: DataFrameType.DataFrame },
	'read.table':    { mapper: mapDataFrameRead,      library: 'utils', returnType: DataFrameType.DataFrame },
	'read.csv':      { mapper: mapDataFrameRead,      library: 'utils', returnType: DataFrameType.DataFrame },
	'read.csv2':     { mapper: mapDataFrameRead,      library: 'utils', returnType: DataFrameType.DataFrame },
	'read.delim':    { mapper: mapDataFrameRead,      library: 'utils', returnType: DataFrameType.DataFrame },
	'read.delim2':   { mapper: mapDataFrameRead,      library: 'utils', returnType: DataFrameType.DataFrame },
	'read_table':    { mapper: mapDataFrameRead,      library: 'readr', returnType: DataFrameType.Tibble    },
	'read_csv':      { mapper: mapDataFrameRead,      library: 'readr', returnType: DataFrameType.Tibble    },
	'read_csv2':     { mapper: mapDataFrameRead,      library: 'readr', returnType: DataFrameType.Tibble    },
	'read_tsv':      { mapper: mapDataFrameRead,      library: 'readr', returnType: DataFrameType.Tibble    },
	'read_delim':    { mapper: mapDataFrameRead,      library: 'readr', returnType: DataFrameType.Tibble    },
	'cbind':         { mapper: mapDataFrameColBind,   library: 'base',  returnType: DataFrameType.DataFrame },
	'rbind':         { mapper: mapDataFrameRowBind,   library: 'base',  returnType: DataFrameType.DataFrame },
	'head':          { mapper: mapDataFrameHeadTail,  library: 'utils', returnType: DataFrameType.DataFrame },
	'tail':          { mapper: mapDataFrameHeadTail,  library: 'utils', returnType: DataFrameType.DataFrame },
	'subset':        { mapper: mapDataFrameSubset,    library: 'base',  returnType: DataFrameType.DataFrame },
	'filter':        { mapper: mapDataFrameFilter,    library: 'dplyr', returnType: DataFrameType.DataFrame },
	'select':        { mapper: mapDataFrameSelect,    library: 'dplyr', returnType: DataFrameType.DataFrame },
	'mutate':        { mapper: mapDataFrameMutate,    library: 'dplyr', returnType: DataFrameType.DataFrame },
	'transform':     { mapper: mapDataFrameMutate,    library: 'base',  returnType: DataFrameType.DataFrame },
	'group_by':      { mapper: mapDataFrameGroupBy,   library: 'dplyr', returnType: DataFrameType.Tibble    },
	'summarise':     { mapper: mapDataFrameSummarize, library: 'dplyr', returnType: DataFrameType.DataFrame },
	'summarize':     { mapper: mapDataFrameSummarize, library: 'dplyr', returnType: DataFrameType.DataFrame },
	'inner_join':    { mapper: mapDataFrameJoin,      library: 'dplyr', returnType: DataFrameType.DataFrame },
	'left_join':     { mapper: mapDataFrameJoin,      library: 'dplyr', returnType: DataFrameType.DataFrame },
	'right_join':    { mapper: mapDataFrameJoin,      library: 'dplyr', returnType: DataFrameType.DataFrame },
	'full_join':     { mapper: mapDataFrameJoin,      library: 'dplyr', returnType: DataFrameType.DataFrame },
	'merge':         { mapper: mapDataFrameJoin,      library: 'base',  returnType: DataFrameType.DataFrame },
	'relocate':      { mapper: mapDataFrameIdentity,  library: 'dplyr', returnType: DataFrameType.DataFrame },
	'arrange':       { mapper: mapDataFrameIdentity,  library: 'dplyr', returnType: DataFrameType.DataFrame }
} as const satisfies Record<string, DataFrameFunctionMapperInfo<never>>;

/**
 * List of other data frame functions that are not explicitly supported but may return data frames.
 */
const OtherDataFrameFunctions = [
	{
		type:       'entry_point',
		names:      ['anova', 'AIC', 'BIC'],
		library:    'anova',
		returnType: DataFrameType.DataFrame
	}, {
		type:       'entry_point',
		names:      ['Anova', 'Manova'],
		library:    'car',
		returnType: DataFrameType.DataFrame
	}, {
		type:       'entry_point',
		names:      ['lmer'],
		library:    'lme4',
		returnType: DataFrameType.DataFrame
	}, {
		type:       'entry_point',
		names:      ['data_frame', 'as_data_frame'],
		library:    'dplyr',
		returnType: DataFrameType.DataFrame
	}, {
		type:       'entry_point',
		names:      ['tbl', 'as.tbl'],
		library:    'dplyr',
		returnType: DataFrameType.Tibble
	}, {
		type:       'entry_point',
		names:      ['read_fwf', 'read_log'],
		library:    'readr',
		returnType: DataFrameType.Tibble
	}, {
		type:       'entry_point',
		names:      ['read_excel', 'read_xls', 'read_xlsx'],
		library:    'readxl',
		returnType: DataFrameType.Tibble
	}, {
		type:       'entry_point',
		names:      ['tibble', 'tibble_row', 'as_tibble', 'tribble'],
		library:    'tibble',
		returnType: DataFrameType.Tibble
	}, {
		type:       'entry_point',
		names:      ['data.table', 'as.data.table', 'fread'],
		library:    'data.table',
		returnType: DataFrameType.DataTable
	}, {
		type:       'transformation',
		names:      ['na.omit'],
		library:    'stats',
		returnType: DataFrameType.DataFrame,
		dataFrame:  { pos: 0, name: 'object' }
	}, {
		type:       'transformation',
		names:      ['unique', 't'],
		library:    'base',
		returnType: DataFrameType.DataFrame,
		dataFrame:  { pos: 0, name: 'x' }
	}, {
		type:       'transformation',
		names:      ['aggregate'],
		library:    'stats',
		returnType: DataFrameType.DataFrame,
		dataFrame:  { pos: 0, name: 'x' }
	}, {
		type:       'transformation',
		names:      ['with', 'within'],
		library:    'base',
		returnType: DataFrameType.DataFrame,
		dataFrame:  { pos: 0, name: 'data' }
	}, {
		type:       'transformation',
		names:      ['reshape'],
		library:    'stats',
		returnType: DataFrameType.DataFrame,
		dataFrame:  { pos: 0, name: 'data' }
	}, {
		type:       'transformation',
		names:      ['melt'],
		library:    'reshape2',
		returnType: DataFrameType.DataFrame,
		dataFrame:  { pos: 0, name: 'data' }
	}, {
		type:  'transformation',
		names: [
			'transmute', 'distinct', 'distinct_prepare', 'group_by_prepare', 'rename', 'rename_with', 'reframe',
			'slice', 'slice_head', 'slice_tail', 'slice_min', 'slice_max', 'slice_sample'
		],
		library:    'dplyr',
		returnType: DataFrameType.DataFrame,
		dataFrame:  { pos: 0, name: '.data' }
	}, {
		type:  'transformation',
		names: [
			'filter_if', 'filter_at', 'filter_all', 'select_if', 'select_at', 'select_all',
			'mutate_if', 'mutate_at', 'mutate_all', 'transmute_if', 'transmute_at', 'transmute_all',
			'distinct_if', 'distinct_at', 'distinct_all', 'group_by_if', 'group_by_at', 'group_by_all',
			'summarize_if', 'summarise_if', 'summarize_at', 'summarise_at', 'summarize_all', 'summarise_all',
			'arrange_if', 'arrange_at', 'arrange_all', 'rename_if', 'rename_at', 'rename_all'
		],
		library:    'dplyr',
		returnType: DataFrameType.Tibble,
		dataFrame:  { pos: 0, name: '.tbl' }
	}, {
		type:  'transformation',
		names: [
			'semi_join', 'anti_join', 'nest_join', 'cross_join',
			'ungroup', 'count', 'tally', 'add_count', 'add_tally',
			'rows_insert', 'rows_append', 'rows_update', 'rows_patch', 'rows_upsert', 'rows_delete'
		],
		library:    'dplyr',
		returnType: DataFrameType.DataFrame,
		dataFrame:  { pos: 0, name: 'x' }
	}, {
		type:       'transformation',
		names:      ['bind_cols', 'bind_rows'],
		library:    'dplyr',
		returnType: DataFrameType.DataFrame
	}, {
		type:  'transformation',
		names: [
			'drop_na', 'replace_na', 'pivot_longer', 'pivot_wider',
			'separate', 'separate_wider_position', 'separate_wider_delim', 'unite'
		],
		library:    'tidyr',
		returnType: DataFrameType.DataFrame,
		dataFrame:  { pos: 0, name: 'data' }
	}, {
		type:       'transformation',
		names:      ['add_column', 'add_row', 'add_case'],
		library:    'tibble',
		returnType: DataFrameType.Tibble,
		dataFrame:  { pos: 0, name: '.data' }
	}, {
		type:       'transformation',
		names:      ['melt', 'dcast'],
		library:    'data.table',
		returnType: DataFrameType.DataTable,
		dataFrame:  { pos: 0, name: 'data' }
	}
] as const satisfies OtherDataFrameFunctionMapping[];

/**
 * Mapper for defining the location of all relevant function parameters for each supported data frame function of {@link DataFrameFunctionMapper}.
 */
const DataFrameFunctionParamsMapper: DataFrameFunctionParamsMapping = {
	'data.frame': {
		checkNames: { pos: -1, name: 'check.names', default: true },
		noDupNames: { pos: -1, name: 'check.names', default: true },
		special:    ['row.names', 'check.rows', 'check.names', 'fix.empty.names', 'stringsAsFactors'],
		critical:   [{ pos: -1, name: 'row.names' }]
	},
	'as.data.frame': {
		dataFrame: { pos: 0, name: 'x' },
		critical:  []
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
		dataFrame:  { pos: 0, name: '.data' },
		special:    ['.by', '.keep', '.before', '.after'],
		critical:   [{ pos: -1, name: '.keep' }],
		checkNames: false,
		noDupNames: false
	},
	'transform': {
		dataFrame:  { pos: 0, name: '_data' },
		special:    [],
		checkNames: true,
		noDupNames: true
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
	'inner_join': {
		dataFrame:      { pos: 0, name: 'x' },
		otherDataFrame: { pos: 1, name: 'y' },
		by:             { pos: 2, name: 'by' },
		joinAll:        { pos: -1, default: false },
		joinLeft:       { pos: -1, default: false },
		joinRight:      { pos: -1, default: false },
		critical:       [{ pos: -1, name: 'keep' }]
	},
	'left_join': {
		dataFrame:      { pos: 0, name: 'x' },
		otherDataFrame: { pos: 1, name: 'y' },
		by:             { pos: 2, name: 'by' },
		joinAll:        { pos: -1, default: false },
		joinLeft:       { pos: -1, default: true },
		joinRight:      { pos: -1, default: false },
		critical:       [{ pos: -1, name: 'keep' }]
	},
	'right_join': {
		dataFrame:      { pos: 0, name: 'x' },
		otherDataFrame: { pos: 1, name: 'y' },
		by:             { pos: 2, name: 'by' },
		joinAll:        { pos: -1, default: false },
		joinLeft:       { pos: -1, default: false },
		joinRight:      { pos: -1, default: true },
		critical:       [{ pos: -1, name: 'keep' }]
	},
	'full_join': {
		dataFrame:      { pos: 0, name: 'x' },
		otherDataFrame: { pos: 1, name: 'y' },
		by:             { pos: 2, name: 'by' },
		joinAll:        { pos: -1, default: true },
		joinLeft:       { pos: -1, default: false },
		joinRight:      { pos: -1, default: false },
		critical:       [{ pos: -1, name: 'keep' }]
	},
	'merge': {
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
	},
	'relocate': {
		dataFrame:         { pos: 0, name: '.data' },
		special:           ['.before', '.after'],
		disallowNamedArgs: true
	},
	'arrange': {
		dataFrame: { pos: 0, name: '.data' },
		special:   ['.by_group', '.locale']
	}
};

interface DataFrameFunctionMapperInfo<Params extends object> {
	readonly mapper:     DataFrameFunctionMapping<Params>;
	readonly library:    string;
	readonly returnType: DataFrameType;
}

interface OtherDataFrameFunctionBase {
	readonly type:       string;
	readonly names:      readonly string[];
	readonly library:    string;
	readonly returnType: DataFrameType;
}

/** Other data frame functions that are not explicitly supported but return data frames */
interface OtherDataFrameEntryPoint extends OtherDataFrameFunctionBase {
	readonly type: 'entry_point';
}

/** Other data frame transformations that are not explicitly supported but return data frames if an argument is a data frame */
interface OtherDataFrameTransformation extends OtherDataFrameFunctionBase, Readonly<Parameters<typeof mapDataFrameUnknown>[1]> {
	readonly type:       'transformation';
	readonly dataFrame?: FunctionParameterLocation;
}

/** Other data frame functions that are not explicitly supported but modify data frames arguments in place */
interface OtherDataFrameModification extends OtherDataFrameFunctionBase, Readonly<Parameters<typeof mapDataFrameUnknown>[1]> {
	readonly type:           'modification';
	readonly constraintType: ConstraintType.OperandModification;
	readonly dataFrame:      FunctionParameterLocation;
}

/** Other data frame functions that are not explicitly supported but may return data frames */
type OtherDataFrameFunctionMapping = OtherDataFrameEntryPoint | OtherDataFrameTransformation | OtherDataFrameModification;

/**
 * Data frame function mapper for mapping a concrete data frame function to abstract data frame operations.
 * - `args` contains the function call arguments
 * - `params` contains the expected argument location for each parameter of the function
 * - `info` contains the resolve information
 */
type DataFrameFunctionMapping<Params extends object> = (
    args: readonly RFunctionArgument<ParentInformation>[],
	params: Params,
	inference: DataFrameShapeInferenceVisitor,
    info: ResolveInfo
) => DataFrameOperations;

/** All currently supported data frame functions */
type DataFrameFunction = keyof typeof DataFrameFunctionMapper;

/** The required mapping parameters for a data frame function */
type DataFrameFunctionParams<N extends DataFrameFunction> = Parameters<typeof DataFrameFunctionMapper[N]['mapper']>[1];

/**
 * Mapper type for mapping each supported data frame function of {@link DataFrameFunctionMapper} to the parameters required for the respective data frame function mapper.
 * - `critical` contains all function parameters in which case the function call is unsupported and has to be over-approximated by the abstract operation `unknown`
 */
type DataFrameFunctionParamsMapping = {
	[Name in DataFrameFunction]: DataFrameFunctionParams<Name> & { critical?: FunctionParameterLocation<unknown>[] }
}

/**
 * Maps a concrete data frame function call to abstract data frame operations.
 * @param node - The R node of the function call
 * @param dfg  - The data flow graph for resolving the arguments
 * @param ctx  - The current flowR analyzer context
 * @returns The mapped abstract data frame operations for the function call, or `undefined` if the node does not represent a data frame function call
 */
export function mapDataFrameFunctionCall<Name extends DataFrameFunction>(
	node: RNode<ParentInformation>,
	inference: DataFrameShapeInferenceVisitor,
	dfg: DataflowGraph,
	ctx: ReadOnlyFlowrAnalyzerContext
): DataFrameOperations {
	if(node.type !== RType.FunctionCall || !node.named) {
		return;
	}
	const resolveInfo = { graph: dfg, idMap: dfg.idMap, full: true, resolve: VariableResolve.Alias, ctx };

	if(isDataFrameFunction(node.functionName.content)) {
		const functionName = node.functionName.content as Name;
		const mapper = DataFrameFunctionMapper[functionName].mapper as DataFrameFunctionMapping<DataFrameFunctionParams<Name>>;
		const params = DataFrameFunctionParamsMapper[functionName] as DataFrameFunctionParams<Name> & { critical?: FunctionParameterLocation<unknown>[] };
		const args = getFunctionArguments(node, dfg);

		if(hasCriticalArgument(args, params.critical, resolveInfo)) {
			return [{ operation: 'unknown', operand: undefined }];
		} else {
			return mapper(args, params, inference, resolveInfo);
		}
	} else {
		const mapping = getOtherDataFrameFunction(node.functionName.content);

		if(mapping === undefined) {
			return;
		} else if(mapping.type === 'entry_point') {
			return [{ operation: 'unknown', operand: undefined }];
		} else if(mapping.type === 'transformation' || mapping.type === 'modification') {
			const args = getFunctionArguments(node, dfg);
			return mapDataFrameUnknown(args, mapping, inference, resolveInfo);
		} else {
			assertUnreachable(mapping);
		}
	}
}

function isDataFrameFunction(functionName: string): functionName is DataFrameFunction {
	// a check with `functionName in DataFrameFunctionMapper` would return true for "toString"
	return Object.prototype.hasOwnProperty.call(DataFrameFunctionMapper, functionName);
}

function getOtherDataFrameFunction(functionName: string): OtherDataFrameFunctionMapping | undefined {
	return OtherDataFrameFunctions.find(entry => entry.names.includes(functionName as never));
}

function mapDataFrameCreate(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		checkNames: FunctionParameterLocation<boolean>,
		noDupNames: FunctionParameterLocation<boolean>,
		special:    string[]
	},
	inference: DataFrameShapeInferenceVisitor,
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

function mapDataFrameConvert(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation },
	inference: DataFrameShapeInferenceVisitor,
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
	inference: DataFrameShapeInferenceVisitor,
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
		colnames = Array((firstLine as unknown[]).length).fill(undefined);
	}
	return [{
		operation: 'read',
		operand:   undefined,
		source,
		colnames,
		rows:      allLines ? rowCount : [rowCount, Infinity]
	}];
}

function mapDataFrameColBind(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { special: string[] },
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = args.find(arg => isDataFrameArgument(arg, inference));

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
			const otherDataFrame = inference.getAbstractValue(arg.value);

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

function mapDataFrameRowBind(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { special: string[] },
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = args.find(arg => isDataFrameArgument(arg, inference));

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
			const otherDataFrame = inference.getAbstractValue(arg.value);

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

function mapDataFrameHeadTail(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, amount: FunctionParameterLocation<number> },
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, inference)) {
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

function mapDataFrameSubset(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		dataFrame: FunctionParameterLocation,
		subset:    FunctionParameterLocation,
		select:    FunctionParameterLocation,
		drop:      FunctionParameterLocation<boolean>
	},
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, inference)) {
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
			operand = undefined;
		}
	}
	return result;
}

function mapDataFrameFilter(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];

	const filterArgs = args.filter(arg => arg !== dataFrame);
	const filterValues = filterArgs.map(arg => resolveIdToArgValue(arg, info));

	const accessedNames = filterArgs.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info.graph));
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
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	}
	const result: DataFrameOperations = [];
	let operand: RNode<ParentInformation> | undefined = dataFrame.value;

	const selectArgs = args.filter(arg => arg !== dataFrame);

	let { selectedCols, unselectedCols } = getSelectedColumns(selectArgs, info);
	const accessedCols = [...selectedCols ?? [], ...unselectedCols ?? []];

	const mixedAccess = accessedCols.some(col => typeof col === 'string') && accessedCols.some(col => typeof col === 'number');
	const duplicateAccess = accessedCols.some((col, _, list) => col !== undefined && list.filter(other => other === col).length > 1);
	const renamedCols = selectArgs.some(isNamedArgument);

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
		operand = undefined;
	}
	return result;
}

function mapDataFrameMutate(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		dataFrame:   FunctionParameterLocation,
		special:     string[],
		checkNames?: boolean,
		noDupNames?: boolean
	},
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, inference)) {
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
		.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info.graph))
		.filter(arg => !mutatedCols?.includes(arg));

	deletedCols = filterValidNames(deletedCols, params.checkNames, params.noDupNames);
	mutatedCols = filterValidNames(mutatedCols, params.checkNames, params.noDupNames);

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
		operand = undefined;
	}
	return result;
}

function mapDataFrameGroupBy(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		dataFrame: FunctionParameterLocation,
		by:        FunctionParameterLocation,
		special:   string[]
	},
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];
	const byArgs = args.filter(arg => arg !== dataFrame);

	const accessedNames = byArgs.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info.graph));
	const byNames = byArgs.map(arg => isNamedArgument(arg) ? resolveIdToArgName(arg, info) : resolveIdToArgValueSymbolName(arg, info));

	const mutatedCols = byArgs.some(isNamedArgument) || byNames.some(isUndefined);

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

function mapDataFrameSummarize(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: { dataFrame: FunctionParameterLocation, special: string[] },
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	}
	const result: DataFrameOperations = [];
	const summarizeArgs = args.filter(arg => arg !== dataFrame);

	const summarizedCols = summarizeArgs.map(arg => resolveIdToArgName(arg, info));

	// only column names that are not created by summarize are preconditions on the operand
	const accessedNames = summarizeArgs
		.flatMap(arg => getUnresolvedSymbolsInExpression(arg, info.graph))
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

function mapDataFrameJoin(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		dataFrame:      FunctionParameterLocation,
		otherDataFrame: FunctionParameterLocation,
		by:             FunctionParameterLocation,
		joinAll:        FunctionParameterLocation<boolean>,
		joinLeft:       FunctionParameterLocation<boolean>,
		joinRight:      FunctionParameterLocation<boolean>
	},
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);
	const joinAll = getArgumentValue(args, params.joinAll, info);
	const joinLeft = getArgumentValue(args, params.joinLeft, info);
	const joinRight = getArgumentValue(args, params.joinRight, info);

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	} else if(args.length === 1) {
		return [{ operation: 'identity', operand: dataFrame.value.info.id }];
	} else if(typeof joinAll !== 'boolean' || typeof joinLeft !== 'boolean' || typeof joinRight !== 'boolean') {
		return [{ operation: 'unknown', operand: dataFrame.value.info.id }];
	}
	const result: DataFrameOperations = [];

	const otherArg = getFunctionArgument(args, params.otherDataFrame, info);
	const byArg = getFunctionArgument(args, params.by, info);

	const otherDataFrame = inference.getAbstractValue(otherArg) ?? DataFrameDomain.top(info.ctx.config.abstractInterpretation.dataFrame.maxColNames);
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

function mapDataFrameIdentity(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		dataFrame:          FunctionParameterLocation,
		special:            string[],
		disallowNamedArgs?: boolean
	},
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	args = getEffectiveArgs(args, params.special);
	const dataFrame = getFunctionArgument(args, params.dataFrame, info);

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	} else if(params.disallowNamedArgs && args.some(isNamedArgument)) {
		return [{ operation: 'unknown', operand: dataFrame.value.info.id }];
	}
	return [{
		operation: 'identity',
		operand:   dataFrame.value.info.id
	}];
}

function mapDataFrameUnknown(
	args: readonly RFunctionArgument<ParentInformation>[],
	params: {
		dataFrame?:      FunctionParameterLocation,
		constraintType?: Exclude<ConstraintType, ConstraintType.OperandPrecondition>
	},
	inference: DataFrameShapeInferenceVisitor,
	info: ResolveInfo
): DataFrameOperations {
	let dataFrame;

	if(params.dataFrame !== undefined) {
		dataFrame = getFunctionArgument(args, params.dataFrame, info);
	} else {
		dataFrame = args.find(arg => isDataFrameArgument(arg, inference));
	}

	if(!isDataFrameArgument(dataFrame, inference)) {
		return;
	}
	return [{
		operation: 'unknown',
		operand:   dataFrame.value.info.id,
		...(params.constraintType !== undefined ? { type: params.constraintType } : {})
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
			const referenceChain = fileNameArg.info.file ? [fileNameArg.info.file] : [];
			const sources = findSource(info.ctx.config.solver.resolveSource, fileName, { referenceChain, ctx: info.ctx });

			if(sources?.length === 1) {
				source = sources[0];
				// create request from resolved source file path
				request = { request: 'file', content: sources[0] };
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
	request = request ? info.ctx.files.resolveRequest(request).r : undefined;

	return { source, request };
}

function parseRequestContent(
	request: RParseRequest,
	parser: (line: Buffer | string, lineNumber: number) => void,
	maxLines?: number
): boolean {
	const requestType = request.request;

	switch(requestType) {
		case 'text':
			request.content.split('\n').forEach(parser);
			return true;
		case 'file':
			return readLineByLineSync(request.content, parser, maxLines);
		default:
			assertUnreachable(requestType);
	}
}

/**
 * Gets all entries from a line of a CSV file using a custom separator char, quote char, and comment char
 */
function getEntriesFromCsvLine(line: string, sep: string = ',', quote: string = '"', comment: string = '', trim: boolean = true): (string | undefined)[] {
	sep = escapeRegExp(sep, true);  // only allow tokens like `\s`, `\t`, or `\n` in separator, quote, and comment chars
	quote = escapeRegExp(quote, true);
	comment = escapeRegExp(comment, true);
	const quantifier = sep === '\\s' ? '+' : '*';  // do not allow unquoted empty entries in whitespace-sparated files

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
