import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { Package } from '../plugins/package-version-plugins/package';
import type {
	FlowrAnalyzerPackageVersionsPlugin
} from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';

export class FlowrAnalyzerDependenciesContext extends AbstractFlowrAnalyzerContext {
	public readonly name = 'flowr-analyzer-dependencies-context';

	private packages:         Package[] = [];
	private readonly plugins: FlowrAnalyzerPackageVersionsPlugin[] = [];

	constructor(plugins: readonly FlowrAnalyzerPackageVersionsPlugin[] | undefined) {
		super();
	}

	public getDependencies(): Package[] {
		return this.packages;
	}


}
