import type { OptionDefinition } from 'command-line-usage';
import os from 'os';
import { date2string } from '../../util/text/time';

/**
 * This interface describes options, that every script *must* provide.
 */
export interface CommonOptions {
	/** Enables the most verbose logging option available. */
	verbose: boolean
	/**
	 * Shows the respective help including usage examples,
	 * see {@link processCommandLineArgs} or {@link helpForOptions} for more information.
	 */
	help:    boolean
}

/**
 * This string contains a string representation of the time this module was loaded.
 */
const StartTimeString = date2string(new Date());

export const benchmarkOptions = [
	{ name: 'verbose',       alias: 'v', type: Boolean, description: 'Run with verbose logging [do not use for the real benchmark as this affects the time measurements, but only to find errors]' },
	{ name: 'help',          alias: 'h', type: Boolean, description: 'Print this usage guide' },
	{ name: 'limit',         alias: 'l', type: Number,  description: 'Limit the number of files to process (if given, this will choose these files randomly and add the chosen names to the output' },
	{ name: 'runs',          alias: 'r', type: Number,  description: 'The amount of benchmark runs that should be done, out of which an average will be calculated' },
	{ name: 'seed',                      type: String,  description: 'The random seed for sampling the files if a limit is set, and for sampling the slicing criteria if a maximum is set' },
	{ name: 'input',         alias: 'i', type: String,  description: 'Pass a folder or file as src to read from. Alternatively, pass a single JSON file that contains a list of paths.', multiple: true, defaultOption: true, defaultValue: [], typeLabel: '{underline files/folders}' },
	{ name: 'parallel',      alias: 'p', type: String,  description: 'Number of parallel executors (defaults to {italic max(cpu.count-1, 1)})', defaultValue: Math.max(os.cpus().length - 1, 1), typeLabel: '{underline number}' },
	{ name: 'slice',         alias: 's', type: String,  description: 'Automatically slice for *all* variables (default) or *no* slicing and only parsing/dataflow construction. Numbers will indicate: sample X random slices from all.', defaultValue: 'all', typeLabel: '{underline all/no}' },
	{ name: 'output',        alias: 'o', type: String,  description: `Folder to write all the measurements to in a per-file-basis (defaults to {italic benchmark-${StartTimeString}})`, defaultValue: `benchmark-${StartTimeString}`,  typeLabel: '{underline folder}' },
	{ name: 'parser',                    type: String,  description: 'The parser to use for the benchmark', defaultValue: 'r-shell', typeLabel: '{underline parser}' },
	{ name: 'dataframe-shape-inference', type: Boolean, description: 'Infer the shape of data frames using abstract interpretation (includes control flow graph extraction)', defaultValue: false },
	{ name: 'max-file-slices',           type: Number,  description: 'If file has more than passed number of slices, the file is not processed', defaultValue: -1, typeLabel: '{underline number}' },
	{ name: 'threshold',     alias: 't', type: Number,  description: 'How many re-visits of the same node are ok?', defaultValue: undefined, typeLabel: '{underline number}' },
	{ name: 'per-file-time-limit',       type: Number,  description: 'Time limit in milliseconds to process single file (disabled by default)', defaultValue: undefined, typeLabel: '{underline number}' },
	{ name: 'sampling-strategy',         type: String,  description: 'Which strategy to use, when sampling is enabled', defaultValue: 'random', typeLabel: '{underline random/equidistant}' },
	{ name: 'cfg',           alias: 'c', type: Boolean, description: 'Extract the control flow graph of the file (benchmark it too)' },
	{ name: 'cg',                        type: Boolean, description: 'Extract the call graph of the file (benchmark it too)' }
] as const satisfies OptionDefinition[];

export const benchmarkHelperOptions = [
	{ name: 'verbose',       alias: 'v', type: Boolean, description: 'Run with verbose logging [do not use for the real benchmark as this affects the time measurements, but only to find errors]' },
	{ name: 'help',          alias: 'h', type: Boolean, description: 'Print this usage guide' },
	{ name: 'input',         alias: 'i', type: String,  description: 'Pass a single file as src to read from', multiple: false, defaultOption: true, typeLabel: '{underline file}' },
	{ name: 'file-id',       alias: 'd', type: Number,  description: 'A numeric file id that can be used to match an input and run-num to a file' },
	{ name: 'run-num',       alias: 'r', type: Number,  description: 'The n-th time that the file with the given file-id is being benchmarked' },
	{ name: 'slice',         alias: 's', type: String,  description: 'Automatically slice for *all* variables (default) or *no* slicing and only parsing/dataflow construction. Numbers will indicate: sample X random slices from all.', defaultValue: 'all', typeLabel: '{underline all/no}' },
	{ name: 'cfg',           alias: 'c', type: Boolean, description: 'Extract the control flow graph of the file (benchmark it too)' },
	{ name: 'cg',                        type: Boolean, description: 'Extract the call graph of the file (benchmark it too)' },
	{ name: 'output',        alias: 'o', type: String,  description: 'File to write the measurements to (appends a single line in JSON format)',  typeLabel: '{underline file}' },
	{ name: 'parser',                    type: String,  description: 'The parser to use for the benchmark', defaultValue: 'r-shell', typeLabel: '{underline parser}' },
	{ name: 'dataframe-shape-inference', type: Boolean, description: 'Infer the shape of data frames using abstract interpretation (includes control flow graph extraction)', defaultValue: false },
	{ name: 'max-slices',                type: Number,  description: 'If file has more than passed number of slices, the file is not processed', defaultValue: -1, typeLabel: '{underline number}' },
	{ name: 'threshold',     alias: 't', type: Number,  description: 'How many re-visits of the same node are ok?', defaultValue: undefined, typeLabel: '{underline number}' },
	{ name: 'sampling-strategy',         type: String,  description: 'Which strategy to use, when sampling is enabled', defaultValue: 'random', typeLabel: '{underline random/equidistant}' },
	{ name: 'seed',                      type: String,  description: 'The random seed for sampling the slicing criteria if a maximum is set' },
] as const satisfies OptionDefinition[];

