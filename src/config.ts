import type { MergeableRecord } from './util/objects';
import { deepMergeObject } from './util/objects';
import path from 'path';
import fs from 'fs';
import { log } from './util/log';
import { getParentDirectory } from './util/files';
import Joi from 'joi';
import type { BuiltInDefinitions } from './dataflow/environments/built-in-config';
import type { KnownParser } from './r-bridge/parser';

export enum VariableResolve {
	/** Don't resolve constants at all */
	Disabled = 'disabled',
	/** Use alias tracking to resolve */
	Alias = 'alias',
	/** Only resolve directly assigned builtin constants */
	Builtin = 'builtin'
}

export interface FlowrConfigOptions extends MergeableRecord {
	/**
	 * Whether source calls should be ignored, causing {@link processSourceCall}'s behavior to be skipped
	 */
	readonly ignoreSourceCalls: boolean
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
	 * The engines to use for interacting with R code. Currently, supports {@link TreeSitterEngineConfig} and {@link RShellEngineConfig}.
	 * An empty array means all available engines will be used.
	 */
	readonly engines:        readonly EngineConfig[]
	/**
	 * The default engine to use for interacting with R code. If this is undefined, an arbitrary engine from {@link engines} will be used.
	 */
	readonly defaultEngine?: EngineConfig['type'];
	/** How to resolve constants, constraints, cells, … */
	readonly solver: {
		/**
		 * How to resolve variables and their values
		 */
		readonly variables:       VariableResolve,
		/**
		 * Whether to track pointers in the dataflow graph,
		 * if not, the graph will be over-approximated wrt.
		 * containers and accesses
		 */
		readonly pointerTracking: boolean
	}

}

export interface TreeSitterEngineConfig extends MergeableRecord {
	readonly type:                'tree-sitter'
	/**
	 * The path to the tree-sitter-r WASM binary to use. If this is undefined, {@link DEFAULT_TREE_SITTER_R_WASM_PATH} will be used.
	 */
	readonly wasmPath?:           string
	/**
	 * The path to the tree-sitter WASM binary to use. If this is undefined, the path specified by the tree-sitter package will be used.
	 */
	readonly treeSitterWasmPath?: string
	/**
	 * Whether to use the lax parser for parsing R code (allowing for syntax errors). If this is undefined, the strict parser will be used.
	 */
	readonly lax?:				            boolean
}

export interface RShellEngineConfig extends MergeableRecord {
	readonly type:   'r-shell'
	/**
	 * The path to the R executable to use. If this is undefined, {@link DEFAULT_R_PATH} will be used.
	 */
	readonly rPath?: string
}

export type EngineConfig = TreeSitterEngineConfig | RShellEngineConfig;
export type KnownEngines = { [T in EngineConfig['type']]?: KnownParser }

const defaultEngineConfigs: { [T in EngineConfig['type']]: EngineConfig & { type: T } } = {
	'tree-sitter': { type: 'tree-sitter' },
	'r-shell':     { type: 'r-shell' }
};

export const defaultConfigOptions: FlowrConfigOptions = {
	ignoreSourceCalls: false,
	semantics:         {
		environment: {
			overwriteBuiltIns: {
				loadDefaults: true,
				definitions:  []
			}
		}
	},
	engines:       [],
	defaultEngine: 'r-shell',
	solver:        {
		variables:       VariableResolve.Alias,
		pointerTracking: true
	}
};

