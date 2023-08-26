/**
 * This file contains the references to all scripts, as well as their explanations and arguments.
 *
 * @module
 */
import { MergeableRecord } from '../../util/objects'
import { OptionDefinition } from 'command-line-usage'


interface BaseScriptInformation extends MergeableRecord {
	toolName:     string
	target:       string
	description:  string
	usageExample: string
	options:      OptionDefinition[]
}

export interface MasterScriptInformation extends BaseScriptInformation {
	type: 'master script',
}

export interface HelperScriptInformation extends BaseScriptInformation {
	type:          'helper script',
	masterScripts: string[]
}

export type ScriptInformation = MasterScriptInformation | HelperScriptInformation


export const scripts = new Map<string, ScriptInformation>()

export function register(name: string, information: ScriptInformation) {
	scripts.set(name, information)
}

