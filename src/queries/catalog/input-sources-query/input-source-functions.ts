import { Identifier } from '../../../dataflow/environments/identifier';
import type { LinkedInputDeclaration, LinkedInputEntryPoint, LinkedInputObject, NarrowingFunction } from './simple-input-classifier';
import { InputType } from './simple-input-classifier';

/** shiny's ui-side control widgets, all taking the id of the `input` entry they feed as their first argument */
const ShinyInputWidgets: LinkedInputDeclaration = {
	argName: 'inputId',
	argIdx:  0,
	calls:   [
		'actionButton', 'actionLink', 'checkboxInput', 'checkboxGroupInput', 'dateInput', 'dateRangeInput',
		'fileInput', 'numericInput', 'passwordInput', 'radioButtons', 'selectInput', 'selectizeInput',
		'sliderInput', 'submitButton', 'textAreaInput', 'textInput', 'varSelectInput', 'varSelectizeInput'
	].map(n => Identifier.make(n, 'shiny'))
};

/**
 * Objects that a framework binds for its users, without a definition visible in the code.
 * The `withParams` and `requires` guards keep ordinary functions that happen to have a parameter of the same
 * name out of this; where the framework is handed the function, {@link LinkedInputEntryPoints} is exact instead.
 * @see {@link LinkedInputObject}
 */
export const LinkedInputObjects: readonly LinkedInputObject[] = [
	/* shiny hands the server function its reactive `input` and `session` objects */
	{ name: 'input', type: InputType.User, withParams: ['output'], requires: 'shiny', declaredBy: ShinyInputWidgets },
	/* of the session only what the browser sends is user input, `userData` and `token` are the app's own */
	{ name: 'session', type: InputType.User, withParams: ['input', 'output'], requires: 'shiny', fields: ['clientData', 'request'] }
];

export const NarrowingFunctions: readonly NarrowingFunction[] = [
	/* bounded by an argument: the result is one element of that argument */
	{ call: Identifier.make('match.arg', 'base'), argName: 'choices', argIdx: 1 },
	/* bounded content-independent results (counts, indices, logicals): the subject's taint cannot flow through */
	...[
		'nchar', 'length', 'lengths', 'nrow', 'ncol', 'NROW', 'NCOL',
		'which', 'which.max', 'which.min', 'match', 'pmatch', 'charmatch',
		'seq_along', 'seq_len',
		'is.na', 'is.null', 'is.numeric', 'is.character', 'is.logical', 'is.function', 'is.list', 'is.element',
		'nzchar', 'grepl', 'startsWith', 'endsWith'
	].map(name => ({ call: Identifier.make(name, 'base') }))
];

/** shiny binds `input`, `output`, and `session` positionally, so their names are up to whoever writes the server */
const ShinyServerParams = ['input', undefined, 'session'];

/**
 * Calls that hand a function to a framework which binds its parameters by position.
 * @see {@link LinkedInputEntryPoint}
 */
export const LinkedInputEntryPoints: readonly LinkedInputEntryPoint[] = [
	{ call: Identifier.make('shinyApp',     'shiny'), argName: 'server', argIdx: 1, params: ShinyServerParams },
	{ call: Identifier.make('shinyServer',  'shiny'), argName: 'func',   argIdx: 0, params: ShinyServerParams },
	{ call: Identifier.make('moduleServer', 'shiny'), argName: 'module', argIdx: 1, params: ShinyServerParams },
	{ call: Identifier.make('callModule',   'shiny'), argName: 'module', argIdx: 0, params: ShinyServerParams }
];

