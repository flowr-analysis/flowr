import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import { summarizeSlicerStats, Slicer, stats2string } from '../benchmark'
import { DefaultAllVariablesFilter } from '../slicing'
import { allRFilesFrom } from '../util/files'
import { RParseRequestFromFile } from '../r-bridge'

// TODO: promote to the normal slicing app with a --benchmark 100 flag afterwards
// TODO: allow to select slicing criteria filter

export const toolName = 'benchmark'

export const optionDefinitions: OptionDefinition[] = [
  { name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging [do not use for the real benchmark as this affects the time measurements, but only to find errors]' },
  { name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide.' },
  { name: 'limit',        alias: 'l', type: Number,  description: 'Limit the number of files to process (if given, this will choose these files randomly and add the chosen names to the output'},
  { name: 'input',        alias: 'i', type: String,  description: 'Pass a folder or file as src to read from', multiple: true, defaultOption: true, defaultValue: [], typeLabel: '{underline files/folders}' },
  // TODO: criteria, output and rest
]

export interface BenchmarkCliOptions {
  verbose: boolean
  help:    boolean
  input:   string[]
  limit?:  number
}

export const optionHelp = [
  {
    header:  'Benchmark the static backwards slicer',
    content: '[TODO]'
  },
  {
    header:  'Synopsis',
    content: [
      // `$ ${toolName} {bold -i} {italic example.R} {bold --criterion} {italic 7:3}`,
      // `$ ${toolName} {bold -i} {italic example.R} {bold --stats} {bold --criterion} {italic "8:3;3:1;12@product"}`,
      `$ ${toolName} {bold --help}`
    ]
  },
  {
    header:     'Options',
    optionList: optionDefinitions
  }
]

const options = commandLineArgs(optionDefinitions) as BenchmarkCliOptions

if(options.help) {
  console.log(commandLineUsage(optionHelp))
  process.exit(0)
}

log.updateSettings(l => l.settings.minLevel = options.verbose ? LogLevel.trace : LogLevel.error)
log.info('running with options - do not use for final benchmark', options)


async function benchmark() {
  // we do not use the limit argument to be able to pick the limit randomly
  const files: RParseRequestFromFile[] = []
  for await (const file of allRFilesFrom(options.input)) {
    files.push(file)
  }

  if(options.limit) {
    log.info(`limiting to ${options.limit} files`)
    // shuffle and limit
    // TODO: do not limit here to compensate for failures!
    files.sort(() => Math.random() - 0.5)
    files.length = options.limit
  }

  let counter = 0
  for(const file of files) {
    const slicer = new Slicer()

    console.log(`Processing file ${++counter}/${files.length}: ${file.content}`)
    // TODO: multiple
    await slicer.init(file)

    try {
      slicer.sliceForAll(DefaultAllVariablesFilter)
    } catch (e: unknown) {
      log.error(`[Skipped] Error while processing ${JSON.stringify(file)}: ${(e as Error).message} (${(e as Error).stack ?? ''})`)
    }

    const stats = slicer.finish()
    const sliceStatsAsString = stats2string(await summarizeSlicerStats(stats))
    // console.log(sliceStatsAsString)
  }
}

void benchmark()

