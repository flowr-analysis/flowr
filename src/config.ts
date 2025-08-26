import type { MergeableRecord } from './util/objects';
import { deepMergeObject } from './util/objects';
import path from 'path';
import fs from 'fs';
import { log } from './util/log';
import { getParentDirectory } from './util/files';
import Joi from 'joi';
import type { BuiltInDefinitions } from './dataflow/environments/built-in-config';
import type { KnownParser } from './r-bridge/parser';
import type { DeepWritable } from 'ts-essentials';

export enum VariableResolve {
	/** Don't resolve constants at all */
	Disabled = 'disabled',
	/** Use alias tracking to resolve */
	Alias = 'alias',
	/** Only resolve directly assigned builtin constants */
	Builtin = 'builtin'
}

/**
 * How to infer the working directory from a script
 */
export enum InferWorkingDirectory {
	/** Don't infer the working directory */
	No = 'no',
	/** Infer the working directory from the main script */
	MainScript = 'main-script',
	/** Infer the working directory from the active script */
	ActiveScript = 'active-script',
	/** Infer the working directory from any script */
	AnyScript = 'any-script'
}

/**
 * How to handle fixed strings in a source path
 */
export enum DropPathsOption {
	/** Don't drop any parts of the sourced path */
	No = 'no',
	/** try to drop everything but the filename */
	Once = 'once',
	/** try to drop every folder of the path */
	All = 'all'
}

export interface FlowrLaxSourcingOptions extends MergeableRecord {
	/**
	 * search for filenames matching in the lowercase
	 */
	readonly ignoreCapitalization:  boolean
	/**
	 * try to infer the working directory from the main or any script to analyze.
	 */
	readonly inferWorkingDirectory: InferWorkingDirectory
	/**
	 * Additionally search in these paths
	 */
	readonly searchPath:            string[]
	/**
	 * Allow to drop the first or all parts of the sourced path,
	 * if it is relative.
	 */
	readonly dropPaths:             DropPathsOption
	/**
	 * How often the same file can be sourced within a single run?
	 * Please be aware: in case of cyclic sources this may not reach a fixpoint so give this a sensible limit.
	 */
	readonly repeatedSourceLimit?:  number
	/**
	 * sometimes files may have a different name in the source call	(e.g., due to later replacements),
	 * with this setting you can provide a list of replacements to apply for each sourced file.
	 * Every replacement consists of a record that maps a regex to a replacement string.
	 *
	 * @example
	 * ```ts
	 * [
	 *      { }, // no replacement -> still try the original name/path
	 *      { '.*\\.R$': 'main.R' }, // replace all .R files with main.R
	 *      { '\s' : '_' }, // replace all spaces with underscores
	 *      { '\s' : '-', 'oo': 'aa' }, // replace all spaces with dashes and oo with aa
	 * ]
	 * ```
	 *
	 * Given a `source("foo bar.R")` this configuration will search for (in this order):
	 * - `foo bar.R` (original name)
	 * - `main.R` (replaced with main.R)
	 * - `foo_bar.R` (replaced spaces)
	 * - `faa-bar.R` (replaced spaces and oo)
	 */
	readonly applyReplacements?:    Record<string, string>[]
}