export const PureFunctions: Identifier[] = [
	/* operators - syntax elements, impossible to call with :: in practice */
	'+', '-', '*', '/', '^', '%%', '%/%',
	'&', '|', '!', '&&', '||',
	'<', '>', '<=', '>=', '==', '!=', ':',
	'<-', '->', '=', '<<-', '->>',
	'[', '[[', '$',
	'length<-', 'dim<-', 'names<-', 'colnames<-', 'rownames<-',
	/* base - string */
	Identifier.make('paste',      'base'),
	Identifier.make('paste0',     'base'),
	Identifier.make('substr',     'base'),
	Identifier.make('substring',  'base'),
	Identifier.make('strsplit',   'base'),
	Identifier.make('strrep',     'base'),
	Identifier.make('chartr',     'base'),
	Identifier.make('strtoi',     'base'),
	Identifier.make('tolower',    'base'),
	Identifier.make('toupper',    'base'),
	Identifier.make('trimws',     'base'),
	Identifier.make('grep',       'base'),
	Identifier.make('sub',        'base'),
	Identifier.make('gsub',       'base'),
	Identifier.make('regexpr',    'base'),
	Identifier.make('gregexpr',   'base'),
	Identifier.make('regexec',    'base'),
	// regmatches yields a substring of x, so x's taint propagates soundly - kept pure deliberately
	Identifier.make('regmatches', 'base'),
	Identifier.make('format',     'base'),
	Identifier.make('sprintf',    'base'),
	Identifier.make('formatC',    'base'),
	/* base - math */
	Identifier.make('abs',        'base'),
	Identifier.make('sign',       'base'),
	Identifier.make('sqrt',       'base'),
	Identifier.make('exp',        'base'),
	Identifier.make('log',        'base'),
	Identifier.make('log10',      'base'),
	Identifier.make('log2',       'base'),
	Identifier.make('sin',        'base'),
	Identifier.make('cos',        'base'),
	Identifier.make('tan',        'base'),
	Identifier.make('atan2',      'base'),
	Identifier.make('asin',       'base'),
	Identifier.make('acos',       'base'),
	Identifier.make('atan',       'base'),
	Identifier.make('sinh',       'base'),
	Identifier.make('cosh',       'base'),
	Identifier.make('tanh',       'base'),
	Identifier.make('asinh',      'base'),
	Identifier.make('acosh',      'base'),
	Identifier.make('atanh',      'base'),
	Identifier.make('round',      'base'),
	Identifier.make('floor',      'base'),
	Identifier.make('ceiling',    'base'),
	Identifier.make('trunc',      'base'),
	Identifier.make('signif',     'base'),
	Identifier.make('Re',         'base'),
	Identifier.make('Im',         'base'),
	Identifier.make('Mod',        'base'),
	Identifier.make('Arg',        'base'),
	Identifier.make('Conj',       'base'),
	Identifier.make('bitwNot',    'base'),
	Identifier.make('bitwAnd',    'base'),
	Identifier.make('bitwOr',     'base'),
	Identifier.make('bitwXor',    'base'),
	Identifier.make('bitwShiftL', 'base'),
	Identifier.make('bitwShiftR', 'base'),
	Identifier.make('xor',        'base'),
	/* base - summary / sequence */
	Identifier.make('min',        'base'),
	Identifier.make('max',        'base'),
	Identifier.make('range',      'base'),
	Identifier.make('sum',        'base'),
	Identifier.make('prod',       'base'),
	Identifier.make('mean',       'base'),
	Identifier.make('cumsum',     'base'),
	Identifier.make('cumprod',    'base'),
	Identifier.make('cummax',     'base'),
	Identifier.make('cummin',     'base'),
	Identifier.make('diff',       'base'),
	Identifier.make('pmin',       'base'),
	Identifier.make('pmax',       'base'),
	Identifier.make('order',      'base'),
	Identifier.make('sort',       'base'),
	Identifier.make('unique',     'base'),
	Identifier.make('duplicated', 'base'),
	Identifier.make('seq',        'base'),
	Identifier.make('rep',        'base'),
	Identifier.make('rep.int',    'base'),
	/* base - data structures */
	Identifier.make('c',          'base'),
	Identifier.make('list',       'base'),
	Identifier.make('data.frame', 'base'),
	Identifier.make('matrix',     'base'),
	Identifier.make('array',      'base'),
	Identifier.make('rbind',      'base'),
	Identifier.make('cbind',      'base'),
	Identifier.make('t',          'base'),
	Identifier.make('crossprod',  'base'),
	Identifier.make('tcrossprod', 'base'),
	Identifier.make('append',     'base'),
	Identifier.make('rev',        'base'),
	Identifier.make('setdiff',    'base'),
	Identifier.make('union',      'base'),
	Identifier.make('intersect',  'base'),
	Identifier.make('table',      'base'),
	Identifier.make('prop.table', 'base'),
	Identifier.make('rownames',   'base'),
	Identifier.make('colnames',   'base'),
	Identifier.make('dim',        'base'),
	Identifier.make('colSums',    'base'),
	Identifier.make('rowSums',    'base'),
	Identifier.make('colMeans',   'base'),
	Identifier.make('rowMeans',   'base'),
	/* base - linear algebra */
	Identifier.make('solve', 'base'),
	Identifier.make('det',   'base'),
	Identifier.make('eigen', 'base'),
	/* base - control flow / functional */
	Identifier.make('ifelse',   'base'),
	Identifier.make('switch',   'base'),
	Identifier.make('do.call',  'base'),
	Identifier.make('Reduce',   'base'),
	Identifier.make('Filter',   'base'),
	Identifier.make('Map',      'base'),
	Identifier.make('Find',     'base'),
	Identifier.make('Position', 'base'),
	Identifier.make('Negate',   'base'),
	Identifier.make('apply',    'base'),
	Identifier.make('lapply',   'base'),
	Identifier.make('sapply',   'base'),
	Identifier.make('vapply',   'base'),
	Identifier.make('tapply',   'base'),
	Identifier.make('mapply',   'base'),
	Identifier.make('rapply',   'base'),
	/* base - type coercion & construction */
	Identifier.make('factor',         'base'),
	Identifier.make('as.factor',      'base'),
	Identifier.make('as.character',   'base'),
	Identifier.make('as.numeric',     'base'),
	Identifier.make('as.logical',     'base'),
	Identifier.make('as.raw',         'base'),
	Identifier.make('as.list',        'base'),
	Identifier.make('as.data.frame',  'base'),
	Identifier.make('as.matrix',      'base'),
	Identifier.make('as.array',       'base'),
	Identifier.make('as.integer',     'base'),
	Identifier.make('as.double',      'base'),
	Identifier.make('as.complex',     'base'),
	Identifier.make('numeric',        'base'),
	Identifier.make('character',      'base'),
	Identifier.make('logical',        'base'),
	Identifier.make('integer',        'base'),
	Identifier.make('double',         'base'),
	Identifier.make('raw',            'base'),
	Identifier.make('complex',        'base'),
	/* base - type predicates */
	Identifier.make('is.finite',      'base'),
	Identifier.make('is.infinite',    'base'),
	Identifier.make('is.nan',         'base'),
	Identifier.make('is.factor',      'base'),
	Identifier.make('is.vector',      'base'),
	Identifier.make('is.matrix',      'base'),
	Identifier.make('is.data.frame',  'base'),
	/* base - environment / identity / flow */
	Identifier.make('assign',     'base'),
	Identifier.make('get',        'base'),
	Identifier.make('identity',   'base'),
	Identifier.make('invisible',  'base'),
	Identifier.make('return',     'base'),
	Identifier.make('force',      'base'),
	Identifier.make('missing',    'base'),
	Identifier.make('print',      'base'),
	Identifier.make('cat',        'base'),
	Identifier.make('message',    'base'),
	Identifier.make('warning',    'base'),
	Identifier.make('stop',       'base'),
	Identifier.make('parse',      'base'),
	Identifier.make('list.files', 'base'),
	/* utils */
	Identifier.make('head', 'utils'),
	Identifier.make('tail', 'utils'),
	/* stats - deterministic given their inputs */
	Identifier.make('var',      'stats'),
	Identifier.make('sd',       'stats'),
	Identifier.make('median',   'stats'),
	Identifier.make('quantile', 'stats'),
	Identifier.make('cor',      'stats'),
	Identifier.make('cov',      'stats'),
	Identifier.make('na.omit',  'stats'),
	Identifier.make('xtabs',    'stats'),
	/* shiny - wrappers that hand their expression on; the reactives among them do so through a call (`r()`).
	   `observe`/`observeEvent`/`render*` are left out on purpose: they return an observer or render handle,
	   not the value of their expression. */
	Identifier.make('reactive',             'shiny'),
	Identifier.make('eventReactive',        'shiny'),
	Identifier.make('bindEvent',            'shiny'),
	Identifier.make('bindCache',            'shiny'),
	Identifier.make('isolate',              'shiny'),
	Identifier.make('req',                  'shiny'),
	Identifier.make('debounce',             'shiny'),
	Identifier.make('throttle',             'shiny'),
	Identifier.make('reactiveVal',          'shiny'),
	Identifier.make('reactiveValues',       'shiny'),
	Identifier.make('reactiveValuesToList', 'shiny'),
	Identifier.make('freezeReactiveVal',    'shiny'),
	/* cohortBuilder - assembling a cohort keeps the data of its source */
	Identifier.make('cohort',        'cohortBuilder'),
	Identifier.make('set_source',    'cohortBuilder'),
	Identifier.make('add_source',    'cohortBuilder'),
	Identifier.make('update_source', 'cohortBuilder'),
	Identifier.make('add_filter',    'cohortBuilder'),
	Identifier.make('update_filter', 'cohortBuilder'),
	Identifier.make('rm_filter',     'cohortBuilder'),
	Identifier.make('bind_key',      'cohortBuilder'),
	Identifier.make('bind_keys',     'cohortBuilder'),
	Identifier.make('as.tblist',     'cohortBuilder'),
	Identifier.make('tblist',        'cohortBuilder'),
	/* generic names, only matched bare while cohortBuilder is attached */
	Identifier.make('filter',        'cohortBuilder'),
	Identifier.make('step',          'cohortBuilder'),
	Identifier.make('add_step',      'cohortBuilder'),
	Identifier.make('rm_step',       'cohortBuilder'),
	Identifier.make('run',           'cohortBuilder'),
	Identifier.make('restore',       'cohortBuilder'),
];

