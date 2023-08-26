import { log } from '../util/log'
import fs from 'fs'
import { guard } from '../util/assert'
import { SingleSlicingCriterion, SlicingCriteria } from '../slicing'
import { BenchmarkSlicer, stats2string, summarizeSlicerStats } from '../benchmark'
import { NodeId } from '../r-bridge'
import { processCommandLineArgs } from './common'

export interface SlicerCliOptions {
	verbose:   boolean
	help:      boolean
	input:     string | undefined
	criterion: string | undefined
	output:    string | undefined
	stats:     boolean
	// dataflow:  boolean
}


const options = processCommandLineArgs<SlicerCliOptions>('slicer', ['input', 'criterion'],{
	subtitle: 'Slice R code based on a given slicing criterion',
	examples: [
		'{bold -c} {italic "12@product"} {italic test/testfiles/example.R}',
		'{bold -i} {italic example.R} {bold --stats} {bold --criterion} {italic "8:3;3:1;12@product"}',
		'{bold --help}'
	]
})

async function getSlice() {
	const slicer = new BenchmarkSlicer()
	guard(options.input !== undefined, `input must be given`)
	guard(options.criterion !== undefined, `a slicing criterion must be given`)

	await slicer.init({ request: 'file', content: options.input })

	const slices = options.criterion.split(';').map(c => c.trim())

	let mappedSlices: { criterion: SingleSlicingCriterion, id: NodeId }[] = []
	try {
		const { stats: { reconstructedCode, slicingCriteria } } = slicer.slice(...slices as SlicingCriteria)
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

