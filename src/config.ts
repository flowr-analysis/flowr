import { type MergeableRecord,
	deepMergeObject,
	deepClonePreserveUnclonable,
	isPlainObject
} from './util/objects';
import path from 'path';
import fs from 'fs';
import { log } from './util/log';
import { getParentDirectory } from './util/files';
import Joi from 'joi';
import type { BuiltInDefinitions } from './dataflow/environments/built-in-config';
import type { KnownParser } from './r-bridge/parser';
import type { DeepPartial, DeepWritable, Paths, PathValue } from 'ts-essentials';
import type { DataflowProcessors } from './dataflow/processor';
import type { ParentInformation } from './r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrAnalyzerContext } from './project/context/flowr-analyzer-context';
import { ProjectKind } from './project/context/project-kind';
import objectPath from 'object-path';
import type { BuiltInFlowrPluginArgs, BuiltInFlowrPluginName } from './project/plugins/plugin-registry';
import { type FlowrGasConfig, GasWikiRef } from './gas';

export enum VariableResolve {
	/** Don't resolve constants at all */
	Disabled = 'disabled',
	/** Use alias tracking to resolve */
	Alias = 'alias',
	/** Only resolve directly assigned builtin constants */
	Builtin = 'builtin'
}

/**
 * How a constrained dependency (e.g. `Imports: quantmod (>= 0.4-9)`) is resolved to a concrete version
 * against the signature database (see `solver.sigdb.versionSelection`).
 */
export enum VersionSelection {
	/** Resolve to the newest version satisfying the constraint (default; preserves the historic behavior). */
	Newest = 'newest',
	/** Resolve to the oldest version satisfying the constraint. */
	Oldest = 'oldest',
	/** Resolve to the version installed on the analyzing system (needs R; falls back to `newest` when unavailable). */
	System = 'system'
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
	/** Assume a sourced file is always there, making what it defines certain instead of conditional on the `source` call. */
	readonly assumeFilesExist?:     boolean
}