export const flowrConfigFileSchema = Joi.object({
	ignoreSourceCalls: Joi.boolean().optional().description('Whether source calls should be ignored, causing {@link processSourceCall}\'s behavior to be skipped.'),
	semantics:         Joi.object({
		environment: Joi.object({
			overwriteBuiltIns: Joi.object({
				loadDefaults: Joi.boolean().optional().description('Should the default configuration still be loaded?'),
				definitions:  Joi.array().items(Joi.object()).optional().description('The definitions to load/overwrite.')
			}).optional().description('Do you want to overwrite (parts) of the builtin definition?')
		}).optional().description('Semantics regarding the handlings of the environment.')
	}).description('Configure language semantics and how flowR handles them.'),
	engines: Joi.array().items(Joi.alternatives(
		Joi.object({
			type:               Joi.string().required().valid('tree-sitter').description('Use the tree sitter engine.'),
			wasmPath:           Joi.string().optional().description('The path to the tree-sitter-r WASM binary to use. If this is undefined, this uses the default path.'),
			treeSitterWasmPath: Joi.string().optional().description('The path to the tree-sitter WASM binary to use. If this is undefined, this uses the default path.'),
			lax:                Joi.boolean().optional().description('Whether to use the lax parser for parsing R code (allowing for syntax errors). If this is undefined, the strict parser will be used.')
		}).description('The configuration for the tree sitter engine.'),
		Joi.object({
			type:  Joi.string().required().valid('r-shell').description('Use the R shell engine.'),
			rPath: Joi.string().optional().description('The path to the R executable to use. If this is undefined, this uses the default path.')
		}).description('The configuration for the R shell engine.')
	)).min(1).description('The engine or set of engines to use for interacting with R code. An empty array means all available engines will be used.'),
	defaultEngine: Joi.string().optional().valid('tree-sitter', 'r-shell').description('The default engine to use for interacting with R code. If this is undefined, an arbitrary engine from the specified list will be used.'),
	solver:        Joi.object({
		variables:       Joi.string().valid(...Object.values(VariableResolve)).description('How to resolve variables and their values.'),
		pointerTracking: Joi.boolean().description('Whether to track pointers in the dataflow graph, if not, the graph will be over-approximated wrt. containers and accesses.')
	}).description('How to resolve constants, constraints, cells, ...')
}).description('The configuration file format for flowR.');

// we don't load from a config file at all by default unless setConfigFile is called
let configFile: string | undefined                = undefined;
let configWorkingDirectory                        = process.cwd();
let currentConfig: FlowrConfigOptions | undefined = undefined;

export function setConfigFile(file: string | undefined, workingDirectory = process.cwd(), forceLoad = false) {
	configFile             = file;
	configWorkingDirectory = workingDirectory;

	// reset the config so it gets reloaded
	currentConfig = undefined;
	if(forceLoad) {
		getConfig();
	}
}

export function parseConfig(jsonString: string): FlowrConfigOptions | undefined {
	try {
		const parsed   = JSON.parse(jsonString) as FlowrConfigOptions;
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

export function amendConfig(amendment: Partial<FlowrConfigOptions>) {
	setConfig(deepMergeObject(getConfig(), amendment));
	log.trace(`Amending config with ${JSON.stringify(amendment)}, resulting in ${JSON.stringify(getConfig())}}`);
}

export function getConfig(): FlowrConfigOptions {
	// lazy-load the config based on the current settings
	if(currentConfig === undefined) {
		try {
			setConfig(loadConfigFromFile(configFile, configWorkingDirectory));
		} catch(e) {
			log.error(`Failed to load config: ${(e as Error).message}`);
			setConfig(defaultConfigOptions);
		}
	}
	return currentConfig as FlowrConfigOptions;
}

export function getEngineConfig<T extends EngineConfig['type']>(engine: T): EngineConfig & { type: T } | undefined {
	const config = getConfig().engines;
	if(!config.length) {
		return defaultEngineConfigs[engine];
	} else {
		return config.find(e => e.type == engine) as EngineConfig & { type: T } | undefined;
	}
}

function loadConfigFromFile(configFile: string | undefined, workingDirectory: string): FlowrConfigOptions {
	if(configFile !== undefined) {
		if(path.isAbsolute(configFile) && fs.existsSync(configFile)) {
			log.trace(`Found config at ${configFile} (absolute)`);
			const ret = parseConfig(fs.readFileSync(configFile, { encoding: 'utf-8' }));
			if(ret) {
				log.info(`Using config ${JSON.stringify(ret)}`);
				return ret;
			}
		}
		let searchPath = path.resolve(workingDirectory);
		do{
			const configPath = path.join(searchPath, configFile);
			if(fs.existsSync(configPath)) {
				log.trace(`Found config at ${configPath}`);
				const ret = parseConfig(fs.readFileSync(configPath, { encoding: 'utf-8' }));
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
