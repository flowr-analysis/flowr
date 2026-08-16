import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { assert, describe, test } from 'vitest';
import { infoGraphPath, isInfoEntry } from '../../../src/benchmark/summarizer/second-phase/graph';

/** the helpers of the benchmark page, which ships as a plain script and registers itself globally */
interface BenchStats {
	median(values: readonly (number | null)[]): number;
	rollingMedian(values: readonly (number | null)[], window: number): (number | null)[];
	rollingSmooth(values: readonly (number | null)[], window: number): (number | null)[];
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
	commitTitle(message: string): string;
	shortName(name: string): string;
	tagLabel(tag: string): string;
	logTicks(min: number, max: number): { lo: number, hi: number, step: number, values: number[], log: boolean };
	tickIndices(n: number, count: number): number[];
	fitLabels(spans: readonly (readonly [number, number])[]): boolean[];
	stateChanges(rows: readonly (readonly (number | null)[])[]): number[];
	pickColors(names: readonly string[], known: ReadonlyMap<string, number> | null, palette: number,
		taken?: Iterable<number>): Map<string, number>;
	mergeInfoSuites(entries: Record<string, unknown[]>): Record<string, unknown[]>;
	encodeGroups(map: ReadonlyMap<string, ReadonlySet<string>>): string;
	decodeGroups(text: string): Map<string, Set<string>>;
	GROUPS: readonly { id: string, perVersion?: boolean, facts?: boolean, folded?: boolean, log?: boolean }[];
}

/** the history the page ships with, one entry per suite */
interface BenchmarkData {
	entries: Record<string, { benches: { name: string, unit: string }[] }[]>;
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

	test('smooth a series without flattening it', () => {
		assert.deepStrictEqual(S.rollingSmooth([1, 2, 3], 1), [1, 2, 3], 'a window of one changes nothing');
		assert.deepStrictEqual(S.rollingSmooth([1, null, 3], 3), [1, null, 3], 'holes stay holes');
		/* a line has nothing to smooth away, and the borders have to state it too */
		const line = S.rollingSmooth([1, 2, 3, 4, 5, 6, 7], 5) as number[];
		line.forEach((v, i) => assert.ok(Math.abs(v - (i + 1)) < 1e-9, `a straight line survives at ${i}, got ${v}`));
		/* the rolling median repeats the middle of its window, so the newest release reads one behind */
		assert.strictEqual((S.rollingMedian([1, 2, 3, 4, 5, 6, 7], 5) as number[])[6], 6, 'which is what it used to do');
		/* an outlying newest release is not what the curve should follow either */
		const spiked = S.rollingSmooth([1, 2, 3, 4, 5, 6, 20], 5) as number[];
		assert.ok(spiked[6] > 4 && spiked[6] < 9, `the newest release is not chased, got ${spiked[6]}`);
		/* one spike does not move a series that is otherwise flat */
		const spike = S.rollingSmooth([1, 1, 1, 1, 9, 1, 1, 1, 1], 5) as number[];
		assert.ok(Math.abs(spike[4] - 1) < 0.5, `a spike is pulled back to the level around it, got ${spike[4]}`);
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
		assert.strictEqual(S.commitTitle('[release:patch] 2.13.14 Uselist fixes, Improved Benchmarks'),
			'[patch] 2.13.14 Uselist fixes, Improved Benchmarks', 'the word release says nothing here');
		assert.strictEqual(S.commitTitle('[release:minor] 2.13.0 Guessing Dep. Versions\n\nthe body'),
			'[minor] 2.13.0 Guessing Dep. Versions', 'the first line is the whole title');
		assert.strictEqual(S.commitTitle('fix: a plain commit'), 'fix: a plain commit');
		assert.strictEqual(S.commitTitle(''), '');
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
		/* the measurements are named in whatever case records them, the labels are one case */
		assert.strictEqual(S.shortName('dataflow vertices'), 'Dataflow vertices');
		assert.strictEqual(S.shortName('reduction (characters)'), 'Characters', 'and say what they are, not how');
		assert.strictEqual(S.tagLabel('smell'), 'Code smell');
		assert.strictEqual(S.tagLabel('shiny'), 'Shiny', 'an unknown tag still reads as a word');
		assert.strictEqual(S.groupOf('Produce dataflow information', 'ms'), 'per-file');
		assert.strictEqual(S.groupOf('memory (cfg-graph)', 'KiB'), 'memory');
		assert.strictEqual(S.groupOf('built-in definitions (own handler)', '#'), 'builtins');
		assert.strictEqual(S.groupOf('linting rules (smell)', '#'), 'features');
		assert.strictEqual(S.groupOf('dataflow edges', '#'), 'graphs');
		assert.strictEqual(S.groupOf('data frame constraints', '#'), 'dataframes');
		assert.strictEqual(S.groupOf('Infer data frame shapes', 'ms'), 'per-file', 'the phase stays with the phases');
		assert.strictEqual(S.groupOf('memory (df-shapes)', 'KiB'), 'memory-detail', 'the memory chart is about the graphs');
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
		assert.strictEqual(S.shortName('signature database functions (older only)'), 'Functions (older only)',
			'the chart is already titled for the database');
	});

