import { describe, test } from 'vitest';
import { assert } from 'chai';
import { FlowrConfig } from '../../../../src/config';
import { type GasHeapStatistics, GasLevel } from '../../../../src/gas';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { arraysGroupBy } from '../../../../src/util/collections/arrays';
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

function makeContext(plugins: FlowrAnalyzerGasPlugin[], gasFeatures: Record<string, number> = {}, heapProvider?: () => GasHeapStatistics | undefined): FlowrAnalyzerContext {
	const config: FlowrConfig = {
		...FlowrConfig.default(),
		gas: { ...FlowrConfig.default().gas, features: gasFeatures, heapProvider }
	};
	return new FlowrAnalyzerContext(config, arraysGroupBy(plugins, p => p.type));
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
});
