/**
 * This module is tasked with processing the results of the benchmarking (see {@link SlicerStats}).
 * @module
 */
import type { CommonSummarizerConfiguration } from '../summarizer'
import { Summarizer } from '../summarizer'
import type { SummarizedSlicerStats, UltimateSlicerStats } from './data'
import fs from 'fs'
import { processNestMeasurement } from './first-phase/input'
import { jsonReplacer } from '../../json'
import { ultimateStats2String } from '../../../benchmark'
import { processNextSummary, summarizeAllSummarizedStats } from './second-phase/process'
import { writeGraphOutput } from './second-phase/graph'
import { readLineByLine, readLineByLineSync } from '../../files'
import path from 'path'

export interface BenchmarkSummarizerConfiguration extends CommonSummarizerConfiguration {
	/**
	 * If given, produce graph data output (e.g. for the benchmark visualization) to the given path
	 */
	graphOutputPath?:       string
	/**
	 * The input path to read from
	 */
	inputPath:              string
	/**
	 * Path for the intermediate results of the preparation phase
	 */
	intermediateOutputPath: string
	/**
	 * Path for the final results of the summarization phase
	 */
	outputLogPath?:         string
	/**
	 * Path for the final results of the summarization phase
	 */
	outputPath:             string
}

export class BenchmarkSummarizer extends Summarizer<UltimateSlicerStats, BenchmarkSummarizerConfiguration> {
	public constructor(config: BenchmarkSummarizerConfiguration) {
		super(config)
	}

	public async preparationPhase(): Promise<void> {
		this.removeIfExists(this.config.intermediateOutputPath)
		this.removeIfExists(this.config.outputLogPath)

		for(const filename of fs.readdirSync(this.config.inputPath)){
			const filepath = path.join(this.config.inputPath, filename)
			await readLineByLine(filepath, (line, lineNumber) => processNestMeasurement(line, lineNumber, `${this.config.intermediateOutputPath}.log`, this.config.intermediateOutputPath))
		}

		this.log('Done summarizing')
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- just to obey the structure
	public async summarizePhase(): Promise<UltimateSlicerStats> {
		this.log(`Summarizing all summaries from ${this.config.inputPath}...`)

		this.removeIfExists(this.config.outputPath)

		const allSummarized: SummarizedSlicerStats[] = []
		readLineByLineSync(this.config.intermediateOutputPath, line => processNextSummary(line, allSummarized))

		// summarizedRaw
		const ultimate = summarizeAllSummarizedStats(allSummarized)
		this.log(`Writing ultimate summary to ${this.config.outputPath}`)
		fs.writeFileSync(this.config.outputPath, JSON.stringify(ultimate, jsonReplacer))
		console.log(ultimateStats2String(ultimate))

		if(this.config.graphOutputPath) {
			writeGraphOutput(ultimate, this.config.graphOutputPath)
		}
		return ultimate
	}

	private removeIfExists(path?: string) {
		if(path && fs.existsSync(path)) {
			this.log(`Removing existing ${path}`)
			fs.unlinkSync(path)
		}
	}

}
