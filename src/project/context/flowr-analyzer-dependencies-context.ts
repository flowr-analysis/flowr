import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type {
	FlowrAnalyzerPackageVersionsPlugin
} from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';
import type { Package } from '../plugins/package-version-plugins/package';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';

export class FlowrAnalyzerDependenciesContext extends AbstractFlowrAnalyzerContext<undefined, void, FlowrAnalyzerPackageVersionsPlugin> {
	public readonly name = 'flowr-analyzer-dependencies-context';

	private dependencies: Map<string, Package> = new Map();

	public constructor(ctx: FlowrAnalyzerContext, plugins?: readonly FlowrAnalyzerPackageVersionsPlugin[]) {
		super(ctx, plugins);
	}

	public addDependency(pkg: Package): void {
		const p = this.dependencies.get(pkg.name);
		if(p) {
			p.mergeInPlace(pkg);
		} else {
			this.dependencies.set(pkg.name, pkg);
		}
	}

	public getDependency(name: string): Package | undefined {
		return this.dependencies.get(name);
	}

	// TODO: resolve system etc.
}
