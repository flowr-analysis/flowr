import { describe, expect, test } from 'vitest';
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
}));
