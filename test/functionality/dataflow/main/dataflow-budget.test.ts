import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { BudgetDimension, GasFeatureKey, type GasThresholdSpec } from '../../../../src/gas';
import { VertexType } from '../../../../src/dataflow/graph/vertex';

/** enough statements that a small bound is reached long before the end */
const Code = Array.from({ length: 200 }, (_, i) => `x${i} <- ${i} + 1\nprint(x${i})`).join('\n');

/** the counted bounds an armed {@link GasFeatureKey.Dataflow} budget reads */
interface Bounds {
	readonly steps?:    number;
	readonly vertices?: number;
	readonly timeMs?:   number;
	/** the feature factor, which scales every bound; `1` leaves them as written */
	readonly factor?:   number;
	/** @see {@link FlowrGasConfig.countedCheckEvery} */
	readonly every?:    number;
}

/** the threshold spec stating `critical` for the dataflow key alone, `undefined` when the bound is not set */
function critical(bound: number | undefined): GasThresholdSpec | undefined {
	return bound === undefined ? undefined : { [GasFeatureKey.Dataflow]: { critical: bound } };
}

/** analyze {@link Code}, arming the dataflow budget with `bounds`; without them the key stays disabled */
async function analyze(bounds?: Bounds) {
	const builder = new FlowrAnalyzerBuilder();
	if(bounds !== undefined) {
		builder.amendConfig(c => {
			c.gas.features[GasFeatureKey.Dataflow] = bounds.factor ?? 1;
			c.gas.countedCheckEvery = bounds.every;
			c.gas.thresholds.steps = critical(bounds.steps);
			c.gas.thresholds.vertices = critical(bounds.vertices);
			/* timeMs ships a default, so an unset bound has to leave it be rather than clear it */
			c.gas.thresholds.timeMs = critical(bounds.timeMs) ?? c.gas.thresholds.timeMs;
		});
	}
	const df = await (await builder.build()).addRequest(Code).dataflow();
	return { df, vertices: [...df.graph.vertices(true)].length };
}

describe('The dataflow budget, armed by gas', () => {
	test('a disabled feature, or an enabled one with no counted bound, arms nothing and the whole graph is built', async() => {
		const disabled = await analyze();
		assert.isUndefined(disabled.df.cutShort);
		assert.isAbove(disabled.vertices, 1000);
		/* the shipped `timeMs` default is minutes, so nothing here reaches it */
		assert.isUndefined((await analyze({})).df.cutShort);
	});

	test('a step bound returns the partial graph, flagged, and the feature factor scales a counted bound', async() => {
		const full = await analyze();
		const { df, vertices } = await analyze({ steps: 50 });
		assert.strictEqual(df.cutShort?.dimension, BudgetDimension.Steps);
		assert.strictEqual(df.cutShort?.limit, 50);
		assert.isAbove(vertices, 0, 'what was processed before the bound is still there');
		assert.isBelow(vertices, full.vertices, 'and the rest is not');
		const scaled = await analyze({ steps: 100, factor: 2 });
		assert.strictEqual(scaled.df.cutShort?.limit, 50, 'twice as sensitive, so 100 steps bound at 50');
	});

	test('a vertex bound bounds the work, not the resulting graph; a coarser granularity overshoots by at most one block', async() => {
		const fine = await analyze({ vertices: 30, every: 1 });
		assert.strictEqual(fine.df.cutShort?.dimension, BudgetDimension.Vertices);
		/* vertices are billed as created, so the graph that survives the merges holds no more than the bound */
		assert.isAtMost(fine.vertices, 31);
		const coarse = await analyze({ vertices: 30, every: 16 });
		assert.strictEqual(coarse.df.cutShort?.dimension, BudgetDimension.Vertices);
		/* the counters are sampled, so what a bound promises is "not far past", not "never past" */
		assert.isAbove(coarse.vertices, 31, 'the block is only booked once it is full');
		assert.isAtMost(coarse.vertices, 30 + 16);
	});

	test('a time bound ends a long analysis', async() => {
		/* checked every step, so the deadline cannot be overshot by a whole batch of them */
		const { df } = await analyze({ timeMs: 1, every: 1 });
		assert.strictEqual(df.cutShort?.dimension, BudgetDimension.Time);
	});

	test('the partial graph is still a usable graph', async() => {
		const { df } = await analyze({ steps: 80 });
		assert.isDefined(df.cutShort);
		assert.isAbove([...df.graph.verticesOfType(VertexType.FunctionCall)].length, 0);
	});
});
