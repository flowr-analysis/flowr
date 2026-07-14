import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import { SemVer } from 'semver';
import type { PackageSignatureSource } from '../../sigdb/reader';
import type { FlowrConfig } from '../../../config';

/** metadata of a package database a plugin currently has loaded */
export interface SigDbLoadedInfo {
	scope:   string;
	version: number;
	date:    string;
	hash:    string;
}

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

	/** metadata of the databases this plugin currently has loaded (empty for plugins without any) */
	public loadedDatabases(): SigDbLoadedInfo[] {
		return [];
	}

	/** Packages known to this plugin that export `name` (empty for plugins without a database). */
	public packagesExporting(_name: string): readonly string[] {
		return [];
	}

	/** The signature sources this plugin currently has loaded (empty for plugins without any). `config` lets a query resolve config-driven sources before any analysis has set the plugin's context. */
	public signatureSources(_config?: FlowrConfig): readonly PackageSignatureSource[] {
		return [];
	}

	/** Mount an extra signature source by path (a `.sigs.ndjson`, `.br`, or `*.manifest.json(.br)`); no-op by default. */
	public addDatabaseSource(_source: string): Promise<void> {
		return Promise.resolve();
	}

	/** Eagerly parse and mount this plugin's databases up front (no-op for plugins without any). */
	public preloadDatabasesSync(): void {}

	/**
	 * Whether this plugin can resolve the always-available base-R packages (so their exports can be attached
	 * eagerly for bare base calls). `false` for plugins without a versioned base-R signature source.
	 */
	public providesBaseRPackages(): boolean {
		return false;
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