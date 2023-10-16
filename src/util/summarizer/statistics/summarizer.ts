import { CommonSummarizerConfiguration, Summarizer } from '../summarizer'
import { getAllFiles } from '../../files'
import { extract, list } from 'tar'
import os from 'os'
import { longestCommonPrefix } from '../../strings'
import fs from 'fs'
import { guard } from '../../assert'
import path from 'path'
import { FeatureSelection, postProcessFeatureFolder } from '../../../statistics'

// TODO: histograms
export interface StatisticsSummarizerConfiguration extends CommonSummarizerConfiguration {
	/**
	 * The input path to read all zips from
	 */
	inputPath:     string
	/**
	 * Features to extract the summaries for
	 */
	featuresToUse: FeatureSelection
	/**
	 * Path for the final results of the summarization phase
	 */
	outputPath:    string
}

export const statisticsFileNameRegex = /.*--.*\.tar\.gz$/

function retrieveAllFilenamesInArchive(f: string) {
	const filenames: string[] = []
	list({
		file:    f,
		onentry: entry => filenames.push(entry.path),
		sync:    true
	})
	return filenames
}

function identifyStripNumber(paths: string[]): { strip: number, commonRoot: string } {
	const longestPrefix = longestCommonPrefix(paths)
	// we need to subtract one for account for trailing/unfinished '/' (there will be no leading '/')
	// furthermore, we need to subtract one because we want to keep the lowest common folder!
	// yes, this can be done much better :c
	return { strip: longestPrefix.split('/').length - 2, commonRoot: longestPrefix  }
}


/** returns the target path */
async function extractArchive(f: string): Promise<string | undefined> {
	const filenames = retrieveAllFilenamesInArchive(f)
	const { strip, commonRoot }  = identifyStripNumber(filenames)
	await extract({
		file: f,
		strip,
		cwd:  os.tmpdir()
	})
	const parts = commonRoot.split('/')
	// we need to get the second to last because of a trailing slash, this should be done better
	return path.join(os.tmpdir(), parts[parts.length - 2])
}

export class StatisticsSummarizer extends Summarizer<unknown, StatisticsSummarizerConfiguration> {
	public constructor(config: StatisticsSummarizerConfiguration) {
		super(config)
	}

	public async preparationPhase(): Promise<void> {
		let count = 0
		for await (const f of getAllFiles(this.config.inputPath, /\.tar.gz$/)) {
			this.log(`[${count++}] processing file ${f}`)
			const target = await extractArchive(f)
			guard(target !== undefined && fs.existsSync(target), () => `expected to extract "${f}" to "${target ?? '?'}"`)

			const reports = postProcessFeatureFolder(target, this.config.featuresToUse)
			console.log(reports.length, reports)

			this.log('    Done! (Cleanup...)')
			// TODO: fs.rmSync(target, { recursive: true, force: true })
			break // TODO: remove safeguard
		}
		this.log(`Found ${count} files to summarize`)
		return Promise.resolve()
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- just to obey the structure
	public async summarizePhase(): Promise<unknown> {
		return Promise.resolve(undefined)
	}
}
