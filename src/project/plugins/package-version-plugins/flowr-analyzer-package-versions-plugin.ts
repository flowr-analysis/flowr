import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import { SemVer } from 'semver';

/**
 * This is the base class for all plugins that identify package and dependency versions used in the project.
 * These plugins interplay with the {@link FlowrAnalyzerDependenciesContext} to gather information about the packages used in the project.
 * See {@link DefaultFlowrAnalyzerPackageVersionsPlugin} for the no-op default implementation.
 */
export abstract class FlowrAnalyzerPackageVersionsPlugin extends FlowrAnalyzerPlugin<undefined, void> {
	readonly type = PluginType.DependencyIdentification;

	public static override defaultPlugin(): FlowrAnalyzerPackageVersionsPlugin {
		return new DefaultFlowrAnalyzerPackageVersionsPlugin();
	}
}

/**
 * This is the default no-op implementation of the {@link FlowrAnalyzerPackageVersionsPlugin}.
 */
class DefaultFlowrAnalyzerPackageVersionsPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'default-package-versions-plugin';
	public readonly description = 'This is the default package versions plugin that does nothing.';
	public readonly version = new SemVer('0.0.0');

	public process(): void {
		/* we do not need package versions for the analysis to do things! */
	}
}