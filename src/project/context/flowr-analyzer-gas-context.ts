import {
	type FlowrGasConfig,
	type GasFeatureOverride,
	type GasHeapStatistics,
	GasLevel,
	type GasOverrides,
	type GasThresholdPair,
	type GasThresholdSpec,
	type DataflowBudget,
	DataflowBudgetTracker,
	isBoundedBudget
} from '../../gas';
import type { FlowrAnalyzerGasPlugin } from '../plugins/gas-plugins/flowr-analyzer-gas-plugin';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import { DefaultCountedCheckEvery } from '../../config';
import { log } from '../../util/log';
import type { InvalidationEvent, InvalidationEventReceiver } from '../cache/flowr-cache';

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

type Bound = 'problematic' | 'critical';
/** the sampled dimensions {@link FlowrAnalyzerGasContext.checkGas} reads, plus the counted ones a budget arms */
type Dimension = 'timeMs' | 'memory' | 'steps' | 'vertices';

/** One contingent, one operation: a slice is not billed for the analysis that preceded it. */
interface GasScope {
	/** what the elapsed-time bounds are measured from */
	startTime:       number;
	/** the {@link GasOverrides} in effect, innermost last */
	readonly layers: readonly GasOverrides[];
}

function isPair(v: number | Partial<GasThresholdPair> | undefined): v is Partial<GasThresholdPair> {
	return typeof v === 'object' && v !== null;
}

/** feature entry, then `default`, then the shared pair */
function configuredBound(spec: GasThresholdSpec | undefined, feature: string, bound: Bound): number | undefined {
	const own = spec?.[feature];
	if(isPair(own) && own[bound] !== undefined) {
		return own[bound];
	}
	const fallback = spec?.default?.[bound];
	if(fallback !== undefined) {
		return fallback;
	}
	const shared = spec?.[bound];
	return typeof shared === 'number' ? shared : undefined;
}

/** a bare number is an elapsed-time bound in ms */
function overriddenBound(entry: GasFeatureOverride | undefined, dim: Dimension, bound: Bound): number | undefined {
	return entry?.[dim]?.[bound] ?? (dim === 'timeMs' ? entry?.[bound] : undefined);
}

function entryOf(layer: GasOverrides, key: string): GasFeatureOverride | undefined {
	return layer[key] ?? layer.default;
}

function isThenable(v: unknown): v is PromiseLike<unknown> {
	return typeof (v as PromiseLike<unknown> | undefined)?.then === 'function';
}

/** Read-only gas context exposed via `ctx.gas`. */
export interface ReadOnlyFlowrAnalyzerGasContext {
	readonly name: string;
	/**
	 * Returns the resource-pressure level for `key` (`config.gas.features[key]`).
	 * Returns `GasLevel.Normal` with zero overhead when the feature factor is 0 or absent
	 * and no gas plugins are registered (plugins are always consulted and may escalate any key).
	 *
	 * Measured from the start of the enclosing contingent, against the thresholds configured for `key`
	 * (see {@link GasThresholdSpec}), not one allowance shared by everything the analyzer does.
	 */
	checkGas(key: string): GasLevel;
	/**
	 * The counted bounds of `key`, resolved once against the current contingent, or `undefined` when disabled or
	 * unbounded. Arming counterpart of {@link checkGas} for the dataflow fold, see {@link GasFeatureKey.Dataflow}.
	 */
	budget(key: string): DataflowBudgetTracker | undefined;
	/**
	 * A view with a fresh contingent, measured from this call, for one operation to run against.
	 * The enclosing bounds still apply, `overrides` winning over them. Derives a new object rather than
	 * mutating this one, so it is safe for nested and concurrent work.
	 */
	scope(overrides?: GasOverrides): ReadOnlyFlowrAnalyzerGasContext;
}

/**
 * The gas context as the owner of the analyzer sees it, reachable via `analyzer.context().gas`.
 * Adds the operations that restart a contingent to {@link ReadOnlyFlowrAnalyzerGasContext}.
 */
