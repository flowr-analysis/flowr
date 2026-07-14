import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import { linkFlowRSourceFile, RemoteFlowrFilePathBaseRef } from './doc-util/doc-files';
import { SigDatabase, SigDatabaseSet, type PackageSignatureSource } from '../project/sigdb/reader';
import { SigDbSchema } from '../project/sigdb/schema';
import { defaultSigDbPath, readManifestFile, type SigDbShardRef } from '../project/sigdb/manifest';
import { DefaultAssumedRVersion } from '../config';
import { FlowrAnalyzerPackageVersionsSigDbPlugin } from '../project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import type { KnownParser } from '../r-bridge/parser';

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

/**
 * Measure -- at wiki-generation time, never hardcoded -- what the bundled database actually costs: the
 * one-time load and a warmed per-package lookup. Returns a prose sentence, or `undefined` when no bundle is
 * present (e.g. a checkout without the generated data), so the page can fall back to a qualitative note.
 */
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
			db.lookup(n);   // warm the shards these packages live in (first touch decompresses lazily)
		}
		// a nanosecond timer means a handful of lookups already give a stable per-call figure -- there is no need
		// to hammer the database hundreds of thousands of times just to rise above a millisecond clock's tick
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
 * from its manifest. Each shard becomes a row (contents, retained history, package and version counts, its
 * on-disk size, and the measured cost of decompressing it on first touch). `undefined` when no bundled
 * manifest is present (e.g. a checkout without generated data).
 */
function bundledDatabaseTable(): string | undefined {
	const manifestPath = defaultSigDbPath();
	if(manifestPath === undefined || !/\.manifest\.json(\.br)?$/.test(manifestPath)) {
		return undefined;
	}
	let shards: readonly SigDbShardRef[];
	let dict: { path: string, strings: number } | undefined;
	try {
		const manifest = readManifestFile(manifestPath);
		shards = manifest.shards;
		const d = manifest.dicts?.[0];
		dict = d ? { path: d.path, strings: d.strings } : undefined;
	} catch{
		return undefined;
	}
	const baseDir = path.dirname(manifestPath);
	const sizeOf = (file: string | undefined): string => file ? humanBytes(fs.statSync(file).size) : 'n/a';
	const loadOf = (file: string | undefined): string => {
		const load = file ? measureLoad(file) : undefined;
		return load !== undefined ? `≈ ${roughDuration(load)}` : 'n/a';
	};
	const rows = shards.map(s => {
		const file = resolveShipped(baseDir, s.path);
		return `| \`${s.id}\` | ${shardContents(s)} | ${tierHistory(s)} | ${groupThousands(s.packages)} | ${groupThousands(s.versions)} | ${sizeOf(file)} | ${loadOf(file)} |`;
	});
	if(dict !== undefined) {
		const file = resolveShipped(baseDir, dict.path);
		rows.push(`| \`shared dictionary\` | ${groupThousands(dict.strings)} strings shared by every shard | - | - | - | ${sizeOf(file)} | ${loadOf(file)} |`);
	}
	return `| Shard | Contents | Versions kept | Packages | Versions | Size (\`.br\`) | Load (first touch) |
|-------|----------|---------------|---------:|---------:|-------------:|-------------------:|
${rows.join('\n')}`;
}

/** link a built-in plugin key (e.g. `versions:sigdb`) to its registration */
function pluginLink(key: string): string {
	return `[\`${key}\`](${RemoteFlowrFilePathBaseRef}src/project/plugins/plugin-registry.ts)`;
}

/**
 * https://github.com/flowr-analysis/flowr/wiki/Package-Database
 */
export class WikiPackageDatabase extends DocMaker<'wiki/Package Database.md'> {
	constructor() {
		super('wiki/Package Database.md', module.filename, 'bundled CRAN package database that resolves `library()` calls');
	}

