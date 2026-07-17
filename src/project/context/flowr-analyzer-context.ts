import {
	FlowrAnalyzerFilesContext,
	type RAnalysisRequest,
	type ReadOnlyFlowrAnalyzerFilesContext
} from './flowr-analyzer-files-context';
import type { ProjectKind } from './project-kind';
import {
	FlowrAnalyzerDependenciesContext,
	type ReadOnlyFlowrAnalyzerDependenciesContext
} from './flowr-analyzer-dependencies-context';
import type { Range } from 'semver';
import { type FlowrAnalyzerPlugin, PluginType } from '../plugins/flowr-analyzer-plugin';
import { FlowrAnalyzerLoadingOrderContext } from './flowr-analyzer-loading-order-context';
import type {
	FlowrAnalyzerLoadingOrderPlugin
} from '../plugins/loading-order-plugins/flowr-analyzer-loading-order-plugin';
import type {
	FlowrAnalyzerPackageVersionsPlugin
} from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';
import type {
	FlowrAnalyzerProjectDiscoveryPlugin
} from '../plugins/project-discovery/flowr-analyzer-project-discovery-plugin';
import type { FlowrAnalyzerFilePlugin } from '../plugins/file-plugins/flowr-analyzer-file-plugin';
import { FlowrAnalyzerFunctionsContext } from './flowr-analyzer-functions-context';
import { arraysGroupBy } from '../../util/collections/arrays';
import type { fileProtocol, RParseRequestFromFile, RParseRequests } from '../../r-bridge/retriever';
import { requestFromInput } from '../../r-bridge/retriever';
import { FlowrConfig, resolveAssumedRVersion } from '../../config';
import type { FlowrFileProvider } from './flowr-file';
import { FlowrInlineTextFile } from './flowr-file';
import type { ReadOnlyFlowrAnalyzerEnvironmentContext } from './flowr-analyzer-environment-context';
import { FlowrAnalyzerEnvironmentContext } from './flowr-analyzer-environment-context';
import type { ReadOnlyFlowrAnalyzerMetaContext } from './flowr-analyzer-meta-context';
import { FlowrAnalyzerMetaContext } from './flowr-analyzer-meta-context';
import type { FlowrAnalyzer } from '../flowr-analyzer';
import {
	FlowrAnalyzerGasContext,
	type ReadOnlyFlowrAnalyzerGasContext
} from './flowr-analyzer-gas-context';
import type { FlowrAnalyzerGasPlugin } from '../plugins/gas-plugins/flowr-analyzer-gas-plugin';

/**
 * This is a read-only interface to the {@link FlowrAnalyzerContext}.
 * It prevents you from modifying the context, but allows you to inspect it (which is probably what you want when using the {@link FlowrAnalyzer}).
 * If you are a {@link FlowrAnalyzerPlugin} and want to modify the context, you can use the {@link FlowrAnalyzerContext} directly.
 */
export interface ReadOnlyFlowrAnalyzerContext {
	/** Project metadata such as name, version, and namespace. */
	readonly meta:             ReadOnlyFlowrAnalyzerMetaContext;
	/** Files to be analyzed and their loading order. */
	readonly files:            ReadOnlyFlowrAnalyzerFilesContext;
	/** Identified dependencies and their versions. */
	readonly deps:             ReadOnlyFlowrAnalyzerDependenciesContext;
	/** Environment information used during analysis. */
	readonly env:              ReadOnlyFlowrAnalyzerEnvironmentContext;
	/** The configuration options used by the analyzer. */
	readonly config:           FlowrConfig;
	/** The R version analysis assumes when resolving versioned (base-R) exports (see `solver.sigdb.assumedRVersion`). */
	readonly resolvedRVersion: string;
	/** Classify the {@link ProjectKind} of the project, see {@link ReadOnlyFlowrAnalyzerFilesContext#projectKind}. */
	projectKind(): ProjectKind;
	/** The versions a dependency can possibly have, see {@link ReadOnlyFlowrAnalyzerDependenciesContext#inferredVersion}. */
	inferredVersion(name: string): Range | undefined;
	/**
	 * Resource-usage guard (gas).
	 * Call `ctx.gas.checkGas(key)` at expensive analysis sites to obtain the current pressure level.
	 * Returns `GasLevel.Normal` with zero overhead when gas is disabled for `key`.
	 * @see {@link ReadOnlyFlowrAnalyzerGasContext}
	 */
	readonly gas:              ReadOnlyFlowrAnalyzerGasContext;
}

