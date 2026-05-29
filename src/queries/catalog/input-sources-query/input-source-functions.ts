import type { Identifier } from '../../../dataflow/environments/identifier';

export const PureFunctions: Identifier[] = [
	'paste', 'paste0', 'parse', '+', '-', '*',
	'/', '^', '%%', '%/%', '&', '|', '!', '&&', '||',
	'<', '>', '<=', '>=', '==', '!=', ':',
	'abs', 'sign', 'sqrt', 'exp', 'log', 'log10', 'log2',
	'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
	'length', 'nchar', 'dim', 'nrow', 'ncol',
	'c', 'list', 'data.frame',
	'ifelse', 'switch', 'factor', 'as.factor',
	'round', 'floor', 'ceiling', 'trunc',
	'substr', 'substring', 'strsplit',
	'min', 'max', 'range', 'sum', 'prod', 'mean', 'median', 'var', 'sd',
	'head', 'tail', 'seq', 'rep',
	'apply', 'lapply', 'sapply', 'vapply', 'tapply',
	'matrix', 'array',
	'rownames', 'colnames',
	'list.files', 'tolower', 'toupper', 'printf',
	'<-', '->', '=', '<<-', '->>', 'assign', 'get',
	'[', '[[', '$', 'length<-', 'dim<-', 'names<-', 'colnames<-', 'rownames<-',
	'as.character', 'as.numeric', 'as.logical',  'as.raw',  'as.list', 'as.data.frame', 'as.matrix', 'as.array',
	'identity', 'invisible', 'return', 'force', 'missing',
	'print', 'cat', 'message', 'warning', 'stop',
	'format', 'sprintf', 'formatC',
	'is.na', 'is.null', 'is.numeric', 'is.character',
	'which', 'match', 'order', 'sort', 'unique', 'duplicated', 'na.omit',
	'grep', 'grepl', 'sub', 'gsub', 'regexpr', 'gregexpr', 'regexec', 'regmatches',
	'as.integer', 'as.double', 'as.complex',
	'trimws', 'seq_len', 'seq_along', 'rep.int',
	'pmin', 'pmax', 'cumsum', 'cumprod', 'cummax', 'cummin', 'diff', 'signif',
	'table', 'prop.table', 'xtabs',
	'rbind', 'cbind', 't', 'crossprod', 'tcrossprod',
	'colSums', 'rowSums', 'colMeans', 'rowMeans',
	'solve', 'det', 'eigen',
	'is.factor', 'is.logical', 'is.vector', 'is.matrix', 'is.data.frame',
];

export const SystemFunctions: Identifier[] = ['system', 'system2', 'pipe', 'shell', 'shell.exec'];

export const FfiFunctions: Identifier[] = ['.C', '.Call', '.Fortran', '.External', 'dyn.load', 'sourceCpp', 'getNativeSymbolInfo'];

export const LangFunctions: Identifier[] = [
	'substitute', 'quote', 'enquote', 'bquote',
	'call', 'as.call', 'expression', 'as.expression', // 'str2lang', 'str2expression',
	'as.name', 'as.symbol', 'alist', 'as.language', 'evalq',
	'expr', 'exprs', 'enexpr', 'enexprs', 'inject',
	'quo', 'quos', 'enquo', 'enquos', 'enquo0', 'enquos0',
	'sym', 'syms', 'ensym', 'ensyms'
];

export const OptionsFunctions: Identifier[] = ['options', 'getOption', 'Sys.getenv'];

export const UserFunctions: Identifier[] = [
	'readline', 'scan', 'askYesNo',
	'file.choose', 'choose.files', 'choose.dir', 'menu', 'select.list', 'winDialogString', 'winDialog',
	'showPrompt', 'askForPassword', 'selectDirectory', 'selectFile',
	'dlgInput', 'dlgOpen',
];