	public async text({ ctx }: DocMakerArgs): Promise<string> {
		const performance = await measurePerformance();
		const databases = bundledDatabaseTable();
		return `
# Package Database

flowR ships a database of CRAN package exports so it can resolve calls into the packages you load.
After \`library(ggplot2)\`, a call to \`ggplot()\` resolves to \`ggplot2::ggplot\`. The same database
qualifies bare names (after \`library(purrr)\`, \`map()\` is \`purrr::map\`, not the \`maps\` plot) and backs
the ${ctx.linkPage('wiki/Query API', 'dependencies and call-context queries')} as well as the ${ctx.linkPage('wiki/Linter', '`undefined-symbol` rule')}.

## Configuration

The exports come from ${pluginLink('versions:sigdb')}, which reads the bundled database. It is enabled by
default (see ${ctx.linkPage('wiki/Interface', 'configuring flowR', 'configuring-flowr')}).

*Which* version's exports get resolved is decided by the version-reading plugins that pin the packages a
project uses. The following are only examples, and more may be registered.

- ${pluginLink('versions:description')} reads a package's \`DESCRIPTION\` (its \`Depends\` and \`Imports\`, see ${linkFlowRSourceFile('src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin.ts')}).
- ${pluginLink('versions:renv')} and ${pluginLink('versions:rv')} read a project's \`renv.lock\` or \`rv.lock\`
  to pin exact versions (see ${linkFlowRSourceFile('src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts')}).

So \`library(pkg)\` resolves the pinned version's exports. To override or extend the bundle, hand
${pluginLink('versions:sigdb')} extra sources: file paths, already-opened databases, or manifests.

${ctx.code(usePackageDatabase, { dropLinesStart: 1 })}

File sources load lazily on the first package load, so a script with no \`library()\` or \`use()\` calls
never pays to parse them. Set \`solver.sigdb.eagerlyLoad\` to mount the database up front instead, or
\`solver.sigdb.enabled: false\` to switch it off entirely. For a compressed (\`.br\`) or manifest source,
${ctx.linkM(FlowrAnalyzerPackageVersionsSigDbPlugin, 'preload', { hideClass: true })} it before analysis to mount it.

The base-R packages (\`base\`, \`stats\`, \`graphics\`, ...) resolve against an assumed R version, which
defaults to \`${DefaultAssumedRVersion}\` (\`solver.sigdb.assumedRVersion\`, or \`"auto"\` to detect the local R).
So \`library(stats)\` attaches that release's exports, and a bare \`sd()\` qualifies to \`stats::sd\` even
without attaching the base namespaces to the graph. Set \`solver.sigdb.linkBaseR\` to also link them as
dataflow edges.

You can also analyze a package straight off disk and ${ctx.linkM(FlowrAnalyzerPackageVersionsSigDbPlugin, 'addLocalPackages', { hideClass: true })}
as a resolvable source: flowR runs over the package's \`R/\` sources to extract each function's signature
(parameters, defaults, callees) together with its \`DESCRIPTION\` and \`NAMESPACE\` metadata.

Only a tiny **base floor** ships inside flowR (in git and on npm): the \`base.*\` scope -- self-contained base-R
signatures across every R release, a few hundred KB, always available offline. The large CRAN bundles are **not**
committed: \`current.*\` (every package's latest version) and \`history.*\` (every older version) live as assets on
the free \`solver.sigdb.downloadRepo\` GitHub release. A committed **link file**, \`src/data/sigdb/sigdb.remote.json\`,
records the release tag and each downloadable shard's sha256 and size, so \`:signature download\` builds the direct
release-CDN URL (no API rate limit), verifies every shard by content hash, and skips any already cached. Because
the link file is versioned, a \`git pull\` that updates it re-syncs only the shards whose hash changed -- and with
\`solver.sigdb.autoSync\` that check runs on startup and re-downloads in the background. When no richer bundle is
present flowR falls back to the base floor (the scope order is \`full\` > \`current\` > \`base\`), so \`library(stats)\`
still resolves on a plain clone. Any path in \`solver.sigdb.additionalPaths\` (or \`$FLOWR_SIGDB_DIR\`) is searched
alongside the default, so a downloaded bundle stays mounted on every start.
${databases ? `
## Bundled Databases

The default bundle is not a single file but a set of shards that a manifest routes between (see
${ctx.link(SigDatabaseSet)}). Nothing is read when the manifest opens. The first lookup of a package
decompresses only the one shard that holds it, plus the shared dictionary once. The following ship with this
build; the load column is the decompression time measured at generation time.

${databases}

Which shard answers a lookup follows from the package and the version asked for. A base-R package comes from
\`base-current\`, one of the 1,000 most-downloaded CRAN packages from \`current-top\`, and anything else from
\`current-rest\`. The \`*-full\` shards hold every historical version and are only touched when an older,
pinned version is requested, so a normal analysis never decompresses them. The shared dictionary is the one
file every shard depends on, so it is decompressed the first time any package is looked up and then reused.
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