	test('keep the measurements that are recorded but not drawn off the page', () => {
		const drawn = new Set(S.GROUPS.map(g => g.id));
		for(const [name, unit] of [
			['Retrieve AST per 100 lines', 'ms'], ['Total common per 100 lines', 'ms'],
			['reduction (lines)', '#'], ['reduction no fluff (characters)', '#'],
			['memory (df-shapes)', 'KiB'], ['dataflow calls', '#'], ['control flow function definitions', '#']
		] as const) {
			assert.ok(!drawn.has(S.groupOf(name, unit)), `${name} is recorded, but it gets no chart`);
		}
		for(const [name, unit] of [
			['reduction (characters)', '#'], ['reduction (normalized tokens)', '#'], ['reduction (dataflow vertices)', '#'],
			['memory (df-graph)', 'KiB'], ['memory (cfg-graph)', 'KiB'],
			['dataflow vertices', '#'], ['dataflow edges', '#'], ['control flow vertices', '#'], ['control flow edges', '#'],
			['Produce dataflow information', 'ms'], ['data frame constraints', '#'], ['number of files', '#']
		] as const) {
			assert.ok(drawn.has(S.groupOf(name, unit)), `${name} belongs on the page`);
		}
		assert.deepStrictEqual(S.GROUPS.filter(g => g.folded).map(g => g.id), ['volume', 'dataframes', 'calibration'],
			'the detail tiles start folded away');
		assert.strictEqual(S.groupOf('Calibration', 'ms'), 'calibration', 'the synthetic workload keeps its own tile');
		assert.deepStrictEqual(S.GROUPS.filter(g => g.log).map(g => g.id), ['volume'],
			'only the corpus, whose series differ by orders of magnitude, is drawn logarithmically');
	});

	test('space a logarithmic axis over the decades it covers', () => {
		const t = S.logTicks(3, 9000);
		assert.ok(t.lo <= 3 && t.hi >= 9000, 'the axis contains the data');
		assert.deepStrictEqual(t.values, [...t.values].sort((a, b) => a - b), 'the ticks rise');
		assert.ok(t.values.every(v => /^[125]0*$/.test(String(v))), `1, 2 and 5 of every decade, got ${t.values.join(',')}`);
		assert.strictEqual(t.values[0], t.lo);
		assert.strictEqual(t.values[t.values.length - 1], t.hi);
		const flat = S.logTicks(7, 7);
		assert.ok(flat.hi > flat.lo, 'a series that never moves still needs an axis');
	});

	test('label the run axis', () => {
		const ticks = S.tickIndices(100, 6);
		assert.strictEqual(ticks[0], 0, 'the oldest run in the range starts the axis');
		assert.strictEqual(ticks[ticks.length - 1], 99, 'the newest run always carries its label');
		assert.deepStrictEqual(ticks, [...ticks].sort((a, b) => a - b), 'the ticks read from left to right');
		assert.strictEqual(new Set(ticks).size, ticks.length, 'no run is labeled twice');
		assert.ok(ticks.length <= 8, `six ticks plus the newest is enough, got ${ticks.length}`);
		assert.deepStrictEqual(S.tickIndices(1, 6), [0], 'a single run is its own newest one');
		assert.deepStrictEqual(S.tickIndices(2, 6), [0, 1]);
		assert.deepStrictEqual(S.tickIndices(0, 6), [], 'nothing to label without runs');
		for(const n of [3, 7, 12, 13, 41, 96]) {
			assert.strictEqual(S.tickIndices(n, 6)[S.tickIndices(n, 6).length - 1], n - 1,
				`the newest of ${n} runs is labeled`);
		}
	});

