import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';

export abstract class FlowrAnalyzerLoadingOrderPlugin extends FlowrAnalyzerPlugin {
	readonly type = PluginType.LoadingOrder;
}