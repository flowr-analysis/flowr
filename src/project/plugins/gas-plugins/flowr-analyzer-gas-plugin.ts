import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { GasLevel } from '../../../gas';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { SemVer } from 'semver';

/**
 * Base class for gas plugins, queried on-demand by {@link FlowrAnalyzerGasContext.checkGas}.
 *
 * Override {@link process} to provide a custom resource-pressure assessment for a feature key.
 * Return `undefined` to defer to the built-in memory and time checks.
 * Multiple Gas plugins are combined by taking the maximum ({@link GasLevel}) returned by any plugin
 * or by the built-in checks.
 *
 * A gas plugin is the right place to add domain-specific checks (e.g., CPU, I/O, quota limits)
 * or to override default behavior for testing by returning a hardcoded level.
 * @see {@link PluginType.Gas}
 * @see {@link FlowrAnalyzerGasContext}
 */
export abstract class FlowrAnalyzerGasPlugin extends FlowrAnalyzerPlugin<string, GasLevel | undefined> {
	public readonly type = PluginType.Gas;

	public static override defaultPlugin(): FlowrAnalyzerGasPlugin {
		return new DefaultFlowrAnalyzerGasPlugin();
	}
}

/** Default no-op gas plugin that defers all checks to the built-in memory and time logic. */
class DefaultFlowrAnalyzerGasPlugin extends FlowrAnalyzerGasPlugin {
	public readonly name        = 'default-gas-plugin';
	public readonly description = 'Defers to built-in memory and time checks.';
	public readonly version     = new SemVer('0.0.0');

	protected process(_ctx: FlowrAnalyzerContext, _key: string): undefined {
		return undefined;
	}
}
