import { type MergeableRecord,
	deepMergeObject,
	deepClonePreserveUnclonable
} from './util/objects';
import path from 'path';
import fs from 'fs';
import { log } from './util/log';
import { getParentDirectory } from './util/files';
import Joi from 'joi';
import type { BuiltInDefinitions } from './dataflow/environments/built-in-config';
import type { KnownParser } from './r-bridge/parser';
import type { DeepWritable, Paths, PathValue } from 'ts-essentials';
import type { DataflowProcessors } from './dataflow/processor';
import type { ParentInformation } from './r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrAnalyzerContext } from './project/context/flowr-analyzer-context';
import objectPath from 'object-path';

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
	 * sometimes files may have a different name in the source call (e.g., due to later replacements),
	 * with this setting you can provide a list of replacements to apply for each sourced file.
	 * Every replacement consists of a record that maps a regex to a replacement string.
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

/**
 * The configuration file format for flowR.
 * @see {@link FlowrConfig.default} for the default configuration.
 * @see {@link FlowrConfig.Schema} for the Joi schema for validation.
 */
export interface FlowrConfig extends MergeableRecord {
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
	/** Configuration options for the REPL */
	readonly repl: {
		/** Whether to show quick stats in the REPL after each evaluation */
		quickStats:      boolean
		/** This instruments the dataflow processors to count how often each processor is called */
		dfProcessorHeat: boolean;
	}
	readonly project: {
		/** Whether to resolve unknown paths loaded by the r project disk when trying to source/analyze files */
		resolveUnknownPathsOnDisk: boolean
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
		readonly variables:   VariableResolve,
		/**
		 * Should we include eval(parse(text="...")) calls in the dataflow graph?
		 */
		readonly evalStrings: boolean
		/** These keys are only intended for use within code, allowing to instrument the dataflow analyzer! */
		readonly instrument: {
			/**
			 * Modify the dataflow processors used during dataflow analysis.
			 * Make sure that all processors required for correct analysis are still present!
			 * This may have arbitrary consequences on the analysis precision and performance, consider focusing on decorating existing processors instead of replacing them.
			 */
			dataflowExtractors?: (extractor: DataflowProcessors<ParentInformation>, ctx: FlowrAnalyzerContext) => DataflowProcessors<ParentInformation>
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
			readonly threshold?:  number
			/**
			 * If set, the slicer will gain an additional post-pass
			 */
			readonly autoExtend?: boolean
		}
	}
	/**
	 * Configuration options for abstract interpretation
	 */
	readonly abstractInterpretation: {
		/**
		 * The threshold for the number of visitations of a node at which widening should be performed to ensure the termination of the fixpoint iteration
		 */
		readonly wideningThreshold: number;
		/**
		 * The configuration of the shape inference for data frames
		 */
		readonly dataFrame: {
			/**
			 * The maximum number of columns names to infer for data frames before over-approximating the column names to top
			 */
			readonly maxColNames:    number;
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
		}
	}
}

export type ValidFlowrConfigPaths = Paths<FlowrConfig, { depth: 9 }>;

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
export type KnownEngines = { [T in EngineConfig['type']]?: KnownParser };

const defaultEngineConfigs: { [T in EngineConfig['type']]: EngineConfig & { type: T } } = {
	'tree-sitter': { type: 'tree-sitter' },
	'r-shell':     { type: 'r-shell' }
};

/**
 * Helper Object to work with {@link FlowrConfig}, provides the default config and the Joi schema for validation.
 */
