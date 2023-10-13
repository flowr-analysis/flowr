import {
	postProcessFolder,
	printClusterReport,
	histogramsFromClusters,
	histograms2table,
	initFileProvider,
	setFormatter,
	voidFormatter,
	ContextsWithCount
} from '../statistics'
import { log } from '../util/log'
import { guard } from '../util/assert'
import { allRFilesFrom, writeTableAsCsv } from '../util/files'
import { DefaultMap } from '../util/defaultmap'
import { processCommandLineArgs } from './common'
import { Arguments, LimitedThreadPool } from '../util/parallel'
import { retrieveArchiveName, validateFeatures } from './common/features'
import path from 'path'
import { jsonReplacer } from '../util/json'
import fs from 'fs'

export interface StatsCliOptions {
	readonly verbose:        boolean
	readonly help:           boolean
	readonly 'post-process': boolean
	readonly limit:          number | undefined
	readonly compress:       boolean
	readonly 'hist-step':    number
	readonly input:          string[]
	readonly 'output-dir':   string
	readonly 'no-ansi':      boolean
	readonly parallel:       number
	readonly features:       string[]
}


const options = processCommandLineArgs<StatsCliOptions>('stats', [],{
	subtitle: 'Given input files or folders, this will collect usage statistics for the given features and write them to a file',
	examples: [
		'{bold -i} {italic example.R} {bold -i} {italic example2.R} {bold --output-dir} {italic "output-folder/"}',
		'{italic "folder1/"} {bold --features} {italic all} {bold --output-dir} {italic "output-folder/"}',
		'{bold --post-process} {italic "output-folder"} {bold --features} {italic assignments}',
		'{bold --help}'
	]
})

if(options.input.length === 0) {
	console.error('No input files given. Nothing to do. See \'--help\' if this is an error.')
	process.exit(0)
}

if(options['no-ansi']) {
	log.info('disabling ansi colors')
	setFormatter(voidFormatter)
}


const processedFeatures = validateFeatures(options.features)

if(options['post-process']) {
	console.log('-----post processing')
	guard(options.input.length === 1, 'post processing only works with a single input file')
	const reports = postProcessFolder(options.input[0], processedFeatures)
	console.log(`found ${reports.length} reports`)
	for(const report of reports) {
		const topNames = new Set(printClusterReport(report, 50))

		report.valueInfoMap = new DefaultMap<string, ContextsWithCount>(
			() => new DefaultMap(() => 0),
			new Map([...report.valueInfoMap.entries()].filter(([name]) => topNames.has(name)))
		)

		const receivedHistograms = histogramsFromClusters(report, options['hist-step'], true)

		for(const hist of receivedHistograms) {
			console.log(`${hist.name}: --- min: ${hist.min}, max: ${hist.max}, mean: ${hist.mean}, median: ${hist.median}, std: ${hist.std}`)
		}

		const outputPath = `${report.filepath}-${options['hist-step']}.dat`
		console.log(`writing histogram data to ${outputPath}`)
		writeTableAsCsv(histograms2table(receivedHistograms, true), outputPath)
		/* writeFileBasedCountToFile(fileBasedCount(report), outputPath) */
	}
	process.exit(0)
}

initFileProvider(options['output-dir'])

const testRegex = /[^/]*\/test/i
const exampleRegex = /[^/]*\/example/i

function getPrefixForFile(file: string) {
	if(testRegex.test(file)) {
		return 'test-'
	}	else if(exampleRegex.test(file)) {
		return 'example-'
	} else {
		return ''
	}
}

function getSuffixForFile(base: string, file: string) {
	const subpath = path.relative(base, file)
	return '--' + subpath.replace(/\//g, '／')
}

async function collectFileArguments(verboseAdd: string[], compress: string[], features: string[]) {
	const files: Arguments[] = []
	let counter = 0
	let presentSteps = 5000
	let skipped = 0
	for await (const f of allRFilesFrom(options.input)) {
		const outputDir = path.join(options['output-dir'], `${getPrefixForFile(f.content)}${getSuffixForFile(options.input.length === 1 ? options.input[0] : '', f.content)}`)
		if(options.compress) {
			const target = retrieveArchiveName(options['output-dir'])
			if(fs.existsSync(target)) {
				console.log(`Archive ${target} exists. Skip.`)
				skipped++
				continue
			}
		}
		files.push(['--input', f.content, '--output-dir', outputDir, ...verboseAdd, ...features, ...compress])
		if(++counter % presentSteps === 0) {
			console.log(`Collected ${counter} files`)
			if(counter >= 10 * presentSteps) {
				presentSteps *= 5
			}
		}
	}
	console.log(`Total: ${counter} files (${skipped} skipped with archive existing)`)
	return files
}

async function getStats() {
	console.log(`Processing features: ${JSON.stringify(processedFeatures, jsonReplacer)}`)
	console.log(`Using ${options.parallel} parallel executors`)


	const verboseAdd = options.verbose ? ['--verbose'] : []
	const compress = options.compress ? ['--compress'] : []
	const features = [...processedFeatures].flatMap(s => ['--features', s])

	// we do not use the limit argument to be able to pick the limit randomly
	const args = await collectFileArguments(verboseAdd, compress, features)

	if(options.limit) {
		console.log('Shuffle...')
		log.info(`limiting to ${options.limit} files`)
		// shuffle and limit
		args.sort(() => Math.random() - 0.5)
	}
	console.log('Prepare Pool...')

	const limit = options.limit ?? args.length

	const pool = new LimitedThreadPool(
		`${__dirname}/statistics-helper-app`,
		args,
		limit,
		options.parallel
	)
	console.log('Run Pool...')
	await pool.run()
	const stats = pool.getStats()
	console.log(`Processed ${stats.counter} files, skipped ${stats.skipped.length} files due to errors`)
}

void getStats()

