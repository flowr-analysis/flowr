import type { RAnalysisRequest, ReadOnlyFlowrAnalyzerFilesContext } from './flowr-analyzer-files-context';
import { FlowrAnalyzerFilesContext } from './flowr-analyzer-files-context';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from './flowr-analyzer-dependencies-context';
import { FlowrAnalyzerDependenciesContext } from './flowr-analyzer-dependencies-context';
import type { FlowrAnalyzerPlugin } from '../plugins/flowr-analyzer-plugin';
import { PluginType } from '../plugins/flowr-analyzer-plugin';
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

/**
 * This is a read-only interface to the {@link FlowrAnalyzerContext}.
 * It prevents you from modifying the context, but allows you to inspect it (which is probably what you want when using the {@link FlowrAnalyzer}).
 * If you are a {@link FlowrAnalyzerPlugin} and want to modify the context, you can use the {@link FlowrAnalyzerContext} directly.
 */
export interface ReadOnlyFlowrAnalyzerContext {
	/**
	 * The files context provides access to the files to be analyzed and their loading order.
	 */
	readonly files: ReadOnlyFlowrAnalyzerFilesContext;
	/**
	 * The dependencies context provides access to the identified dependencies and their versions.
	 */
	readonly deps:  ReadOnlyFlowrAnalyzerDependenciesContext;
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
export class FlowrAnalyzerContext implements ReadOnlyFlowrAnalyzerContext{
	public readonly files: FlowrAnalyzerFilesContext;
	public readonly deps:  FlowrAnalyzerDependenciesContext;

	constructor(plugins: ReadonlyMap<PluginType, readonly FlowrAnalyzerPlugin[]>) {
		const loadingOrder = new FlowrAnalyzerLoadingOrderContext(this, plugins.get(PluginType.LoadingOrder) as FlowrAnalyzerLoadingOrderPlugin[]);
		this.files = new FlowrAnalyzerFilesContext(loadingOrder, (plugins.get(PluginType.ProjectDiscovery) ?? []) as FlowrAnalyzerProjectDiscoveryPlugin[],
            (plugins.get(PluginType.FileLoad) ?? []) as FlowrAnalyzerFilePlugin[]);
		this.deps  = new FlowrAnalyzerDependenciesContext(this, (plugins.get(PluginType.DependencyIdentification) ?? []) as FlowrAnalyzerPackageVersionsPlugin[]);
	}

	/** delegate request addition */
	public addRequests(requests: readonly RAnalysisRequest[]): void {
		this.files.addRequests(requests);
	}

	/** delegate request addition */
	public addRequest(request: RAnalysisRequest): void {
		this.files.addRequest(request);
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
}