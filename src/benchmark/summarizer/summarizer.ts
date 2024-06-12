/**
 * This module is tasked with processing the results of the benchmarking (see {@link SlicerStats}).
 * @module
 */
import type { UltimateSlicerStats } from './data'
import fs from 'fs'
import { processRunMeasurement, processSummarizedRunMeasurement } from './first-phase/input'
import { processNextUltimateSummary, summarizeAllUltimateStats } from './second-phase/process'
import { writeGraphOutput } from './second-phase/graph'
import path from 'path'
import type { CommonSummarizerConfiguration } from '../../util/summarizer'
import { Summarizer } from '../../util/summarizer'
import { readLineByLine, readLineByLineSync } from '../../util/files'
import { jsonReplacer } from '../../util/json'
import { ultimateStats2String } from '../stats/print'
import { DefaultMap } from '../../util/defaultmap'
import { guard } from '../../util/assert'

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
	outputPath:             string
}

export class BenchmarkSummarizer extends Summarizer<UltimateSlicerStats, BenchmarkSummarizerConfiguration> {
	public constructor(config: BenchmarkSummarizerConfiguration) {
		super(config)
	}

	public async preparationPhase(): Promise<void> {
		this.removeIfExists(this.summaryFile())

		this.removeIfExists(this.config.intermediateOutputPath)
		fs.mkdirSync(this.config.intermediateOutputPath, { recursive: true })

		// recursively find all files in all the input path subdirectories
		const filesToSummarize = fs.readdirSync(this.config.inputPath, { encoding: 'utf-8', recursive: true })
			.map(e => path.join(this.config.inputPath, e)).filter(e => fs.statSync(e).isFile())

		guard(filesToSummarize.length > 0, `Found no files to summarize in ${this.config.inputPath}`)
		this.log(`Found ${filesToSummarize.length} files to summarize in ${this.config.inputPath}`)

		const outputPathsPerRun = new DefaultMap<number, string[]>(() => [])
		for(let i = 0; i < filesToSummarize.length; i++) {
			const outputDir = path.join(this.config.intermediateOutputPath, path.relative(this.config.inputPath, filesToSummarize[i]))
			fs.mkdirSync(outputDir, { recursive: true })
			const textOutputPath = path.join(outputDir, 'summary.log')

			// generate measurements for each run
			await readLineByLine(filesToSummarize[i], (line, lineNumber) => {
				const runOutputPath = path.join(outputDir, `run-${lineNumber}.json`)
				outputPathsPerRun.get(lineNumber).push(runOutputPath)
				return processRunMeasurement(line, i, lineNumber, textOutputPath, runOutputPath)
			})
		}

		// generate combined measurements for each file per run
		for(const [run, paths] of outputPathsPerRun.entries()) {
			processSummarizedRunMeasurement(run, paths, this.summaryFile())
		}

		this.log('Done summarizing')
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- just to obey the structure
	public async summarizePhase(): Promise<UltimateSlicerStats> {
		this.log(`Summarizing all summaries from ${this.summaryFile()}...`)

		this.removeIfExists(this.config.outputPath)

		const summaries: UltimateSlicerStats[] = []
		readLineByLineSync(this.summaryFile(), (l) => processNextUltimateSummary(l, summaries))

		const ultimate = summarizeAllUltimateStats(summaries)
		this.log(`Writing ultimate summary to ${this.config.outputPath}`)
		fs.writeFileSync(this.config.outputPath, JSON.stringify(ultimate, jsonReplacer))
		console.log(ultimateStats2String(ultimate))

		if(this.config.graphOutputPath) {
			writeGraphOutput(ultimate, this.config.graphOutputPath)
		}
		return ultimate
	}

	private removeIfExists(path?: string): void {
		if(path && fs.existsSync(path)) {
			this.log(`Removing existing ${path}`)
			fs.rmSync(path, { recursive: true })
		}
	}

	private summaryFile(): string {
		return `${this.config.intermediateOutputPath}.json`
	}

}
