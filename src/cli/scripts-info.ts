/**
 * This file contains the references to all scripts, as well as their explanations and arguments.
 *
 * @module
 */
import { MergeableRecord } from '../util/objects'
import { DeepReadonly } from 'ts-essentials'


interface BaseScriptInformation extends MergeableRecord {
	toolName:    string
	target:      string
	description: string
}

export interface MasterScriptInformation extends BaseScriptInformation {
	type: 'master script',
}

export interface HelperScriptInformation extends BaseScriptInformation {
	type:          'helper script',
	masterScripts: (keyof typeof scripts)[]
}

export type ScriptInformation = MasterScriptInformation | HelperScriptInformation

/**
 * We hold `_scripts` internally, to get the keys of the exposed `scripts` type correct
 */
const _scripts = {
	'slicer': {
		toolName:    'slicer',
		target:      'slicer-app',
		description: 'Static backwards executable slicer for R',
		// Slice a given R file, by giving its path and a slicing criterion
		type:        'master script',
	},
	'benchmark': {
		toolName:    'benchmark',
		target:      'benchmark-app',
		description: 'Benchmark the static backwards slicer',
		type:        'master script',
	},
	'benchmark-helper': {
		toolName:      'benchmark-single',
		target:        'benchmark-helper-app',
		description:   'Helper Script to Benchmark the Slicer',
		type:          'helper script',
		masterScripts: [ 'benchmark' ]
	},
	'summarizer': {
		toolName:    'summarizer',
		target:      'summarizer-app',
		description: 'Summarize the results of the benchmark',
		type:        'master script'
	},
	'export-quads': {
		toolName:    'export-quads',
		target:      'export-quads-app',
		description: 'Export quads of the normalized AST of a given R code file',
		type:        'master script'
	},
	'stats': {
		toolName:    'stats',
		target:      'statistics-app',
		description: 'Generate usage Statistics for R scripts',
		type:        'master script'
	},
} as const

export const scripts: DeepReadonly<Record<keyof typeof _scripts, ScriptInformation>> = _scripts

