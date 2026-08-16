/**
 * Bundles the playground into `wiki/playground/`: flowR itself, a CodeMirror editor, and the two
 * wasm files the tree-sitter parser needs. Like the signature browser, the result is a few megabytes
 * and therefore never committed; the documentation job builds it onto the `gh-pages` branch.
 */
import fs from 'fs';
import path from 'path';
import { build, type Plugin } from 'esbuild';
import { builtinModules } from 'module';
import { openDatabase } from './sigdb-index';
import { rSourceUrl, rdrrDocUrl } from '../src/queries/catalog/signature-query/signature-query-executor';
import { flowrVersion } from '../src/util/version';

/* flowR's CLI modules read `process` while they are being imported, so one has to exist */
const ProcessShim = 'globalThis.process ??= { argv: [], argv0: "browser", env: {}, platform: "browser",'
	+ ' versions: {}, cwd: () => "/", exit: () => undefined,'
	+ ' on: () => undefined, hrtime: Object.assign(() => [0, 0], { bigint: () => 0n }),'
	+ ' stdout: { write: () => true }, stderr: { write: () => true }, nextTick: f => queueMicrotask(f) };';

const Target = path.join('wiki', 'playground');
/* every node built-in resolves to the same empty module, by absolute path so nested packages find it */
const empty = path.resolve('scripts', 'playground', 'empty.js');

/**
 * Every node built-in becomes an empty module: flowR only reaches for them on paths the browser never
 * takes (files, shells, servers), and an alias list cannot keep up with `fs/promises` and friends.
 */
const stubNodeBuiltins: Plugin = {
	name: 'stub-node-builtins',
	setup(builder) {
		const known = new Set(builtinModules.flatMap(m => [m, `node:${m}`]));
		builder.onResolve({ filter: /.*/ }, args => {
			const bare = args.path.split('/')[0].replace(/^node:/, '');
			return known.has(args.path) || known.has(bare) || known.has(`node:${bare}`)
				? { path: empty } : undefined;
		});
	}
};

/**
 * What flowR knows about base R, as one line per exported function:
 * `name\tpackage\tparameters\tproperties\tfile:line\tsource\tdocs`. The whole database is gigabytes,
 * base R is a few hundred kilobytes, and that is what someone typing R in a browser asks about.
 */
async function baseSignatures(): Promise<string> {
	const db = await openDatabase();
	if(db === undefined) {
		console.log('  no signature database, the playground will not show signatures');
		return '';
	}
	const rows: string[] = [];
	for(const pkg of db.packageNames().filter(name => db.isBaseR(name))) {
		const exported = new Set(db.lookup(pkg)?.exported ?? []);
		const version = db.lookup(pkg)?.version;
		for(const fn of db.functions(pkg) ?? []) {
			if(!exported.has(fn.name)) {
				continue;
			}
			const params = fn.signature.map(p => p.default === undefined ? p.name : `${p.name} = ${p.default}`).join(', ');
			const where = fn.file === undefined ? '' : `${fn.file}:${fn.line}`;
			const source = fn.file === undefined ? '' : rSourceUrl(pkg, version, fn.file, fn.line);
			const docs = fn.props.includes('no-doc') ? '' : rdrrDocUrl(pkg, fn.topic ?? fn.name, { base: true, cran: false }) ?? '';
			rows.push([fn.name, pkg, params, fn.props.filter(p => p !== 'exported').join(' '), where, source, docs].join('\t'));
		}
	}
	return rows.join('\n');
}

async function main(): Promise<void> {
	if(process.env.FLOWR_LANDING_ONLY) {
		console.log('  FLOWR_LANDING_ONLY is set, skipping the playground');
		return;
	}
	fs.mkdirSync(Target, { recursive: true });
	const result = await build({
		entryPoints:   [path.join('scripts', 'playground', 'main.ts')],
		outfile:       path.join(Target, 'bundle.js'),
		bundle:        true,
		minify:        process.env.FLOWR_PLAYGROUND_DEBUG ? false : true,
		sourcemap:     process.env.FLOWR_PLAYGROUND_DEBUG ? 'inline' : false,
		format:        'iife',
		mainFields:    ['browser', 'module', 'main'],
		platform:      'browser',
		target:        'es2022',
		legalComments: 'none',
		logLevel:      'error',
		define:        { 'process.env.NODE_ENV': '"production"', '__dirname': '"/"', '__filename': '"/main.js"' },
		banner:        { js: ProcessShim },
		plugins:       [stubNodeBuiltins],
		loader:        { '.wasm': 'dataurl' },
		metafile:      true
	});

	/* the wasm rides along inside the bundle as a data url, so the page has nothing to fetch and works
	   from a file:// url as well as over GitHub Pages */
	const page = fs.readFileSync(path.join('scripts', 'playground', 'index.html'), 'utf8');
	const signatures = await baseSignatures();
	fs.writeFileSync(path.join(Target, 'index.html'), page
		.replace('<!--SIGS-->', signatures)
		.replace('<!--VERSION-->', `v${flowrVersion().format()}`));
	const size = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0);
	console.log(`  wrote ${Target} (${(size / 1024 / 1024).toFixed(1)} MB bundle, `
		+ `${Math.round(signatures.length / 1024)} kB of base R signatures, not committed)`);
}

void main();
