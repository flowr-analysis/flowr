import type { MergeableRecord } from './util/objects';
import { deepMergeObject } from './util/objects';
import path from 'path';
import fs from 'fs';
import { log } from './util/log';
import { getParentDirectory } from './util/files';
import Joi from 'joi';
import type { BuiltInDefinitions } from './dataflow/environments/built-in-config';

export interface FlowrConfigOptions extends MergeableRecord {
	/**
	 * Whether source calls should be ignored, causing {@link processSourceCall}'s behavior to be skipped
	 */
	readonly ignoreSourceCalls: boolean
	/**
	 * The path to the R executable to use. If this is undefined, {@link DEFAULT_R_PATH} will be used.
	 */
	readonly rPath:             string | undefined
	/** Configure language semantics and how flowR handles them */
	readonly semantics: {
		/** Semantics regarding the handlings of the environment */
		readonly environment: {
			/** Do you want to overwrite (parts) of the builtin definition? */
			readonly overwriteBuiltIns: {
				/** Should the default configuration still be loaded? */
				readonly loadDefaults?: boolean
				/** The definitions to load */
				readonly definitions:   BuiltInDefinitions
			}
		}
	}

	/**
	 * How to resolve constants 
	 * disabled: don't resolve constants at all
	 * alias: use alias tracking to resolve
	 * builtin: only resolve directly assigned builtin constants
	 */
	readonly resolve: 'disabled' | 'alias' | 'builtin'
}

export const defaultConfigOptions: FlowrConfigOptions = {
	ignoreSourceCalls: false,
	rPath:             undefined,
	semantics:         {
		environment: {
			overwriteBuiltIns: {
				loadDefaults: true,
				definitions:  []
			}
		}
	},
	resolve: 'alias'
};

export const flowrConfigFileSchema = Joi.object({
	ignoreSourceCalls: Joi.boolean().optional().description('Whether source calls should be ignored, causing {@link processSourceCall}\'s behavior to be skipped.'),
	rPath:             Joi.string().optional().description('The path to the R executable to use. If this is undefined, this uses the default path.'),
	semantics:         Joi.object({
		environment: Joi.object({
			overwriteBuiltIns: Joi.object({
				loadDefaults: Joi.boolean().optional().description('Should the default configuration still be loaded?'),
				definitions:  Joi.array().items(Joi.object()).optional().description('The definitions to load/overwrite.')
			}).optional().description('Do you want to overwrite (parts) of the builtin definition?')
		}).optional().description('Semantics regarding the handlings of the environment.')
	}).description('Configure language semantics and how flowR handles them.')
}).description('The configuration file format for flowR.');

// we don't load from a config file at all by default unless setConfigFile is called
let configFile: string | undefined = undefined;
let configWorkingDirectory = process.cwd();
let currentConfig: FlowrConfigOptions | undefined = undefined;

export function setConfigFile(file: string | undefined, workingDirectory = process.cwd(), forceLoad = false) {
	configFile = file;
	configWorkingDirectory = workingDirectory;

	// reset the config so it gets reloaded
	currentConfig = undefined;
	if(forceLoad) {
		getConfig();
	}
}

export function parseConfig(jsonString: string): FlowrConfigOptions | undefined {
	try {
		const parsed = JSON.parse(jsonString) as FlowrConfigOptions;
		const validate = flowrConfigFileSchema.validate(parsed);
		if(!validate.error) {
			// assign default values to all config options except for the specified ones
			return deepMergeObject(defaultConfigOptions, parsed);
		} else {
			log.error(`Failed to validate config ${jsonString}: ${validate.error.message}`);
			return undefined;
		}
	} catch(e) {
		log.error(`Failed to parse config ${jsonString}: ${(e as Error).message}`);
	}
}

export function setConfig(config: FlowrConfigOptions) {
	currentConfig = config;
}

export function getConfig(): FlowrConfigOptions {
	// lazy-load the config based on the current settings
	if(currentConfig === undefined) {
		setConfig(loadConfigFromFile(configFile, configWorkingDirectory));
	}
	return currentConfig as FlowrConfigOptions;
}

function loadConfigFromFile(configFile: string | undefined, workingDirectory: string): FlowrConfigOptions {
	if(configFile !== undefined) {
		let searchPath = path.resolve(workingDirectory);
		do{
			const configPath = path.join(searchPath, configFile);
			if(fs.existsSync(configPath)) {
				log.trace(`Found config at ${configPath}`);
				const ret = parseConfig(fs.readFileSync(configPath,{ encoding: 'utf-8' }));
				if(ret) {
					log.info(`Using config ${JSON.stringify(ret)}`);
					return ret;
				}
			}
			// move up to parent directory
			searchPath = getParentDirectory(searchPath);
		} while(fs.existsSync(searchPath));
	}

	log.info(`Using default config ${JSON.stringify(defaultConfigOptions)}`);
	return defaultConfigOptions;
}
