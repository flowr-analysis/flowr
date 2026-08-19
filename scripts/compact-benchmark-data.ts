/**
 * Rewrites the benchmark history so that every run sits on its own line.
 *
 * The benchmark action pretty prints the file, which costs about half of its size and turns a single
 * appended run into a diff of thousands of lines. One line per run keeps both small.
 *
 * Run it with `npx ts-node --transpile-only scripts/compact-benchmark-data.ts [path]`.
 */
import fs from 'fs';

const Prefix = 'window.BENCHMARK_DATA = ';
const path = process.argv[2] ?? 'wiki/stats/benchmark/data.js';

interface BenchmarkData {
	entries:       Record<string, unknown[]>;
	[key: string]: unknown;
}

/** the whole file with one line per run, so appending a run appends a line */
function serialize(data: BenchmarkData): string {
	const { entries, ...rest } = data;
	const head = Object.entries(rest).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`);
	const suites = Object.entries(entries).map(([suite, runs]) =>
		`${JSON.stringify(suite)}: [\n${runs.map(run => JSON.stringify(run)).join(',\n')}\n]`);
	return `${Prefix}{\n${head.concat(`"entries": {\n${suites.join(',\n')}\n}`).join(',\n')}\n}`;
}

const raw = fs.readFileSync(path, 'utf-8');
if(!raw.startsWith(Prefix)) {
	console.log(`${path} does not start with the expected assignment, leaving it alone`);
	process.exit(0);
}

const data = JSON.parse(raw.slice(Prefix.length)) as BenchmarkData;
const out = serialize(data);

/* never write something we cannot read back */
const check = JSON.parse(out.slice(Prefix.length)) as BenchmarkData;
if(JSON.stringify(check) !== JSON.stringify(data)) {
	console.error('the compacted file would differ in content, leaving it alone');
	process.exit(1);
}

fs.writeFileSync(path, out);
console.log(`compacted ${(raw.length / 1048576).toFixed(2)} MiB to ${(out.length / 1048576).toFixed(2)} MiB, `
	+ `${raw.split('\n').length} lines to ${out.split('\n').length}`);
