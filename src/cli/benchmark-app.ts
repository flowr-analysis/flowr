import { log } from '../util/log'
import { allRFilesFrom } from '../util/files'
import type { RParseRequestFromFile } from '../r-bridge'
import { LimitedThreadPool } from '../util/parallel'
import { guard } from '../util/assert'
import fs from 'fs'
import { processCommandLineArgs } from './common'

export interface BenchmarkCliOptions {
	verbose:  boolean
	help:     boolean
	input:    string[]
	output:   string
	slice:    string
	parallel: number
	limit?:   number
	runs?:    number
}


const options = processCommandLineArgs<BenchmarkCliOptions>('benchmark', [],{
	subtitle: 'Slice given files with additional benchmark information',
	examples: [
		'{italic example-folder/}',
		'{bold --help}'
	]
})

if(options.input.length === 0) {
	console.error('No input files given. Nothing to do. See \'--help\' if this is an error.')
	process.exit(0)
}

guard(options.slice === 'all' || options.slice === 'no', 'slice must be either all or no')
guard(options.runs === undefined || options.runs > 0, 'runs must be greater than zero')

function removeIfExists(summarizedRaw: string) {
	if(fs.existsSync(summarizedRaw)) {
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
	const args = files.map(f => [f.content, '--output', options.output, '--slice', options.slice, ...verboseAdd])

	const runs = options.runs ?? 1
	for(let i = 0; i < runs; i++) {
		console.log(`Run ${i+1} of ${runs}`)
		const pool = new LimitedThreadPool(
			`${__dirname}/benchmark-helper-app`,
			[...args],
			limit,
			options.parallel
		)
		await pool.run()
		const stats = pool.getStats()
		console.log(`Run ${i+1} of ${runs}: Benchmarked ${stats.counter} files, skipped ${stats.skipped.length} files due to errors`)
	}
}

void benchmark()