	test('fit the release labels next to each other', () => {
		assert.deepStrictEqual(S.fitLabels([[0, 20], [10, 20], [100, 20]]), [false, true, true],
			'the newer of two labels that touch keeps its place');
		assert.deepStrictEqual(S.fitLabels([[0, 20], [30, 20]]), [true, true]);
		assert.deepStrictEqual(S.fitLabels([]), []);
		const crowded = S.fitLabels([[0, 30], [5, 30], [10, 30], [15, 30]]);
		assert.strictEqual(crowded[crowded.length - 1], true, 'the newest release is never the one dropped');
	});

	test('merge the runs that state the same thing', () => {
		assert.deepStrictEqual(S.stateChanges([[1, 1, 2, 2, 2, 3]]), [0, 2, 5]);
		assert.deepStrictEqual(S.stateChanges([[1, 1, 1], [5, 6, 6]]), [0, 1],
			'a state ends as soon as any of the numbers differs');
		assert.deepStrictEqual(S.stateChanges([[1, null, 1]]), [0], 'a run that states nothing keeps the state');
		assert.deepStrictEqual(S.stateChanges([[null, null]]), [], 'nothing stated is no state at all');
		assert.deepStrictEqual(S.stateChanges([]), []);
	});

	test('give every series of a chart its own colour', () => {
		const known = new Map([['a', 3], ['b', 3], ['c', 7]]);
		const picked = S.pickColors(['a', 'b', 'c'], known, 12);
		assert.strictEqual(picked.get('a'), 3, 'the colour a name already has is kept');
		assert.strictEqual(picked.get('c'), 7);
		assert.strictEqual(new Set(picked.values()).size, 3, 'the clash is moved out of the way');
		assert.deepStrictEqual([...S.pickColors(['x'], known, 12, [0, 1]).values()], [2],
			'what the chart already uses is left alone');
		const many = S.pickColors(Array.from({ length: 12 }, (_, i) => 'm' + i), null, 12);
		assert.strictEqual(new Set(many.values()).size, 12, 'a full palette is used exactly once each');
		assert.strictEqual(S.pickColors([], null, 12).size, 0);
		assert.strictEqual(known.get('b'), 3, 'the colours known so far are not rewritten');
	});

