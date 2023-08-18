import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import { BenchmarkSlicer } from '../benchmark'
import { DefaultAllVariablesFilter } from '../slicing'
import { RParseRequestFromFile } from '../r-bridge'
import fs from 'fs'
import { displayEnvReplacer } from '../util/json'
import { guard } from '../util/assert'

export const toolName = 'benchmark-single'

export const optionDefinitions: OptionDefinition[] = [
	{ name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging [do not use for the real benchmark as this affects the time measurements, but only to find errors]' },
	{ name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide.' },
	{ name: 'input',        alias: 'i', type: String,  description: 'Pass a single file as src to read from', multiple: false, defaultOption: true, typeLabel: '{underline file}' },
	{ name: 'slice',        alias: 's', type: String,  description: 'Automatically slice for *all* variables (default) or *no* slicing and only parsing/dataflow construction', defaultValue: 'all', typeLabel: '{underline all/no}' },
	{ name: 'output',       alias: 'o', type: String,  description: `File to write the measurements to (appends a single line in JSON format)`,  typeLabel: '{underline file}' },
]

export interface SingleBenchmarkCliOptions {
	verbose: boolean
	help:    boolean
	input?:  string
	slice:   string
	output?: string
}

export const optionHelp = [
	{
		header:  'Helper Script to Benchmark the Slicer',
		content: 'Will slice for all possible variables, signal by exit code if slicing was successful, and can be run standalone'
	},
	{
		header:  'Synopsis',
		content: [
			`$ ${toolName} {italic example-file.R} --output {italic output.json}`,
			`$ ${toolName} {bold --help}`
		]
	},
	{
		header:     'Options',
		optionList: optionDefinitions
	}
]

const options = commandLineArgs(optionDefinitions) as SingleBenchmarkCliOptions

if(options.help) {
	console.log(commandLineUsage(optionHelp))
	process.exit(0)
}

log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
if(options.verbose) {
	log.error('running with options - do not use for final benchmark', options)
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

	const request = { request: 'file', content: options.input } as RParseRequestFromFile

	const slicer = new BenchmarkSlicer()
	try {
		await slicer.init(request)

		// ${escape}1F${escape}1G${escape}2K for line reset
		if(options.slice === 'all') {
			const count = slicer.sliceForAll(DefaultAllVariablesFilter, (i, total, arr) => console.log(`[${options.input as string}] Slicing ${i + 1}/${total} [${JSON.stringify(arr[i])}]`))
			console.log(`[${options.input}] Completed Slicing`)
			guard(count > 0, `No possible slices found for ${options.input}, skipping in count`)
		} else {
			console.log(`[${options.input}] Skipping Slicing due to --slice=${options.slice}`)
		}

		const { stats } = slicer.finish()
		/* TODO: currently may take forever due to re-parsing necessary
      const sliceStatsAsString = stats2string(await summarizeSlicerStats(stats))
      console.log(sliceStatsAsString)
      */
		// append line by line
		fs.appendFileSync(options.output, `${JSON.stringify({ filename: options.input, stats }, displayEnvReplacer)}\n`)
	} catch (e: unknown) {
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

