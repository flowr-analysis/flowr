import { CommonSummarizerConfiguration, Summarizer } from '../summarizer'
import { getAllFiles } from '../../files'
import { list } from 'tar'
import { longestCommonPrefix } from '../../strings'
import fs from 'fs'
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

/**
 * The returned map contains the full path as key, mapping it to the complete contents.
 */
async function retrieveAllFilesInArchive(f: string): Promise<Map<string, string>> {
	const filenames = new Map<string, string>()
	const promises: Promise<void>[] = []
	list({
		file:    f,
		onentry: entry => {
			if(entry.type === 'File') {
				promises.push(
					entry.concat().then(content =>{
						filenames.set(entry.path, content.toString())
					})
				)
			}
		},
		sync: true
	})
	await Promise.all(promises)
	return filenames
}

function identifyCommonPrefix(files: Map<string,string>): string {
	return longestCommonPrefix([...files.keys()])
}


/** returns the target path */
async function extractArchive(f: string): Promise<Map<string,string>> {
	const files = await retrieveAllFilesInArchive(f)
	const commonRoot  = identifyCommonPrefix(files)
	// post process until we find the '<filename>.(r|R)' suffix. otherwise, if there are no features and only the meta folder, the meta folder will be removed, resulting in a write
	// to the toplevel!
	const fname = path.basename(f).replace(/\.tar\.gz$/, '')
	const commonPart = commonRoot.substring(0, commonRoot.indexOf(fname))


	// transform all map keys by removing the common root
	const transformed = new Map<string, string>()
	for(const [key, value] of files.entries()) {
		transformed.set(key.replace(commonPart, ''), value)
	}
	return transformed
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
			let target: Map<string,string>
			try {
				target = await extractArchive(f)
				this.log('    Extracted!')
			} catch(e) {
				this.log(`    Failed to extract ${f}, skipping...`)
				continue
			}
			this.log('    Migrating files...')
			const folder = identifyExtractionType(path.basename(f))
			await migrator.migrate(target, path.join(this.config.intermediateOutputPath, folder ?? 'default'))
			// postProcessFeatureFolder(this.log, target, this.config.featuresToUse, this.config.intermediateOutputPath)

			this.log('    Done! (Cleanup...)')
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