export interface WriteableFlowrAnalyzerGasContext extends ReadOnlyFlowrAnalyzerGasContext {
	/** see {@link FlowrAnalyzerGasContext#reset} */
	reset(): void;
	/** see {@link FlowrAnalyzerGasContext#withGas} */
	withGas<T>(overrides: GasOverrides | undefined, fn: () => T): T;
}

/** Checks heap and elapsed-time pressure for named analysis features. See {@link ReadOnlyFlowrAnalyzerGasContext}. */
export class FlowrAnalyzerGasContext implements WriteableFlowrAnalyzerGasContext, InvalidationEventReceiver {
	public readonly name = 'flowr-analyzer-gas-context';
	/** what a gas check falls back to when no operation declared a contingent of its own */
	private readonly base:    GasScope;
	/** the contingents of the operations in flight, innermost last */
	private readonly frames:  GasScope[] = [];
	private readonly config:  FlowrGasConfig | undefined;
	private readonly ctx:     FlowrAnalyzerContext;
	private readonly plugins: readonly FlowrAnalyzerGasPlugin[];

	constructor(ctx: FlowrAnalyzerContext, config: FlowrGasConfig | undefined, plugins: readonly FlowrAnalyzerGasPlugin[]) {
		this.ctx     = ctx;
		this.config  = config;
		this.plugins = plugins;
		this.base    = { startTime: Date.now(), layers: [] };
	}

	/**
	 * Restart the contingent, so what follows is measured from now. Supported API: call it between phases
	 * that should each get the full allowance (`analyzer.context().gas.reset()`).
	 *
	 * flowR calls it itself whenever a new analysis begins, so a caller only has to split its *own* phases.
	 * Operations in flight keep their contingent, as restarting a running traversal's clock would defeat the
	 * guard bounding it.
	 */
	public reset(): void {
		this.base.startTime = Date.now();
	}

	/** A new analysis makes the spent contingent irrelevant. */
	public receive(_event: InvalidationEvent): void {
		this.reset();
	}

	/**
	 * Run `fn` against a fresh contingent bounded by `overrides`, ending when it settles if `fn` is async.
	 * Every check while `fn` runs sees it, however deep, which is how the bounds reach sites that only ever
	 * get a context handed to them.
	 *
	 * Being ambient, concurrent operations on one analyzer see whichever started last, so prefer
	 * {@link scope} wherever the context can be threaded through.
	 */
	public withGas<T>(overrides: GasOverrides | undefined, fn: () => T): T {
		const frame = this.derive(overrides);
		this.frames.push(frame);
		let result: T;
		try {
			result = fn();
		} catch(e) {
			this.drop(frame);
			throw e;
		}
		if(isThenable(result)) {
			return result.then(v => {
				this.drop(frame); return v;
			}, (e: unknown) => {
				this.drop(frame); throw e;
			}) as T;
		}
		this.drop(frame);
		return result;
	}

	public scope(overrides?: GasOverrides): ReadOnlyFlowrAnalyzerGasContext {
		return this.viewOf(this.derive(overrides));
	}

	private derive(overrides: GasOverrides | undefined, from?: GasScope): GasScope {
		const inherited = (from ?? this.activeScope()).layers;
		return { startTime: Date.now(), layers: overrides ? [...inherited, overrides] : inherited };
	}

	private viewOf(scope: GasScope): ReadOnlyFlowrAnalyzerGasContext {
		return {
			name:     `${this.name}:scope`,
			checkGas: key => this.levelFor(key, scope),
			budget:   key => this.budgetFor(key, scope),
			scope:    o => this.viewOf(this.derive(o, scope))
		};
	}

	private drop(frame: GasScope): void {
		const idx = this.frames.lastIndexOf(frame);
		if(idx >= 0) {
			this.frames.splice(idx, 1);
		}
	}

	private activeScope(): GasScope {
		return this.frames.length > 0 ? this.frames[this.frames.length - 1] : this.base;
	}

