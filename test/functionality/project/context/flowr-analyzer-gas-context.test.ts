import { afterEach, describe, test, vi } from 'vitest';
import { assert } from 'chai';
import { FlowrConfig } from '../../../../src/config';
import { type FlowrGasThresholds, GasFeatureKey, type GasHeapStatistics, GasLevel } from '../../../../src/gas';
import { InvalidationEventType } from '../../../../src/project/cache/flowr-cache';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { FlowrAnalyzerGasPlugin } from '../../../../src/project/plugins/gas-plugins/flowr-analyzer-gas-plugin';
import { PluginType } from '../../../../src/project/plugins/flowr-analyzer-plugin';
import { SemVer } from 'semver';

/** Returns a fixed level for the given target key; defers (undefined) for all other keys. */
class FixedLevelGasPlugin extends FlowrAnalyzerGasPlugin {
	public readonly name        = 'fixed-level-gas-plugin';
	public readonly description = 'Returns a fixed gas level for testing.';
	public readonly version     = new SemVer('0.0.0');

	constructor(
		private readonly targetKey:   string,
		private readonly returnLevel: GasLevel
	) {
		super();
	}

	protected process(_ctx: FlowrAnalyzerContext, key: string): GasLevel | undefined {
		return key === this.targetKey ? this.returnLevel : undefined;
	}
}

function makeContext(plugins: FlowrAnalyzerGasPlugin[], gasFeatures: Record<string, number> = {}, heapProvider?: () => GasHeapStatistics | undefined, thresholds?: FlowrGasThresholds): FlowrAnalyzerContext {
	const base = FlowrConfig.default();
	const config: FlowrConfig = {
		...base,
		gas: { ...base.gas, features: gasFeatures, heapProvider, ...(thresholds ? { thresholds } : {}) }
	};
	return new FlowrAnalyzerContext(config, plugins);
}

/** A context whose slicer may run for `slicerMs` while everything else may run for `defaultMs`. */
function makeTimedContext(defaultMs: number, slicerMs: number, features: Record<string, number> = { slicer: 1, linter: 1 }): FlowrAnalyzerContext {
	return makeContext([], features, () => undefined, {
		memory: { problematic: 1, critical: 1 },
		timeMs: {
			default: { problematic: defaultMs, critical: defaultMs },
			slicer:  { problematic: slicerMs,  critical: slicerMs }
		}
	});
}

