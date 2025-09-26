import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';

export abstract class FlowrAnalyzerLoadingOrderPlugin extends FlowrAnalyzerPlugin<undefined, void> {
	readonly type = PluginType.LoadingOrder;
}