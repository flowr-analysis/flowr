import type { FlowrAnalyzerPlugin } from './flowr-analyzer-plugin';
import { FlowrAnalyzerDescriptionFilePlugin } from './file-plugins/flowr-analyzer-description-file-plugin';
import {
	FlowrAnalyzerPackageVersionsDescriptionFilePlugin
} from './package-version-plugins/flowr-analyzer-package-versions-description-file-plugin';
import {
	FlowrAnalyzerPackageVersionsSigDbPlugin
} from './package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import {
	FlowrAnalyzerPackageVersionsPackratPlugin,
	FlowrAnalyzerPackageVersionsRenvPlugin,
	FlowrAnalyzerPackageVersionsRvPlugin,
	FlowrAnalyzerPackageVersionsUvrPlugin
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
import {
	FlowrAnalyzerDataListFilePlugin,
	FlowrAnalyzerRdFilePlugin,
	FlowrAnalyzerRdIndexFilePlugin,
	FlowrAnalyzerRdMacroFilePlugin,
	FlowrAnalyzerRdMetaFilePlugin,
	FlowrAnalyzerRdTopicIndexFilePlugin
} from './file-plugins/flowr-analyzer-rd-file-plugin';
import { FlowrAnalyzerRdaFilePlugin } from './file-plugins/flowr-analyzer-rda-file-plugin';
import { FlowrAnalyzerMetaVignetteFilesPlugin } from './file-plugins/flowr-analyzer-vignette-file-plugin';
import { FlowrAnalyzerMetaTestFilesPlugin } from './file-plugins/flowr-analyzer-test-file-plugin';
import { FlowrAnalyzerMetaInstFilesPlugin } from './file-plugins/flowr-analyzer-inst-file-plugin';
import { FlowrAnalyzerLicenseFilePlugin } from './file-plugins/flowr-analyzer-license-file-plugin';
import { FlowrAnalyzerVirtualEnvFilePlugin } from './file-plugins/flowr-analyzer-virtualenv-file-plugin';
import {
	FlowrAnalyzerRProjectFilePlugin,
	FlowrAnalyzerUvrManifestFilePlugin
} from './file-plugins/flowr-analyzer-manifest-file-plugin';
import {
	FlowrAnalyzerMetaRProjectFilePlugin,
	FlowrAnalyzerMetaUvrManifestFilePlugin
} from './package-version-plugins/flowr-analyzer-meta-manifest-file-plugin';
import {
	FlowrAnalyzerMetaDescriptionFilePlugin
} from './package-version-plugins/flowr-analyzer-meta-description-file-plugin';
import { FlowrAnalyzerSweaveFilePlugin } from './file-plugins/notebooks/flowr-analyzer-sweave-file-plugin';
import {
	FlowrAnalyzerGitignoreProjectDiscoveryPlugin,
	FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin,
	FlowrAnalyzerRbuildignoreProjectDiscoveryPlugin
} from './project-discovery/flowr-analyzer-ignore-file-project-discovery-plugin';
import {
	FlowrAnalyzerDefaultProjectDiscoveryPlugin,
	FlowrAnalyzerFullProjectDiscoveryPlugin
} from './project-discovery/flowr-analyzer-project-discovery-plugin';
import { FlowrAnalyzerRprofileFilePlugin } from './file-plugins/flowr-analyzer-rprofile-file-plugin';
import {
	FlowrAnalyzerLoadingOrderRprofilePlugin
} from './loading-order-plugins/flowr-analyzer-loading-order-rprofile-plugin';
import {
	FlowrAnalyzerPackageVersionsLibraryPlugin
} from './package-version-plugins/flowr-analyzer-package-versions-library-plugin';
import {
	FlowrAnalyzerLoadingOrderIncludedFilesPlugin
} from './loading-order-plugins/flowr-analyzer-loading-order-included-files-plugin';