	/**
	 * The innermost layer stating this bound wins, the configured thresholds apply when none does.
	 * Resolved per bound, so a layer naming only `critical` leaves `problematic` to the layer outside it.
	 */
	private bound(scope: GasScope, key: string, dim: Dimension, bound: Bound): number {
		for(let i = scope.layers.length - 1; i >= 0; i--) {
			const stated = overriddenBound(entryOf(scope.layers[i], key), dim, bound);
			if(stated !== undefined) {
				return stated;
			}
		}
		return configuredBound(this.config?.thresholds?.[dim], key, bound) ?? Number.POSITIVE_INFINITY;
	}

	/** An override naming the feature enables it even when the config disables it. */
	private factorFor(scope: GasScope, key: string): number {
		const configured = this.config?.features?.[key] ?? 0;
		let named = false;
		for(let i = scope.layers.length - 1; i >= 0; i--) {
			const entry = entryOf(scope.layers[i], key);
			if(entry?.factor !== undefined) {
				return entry.factor;
			}
			named ||= entry !== undefined;
		}
		return named ? configured || 1 : configured;
	}

	private memoryLevel(factor: number, key: string, scope: GasScope): GasLevel {
		const stats = this.config?.heapProvider ? this.config.heapProvider() : tryGetHeapStatistics();
		if(stats === undefined || stats.heap_size_limit <= 0) {
			return GasLevel.Normal;
		}
		const ratio = (stats.used_heap_size / stats.heap_size_limit) * factor;
		if(ratio >= this.bound(scope, key, 'memory', 'critical'))    {
			return GasLevel.Critical;
		}
		if(ratio >= this.bound(scope, key, 'memory', 'problematic')) {
			return GasLevel.Problematic;
		}
		return GasLevel.Normal;
	}

	private static maxLevel(a: GasLevel, b: GasLevel): GasLevel {
		return a >= b ? a : b;
	}

	private timeLevel(factor: number, key: string, scope: GasScope): GasLevel {
		const elapsed = (Date.now() - scope.startTime) * factor;
		if(elapsed >= this.bound(scope, key, 'timeMs', 'critical'))    {
			return GasLevel.Critical;
		}
		if(elapsed >= this.bound(scope, key, 'timeMs', 'problematic')) {
			return GasLevel.Problematic;
		}
		return GasLevel.Normal;
	}

	public checkGas(key: string): GasLevel {
		return this.levelFor(key, this.activeScope());
	}

	public budget(key: string): DataflowBudgetTracker | undefined {
		return this.budgetFor(key, this.activeScope());
	}

	/** The bounds `key` is armed with, pre-divided by its factor so the tracker only ever compares, never multiplies. */
	private budgetFor(key: string, scope: GasScope): DataflowBudgetTracker | undefined {
		const factor = this.factorFor(scope, key);
		if(!factor) {
			return undefined;   // disabled, which is what keeps an unarmed run free of the guard entirely
		}
		const cap = (dim: Dimension): number => {
			const bound = this.bound(scope, key, dim, 'critical');
			return Number.isFinite(bound) ? Math.max(1, Math.floor(bound / factor)) : 0;
		};
		const budget: DataflowBudget = { steps: cap('steps'), vertices: cap('vertices'), timeMs: cap('timeMs') };
		return isBoundedBudget(budget)
			? new DataflowBudgetTracker(budget, scope.startTime, this.config?.countedCheckEvery ?? DefaultCountedCheckEvery)
			: undefined;
	}

	private levelFor(key: string, scope: GasScope): GasLevel {
		const factor = this.factorFor(scope, key);
		if(!factor && this.plugins.length === 0) {
			return GasLevel.Normal;
		}

		let level = GasLevel.Normal;

		if(factor) {
			level = FlowrAnalyzerGasContext.maxLevel(level, this.memoryLevel(factor, key, scope));
			if(level < GasLevel.Critical) {
				level = FlowrAnalyzerGasContext.maxLevel(level, this.timeLevel(factor, key, scope));
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
