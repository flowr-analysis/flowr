import type { RAnalysisRequest } from './flowr-analyzer-files-context';
import { FlowrAnalyzerFilesContext } from './flowr-analyzer-files-context';
import { FlowrAnalyzerDependenciesContext } from './flowr-analyzer-dependencies-context';
import type { FlowrAnalyzerPlugin } from '../plugins/flowr-analyzer-plugin';
import { PluginType } from '../plugins/flowr-analyzer-plugin';
import { FlowrAnalyzerLoadingOrderContext } from './flowr-analyzer-loading-order-context';
import type { FlowrAnalyzerLoadingOrderPlugin } from '../plugins/loading-order-plugins/flowr-analyzer-loading-order-plugin';
import type {
	FlowrAnalyzerPackageVersionsPlugin
} from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';

/** This summarizes the other context layers */
export class FlowrAnalyzerContext {
	public readonly files: FlowrAnalyzerFilesContext;
	public readonly deps:  FlowrAnalyzerDependenciesContext;

	constructor(plugins: ReadonlyMap<PluginType, FlowrAnalyzerPlugin[]>) {
		const loadingOrder = new FlowrAnalyzerLoadingOrderContext(plugins.get(PluginType.LoadingOrder) as FlowrAnalyzerLoadingOrderPlugin[]);
		/* TODO:  groupedPlugins.get(PluginType.File) as FlowrAnalyzerFilePlugin[] */
		// TODO: file discovery plugins
		this.files = new FlowrAnalyzerFilesContext(loadingOrder);
		this.deps  = new FlowrAnalyzerDependenciesContext(plugins.get(PluginType.DependencyIdentification) as FlowrAnalyzerPackageVersionsPlugin[]);
	}

	/** delegate request addition */
	public addRequests(requests: readonly RAnalysisRequest[]): void {
		this.files.addRequests(requests);
	}

	/** this conducts all of the step that can be done before the main analysis run */
	public resolvePreAnalysis(): void {
		this.files.calculateLoadingOrder();
		// TODO: pre-file dependency analysis and identification
	}

    
}