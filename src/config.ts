import type {MergeableRecord} from './util/objects'
import {deepMergeObject} from './util/objects'
import path from 'path'
import fs from 'fs'
import {log} from './util/log'
import {getParentDirectory} from './util/files'

export interface FlowrConfigOptions extends MergeableRecord {
	ignoreSourceCalls: boolean
}

export const defaultConfigOptions: FlowrConfigOptions = {
	ignoreSourceCalls: false
}
export const defaultConfigFile = 'flowr.json'

let configWorkingDirectory = process.cwd()
let configFile = defaultConfigFile
let currentConfig: FlowrConfigOptions | undefined

export function setConfigFile(workingDirectory = process.cwd(), file = defaultConfigFile) {
	configWorkingDirectory = workingDirectory
	configFile = file

	// reset the config so it's reloaded next time
	currentConfig = undefined
}

export function setConfig(config: FlowrConfigOptions) {
	currentConfig = config
}

export function getConfig(): FlowrConfigOptions {
	// lazy-load the config based on the current settings
	if(currentConfig === undefined) {
		setConfig(parseConfigOptions(configWorkingDirectory, configFile))
	}
	return currentConfig as FlowrConfigOptions
}

function parseConfigOptions(workingDirectory: string, configFile: string): FlowrConfigOptions {
	let searchPath = path.resolve(workingDirectory)
	do{
		const configPath = path.join(searchPath, configFile)
		if(fs.existsSync(configPath)) {
			try {
				const read = fs.readFileSync(configPath,{encoding: 'utf-8'})
				// assign default values to all config options except for the specified ones
				const ret = deepMergeObject(defaultConfigOptions, JSON.parse(read) as FlowrConfigOptions)
				log.info(`Using config ${JSON.stringify(ret)} from ${configPath}`)
				return ret
			} catch(e) {
				log.error(`Failed to parse config file at ${configPath}: ${(e as Error).message}`)
			}
		}
		// move up to parent directory
		searchPath = getParentDirectory(searchPath)
	} while(fs.existsSync(searchPath))

	log.info(`Using default config ${JSON.stringify(defaultConfigOptions)}`)
	return defaultConfigOptions
}
