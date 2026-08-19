import { describe, expect, test, vi } from 'vitest';
import { SemVer } from 'semver';
import { withTreeSitter } from '../../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { FlowrAnalyzerGasPlugin } from '../../../../../src/project/plugins/gas-plugins/flowr-analyzer-gas-plugin';
import { GasFeatureKey, GasLevel } from '../../../../../src/gas';
import { staticSlice } from '../../../../../src/slicing/static/static-slicer';
import { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import type { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

/** Stands in for an embedder that wants to bound the analysis: it reports the slicer as out of resources. */
class NoSlicerGasPlugin extends FlowrAnalyzerGasPlugin {
	public readonly name        = 'no-slicer-gas-plugin';
	public readonly description = 'Reports critical pressure for the slicer.';
	public readonly version     = new SemVer('0.0.0');

	protected process(_ctx: unknown, key: string): GasLevel | undefined {
		return key === GasFeatureKey.Slicer ? GasLevel.Critical : undefined;
	}
}

const code = 'x <- 1\ny <- x + 1\nprint(y)';

async function slice(ts: TreeSitterExecutor, plugins: FlowrAnalyzerGasPlugin[]) {
	let builder = new FlowrAnalyzerBuilder().setParser(ts);
	for(const plugin of plugins) {
		builder = builder.registerPlugins(plugin);
	}
	const analyzer = await builder.build();
	analyzer.addRequest(code);
	const ast = await analyzer.normalize();
	return staticSlice({
		ctx:  analyzer.context(),
		info: await analyzer.dataflow(),
		ast,
		ids:  [SlicingCriterion.parse('3@y', ast.idMap)]
	});
}

describe('Slicing under gas', withTreeSitter(ts => {
	test('the traversal is complete while there is gas', async() => {
		const result = await slice(ts, []);
		expect(result.stoppedEarly).toBeUndefined();
		expect(result.result.size).toBeGreaterThan(1);
	});

	test('critical pressure stops the traversal and says so', async() => {
		const result = await slice(ts, [new NoSlicerGasPlugin()]);
		expect(result.stoppedEarly).toBe(true);
		// the seed was enqueued but never processed, so nothing it reads is in the result
		expect(result.result.size).toBe(1);
	});

	test('a truncated slice says how far it got', async() => {
		const result = await slice(ts, [new NoSlicerGasPlugin()]);
		expect(result.progress).toStrictEqual({ visited: 0, frontier: 1 });
	});

	test('a complete slice reports no progress, as there is nothing to judge', async() => {
		const result = await slice(ts, []);
		expect(result.progress).toBeUndefined();
	});

	/** the contingent used to run from the creation of the analyzer, so an analysis and its slices shared one clock */
	describe('the contingent belongs to the operation', () => {
		/** out of gas 25ms into any one operation; the heap must not interfere, this is about the clock */
		async function boundedAnalyzer() {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts)
				.configure('gas', {
					thresholds:   { memory: { problematic: 1, critical: 1 }, timeMs: { problematic: 25, critical: 25 } },
					features:     { [GasFeatureKey.Slicer]: 1 },
					heapProvider: () => undefined
				})
				.build();
			analyzer.addRequest(code);
			return analyzer;
		}

		const spend = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

		test('slices after a long analysis still run', async() => {
			const analyzer = await boundedAnalyzer();
			const ast = await analyzer.normalize();
			const info = await analyzer.dataflow();
			/* the clock is driven by hand from here on, so a slow machine cannot spend the contingent for us */
			vi.useFakeTimers({ now: Date.now() });
			try {
				vi.advanceTimersByTime(50); // the analysis and the slices before

				for(let i = 0; i < 3; i++) {
					const result = staticSlice({ ctx: analyzer.context(), info, ast, ids: [SlicingCriterion.parse('3@y', ast.idMap)] });
					expect(result.stoppedEarly, `slice ${i} must get a contingent of its own`).toBeUndefined();
					expect(result.result.size).toBeGreaterThan(1);
					vi.advanceTimersByTime(30);
				}
			} finally {
				vi.useRealTimers();
			}
		});

		test('resetting restarts the clock the next analysis runs against', async() => {
			const analyzer = await boundedAnalyzer();
			const gas = analyzer.context().gas;
			await spend(50);
			expect(gas.checkGas(GasFeatureKey.Slicer), 'the base contingent must be spent').toBe(GasLevel.Critical);
			gas.reset();
			expect(gas.checkGas(GasFeatureKey.Slicer), 'reset must restart it').toBe(GasLevel.Normal);
		});

		test('adding a file restarts the clock', async() => {
			const analyzer = await boundedAnalyzer();
			await spend(50);
			expect(analyzer.context().gas.checkGas(GasFeatureKey.Slicer)).toBe(GasLevel.Critical);
			analyzer.addRequest('z <- 3');
			expect(analyzer.context().gas.checkGas(GasFeatureKey.Slicer), 'new sources mean a new analysis').toBe(GasLevel.Normal);
		});
	});

	test('a per-call bound reaches the slice and ends with the call', async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(code);
		const bounded = await analyzer.query([{ type: 'static-slice', criteria: ['3@y'], noReconstruction: true }],
			{ gas: { [GasFeatureKey.Slicer]: { critical: 0 } } });
		const boundedSlice = Object.values(bounded['static-slice'].results)[0].slice;
		expect(boundedSlice.stoppedEarly).toBe(true);
		expect(boundedSlice.progress?.frontier).toBeGreaterThan(0);

		const free = await analyzer.query([{ type: 'static-slice', criteria: ['3@y'], noReconstruction: true }]);
		const freeSlice = Object.values(free['static-slice'].results)[0].slice;
		expect(freeSlice.stoppedEarly).toBeUndefined();
		expect(freeSlice.result.size).toBeGreaterThan(1);
	});
}));
