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
	Linter:            'linter',
	/**
	 * Gas key for the static slicer, checked while traversing the dataflow graph. Under critical pressure the
	 * traversal stops and the slice is returned as far as it got (`SliceResult.stoppedEarly`), which is the only
	 * way to bound the otherwise synchronous traversal from the outside.
	 */
	Slicer:            'slicer'
} as const;

export type GasFeatureKey = typeof GasFeatureKey[keyof typeof GasFeatureKey];

/** Paired low/high thresholds used inside {@link GasThresholdSpec}. */
export interface GasThresholdPair extends MergeableRecord {
	/** Returns {@link GasLevel.Problematic} when reached (after factor scaling). */
	readonly problematic: number;
	/** Returns {@link GasLevel.Critical} when reached (after factor scaling). */
	readonly critical:    number;
}

/**
 * Thresholds for one gas dimension, either as one pair for every feature or split per {@link GasFeatureKey}:
 *
 * ```ts
 * timeMs: {
 *     default: { problematic: 60_000, critical: 120_000 },
 *     slicer:  { problematic: 24_000, critical:  30_000 }
 * }
 * ```
 *
 * Per bound, a feature entry wins over `default`, which wins over the direct pair. A bound nowhere given never triggers.
 */
export interface GasThresholdSpec extends MergeableRecord {
	/** Shared bound, for every feature without a more specific entry. */
	readonly problematic?:      number;
	/** Shared bound, for every feature without a more specific entry. */
	readonly critical?:         number;
	/** Bounds for the features that have no entry of their own. */
	readonly default?:          Partial<GasThresholdPair>;
	/** Bounds for one {@link GasFeatureKey}. */
	readonly [feature: string]: number | Partial<GasThresholdPair> | undefined;
}

/**
 * Thresholds for {@link GasLevel} transitions used by {@link ReadOnlyFlowrAnalyzerGasContext.checkGas}, each
 * dimension boundable per feature (see {@link GasThresholdSpec}).
 * See the [Gas (Resource Guard)](https://github.com/flowr-analysis/flowr/wiki/Core#gas-resource-guard) wiki section.
 */
export interface FlowrGasThresholds extends MergeableRecord {
	/** Heap-usage fraction thresholds (0-1, before factor scaling). */
	readonly memory: GasThresholdSpec;
	/** Elapsed analysis time thresholds in milliseconds (before factor scaling). */
	readonly timeMs: GasThresholdSpec;
}

/** Gas bounds for one feature within a single call, see {@link GasOverrides}. */
export interface GasFeatureOverride extends MergeableRecord {
	/** Elapsed ms, shorthand for `timeMs.problematic`. */
	readonly problematic?: number;
	/** Elapsed ms, shorthand for `timeMs.critical`. */
	readonly critical?:    number;
	/** Overrides `config.gas.thresholds.timeMs` for this call. */
	readonly timeMs?:      Partial<GasThresholdPair>;
	/** Overrides `config.gas.thresholds.memory` for this call. */
	readonly memory?:      Partial<GasThresholdPair>;
	/** Sensitivity factor, defaulting to the configured one, or `1` if the feature is disabled. */
	readonly factor?:      number;
}

/**
 * Gas bounds for a single call, keyed by {@link GasFeatureKey}, measured from that call:
 *
 * ```ts
 * analyzer.query([...], { gas: { slicer: { critical: 30_000 } } });
 * ```
 *
 * Naming a feature enables gas for it even when `config.gas.features` disables it; pass `factor: 0` to keep it off.
 */
export type GasOverrides = {
	/** Bounds for the features that have no entry of their own. */
	readonly default?:          GasFeatureOverride;
	/** Bounds for one {@link GasFeatureKey}. */
	readonly [feature: string]: GasFeatureOverride | undefined;
};

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
	/** Thresholds scaled by each feature factor before comparison, optionally bounded per feature (see {@link GasThresholdSpec}). */
	readonly thresholds:    FlowrGasThresholds;
	/** Per-feature sensitivity factors. Missing or `0` disables checking with zero overhead. */
	readonly features:      Record<string, number | undefined>;
	/**
	 * Custom heap statistics source (programmatic configs only), overriding the built-in
	 * detection (v8 module, then Chromium's performance.memory). Return undefined to skip the memory check.
	 */
	readonly heapProvider?: () => GasHeapStatistics | undefined;
}
