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
	Slicer:            'slicer',
	/**
	 * Gas key for the dataflow extraction itself. Unlike the keys above it is not asked per site but *armed*
	 * once per run (see {@link ReadOnlyFlowrAnalyzerGasContext.budget}): its bounds are counted as the fold
	 * goes, and reaching one ends the extraction with the partial graph it built so far.
	 */
	Dataflow:          'dataflow'
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
	readonly memory:    GasThresholdSpec;
	/** Elapsed analysis time thresholds in milliseconds (before factor scaling). */
	readonly timeMs:    GasThresholdSpec;
	/**
	 * Processed-AST-node thresholds (before factor scaling), counted rather than sampled. Only the keys that
	 * arm a budget read this, i.e. {@link GasFeatureKey.Dataflow}; absent means the count is unbounded.
	 */
	readonly steps?:    GasThresholdSpec;
	/** Created-dataflow-vertex thresholds, counted like {@link FlowrGasThresholds.steps}. */
	readonly vertices?: GasThresholdSpec;
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
	/** Overrides `config.gas.thresholds.steps` for this call, for a key that arms a budget. */
	readonly steps?:       Partial<GasThresholdPair>;
	/** Overrides `config.gas.thresholds.vertices` for this call, for a key that arms a budget. */
	readonly vertices?:    Partial<GasThresholdPair>;
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
	readonly thresholds:         FlowrGasThresholds;
	/** Per-feature sensitivity factors. Missing or `0` disables checking with zero overhead. */
	readonly features:           Record<string, number | undefined>;
	/**
	 * How many calls one accounting of an armed budget covers (default `DefaultCountedCheckEvery`). The
	 * counters are sampled at this granularity, so it trades how far a run may overshoot a bound against what
	 * the guard costs per node: `1` counts exactly, a large value counts in coarse blocks. Since a budget only
	 * has to catch work that has run away, the default is coarse.
	 */
	readonly countedCheckEvery?: number;
	/**
	 * Custom heap statistics source (programmatic configs only), overriding the built-in
	 * detection (v8 module, then Chromium's performance.memory). Return undefined to skip the memory check.
	 */
	readonly heapProvider?:      () => GasHeapStatistics | undefined;
}

/* --- the counted side of the guard ------------------------------------------------------------------------
 *
 * The keys above are *asked*: a site calls `checkGas` and decides what to skip. The dataflow fold has no such
 * site -- it is one cheap step repeated millions of times -- so `GasFeatureKey.Dataflow` is *armed* instead
 * (see `gas.budget`) and counted as the fold goes. Reaching a bound stops the descent and the partial graph is
 * returned carrying its `cutShort`, so one pathological package degrades to a recorded partial result rather
 * than taking the worker with it.
 */

/** The dimension a {@link DataflowBudget} ran out in. */
export const enum BudgetDimension {
	/** processed AST nodes (see `processDataflowFor`) */
	Steps    = 'steps',
	/** vertices added to any graph of the extraction */
	Vertices = 'vertices',
	/** elapsed wall-clock time */
	Time     = 'time'
}

/**
 * The bounds of one extraction, as {@link ReadOnlyFlowrAnalyzerGasContext.budget} resolves them from the gas
 * thresholds: already scaled by the feature factor, so the tracker only ever compares. A dimension the
 * configuration leaves out arrives as `0`, which is unbounded.
 */
export interface DataflowBudget {
	/** Maximum number of AST nodes to process. */
	readonly steps?:    number;
	/** Maximum number of dataflow vertices to create. */
	readonly vertices?: number;
	/** Maximum wall-clock time of the extraction, in milliseconds, measured from the gas contingent's start. */
	readonly timeMs?:   number;
}

/** What ended an extraction early, attached to the partial result as {@link DataflowInformation.cutShort}. */
export interface DataflowBudgetExhaustion {
	/** which bound was hit */
	readonly dimension: BudgetDimension;
	/** the bound as it applied, i.e. after the gas feature factor scaled it */
	readonly limit:     number;
	/**
	 * What the dimension stood at when the bound was seen to be past. Sampled like the counters themselves,
	 * so it overshoots the limit by up to one {@link FlowrGasConfig.countedCheckEvery} block.
	 */
	readonly reached:   number;
}

/** Whether `budget` bounds anything at all; an unbounded one is never armed. */
export function isBoundedBudget(budget: DataflowBudget | undefined): budget is DataflowBudget {
	return budget !== undefined && ((budget.steps ?? 0) > 0 || (budget.vertices ?? 0) > 0 || (budget.timeMs ?? 0) > 0);
}

