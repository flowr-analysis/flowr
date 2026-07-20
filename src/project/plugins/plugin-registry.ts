import type { FlowrAnalyzerPlugin } from './flowr-analyzer-plugin';
import { FlowrAnalyzerDescriptionFilePlugin } from './file-plugins/flowr-analyzer-description-file-plugin';
import {
	FlowrAnalyzerPackageVersionsDescriptionFilePlugin
} from './package-version-plugins/flowr-analyzer-package-versions-description-file-plugin';
import {
	FlowrAnalyzerPackageVersionsSigDbPlugin
} from './package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import {
	FlowrAnalyzerPackageVersionsRenvPlugin, FlowrAnalyzerPackageVersionsRvPlugin
} from './package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin';
import {
	FlowrAnalyzerPackageVersionsSessionInfoPlugin
} from './package-version-plugins/flowr-analyzer-package-versions-session-info-plugin';
import {
	FlowrAnalyzerLoadingOrderDescriptionFilePlugin
} from './loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin';
import {
	FlowrAnalyzerLoadingOrderImplicitSourcesPlugin
} from './loading-order-plugins/flowr-analyzer-loading-order-implicit-sources-plugin';
import { FlowrAnalyzerRmdFilePlugin } from './file-plugins/notebooks/flowr-analyzer-rmd-file-plugin';
import { FlowrAnalyzerQmdFilePlugin } from './file-plugins/notebooks/flowr-analyzer-qmd-file-plugin';
import { guard } from '../../util/assert';
import { FlowrAnalyzerJupyterFilePlugin } from './file-plugins/notebooks/flowr-analyzer-jupyter-file-plugin';
import { FlowrAnalyzerNamespaceFilesPlugin } from './file-plugins/flowr-analyzer-namespace-files-plugin';
import { FlowrAnalyzerPackageVersionsNamespaceFilePlugin } from './package-version-plugins/flowr-analyzer-package-versions-namespace-file-plugin';
import { FlowrAnalyzerNewsFilePlugin } from './file-plugins/flowr-analyzer-news-file-plugin';
import { FlowrAnalyzerRdaFilePlugin } from './file-plugins/flowr-analyzer-rda-file-plugin';
import { FlowrAnalyzerMetaVignetteFilesPlugin } from './file-plugins/flowr-analyzer-vignette-file-plugin';
import { FlowrAnalyzerMetaTestFilesPlugin } from './file-plugins/flowr-analyzer-test-file-plugin';
import { FlowrAnalyzerMetaInstFilesPlugin } from './file-plugins/flowr-analyzer-inst-file-plugin';
import { FlowrAnalyzerLicenseFilePlugin } from './file-plugins/flowr-analyzer-license-file-plugin';
import { FlowrAnalyzerVirtualEnvFilePlugin } from './file-plugins/flowr-analyzer-virtualenv-file-plugin';
import { FlowrAnalyzerRProjectFilePlugin } from './file-plugins/flowr-analyzer-rproject-file-plugin';
import { FlowrAnalyzerMetaRProjectFilePlugin } from './package-version-plugins/flowr-analyzer-meta-rproject-file-plugin';
import {
	FlowrAnalyzerMetaDescriptionFilePlugin
} from './package-version-plugins/flowr-analyzer-meta-description-file-plugin';
import { FlowrAnalyzerSweaveFilePlugin } from './file-plugins/notebooks/flowr-analyzer-sweave-file-plugin';
import { FlowrAnalyzerGitignoreProjectDiscoveryPlugin } from './project-discovery/flowr-analyzer-gitignore-project-discovery-plugin';

/**
 * The built-in Flowr Analyzer plugins that are always available.
 */
