import {
	FlowrAnalyzerFilesContext,
	type RAnalysisRequest,
	type ReadOnlyFlowrAnalyzerFilesContext
} from './flowr-analyzer-files-context';
import {
	FlowrAnalyzerDependenciesContext,
	type ReadOnlyFlowrAnalyzerDependenciesContext
} from './flowr-analyzer-dependencies-context';
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
import type { ReadOnlyFlowrAnalyzerFunctionsContext } from './flowr-analyzer-functions-context';
import { FlowrAnalyzerFunctionsContext } from './flowr-analyzer-functions-context';
import { arraysGroupBy } from '../../util/collections/arrays';
import type { fileProtocol, RParseRequestFromFile, RParseRequests } from '../../r-bridge/retriever';
import { requestFromInput } from '../../r-bridge/retriever';
import type { FlowrConfigOptions } from '../../config';
import { defaultConfigOptions } from '../../config';
import type { FlowrFileProvider } from './flowr-file';
import { FlowrInlineTextFile } from './flowr-file';

/**
 * This is a read-only interface to the {@link FlowrAnalyzerContext}.
 * It prevents you from modifying the context, but allows you to inspect it (which is probably what you want when using the {@link FlowrAnalyzer}).
 * If you are a {@link FlowrAnalyzerPlugin} and want to modify the context, you can use the {@link FlowrAnalyzerContext} directly.
 */
export interface ReadOnlyFlowrAnalyzerContext {
	/**
	 * The files context provides access to the files to be analyzed and their loading order.
	 */
	readonly files:  ReadOnlyFlowrAnalyzerFilesContext;
	/**
	 * The dependencies context provides access to the identified dependencies and their versions.
	 */
	readonly deps:   ReadOnlyFlowrAnalyzerDependenciesContext;
	/**
	 * The configuration options used by the analyzer.
	 */
	readonly config: FlowrConfigOptions;

	readonly functions: ReadOnlyFlowrAnalyzerFunctionsContext;
}

/**
 * This summarizes the other context layers used by the {@link FlowrAnalyzer}.
 * Have a look at the attributes and layers listed below (e.g., {@link files} and {@link deps})
 * to get an idea of the capabilities provided by this context.
 * Besides these, this layer only orchestrates the different steps and layers, providing a collection of convenience methods alongside the
 * {@link resolvePreAnalysis} method that conducts all the steps that can be done before the main analysis run.
 * In general, you do not have to worry about these details, as the {@link FlowrAnalyzerBuilder} and {@link FlowrAnalyzer} take care of them.
 *
 * To inspect, e.g., the loading order, you can do so via {@link files.loadingOrder.getLoadingOrder}. To get information on a specific library, use
 * {@link deps.getDependency}.
 * If you are just interested in inspecting the context, you can use {@link ReadOnlyFlowrAnalyzerContext} instead (e.g., via {@link inspect}).
 */
export class FlowrAnalyzerContext implements ReadOnlyFlowrAnalyzerContext {
	public readonly files:     FlowrAnalyzerFilesContext;
	public readonly deps:      FlowrAnalyzerDependenciesContext;
	public readonly config:    FlowrConfigOptions;
	public readonly functions: FlowrAnalyzerFunctionsContext;


	constructor(config: FlowrConfigOptions, plugins: ReadonlyMap<PluginType, readonly FlowrAnalyzerPlugin[]>) {
		this.config = config;
		const loadingOrder = new FlowrAnalyzerLoadingOrderContext(this, plugins.get(PluginType.LoadingOrder) as FlowrAnalyzerLoadingOrderPlugin[]);
		this.files = new FlowrAnalyzerFilesContext(loadingOrder, (plugins.get(PluginType.ProjectDiscovery) ?? []) as FlowrAnalyzerProjectDiscoveryPlugin[],
            (plugins.get(PluginType.FileLoad) ?? []) as FlowrAnalyzerFilePlugin[]);
		this.deps  = new FlowrAnalyzerDependenciesContext(this, (plugins.get(PluginType.DependencyIdentification) ?? []) as FlowrAnalyzerPackageVersionsPlugin[]);
		this.functions = new FlowrAnalyzerFunctionsContext(this, (plugins.get(PluginType.DependencyIdentification) ?? []) as FlowrAnalyzerPackageVersionsPlugin[]);
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

	/** this conducts all the step that can be done before the main analysis run */
	public resolvePreAnalysis(): void {
		this.files.computeLoadingOrder();
		this.deps.resolveStaticDependencies();
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
	 * Reset the context to its initial state, removing all files, dependencies, and loading orders.
	 */
	public reset(): void {
		this.files.reset();
		this.deps.reset();
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
	config = defaultConfigOptions,
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
	config = defaultConfigOptions,
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