/**
 * This summarizes the other context layers used by the {@link FlowrAnalyzer}.
 * Have a look at the attributes and layers listed below (e.g., {@link files} and {@link deps})
 * to get an idea of the capabilities provided by this context.
 * Besides these, this layer only orchestrates the different steps and layers, providing a collection of convenience methods.
 * In general, you do not have to worry about these details, as the {@link FlowrAnalyzerBuilder} and {@link FlowrAnalyzer} take care of them.
 *
 * To inspect, e.g., the loading order, you can do so via {@link files.loadingOrder.getLoadingOrder}. To get information on a specific library, use
 * {@link deps.getDependency}.
 * If you are just interested in inspecting the context, you can use {@link ReadOnlyFlowrAnalyzerContext} instead (e.g., via {@link inspect}).
 */
export class FlowrAnalyzerContext implements ReadOnlyFlowrAnalyzerContext {
	public readonly meta:  FlowrAnalyzerMetaContext;
	public readonly files: FlowrAnalyzerFilesContext;
	public readonly deps:  FlowrAnalyzerDependenciesContext;
	public readonly env:   FlowrAnalyzerEnvironmentContext;
	public readonly gas:   FlowrAnalyzerGasContext;
	private _analyzer:     FlowrAnalyzer | undefined;
	/** an auto-detected R version (from the engine), recorded once at the analyzer boundary; see {@link resolvedRVersion} */
	private _detectedR:    string | undefined;

	/** the configuration as given, i.e. before {@link FlowrConfig.specializeConfig} is applied */
	public readonly baseConfig: FlowrConfig;
	/** {@link baseConfig}, specialized for {@link _configKind} */
	private _config:            FlowrConfig;
	/** the {@link ProjectKind} {@link _config} holds, `undefined` as long as it has to be resolved */
	private _configKind:        ProjectKind | undefined;
	/** set while classifying, as the classification must not read the config it decides, see {@link kindToSpecializeFor} */
	private _classifying = false;

	/**
	 * {@link baseConfig} with the {@link FlowrConfig.specializeConfig} of the project's {@link ProjectKind} applied
	 * (see {@link FlowrConfig.forKind}), resolved once per kind.
	 */
	public get config(): FlowrConfig {
		if(this.baseConfig.specializeConfig === undefined || this._classifying) {
			return this.baseConfig;
		}
		const kind = this.kindToSpecializeFor();
		if(this._configKind !== kind) {
			this._configKind = kind;
			this._config = FlowrConfig.forKind(this.baseConfig, kind);
		}
		return this._config;
	}

	/** {@link projectKind}, resolved with {@link baseConfig}, as classifying the project reads the config again */
	private kindToSpecializeFor(): ProjectKind {
		this._classifying = true;
		try {
			return this.projectKind();
		} finally {
			this._classifying = false;
		}
	}

	constructor(config: FlowrConfig, plugins: ReadonlyMap<PluginType, readonly FlowrAnalyzerPlugin[]>) {
		this.baseConfig = config;
		this._config = config;
		const loadingOrder = new FlowrAnalyzerLoadingOrderContext(this, plugins.get(PluginType.LoadingOrder) as FlowrAnalyzerLoadingOrderPlugin[]);
		this.files = new FlowrAnalyzerFilesContext(loadingOrder, (plugins.get(PluginType.ProjectDiscovery) ?? []) as FlowrAnalyzerProjectDiscoveryPlugin[],
			(plugins.get(PluginType.FileLoad) ?? []) as FlowrAnalyzerFilePlugin[]);
		this.env   = new FlowrAnalyzerEnvironmentContext(this);
		const functions = new FlowrAnalyzerFunctionsContext(this);
		this.deps  = new FlowrAnalyzerDependenciesContext(functions, (plugins.get(PluginType.DependencyIdentification) ?? []) as FlowrAnalyzerPackageVersionsPlugin[]);
		// the plugins contributing the metadata are the ones the dependency context runs on demand
		this.meta = new FlowrAnalyzerMetaContext(() => this.deps.ensureStaticsLoaded());
		this.gas  = new FlowrAnalyzerGasContext(this, config.gas, (plugins.get(PluginType.Gas) ?? []) as FlowrAnalyzerGasPlugin[]);
	}

