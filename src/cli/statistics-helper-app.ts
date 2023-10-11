import { RShell } from '../r-bridge'
import {
	extractUsageStatistics,
	setFormatter,
	voidFormatter, staticRequests, FeatureKey, initFileProvider, statisticsFileProvider
} from '../statistics'
import { log } from '../util/log'
import { processCommandLineArgs } from './common'
import { jsonReplacer } from '../util/json'
import { extractCFG } from '../util/cfg'
import path from 'path'
import { c } from 'tar'
import fs from 'fs'
import { guard } from '../util/assert'

// apps should never depend on other apps when forking (otherwise, they are "run" on load :/)

export interface StatsHelperCliOptions {
	verbose:      boolean
	help:         boolean
	input:        string
	compress:     boolean
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

let target: string | undefined = undefined
if(options.compress) {
	const basepath = path.normalize(options['output-dir'])
	target = `${basepath.endsWith(path.sep) ? basepath.substring(0, basepath.length - 1) : basepath}.tar.gz`
	if(fs.existsSync(target)) {
		console.log(`Target ${target} archive exists. Skipping completely.`)
		process.exit(0)
	}
}

// assume correct
const processedFeatures = new Set<FeatureKey>(options.features as FeatureKey[])

const shell = new RShell()
shell.tryToInjectHomeLibPath()

initFileProvider(options['output-dir'])

function compressFolder(folder: string, target: string) {
	// use strip:2 when uncompressing
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
	c({
		gzip:          true,
		file:          target,
		portable:      true,
		preservePaths: false,
	}, [folder]).then(() => {
		// now, remove the folder
		fs.rmSync(folder, { recursive: true, force: true })
	}, () => {
		console.log(`failed to compress ${folder}`)
	})
}

async function getStatsForSingleFile() {
	const stats = await extractUsageStatistics(shell,
		() => { /* do nothing */ },
		processedFeatures,
		staticRequests({ request: 'file', content: options.input })
	)
	// console.warn(`skipped ${stats.meta.failedRequests.length} requests due to errors (run with logs to get more info)`)

	if(stats.outputs.size === 1) {
		const [, output] = [...stats.outputs.entries()][0]
		const cfg = extractCFG(output.normalize)
		statisticsFileProvider.append('output-json', 'parse',     JSON.stringify(output.parse, jsonReplacer))
		statisticsFileProvider.append('output-json', 'normalize', JSON.stringify(output.normalize, jsonReplacer))
		statisticsFileProvider.append('output-json', 'dataflow',  JSON.stringify(output.dataflow, jsonReplacer))
		statisticsFileProvider.append('output-json', 'cfg',       JSON.stringify(cfg, jsonReplacer))
	} else {
		log.error(`expected exactly one output, got: ${JSON.stringify(stats.outputs, jsonReplacer, 2)}`)
	}
	statisticsFileProvider.append('meta', 'stats', JSON.stringify(stats.meta))
	shell.close()
	if(options.compress) {
		guard(target !== undefined, 'target must be defined given the compress option')
		console.log(`Compressing ${options['output-dir']} to ${target}`)
		compressFolder(options['output-dir'], target)
	}
}

void getStatsForSingleFile()

