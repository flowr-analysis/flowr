/*
 * Selects the tests for `npm run test`. `vitest --changed` follows the complete import graph, but the analyzer imports
 * the query and linter registries, which import nearly all of `src`, so almost every change selects almost every test.
 * Here a changed source file selects the tests that import it, or one of its importers up to `MaxImporterDepth` levels,
 * plus the tests in the matching test folder. This is a development shortcut. CI runs every test.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MaxImporterDepth = 2;
const TestRoot = 'test/functionality';
const ImportRegex = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:([^;'"]*?)\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const TypeOnlyClause = /^\{([^}]*)\}$/;

function walk(dir, out = []) {
	for(const entry of readdirSync(dir, { withFileTypes: true })) {
		const file = path.join(dir, entry.name);
		if(entry.isDirectory()) {
			walk(file, out);
		} else if(/\.m?ts$/.test(entry.name)) {
			out.push(file);
		}
	}
	return out;
}

function resolveImport(from, spec) {
	if(!spec.startsWith('.')) {
		return undefined;
	}
	const base = path.join(path.dirname(from), spec);
	return [`${base}.ts`, `${base}.mts`, path.join(base, 'index.ts'), base].find(c => existsSync(c) && statSync(c).isFile());
}

function valueImports(file) {
	const imports = new Set();
	const source = readFileSync(file, 'utf8');
	for(const [, typeOnly, clause, spec, dynamicSpec] of source.matchAll(ImportRegex)) {
		const specifiers = TypeOnlyClause.exec(clause?.trim() ?? '')?.[1].split(',').filter(s => s.trim());
		if(typeOnly || specifiers?.every(s => /^\s*type\s/.test(s))) {
			continue;
		}
		const resolved = resolveImport(file, spec ?? dynamicSpec);
		if(resolved) {
			imports.add(resolved);
		}
	}
	return imports;
}

function importerGraph() {
	const importers = new Map();
	for(const file of [...walk('src'), ...walk('test')]) {
		for(const dep of valueImports(file)) {
			importers.set(dep, [...importers.get(dep) ?? [], file]);
		}
	}
	return importers;
}

/** the test folder mirroring a source file, e.g. `src/dataflow/graph/x.ts` gives `test/functionality/dataflow/graph` */
function mirroredFolder(file) {
	const [, ...segments] = file.split(path.sep);
	for(let depth = Math.min(2, segments.length - 1); depth > 0; depth--) {
		const folder = path.join(TestRoot, ...segments.slice(0, depth));
		if(existsSync(folder)) {
			return folder;
		}
	}
	return undefined;
}

/** @returns the test files to run, or `undefined` if the change is not understood and everything affected must run */
export function selectTests(changedFiles) {
	const importers = importerGraph();
	const tests = new Set();
	for(const changed of changedFiles) {
		const file = path.normalize(changed);
		if(!/\.m?ts$/.test(file) || !(file.startsWith('src') || file.startsWith('test'))) {
			return undefined;
		}
		/* importers in the sources count as a level, helpers and tests importing them are followed all the way */
		const reached = new Set([file]);
		let frontier = [[file, 0]];
		while(frontier.length > 0) {
			frontier = frontier.flatMap(([f, depth]) => (importers.get(f) ?? []).map(i => [i, i.startsWith('test') ? depth : depth + 1]))
				.filter(([i, depth]) => depth <= MaxImporterDepth && !reached.has(i) && reached.add(i));
		}
		for(const f of reached) {
			if(f.endsWith('.test.ts') && existsSync(f)) {
				tests.add(f);
			}
		}
		const mirrored = file.startsWith('src') ? mirroredFolder(file) : undefined;
		if(mirrored) {
			for(const t of walk(mirrored).filter(f => f.endsWith('.test.ts'))) {
				tests.add(t);
			}
		}
	}
	return tests.size > 0 ? [...tests] : undefined;
}

export function changedFiles() {
	const run = args => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
	return [...new Set([...run(['diff', '--name-only', 'HEAD']), ...run(['ls-files', '--others', '--exclude-standard'])])];
}

if(process.argv[1] === new URL(import.meta.url).pathname) {
	const tests = selectTests(process.argv.length > 2 ? process.argv.slice(2) : changedFiles());
	console.log(tests ? `${tests.length}\n${tests.join('\n')}` : 'fallback');
}
