/**
 * Compares the measurements of a new benchmark run with the release before it and fails if the run regressed.
 *
 * The benchmark action only alerts once a value at least doubles, and it uploads every metric as smaller is better,
 * so a slice reduction that drops reads as an improvement there. This guard checks what the action cannot:
 * - no `reduction (...)` may drop by more than {@link GuardLimits.reductionDrop},
 * - no timing of {@link GuardedTimings} may grow by more than {@link GuardLimits.slowdown}, each divided by the
 *   `Calibration` of its run, which describes the machine the run happened to get.
 *
 * Over the recorded history this flags every release that made slices larger or the linter or the dataflow slower,
 * and about one run in a hundred of the others.
 *
 * Run it with `npx ts-node --transpile-only scripts/benchmark-guard.ts <summarized-graph.json> <suite name> [data.js]`.
 */
import fs from 'fs';

/** what a run uploads per metric, see `src/benchmark/summarizer/second-phase/graph.ts` */
export interface BenchmarkValue {
	readonly name:  string
	readonly value: number
}

/** how far a run may fall behind the release before it */
export interface GuardLimits {
	/** the most a reduction may drop, as a share of the input (0.01 is one percentage point) */
	readonly reductionDrop: number
	/** the most a calibrated timing may grow (0.3 is 30%) */
	readonly slowdown:      number
}

export const DefaultGuardLimits: GuardLimits = { reductionDrop: 0.01, slowdown: 0.3 };

/** the timings worth guarding, which every suite reports */
export const GuardedTimings: readonly string[] = ['Produce dataflow information', 'Static slicing', 'Linter run', 'Dependencies query', 'Total per-file'];

/** one finding of {@link guardBenchmark}, `failed` if the run regressed */
export interface GuardCheck {
	readonly name:     string
	readonly value:    number
	readonly baseline: number
	readonly failed:   boolean
}

const isReduction = (name: string) => name.startsWith('reduction (');

/** the value of `name` in the run, by the calibration of the run if it is a timing, `undefined` if the run lacks it */
function valueOf(run: readonly BenchmarkValue[], name: string): number | undefined {
	const value = run.find(b => b.name === name)?.value;
	if(value === undefined || isReduction(name)) {
		return value;
	}
	const calibration = run.find(b => b.name === 'Calibration')?.value;
	return calibration === undefined || calibration <= 0 ? undefined : value / calibration;
}

/** Checks the `run` against the `previous` one, see the file comment. */
export function guardBenchmark(run: readonly BenchmarkValue[], previous: readonly BenchmarkValue[], limits: GuardLimits = DefaultGuardLimits): GuardCheck[] {
	const checks: GuardCheck[] = [];
	for(const { name } of run.filter(b => isReduction(b.name) || GuardedTimings.includes(b.name))) {
		const value = valueOf(run, name);
		const baseline = valueOf(previous, name);
		if(value !== undefined && baseline !== undefined) {
			const failed = isReduction(name) ? value < baseline - limits.reductionDrop : value > baseline * (1 + limits.slowdown);
			checks.push({ name, value, baseline, failed });
		}
	}
	return checks;
}

const Prefix = 'window.BENCHMARK_DATA = ';

/** the runs of `suite` in the benchmark history at `path`, oldest first */
export function historyOf(path: string, suite: string): BenchmarkValue[][] {
	const raw = fs.readFileSync(path, 'utf-8');
	const data = JSON.parse(raw.slice(raw.indexOf(Prefix) + Prefix.length).trim().replace(/;$/, '')) as { entries: Record<string, { benches: BenchmarkValue[] }[]> };
	return (data.entries[suite] ?? []).map(e => e.benches);
}

if(require.main === module) {
	const [graph, suite, data = 'wiki/stats/benchmark/data.js'] = process.argv.slice(2);
	if(graph === undefined || suite === undefined) {
		console.error('usage: benchmark-guard.ts <summarized-graph.json> <suite name> [data.js]');
		process.exit(2);
	}
	const previous = historyOf(data, suite).at(-1);
	if(previous === undefined) {
		console.log(`no earlier run of ${suite} to compare with`);
		process.exit(0);
	}
	const checks = guardBenchmark(JSON.parse(fs.readFileSync(graph, 'utf-8')) as BenchmarkValue[], previous);
	for(const c of checks) {
		console.log(`${c.failed ? 'FAIL' : 'ok  '} ${c.name}: ${c.value.toFixed(4)} (previous release ${c.baseline.toFixed(4)})`);
	}
	const failed = checks.filter(c => c.failed);
	if(failed.length > 0) {
		console.error(`${failed.length} of ${checks.length} checks regressed against the previous run of ${suite}, see above.`);
		process.exit(1);
	}
}
