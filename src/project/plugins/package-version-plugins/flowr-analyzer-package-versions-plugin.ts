import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import { SemVer } from 'semver';

export abstract class FlowrAnalyzerPackageVersionsPlugin extends FlowrAnalyzerPlugin<undefined, void> {
	readonly type = PluginType.DependencyIdentification;

	public static override defaultPlugin(): FlowrAnalyzerPackageVersionsPlugin {
		return new DefaultFlowrAnalyzerPackageVersionsPlugin();
	}
}

class DefaultFlowrAnalyzerPackageVersionsPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'default-package-versions-plugin';
	public readonly description = 'This is the default package versions plugin that does nothing.';
	public readonly version = new SemVer('0.0.0');

	public process(): void {
		/* we do not need package versions for the analysis to do things! */
	}
}