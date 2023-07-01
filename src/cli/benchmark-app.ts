import { log, LogLevel } from '../util/log'
import commandLineArgs from 'command-line-args'
import commandLineUsage, { OptionDefinition } from 'command-line-usage'
import { summarizeSlicerStats, BenchmarkSlicer, stats2string } from '../benchmark'
import { DefaultAllVariablesFilter } from '../slicing'
import { allRFilesFrom } from '../util/files'
import { RParseRequestFromFile } from '../r-bridge'
import fs from 'fs'
import { displayEnvReplacer } from '../util/json'
import { date2string } from '../util/time'

// TODO: promote to the normal slicing app with a --benchmark 100 flag afterwards
// TODO: allow to select slicing criteria filter

export const toolName = 'benchmark'

const now = date2string(new Date())

export const optionDefinitions: OptionDefinition[] = [
  { name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging [do not use for the real benchmark as this affects the time measurements, but only to find errors]' },
  { name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide.' },
  { name: 'limit',        alias: 'l', type: Number,  description: 'Limit the number of files to process (if given, this will choose these files randomly and add the chosen names to the output'},
  { name: 'input',        alias: 'i', type: String,  description: 'Pass a folder or file as src to read from', multiple: true, defaultOption: true, defaultValue: [], typeLabel: '{underline files/folders}' },
  { name: 'output',       alias: 'o', type: String,  description: `File to write all the measurements to in a per-file-basis (defaults to {italic benchmark-${now}.json})`, defaultValue: `benchmark-${now}.json`,  typeLabel: '{underline file}' },
  // TODO: criteria, output and rest
]

export interface BenchmarkCliOptions {
  verbose: boolean
  help:    boolean
  input:   string[]
  output:  string
  limit?:  number
}

export const optionHelp = [
  {
    header:  'Benchmark the static backwards slicer',
    content: 'Slice given files with additional benchmark information'
  },
  {
    header:  'Synopsis',
    content: [
      `$ ${toolName} {italic example-folder/}`,
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
  console.log(`Writing output continuously to ${options.output}`)
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
  }
  const limit = options.limit ?? files.length

  let counter = 1
  const skipped: RParseRequestFromFile[] = []
  for(const file of files) {
    if(counter > limit) {
      break
    }
    // new slicer for each run
    const slicer = new BenchmarkSlicer()
    try {
      console.log(`Processing file ${counter}/${limit}: ${file.content}`)
      await slicer.init(file)

      slicer.sliceForAll(DefaultAllVariablesFilter)

      const stats = slicer.finish()
      const sliceStatsAsString = stats2string(await summarizeSlicerStats(stats))
      console.log(sliceStatsAsString)
      // append line by line
      fs.appendFileSync(options.output, JSON.stringify({ filename: file.content, stats }, displayEnvReplacer))
      // only increment if everything went fine!
      counter++
    } catch (e: unknown) {
      log.error(`[Skipped] Error while processing ${JSON.stringify(file)}: ${(e as Error).message} (${(e as Error).stack ?? ''})`)
      skipped.push(file)
      slicer.ensureSessionClosed() // ensure finish
    }
  }
  console.log(`Skipped ${skipped.length} files: [${skipped.map(f => f.content).join(', ')}]`)
}

void benchmark()

