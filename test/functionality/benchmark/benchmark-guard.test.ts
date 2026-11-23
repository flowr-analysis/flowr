import { assert, describe, test } from 'vitest';
import { type BenchmarkValue, guardBenchmark, historyOf } from '../../../scripts/benchmark-guard';

function run(values: Record<string, number>): BenchmarkValue[] {
	return Object.entries(values).map(([name, value]) => ({ name, value }));
}

function failed(current: Record<string, number>, previous: Record<string, number>): string[] {
	return guardBenchmark(run(current), run(previous)).filter(c => c.failed).map(c => c.name);
}

describe('benchmark guard', () => {
	test('a reduction that drops fails, a small wobble does not', () => {
		assert.deepStrictEqual(failed({ 'reduction (characters)': 0.76 }, { 'reduction (characters)': 0.82 }), ['reduction (characters)']);
		assert.deepStrictEqual(failed({ 'reduction (characters)': 0.815 }, { 'reduction (characters)': 0.82 }), []);
		assert.deepStrictEqual(failed({ 'reduction (characters)': 0.9 }, { 'reduction (characters)': 0.82 }), []);
	});
	test('timings count by the calibration of their run', () => {
		/* the run got a machine half as fast, so twice the time is no regression */
		assert.deepStrictEqual(failed({ 'Linter run': 200, 'Calibration': 600 }, { 'Linter run': 100, 'Calibration': 300 }), []);
		assert.deepStrictEqual(failed({ 'Linter run': 200, 'Calibration': 300 }, { 'Linter run': 100, 'Calibration': 300 }), ['Linter run']);
		assert.deepStrictEqual(failed({ 'Linter run': 120, 'Calibration': 300 }, { 'Linter run': 100, 'Calibration': 300 }), []);
	});
	test('a timing without a calibration, or a metric the previous run lacks, is not checked', () => {
		assert.deepStrictEqual(guardBenchmark(run({ 'Linter run': 900 }), run({ 'Linter run': 100 })), []);
		assert.deepStrictEqual(guardBenchmark(run({ 'reduction (lines)': 0.1 }), run({})), []);
	});
	test('other metrics are left alone', () => {
		assert.deepStrictEqual(guardBenchmark(run({ 'memory (df-graph)': 9e9, 'Calibration': 1 }), run({ 'memory (df-graph)': 1, 'Calibration': 1 })), []);
	});
	test('the recorded history reads, with calibrated runs', () => {
		const history = historyOf('wiki/stats/benchmark/data.js', '"real-world" Benchmark Suite (tree-sitter)');
		assert.isAbove(history.length, 1);
		assert.isTrue(history.at(-1)?.some(b => b.name === 'Calibration'));
	});
});
