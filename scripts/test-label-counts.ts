/**
 * Merges test-suite-produced counters into benchmark graph outputs (the suite runs as a separate job).
 * A label may repeat across tests, so tests are counted by id, not by label occurrence.
 * --results/--mutation-results add total test counts from a vitest report; --mutations adds the
 * counterexample suite's own coverage (mutants, passes, known-wrong) from its details file.
 *
 * Usage: test-label-counts.ts [--results f] [--mutations f] [--mutation-results f] details.json graph.json...
 */
import fs from 'fs';

interface SerializedTestLabel {
	readonly id:      string;
	readonly context: readonly string[];
}

interface GraphEntry {
	name:   string;
	unit:   string;
	value:  number;
	extra?: string;
}

/** the counterexample suite's own coverage of metamorphic mutations */
interface MutationDetails {
	readonly passes?:          number;
	readonly counterexamples?: number;
	readonly mutants?:         number;
	readonly knownWrong?:      number;
}

const argv = process.argv.slice(2);
/** the value of a named option, `undefined` if it was not given */
function option(name: string): string | undefined {
	const at = argv.indexOf(name);
	return at >= 0 ? argv[at + 1] : undefined;
}
const resultsPath = option('--results');
const mutationsPath = option('--mutations');
const mutationResultsPath = option('--mutation-results');
/* whatever is neither an option nor the value of one */
const [detailsPath, ...graphPaths] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));

if(!detailsPath || graphPaths.length === 0) {
	console.error('usage: test-label-counts.ts [--results <file>] [--mutations <file>] [--mutation-results <file>] <details.json> <graph.json...>');
	process.exit(2);
}

/** the number of tests a vitest json report collected, read from its `numTotalTests` */
function numTotalTestsEntry(name: string, path: string | undefined): GraphEntry | undefined {
	if(path === undefined || !fs.existsSync(path)) {
		return undefined;
	}
	try {
		const report = JSON.parse(fs.readFileSync(path, 'utf-8')) as { numTotalTests?: number };
		return typeof report.numTotalTests === 'number' && report.numTotalTests > 0
			? { name, unit: '#', value: report.numTotalTests } : undefined;
	} catch(e) {
		console.log(`  could not read ${path}: ${(e as Error).message}`);
		return undefined;
	}
}

/**
 * mutants can be fewer than passes * counterexamples (a pass may not fit a program).
 * only fields the page actually shows are emitted; the rest stays in the suite's own file.
 */
function mutationEntries(path: string | undefined, resultsPath: string | undefined): GraphEntry[] {
	const testsEntry = numTotalTestsEntry('mutation tests', resultsPath);
	if(path === undefined || !fs.existsSync(path)) {
		return testsEntry ? [testsEntry] : [];
	}
	let facts: MutationDetails;
	try {
		facts = JSON.parse(fs.readFileSync(path, 'utf-8')) as MutationDetails;
	} catch(e) {
		console.log(`  could not read ${path}: ${(e as Error).message}`);
		return testsEntry ? [testsEntry] : [];
	}
	const possible = typeof facts.passes === 'number' && typeof facts.counterexamples === 'number'
		? facts.passes * facts.counterexamples : undefined;
	const entries = ([
		['mutation mutants', facts.mutants, possible === undefined ? undefined : `out of ${possible} possible`],
		['mutation passes', facts.passes, undefined],
		['mutation known-wrong mutants', facts.knownWrong, undefined]
	] as const).flatMap(([name, value, extra]) =>
		typeof value === 'number' && value >= 0 ? [{ name, unit: '#', value, ...(extra ? { extra } : {}) }] : []);
	return testsEntry ? [...entries, testsEntry] : entries;
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

const total = numTotalTestsEntry('tests overall', resultsPath);
const mutations = mutationEntries(mutationsPath, mutationResultsPath);
if(!fs.existsSync(detailsPath)) {
	console.log(`${detailsPath} does not exist, counting no labels`);
}
const entries = [...(total ? [total] : []), ...(fs.existsSync(detailsPath) ? countEntries(detailsPath) : []), ...mutations];
if(entries.length === 0) {
	console.log('nothing was counted, leaving the graph outputs alone');
	process.exit(0);
}
console.log(`counted ${total ? total.value + ' tests, ' : ''}${entries.find(e => e.name === 'tests')?.value ?? 0}`
	+ ` of them labeled, in ${entries.filter(e => e.name.startsWith('tests (')).length} contexts`
	+ `, and ${mutations.find(e => e.name === 'mutation mutants')?.value ?? 0} mutants`
	+ ` of ${mutations.find(e => e.name === 'mutation passes')?.value ?? 0} passes`);

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