export const BuiltInPlugins = [
	['file:description', FlowrAnalyzerDescriptionFilePlugin],
	['versions:description', FlowrAnalyzerPackageVersionsDescriptionFilePlugin],
	['versions:sigdb', FlowrAnalyzerPackageVersionsSigDbPlugin],
	['versions:renv', FlowrAnalyzerPackageVersionsRenvPlugin],
	['versions:rv', FlowrAnalyzerPackageVersionsRvPlugin],
	['versions:session-info', FlowrAnalyzerPackageVersionsSessionInfoPlugin],
	['loading-order:description', FlowrAnalyzerLoadingOrderDescriptionFilePlugin],
	['loading-order:implicit-sources', FlowrAnalyzerLoadingOrderImplicitSourcesPlugin],
	['meta:description', FlowrAnalyzerMetaDescriptionFilePlugin],
	['meta:rproject', FlowrAnalyzerMetaRProjectFilePlugin],
	['files:vignette', FlowrAnalyzerMetaVignetteFilesPlugin],
	['files:test', FlowrAnalyzerMetaTestFilesPlugin],
	['files:inst', FlowrAnalyzerMetaInstFilesPlugin],
	['file:rmd', FlowrAnalyzerRmdFilePlugin],
	['file:qmd', FlowrAnalyzerQmdFilePlugin],
	['file:rnw', FlowrAnalyzerSweaveFilePlugin],
	['file:ipynb', FlowrAnalyzerJupyterFilePlugin],
	['file:namespace', FlowrAnalyzerNamespaceFilesPlugin],
	['versions:namespace', FlowrAnalyzerPackageVersionsNamespaceFilePlugin],
	['file:news', FlowrAnalyzerNewsFilePlugin],
	['file:rda', FlowrAnalyzerRdaFilePlugin],
	['file:license', FlowrAnalyzerLicenseFilePlugin],
	['file:virtualenv', FlowrAnalyzerVirtualEnvFilePlugin],
	['file:rproject', FlowrAnalyzerRProjectFilePlugin],
	['project-discovery:gitignore', FlowrAnalyzerGitignoreProjectDiscoveryPlugin]
] as const satisfies [string, PluginProducer][];

export type BuiltInFlowrPluginName = typeof BuiltInPlugins[number][0];
export type BuiltInFlowrPluginArgs<N extends BuiltInFlowrPluginName> = N extends typeof BuiltInPlugins[number][0]
	? ConstructorParameters<Extract<typeof BuiltInPlugins[number], [N, PluginProducer]>[1]>
	: never;
/**
 * The registry of built-in and user-registered Flowr Analyzer plugins.
 * Used by the {@link FlowrAnalyzerBuilder} and {@link FlowrAnalyzer} to instantiate plugins by name.
 */
const PluginRegistry = new Map<string, PluginProducer>(BuiltInPlugins as [string, PluginProducer][]);

type PluginProducer = new (...args: never[]) => FlowrAnalyzerPlugin;

/**
 * Register a new Flowr Analyzer plugin for the registry,
 * to be used by the {@link FlowrAnalyzerBuilder} and {@link FlowrAnalyzer}.
 */
export function registerPluginMaker(plugin: PluginProducer, name: Exclude<string, BuiltInFlowrPluginName> = plugin.name): void {
	PluginRegistry.set(name, plugin);
}

export function getPlugin(name: BuiltInFlowrPluginName, args: BuiltInFlowrPluginArgs<typeof name>): FlowrAnalyzerPlugin;
export function getPlugin(name: string, args?: unknown[]): FlowrAnalyzerPlugin | undefined;
/**
 * Retrieve a registered Flowr Analyzer plugin by its name.
 * @see {@link PluginToRegister}
 */
export function getPlugin(name: string, args?: unknown[]): FlowrAnalyzerPlugin | undefined {
	const plugin = PluginRegistry.get(name);
	return plugin ? new plugin(...args as never[]) : undefined;
}

/**
 * The type used to register a plugin with the {@link FlowrAnalyzerBuilder}.
 * @see {@link makePlugin}
 */
export type PluginToRegister<T extends BuiltInFlowrPluginName | string> =
	FlowrAnalyzerPlugin | T | string |
	(T extends BuiltInFlowrPluginName ?
		[T, BuiltInFlowrPluginArgs<T>]
		: [string, unknown[]]
		);

/**
 * Create a Flowr Analyzer plugin from a {@link PluginToRegister} specification.
 */
export function makePlugin<T extends BuiltInFlowrPluginName | string>(toRegister: PluginToRegister<T>): FlowrAnalyzerPlugin {
	if(toRegister instanceof Object && 'process' in toRegister) {
		return toRegister as FlowrAnalyzerPlugin;
	}
	if(Array.isArray(toRegister)) {
		const [name, args] = toRegister;
		const plugin = getPlugin(name, args as unknown[]);
		guard(plugin !== undefined, () => `Unknown Flowr Analyzer plugin: ${name.toString()}`);
		return plugin;
	}
	const plugin = getPlugin(toRegister, []);
	guard(plugin !== undefined, () => `Unknown Flowr Analyzer plugin: ${toRegister.toString()}`);
	return plugin;
}