export const FlowrConfig = {
	name: 'FlowrConfig',
	/**
	 * The default configuration for flowR, used when no config file is found or when a config file is missing some options.
	 * You can use this as a base for your own config and only specify the options you want to change.
	 */
	default(this: void): FlowrConfig {
		return {
			ignoreSourceCalls: false,
			semantics:         {
				environment: {
					overwriteBuiltIns: {
						loadDefaults: true,
						definitions:  []
					}
				}
			},
			repl: {
				quickStats:      false,
				dfProcessorHeat: false
			},
			project: {
				resolveUnknownPathsOnDisk: true
			},
			engines:       [],
			defaultEngine: 'tree-sitter',
			solver:        {
				variables:     VariableResolve.Alias,
				evalStrings:   true,
				resolveSource: {
					dropPaths:             DropPathsOption.No,
					ignoreCapitalization:  true,
					inferWorkingDirectory: InferWorkingDirectory.ActiveScript,
					searchPath:            [],
					repeatedSourceLimit:   2
				},
				instrument: {
					dataflowExtractors: undefined
				},
				slicer: {
					threshold:  50,
					autoExtend: false
				}
			},
			abstractInterpretation: {
				wideningThreshold: 4,
				dataFrame:         {
					maxColNames:    50,
					readLoadedData: {
						readExternalFiles: true,
						maxReadLines:      1e6
					}
				}
			}
		};
	},
	/**
	 * The Joi schema for validating a config file, use this to validate your config file before using it. You can also use this to generate documentation for the config file format.
	 */
	Schema: Joi.object({
		ignoreSourceCalls: Joi.boolean().optional().description('Whether source calls should be ignored, causing {@link processSourceCall}\'s behavior to be skipped.'),
		semantics:         Joi.object({
			environment: Joi.object({
				overwriteBuiltIns: Joi.object({
					loadDefaults: Joi.boolean().optional().description('Should the default configuration still be loaded?'),
					definitions:  Joi.array().items(Joi.object()).optional().description('The definitions to load/overwrite.')
				}).optional().description('Do you want to overwrite (parts) of the builtin definition?')
			}).optional().description('Semantics regarding how to handle the R environment.')
		}).description('Configure language semantics and how flowR handles them.'),
		repl: Joi.object({
			quickStats:      Joi.boolean().optional().description('Whether to show quick stats in the REPL after each evaluation.'),
			dfProcessorHeat: Joi.boolean().optional().description('This instruments the dataflow processors to count how often each processor is called.')
		}).description('Configuration options for the REPL.'),
		project: Joi.object({
			resolveUnknownPathsOnDisk: Joi.boolean().optional().description('Whether to resolve unknown paths loaded by the r project disk when trying to source/analyze files.')
		}).description('Project specific configuration options.'),
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
		)).description('The engine or set of engines to use for interacting with R code. An empty array means all available engines will be used.'),
		defaultEngine: Joi.string().optional().valid('tree-sitter', 'r-shell').description('The default engine to use for interacting with R code. If this is undefined, an arbitrary engine from the specified list will be used.'),
		solver:        Joi.object({
			variables:   Joi.string().valid(...Object.values(VariableResolve)).description('How to resolve variables and their values.'),
			evalStrings: Joi.boolean().description('Should we include eval(parse(text="...")) calls in the dataflow graph?'),
			instrument:  Joi.object({
				dataflowExtractors: Joi.any().optional().description('These keys are only intended for use within code, allowing to instrument the dataflow analyzer!')
			}),
			resolveSource: Joi.object({
				dropPaths:             Joi.string().valid(...Object.values(DropPathsOption)).description('Allow to drop the first or all parts of the sourced path, if it is relative.'),
				ignoreCapitalization:  Joi.boolean().description('Search for filenames matching in the lowercase.'),
				inferWorkingDirectory: Joi.string().valid(...Object.values(InferWorkingDirectory)).description('Try to infer the working directory from the main or any script to analyze.'),
				searchPath:            Joi.array().items(Joi.string()).description('Additionally search in these paths.'),
				repeatedSourceLimit:   Joi.number().optional().description('How often the same file can be sourced within a single run? Please be aware: in case of cyclic sources this may not reach a fixpoint so give this a sensible limit.'),
				applyReplacements:     Joi.array().items(Joi.object()).description('Provide name replacements for loaded files')
			}).optional().description('If lax source calls are active, flowR searches for sourced files much more freely, based on the configurations you give it. This option is only in effect if `ignoreSourceCalls` is set to false.'),
			slicer: Joi.object({
				threshold:  Joi.number().optional().description('The maximum number of iterations to perform on a single function call during slicing.'),
				autoExtend: Joi.boolean().optional().description('If set, the slicer will gain an additional post-pass.')
			}).optional().description('The configuration for the slicer.')
		}).description('How to resolve constants, constraints, cells, ...'),
		abstractInterpretation: Joi.object({
			wideningThreshold: Joi.number().min(1).description('The threshold for the number of visitations of a node at which widening should be performed to ensure the termination of the fixpoint iteration.'),
			dataFrame:         Joi.object({
				maxColNames:    Joi.number().min(0).description('The maximum number of columns names to infer for data frames before over-approximating the column names to top.'),
				readLoadedData: Joi.object({
					readExternalFiles: Joi.boolean().description('Whether data frame shapes should be extracted from loaded external files, such as CSV files.'),
					maxReadLines:      Joi.number().min(1).description('The maximum number of lines to read when extracting data frame shapes from loaded files, such as CSV files.')
				}).description('Configuration options for reading data frame shapes from loaded external data files, such as CSV files.')
			}).description('The configuration of the shape inference for data frames.')
		}).description('The configuration options for abstract interpretation.')
	}).description('The configuration file format for flowR.'),
	/**
	 * Parses the given JSON string as a flowR config file, returning the resulting config object if the parsing and validation were successful, or `undefined` if there was an error.
	 */
	parse(this: void, jsonString: string): FlowrConfig | undefined {
		try {
			const parsed   = JSON.parse(jsonString) as FlowrConfig;
			const validate = FlowrConfig.Schema.validate(parsed);
			if(!validate.error) {
				// assign default values to all config options except for the specified ones
				return deepMergeObject(FlowrConfig.default(), parsed);
			} else {
				log.error(`Failed to validate config ${jsonString}: ${validate.error.message}`);
				return undefined;
			}
		} catch(e) {
			log.error(`Failed to parse config ${jsonString}: ${(e as Error).message}`);
		}
	},
	/**
	 * Creates a new flowr config that has the updated values.
	 */
	// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
	amend(this: void, config: FlowrConfig, amendmentFunc: (config: DeepWritable<FlowrConfig>) => FlowrConfig | void): FlowrConfig {
		const newConfig = FlowrConfig.clone(config);
		return amendmentFunc(newConfig as DeepWritable<FlowrConfig>) ?? newConfig;
	},
	/**
	 * Clones the given flowr config object.
	 */
	clone(this: void, config: FlowrConfig): FlowrConfig {
		return deepClonePreserveUnclonable(config);
	},
	/**
	 * Loads the flowr config from the given file or the default locations.
	 * Please note that you can also use this without a path parameter to
	 * infer the config from flowR's default locations.
	 * This is mostly useful for user-facing features.
	 */
	fromFile(this: void, configFile?: string, configWorkingDirectory = process.cwd()): FlowrConfig {
		try {
			return loadConfigFromFile(configFile, configWorkingDirectory);
		} catch(e) {
			log.error(`Failed to load config: ${(e as Error).message}`);
			return FlowrConfig.default();
		}
	},
	/**
	 * Gets the configuration for the given engine type from the config.
	 */
	getForEngine<T extends EngineConfig['type']>(this: void, config: FlowrConfig, engine: T): EngineConfig & { type: T } | undefined {
		const engines = config.engines;
		if(engines.length > 0) {
			return engines.find(e => e.type === engine) as EngineConfig & { type: T } | undefined;
		} else {
			return defaultEngineConfigs[engine];
		}
	},
	/**
	 * Returns a new config object with the given value set at the given key, where the key is a dot-separated path to the value in the config object.
	 * @see {@link setInConfigInPlace} for a version that modifies the config object in place instead of returning a new one.
	 * @example
	 * ```ts
	 * const config = FlowrConfig.default();
	 * const newConfig = FlowrConfig.setInConfig(config, 'solver.variables', VariableResolve.Builtin);
	 * console.log(config.solver.variables); // Output: "alias"
	 * console.log(newConfig.solver.variables); // Output: "builtin"
	 * ```
	 */
	setInConfig<Path extends ValidFlowrConfigPaths>(this: void, config: FlowrConfig, key: Path, value: PathValue<FlowrConfig, Path>): FlowrConfig {
		const clone = FlowrConfig.clone(config);
		objectPath.set(clone, key, value);
		return clone;
	},
	/**
	 * Modifies the given config object in place by setting the given value at the given key, where the key is a dot-separated path to the value in the config object.
	 * @see {@link setInConfig} for a version that returns a new config object instead of modifying the given one in place.
	 */
	setInConfigInPlace<Path extends ValidFlowrConfigPaths>(this: void, config: FlowrConfig, key: Path, value: PathValue<FlowrConfig, Path>): void {
		objectPath.set(config, key, value);
	}
} as const;

function loadConfigFromFile(configFile: string | undefined, workingDirectory: string): FlowrConfig {
	if(configFile !== undefined) {
		if(path.isAbsolute(configFile) && fs.existsSync(configFile)) {
			log.trace(`Found config at ${configFile} (absolute)`);
			const ret = FlowrConfig.parse(fs.readFileSync(configFile, { encoding: 'utf-8' }));
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
				const ret = FlowrConfig.parse(fs.readFileSync(configPath, { encoding: 'utf-8' }));
				if(ret) {
					log.info(`Using config ${JSON.stringify(ret)}`);
					return ret;
				}
			}
			// move up to parent directory
			searchPath = getParentDirectory(searchPath);
		} while(fs.existsSync(searchPath));
	}

	log.info('Using default config');
	return FlowrConfig.default();
}
