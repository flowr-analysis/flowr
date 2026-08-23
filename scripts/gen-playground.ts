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
import { rSourceUrl, helpPageUrl } from '../src/queries/catalog/signature-query/signature-query-executor';
import { template, writePage } from './html-page';
import { FlowrConfig } from '../src/config';
import { DefaultBuiltinConfig } from '../src/dataflow/environments/default-builtin-config';
import { Identifier } from '../src/dataflow/environments/identifier';

/* flowR's CLI modules read `process` while they are being imported, so one has to exist */
const ProcessShim = 'globalThis.process ??= { argv: [], argv0: "browser", env: {}, platform: "browser",'
	+ ' versions: {}, cwd: () => "/", exit: () => undefined,'
	+ ' on: () => undefined, hrtime: Object.assign(() => [0, 0], { bigint: () => 0n }),'
	+ ' stdout: { write: () => true }, stderr: { write: () => true }, nextTick: f => queueMicrotask(f) };';

const Target = path.join('wiki', 'playground');
/* every node built-in resolves to the same empty module, by absolute path so nested packages find it */
const empty = path.resolve('scripts', 'playground', 'empty.js');
/* `path` is the one exception: its arithmetic says nothing about a file system, and flowR needs it */
const pathShim = path.resolve('scripts', 'playground', 'path-shim.js');

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
			if(bare === 'path') {
				return { path: pathShim };
			}
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
			const docs = fn.props.includes('no-doc') ? '' : helpPageUrl(pkg, fn.topic ?? fn.name, { base: true, cran: false }) ?? '';
			rows.push([fn.name, pkg, params, fn.props.filter(p => p !== 'exported').join(' '), where, source, docs].join('\t'));
		}
	}
	return rows.join('\n');
}

/** how many of the most-downloaded packages ride along, by their exports alone */
const TopPackages = 150;

/** the most-downloaded packages, most first, as the list the repository keeps of them */
function topPackages(): string[] {
	try {
		return fs.readFileSync(path.join('scripts', 'top-r-downloads.txt'), 'utf8')
			.split('\n').map(line => line.split(',')[0].trim()).filter(name => name.length > 0).slice(0, TopPackages);
	} catch{
		return [];   /* the list is not what the page needs to work */
	}
}

/**
 * The exports of every package the playground may attach, as `package -> [version, release, ...names]`. A browser can open no
 * database, so without this `library(dplyr)` brings nothing into scope and every call it should resolve
 * stays unknown. Base R plus the packages flowR carries definitions for is what a script typed into the
 * page actually loads, and their export lists are small enough to ride along.
 */
async function packageExports(): Promise<string> {
	const db = await openDatabase();
	if(db === undefined) {
		return '';
	}
	const wanted = new Set(db.packageNames().filter(name => db.isBaseR(name)));
	/* what a script typed into the page actually loads: base R, what flowR carries definitions for, and
	   the packages people install most, so `library(readr)` brings its exports into scope like the rest */
	for(const name of topPackages()) {
		wanted.add(name);
	}
	for(const definition of DefaultBuiltinConfig) {
		for(const id of definition.names) {
			const namespace = Identifier.getNamespace(id);
			if(namespace !== undefined) {
				wanted.add(String(namespace));
			}
		}
	}
	const out: Record<string, readonly string[]> = {};
	for(const pkg of wanted) {
		const known = db.lookup(pkg);
		if(known !== undefined && known.exported.length > 0) {
			/* the version and its release date first: the exports were read from that release, and saying so
			   is what keeps a query from reporting the package as one no database knows */
			out[pkg] = [known.version, db.releaseDate(pkg)?.toISOString().slice(0, 10) ?? '', ...known.exported];
		}
	}
	return JSON.stringify(out);
}

/**
 * What the configuration schema says about each of its keys, as `path -> {type, description, values}`.
 * Joi's browser build refuses `describe()`, so the answers are written out here instead.
 */
function configDocs(): string {
	const out: Record<string, { t?: string, d?: string, v?: string[] }> = {};
	const walk = (node: { type?: string, flags?: { description?: string }, keys?: Record<string, unknown>, allow?: unknown[] }, path: string[]): void => {
		if(path.length > 0) {
			const valids = (node.allow ?? []).filter(v => typeof v === 'string' || typeof v === 'number').map(String);
			out[path.join('.')] = {
				...(node.type ? { t: node.type } : {}),
				/* the descriptions come from TSDoc, where a reference reads `{@link name}` */
				...(node.flags?.description ? { d: node.flags.description.replace(/\{@link\s+([^}]+)\}/g, '$1') } : {}),
				...(valids.length > 0 ? { v: valids } : {})
			};
		}
		for(const [key, child] of Object.entries(node.keys ?? {})) {
			walk(child as never, [...path, key]);
		}
	};
	walk(FlowrConfig.Schema.describe() as never, []);
	return JSON.stringify(out);
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
	const page = template('playground', 'index.html');
	const signatures = await baseSignatures();
	const exports = await packageExports();
	/* the script the page opens with, kept as an R file so the documentation links to the same one */
	const sample = fs.readFileSync(path.join('scripts', 'playground', 'sample.R'), 'utf8').trim();
	writePage(path.join(Target, 'index.html'), (page
		/* the text of a script element ends at `</`, and nothing else in it has to be escaped */
		.replace('<!--SAMPLE-->', sample.replaceAll('</', '<\\/'))
		.replace('<!--SIGS-->', signatures)
		.replace('<!--PKGS-->', exports)
		.replace('<!--CFGDOCS-->', configDocs())));
	const size = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0);
	console.log(`  wrote ${Target} (${(size / 1024 / 1024).toFixed(1)} MB bundle, `
		+ `${Math.round(signatures.length / 1024)} kB of base R signatures, `
		+ `${Math.round(exports.length / 1024)} kB of package exports, not committed)`);
}

void main();
