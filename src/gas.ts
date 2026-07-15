import type { MergeableRecord } from './util/objects';

/** Wiki reference for the gas resource guard, use this in user-facing warnings. */
export const GasWikiRef = 'https://github.com/flowr-analysis/flowr/wiki/Core#gas-resource-guard';

/**
 * Resource-pressure level returned by {@link ReadOnlyFlowrAnalyzerGasContext.checkGas}.
 * Numeric ordering lets callers use `>=` for threshold comparisons at zero cost.
 * See the [Gas (Resource Guard)](https://github.com/flowr-analysis/flowr/wiki/Core#gas-resource-guard) wiki section for details.
 */
export const enum GasLevel {
	/** Safe to continue, all resources are within bounds. */
	Normal      = 0,
	/** Approaching a threshold. Consider emitting a warning and continue. */
	Problematic = 1,
	/** Threshold exceeded. The caller should skip the expensive work. */
	Critical    = 2
}

/**
 * Known feature keys accepted by {@link ReadOnlyFlowrAnalyzerGasContext.checkGas}.
 * Each key corresponds to a sensitivity factor in {@link FlowrGasConfig.features}.
 */
export const GasFeatureKey = {
	/** Gas key for built-in `source()` file analysis. */
	Source:            'source',
	/** Gas key for the side-effect link resolution phase of the dataflow extractor, which matches unknown side effects against call sites via the CFG and can be expensive for large scripts. */
	SideEffectLinking: 'side-effect-linking',
	/** Gas key for the linter, checked once per linting rule. Under critical pressure, remaining rules are skipped. */
	Linter:            'linter'
} as const;

export type GasFeatureKey = typeof GasFeatureKey[keyof typeof GasFeatureKey];

/** Paired low/high thresholds used inside {@link FlowrGasThresholds}. */
export interface GasThresholdPair extends MergeableRecord {
	/** Returns {@link GasLevel.Problematic} when reached (after factor scaling). */
	readonly problematic: number;
	/** Returns {@link GasLevel.Critical} when reached (after factor scaling). */
	readonly critical:    number;
}

/**
 * Thresholds for {@link GasLevel} transitions used by {@link ReadOnlyFlowrAnalyzerGasContext.checkGas}.
 * Memory values are fractions of the heap limit reported by the active heap source (0-1), time values are in milliseconds.
 * See the [Gas (Resource Guard)](https://github.com/flowr-analysis/flowr/wiki/Core#gas-resource-guard) wiki section.
 */
export interface FlowrGasThresholds extends MergeableRecord {
	/** Heap-usage fraction thresholds (0-1, before factor scaling). */
	readonly memory: GasThresholdPair;
	/** Elapsed analysis time thresholds in milliseconds (before factor scaling). */
	readonly timeMs: GasThresholdPair;
}

/** Heap statistics used for gas memory checks (field names follow the v8 API). */
export interface GasHeapStatistics {
	readonly used_heap_size:  number;
	readonly heap_size_limit: number;
}

/**
 * Gas configuration embedded in {@link FlowrConfig.gas}.
 *
 * Each entry in `features` is a sensitivity factor for a named analysis feature
 * (see {@link GasFeatureKey} for the recognised keys):
 * - `0` / absent - disabled for that feature, zero overhead.
 * - `1` - normal sensitivity, thresholds in {@link thresholds} apply as-is.
 * - `N` - N times as sensitive, effectively divides each threshold by N.
 *
 * See the [Gas (Resource Guard)](https://github.com/flowr-analysis/flowr/wiki/Core#gas-resource-guard) wiki section.
 */
export interface FlowrGasConfig extends MergeableRecord {
	/** Shared thresholds scaled by each feature factor before comparison. */
	readonly thresholds:    FlowrGasThresholds;
	/** Per-feature sensitivity factors. Missing or `0` disables checking with zero overhead. */
	readonly features:      Record<string, number | undefined>;
	/**
	 * Custom heap statistics source (programmatic configs only), overriding the built-in
	 * detection (v8 module, then Chromium's performance.memory). Return undefined to skip the memory check.
	 */
	readonly heapProvider?: () => GasHeapStatistics | undefined;
}