export type ConfigPlugin<T extends BuiltInFlowrPluginName | string> =
	T | string | (T extends BuiltInFlowrPluginName ? [T, BuiltInFlowrPluginArgs<T>] : [string, unknown[]]);

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
	/**
	 * Whether load calls should be ignored, causing {@link processLoadCall}'s behavior to be skipped
	 */
	readonly ignoreLoadCalls:   boolean
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
	},
	/** Plugins to load by default when creating a new FlowrAnalyzer */
	readonly defaultPlugins: ConfigPlugin<string>[]
	/** Configuration options for the REPL */
	readonly repl: {
		/** Whether to show quick stats in the REPL after each evaluation */
		quickStats:           boolean
		/** This instruments the dataflow processors to count how often each processor is called */
		dfProcessorHeat:      boolean;
		/** Whether to show dim inline hints (e.g. `:help`) on the empty prompt; automatically disabled on non-interactive terminals */
		hints:                boolean;
		/** Plugins to load in REPL mode */
		plugins:              (ConfigPlugin<string> | 'flowr:default')[]
		/** Automatically use the file protocol for inputs that look like paths (default `true`) */
		autoUseFileProtocol?: boolean
		/** Whether `:query` closes with the line stating how long the queries took (default `true`, `:query*` never prints it) */
		queryStats?:          boolean
	}
	readonly project: {
		/** Whether to resolve unknown paths loaded by the r project disk when trying to source/analyze files */
		resolveUnknownPathsOnDisk: boolean
		/**
		 * The packages considered part of R itself, used e.g. by the project query to classify dependencies. If
		 * unset, flowR derives them (for the assumed R version) from the signature database via `baseRPackages`.
		 */
		basePackages?:             string[]
		/**
		 * Files a framework loads on its own, without any `source()` call (e.g. `global.R` in a shiny app), in load
		 * order. Entries are case-insensitive globs (`R/*.R`) matched against the path, a plain name matches any file
		 * with that name; entries matching nothing are warned about. Usually set per {@link ProjectKind} via
		 * {@link FlowrConfig.specializeConfig}.
		 */
		implicitSources?:          string[]
	}
	/**
	 * Overwrite (parts of) this configuration depending on the {@link ProjectKind} flowR detects for the project,
	 * e.g. to give a shiny app its implicit sources. Resolve it with {@link FlowrConfig.forKind}.
	 */
	readonly specializeConfig?: Partial<Record<ProjectKind, DeepPartial<FlowrConfig>>>
	/**
	 * The engines to use for interacting with R code. Currently, supports {@link TreeSitterEngineConfig} and {@link RShellEngineConfig}.
	 * An empty array means all available engines will be used.
	 */
	readonly engines:           EngineConfig[]
	/**
	 * The default engine to use for interacting with R code. If this is undefined, an arbitrary engine from {@link engines} will be used.
	 */
	readonly defaultEngine?:    EngineConfig['type'];
	/** How to resolve constants, constraints, cells, … */
	readonly solver: {
		/**
		 * How to resolve variables and their values
		 */
		readonly variables:         VariableResolve,
		/**
		 * Should we include eval(parse(text="...")) calls in the dataflow graph?
		 */
		readonly evalStrings:       boolean,
		/**
		 * Track user-created environments (`new.env()`, `assign(..., envir=e)`, `get(..., envir=e)`,
		 * `local({}, envir=e)`, `e$x <- v`, `attach(e)`) with precise per-variable envState.
		 * When disabled all envir-style calls fall through to the conservative global treatment.
		 */
		readonly trackEnvironments: boolean
		/** Resolving `library()`/`use()` exports from a signature database (e.g. the bundled `flowr-sigdb`). */
		readonly sigdb: {
			/** Resolve library exports from a package database (default `true`); when `false` no database is consulted. */
			readonly enabled:                     boolean
			/** Load the project's declared dependencies from its metadata files (`DESCRIPTION` Imports/Depends, `rproject.toml`, `renv.lock`, `rv.lock`) into the dependency context (default `true`); when `false` these files are not read, so neither the undefined-symbol linter nor {@link linkDescriptionDependencies} sees any project-declared dependency. */
			readonly loadProjectDependencies:     boolean
			/** Parse the database up front rather than on the first package load (default `false`, ignored if disabled). */
			readonly eagerlyLoad:                 boolean
			/** Add a vertex for every export on load rather than on demand (default `false`); keeps the graph small. */
			readonly eagerlyLoadExports:          boolean
			/**
			 * The R version analysis assumes when resolving versioned (base-R) package exports: a pin like `"4.5"`,
			 * or `"auto"` to detect the locally installed R (falling back to {@link DefaultAssumedRVersion} when the
			 * engine reports none, e.g. the tree-sitter engine). Resolve it with {@link resolveAssumedRVersion}.
			 */
			readonly assumedRVersion?:            string
			/** Eagerly attach base-R namespaces (from a signature database) so bare base calls resolve without `library()` (default `false`; changes every analysis; needs a base-R signature database). */
			readonly linkBaseR:                   boolean
			/** Eagerly attach the namespaces of the project's declared `DESCRIPTION` dependencies (Imports/Depends) so their exports resolve without an explicit `library()` (default `false`; changes every analysis; needs a signature database resolving the declared packages). */
			readonly linkDescriptionDependencies: boolean
			/** Add a lightweight `Reads` edge from a bare base-R call to its signature-database function vertex (`built-in:pkg:fn`); base-R qualification stays edge-free unless this is on (default `false`; adds edges to every base call). */
			readonly linkBaseRCalls?:             boolean
			/** Add a lightweight `Reads` edge from a resolved package call (`pkg::fn`/attached export) to its signature-database function vertex (default `false`). */
			readonly linkPackageCalls?:           boolean
			/** Decompress the hot shards (base + most-downloaded) in a background task on startup, so the first `library()` lookup is warm (default `false`; useful for long-running servers/REPLs, not one-shot runs). */
			readonly warmInBackground?:           boolean
			/** Extra directories (or bundle/manifest files) searched for signature databases, alongside the shipped default and `$FLOWR_SIGDB_DIR`. A downloaded full-history bundle placed here is mounted automatically. */
			readonly additionalPaths?:            string[]
			/** GitHub `owner/repo` the full-history bundle is downloaded from (`:signature download`); default `flowr-analysis/flowr`, release tag `sigdb-v<flowR-version>`. */
			readonly downloadRepo?:               string
			/** On startup, compare the cache against the committed `sigdb.remote.json` link file and re-download changed shards in the background (default `false`; needs network, so opt-in — a `git pull` that updates the pointer then re-syncs automatically). */
			readonly autoSync?:                   boolean
			/** When a project constrains a dependency, resolve to the `newest` (default) or `oldest` version satisfying the constraint, or the `system`-installed version (needs R; falls back to `newest` when unavailable). Base-R packages always resolve against the assumed R version. */
			readonly versionSelection?:           VersionSelection
			/** Force an exact version for specific packages (mapping a package name to a version), overriding both the project constraint and the {@link versionSelection} policy; a version missing from the database falls back with a warning (default `{}`). */
			readonly versionOverrides?:           Record<string, string>
		}
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
	/**
	 * Resource-usage guard (gas) configuration.
	 * Gas checks are disabled by default (all feature factors are `0`).
	 * Set a `feature factor > 0` to enable checking for that feature.
	 * @see {@link FlowrGasConfig}
	 * @see {@link ReadOnlyFlowrAnalyzerGasContext}
	 */
	readonly gas: FlowrGasConfig;
}

