/**
 * Adds the test counters to benchmark graph outputs.
 *
 * The test labels are written by the test suite (`coverage/flowr-test-details.json`), which runs in a job of
 * its own, so the numbers are merged into the graph outputs instead of being produced by the benchmark.
 * A label may carry several capabilities and appear more than once, hence every test is counted by its id.
 * With `--results <file>` the report of the run (`coverage/flowr-test-results.json`) also contributes the
 * total number of tests, which the labels alone cannot know.
 *
 * Run it with `npx ts-node --transpile-only scripts/test-label-counts.ts [--results <file>] <details.json> <graph.json...>`.
 */
import fs from 'fs';

interface SerializedTestLabel {
	readonly id:      string;
	readonly context: readonly string[];
}

interface GraphEntry {
	name:  string;
	unit:  string;
	value: number;
}

const argv = process.argv.slice(2);
const resultsAt = argv.indexOf('--results');
const resultsPath = resultsAt >= 0 ? argv[resultsAt + 1] : undefined;
const [detailsPath, ...graphPaths] = resultsAt >= 0 ? argv.filter((_, i) => i !== resultsAt && i !== resultsAt + 1) : argv;

if(!detailsPath || graphPaths.length === 0) {
	console.error('usage: test-label-counts.ts [--results <file>] <details.json> <graph.json...>');
	process.exit(2);
}

/** the number of tests the run collected, which the labels cannot know as only some tests carry one */
function totalEntry(path: string | undefined): GraphEntry | undefined {
	if(path === undefined || !fs.existsSync(path)) {
		return undefined;
	}
	try {
		const report = JSON.parse(fs.readFileSync(path, 'utf-8')) as { numTotalTests?: number };
		return typeof report.numTotalTests === 'number' && report.numTotalTests > 0
			? { name: 'tests overall', unit: '#', value: report.numTotalTests } : undefined;
	} catch(e) {
		console.log(`  could not read ${path}: ${(e as Error).message}`);
		return undefined;
	}
}

function countEntries(path: string): GraphEntry[] {
	const raw = JSON.parse(fs.readFileSync(path, 'utf-8')) as [string, SerializedTestLabel[]][];
	const contexts = new Map<string, string>();
	for(const [, labels] of raw) {
		for(const label of labels) {
			for(const context of label.context ?? []) {
				contexts.set(label.id + '\0' + context, context);
			}
		}
	}
	const ids = new Set<string>();
	const perContext = new Map<string, number>();
	for(const [key, context] of contexts) {
		ids.add(key.slice(0, key.indexOf('\0')));
		perContext.set(context, (perContext.get(context) ?? 0) + 1);
	}
	const data: GraphEntry[] = [{ name: 'tests', unit: '#', value: ids.size }];
	for(const [context, value] of [...perContext].sort((a, b) => b[1] - a[1])) {
		data.push({ name: `tests (${context})`, unit: '#', value });
	}
	return data;
}

if(!fs.existsSync(detailsPath)) {
	console.log(`${detailsPath} does not exist, leaving the graph outputs alone`);
	process.exit(0);
}

const total = totalEntry(resultsPath);
const entries = [...(total ? [total] : []), ...countEntries(detailsPath)];
console.log(`counted ${total ? total.value + ' tests, ' : ''}${entries.find(e => e.name === 'tests')?.value ?? 0}`
	+ ` of them labeled, in ${entries.filter(e => e.name.startsWith('tests (')).length} contexts`);

for(const path of graphPaths) {
	if(!fs.existsSync(path)) {
		console.log(`  ${path} does not exist, skipping it`);
		continue;
	}
	const data = JSON.parse(fs.readFileSync(path, 'utf-8')) as GraphEntry[];
	const known = new Set(data.map(e => e.name));
	data.push(...entries.filter(e => !known.has(e.name)));
	fs.writeFileSync(path, JSON.stringify(data));
	console.log(`  added them to ${path}`);
}
