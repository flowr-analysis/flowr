import type { FunctionInfo } from './function-info';
import { SemanticCallTag } from '../../../../dataflow/environments/built-in-props';
import { functionInfosFromProps } from './derived-functions';
import { OtherPathFunctions } from './other-path-functions';
import { SourceFunctions } from './source-functions';

const ReadFunctionsWithMore: FunctionInfo[] = [
	{ package: 'base', name: 'parse',                          argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'utils', name: 'read.table',         argIdx: 0, argName: 'file', resolveValue: true, ignoreIf: 'arg-set', additionalArgs: { argSet: { argName: 'text' } } },
	{ package: 'utils', name: 'read.csv',           argIdx: 0, argName: 'file', resolveValue: true, ignoreIf: 'arg-set', additionalArgs: { argSet: { argName: 'text' } } },
	{ package: 'utils', name: 'read.csv2',          argIdx: 0, argName: 'file', resolveValue: true, ignoreIf: 'arg-set', additionalArgs: { argSet: { argName: 'text' } } },
	{ package: 'utils', name: 'read.delim',         argIdx: 0, argName: 'file', resolveValue: true, ignoreIf: 'arg-set', additionalArgs: { argSet: { argName: 'text' } } },
	{ package: 'utils', name: 'read.delim2',        argIdx: 0, argName: 'file', resolveValue: true, ignoreIf: 'arg-set', additionalArgs: { argSet: { argName: 'text' } } },
	{ package: 'base', name: 'file',                argIdx: 0, argName: 'description', resolveValue: true, ignoreIf: 'mode-only-write', additionalArgs: { mode: { argIdx: 1, argName: 'open', resolveValue: true } } },
	{ package: 'base', name: 'url',                 argIdx: 0, argName: 'description', resolveValue: true, ignoreIf: 'mode-only-write', additionalArgs: { mode: { argIdx: 1, argName: 'open', resolveValue: true } } },
	{ package: 'base', name: 'gzfile',              argIdx: 0, argName: 'description', resolveValue: true, ignoreIf: 'mode-only-write', additionalArgs: { mode: { argIdx: 1, argName: 'open', resolveValue: true } } },
	{ package: 'base', name: 'bzfile',              argIdx: 0, argName: 'description', resolveValue: true, ignoreIf: 'mode-only-write', additionalArgs: { mode: { argIdx: 1, argName: 'open', resolveValue: true } } },
	{ package: 'utils', name: 'download.file',       argIdx: 0, argName: 'url',  resolveValue: true },
	{ package: 'base', name: 'pipe',                argIdx: 0, argName: 'description', resolveValue: true, ignoreIf: 'mode-only-write', additionalArgs: { mode: { argIdx: 1, argName: 'open', resolveValue: true } } },
	{ package: 'base', name: 'fifo',                argIdx: 0, argName: 'description', resolveValue: true, ignoreIf: 'mode-only-write', additionalArgs: { mode: { argIdx: 1, argName: 'open', resolveValue: true } } },
	{ package: 'base', name: 'unz',                 argIdx: 0, argName: 'description', resolveValue: true, ignoreIf: 'mode-only-write', additionalArgs: { mode: { argIdx: 1, argName: 'open', resolveValue: true } } },
	{ package: 'base', name: 'matrix',              argIdx: 0, argName: 'data', resolveValue: true },
	{ package: 'utils', name: 'data',               argIdx: 0, resolveValue: 'library', ignoreIf: 'arg-missing' },
	{ package: 'readr', name: 'clipboard'                                                          },
	{ package: 'sourcetools', name: 'tokenize',                    argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'ape', name: 'read.tree', argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'highcharter', name: 'download_map_data', argIdx: 0, argName: 'url', resolveValue: true, defaultValue: 'custom/world.js' },
	{ name: 'read_html',                       argIdx: 0, argName: 'x',   resolveValue: true },
	{ package: 'rvest', name: 'read_html_live', argIdx: 0, argName: 'url', resolveValue: true },
	{ package: 'DBI', name: 'dbReadTable',      argIdx: 1, argName: 'name', resolveValue: true },
	{ package: 'DBI', name: 'dbReadTableArrow', argIdx: 1, argName: 'name', resolveValue: true },
	{ package: 'rpolars', name: 'pl_read_ipc', argIdx: 0, argName: 'source', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'pl_read_csv', argIdx: 0, argName: 'source', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'pl_read_ndjson', argIdx: 0, argName: 'source', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'pl_read_parquet', argIdx: 0, argName: 'source', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'pl_scan_csv', argIdx: 0, argName: 'source', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'pl_scan_ipc', argIdx: 0, argName: 'source', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'pl_scan_ndjson', argIdx: 0, argName: 'source', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'pl_scan_parquet', argIdx: 0, argName: 'source', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'compiler', name: 'loadcmp', argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'compiler', name: 'cmpfile', argIdx: 0, argName: 'infile', resolveValue: true },
	{ package: 'yaml',     name: 'read_yaml', argIdx: 0, argName: 'file',     resolveValue: true, ignoreIf: 'arg-set', additionalArgs: { argSet: { argName: 'text' } } },
	{ package: 'shinyjs', name: 'extendShinyjs', argIdx: 0, argName: 'script', resolveValue: true, ignoreIf: 'arg-missing' }
] as const;

/* the built-in configuration leads: it is where flowR states what a call does, and the entries below are the
   exceptions that need more than a resource argument. For a call naming no package the first entry able to
   apply answers, so a name several packages export is read the way the configuration states it.
   `source` reads a file too, but it is the `sourced` category that reports it, so it stays out of this one */
export const ReadFunctions: FunctionInfo[] = [
	...functionInfosFromProps([SemanticCallTag.File, SemanticCallTag.Reads], [...ReadFunctionsWithMore, ...OtherPathFunctions, ...SourceFunctions]),
	...ReadFunctionsWithMore
];