export const SystemFunctions: Identifier[] = [
	/* base */
	Identifier.make('system',     'base'),
	Identifier.make('system2',    'base'),
	Identifier.make('pipe',       'base'),
	Identifier.make('shell',      'base'),
	Identifier.make('shell.exec', 'base'),
	/* shinyjs - executes arbitrary JavaScript in the Shiny browser session */
	Identifier.make('runjs', 'shinyjs'),
];

export const FfiFunctions: Identifier[] = [
	/* base */
	Identifier.make('.C',                  'base'),
	Identifier.make('.Call',               'base'),
	Identifier.make('.Fortran',            'base'),
	Identifier.make('.External',           'base'),
	Identifier.make('dyn.load',            'base'),
	Identifier.make('getNativeSymbolInfo', 'base'),
	/* Rcpp */
	Identifier.make('sourceCpp', 'Rcpp'),
];

export const LangFunctions: Identifier[] = [
	/* base - quoting / AST construction */
	Identifier.make('substitute',    'base'),
	Identifier.make('quote',         'base'),
	Identifier.make('enquote',       'base'),
	Identifier.make('bquote',        'base'),
	Identifier.make('call',          'base'),
	Identifier.make('as.call',       'base'),
	Identifier.make('expression',    'base'),
	Identifier.make('as.expression', 'base'),
	// 'str2lang', 'str2expression' - excluded: evaluated as strings, not AST
	Identifier.make('as.name',       'base'),
	Identifier.make('as.symbol',     'base'),
	Identifier.make('alist',         'base'),
	Identifier.make('as.language',   'base'),
	Identifier.make('evalq',         'base'),
	/* base - call / function introspection */
	Identifier.make('match.call',   'base'),
	Identifier.make('sys.call',     'base'),
	Identifier.make('sys.function', 'base'),
	Identifier.make('body',         'base'),
	Identifier.make('formals',      'base'),
	Identifier.make('args',         'base'),
	Identifier.make('deparse',      'base'),
	Identifier.make('deparse1',     'base'),
	/* rlang - tidy evaluation */
	Identifier.make('expr',          'rlang'),
	Identifier.make('exprs',         'rlang'),
	Identifier.make('enexpr',        'rlang'),
	Identifier.make('enexprs',       'rlang'),
	Identifier.make('inject',        'rlang'),
	Identifier.make('quo',           'rlang'),
	Identifier.make('quos',          'rlang'),
	Identifier.make('enquo',         'rlang'),
	Identifier.make('enquos',        'rlang'),
	Identifier.make('enquo0',        'rlang'),
	Identifier.make('enquos0',       'rlang'),
	Identifier.make('sym',           'rlang'),
	Identifier.make('syms',          'rlang'),
	Identifier.make('ensym',         'rlang'),
	Identifier.make('ensyms',        'rlang'),
	Identifier.make('new_formula',   'rlang'),
	Identifier.make('f_rhs',         'rlang'),
	Identifier.make('f_lhs',         'rlang'),
	Identifier.make('fn_body',       'rlang'),
	Identifier.make('fn_fmls',       'rlang'),
	Identifier.make('fn_fmls_names', 'rlang'),
];

