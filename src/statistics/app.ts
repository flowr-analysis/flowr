import { RShell } from '../r-bridge/shell'
import { extract } from './statistics'
import { log, LogLevel } from '../util/log'
import { ALL_FEATURES, FeatureKey } from './feature'

log.updateSettings(l => l.settings.minLevel = LogLevel.error)

const shell = new RShell()
shell.tryToInjectHomeLibPath()

const processArguments = process.argv.slice(2)

console.log(`processing ${processArguments.length} files`)


if (processArguments.length === 0) {
  console.error('Please provide at least one file to generate statistics for')
  process.exit(1)
}

async function getStats(features: 'all' | FeatureKey[] = 'all') {
  const processedFeatures: 'all' | Set<FeatureKey> = features === 'all' ? 'all' : new Set(features)
  let cur = 0
  const stats = await extract(shell,
    file => console.log(`processing ${++cur}/${processArguments.length} ${file.content}`),
    processedFeatures,
    ...processArguments.map(file => ({ request: 'file' as const, content: file }))
  )
  // console.log(JSON.stringify(stats, undefined, 2))

  for(const entry of Object.keys(stats.features)) {
    if(processedFeatures !== 'all' && !processedFeatures.has(entry as FeatureKey)) {
      continue
    }
    // eslint-disable-nex-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error object.keys does not retain the type information
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/restrict-template-expressions
    console.log(ALL_FEATURES[entry].toString(stats.features[entry]))
  }

  const sumLines = stats.meta.lines.reduce((a, b) => a + b, 0)
  console.log(`processed ${stats.meta.successfulParsed} files (skipped ${stats.meta.skipped.length} due to errors):
\ttotal lines: ${sumLines}
\tavg. lines per file: ${sumLines / stats.meta.lines.length}
\tline range: [${Math.min(...stats.meta.lines)} .. ${Math.max(...stats.meta.lines)}]
  `)

  shell.close()
}

void getStats(['definedFunctions'])