	test('the palette holds a colour for every line of the largest chart', () => {
		const at = (file: string) => path.join(process.cwd(), 'wiki/stats/benchmark', file);
		const palette = Number(/const PALETTE = (\d+)/.exec(fs.readFileSync(at('viewer.js'), 'utf-8'))?.[1]);
		assert.ok(palette > 0, 'the viewer states the size of its palette');
		const classes = new Set([...fs.readFileSync(at('style.css'), 'utf-8').matchAll(/^\.s(\d+)\s*\{/gm)]
			.map(m => Number(m[1])));
		assert.strictEqual(classes.size, palette, 'every colour of the palette needs a class of its own');
		for(let i = 0; i < palette; i++) {
			assert.ok(classes.has(i), `.s${i} is missing from the stylesheet`);
		}
		/* the breakdowns are drawn as bars in the colour of their parent, so they need none */
		const isBar = (name: string) => /^linting rules \(|^signature database base functions \(|^tests \(/.test(name);
		/* the page assigns its data to `window`, which node does not have */
		const global = globalThis as unknown as { window?: unknown, BENCHMARK_DATA: BenchmarkData };
		global.window ??= globalThis;
		createRequire(__filename)(at('data.js'));
		for(const [suite, runs] of Object.entries(global.BENCHMARK_DATA.entries)) {
			const units = new Map<string, string>();
			for(const run of runs) {
				for(const b of run.benches) {
					units.set(b.name, b.unit);
				}
			}
			const perGroup = new Map<string, number>();
			for(const [name, unit] of units) {
				if(isBar(name)) {
					continue;
				}
				const group = S.groupOf(name, unit);
				perGroup.set(group, (perGroup.get(group) ?? 0) + 1);
			}
			for(const [group, count] of perGroup) {
				assert.ok(count <= palette,
					`${suite} draws ${count} series in the ${group} chart, which ${palette} colours cannot keep apart`);
			}
		}
	});

	test('upload the counters where nothing alerts on them', () => {
		for(const [name, unit] of [
			['linting rules', '#'], ['linting rules (smell)', '#'], ['queries', '#'],
			['built-in definitions', '#'], ['signature database functions', '#'], ['signature database size', 'KiB'],
			['number of files', '#'], ['input lines', '#'], ['dataflow vertices', '#'], ['control flow edges', '#'],
			['data frame constraints', '#'], ['tests', '#'], ['tests (dataflow)', '#'], ['tests overall', '#']
		] as const) {
			assert.ok(isInfoEntry({ name, unit }), `${name} grows with the release, that is no regression`);
		}
		for(const [name, unit] of [
			['Produce dataflow information', 'ms'], ['Total per-file', 'ms'], ['Dataflow per 100 lines', 'ms'],
			['Calibration', 'ms'], ['memory (df-graph)', 'KiB'], ['memory (cfg-graph)', 'KiB'],
			['reduction (characters)', '#'], ['reduction (normalized tokens)', '#'],
			['failed to reconstruct/re-parse', '#'], ['times hit threshold', '#']
		] as const) {
			assert.ok(!isInfoEntry({ name, unit }), `${name} getting worse is worth an alert`);
		}
		assert.strictEqual(infoGraphPath('out/real-world-summarized-graph.json'), 'out/real-world-summarized-graph-info.json');
	});

	test('merge the counters back into the suite they belong to', () => {
		const run = (id: string, date: number, benches: { name: string, unit: string, value: number }[]) =>
			({ commit: { id }, date, benches });
		const entries = {
			'"real-world" Benchmark Suite':        [run('a', 1, [{ name: 'Parse', unit: 'ms', value: 3 }])],
			'"real-world" Benchmark Suite [info]': [
				run('a', 1, [{ name: 'linting rules', unit: '#', value: 70 }]),
				run('b', 2, [{ name: 'linting rules', unit: '#', value: 71 }])
			]
		} as unknown as Record<string, { commit: { id: string }, date: number, benches: { name: string }[] }[]>;
		S.mergeInfoSuites(entries);
		assert.deepStrictEqual(Object.keys(entries), ['"real-world" Benchmark Suite'], 'the page shows one suite');
		const runs = entries['"real-world" Benchmark Suite'];
		assert.strictEqual(runs.length, 2, 'a counter run without a measured run of its own still counts');
		assert.deepStrictEqual(runs[0].benches.map(b => b.name), ['Parse', 'linting rules'],
			'the counters join the run of the same commit');
		assert.deepStrictEqual(runs.map(r => r.date), [1, 2], 'the runs stay in order');
		const alone = { 'x [info]': [run('a', 1, [])] } as unknown as Record<string, unknown[]>;
		S.mergeInfoSuites(alone);
		assert.deepStrictEqual(Object.keys(alone), ['x'], 'counters without measurements still name their suite');
	});

	test('keep the per-chart choices in a link', () => {
		const map = new Map([['per-file', new Set(['Parse', 'memory (df-graph)'])], ['tests', new Set<string>()]]);
		const text = S.encodeGroups(map);
		assert.strictEqual(text, 'per-file:Parse~memory (df-graph)', 'an empty choice is nothing to state');
		const back = S.decodeGroups(text);
		assert.deepStrictEqual([...back.keys()], ['per-file']);
		assert.deepStrictEqual([...(back.get('per-file') ?? [])], ['Parse', 'memory (df-graph)']);
		assert.strictEqual(S.decodeGroups('').size, 0);
		assert.strictEqual(S.decodeGroups('nonsense').size, 0, 'a broken link shows the page, not an error');
	});
});
