import path from 'node:path';
import { createRequire } from 'node:module';
import { assert, describe, test } from 'vitest';

/** the helpers of the benchmark page, which ships as a plain script and registers itself globally */
interface BenchStats {
	median(values: readonly (number | null)[]): number;
	rollingMedian(values: readonly (number | null)[], window: number): (number | null)[];
	baselineOf(values: readonly (number | null)[], n: number): number;
	toPercentDelta(values: readonly (number | null)[], baseline: number): (number | null)[];
	calibrationFactors(values: readonly (number | null)[]): number[];
	applyFactors(values: readonly (number | null)[], factors: readonly number[] | null): (number | null)[];
	parseVersion(message: string): { major: number, minor: number, patch: number, text: string } | null;
	releaseBumps(runs: readonly { commit: { message: string } }[]): { index: number, version: string, kind: string }[];
	segments(values: readonly (number | null)[]): number[][];
	ticks(min: number, max: number, count: number): { lo: number, hi: number, step: number, values: number[] };
	groupOf(name: string, unit: string): string;
	betterOf(name: string, unit: string): string;
	shortName(name: string): string;
	tagLabel(tag: string): string;
	GROUPS: readonly { id: string, perVersion?: boolean, facts?: boolean }[];
}

/* the page is not part of the TypeScript project, so it is loaded by path rather than imported */
const S = createRequire(__filename)(path.join(process.cwd(), 'wiki/stats/benchmark/stats.js')) as BenchStats;