	/**
	 * Provides the analyzer associated with this context, if any.
	 * This is usually set when the context is used within an analyzer instance.
	 * Please note, that this may be `undefined` if the context is used standalone (e.g., during setup or in plugins that do not have access to the analyzer).
	 */
	get analyzer(): FlowrAnalyzer | undefined {
		return this._analyzer;
	}

	setAnalyzer(analyzer: FlowrAnalyzer) {
		this._analyzer = analyzer;
	}

	/** Record the engine's auto-detected R version (used when `solver.sigdb.assumedRVersion` is `"auto"`). */
	public setDetectedRVersion(version: string): void {
		this._detectedR = version;
	}

	/** The R version analysis assumes when resolving versioned (base-R) exports (see {@link resolveAssumedRVersion}). */
	public get resolvedRVersion(): string {
		return resolveAssumedRVersion(this.config, this._detectedR);
	}

	/** Classify the {@link ProjectKind} of the project (delegates to the cached {@link FlowrAnalyzerFilesContext#projectKind}). */
	public projectKind(): ProjectKind {
		return this.files.projectKind();
	}

	/** The versions a dependency can possibly have (delegates to {@link FlowrAnalyzerDependenciesContext#inferredVersion}). */
	public inferredVersion(name: string): Range | undefined {
		return this.deps.inferredVersion(name);
	}

	/** delegate request addition */
	public addRequests(requests: readonly RAnalysisRequest[]): void {
		this.files.addRequests(requests);
	}

	public addFile(f: string | FlowrFileProvider | RParseRequestFromFile): void {
		this.files.addFile(f);
	}

	public addFiles(f: (string | FlowrFileProvider | RParseRequestFromFile)[]): void {
		this.files.addFiles(f);
	}

	/**
	 * Get a read-only version of this context.
	 * This is useful if you want to pass the context to a place where you do not want it to be modified or just to reduce
	 * the available methods.
	 */
	public inspect(): ReadOnlyFlowrAnalyzerContext {
		return this as ReadOnlyFlowrAnalyzerContext;
	}

	/**
	 * Reset the context to its initial state, e.g., removing all files, dependencies, and loading orders.
	 */
	public reset(): void {
		this.files.reset();
		this.deps.reset();
		this.meta.reset();
		this.gas.reset();
	}
}

/**
 * Lifting {@link requestFromInput} to create a full {@link FlowrAnalyzerContext} from input requests.
 * Please use this only for a "quick" setup, or to have compatibility with the pre-project flowR era.
 * Otherwise, refer to a {@link FlowrAnalyzerBuilder} to create a fully customized {@link FlowrAnalyzer} instance.
 * @see {@link requestFromInput} - for details on how inputs are processed into requests.
 * @see {@link contextFromSources} - to create a context from source code strings directly.
 */
export function contextFromInput(
	input: `${typeof fileProtocol}${string}` | string | readonly string[] | RParseRequests,
	config = FlowrConfig.default(),
	plugins?: FlowrAnalyzerPlugin[],
): FlowrAnalyzerContext {
	const context = new FlowrAnalyzerContext(
		config,
		arraysGroupBy(plugins ?? [], (p) => p.type)
	);
	if(typeof input === 'string' || Array.isArray(input) && input.every(i => typeof i === 'string')) {
		const requests = requestFromInput(input);
		context.addRequests(Array.isArray(requests) ? requests : [requests] );
	} else {
		const requests: RParseRequests = Array.isArray(input) ? input : [input];
		context.addRequests(requests);
	}
	return context;
}

/**
 * Create a {@link FlowrAnalyzerContext} from a set of source code strings.
 * @param sources - A record mapping file paths to their source code content.
 * @param config  - Configuration options for the analyzer.
 * @param plugins - Optional plugins to extend the analyzer's functionality.
 * @see {@link contextFromInput}    - to create a context from input requests.
 * @see {@link FlowrInlineTextFile} - to create inline text files for the sources.
 */
export function contextFromSources(
	sources: Record<string, string>,
	config = FlowrConfig.default(),
	plugins?: FlowrAnalyzerPlugin[],
): FlowrAnalyzerContext {
	const context = new FlowrAnalyzerContext(
		config,
		arraysGroupBy(plugins ?? [], (p) => p.type)
	);

	for(const [p, c] of Object.entries(sources)) {
		context.addFile(new FlowrInlineTextFile(p, c));
	}

	return context;
}
