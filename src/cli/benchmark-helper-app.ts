import { log } from '../util/log'
import { BenchmarkSlicer } from '../benchmark'
import { DefaultAllVariablesFilter } from '../slicing'
import type { RParseRequestFromFile } from '../r-bridge'
import fs from 'fs'
import { jsonReplacer } from '../util/json'
import { guard } from '../util/assert'
import { processCommandLineArgs } from './common'


export interface SingleBenchmarkCliOptions {
	verbose: boolean
	help:    boolean
	input?:  string
	slice:   string
	output?: string
}

const options = processCommandLineArgs<SingleBenchmarkCliOptions>('benchmark-helper', [],{
	subtitle: 'Will slice for all possible variables, signal by exit code if slicing was successful, and can be run standalone',
	examples: [
		'{italic example-file.R} --output {italic output.json}',
		'{bold --help}'
	]
})

if(options.verbose) {
	log.error('running with *verbose* setting - do not use for final benchmark', options)
}

guard(options.slice === 'all' || options.slice === 'no', 'slice must be either all or no')


async function benchmark() {
	// we do not use the limit argument to be able to pick the limit randomly
	guard(options.input !== undefined, 'No input file given')
	guard(options.output !== undefined, 'No output file given')

	console.log(`[${options.input }] Appending output to ${options.output}`)

	// ensure the file exists
	const fileStat = fs.statSync(options.input)
	guard(fileStat.isFile(), `File ${options.input} does not exist or is no file`)

	const request: RParseRequestFromFile = { request: 'file', content: options.input }

	const slicer = new BenchmarkSlicer(1000)
	try {
		await slicer.init(request)

		// ${escape}1F${escape}1G${escape}2K for line reset
		if(options.slice === 'all') {
			const count = await slicer.sliceForAll(DefaultAllVariablesFilter, (i, total, arr) => console.log(`[${options.input as string}] Slicing ${i + 1}/${total} [${JSON.stringify(arr[i])}]`))
			console.log(`[${options.input}] Completed Slicing`)
			guard(count > 0, `No possible slices found for ${options.input}, skipping in count`)
		} else {
			console.log(`[${options.input}] Skipping Slicing due to --slice=${options.slice}`)
		}

		const { stats } = slicer.finish()
		// append line by line
		fs.appendFileSync(options.output, `${JSON.stringify({ filename: options.input, stats }, jsonReplacer)}\n`)
	} catch(e: unknown) {
		if(e instanceof Error) {
			if(!e.message.includes('unable to parse R')) {
				console.log(`[${options.input}] Non R-Side error : ${e.message}`)
			}
		}
		slicer.ensureSessionClosed() // ensure finish
		throw e
	}
}

void benchmark()

