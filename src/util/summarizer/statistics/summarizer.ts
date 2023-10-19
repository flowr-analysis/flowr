import { CommonSummarizerConfiguration, Summarizer } from '../summarizer'
import { getAllFiles } from '../../files'
import { extract, list } from 'tar'
import os from 'os'
import { longestCommonPrefix } from '../../strings'
import fs from 'fs'
import { guard } from '../../assert'
import path from 'path'
import { FeatureSelection } from '../../../statistics'
import { date2string } from '../../time'
import { FileMigrator } from './first-phase/process'

// TODO: histograms
export interface StatisticsSummarizerConfiguration extends CommonSummarizerConfiguration {
	/**
	 * The input path to read all zips from
	 */
	inputPath:              string
	/**
	 * Features to extract the summaries for
	 */
	featuresToUse:          FeatureSelection
	/**
	 * Path for the intermediate results of the preparation phase
	 */
	intermediateOutputPath: string
	/**
	 * Path for the final results of the summarization phase
	 */
	outputPath:             string
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


const filePrefixRegex = /^([^-]+)--/
/** if it starts with example-, this will return `'example'`, etc. if it starts with '--' this will return `undefined` */
function identifyExtractionType(path: string): string | undefined  {
	const match = filePrefixRegex.exec(path)
	if(match === null) {
		return undefined
	}
	return match[1]
}

// TODO: extract and collect all meta stats

export class StatisticsSummarizer extends Summarizer<unknown, StatisticsSummarizerConfiguration> {
	public constructor(config: StatisticsSummarizerConfiguration) {
		super(config)
	}

	private removeIfExists(path?: string) {
		if(path && fs.existsSync(path)) {
			this.log(`Removing existing ${path}`)
			fs.rmSync(path, { recursive: true, force: true })
		}
	}

	/**
	 * The preparation phase essentially merges all files into one by just attaching lines together!
	 */
	public async preparationPhase(): Promise<void> {
		this.removeIfExists(this.config.intermediateOutputPath)
		fs.mkdirSync(this.config.intermediateOutputPath, { recursive: true })

		let count = 0
		const migrator = new FileMigrator()
		for await (const f of getAllFiles(this.config.inputPath, /\.tar.gz$/)) {
			this.log(`[${count++}, ${date2string()}] processing file ${f} (to ${this.config.intermediateOutputPath})`)
			let target: string | undefined = undefined
			try {
				target = await extractArchive(f)
			} catch(e) {
				this.log(`    Failed to extract ${f}, skipping...`)
				continue
			}
			guard(target !== undefined && fs.existsSync(target), () => `expected to extract "${f}" to "${target ?? '?'}"`)

			this.log('    Migrating files...')
			const folder = identifyExtractionType(path.basename(target))
			await migrator.migrate(target, path.join(this.config.intermediateOutputPath, folder ?? 'default'))
			// postProcessFeatureFolder(this.log, target, this.config.featuresToUse, this.config.intermediateOutputPath)

			this.log('    Done! (Cleanup...)')
			fs.rm(target, { recursive: true, force: true }, () => { /* just do nothing */ })
		}
		migrator.finish()
		this.log(`Found ${count} files to summarize`)
		return Promise.resolve()
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- just to obey the structure
	public async summarizePhase(): Promise<unknown> {
		// TODO: use post-processor

		return Promise.resolve(undefined)
	}
}