export type ValidFlowrConfigPaths = Paths<FlowrConfig, { depth: 9 }>;

/** Whether library exports should be resolved from a signature database (`solver.sigdb.enabled`). */
export function isSigDbEnabled(config: FlowrConfig | undefined): boolean {
	return config?.solver.sigdb.enabled === true;
}

/**
 * R version assumed for analysis when `solver.sigdb.assumedRVersion` is `"auto"` and none could be detected.
 * Kept in step with the newest base-R release in the bundled sigdb (see `newestRVersion` in the generated
 * base-package cache) so the default hits the precomputed base-package fast path.
 */
export const DefaultAssumedRVersion = '4.5.3';

/**
 * The R version analysis should assume when resolving versioned (base-R) exports (see `solver.sigdb.assumedRVersion`):
 * an explicit pin wins, otherwise a real `detected` version (from the engine's `rVersion()`, ignoring `none`/`unknown`),
 * otherwise {@link DefaultAssumedRVersion}. Pure and synchronous, so a resolver can call it per lookup.
 */
export function resolveAssumedRVersion(config: FlowrConfig | undefined, detected?: string): string {
	const assumed = config?.solver.sigdb.assumedRVersion;
	if(assumed && assumed !== 'auto') {
		return assumed;
	}
	if(detected && detected !== 'none' && detected !== 'unknown') {
		return detected;
	}
	return DefaultAssumedRVersion;
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
export type KnownEngines = { [T in EngineConfig['type']]?: KnownParser };

const defaultEngineConfigs: { [T in EngineConfig['type']]: EngineConfig & { type: T } } = {
	'tree-sitter': { type: 'tree-sitter' },
	'r-shell':     { type: 'r-shell' }
};

export const FlowrDefaultPlugins = [
	'file:description',
	'versions:description',
	'versions:sigdb',
	'versions:renv',
	'versions:rv',
	'loading-order:description',
	'loading-order:implicit-sources',
	'meta:description',
	'meta:rproject',
	'files:vignette',
	'files:test',
	'files:inst',
	'file:rmd',
	'file:qmd',
	'file:rnw',
	'file:ipynb',
	'file:namespace',
	'file:news',
	'file:license',
	'file:virtualenv',
	'file:rproject',
] satisfies ConfigPlugin<string>[];

/**
 * Applies `overwrite` to `current`, key by key, keeping every value that differs from `base`: only a value nobody
 * configured is left to the overwrite. An array is replaced, never appended to.
 */
function specialize(current: unknown, base: unknown, overwrite: unknown): unknown {
	if(overwrite === undefined) {
		return current;
	} else if(isPlainObject(current) && isPlainObject(overwrite)) {
		const result: Record<string, unknown> = { ...current };
		for(const [key, value] of Object.entries(overwrite)) {
			result[key] = specialize(current[key], isPlainObject(base) ? base[key] : undefined, value);
		}
		return result;
	}
	return JSON.stringify(current) === JSON.stringify(base) ? overwrite : current;
}

export const FlowrConfig = {
	name: 'FlowrConfig',
	/**
	 * The default configuration for flowR, used when no config file is found or when a config file is missing some options.
	 * You can use this as a base for your own config and only specify the options you want to change.
	 */
	default(this: void): FlowrConfig {
		return {
			ignoreSourceCalls: false,
			ignoreLoadCalls:   false,
			semantics:         {
				environment: {
					overwriteBuiltIns: {
						loadDefaults: true,
						definitions:  []
					}
				}
			},
			defaultPlugins: FlowrDefaultPlugins,
			repl:           {
				quickStats:          false,
				dfProcessorHeat:     false,
				hints:               true,
				plugins:             ['flowr:default'],
				autoUseFileProtocol: true,
				queryStats:          true,
			},
			project: {
				resolveUnknownPathsOnDisk: true
			},
			/* shiny loads global.R first, then the ui/server pair, and app.R last as it wires them together */
			specializeConfig: {
				/* these ship the files they source, a notebook or a loose script may not */
				[ProjectKind.Package]:  { solver: { resolveSource: { assumeFilesExist: true } } },
				[ProjectKind.Project]:  { solver: { resolveSource: { assumeFilesExist: true } } },
				[ProjectKind.ShinyApp]: {
					project: { implicitSources: ['global.R', 'ui.R', 'server.R', 'app.R'] },
					solver:  { resolveSource: { assumeFilesExist: true } }
				}
			},
			engines:       [],
			defaultEngine: 'tree-sitter',
			solver:        {
				variables:         VariableResolve.Alias,
				evalStrings:       true,
				trackEnvironments: true,
				sigdb:             { enabled: true, loadProjectDependencies: true, eagerlyLoad: false, eagerlyLoadExports: false, assumedRVersion: 'auto', linkBaseR: false, linkDescriptionDependencies: false, linkBaseRCalls: false, linkPackageCalls: false, warmInBackground: false, additionalPaths: [], autoSync: false, versionSelection: VersionSelection.Newest, versionOverrides: {} },
				resolveSource:     {
					dropPaths:             DropPathsOption.No,
					ignoreCapitalization:  true,
					inferWorkingDirectory: InferWorkingDirectory.ActiveScript,
					searchPath:            [],
					repeatedSourceLimit:   2,
					assumeFilesExist:      false
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
			},
			gas: {
				thresholds: {
					memory: { problematic: 0.7,       critical: 0.9 },
					timeMs: { problematic: 100_000,   critical: 120_000 }
				},
				features: {}
			}
		};
	},
	/**
	 * The Joi schema for validating a config file, use this to validate your config file before using it. You can also use this to generate documentation for the config file format.
	 */
	Schema: Joi.object({
		ignoreSourceCalls: Joi.boolean().optional().description('Whether source calls should be ignored, causing {@link processSourceCall}\'s behavior to be skipped.'),
		ignoreLoadCalls:   Joi.boolean().optional().description('Whether load calls should be ignored, causing {@link processLoadCall}\'s behavior to be skipped.'),
		semantics:         Joi.object({
			environment: Joi.object({
				overwriteBuiltIns: Joi.object({
					loadDefaults: Joi.boolean().optional().description('Should the default configuration still be loaded?'),
					definitions:  Joi.array().items(Joi.object()).optional().description('The definitions to load/overwrite.')
				}).optional().description('Do you want to overwrite (parts) of the builtin definition?')
			}).optional().description('Semantics regarding how to handle the R environment.')
		}).description('Configure language semantics and how flowR handles them.'),
		defaultPlugins: Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.array().ordered(Joi.string(), Joi.array().items(Joi.any())).length(2))).optional().description('The default plugins to load when creating a new instance of FlowrAnalyzer'),
		repl:           Joi.object({
			quickStats:          Joi.boolean().optional().description('Whether to show quick stats in the REPL after each evaluation.'),
			dfProcessorHeat:     Joi.boolean().optional().description('This instruments the dataflow processors to count how often each processor is called.'),
			hints:               Joi.boolean().optional().description('Whether to show dim inline hints on the empty prompt (automatically disabled on non-interactive terminals).'),
			plugins:             Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.array().ordered(Joi.string(), Joi.array().items(Joi.any())).length(2))).optional().description('The plugins to load in REPL mode'),
			autoUseFileProtocol: Joi.boolean().optional().description('Prepend the file protocol to a repl input that looks like a path, instead of only warning about it.'),
			queryStats:          Joi.boolean().optional().description('Whether `:query` closes with the line stating how long the queries took (`:query*` never prints it).')
		}).description('Configuration options for the REPL.'),
		project: Joi.object({
			resolveUnknownPathsOnDisk: Joi.boolean().optional().description('Whether to resolve unknown paths loaded by the r project disk when trying to source/analyze files.'),
			basePackages:              Joi.array().items(Joi.string()).optional().description('The packages considered part of R itself (base and recommended); if unset, flowR uses its built-in list.'),
			implicitSources:           Joi.array().items(Joi.string()).optional().description('Files a framework loads on its own, without any source() call (e.g. global.R in a shiny app), in the order they are loaded; flowR orders the matching project files accordingly and analyzes them as one program. Entries are case-insensitive globs matched against the file path, a plain name matches any file with that name, and entries matching no project file are warned about. Usually set per project kind via specializeConfig.')
		}).description('Project specific configuration options.'),
		specializeConfig: Joi.object().pattern(Joi.string().valid(...Object.values(ProjectKind)), Joi.object()).optional()
			.description('Overwrite (parts of) the configuration depending on the project kind flowR detects, e.g. to give a shiny app its implicit sources.'),
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
			variables:         Joi.string().valid(...Object.values(VariableResolve)).description('How to resolve variables and their values.'),
			evalStrings:       Joi.boolean().description('Should we include eval(parse(text="...")) calls in the dataflow graph?'),
			trackEnvironments: Joi.boolean().optional().description('Track user-created environments (new.env, assign/get/local with envir=, dollar-assign, attach). When false, all envir-style calls fall through conservatively.'),
			sigdb:             Joi.object({
				enabled:                     Joi.boolean().optional().description('Resolve library()/use() exports from a signature database (default true); when false no database is consulted.'),
				loadProjectDependencies:     Joi.boolean().optional().description('Load the project\'s declared dependencies from its metadata files (DESCRIPTION Imports/Depends, rproject.toml, renv.lock, rv.lock) (default true); when false these files are not read for dependencies.'),
				eagerlyLoad:                 Joi.boolean().optional().description('Parse the database up front rather than on the first package load (default false, ignored if disabled).'),
				eagerlyLoadExports:          Joi.boolean().optional().description('Add a vertex for every export on load rather than on demand (default false); keeps the dataflow graph small.'),
				assumedRVersion:             Joi.string().optional().description('R version assumed when resolving versioned (base-R) exports: a pin like "4.5" or "auto" to detect the installed R (default "auto").'),
				linkBaseR:                   Joi.boolean().optional().description('Eagerly attach base-R namespaces so bare base calls resolve without library() (default false).'),
				linkBaseRCalls:              Joi.boolean().optional().description('Add a lightweight Reads edge from a bare base-R call to its signature-database function vertex (default false; base-R qualification is edge-free otherwise).'),
				linkPackageCalls:            Joi.boolean().optional().description('Add a lightweight Reads edge from a resolved package call to its signature-database function vertex (default false).'),
				linkDescriptionDependencies: Joi.boolean().optional().description('Eagerly attach the namespaces of the project\'s declared DESCRIPTION dependencies (Imports/Depends) so their exports resolve without an explicit library() (default false).'),
				warmInBackground:            Joi.boolean().optional().description('Decompress the hot shards (base + most-downloaded) in a background task on startup so the first library() lookup is warm (default false; for long-running servers/REPLs).'),
				additionalPaths:             Joi.array().items(Joi.string()).optional().description('Extra directories or bundle/manifest files searched for signature databases (alongside the shipped default and $FLOWR_SIGDB_DIR); a downloaded full-history bundle placed here is mounted automatically.'),
				downloadRepo:                Joi.string().optional().description('GitHub owner/repo the full-history bundle is downloaded from via ":signature download" (default "flowr-analysis/flowr", release tag "sigdb-v<flowR-version>").'),
				autoSync:                    Joi.boolean().optional().description('On startup, re-download shards whose committed sigdb.remote.json hash no longer matches the cache, in the background (default false; opt-in network sync after a git pull).'),
				versionSelection:            Joi.string().valid(...Object.values(VersionSelection)).optional().description('When a project constrains a dependency, resolve to the newest (default), oldest, or system-installed version satisfying it; system needs R and falls back to newest. Base-R packages always resolve against the assumed R version.'),
				versionOverrides:            Joi.object().pattern(Joi.string(), Joi.string()).optional().description('Force an exact version for specific packages (name -> version), overriding both the project constraint and the versionSelection policy (default {}).')
			}).description('Resolving library exports from a signature database.'),
			instrument: Joi.object({
				dataflowExtractors: Joi.any().optional().description('These keys are only intended for use within code, allowing to instrument the dataflow analyzer!')
			}),
			resolveSource: Joi.object({
				dropPaths:             Joi.string().valid(...Object.values(DropPathsOption)).description('Allow to drop the first or all parts of the sourced path, if it is relative.'),
				ignoreCapitalization:  Joi.boolean().description('Search for filenames matching in the lowercase.'),
				inferWorkingDirectory: Joi.string().valid(...Object.values(InferWorkingDirectory)).description('Try to infer the working directory from the main or any script to analyze.'),
				searchPath:            Joi.array().items(Joi.string()).description('Additionally search in these paths.'),
				repeatedSourceLimit:   Joi.number().optional().description('How often the same file can be sourced within a single run? Please be aware: in case of cyclic sources this may not reach a fixpoint so give this a sensible limit.'),
				applyReplacements:     Joi.array().items(Joi.object()).description('Provide name replacements for loaded files'),
				assumeFilesExist:      Joi.boolean().optional().description('Assume a sourced file is always there, making what it defines certain instead of conditional on the source call.')
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
		}).description('The configuration options for abstract interpretation.'),
		gas: Joi.object({
			thresholds: Joi.object({
				memory: Joi.object({
					problematic: Joi.number().min(0).max(1).optional().description('Heap fraction (0-1) above which Problematic is returned.'),
					critical:    Joi.number().min(0).max(1).optional().description('Heap fraction (0-1) above which Critical is returned.')
				}).optional().description('Heap-usage fraction thresholds (0-1).'),
				timeMs: Joi.object({
					problematic: Joi.number().min(0).optional().description('Elapsed ms above which Problematic is returned.'),
					critical:    Joi.number().min(0).optional().description('Elapsed ms above which Critical is returned.')
				}).optional().description('Elapsed analysis time thresholds in milliseconds.')
			}).optional().description('Shared thresholds for all gas checks (scaled by per-feature factor).'),
			features:     Joi.object().pattern(Joi.string(), Joi.number().min(0).optional()).optional().description('Per-feature sensitivity factors. 0 or absent disables gas checking for that feature. A factor of 2 makes the feature twice as sensitive. Recognised keys: `source`, `side-effect-linking`, `linter`.'),
			heapProvider: Joi.function().optional().description('Custom heap statistics source (programmatic configs only), overriding the built-in v8/performance.memory detection.')
		}).optional().description(`Resource-usage guard (gas) configuration. All feature factors default to 0 (disabled). See ${GasWikiRef}.`)
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
	 * Resolves the configuration for the given {@link ProjectKind} by applying the matching
	 * {@link FlowrConfig.specializeConfig} entry to every key it names. What you configured wins over the entry, which in
	 * turn wins over flowR's default; a value that differs from the default counts as configured.
	 * Returns `config` itself if the kind has no entry, so callers can use this freely.
	 */
	forKind(this: void, config: FlowrConfig, kind: ProjectKind): FlowrConfig {
		const overwrite = config.specializeConfig?.[kind];
		return overwrite ? specialize(config, FlowrConfig.default(), overwrite) as FlowrConfig : config;
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
	},
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