/**
 * Counts what one extraction spends and reports when its {@link DataflowBudget} is used up.
 *
 * Both counters are **sampled, not exact**: the hot paths only decrement a countdown and compare it, and the
 * accounting runs once every {@link FlowrGasConfig.countedCheckEvery} calls, booking a whole block at a time.
 * A bound may therefore be overshot by up to that many steps or vertices, which is what makes the guard cost
 * two operations per node instead of five. It is a safety net around runaway work, and a net woven that finely
 * would cost more than what it catches.
 */
export class DataflowBudgetTracker {
	private readonly stepLimit:   number;
	private readonly vertexLimit: number;
	private readonly deadline:    number;
	private readonly every:       number;
	/** steps left before the next accounting; the only thing {@link step} touches while the budget holds */
	private untilStep:            number;
	/** vertices left before the next accounting, see {@link untilStep} */
	private untilVertex:          number;
	private steps    = 0;
	private vertices = 0;
	private hit:                  DataflowBudgetExhaustion | undefined;

	/**
	 * @param budget - the resolved bounds, see {@link ReadOnlyFlowrAnalyzerGasContext.budget}
	 * @param since  - what the elapsed-time bound is measured from, i.e. the gas contingent's start
	 * @param every  - how many calls one accounting covers, see {@link FlowrGasConfig.countedCheckEvery}
	 */
	constructor(budget: DataflowBudget, since: number, every: number) {
		this.stepLimit = budget.steps ?? 0;
		this.vertexLimit = budget.vertices ?? 0;
		this.deadline = (budget.timeMs ?? 0) > 0 ? since + (budget.timeMs as number) : Number.POSITIVE_INFINITY;
		this.every = Math.max(1, every);
		this.untilStep = this.every;
		this.untilVertex = this.every;
	}

	/** What ended the extraction early, `undefined` while the budget holds. */
	public get exhausted(): DataflowBudgetExhaustion | undefined {
		return this.hit;
	}

	/**
	 * Books one processed node, returning whether the budget is used up (so the caller must not descend).
	 * Only every {@link FlowrGasConfig.countedCheckEvery}-th call does more than count down.
	 */
	public step(): boolean {
		if(--this.untilStep > 0) {
			return false;
		}
		/* an exhausted budget answers on every call from here on, so the fold stops at the next node */
		this.untilStep = 1;
		if(this.hit !== undefined) {
			return true;
		}
		this.untilStep = this.every;
		this.steps += this.every;
		if(this.stepLimit > 0 && this.steps > this.stepLimit) {
			return this.exceed(BudgetDimension.Steps, this.stepLimit, this.steps);
		}
		if(this.deadline !== Number.POSITIVE_INFINITY && Date.now() > this.deadline) {
			return this.exceed(BudgetDimension.Time, this.deadline, Date.now());
		}
		return false;
	}

	/**
	 * Books one created vertex, sampled like {@link step}. Counted as *created*: a subtree's vertices are
	 * billed even when the graph they were built in is later merged away, so the count bounds the work done
	 * rather than the size of the final graph.
	 */
	public vertex(): void {
		if(--this.untilVertex > 0) {
			return;
		}
		this.untilVertex = this.every;
		this.vertices += this.every;
		if(this.hit === undefined && this.vertexLimit > 0 && this.vertices > this.vertexLimit) {
			this.exceed(BudgetDimension.Vertices, this.vertexLimit, this.vertices);
		}
	}

	private exceed(dimension: BudgetDimension, limit: number, reached: number): true {
		this.hit = { dimension, limit, reached };
		return true;
	}
}

/**
 * The tracker of the extraction currently running, or `undefined` when the gas context armed none.
 * A live binding rather than a getter, so the graph's `addVertex` pays a null check and nothing else -- an
 * unarmed run measures the same as one without the guard at all. Set it only through {@link withDataflowBudget}.
 */
export let activeDataflowBudget: DataflowBudgetTracker | undefined = undefined;

/**
 * Runs `fn` with `tracker` as the {@link activeDataflowBudget}, restoring whatever was active before (so a
 * nested extraction bills the budget it was started under rather than replacing it).
 */
export function withDataflowBudget<T>(tracker: DataflowBudgetTracker | undefined, fn: () => T): T {
	const previous = activeDataflowBudget;
	activeDataflowBudget = tracker ?? previous;
	try {
		return fn();
	} finally {
		activeDataflowBudget = previous;
	}
}
