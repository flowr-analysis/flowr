/**
 * The summarizer intends to post-process and summarize the results of
 * * the benchmark tool, and
 * * the statistics extraction.
 *
 * @module
 */

import { processCommandLineArgs } from './common'
import { BenchmarkSummarizer } from '../util/summarizer/benchmark/summarizer'

export interface SummarizerCliOptions {
	verbose:         boolean
	help:            boolean
	'ultimate-only': boolean
	input:           string
	type:            string
	output?:         string
	graph?:          boolean
}

const options = processCommandLineArgs<SummarizerCliOptions>('summarizer', ['input'],{
	subtitle: 'Summarize and explain the results of the benchmark tool. Summarizes in two stages: first per-request, and then overall',
	examples: [
		'{italic benchmark.json}',
		'{bold --help}'
	]
})

const outputBase = (options.output ?? options.input).replace(/\.json$/, '-summary')
console.log(`Writing outputs to base ${outputBase}`)

async function run() {
	const summarizer = new BenchmarkSummarizer({
		graph:                  options.graph ? `${outputBase}-graph.json` : undefined,
		inputPath:              options.input,
		intermediateOutputPath: `${outputBase}.json`,
		outputPath:             `${outputBase}-ultimate.json`,
		outputLogPath:          `${outputBase}.log`,
		logger:                 console.log
	})

	if(!options['ultimate-only']) {
		await summarizer.preparationPhase()
	}

	await summarizer.summarizePhase()
}

void run()