export const exportQuadsOptions = [
	{ name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging' },
	{ name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide' },
	{ name: 'input',        alias: 'i', type: String,  description: 'Pass a folder or file as src to read from', multiple: true, defaultOption: true, defaultValue: [], typeLabel: '{underline files/folders}' },
	{ name: 'limit',        alias: 'l', type: Number,  description: 'Limit the number of files to process' },
	{ name: 'output',       alias: 'o', type: String,  description: 'File to write all the generated quads to (defaults to {italic out.quads})', typeLabel: '{underline file}' },
] as const satisfies OptionDefinition[];

export const slicerOptions = [
	{ name: 'verbose',           alias: 'v', type: Boolean, description: 'Run with verbose logging' },
	{ name: 'help',              alias: 'h', type: Boolean, description: 'Print this usage guide' },
	{ name: 'input',             alias: 'i', type: String,  description: '(Required) Pass a single file to slice', multiple: false, defaultOption: true, typeLabel: '{underline files}' },
	{ name: 'input-is-text',     alias: 'r', type: Boolean, description: 'Indicate, that the input is *not* a file, but R code to directly consume' },
	{ name: 'diff',              alias: 'd', type: Boolean, description: 'This requires ansi-output and only works if the api option is not set. It visualizes the slice as a diff.' },
	{ name: 'criterion',         alias: 'c', type: String,  description: '(Required) Slicing criterion either in the form {underline line:col} or {underline line@variable}, multiple can be separated by \'{bold ;}\'. If you do not want to slice but only process the file, pass an empty string.', multiple: false },
	{ name: 'stats',             alias: 's', type: Boolean, description: 'Print stats and write them to {italic <output>.stats} (runtimes etc.)', multiple: false },
	{ name: 'output',            alias: 'o', type: String,  description: 'File to write all the generated quads to (defaults to the commandline)', typeLabel: '{underline file}' },
	{ name: 'no-magic-comments', alias: 'm', type: Boolean, description: 'Disable the effects of magic comments which force lines to be included.' },
	{ name: 'inline',                        type: Boolean, description: 'Inline resolvable {italic source()} calls into the reconstruction so the slice is a single self-contained R text.' },
	{ name: 'inline-full',       alias: 'I', type: Boolean, description: 'Inline {italic all} files into one, in flowR\'s loading order (respecting implicit sources), independent of whether they are sourced explicitly.' },
	{ name: 'inline-banner',     alias: 'B', type: Boolean, description: 'Together with {bold --inline-full}: precede every inlined file with a banner comment naming it.' },
	{ name: 'include-callees',               type: Boolean, description: 'If slicing backward, continue past a function-definition boundary, also including the definition\'s binding and call sites.' },
	{ name: 'api',                           type: Boolean, description: 'Instead of human-readable output, dump a lot of json with the results of all intermediate steps.' },
] as const satisfies OptionDefinition[];

export const summarizerOptions = [
	{ name: 'verbose',       alias: 'v', type: Boolean, description: 'Run with verbose logging' },
	{ name: 'help',          alias: 'h', type: Boolean, description: 'Print this usage guide' },
	{ name: 'type',          alias: 't', type: String,  description: 'Manually specify if you want to post-process benchmark results (defaults to auto).', defaultValue: 'auto' },
	{ name: 'graph',         alias: 'g', type: Boolean, description: 'Produce data to be used for visualizing benchmarks over time' },
	{ name: 'categorize',                type: Boolean, description: 'Categorize the results (e.g., "test", "example", ...)', defaultValue: false },
	{ name: 'project-skip',              type: Number,  description: 'Skip the first n folders to find the location of projects', defaultValue: 0 },
	{ name: 'ultimate-only', alias: 'u', type: Boolean, description: 'Only perform the second summary-stage, with this, the input is used to find the summary-output.' },
	{ name: 'input',         alias: 'i', type: String,  description: 'The {italic output} produced by the benchmark', defaultOption: true, multiple: false, typeLabel: '{underline file.json/output}' },
	{ name: 'output',        alias: 'o', type: String,  description: 'Basename of the summaries (defaults to {italic <input>-summary})', typeLabel: '{underline file}' },
] as const satisfies OptionDefinition[];
