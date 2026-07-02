import { type FlowrGasConfig, type FlowrGasThresholds, type GasHeapStatistics, GasLevel } from '../../gas';
import type { FlowrAnalyzerGasPlugin } from '../plugins/gas-plugins/flowr-analyzer-gas-plugin';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import { log } from '../../util/log';

type ChromiumMemory = { usedJSHeapSize: number, jsHeapSizeLimit: number };
let heapStatisticsProvider: (() => GasHeapStatistics) | null | undefined = undefined;

/**
 * Heap statistics come from the v8 module (Node.js, Electron, VS Code extension host) or,
 * as a fallback, from Chromium's non-standard performance.memory (browsers, web workers).
 * If neither exists, this returns undefined and gas skips the memory check
 * (use {@link FlowrGasConfig#heapProvider} or a gas plugin to supply a custom source).
 */
function tryGetHeapStatistics(): GasHeapStatistics | undefined {
	if(heapStatisticsProvider === undefined) {
		const v8 = globalThis.process?.getBuiltinModule?.('v8');
		if(v8) {
			heapStatisticsProvider = v8.getHeapStatistics;
		} else if((globalThis.performance as { memory?: ChromiumMemory } | undefined)?.memory) {
			heapStatisticsProvider = () => {
				const m = (globalThis.performance as unknown as { memory: ChromiumMemory }).memory;
				return { used_heap_size: m.usedJSHeapSize, heap_size_limit: m.jsHeapSizeLimit };
			};
		} else {
			heapStatisticsProvider = null;
			log.info('no heap statistics source available in this runtime, gas skips the memory check');
		}
	}
	return heapStatisticsProvider ? heapStatisticsProvider() : undefined;
}

/** Read-only gas context exposed via `ctx.gas`. */
export interface ReadOnlyFlowrAnalyzerGasContext {
	readonly name: string;
	/**
	 * Returns the resource-pressure level for `key` (`config.gas.features[key]`).
	 * Returns `GasLevel.Normal` with zero overhead when the feature factor is 0 or absent
	 * and no gas plugins are registered (plugins are always consulted and may escalate any key).
	 */
	checkGas(key: string): GasLevel;
}

/** Checks heap and elapsed-time pressure for named analysis features. See {@link ReadOnlyFlowrAnalyzerGasContext}. */
export class FlowrAnalyzerGasContext implements ReadOnlyFlowrAnalyzerGasContext {
	public readonly name = 'flowr-analyzer-gas-context';
	private startTime:        number;
	private readonly config:  FlowrGasConfig | undefined;
	private readonly ctx:     FlowrAnalyzerContext;
	private readonly plugins: readonly FlowrAnalyzerGasPlugin[];

	constructor(ctx: FlowrAnalyzerContext, config: FlowrGasConfig | undefined, plugins: readonly FlowrAnalyzerGasPlugin[]) {
		this.ctx       = ctx;
		this.config    = config;
		this.plugins   = plugins;
		this.startTime = Date.now();
	}

	/** Restart the elapsed-time counter (called when the owning context is reset). */
	public reset(): void {
		this.startTime = Date.now();
	}

	private memoryLevel(factor: number, t: FlowrGasThresholds): GasLevel {
		const stats = this.config?.heapProvider ? this.config.heapProvider() : tryGetHeapStatistics();
		if(stats === undefined || stats.heap_size_limit <= 0) {
			return GasLevel.Normal;
		}
		const ratio = (stats.used_heap_size / stats.heap_size_limit) * factor;
		if(ratio >= t.memory.critical)    {
			return GasLevel.Critical;
		}
		if(ratio >= t.memory.problematic) {
			return GasLevel.Problematic;
		}
		return GasLevel.Normal;
	}

	private static maxLevel(a: GasLevel, b: GasLevel): GasLevel {
		return a >= b ? a : b;
	}

	private timeLevel(factor: number, t: FlowrGasThresholds): GasLevel {
		const elapsed = (Date.now() - this.startTime) * factor;
		if(elapsed >= t.timeMs.critical)    {
			return GasLevel.Critical;
		}
		if(elapsed >= t.timeMs.problematic) {
			return GasLevel.Problematic;
		}
		return GasLevel.Normal;
	}

	public checkGas(key: string): GasLevel {
		const factor = this.config?.features?.[key];
		if(!factor && this.plugins.length === 0) {
			return GasLevel.Normal;
		}

		let level = GasLevel.Normal;

		if(factor) {
			const t = this.config.thresholds;
			level = FlowrAnalyzerGasContext.maxLevel(level, this.memoryLevel(factor, t));
			if(level < GasLevel.Critical) {
				level = FlowrAnalyzerGasContext.maxLevel(level, this.timeLevel(factor, t));
			}
		}

		for(const plugin of this.plugins) {
			if(level >= GasLevel.Critical) {
				break;
			}
			const override = plugin.processor(this.ctx, key);
			if(override !== undefined) {
				level = FlowrAnalyzerGasContext.maxLevel(level, override);
			}
		}

		return level;
	}
}
