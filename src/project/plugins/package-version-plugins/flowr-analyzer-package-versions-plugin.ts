import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';

export abstract class FlowrAnalyzerPackageVersionsPlugin extends FlowrAnalyzerPlugin<undefined, void> {
	readonly type = PluginType.DependencyIdentification;
}