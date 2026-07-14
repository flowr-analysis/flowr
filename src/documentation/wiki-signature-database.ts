import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import { RemoteFlowrFilePathBaseRef } from './doc-util/doc-files';
import { SigDatabase, SigDatabaseSet, type PackageSignatureSource } from '../project/sigdb/reader';
import { SigDbSchema } from '../project/sigdb/schema';
import { defaultSigDbPath, defaultSigDbPaths, readManifestFile, type SigDbShardRef } from '../project/sigdb/manifest';
import { DefaultAssumedRVersion } from '../config';
import { FlowrAnalyzerPackageVersionsSigDbPlugin } from '../project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import type { KnownParser } from '../r-bridge/parser';

function cranDatabaseAvailable(): boolean {
	return defaultSigDbPath('current') !== undefined || defaultSigDbPath('full') !== undefined;
}

/** point the resolver at your own database (a file path or manifest) */
function usePackageDatabase(parser: KnownParser) {
	const sigdb = new FlowrAnalyzerPackageVersionsSigDbPlugin('/path/to/sigs.manifest.json.br');
	return new FlowrAnalyzerBuilder().setParser(parser).registerPlugins(sigdb).build();
}

/** a coarse duration in short units (`µs`/`ms`); we only ever quote estimates, never false precision */
function roughDuration(ms: number): string {
	if(ms < 0.001) {
		return '<1 µs';
	}
	if(ms < 1) {
		return `${Number((ms * 1000).toPrecision(2))} µs`;
	}
	return `${Number(ms.toPrecision(2))} ms`;
}

async function measurePerformance(): Promise<string | undefined> {
	const src = defaultSigDbPath();
	if(src === undefined) {
		return undefined;
	}
	try {
		const t0 = Date.now();
		const db: PackageSignatureSource = src.endsWith('.manifest.json') || src.endsWith('.manifest.json.br')
			? await SigDatabaseSet.openManifest(src)
			: await SigDatabase.open(src);
		const loadMs = Date.now() - t0;

		const names = db.packageNames();
		const sample = [0, 0.25, 0.5, 0.75, 0.99].map(f => names[Math.min(names.length - 1, Math.floor(f * names.length))]);
		for(const n of sample) {
			db.lookup(n);
		}
		const iterations = sample.length * 4;
		const t1 = process.hrtime.bigint();
		for(let i = 0; i < iterations; i++) {
			db.lookup(sample[i % sample.length]);
		}
		const perLookupMs = Number(process.hrtime.bigint() - t1) / iterations / 1e6;
		db.close();
		return `Measured here at generation time: opening the bundle took ${roughDuration(loadMs)}, and a warmed`
			+ ` per-package export lookup takes ${roughDuration(perLookupMs)}. Each \`library()\` or \`::\` in a script`
			+ ' is then one cached lookup.';
	} catch{
		return undefined;
	}
}

