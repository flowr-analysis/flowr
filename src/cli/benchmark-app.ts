import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import { allRFilesFrom } from '../util/files'
import { RParseRequestFromFile } from '../r-bridge'
import { date2string } from '../util/time'
import { LimitBenchmarkPool } from '../benchmark/parallel-helper'
import * as os from 'os'
import { guard } from '../util/assert'
import fs from 'fs'

export const toolName = 'benchmark'

const now = date2string(new Date())

export const optionDefinitions: OptionDefinition[] = [
	{ name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging [do not use for the real benchmark as this affects the time measurements, but only to find errors]' },
	{ name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide' },
	{ name: 'limit',        alias: 'l', type: Number,  description: 'Limit the number of files to process (if given, this will choose these files randomly and add the chosen names to the output'},
	{ name: 'input',        alias: 'i', type: String,  description: 'Pass a folder or file as src to read from', multiple: true, defaultOption: true, defaultValue: [], typeLabel: '{underline files/folders}' },
	{ name: 'parallel',     alias: 'p', type: String,  description: 'Number of parallel executors (defaults to {italic max(cpu.count-1, 1)})', defaultValue: Math.max(os.cpus().length - 1, 1), typeLabel: '{underline number}' },
	{ name: 'slice',        alias: 's', type: String,  description: 'Automatically slice for *all* variables (default) or *no* slicing and only parsing/dataflow construction', defaultValue: 'all', typeLabel: '{underline all/no}' },
	{ name: 'output',       alias: 'o', type: String,  description: `File to write all the measurements to in a per-file-basis (defaults to {italic benchmark-${now}.json})`, defaultValue: `benchmark-${now}.json`,  typeLabel: '{underline file}' }
]

export interface BenchmarkCliOptions {
	verbose:  boolean
	help:     boolean
	input:    string[]
	output:   string
	slice:    string
	parallel: number
	limit?:   number
}

export const optionHelp = [
	{
		header:  'Benchmark the static backwards slicer',
		content: 'Slice given files with additional benchmark information'
	},
	{
		header:  'Synopsis',
		content: [
			`$ ${toolName} {italic example-folder/}`,
			`$ ${toolName} {bold --help}`
		]
	},
	{
		header:     'Options',
		optionList: optionDefinitions
	}
]

const options = commandLineArgs(optionDefinitions) as BenchmarkCliOptions

if(options.help) {
	console.log(commandLineUsage(optionHelp))
	process.exit(0)
}

log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options - do not use for final benchmark', options)

guard(options.slice === 'all' || options.slice === 'no', 'slice must be either all or no')

function removeIfExists(summarizedRaw: string) {
	if (fs.existsSync(summarizedRaw)) {
		console.log(`Removing existing ${summarizedRaw}`)
		fs.unlinkSync(summarizedRaw)
	}
}

async function benchmark() {
	removeIfExists(options.output)
	console.log(`Writing output continuously to ${options.output}`)
	console.log(`Using ${options.parallel} parallel executors`)
	// we do not use the limit argument to be able to pick the limit randomly
	const files: RParseRequestFromFile[] = []
	for await (const file of allRFilesFrom(options.input)) {
		files.push(file)
	}

	if(options.limit) {
		log.info(`limiting to ${options.limit} files`)
		// shuffle and limit
		files.sort(() => Math.random() - 0.5)
	}
	const limit = options.limit ?? files.length

	const verboseAdd = options.verbose ? ['--verbose'] : []

	const pool = new LimitBenchmarkPool(
		`${__dirname}/../cli/benchmark-helper-app`,
		files.map(f => [f.content, '--output', options.output, '--slice', options.slice, ...verboseAdd]),
		limit,
		options.parallel
	)
	await pool.run()
	const stats = pool.getStats()
	console.log(`Benchmarked ${stats.counter} files, skipped ${stats.skipped.length} files due to errors`)
}

void benchmark()

