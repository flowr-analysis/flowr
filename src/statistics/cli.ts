import { allFeatureNames, FeatureKey } from './features'
import { OptionDefinition } from 'command-line-usage'
import { date2string } from '../util/time'

export const toolName = 'stats'

const featureNameList = [...allFeatureNames].map(s => `"${s}"`).join(', ')
export const optionDefinitions: OptionDefinition[] = [
	{ name: 'verbose',      alias: 'v', type: Boolean, description: 'Run with verbose logging' },
	{ name: 'help',         alias: 'h', type: Boolean, description: 'Print this usage guide.' },
	{ name: 'post-process',             type: Boolean, description: 'If set, will enable post-processing of the given input (clustering, ...). Pass the output-dir of the processing as input.' },
	{ name: 'limit',        alias: 'l', type: Number,  description: 'Limit the number of files to process'},
	{ name: 'hist-step',                type: Number,  description: 'When post-processing, the step size for the histogram', defaultValue: 0.01, typeLabel: '{underline number}' },
	{ name: 'input',        alias: 'i', type: String,  description: 'Pass a folder or file as src to read from', multiple: true, defaultOption: true, defaultValue: [], typeLabel: '{underline files/folders}' },
	{ name: 'output-dir',   alias: 'o', type: String,  description: 'Folder to write the output to', defaultValue: `${process.cwd()}/statistics-out/${date2string(new Date())}`, typeLabel: '{underline folder}' },
	{ name: 'no-ansi',                  type: Boolean, description: 'Disable ansi-escape-sequences in the output. Useful, if you want to redirect the output to a file.'},
	{ name: 'features',                 type: String,  description: `Features to track, supported are "all" or ${featureNameList}`, multiple: true, defaultValue: 'all', typeLabel: `{underline names}` },
]

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
		header:  'Generate usage Statistics for R scripts',
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
		optionList: optionDefinitions
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
