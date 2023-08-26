import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import fs from 'fs'
import { guard } from '../util/assert'
import { SingleSlicingCriterion, SlicingCriteria } from '../slicing'
import { BenchmarkSlicer, stats2string, summarizeSlicerStats } from '../benchmark'
import { NodeId } from '../r-bridge'
import { scripts } from './scripts-info'

export const optionDefinitions: OptionDefinition[] = [
	{ name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging' },
	{ name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide' },
	{ name: 'input',        alias: 'i', type: String,  description: '(Required) Pass a single file to slice', multiple: false, defaultOption: true, typeLabel: '{underline files}' },
	{ name: 'criterion',    alias: 'c', type: String,  description: '(Required) Slicing criterion either in the form {underline line:col} or {underline line@variable}, multiple can be separated by \'{bold ;}\'', multiple: false },
	{ name: 'stats',        alias: 's', type: Boolean, description: `Print stats and write them to {italic <output>.stats} (runtimes etc.)`, multiple: false },
	// { name: 'dataflow',     alias: 'd', type: Boolean, description: `Dump mermaid code for the dataflow to {italic <output>.dataflow}`, multiple: false },
	{ name: 'output',       alias: 'o', type: String,  description: 'File to write all the generated quads to (defaults to the commandline)', typeLabel: '{underline file}' },
]

export interface SlicerCliOptions {
	verbose:   boolean
	help:      boolean
	input:     string | undefined
	criterion: string | undefined
	output:    string | undefined
	stats:     boolean
	// dataflow:  boolean
}

export const optionHelp = [
	{
		header:  scripts.slicer.description,
		content: 'Slice R code based on a given slicing criterion'
	},
	{
		header:  'Synopsis',
		content: [
			`$ ${scripts.slicer.toolName} {bold -c} {italic "12@product"} {italic test/testfiles/example.R}`,
			`$ ${scripts.slicer.toolName} {bold -i} {italic example.R} {bold --stats} {bold --criterion} {italic "8:3;3:1;12@product"}`,
			`$ ${scripts.slicer.toolName} {bold --help}`
		]
	},
	{
		header:     'Options',
		optionList: optionDefinitions
	}
]

const options = commandLineArgs(optionDefinitions) as SlicerCliOptions

if(options.help || !options.input || !options.criterion) {
	console.log(commandLineUsage(optionHelp))
	process.exit(0)
}
log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options', options)


async function getSlice() {
	const slicer = new BenchmarkSlicer()
	guard(options.input !== undefined, `input must be given`)
	guard(options.criterion !== undefined, `a slicing criterion must be given`)

	await slicer.init({ request: 'file', content: options.input })

	const slices = options.criterion.split(';').map(c => c.trim())

	let mappedSlices: { criterion: SingleSlicingCriterion, id: NodeId }[] = []
	try {
		const { reconstructedCode, slicingCriteria } = slicer.slice(...slices as SlicingCriteria)
		mappedSlices = slicingCriteria
		if(options.output) {
			console.log('Written reconstructed code to', options.output)
			console.log(`Automatically selected ${reconstructedCode.autoSelected} statements`)
			fs.writeFileSync(options.output, reconstructedCode.code)
		} else {
			console.log(reconstructedCode.code)
		}
	} catch (e: unknown) {
		log.error(`[Skipped] Error while processing ${options.input}: ${(e as Error).message} (${(e as Error).stack ?? ''})`)
	}

	const { stats, decoratedAst } = slicer.finish()
	const mappedCriteria = mappedSlices.map(c => `    ${c.criterion} => ${c.id} (${JSON.stringify(decoratedAst.idMap.get(c.id)?.location)})`).join('\n')
	log.info(`Mapped criteria:\n${mappedCriteria}`)
	const sliceStatsAsString = stats2string(await summarizeSlicerStats(stats))

	if(options.stats) {
		console.log(sliceStatsAsString)
		const filename = `${options.input}.stats`
		console.log(`Writing stats for ${options.input} to "${filename}"`)
		fs.writeFileSync(filename, sliceStatsAsString)
	}
}

void getSlice()

