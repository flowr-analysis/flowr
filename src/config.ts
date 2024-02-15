import type { MergeableRecord} from './util/objects'
import {deepMergeObject} from './util/objects'
import path from 'path'
import fs from 'fs'
import {log} from './util/log'

export interface FlowrConfigOptions extends MergeableRecord {
	ignoreSourceCalls: boolean
}

export const defaultConfigOptions: FlowrConfigOptions = {
	ignoreSourceCalls: false
}

export const configFile = 'flowr.json'
export const config = parseConfigOptions()

function parseConfigOptions(): FlowrConfigOptions {
	let searchPath = path.resolve(process.cwd())
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
		// move up to parent directory (apparently this is somehow the best way to do it in node, what)
		searchPath = searchPath.split(path.sep).slice(0, -1).join(path.sep)
	} while(fs.existsSync(searchPath))

	log.info('Using default config')
	return defaultConfigOptions
}
