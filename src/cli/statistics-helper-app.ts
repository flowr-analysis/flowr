import { RShell } from '../r-bridge'
import {
	extractUsageStatistics,
	printFeatureStatistics,
	initFileProvider,
	setFormatter,
	voidFormatter, staticRequests
} from '../statistics'
import { log } from '../util/log'
import { processCommandLineArgs } from './common'
import { validateFeatures } from './statistics-app'

export interface StatsHelperCliOptions {
	verbose:      boolean
	help:         boolean
	'hist-step':  number
	input:        string
	'output-dir': string
	'no-ansi':    boolean
	features:     string[]
}

const options = processCommandLineArgs<StatsHelperCliOptions>('stats-helper', [],{
	subtitle: 'Given a single input file, this will collect usage statistics for the given features and write them to a file',
	examples: [
		'{bold -i} {italic example.R} {bold -i} {italic example2.R} {bold --output-dir} {italic "output-folder/"}',
		'{bold --help}'
	]
})

if(options['no-ansi']) {
	log.info('disabling ansi colors')
	setFormatter(voidFormatter)
}


const processedFeatures = validateFeatures(options.features)

const shell = new RShell()
shell.tryToInjectHomeLibPath()

initFileProvider(options['output-dir'])

async function getStats() {
	let cur = 0
	const stats = await extractUsageStatistics(shell,
		file => console.log(`${new Date().toLocaleString()} processing ${++cur} ${file.content}`),
		processedFeatures,
		staticRequests({ request: 'file', content: options.input })
	)
	console.warn(`skipped ${stats.meta.failedRequests.length} requests due to errors (run with logs to get more info)`)

	printFeatureStatistics(stats, processedFeatures)
	shell.close()
}

void getStats()

