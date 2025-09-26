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
 * │ *Builder* ├──►│ Project Discovery ├──►│ File Loader ├──►│ Dependencies  ├──►│ *DFA* │
 * │           │   │  (if necessary)   │   │             │   │   (static)    │   │       │
 * └───────────┘   └───────────────────┘   └──────┬──────┘   └───────────────┘   └───────┘
 *                                                │                                  ▲
 *                                                │          ┌───────────────┐       │
 *                                                │          │               │       │
 *                                                └─────────►│ Loading Order ├───────┘
 *                                                           │               │
 *                                                           └───────────────┘
 *```
 *
 */
export enum PluginType {
    DependencyIdentification = 'package-versions',
    LoadingOrder             = 'loading-order',
    ProjectDiscovery         = 'project-discovery',
    FileLoad                 = 'file-load'
}

export interface FlowrAnalyzerPluginInterface<In = unknown, Out = In> {
	readonly name:        string;
	readonly description: string;
	readonly version:     SemVer;
	readonly type:        PluginType;

	processor(analyzer: FlowrAnalyzerContext, args: In): Out;
}


const generalPluginLog = log.getSubLogger({ name: 'plugins' });

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