/** group an integer into thousands with commas, deterministically (locale-independent) */
function groupThousands(n: number): string {
	return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** a coarse, human-readable byte size (`.br` sizes only ever quoted approximately) */
function humanBytes(bytes: number): string {
	if(bytes < 1024) {
		return `${bytes} B`;
	}
	const kb = bytes / 1024;
	if(kb < 1024) {
		return `${Math.round(kb)} KB`;
	}
	return `${(kb / 1024).toFixed(1)} MB`;
}

/** what a shard holds, derived from its id and popularity split (base R, the top-N CRAN packages, or the rest) */
function shardContents(s: SigDbShardRef): string {
	if(s.id.startsWith('base')) {
		return 'base-R packages (`base`, `stats`, `graphics`, ...)';
	}
	if(s.shard === 'top') {
		return `the ${groupThousands(s.topN ?? s.packages)} most-downloaded CRAN packages`;
	}
	if(s.shard === 'rest') {
		return 'the remaining CRAN packages';
	}
	return 'CRAN packages';
}

/** how many versions a tier keeps per package */
function tierHistory(s: SigDbShardRef): string {
	return s.tier === 'current' ? 'latest only' : 'full history';
}

/** resolve a manifest-relative source to its shipped file, preferring the compressed `.br` */
function resolveShipped(baseDir: string, rel: string): string | undefined {
	for(const candidate of [path.resolve(baseDir, rel + '.br'), path.resolve(baseDir, rel)]) {
		if(fs.existsSync(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

/** time (at generation time) how long it takes to decompress one shipped `.br`, i.e. its first-touch load cost */
function measureLoad(file: string): number | undefined {
	if(!file.endsWith('.br')) {
		return undefined;
	}
	try {
		const raw = fs.readFileSync(file);
		const t0 = Date.now();
		zlib.brotliDecompressSync(raw, { params: { [zlib.constants.BROTLI_DECODER_PARAM_LARGE_WINDOW]: 1 } });
		return Date.now() - t0;
	} catch{
		return undefined;
	}
}

/**
 * A table of the databases the default bundle actually ships, read -- at generation time, never hardcoded --
 * from the manifests. Each shard becomes a row (contents, retained history, package and version counts, its
 * on-disk size, and the measured cost of decompressing it on first touch). Every bundled manifest is unioned
 * (deduped by shard/dictionary id), so the separate `history` manifest's shards show up alongside `current`,
 * matching what the runtime actually mounts. `undefined` when no bundled manifest is present (e.g. a checkout
 * without generated data).
 */
function bundledDatabaseTable(): string | undefined {
	const manifestPaths = defaultSigDbPaths().filter(p => /\.manifest\.json(\.br)?$/.test(p));
	if(manifestPaths.length === 0) {
		return undefined;
	}
	const sizeOf = (file: string | undefined): string => file ? humanBytes(fs.statSync(file).size) : 'n/a';
	const loadOf = (file: string | undefined): string => {
		const load = file ? measureLoad(file) : undefined;
		return load !== undefined ? `≈ ${roughDuration(load)}` : 'n/a';
	};
	const shardRows: string[] = [];
	const dictRows: string[] = [];
	const seenShards = new Set<string>();
	const seenDicts = new Set<string>();
	for(const manifestPath of manifestPaths) {
		let shards: readonly SigDbShardRef[];
		let dicts: readonly { id: string, path: string, strings: number }[];
		try {
			const manifest = readManifestFile(manifestPath);
			shards = manifest.shards;
			dicts = manifest.dicts ?? [];
		} catch{
			continue;
		}
		const baseDir = path.dirname(manifestPath);
		for(const s of shards) {
			if(seenShards.has(s.id)) {
				continue;
			}
			seenShards.add(s.id);
			const file = resolveShipped(baseDir, s.path);
			shardRows.push(`| \`${s.id}\` | ${shardContents(s)} | ${tierHistory(s)} | ${groupThousands(s.packages)} | ${groupThousands(s.versions)} | ${sizeOf(file)} | ${loadOf(file)} |`);
		}
		for(const d of dicts) {
			// every manifest names its dict id `shared`; the files differ per scope, so dedupe (and label) by path
			if(seenDicts.has(d.path)) {
				continue;
			}
			seenDicts.add(d.path);
			const file = resolveShipped(baseDir, d.path);
			const label = path.basename(d.path).replace(/\.sigs\.ndjson$/, '');
			dictRows.push(`| \`${label}\` | ${groupThousands(d.strings)} shared strings | - | - | - | ${sizeOf(file)} | ${loadOf(file)} |`);
		}
	}
	if(shardRows.length === 0) {
		return undefined;
	}
	return `| Shard | Contents | Versions kept | Packages | Versions | Size (\`.br\`) | Load (first touch) |
|-------|----------|---------------|---------:|---------:|-------------:|-------------------:|
${[...shardRows, ...dictRows].join('\n')}`;
}

/** link a built-in plugin key (e.g. `versions:sigdb`) to its registration */
function pluginLink(key: string): string {
	return `[\`${key}\`](${RemoteFlowrFilePathBaseRef}src/project/plugins/plugin-registry.ts)`;
}

/**
 * https://github.com/flowr-analysis/flowr/wiki/Package-Database
 */
export class WikiSignatureDatabase extends DocMaker<'wiki/Signature Database.md'> {
	constructor() {
		super('wiki/Signature Database.md', module.filename, 'bundled signature database that resolves `library()` calls');
	}

	/**
	 * Regenerate only when the CRAN shards are actually present. A fresh checkout (and every CI run) ships no shards
	 * at all until they are downloaded, and this page documents the *CRAN* database: regenerating without them would
	 * replace the shard table and figures with empty/base-only numbers and publish that over the real page. Skipping
	 * leaves the committed page untouched, so the workflow reports no change and publishes nothing.
	 */
	public override async make(args: Parameters<DocMaker<'wiki/Signature Database.md'>['make']>[0]): Promise<boolean> {
		if(!cranDatabaseAvailable()) {
			console.log(`  [${this.getTarget()}] skipped: no CRAN sigdb present (not downloaded); keeping the committed page`);
			return false;
		}
		return super.make(args);
	}

	public async text({ ctx }: DocMakerArgs): Promise<string> {
		const performance = await measurePerformance();
		const databases = bundledDatabaseTable();
		return `

# Signature Database

flowR ships a database of the complete history of all exports in every version of all CRAN packages so it can resolve calls into the packages you load.
After \`library(ggplot2)\`, a call to \`ggplot()\` resolves to \`ggplot2::ggplot\`. The same database
qualifies bare names and backs various components like the ${ctx.linkPage('wiki/Query API', 'dependencies and call-context queries')} 
as well as the ${ctx.linkPage('wiki/Linter', 'undefined symbol')} rule.

## Configuration

The exports come from ${pluginLink('versions:sigdb')}, which reads bundled databases. It is enabled by
default (see ${ctx.linkPage('wiki/Interface', 'configuring flowR', 'configuring-flowr')}).

*Which* version's exports get resolved is decided by the version-reading plugins that pin the packages a
project uses.

${ctx.code(usePackageDatabase, { dropLinesStart: 1 })}

File sources load lazily on the first package load, so a script with no \`library()\` or \`use()\` calls
never pays to parse them. Set ${ctx.linkConfig('solver.sigdb.eagerlyLoad')} to mount the database up front instead, or
${ctx.linkConfig('solver.sigdb.enabled')} to \`false\` to switch it off entirely. For a compressed (\`.br\`) or manifest source,
${ctx.linkM(FlowrAnalyzerPackageVersionsSigDbPlugin, 'preload', { hideClass: true })} it before analysis to mount it.

The base-R packages (\`base\`, \`stats\`, \`graphics\`, ...) resolve against an assumed R version, which
defaults to \`${DefaultAssumedRVersion}\` (${ctx.linkConfig('solver.sigdb.assumedRVersion')}, or \`"auto"\` to detect the local R).
So \`library(stats)\` attaches that release's exports, and a bare \`sd()\` qualifies to \`stats::sd\` even
without attaching the base namespaces to the graph. Set ${ctx.linkConfig('solver.sigdb.linkBaseR')} to also link them as
dataflow edges.

**No** signature shards are committed: the \`base.*\` floor (self-contained base-R signatures, a few hundred KB), the
\`current.*\` scope (every package's latest version) and \`history.*\` (every older version) all live as assets on the
free ${ctx.linkConfig('solver.sigdb.downloadRepo')} GitHub release. The only committed file is a tiny **link file**,
\`src/data/sigdb/sigdb.remote.json\`, which records the release tag and each shard's sha256 and size, so
\`:signature download\` builds the direct release-CDN URL (no API rate limit), verifies every shard by content hash,
and skips any already cached. Because the link file is versioned, a \`git pull\` that updates it re-syncs only the
shards whose hash changed &mdash; and with ${ctx.linkConfig('solver.sigdb.autoSync')} that check runs on startup and re-downloads in the
background; \`npm run build\` bakes the shards in as well. The richest downloaded scope is used (order \`full\` >
\`current\` > \`base\`), so once fetched \`library(stats)\` resolves. Any path in ${ctx.linkConfig('solver.sigdb.additionalPaths')} (or
\`$FLOWR_SIGDB_DIR\`) is searched alongside the default, so a downloaded bundle stays mounted on every start.
${databases ? `
## Bundled Databases

The default bundle is not a single file but a set of shards that a manifest routes between (see
${ctx.link(SigDatabaseSet)}). Nothing is read when the manifest opens. The first lookup of a package
decompresses only the one shard that holds it, plus the shared dictionary once. The following ship with this
build; the load column is the decompression time measured at generation time.

${databases}

Which shard answers a lookup follows from the package and the version asked for. A base-R package comes from
\`base-current\`, one of the 1,000 most-downloaded CRAN packages from \`current-top\`, and anything else from
\`current-rest\`. The \`*-full\` and \`history-*\` shards hold every historical version and are only touched when
an older, pinned version is requested, so a normal analysis never decompresses them. Each scope carries its own
shared dictionary that its shards depend on, so it is decompressed the first time any of its packages is looked up and then reused.
The flowR Docker images ship this dictionary already decompressed, so a container reads it in place and skips
that step (the load column above is the cost a plain npm install pays).
` : ''}
## Format

The on-disk format is \`flowr-sigdb\` (schema ${SigDbSchema}). Beyond each version's exports it records, per
version, every function's signature (parameters, whether each is forced or optional, and its default) and
call graph, together with that version's declared dependencies (\`Depends\`, \`Imports\`, ... with their
version qualifiers). The layout is NDJSON: a header, then a shared string dictionary, then one
self-contained blob per package, next to a sidecar \`.idx\`. A reader (${ctx.link(SigDatabase)}) therefore
loads the dictionary once and then **seeks straight to the packages it needs**, never reading the rest.
The bundle is written by ${ctx.link('SigDbBuilder')} and can be split into several small shards (current-only
versus full history, top-N versus the rest) that a \`flowr-sigdb-manifest\` routes transparently
(${ctx.link(SigDatabaseSet)}), and which information gets stored is selectable (${ctx.link('SigDbFeatures')}).
crawlr produces the bundle from its analysis of CRAN.

## Performance

The dictionary is read once, the reader then seeks straight to each requested package, and consumers cache
what they derive (the \`base\`-package list is precomputed when flowR is bundled, so it costs nothing at
analysis time). ${performance ??
	'After the one-time load a per-package lookup is O(1), so each `library()` or `::` a script uses is a single cached lookup.'}
`.trim();
	}
}
