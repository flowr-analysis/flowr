import { RShell } from '../r-bridge'
import {
	extract,
	postProcessFolder,
	printClusterReport,
	histogramsFromClusters,
	histograms2table,
	printFeatureStatistics,
	initFileProvider,
	setFormatter,
	voidFormatter, ContextsWithCount, allFeatureNames, FeatureKey
} from '../statistics'
import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage from 'command-line-usage'
import { guard } from '../util/assert'
import { allRFilesFrom, writeTableAsCsv } from '../util/files'
import { DefaultMap } from '../util/defaultmap'
import { statisticOptions } from './common/options'


export const toolName = 'stats'
export const description = 'Generate usage Statistics for R scripts'

export interface StatsCliOptions {
	verbose:        boolean
	help:           boolean
	'post-process': boolean
	limit:          number
	'hist-step':    number
	input:          string[]
	'output-dir':   string
	'no-ansi':      boolean
	features:       string[]
}

export const optionHelp = [
	{
		header:  description,
		content: 'Given input files or folders, this will collect usage statistics for the given features and write them to a file'
	},
	{
		header:  'Synopsis',
		content: [
			`$ ${toolName} {bold -i} {italic example.R} {bold -i} {italic example2.R} {bold --output-dir} {italic "output-folder/"}`,
			`$ ${toolName} {italic "folder1/"} {bold --features} {italic all} {bold --output-dir} {italic "output-folder/"}`,
			`$ ${toolName} {bold --post-process} {italic "output-folder"} {bold --features} {italic assignments}`,
			`$ ${toolName} {bold --help}`
		]
	},
	{
		header:     'Options',
		optionList: statisticOptions
	}
]


export function validateFeatures(features: (string[] | ['all'] | FeatureKey[])): Set<FeatureKey> {
	for (const feature of features) {
		if (feature === 'all') {
			if (features.length > 1) {
				console.error(`Feature "all" must be the only feature given, got ${features.join(', ')}`)
				process.exit(1)
			}
		} else if (!allFeatureNames.has(feature as FeatureKey)) {
			console.error(`Feature ${feature} is unknown, supported are ${[...allFeatureNames].join(', ')} or "all"`)
			process.exit(1)
		}
	}
	return features[0] === 'all' ? allFeatureNames : new Set(features as FeatureKey[])
}


const options = commandLineArgs(statisticOptions) as StatsCliOptions

if(options.help) {
	console.log(commandLineUsage(optionHelp))
	process.exit(0)
}
log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options', options)
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

const shell = new RShell()
shell.tryToInjectHomeLibPath()

initFileProvider(options['output-dir'])

async function getStats() {
	console.log(`Processing features: ${JSON.stringify(processedFeatures)}`)
	let cur = 0
	const stats = await extract(shell,
		file => console.log(`${new Date().toLocaleString()} processing ${++cur} ${file.content}`),
		processedFeatures,
		allRFilesFrom(options.input, options.limit)
	)
	console.warn(`skipped ${stats.meta.skipped.length} requests due to errors (run with logs to get more info)`)

	printFeatureStatistics(stats, processedFeatures)
	shell.close()
}

void getStats()

