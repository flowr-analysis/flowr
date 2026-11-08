import { DependencyInfoLinkConstraint, type DependencyInfoLink, type FunctionInfo } from './function-info';
import { StdErr } from '../dependency-values';
import { SemanticCallTag } from '../../../../dataflow/environments/built-in-props';
import { functionInfosFromProps, readingAndWritingApart } from './derived-functions';
import { OtherPathFunctions } from './other-path-functions';
import { LinkToLastGgPlot } from '../../../../dataflow/environments/default-builtin-config';
import { computeReadFunctions } from './read-functions';
import type { BuiltInDefinitions } from '../../../../dataflow/environments/built-in-config';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../project/context/flowr-analyzer-context';
import type { ReadOnlyFlowrAnalyzerEnvironmentContext } from '../../../../project/context/flowr-analyzer-environment-context';

const OutputRedirects = [
	{ type: 'link-to-last-call', callName: 'sink', attachLinkInfo: { argIdx: 0, argName: 'file', when: DependencyInfoLinkConstraint.IfUnknown, resolveValue: true } }
] as const satisfies DependencyInfoLink[];

const WriteFunctionsWithMore: FunctionInfo[] = [
	{ package: 'base', name: 'save.image',  argIdx: 0, argName: 'file',    resolveValue: true, defaultValue: '.RData' },
	{ package: 'utils', name: 'write.csv',   argIdx: 1, argName: 'file',    resolveValue: true },
	/* the write happens in the `GET` it configures, which the dataflow cannot tell, so only this category knows it */
	{ package: 'httr', name: 'write_disk',  argIdx: 0, argName: 'path',    resolveValue: true },
	/* without a `plot`, it saves `last_plot()` */
	{ package: 'ggplot2', name: 'ggsave',  argIdx: 0, argName: 'filename', resolveValue: true, linkTo: [LinkToLastGgPlot] },
	{
		package:        'base',
		name:           'try',
		linkTo:         OutputRedirects,
		argIdx:         2,
		argName:        'outFile',
		resolveValue:   true,
		defaultValue:   StdErr,
		ignoreIf:       'arg-true',
		additionalArgs: {
			val: { argIdx: 1, argName: 'silent' }
		}
	},
	// write functions that don't have argIndex are assumed to write to stdout
	/* a print method may write to a file instead, like `print(xtable(d), file = "t.tex")` */
	{ package: 'base',  name: 'print',      linkTo: OutputRedirects, argName: 'file', resolveValue: true },
	{ package: 'graphics', name: 'stem',   linkTo: OutputRedirects,                  resolveValue: false },
	{ package: 'base',  name: 'cat',        linkTo: OutputRedirects, argName: 'file', resolveValue: true },
	/* conditions and messages go to the message stream, which is stderr */
	{ package: 'base',  name: 'message',    linkTo: OutputRedirects, resolveValue: false, defaultValue: StdErr },
	{ package: 'base',  name: 'warning',    linkTo: OutputRedirects, resolveValue: false, defaultValue: StdErr },
	{ package: 'rlang', name: 'warn',       linkTo: OutputRedirects, resolveValue: false, defaultValue: StdErr },
	{ package: 'rlang', name: 'inform',     linkTo: OutputRedirects, resolveValue: false, defaultValue: StdErr },
	{ package: 'cli',  name: 'cli_warn',   linkTo: OutputRedirects, resolveValue: false, defaultValue: StdErr },
	{ package: 'cli',  name: 'cli_abort',  linkTo: OutputRedirects, resolveValue: false, defaultValue: StdErr },
	/* `output = "default"` shows the table where R prints */
	{ package: 'modelsummary', name: 'modelsummary', argIdx: 1, argName: 'output', resolveValue: true, stringReplacements: { default: 'stdout' } },
	{ package: 'modelsummary', name: 'msummary',     argIdx: 1, argName: 'output', resolveValue: true, stringReplacements: { default: 'stdout' } },
	{ package: 'modelsummary', name: 'datasummary',  argIdx: 2, argName: 'output', resolveValue: true, stringReplacements: { default: 'stdout' } },
	{ package: 'base',  name: 'file.create',   argIdx: 'unnamed',             resolveValue: true },
	{ package: 'base',  name: 'file.copy',     argIdx: 1, argName: 'to',      resolveValue: true },
	{ package: 'base',  name: 'file.rename',   argIdx: 1, argName: 'to',      resolveValue: true },
	{ package: 'base',  name: 'file.append',   argIdx: 0, argName: 'file1',   resolveValue: true },
	{ package: 'base',  name: 'file.symlink',  argIdx: 1, argName: 'to',      resolveValue: true },
	{ package: 'base',  name: 'file.link',     argIdx: 1, argName: 'to',      resolveValue: true },
	{ package: 'utils', name: 'download.file', argIdx: 1, argName: 'destfile', resolveValue: true },
	/* an archive unpacks into the working directory unless told otherwise */
	{ package: 'utils',   name: 'unzip',           argIdx: 5, argName: 'exdir', resolveValue: true, defaultValue: '.', invisible: true },
	{ package: 'utils',   name: 'untar',           argIdx: 3, argName: 'exdir', resolveValue: true, defaultValue: '.', invisible: true },
	{ package: 'zip',     name: 'unzip',           argIdx: 4, argName: 'exdir', resolveValue: true, defaultValue: '.', invisible: true },
	{ package: 'archive', name: 'archive_extract', argIdx: 1, argName: 'dir',   resolveValue: true, defaultValue: '.', invisible: true },
	/* the name the file has with the extension added or dropped, `Unknown` of the query format, which imports this module */
	...['gzip', 'gunzip', 'bzip2', 'bunzip2', 'compressFile', 'decompressFile'].map(name => ({ package: 'R.utils', name, argIdx: 1, argName: 'destname', resolveValue: true, defaultValue: 'unknown', invisible: true } as const)),
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
] as const;

/** The write entries the given built-in definitions imply, together with the ones written down here. */
export function computeWriteFunctions(definitions: BuiltInDefinitions, read: FunctionInfo[] = computeReadFunctions(definitions)): FunctionInfo[] {
	const apart = readingAndWritingApart(read, definitions);
	return [
		...functionInfosFromProps([SemanticCallTag.File, SemanticCallTag.Writes], [...WriteFunctionsWithMore, ...OtherPathFunctions, ...read.filter(f => !apart.has(f))], definitions),
		...WriteFunctionsWithMore
	];
}

/** {@link computeWriteFunctions} for the built-ins `env` registered, reusing the read entries it already derived. */
export function writeFunctionsOf(env: ReadOnlyFlowrAnalyzerEnvironmentContext): FunctionInfo[] {
	return computeWriteFunctions(env.builtInDefinitions, env.deriveFromDefinitions(computeReadFunctions));
}

/** {@link computeWriteFunctions} for the built-ins an analyzer registered, shared per built-in index. */
export const writeFunctions = (ctx: ReadOnlyFlowrAnalyzerContext): FunctionInfo[] => ctx.env.derive(writeFunctionsOf);
