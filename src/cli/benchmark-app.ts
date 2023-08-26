import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage from 'command-line-usage'
import { allRFilesFrom } from '../util/files'
import { RParseRequestFromFile } from '../r-bridge'
import { LimitBenchmarkPool } from '../benchmark/parallel-helper'
import { guard } from '../util/assert'
import fs from 'fs'
import { scripts } from './common'
import { benchmarkOptions } from './common/options'

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
		header:  scripts.benchmark.description,
		content: 'Slice given files with additional benchmark information'
	},
	{
		header:  'Synopsis',
		content: [
			`$ ${scripts.benchmark.toolName} {italic example-folder/}`,
			`$ ${scripts.benchmark.toolName} {bold --help}`
		]
	},
	{
		header:     'Options',
		optionList: benchmarkOptions
	}
]

const options = commandLineArgs(benchmarkOptions) as BenchmarkCliOptions

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

