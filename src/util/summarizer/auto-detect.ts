import { SummarizerType } from './summarizer'
import { promises as fsPromise } from 'fs'
import { log } from '../log'

const statisticsRegex = /.*--.*\.tar\.gz$/

export async function detectSummarizationType(inputPath: string): Promise<SummarizerType> {
	// current heuristic: search for a tar.gz with two minus signs :D
	const dirs = await fsPromise.readdir(inputPath, { withFileTypes: false, recursive: true })
	const got = dirs.some(d => statisticsRegex.test(d))
	if(got) {
		log.info(`Detected statistics summarization by file matching ${statisticsRegex.source}`)
		return SummarizerType.Statistics
	} else {
		log.info(`Detected benchmark summarization with no file matching ${statisticsRegex.source}`)
		return SummarizerType.Benchmark
	}
}