export const OptionsFunctions: Identifier[] = [
	/* base */
	Identifier.make('options',     'base'),
	Identifier.make('getOption',   'base'),
	Identifier.make('Sys.getenv',  'base'),
	Identifier.make('Sys.info',    'base'),
	Identifier.make('Sys.getpid',  'base'),
	Identifier.make('getwd',       'base'),
	Identifier.make('getRversion', 'base'),
	Identifier.make('R.Version',   'base'),
];

export const UserFunctions: Identifier[] = [
	/* base */
	Identifier.make('readline',    'base'),
	Identifier.make('scan',        'base'),
	Identifier.make('file.choose', 'base'),
	/* utils */
	Identifier.make('askYesNo',        'utils'),
	Identifier.make('choose.files',    'utils'),
	Identifier.make('choose.dir',      'utils'),
	Identifier.make('menu',            'utils'),
	Identifier.make('select.list',     'utils'),
	Identifier.make('winDialogString', 'utils'),
	Identifier.make('winDialog',       'utils'),
	/* rstudioapi */
	Identifier.make('showPrompt',      'rstudioapi'),
	Identifier.make('askForPassword',  'rstudioapi'),
	Identifier.make('selectDirectory', 'rstudioapi'),
	Identifier.make('selectFile',      'rstudioapi'),
	Identifier.make('showQuestion',    'rstudioapi'),
	/* svDialogs */
	Identifier.make('dlgInput', 'svDialogs'),
	Identifier.make('dlgOpen',  'svDialogs'),
	Identifier.make('dlgList',  'svDialogs'),
	Identifier.make('dlgSave',  'svDialogs'),
	Identifier.make('dlgDir',   'svDialogs'),
	/* tcltk */
	Identifier.make('tk_choose.files', 'tcltk'),
	Identifier.make('tk_choose.dir',   'tcltk'),
	/* shiny - everything the browser sends along with a request */
	Identifier.make('parseQueryString', 'shiny'),
	Identifier.make('getQueryString',   'shiny'),
	Identifier.make('getUrlHash',       'shiny'),
	Identifier.make('restoreInput',     'shiny'),
	/* shinyFiles - paths the user picks in the browser */
	Identifier.make('parseFilePaths',   'shinyFiles'),
	Identifier.make('parseDirPath',     'shinyFiles'),
	Identifier.make('parseSavePath',    'shinyFiles'),
	Identifier.make('shinyFileChoose',  'shinyFiles'),
	Identifier.make('shinyDirChoose',   'shinyFiles'),
	Identifier.make('shinyFileSave',    'shinyFiles'),
	/* cohortBuilder - the data that comes out of a cohort depends on the filters the user set */
	Identifier.make('get_data',  'cohortBuilder'),
	Identifier.make('sum_up',    'cohortBuilder'),
	Identifier.make('attrition', 'cohortBuilder'),
	Identifier.make('get_state', 'cohortBuilder'),
	Identifier.make('code',      'cohortBuilder'),
	Identifier.make('stat',      'cohortBuilder'),
	/* shinyCohortBuilder - the gui that lets the user set those filters */
	Identifier.make('cb_server',      'shinyCohortBuilder'),
	Identifier.make('cb_ui',          'shinyCohortBuilder'),
	Identifier.make('cb_chat_server', 'shinyCohortBuilder'),
	Identifier.make('cb_chat_ui',     'shinyCohortBuilder'),
	Identifier.make('gui',            'shinyCohortBuilder'),
	Identifier.make('demo_app',       'shinyCohortBuilder'),
];

/** R functions that produce temporary file/directory paths (sub-type of {@link InputType.File}). */
export const TempFileFunctions: Identifier[] = [
	Identifier.make('tempfile', 'base'),        Identifier.make('tempdir',        'base'),
	Identifier.make('file_temp', 'fs'),         Identifier.make('dir_temp',        'fs'),
	Identifier.make('local_tempfile', 'withr'), Identifier.make('with_tempfile', 'withr'),
	Identifier.make('local_tempdir',  'withr'), Identifier.make('with_tempdir',  'withr'),
];