describe('Benchmark page helpers', () => {
	test('summarize a series', () => {
		assert.strictEqual(S.median([3, 1, 2]), 2);
		assert.strictEqual(S.median([null, 5, null]), 5);
		assert.ok(Number.isNaN(S.median([])), 'nothing has no median');
		assert.deepStrictEqual(S.rollingMedian([1, 1, 9, 1, 1], 3), [1, 1, 1, 1, 1], 'a spike is smoothed away');
		assert.deepStrictEqual(S.rollingMedian([1, 2, 3], 1), [1, 2, 3], 'a window of one changes nothing');
		assert.deepStrictEqual(S.rollingMedian([1, null, 3], 3), [1, null, 3], 'holes stay holes');
	});

	test('relate a series to its recent baseline', () => {
		assert.strictEqual(S.baselineOf([1, 2, 3, 10, 20, 30], 3), 20);
		assert.deepStrictEqual(S.toPercentDelta([50, 100, 150], 100), [-50, 0, 50]);
		assert.deepStrictEqual(S.toPercentDelta([0], 0), [0], 'nothing against nothing is no change');
		assert.deepStrictEqual(S.toPercentDelta([5], 0), [null], 'something against nothing has no percentage');
	});

	test('cancel out the machine with a calibration series', () => {
		const factors = S.calibrationFactors([100, 125, 100]);
		assert.deepStrictEqual(factors, [1, 1.25, 1], 'the median run is the reference');
		assert.deepStrictEqual(S.applyFactors([200, 250, 200], factors), [200, 200, 200]);
		assert.deepStrictEqual(S.applyFactors([200], null), [200], 'without a calibration nothing changes');
	});

	test('read the version of a run', () => {
		assert.deepStrictEqual(S.parseVersion('[release:patch] 2.13.12 fix: ggplot'),
			{ major: 2, minor: 13, patch: 12, text: '2.13.12' });
		assert.strictEqual(S.parseVersion('no version here'), null);
		const runs = ['2.13.1 a', '2.13.2 b', '2.14.0 c', 'nothing', '3.0.0 d'].map(m => ({ commit: { message: m } }));
		assert.deepStrictEqual(S.releaseBumps(runs).map(b => b.version + ' ' + b.kind), ['2.14.0 minor', '3.0.0 major'],
			'patches are too frequent to mark');
	});

	test('draw only what there is data for', () => {
		assert.deepStrictEqual(S.segments([1, null, 2, 3]), [[0], [2, 3]], 'a gap is never bridged');
		const t = S.ticks(2, 80, 5);
		assert.ok(t.values.includes(0), 'the axis always contains zero');
		assert.ok(t.step > 0 && isFinite(t.step));
	});

	test('name and group the measurements', () => {
		assert.strictEqual(S.shortName('Retrieve AST from R code'), 'Parse');
		assert.strictEqual(S.shortName('Dataflow per 100 lines'), 'Dataflow per 100 lines');
		assert.strictEqual(S.tagLabel('smell'), 'Code smell');
		assert.strictEqual(S.tagLabel('shiny'), 'Shiny', 'an unknown tag still reads as a word');
		assert.strictEqual(S.groupOf('Produce dataflow information', 'ms'), 'per-file');
		assert.strictEqual(S.groupOf('memory (cfg-graph)', 'KiB'), 'memory');
		assert.strictEqual(S.groupOf('built-in definitions (own handler)', '#'), 'builtins');
		assert.strictEqual(S.groupOf('linting rules (smell)', '#'), 'features');
		assert.strictEqual(S.groupOf('dataflow edges', '#'), 'graphs');
		assert.strictEqual(S.groupOf('data frame constraints', '#'), 'dataframes');
		assert.strictEqual(S.groupOf('Infer data frame shapes', 'ms'), 'per-file', 'the phase stays with the phases');
		assert.strictEqual(S.groupOf('memory (df-shapes)', 'KiB'), 'memory');
		assert.strictEqual(S.groupOf('something new', 'weird'), 'other', 'unknown metrics still get a home');
		assert.ok(!S.GROUPS.some(g => g.id === 'totals'), 'the totals get no chart of their own');
		assert.deepStrictEqual(S.GROUPS.filter(g => g.perVersion).map(g => g.id), ['features', 'builtins', 'sigdb', 'tests'],
			'only what the flowR version itself carries is independent of the suite');
		assert.strictEqual(S.betterOf('data frame shapes (exact)', '#'), 'up');
		assert.strictEqual(S.betterOf('data frame shapes (top)', '#'), 'down');
		assert.strictEqual(S.betterOf('Total per-file', 'ms'), 'down');
		assert.strictEqual(S.betterOf('reduction (characters)', '#'), 'up');
		assert.strictEqual(S.betterOf('number of files', '#'), 'flat');
	});

	test('group the signature database counters', () => {
		for(const name of ['signature database bundles', 'signature database bundles (older only)',
			'signature database packages', 'signature database package versions', 'signature database functions',
			'signature database functions (latest only)', 'signature database base functions',
			'signature database base functions (deprecated)', 'signature database base parameters']) {
			assert.strictEqual(S.groupOf(name, '#'), 'sigdb', `${name} belongs to the database chart`);
			assert.strictEqual(S.betterOf(name, '#'), 'flat', `${name} is neither better nor worse when it grows`);
		}
		// the sizes must not fall into the memory chart, which is about the graphs of one analysis
		assert.strictEqual(S.groupOf('signature database size', 'KiB'), 'sigdb');
		assert.strictEqual(S.groupOf('signature database size (dictionaries)', 'KiB'), 'sigdb');
		assert.strictEqual(S.betterOf('signature database size (full history)', 'KiB'), 'flat',
			'a larger database is not a regression');
		assert.strictEqual(S.groupOf('memory (df-graph)', 'KiB'), 'memory', 'the other sizes stay where they were');
		assert.strictEqual(S.GROUPS[S.GROUPS.length - 1].id, 'tests', 'the test suite is the final tile');
		assert.strictEqual(S.groupOf('tests', '#'), 'tests');
		assert.strictEqual(S.groupOf('tests (dataflow)', '#'), 'tests');
		assert.strictEqual(S.groupOf('tests overall', '#'), 'tests', 'the total of a run belongs to its tile');
		assert.deepStrictEqual(S.GROUPS.filter(g => g.facts).map(g => g.id), ['sigdb', 'tests'],
			'only what never moves between runs is stated instead of plotted');
		assert.strictEqual(S.shortName('signature database functions (older only)'), 'functions (older only)',
			'the chart is already titled for the database');
	});
});