export interface FlowrConfigOptions extends MergeableRecord {
	/**
	 * Whether source calls should be ignored, causing {@link processSourceCall}'s behavior to be skipped
	 */
	readonly ignoreSourceCalls: boolean
	/** Configure language semantics and how flowR handles them */
	readonly semantics: {
		/** Semantics regarding the handling of the environment */
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
	readonly engines:        EngineConfig[]
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
		 * Should we include eval(parse(text="...")) calls in the dataflow graph?
		 */
		readonly evalStrings:     boolean
		/**
		 * Whether to track pointers in the dataflow graph,
		 * if not, the graph will be over-approximated wrt.
		 * containers and accesses
		 */
		readonly pointerTracking: boolean | {
			/**
			 * The maximum number of indices tracked per obj with the pointer analysis (currently this focuses on initialization)
			 */
			readonly maxIndexCount: number
		},
		/**
		 * If lax source calls are active, flowR searches for sourced files much more freely,
		 * based on the configurations you give it.
		 * This option is only in effect if {@link ignoreSourceCalls} is set to false.
		 */
		readonly resolveSource?: FlowrLaxSourcingOptions,
		/**
		 * The configuration for flowR's slicer
		 */
		slicer?: {
			/**
			 * The maximum number of iterations to perform on a single function call during slicing
			 */
			readonly threshold?: number
		}
	}
	/**
	 * Configuration options for abstract interpretation
	 */
	readonly abstractInterpretation: {
		/**
		 * The configuration of the shape inference for data frames
		 */
		readonly dataFrame: {
			/**
			 * The maximum number of columns names to infer for data frames before over-approximating the column names to top
			 */
			readonly maxColNames:       number;
			/**
			 * The threshold for the number of visitations of a node at which widening should be performed to ensure the termination of the fixpoint iteration
			 */
			readonly wideningThreshold: number;
			/**
			 * Configuration options for reading data frame shapes from loaded external data files, such as CSV files
			 */
			readonly readLoadedData: {
				/**
				 * Whether data frame shapes should be extracted from loaded external data files, such as CSV files
				 */
				readonly readExternalFiles: boolean;
				/**
				 * The maximum number of lines to read when extracting data frame shapes from loaded files, such as CSV files
				 */
				readonly maxReadLines:      number;
			}
		},

		/**
		 * The configuration of the string domain
		 */
		readonly string: {
			readonly domain: 'const' | 'const-set',
		},
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
	readonly lax?:                boolean
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
	defaultEngine: 'tree-sitter',
	solver:        {
		variables:       VariableResolve.Alias,
		evalStrings:     true,
		pointerTracking: false,
		resolveSource:   {
			dropPaths:             DropPathsOption.No,
			ignoreCapitalization:  true,
			inferWorkingDirectory: InferWorkingDirectory.ActiveScript,
			searchPath:            [],
			repeatedSourceLimit:   2
		},
		slicer: {
			threshold: 50
		}
	},
	abstractInterpretation: {
		dataFrame: {
			maxColNames:       50,
			wideningThreshold: 4,
			readLoadedData:    {
				readExternalFiles: true,
				maxReadLines:      1e6
			}
		},
		string: {
			domain: 'const-set',
		},
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
		}).optional().description('Semantics regarding how to handle the R environment.')
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
		evalStrings:     Joi.boolean().description('Should we include eval(parse(text="...")) calls in the dataflow graph?'),
		pointerTracking: Joi.alternatives(
			Joi.boolean(),
			Joi.object({
				maxIndexCount: Joi.number().required().description('The maximum number of indices tracked per object with the pointer analysis.')
			})
		).description('Whether to track pointers in the dataflow graph, if not, the graph will be over-approximated wrt. containers and accesses.'),
		resolveSource: Joi.object({
			dropPaths:             Joi.string().valid(...Object.values(DropPathsOption)).description('Allow to drop the first or all parts of the sourced path, if it is relative.'),
			ignoreCapitalization:  Joi.boolean().description('Search for filenames matching in the lowercase.'),
			inferWorkingDirectory: Joi.string().valid(...Object.values(InferWorkingDirectory)).description('Try to infer the working directory from the main or any script to analyze.'),
			searchPath:            Joi.array().items(Joi.string()).description('Additionally search in these paths.'),
			repeatedSourceLimit:   Joi.number().optional().description('How often the same file can be sourced within a single run? Please be aware: in case of cyclic sources this may not reach a fixpoint so give this a sensible limit.'),
			applyReplacements:     Joi.array().items(Joi.object()).description('Provide name replacements for loaded files')
		}).optional().description('If lax source calls are active, flowR searches for sourced files much more freely, based on the configurations you give it. This option is only in effect if `ignoreSourceCalls` is set to false.'),
		slicer: Joi.object({
			threshold: Joi.number().optional().description('The maximum number of iterations to perform on a single function call during slicing.')
		}).optional().description('The configuration for the slicer.')
	}).description('How to resolve constants, constraints, cells, ...'),
	abstractInterpretation: Joi.object({
		dataFrame: Joi.object({
			maxColNames:       Joi.number().min(0).description('The maximum number of columns names to infer for data frames before over-approximating the column names to top.'),
			wideningThreshold: Joi.number().min(1).description('The threshold for the number of visitations of a node at which widening should be performed to ensure the termination of the fixpoint iteration.'),
			readLoadedData:    Joi.object({
				readExternalFiles: Joi.boolean().description('Whether data frame shapes should be extracted from loaded external files, such as CSV files.'),
				maxReadLines:      Joi.number().min(1).description('The maximum number of lines to read when extracting data frame shapes from loaded files, such as CSV files.')
			}).description('Configuration options for reading data frame shapes from loaded external data files, such as CSV files.')
		}).description('The configuration of the shape inference for data frames.'),
		string: Joi.object({
			domain: Joi.allow('const', 'const-set').description('The concrete string domain to be used during analysis')
		}).description('The configuration of the string domain.')
	}).description('The configuration options for abstract interpretation.')
}).description('The configuration file format for flowR.');

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

/**
 * Creates a new flowr config that has the updated values.
 */
export function amendConfig(config: FlowrConfigOptions, amendmentFunc: (config: DeepWritable<FlowrConfigOptions>) => FlowrConfigOptions) {
	return amendmentFunc(cloneConfig(config) as DeepWritable<FlowrConfigOptions>);
}

export function cloneConfig(config: FlowrConfigOptions): FlowrConfigOptions {
	return JSON.parse(JSON.stringify(config)) as FlowrConfigOptions;
}

export function getConfig(configFile?: string, configWorkingDirectory = process.cwd()): FlowrConfigOptions {
	try {
		return loadConfigFromFile(configFile, configWorkingDirectory);
	} catch(e) {
		log.error(`Failed to load config: ${(e as Error).message}`);
		return defaultConfigOptions;
	}
}

export function getEngineConfig<T extends EngineConfig['type']>(config: FlowrConfigOptions, engine: T): EngineConfig & { type: T } | undefined {
	const engines = config.engines;
	if(!engines.length) {
		return defaultEngineConfigs[engine];
	} else {
		return engines.find(e => e.type == engine) as EngineConfig & { type: T } | undefined;
	}
}

function getPointerAnalysisThreshold(config: FlowrConfigOptions): number | 'unlimited' | 'disabled' {
	const pointerTracking = config.solver.pointerTracking;
	if(typeof pointerTracking === 'object') {
		return pointerTracking.maxIndexCount;
	} else {
		return pointerTracking ? 'unlimited' : 'disabled';
	}
}

export function isOverPointerAnalysisThreshold(config: FlowrConfigOptions, count: number): boolean {
	const threshold = getPointerAnalysisThreshold(config);
	return threshold !== 'unlimited' && (threshold === 'disabled' || count > threshold);
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
