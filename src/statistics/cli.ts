import { allFeatureNames, FeatureKey } from './features'
import { OptionDefinition } from 'command-line-usage'
import { RParseRequestFromFile } from '../r-bridge'
import { log } from '../util/log'
import { allRFiles } from '../util/files'
import { date2string } from '../util/time'

export const toolName = 'stats'

const featureNameList = allFeatureNames.map(s => `"${s}"`).join(', ')
export const optionDefinitions: OptionDefinition[] = [
  { name: 'verbose',    alias: 'v', type: Boolean, description: 'Run with verbose logging' },
  { name: 'help',       alias: 'h', type: Boolean, description: 'Print this usage guide.' },
  { name: 'limit',      alias: 'l', type: Number,  description: 'Limit the number of files to process'},
  { name: 'input',      alias: 'i', type: String,  description: 'Pass a folder or file as src to read from', multiple: true, defaultOption: true, defaultValue: [], typeLabel: '{underline files/folders}' },
  { name: 'output-dir', alias: 'o', type: String,  description: 'Folder to write the output to', defaultValue: `${process.cwd()}/statistics-out/${date2string(new Date())}`, typeLabel: '{underline folder}' },
  { name: 'features',               type: String,  description: `Features to track, supported are "all" or ${featureNameList}`, multiple: true, defaultValue: 'all', typeLabel: `{underline names}` },
]

export interface StatsCliOptions {
  verbose:      boolean
  help:         boolean
  limit:        number
  input:        string[]
  'output-dir': string
  features:     string[]
}

export const optionHelp = [
  {
    header:  'Generate usage Statistics for R scripts',
    content: 'Given input files or folders, this will collect usage statistics for the given features and write them to a file'
  },
  {
    header:  'Synopsis',
    content: [
      `$ ${toolName} {bold -i} {italic example.R} {bold -i} {italic example2.R} {bold --output-dir} {italic "output-folder/"}`,
      `$ ${toolName} {italic "folder1/"} {bold --features} {italic all} {bold --output-dir} {italic "output-folder/"}`,
      `$ ${toolName} {bold --help}`
    ]
  },
  {
    header:     'Options',
    optionList: optionDefinitions
  }
]

/**
 * Retrieves all R files in a given set of directories and files (asynchronously)
 *
 * @param inputs - files or directories to validate for R-files
 * @param limit - limit the number of files to be retrieved
 * @returns number of files processed (&le; limit)
 *
 * @see #allRFiles
 */
export async function* allRFilesFrom(inputs: string[], limit?: number): AsyncGenerator<RParseRequestFromFile, number> {
  limit ??= Number.MAX_VALUE
  if(inputs.length === 0) {
    log.info('No inputs given, nothing to do')
    return 0
  }
  let count = 0
  for(const input of inputs) {
    count += yield* allRFiles(input, limit - count)
  }
  return count
}

export function validateFeatures(features: (string[] | ['all'] | FeatureKey[])): asserts features is ['all'] | FeatureKey[] {
  for (const feature of features) {
    if (feature === 'all') {
      if (features.length > 1) {
        console.error(`Feature "all" must be the only feature given, got ${features.join(', ')}`)
        process.exit(1)
      }
    } else if (!allFeatureNames.includes(feature as FeatureKey)) {
      console.error(`Feature ${feature} is unknown, supported are ${allFeatureNames.join(', ')} or "all"`)
      process.exit(1)
    }
  }
}