describe('FlowrAnalyzerGasContext', () => {
	test('no plugins and no feature factor always returns Normal', () => {
		const ctx = makeContext([]);
		assert.strictEqual(ctx.gas.checkGas('source'), GasLevel.Normal, 'disabled by default');
		assert.strictEqual(ctx.gas.checkGas('slicing'), GasLevel.Normal, 'any unknown key is Normal');
	});

	test('plugin escalates matching key; unrelated key stays Normal', () => {
		const plugin = new FixedLevelGasPlugin('source', GasLevel.Critical);
		assert.strictEqual(plugin.type, PluginType.Gas, 'plugin must carry the Gas type');
		const ctx = makeContext([plugin]);
		assert.strictEqual(ctx.gas.checkGas('source'),  GasLevel.Critical, 'plugin should escalate source to Critical');
		assert.strictEqual(ctx.gas.checkGas('slicing'), GasLevel.Normal,   'unrelated key must remain Normal');
	});

	test('multiple plugins: maximum level wins', () => {
		const mild    = new FixedLevelGasPlugin('source', GasLevel.Problematic);
		const severe  = new FixedLevelGasPlugin('source', GasLevel.Critical);
		const ctx     = makeContext([mild, severe]);
		assert.strictEqual(ctx.gas.checkGas('source'), GasLevel.Critical, 'max of Problematic and Critical must be Critical');
	});

	test('configured heapProvider overrides the built-in heap source', () => {
		const full  = makeContext([], { linter: 1 }, () => ({ used_heap_size: 100, heap_size_limit: 100 }));
		assert.strictEqual(full.gas.checkGas('linter'), GasLevel.Critical, 'a full heap must be Critical');
		const empty = makeContext([], { linter: 1 }, () => ({ used_heap_size: 0, heap_size_limit: 100 }));
		assert.strictEqual(empty.gas.checkGas('linter'), GasLevel.Normal, 'an empty heap (and fresh timer) must be Normal');
		const none  = makeContext([], { linter: 1 }, () => undefined);
		assert.strictEqual(none.gas.checkGas('linter'), GasLevel.Normal, 'a provider returning undefined skips memory checks');
	});

	describe('per-feature thresholds', () => {
		afterEach(() => vi.useRealTimers());

		test('each feature is bounded on its own merits', () => {
			vi.useFakeTimers();
			const ctx = makeTimedContext(60_000, 30_000);
			vi.advanceTimersByTime(30_000);
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'the slicer is only allowed 30s');
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Linter), GasLevel.Normal,   'the linter falls back to the 60s default');
			vi.advanceTimersByTime(30_000);
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Linter), GasLevel.Critical, 'the linter is out after 60s');
		});

		test('a directly given pair still bounds every feature', () => {
			vi.useFakeTimers();
			const ctx = makeContext([], { slicer: 1, linter: 1 }, () => undefined, {
				memory: { problematic: 1, critical: 1 },
				timeMs: { problematic: 1_000, critical: 2_000 }
			});
			vi.advanceTimersByTime(1_000);
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Problematic, 'the shared pair applies to the slicer');
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Linter), GasLevel.Problematic, 'and to the linter');
		});

		test('a feature entry only has to name the bound it changes', () => {
			vi.useFakeTimers();
			const ctx = makeContext([], { slicer: 1 }, () => undefined, {
				memory: { problematic: 1, critical: 1 },
				timeMs: { problematic: 1_000, critical: 10_000, slicer: { critical: 2_000 } }
			});
			vi.advanceTimersByTime(1_000);
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Problematic, 'the unnamed bound falls back to the shared pair');
			vi.advanceTimersByTime(1_000);
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'the named bound wins over the shared 10s');
		});
	});

	describe('threshold configuration', () => {
		test('the per-feature form is accepted by the config schema', () => {
			const parsed = FlowrConfig.parse(JSON.stringify({
				gas: {
					thresholds: {
						timeMs: {
							default: { problematic: 60_000, critical: 120_000 },
							slicer:  { problematic: 24_000, critical: 30_000 }
						}
					},
					features: { slicer: 1 }
				}
			}));
			assert.deepStrictEqual(parsed?.gas.thresholds.timeMs.slicer, { problematic: 24_000, critical: 30_000 }, 'the feature entry must survive validation');
			assert.deepStrictEqual(parsed?.gas.thresholds.timeMs.default, { problematic: 60_000, critical: 120_000 }, 'and so must the default');
		});

		test('a bare number is not a per-feature entry', () => {
			assert.isUndefined(FlowrConfig.parse(JSON.stringify({ gas: { thresholds: { timeMs: { slicer: 3 } } } })), 'a feature key must name a pair');
		});
	});

	describe('per-call overrides', () => {
		afterEach(() => vi.useRealTimers());

		test('naming a feature enables it and bounds it in milliseconds', () => {
			vi.useFakeTimers();
			const ctx = makeContext([]); // every feature disabled
			ctx.gas.withGas({ slicer: { critical: 1_000 } }, () => {
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'nothing spent yet');
				vi.advanceTimersByTime(1_000);
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'a stated bound is enforced even when the config disables the feature');
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Linter), GasLevel.Normal, 'unnamed features stay disabled');
			});
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'the override ends with the call');
		});

		test('the contingent is measured from the call, not from the analyzer', () => {
			vi.useFakeTimers();
			const ctx = makeContext([], { slicer: 1 }, () => undefined, {
				memory: { problematic: 1, critical: 1 },
				timeMs: { problematic: 1_000, critical: 1_000 }
			});
			vi.advanceTimersByTime(10_000);
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'the analyzer clock is long spent');
			ctx.gas.withGas(undefined, () => {
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'the operation gets a contingent of its own');
			});
		});

		test('factor 0 keeps a named feature off', () => {
			vi.useFakeTimers();
			const ctx = makeContext([]);
			ctx.gas.withGas({ slicer: { critical: 0, factor: 0 } }, () => {
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'an explicit factor of 0 disables the check');
			});
		});

		test('default covers the features without an entry of their own', () => {
			vi.useFakeTimers();
			const ctx = makeContext([]);
			ctx.gas.withGas({ default: { critical: 5_000 }, slicer: { critical: 1_000 } }, () => {
				vi.advanceTimersByTime(1_000);
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'the slicer entry wins');
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Source), GasLevel.Normal,   'source still has room');
				vi.advanceTimersByTime(4_000);
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Source), GasLevel.Critical, 'until the default bound is reached');
			});
		});

		test('a nested scope inherits the bounds but restarts the clock', () => {
			vi.useFakeTimers();
			const ctx = makeContext([]);
			ctx.gas.withGas({ slicer: { critical: 1_000 } }, () => {
				vi.advanceTimersByTime(1_000);
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'the enclosing contingent is spent');
				const scoped = ctx.gas.scope();
				assert.strictEqual(scoped.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'the scope starts fresh');
				vi.advanceTimersByTime(1_000);
				assert.strictEqual(scoped.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'while keeping the inherited 1s bound');
			});
		});

		test('a nested bound only replaces what it names', () => {
			vi.useFakeTimers();
			const ctx = makeContext([]);
			ctx.gas.withGas({ slicer: { problematic: 1_000, critical: 10_000 } }, () => {
				const scoped = ctx.gas.scope({ slicer: { critical: 2_000 } });
				vi.advanceTimersByTime(1_000);
				assert.strictEqual(scoped.checkGas(GasFeatureKey.Slicer), GasLevel.Problematic, 'the unnamed bound comes from the layer outside');
				vi.advanceTimersByTime(1_000);
				assert.strictEqual(scoped.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'the named bound wins over the outer 10s');
			});
		});

		test('the contingent of a rejected promise is released', async() => {
			const ctx = makeContext([]);
			await ctx.gas.withGas({ slicer: { critical: 0 } }, () => Promise.reject(new Error('boom'))).then(
				() => assert.fail('the rejection must propagate'),
				() => assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'the frame must be gone')
			);
		});
	});

	describe('restarting the contingent', () => {
		afterEach(() => vi.useRealTimers());

		/** a context whose slicer is out of gas after a second, with a second already spent */
		function spentContext(): FlowrAnalyzerContext {
			vi.useFakeTimers();
			const ctx = makeContext([], { slicer: 1 }, () => undefined, {
				memory: { problematic: 1, critical: 1 },
				timeMs: { problematic: 1_000, critical: 1_000 }
			});
			vi.advanceTimersByTime(1_000);
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'the contingent must start out spent');
			return ctx;
		}

		test('reset is supported API on the writeable context', () => {
			const ctx = spentContext();
			ctx.gas.reset();
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'the contingent restarts');
		});

		test('an invalidation restarts it, as the work has to be redone', () => {
			const ctx = spentContext();
			ctx.receive({ type: InvalidationEventType.Full });
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'a new analysis gets the full contingent');
		});

		test('adding a file restarts it', () => {
			const ctx = spentContext();
			ctx.addRequests([{ request: 'text', content: 'x <- 1' }]);
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'new sources mean new work');
		});

		test('a running operation keeps its own contingent', () => {
			const ctx = spentContext();
			ctx.gas.withGas(undefined, () => {
				vi.advanceTimersByTime(1_000);
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'the operation is out of gas');
				ctx.gas.reset();
				assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Critical, 'resetting must not un-bound a running traversal');
			});
			assert.strictEqual(ctx.gas.checkGas(GasFeatureKey.Slicer), GasLevel.Normal, 'the base contingent did restart');
		});
	});
});
