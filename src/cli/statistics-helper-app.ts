import { RShell } from '../r-bridge'
import {
	extractUsageStatistics,
	setFormatter,
	voidFormatter, staticRequests, FeatureKey, initFileProvider, statisticsFileProvider
} from '../statistics'
import { log } from '../util/log'
import { processCommandLineArgs } from './common'

// apps should never depend on other apps when forking (otherwise, they are "run" on load :/)

export interface StatsHelperCliOptions {
	verbose:      boolean
	help:         boolean
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


// assume correct
const processedFeatures = new Set<FeatureKey>(options.features as FeatureKey[])

const shell = new RShell()
shell.tryToInjectHomeLibPath()

initFileProvider(options['output-dir'])

async function getStatsForSingleFile() {
	const stats = await extractUsageStatistics(shell,
		() => { /* do nothing */ },
		processedFeatures,
		staticRequests({ request: 'file', content: options.input })
	)
	// console.warn(`skipped ${stats.meta.failedRequests.length} requests due to errors (run with logs to get more info)`)

	statisticsFileProvider.append('meta', 'stats', JSON.stringify(stats))
	shell.close()
}

void getStatsForSingleFile()

