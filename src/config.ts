import type { MergeableRecord } from './util/objects';
import { deepMergeObject } from './util/objects';
import path from 'path';
import fs from 'fs';
import { log } from './util/log';
import { getParentDirectory } from './util/files';
import Joi from 'joi';

export interface FlowrConfigOptions extends MergeableRecord {
	/**
	 * Whether source calls should be ignored, causing {@link processSourceCall}'s behavior to be skipped
	 */
	ignoreSourceCalls: boolean
	/**
	 * The path to the R executable to use. If this is undefined, {@link DEFAULT_R_PATH} will be used.
	 */
	rPath:             string | undefined
}

export const defaultConfigOptions: FlowrConfigOptions = {
	ignoreSourceCalls: false,
	rPath:             undefined
};

const schema = Joi.object({
	ignoreSourceCalls: Joi.boolean().optional(),
	rPath:             Joi.string().optional()
});

// we don't load from a config file at all by default unless setConfigFile is called
let configFile: string | undefined = undefined;
let configWorkingDirectory = process.cwd();
let currentConfig: FlowrConfigOptions | undefined;

export function setConfigFile(file: string | undefined, workingDirectory = process.cwd(), forceLoad = false) {
	configFile = file;
	configWorkingDirectory = workingDirectory;

	// reset the config so it gets reloaded
	currentConfig = undefined;
	if(forceLoad) {
		getConfig();
	}
}

export function setConfig(config: FlowrConfigOptions) {
	currentConfig = config;
}

export function getConfig(): FlowrConfigOptions {
	// lazy-load the config based on the current settings
	if(currentConfig === undefined) {
		setConfig(parseConfigOptions(configFile, configWorkingDirectory));
	}
	return currentConfig as FlowrConfigOptions;
}

function parseConfigOptions(configFile: string | undefined, workingDirectory: string): FlowrConfigOptions {
	if(configFile !== undefined) {
		let searchPath = path.resolve(workingDirectory);
		do{
			const configPath = path.join(searchPath, configFile);
			if(fs.existsSync(configPath)) {
				try {
					const text = fs.readFileSync(configPath,{ encoding: 'utf-8' });
					const parsed = JSON.parse(text) as FlowrConfigOptions;
					const validate = schema.validate(parsed);
					if(!validate.error) {
					// assign default values to all config options except for the specified ones
						const ret = deepMergeObject(defaultConfigOptions, parsed);
						log.info(`Using config ${JSON.stringify(ret)} from ${configPath}`);
						return ret;
					} else {
						log.error(`Failed to validate config file at ${configPath}: ${validate.error.message}`);
					}
				} catch(e) {
					log.error(`Failed to parse config file at ${configPath}: ${(e as Error).message}`);
				}
			}
			// move up to parent directory
			searchPath = getParentDirectory(searchPath);
		} while(fs.existsSync(searchPath));
	}

	log.info(`Using default config ${JSON.stringify(defaultConfigOptions)}`);
	return defaultConfigOptions;
}
