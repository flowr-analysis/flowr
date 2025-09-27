import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import { FlowrAnalyzerPackageVersionsPlugin } from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';
import type { Package } from '../plugins/package-version-plugins/package';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';

/**
 * This is a read-only interface to the {@link FlowrAnalyzerDependenciesContext}.
 * It prevents you from modifying the dependencies, but allows you to inspect them (which is probably what you want when using the {@link FlowrAnalyzer}).
 * If you are a {@link FlowrAnalyzerPackageVersionsPlugin} and want to modify the dependencies, you can use the {@link FlowrAnalyzerDependenciesContext} directly.
 */
export interface ReadOnlyFlowrAnalyzerDependenciesContext {
	/**
	 * The name of this context.
	 */
	readonly name: string;
	/**
	 * Get the dependency with the given name, if it exists.
	 *
	 * If the static dependencies have not yet been loaded, this may trigger a resolution step.
	 *
	 * @param name - The name of the dependency to get.
	 * @returns The dependency with the given name, or undefined if it does not exist.
	 */
	getDependency(name: string): Package | undefined;
}

/**
 * This context is responsible for managing the dependencies of the project, including their versions and interplays with {@link FlowrAnalyzerPackageVersionsPlugin}s.
 *
 * If you are interested in inspecting these dependencies, refer to {@link ReadOnlyFlowrAnalyzerDependenciesContext}.
 */
export class FlowrAnalyzerDependenciesContext extends AbstractFlowrAnalyzerContext<undefined, void, FlowrAnalyzerPackageVersionsPlugin> implements ReadOnlyFlowrAnalyzerDependenciesContext {
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
