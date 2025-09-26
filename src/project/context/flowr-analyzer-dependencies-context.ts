import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import { FlowrAnalyzerPackageVersionsPlugin } from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';
import type { Package } from '../plugins/package-version-plugins/package';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';

export class FlowrAnalyzerDependenciesContext extends AbstractFlowrAnalyzerContext<undefined, void, FlowrAnalyzerPackageVersionsPlugin> {
	public readonly name = 'flowr-analyzer-dependencies-context';

	private dependencies: Map<string, Package> = new Map();
	private staticsLoaded = false;

	public constructor(ctx: FlowrAnalyzerContext, plugins?: readonly FlowrAnalyzerPackageVersionsPlugin[]) {
		super(ctx, FlowrAnalyzerPackageVersionsPlugin.defaultPlugin(), plugins);
	}

	public resolveStaticDependencies(): void {
		this.applyPlugins(undefined);
		this.staticsLoaded = true;
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
		if(!this.staticsLoaded) {
			this.resolveStaticDependencies();
		}
		return this.dependencies.get(name);
	}
}