/**
 * The built-in Flowr Analyzer plugins that are always available.
 */
export const BuiltInPlugins = [
	['file:description', FlowrAnalyzerDescriptionFilePlugin],
	['versions:description', FlowrAnalyzerPackageVersionsDescriptionFilePlugin],
	['versions:sigdb', FlowrAnalyzerPackageVersionsSigDbPlugin],
	['versions:library', FlowrAnalyzerPackageVersionsLibraryPlugin],
	['versions:renv', FlowrAnalyzerPackageVersionsRenvPlugin],
	['versions:rv', FlowrAnalyzerPackageVersionsRvPlugin],
	['versions:uvr', FlowrAnalyzerPackageVersionsUvrPlugin],
	['versions:packrat', FlowrAnalyzerPackageVersionsPackratPlugin],
	['versions:session-info', FlowrAnalyzerPackageVersionsSessionInfoPlugin],
	['loading-order:description', FlowrAnalyzerLoadingOrderDescriptionFilePlugin],
	['loading-order:implicit-sources', FlowrAnalyzerLoadingOrderImplicitSourcesPlugin],
	['loading-order:rprofile', FlowrAnalyzerLoadingOrderRprofilePlugin],
	['loading-order:included-files', FlowrAnalyzerLoadingOrderIncludedFilesPlugin],
	['meta:description', FlowrAnalyzerMetaDescriptionFilePlugin],
	['meta:rproject', FlowrAnalyzerMetaRProjectFilePlugin],
	['meta:uvr', FlowrAnalyzerMetaUvrManifestFilePlugin],
	['file-roles:vignette', FlowrAnalyzerMetaVignetteFilesPlugin],
	['file-roles:test', FlowrAnalyzerMetaTestFilesPlugin],
	['file-roles:inst', FlowrAnalyzerMetaInstFilesPlugin],
	['file:rmd', FlowrAnalyzerRmdFilePlugin],
	['file:qmd', FlowrAnalyzerQmdFilePlugin],
	['file:rnw', FlowrAnalyzerSweaveFilePlugin],
	['file:ipynb', FlowrAnalyzerJupyterFilePlugin],
	['file:namespace', FlowrAnalyzerNamespaceFilesPlugin],
	['versions:namespace', FlowrAnalyzerPackageVersionsNamespaceFilePlugin],
	['file:news', FlowrAnalyzerNewsFilePlugin],
	/* the macro plugin comes first: it claims the `macros/` pages the page plugin deliberately skips */
	['file:rd-macros', FlowrAnalyzerRdMacroFilePlugin],
	['file:rd', FlowrAnalyzerRdFilePlugin],
	['file:rd-index', FlowrAnalyzerRdIndexFilePlugin],
	['file:rd-topics', FlowrAnalyzerRdTopicIndexFilePlugin],
	['file:rd-meta', FlowrAnalyzerRdMetaFilePlugin],
	['file:datalist', FlowrAnalyzerDataListFilePlugin],
	['file:rda', FlowrAnalyzerRdaFilePlugin],
	['file:license', FlowrAnalyzerLicenseFilePlugin],
	['file:virtualenv', FlowrAnalyzerVirtualEnvFilePlugin],
	['file:rproject', FlowrAnalyzerRProjectFilePlugin],
	['file:uvr', FlowrAnalyzerUvrManifestFilePlugin],
	['file:rprofile', FlowrAnalyzerRprofileFilePlugin],
	['project-discovery:gitignore', FlowrAnalyzerGitignoreProjectDiscoveryPlugin],
	['project-discovery:rbuildignore', FlowrAnalyzerRbuildignoreProjectDiscoveryPlugin],
	['project-discovery:ignore-files', FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin],
	['project-discovery:default', FlowrAnalyzerDefaultProjectDiscoveryPlugin],
	['project-discovery:full', FlowrAnalyzerFullProjectDiscoveryPlugin]
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
		return toRegister;
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
