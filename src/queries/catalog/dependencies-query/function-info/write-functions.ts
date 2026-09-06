import { DependencyInfoLinkConstraint, type DependencyInfoLink, type FunctionInfo } from './function-info';
import { SemanticCallTag } from '../../../../dataflow/environments/built-in-props';
import { functionInfosFromProps } from './derived-functions';
import { OtherPathFunctions } from './other-path-functions';
import { ReadFunctions } from './read-functions';

const OutputRedirects = [
	{ type: 'link-to-last-call', callName: 'sink', attachLinkInfo: { argIdx: 0, argName: 'file', when: DependencyInfoLinkConstraint.IfUnknown, resolveValue: true } }
] as const satisfies DependencyInfoLink[];


const WriteFunctionsWithMore: FunctionInfo[] = [
	{ package: 'base', name: 'save.image',  argIdx: 0, argName: 'file',    resolveValue: true, defaultValue: '.RData' },
	{ package: 'utils', name: 'write.csv',   argIdx: 1, argName: 'file',    resolveValue: true },
	{
		package:        'base',
		name:           'try',
		linkTo:         OutputRedirects,
		argIdx:         2,
		argName:        'outFile',
		resolveValue:   true,
		defaultValue:   'stderr',
		ignoreIf:       'arg-true',
		additionalArgs: {
			val: { argIdx: 1, argName: 'silent' }
		}
	},
	// write functions that don't have argIndex are assumed to write to stdout
	{ package: 'base',  name: 'print',      linkTo: OutputRedirects,                  resolveValue: false },
	{ package: 'base',  name: 'cat',        linkTo: OutputRedirects, argName: 'file', resolveValue: true },
	{ package: 'base',  name: 'message',    linkTo: OutputRedirects,                  resolveValue: false },
	{ package: 'base',  name: 'warning',    linkTo: OutputRedirects,                  resolveValue: false },
	{ package: 'rlang', name: 'warn',       linkTo: OutputRedirects,                  resolveValue: false },
	{ package: 'rlang', name: 'inform',     linkTo: OutputRedirects,                  resolveValue: false },
	{ package: 'cli',  name: 'cli_warn',   linkTo: OutputRedirects,                  resolveValue: false },
	{ package: 'cli',  name: 'cli_abort',  linkTo: OutputRedirects,                  resolveValue: false },
	{ package: 'base', name: 'file', argIdx: 0, argName: 'description', resolveValue: true, ignoreIf: 'mode-only-read', additionalArgs: { mode: { argIdx: 1, argName: 'open', resolveValue: true } } },
	{ package: 'base', name: 'url', argIdx: 0, argName: 'description', resolveValue: true, ignoreIf: 'mode-only-read', additionalArgs: { mode: { argIdx: 1, argName: 'open', resolveValue: true } } },
	{ package: 'grDevices', name: 'jpeg',       argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'grDevices', name: 'png',        argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'grDevices', name: 'windows',    argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'grDevices', name: 'cairo_pdf',  argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'grDevices', name: 'svg',        argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'grDevices', name: 'bmp',        argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'grDevices', name: 'tiff',       argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'grDevices', name: 'X11',        argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'grDevices', name: 'quartz',     argIdx: 0, argName: 'file', resolveValue: true },
	{ package: 'ragg', name: 'agg_png',     argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'ragg', name: 'agg_jpeg',    argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'ragg', name: 'agg_tiff',    argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'ragg', name: 'agg_ppm',     argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'ragg', name: 'agg_webp',    argIdx: 0, argName: 'filename', resolveValue: true },
	{ package: 'LIM', name: 'PrintMat', linkTo: OutputRedirects, resolveValue: true },
	// write_spss/write_stata moved sjmisc -> sjlabelled, so do not pin a namespace (match either); write_sas also lives in haven
	{ name: 'write_spss',  argIdx: 1, argName: 'path', resolveValue: true },
	{ name: 'write_stata', argIdx: 1, argName: 'path', resolveValue: true },
	{ package: 'sf', name: 'write_sf', argIdx: 1, argName: 'dsn', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'DiagrammeR', name: 'export_graph',            argName: 'file_name', resolveValue: true },
	{ package: 'tinyplot', name: 'tinyplot',  argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'tinyplot', name: 'plt',  argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'highcharter', name: 'hc_exporting', argName: 'filename', resolveValue: true },
	{ package: 'rpolars', name: 'sink_ipc', argIdx: 0, argName: 'path', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'sink_csv', argIdx: 0, argName: 'path', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'sink_ndjson', argIdx: 0, argName: 'path', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'sink_parquet', argIdx: 0, argName: 'path', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'lazyframe__lazy_sink_csv', argIdx: 0, argName: 'path', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'write_ipc', argIdx: 0, argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'write_csv', argIdx: 0, argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'write_ndjson', argIdx: 0, argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'rpolars', name: 'write_parquet', argIdx: 0, argName: 'file', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'magick', name: 'image_write', argIdx: 1, argName: 'path', resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'compiler', name: 'cmpfile', argIdx: 1, argName: 'outfile', resolveValue: true },
	/* image / raster */
	{ package: 'jpeg',       name: 'writeJPEG',  argIdx: 1, argName: 'target',    resolveValue: true, ignoreIf: 'arg-missing' },
	{ package: 'png',        name: 'writePNG',   argIdx: 1, argName: 'target',    resolveValue: true, ignoreIf: 'arg-missing' },
	/* audio / video */
	{ package: 'seewave', name: 'savewav',               argName: 'filename', resolveValue: true, defaultValue: '<wave-name>' },
	/* geospatial */
	/* array / binary science formats */
	/* phylogeny / sequence */
] as const;

/* the configuration leads here too, see {@link ReadFunctions} */
export const WriteFunctions: FunctionInfo[] = [
	...functionInfosFromProps([SemanticCallTag.File, SemanticCallTag.Writes], [...WriteFunctionsWithMore, ...OtherPathFunctions, ...ReadFunctions]),
	...WriteFunctionsWithMore
];
