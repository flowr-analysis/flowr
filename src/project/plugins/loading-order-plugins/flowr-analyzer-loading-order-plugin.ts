import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import { SemVer } from 'semver';

/**
 * This is the base class for all plugins that determine the loading order of files in a project.
 * These plugins interplay with the {@link FlowrAnalyzerFilesContext} to gather information about the files in the project and determine their loading order.
 * See {@link DefaultFlowrAnalyzerLoadingOrderPlugin} for the dummy default implementation.
 *
 * In general, these plugins only trigger for a full project analysis after all files have been discovered and loaded.
 * Otherwise, they may trigger multiple times (if for some reason, discovery reveals new files during the analysis).
 */
export abstract class FlowrAnalyzerLoadingOrderPlugin extends FlowrAnalyzerPlugin<undefined, void> {
	readonly type = PluginType.LoadingOrder;

	public static override defaultPlugin(): FlowrAnalyzerLoadingOrderPlugin {
		return new DefaultFlowrAnalyzerLoadingOrderPlugin();
	}
}

/**
 * This is the default dummy implementation of the {@link FlowrAnalyzerLoadingOrderPlugin}.
 * It does nothing and relies on the chronological order of file discovery.
 */
class DefaultFlowrAnalyzerLoadingOrderPlugin extends FlowrAnalyzerLoadingOrderPlugin {
	public readonly name = 'default-loading-order-plugin';
	public readonly description = 'This is the default loading order plugin that does nothing.';
	public readonly version = new SemVer('0.0.0');

	public process(): void {
		/* we always *have* to have a loading order, this plugin does not have to guess to rely on chronological order */
	}

}