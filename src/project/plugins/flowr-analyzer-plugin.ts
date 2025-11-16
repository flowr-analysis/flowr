import type { SemVer } from 'semver';
import type { AsyncOrSync } from 'ts-essentials';
import { expensiveTrace, log } from '../../util/log';
import type { FlowrAnalyzerContext } from '../context/flowr-analyzer-context';


/**
 * Based on *when* and *what-for* the plugin is applied during the analysis,
 * plugins are categorized into different types.
 *
 * Consult this diagram for an overview of orders and (implicit or explicit) dependencies:
 *
 * ```text
 * ┌───────────┐   ┌───────────────────┐   ┌─────────────┐   ┌───────────────┐   ┌───────┐
 * │           │   │                   │   │             │   │               │   │       │
 * │ *Builder* ├──▶│ Project Discovery ├──▶│ File Loader ├──▶│ Dependencies  ├──▶│ *DFA* │
 * │           │   │  (if necessary)   │   │             │   │   (static)    │   │       │
 * └───────────┘   └───────────────────┘   └──────┬──────┘   └───────────────┘   └───────┘
 *                                                │                                  ▲
 *                                                │          ┌───────────────┐       │
 *                                                │          │               │       │
 *                                                └─────────▶│ Loading Order ├───────┘
 *                                                           │               │
 *                                                           └───────────────┘
 *```
 *
 */
export enum PluginType {
	/**
	 * Plugins that are applied right after the builder has been created and before any analysis is done.
	 * @see {@link FlowrAnalyzerPackageVersionsPlugin} - for the base class to implement such a plugin.
	 */
    DependencyIdentification = 'package-versions',
	/**
	 * Plugins that are used to determine the order in which files are loaded and analyzed.
	 * @see {@link FlowrAnalyzerLoadingOrderPlugin} - for the base class to implement such a plugin.
	 */
    LoadingOrder             = 'loading-order',
	/**
	 * Plugins that are applied to discover the project structure, files, and folders to analyze.
	 * @see {@link FlowrAnalyzerProjectDiscoveryPlugin} - for the base class to implement such a plugin.
	 */
    ProjectDiscovery         = 'project-discovery',
	/**
	 * Plugins that are applied to load and parse files.
	 * @see {@link FlowrAnalyzerFilePlugin} - for the base class to implement such a plugin.
	 */
    FileLoad                 = 'file-load'
}

/**
 * This is the main interface that every plugin to be used with the {@link FlowrAnalyzer} must comply with.
 *
 * One of the most important decisions for the generics is also the {@link PluginType}, as this determines
 * at which stage of the analysis the plugin is applied and what it is expected to do.
 * Do yourself a favor and do not implement a corresponding class yourself but use the classes referenced alongside
 * the {@link PluginType} values, as these already provide the correct generic restrictions, additional capabilities, and the `type` property.
 */
export interface FlowrAnalyzerPluginInterface<In = unknown, Out = In> {
	/** A unique, human-readable name of the plugin. */
	readonly name:        string;
	/** A short description of what the plugin does. */
	readonly description: string;
	/** The version of the plugin, ideally following [semver](https://semver.org/). */
	readonly version:     SemVer;
	/** The type of the plugin, determining when and for what purpose it is applied during the analysis. */
	readonly type:        PluginType;

	/**
	 * The main implementation of the plugin, receiving the current analysis context and the input arguments,
	 * The plugin is (based on the restrictions of its {@link PluginType}) allowed to modify the context.
	 */
	processor(analyzer: FlowrAnalyzerContext, args: In): Out;
}


const generalPluginLog = log.getSubLogger({ name: 'plugins' });

/**
 * The base class every plugin to be used with the {@link FlowrAnalyzer} must extend.
 * **Please do not create plugins directly based on this class, but use the classes referenced alongside the {@link PluginType} values!**
 * For example, if you want to create a plugin that determines the loading order of files, extend {@link FlowrAnalyzerLoadingOrderPlugin} instead.
 * These classes also provide sensible overrides of {@link FlowrAnalyzerPlugin.defaultPlugin} to be used when no plugin of this type is registered or triggered.
 *
 * For a collection of default plugins, see {@link FlowrAnalyzerPlugin.defaultPlugins}.
 */
export abstract class FlowrAnalyzerPlugin<In = unknown, Out extends AsyncOrSync<unknown> = In> implements FlowrAnalyzerPluginInterface<In, Out> {
	public abstract readonly name:        string;
	public abstract readonly description: string;
	public abstract readonly version:     SemVer;
	public abstract readonly type:        PluginType;

	/**
	 * Returns a default/dummy implementation to be used when no plugin of this type is registered or triggered.
	 */
	public static defaultPlugin(): FlowrAnalyzerPlugin<unknown, unknown> {
		throw new Error('This is to be implemented by every Plugin Layer');
	}

	/**
	 * Run the plugin with the given context and arguments.
	 */
	public processor(context: FlowrAnalyzerContext, args: In): Out {
		const now = Date.now();
		try {
			const result = this.process(context, args);
			const duration = Date.now() - now;
			expensiveTrace(generalPluginLog, () => `Plugin ${this.name} (v${this.version.format()}, ${this.type}) executed in ${duration}ms.`);
			return result;
		} catch(error) {
			const duration = Date.now() - now;
			generalPluginLog.error(`Plugin ${this.name} (v${this.version.format()}, {this.type}) failed after ${duration}ms. Error: ${(error as Error).message}`);
			throw error;
		}
	}

	protected abstract process(analyzer: FlowrAnalyzerContext, args: In): Out;
}
