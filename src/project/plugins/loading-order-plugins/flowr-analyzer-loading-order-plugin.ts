import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import { SemVer } from 'semver';

export abstract class FlowrAnalyzerLoadingOrderPlugin extends FlowrAnalyzerPlugin<undefined, void> {
	readonly type = PluginType.LoadingOrder;

	public static override defaultPlugin(): FlowrAnalyzerLoadingOrderPlugin {
		return new DefaultFlowrAnalyzerLoadingOrderPlugin();
	}
}


class DefaultFlowrAnalyzerLoadingOrderPlugin extends FlowrAnalyzerLoadingOrderPlugin {
	public readonly name = 'default-loading-order-plugin';
	public readonly description = 'This is the default loading order plugin that does nothing.';
	public readonly version = new SemVer('0.0.0');

	public process(): void {
		/* we always *have* to have a loading order, this plugin does not have to guess to rely on chronological order */
	}

}