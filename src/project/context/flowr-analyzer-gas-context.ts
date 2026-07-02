import { type FlowrGasConfig, type FlowrGasThresholds, GasLevel } from '../../gas';
import type { FlowrAnalyzerGasPlugin } from '../plugins/gas-plugins/flowr-analyzer-gas-plugin';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import { log } from '../../util/log';

type HeapStatistics = { used_heap_size: number, heap_size_limit: number };
let heapStatisticsProvider: (() => HeapStatistics) | null | undefined = undefined;

/** heap statistics need a V8 runtime (e.g., Node.js), elsewhere this returns undefined and memory pressure is not checked */
function tryGetHeapStatistics(): HeapStatistics | undefined {
	if(heapStatisticsProvider === undefined) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			heapStatisticsProvider = (require('v8') as typeof import('v8')).getHeapStatistics;
		} catch{
			heapStatisticsProvider = null;
			log.info('v8 heap statistics are unavailable in this runtime, gas checks skip memory pressure');
		}
	}
	return heapStatisticsProvider ? heapStatisticsProvider() : undefined;
}

/** Read-only gas context exposed via `ctx.gas`. */
export interface ReadOnlyFlowrAnalyzerGasContext {
	readonly name: string;
	/**
	 * Returns the resource-pressure level for `key` (`config.gas.features[key]`).
	 * Returns `GasLevel.Normal` with zero overhead when the feature factor is 0 or absent.
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
		const stats = tryGetHeapStatistics();
		if(stats === undefined) {
			return GasLevel.Normal;
		}
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const { used_heap_size, heap_size_limit } = stats;
		if(heap_size_limit <= 0) {
			return GasLevel.Normal;
		}
		const ratio = (used_heap_size / heap_size_limit) * factor;
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
