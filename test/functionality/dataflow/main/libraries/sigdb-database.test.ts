import { afterAll, describe, expect, test } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SigDatabase, SigDatabaseSet, readSignatureDb, verifyShardedDatabase } from '../../../../../src/project/sigdb/reader';
import { SigDbBuilder, writeSignatureDb, writeShardedDatabase, type ShardSpec } from '../../../../../src/project/sigdb/build';
import { writeManifest, SigDbManifestMagic, SigDbManifestSchema, type SigDbManifest } from '../../../../../src/project/sigdb/manifest';
import { readSigDbIndex, encodeIndex } from '../../../../../src/project/sigdb/index-format';
import { deriveLibraryExports } from '../../../../../src/project/sigdb/decode';
import { FnProp, ParamFlag, DepType, SigDbMagic, SigDbSchema, SigDbExt, MaxDefaultLength, DefaultCranBase } from '../../../../../src/project/sigdb/schema';
import { zstdSupported } from '../../../../../src/project/sigdb/codec';
import { resolveSource } from '../../../../../src/project/sigdb/decompress';
import { selectDownloadVariants } from '../../../../../src/project/sigdb/sigdb-download';
import { sigTmpDir, cleanupSigTmpDirs, writeAndOpen, ver } from '../../../_helper/sigdb';

afterAll(cleanupSigTmpDirs);

const meta = { date: '2026-05-23', generated: 0 };

describe('sigdb database (schema 4)', () => {
	test('builder + full read: dictionary/blobs/pkgs/meta round-trip, deterministic hash', async() => {
		const b = new SigDbBuilder();
		b.addPackage('ggplot2', { latest: '3.5.1', downloads: 100 });
		b.addVersion('ggplot2', '3.5.1', ver([
			{ name: 'aes', props: FnProp.Exported, params: [{ name: 'x' }], callees: ['c'], file: 'R/aes.R', line: 10 },
			{ name: 'helper', props: 0, params: [], callees: [], file: 'R/util.R', line: 3 }
		]));
		const db = b.build(meta);
		expect(db.format).toBe(SigDbMagic);
		expect(db.schema).toBe(SigDbSchema);
		expect(db.content.packages).toBe(1);
		expect(db.content.functions).toBe(2);
		expect(db.content.hash).toMatch(/^[0-9a-f]{16}$/);

		// every produced variant round-trips identically: the plain file, the always-written `.br` fallback,
		// and the `.zst` written additionally when this Node supports zstd
		const dir = sigTmpDir('sigdb-codecs-');
		await writeSignatureDb(path.join(dir, 'db'), db);
		const plain = path.join(dir, `db${SigDbExt}`);
		const producedExts = zstdSupported() ? ['.br', '.zst'] : ['.br'];
		for(const suffix of [SigDbExt, `${SigDbExt}.idx`, ...producedExts.map(e => `${SigDbExt}${e}`)]) {
			expect(fs.existsSync(path.join(dir, `db${suffix}`))).toBe(true);
		}
		expect(fs.existsSync(`${plain}.gz`)).toBe(false);   // `.gz` is legacy read-only, no longer written
		for(const f of [plain, ...producedExts.map(e => `${plain}${e}`)]) {
			const back = await readSignatureDb(f);
			expect(back.content.hash).toBe(db.content.hash);
			expect(back.strings).toEqual(db.strings);
			expect(back.pkgs).toEqual(db.pkgs);
			expect(back.meta).toEqual(db.meta);
		}
	});

	test('writing a bundle always produces the brotli `.br` fallback plus the `.zst` when zstd is supported', async() => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', ver([{ name: 'f', props: FnProp.Exported, params: [], callees: [], line: 1 }]));
		const db = b.build(meta);
		const dir = sigTmpDir('sigdb-default-');
		await writeSignatureDb(path.join(dir, 'db'), db);
		// `.br` is always written (universal fallback); `.zst` only when this Node can produce/read it
		expect(fs.existsSync(path.join(dir, `db${SigDbExt}.br`))).toBe(true);
		expect(fs.existsSync(path.join(dir, `db${SigDbExt}.zst`))).toBe(zstdSupported());
		// the reader prefers `.zst` when available; the `.br` fallback always opens on any Node
		const rd = await SigDatabase.open(path.join(dir, `db${SigDbExt}.br`));
		expect(rd.has('p')).toBe(true);
		rd.close();
	});

	test('lookup(): backwards-compatible LibraryExports (exported/internal/deprecated/locations/cranUrl)', () => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '2.0', archived: false });
		b.addVersion('p', '2.0', ver([
			{ name: 'pub', props: FnProp.Exported, params: [], callees: [], file: 'R/a.R', line: 5 },
			{ name: 'dep', props: FnProp.Exported | FnProp.Deprecated, params: [], callees: [], file: 'R/a.R', line: 9 },
			{ name: 'priv', props: 0, params: [], callees: [], file: 'R/b.R', line: 1 }
		]));
		const db = b.build(meta);
		const info = deriveLibraryExports(db.strings, db.blobs[db.pkgs['p']], db.meta['p'], 'p');
		expect(info?.version).toBe('2.0');
		expect(info?.exported.toSorted()).toEqual(['dep', 'pub']);
		expect(info?.internal).toEqual(['priv']);
		expect(info?.deprecated).toEqual(['dep']);
		expect(info?.cran).toBe(true);
		expect(info?.cranUrl).toBe(`${DefaultCranBase}p_2.0.tar.gz`);
		expect(info?.locations?.get('pub')).toEqual({ file: 'R/a.R', line: 5 });
	});

	test('non-cran version -> cran=false, no cranUrl', () => {
		const b = new SigDbBuilder();
		b.addPackage('local', { latest: '0.1' });
		b.addVersion('local', '0.1', ver([{ name: 'f', props: FnProp.Exported, params: [], callees: [], line: 1 }], false));
		const db = b.build(meta);
		const info = deriveLibraryExports(db.strings, db.blobs[db.pkgs['local']], db.meta['local'], 'local');
		expect(info?.cran).toBe(false);
		expect(info?.cranUrl).toBeUndefined();
	});

	test('version fallback uses R-version order, not lexical, when the recorded latest is absent', () => {
		const b = new SigDbBuilder();
		// recorded latest "2.0.0" is NOT among the stored versions -> fall back to the highest present
		b.addPackage('p', { latest: '2.0.0' });
		b.addVersion('p', '0.9.0', ver([{ name: 'old', props: FnProp.Exported, params: [], callees: [], line: 1 }]));
		b.addVersion('p', '0.10.0', ver([{ name: 'new', props: FnProp.Exported, params: [], callees: [], line: 1 }]));
		const db = b.build(meta);
		// 0.10.0 > 0.9.0 by R's numeric-version order (lexical string sort would wrongly pick 0.9.0)
		const info = deriveLibraryExports(db.strings, db.blobs[db.pkgs['p']], db.meta['p'], 'p');
		expect(info?.version).toBe('0.10.0');
		expect(info?.exported).toEqual(['new']);
	});

	test('sharing: identical functions across versions pool once; identical packages share a blob', () => {
		const fn = { name: 'f', props: FnProp.Exported, params: [{ name: 'x', forced: true }], callees: ['g'], file: 'R/f.R', line: 2 };
		const b = new SigDbBuilder();
		b.addPackage('a', { latest: '2.0' });
		b.addVersion('a', '1.0', ver([fn]));
		b.addVersion('a', '2.0', ver([fn]));
		b.addPackage('b', { latest: '2.0' });
		b.addVersion('b', '1.0', ver([fn]));
		b.addVersion('b', '2.0', ver([fn]));
		const db = b.build(meta);
		const blob = db.blobs[db.pkgs['a']];
		expect(blob.fns.length).toBe(1);
		expect(blob.sigs.length).toBe(1);
		expect(blob.cgs.length).toBe(1);
		expect(db.pkgs['a']).toBe(db.pkgs['b']); // whole-package dedup
		expect(db.blobs.length).toBe(1);
	});

	test('partial reader (SigDatabase): seeks one package; lookup + rich functions match', async() => {
		const b = new SigDbBuilder();
		b.addPackage('alpha', { latest: '1.0' });
		b.addVersion('alpha', '1.0', ver([{ name: 'a1', props: FnProp.Exported, params: [{ name: 'z', missing: true }, { name: 'w', default: 'NULL' }], callees: ['helper', 'c'], file: 'R/a.R', line: 4 }]));
		b.addPackage('beta', { latest: '2.0' });
		b.addVersion('beta', '2.0', ver([{ name: 'b1', props: 0, params: [], callees: [], file: 'R/b.R', line: 1 }]));
		const db = b.build(meta);

		const dir = sigTmpDir('sigdb-p-');
		const { writeSignatureDb } = await import('../../../../../src/project/sigdb/build');
		await writeSignatureDb(path.join(dir, 'db'), db);
		const plain = path.join(dir, `db${SigDbExt}`);

		const idx = readSigDbIndex(plain);
		expect(idx.pkgs['alpha']).toBeDefined();
		expect(idx.meta['alpha'][0]).toBe('1.0');

		const rd = await SigDatabase.open(plain);
		expect(rd.has('alpha')).toBe(true);
		expect(rd.has('nope')).toBe(false);
		expect(rd.packageNames().sort()).toEqual(['alpha', 'beta']);

		const info = rd.lookup('alpha');
		expect(info?.exported).toEqual(['a1']);

		const fns = rd.functions('alpha', '1.0');
		expect(fns?.length).toBe(1);
		expect(fns?.[0].signature.map(p => p.name)).toEqual(['z', 'w']);
		expect(fns?.[0].signature[0].optional).toBe(false); // missing -> not optional
		expect(fns?.[0].signature[1].default).toBe('NULL');
		expect(fns?.[0].callees.toSorted()).toEqual(['c', 'helper']);
		rd.close();
	});

	test('ParamFlag packing: forced + missing', () => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', ver([{ name: 'f', props: FnProp.Exported, params: [{ name: 'a', forced: true, missing: true }], callees: [], line: 1 }]));
		const db = b.build(meta);
		const sig = db.blobs[db.pkgs['p']].sigs[0];
		expect((sig[0] as [number, number])[1]).toBe(ParamFlag.Forced | ParamFlag.Missing);
	});

	test('overlong parameter defaults are stored truncated (dictionary stays compact); short ones verbatim', () => {
		const longDefault = 'c(' + Array.from({ length: 40 }, (_, i) => `"col_${i}"`).join(', ') + ')';
		expect(longDefault.length).toBeGreaterThan(MaxDefaultLength);
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', ver([
			{ name: 'f', props: FnProp.Exported, params: [{ name: 'x', default: longDefault }, { name: 'y', default: 'NULL' }], callees: [], line: 1 }
		]));
		const dict = b.build(meta).strings;
		expect(dict).not.toContain(longDefault);                              // the full 7 KB-style default is dropped
		expect(dict).toContain(longDefault.slice(0, MaxDefaultLength) + '…'); // ...a truncated preview is kept
		expect(dict).toContain('NULL');                                       // short defaults are unchanged
	});
});

describe('sigdb tiers, shards and federation', () => {
	const exp = (name: string) => ({ name, props: FnProp.Exported, params: [], callees: [], line: 1 });
	function builder(): SigDbBuilder {
		const b = new SigDbBuilder();
		// hot: many downloads, two versions; cold: few downloads, two versions
		b.addPackage('hot', { latest: '2.0', downloads: 1000 });
		b.addVersion('hot', '1.0', ver([exp('h_old')]));
		b.addVersion('hot', '2.0', ver([exp('h_new')]));
		b.addPackage('cold', { latest: '2.0', downloads: 1 });
		b.addVersion('cold', '1.0', ver([exp('c_old')]));
		b.addVersion('cold', '2.0', ver([exp('c_new')]));
		return b;
	}

	test('current tier keeps only the latest version', () => {
		const db = builder().build({ ...meta, tier: 'current' });
		expect(Object.keys(db.blobs[db.pkgs['hot']].versions)).toEqual(['2.0']);
		expect(db.content.tier).toBe('current');
		expect(db.content.versions).toBe(2); // one per package
	});

	test('history tier keeps every version except the latest, partitioning `full` with `current` (no overlap)', () => {
		const hist = builder().build({ ...meta, tier: 'history' });
		const curr = builder().build({ ...meta, tier: 'current' });
		const full = builder().build({ ...meta, tier: 'full' });
		const versOf = (db: typeof hist, pkg: string) => Object.keys(db.blobs[db.pkgs[pkg]].versions).sort();
		// history drops the latest (2.0), keeping only the older 1.0
		expect(versOf(hist, 'hot')).toEqual(['1.0']);
		expect(hist.content.tier).toBe('history');
		// current ⊎ history is exactly full, with nothing shared -> zero redundancy when mounted together
		for(const pkg of ['hot', 'cold']) {
			const c = versOf(curr, pkg), h = versOf(hist, pkg);
			expect(h.filter(v => c.includes(v))).toEqual([]);                 // disjoint
			expect([...c, ...h].sort()).toEqual(versOf(full, pkg));           // complete
		}
	});

	test('history tier drops single-version packages entirely (not routed, so they do not resolve empty)', () => {
		const b = new SigDbBuilder();
		b.addPackage('multi', { latest: '2.0', downloads: 5 });
		b.addVersion('multi', '1.0', ver([exp('m1')]));
		b.addVersion('multi', '2.0', ver([exp('m2')]));
		b.addPackage('single', { latest: '1.0', downloads: 5 });  // only its latest exists
		b.addVersion('single', '1.0', ver([exp('s1')]));
		const hist = b.build({ ...meta, tier: 'history' });
		expect(Object.keys(hist.pkgs)).toEqual(['multi']);          // `single` has no non-latest version -> excluded
		expect(hist.blobs[hist.pkgs['multi']].versions).toHaveProperty('1.0');
	});

	test('popularity shard splits by download rank', () => {
		const top = builder().build({ ...meta, topN: 1, shard: 'top' });
		const rest = builder().build({ ...meta, topN: 1, shard: 'rest' });
		expect(Object.keys(top.pkgs)).toEqual(['hot']);
		expect(Object.keys(rest.pkgs)).toEqual(['cold']);
		expect(top.content.shard).toBe('top');
	});

	test('federation: a manifest routes packages to the right shard; current preferred, full fallback for old versions', async() => {
		const dir = sigTmpDir('sigdb-fed-');
		const b = builder();
		// four shards: current/full x top/rest
		const shards: SigDbManifest['shards'] = [];
		for(const tier of ['current', 'full'] as const) {
			for(const shard of ['top', 'rest'] as const) {
				const db = b.build({ ...meta, tier, topN: 1, shard });
				const id = `${tier}-${shard}`;
				await writeSignatureDb(path.join(dir, id), db);
				shards.push({ id, tier, shard, topN: 1, path: `${id}${SigDbExt}`, hash: db.content.hash, packages: db.content.packages, versions: db.content.versions });
			}
		}
		const manifest: SigDbManifest = { format: SigDbManifestMagic, schema: SigDbManifestSchema, date: meta.date, generated: 0, shards };
		writeManifest(path.join(dir, 'sigdb.manifest.json'), manifest);

		const set = await SigDatabaseSet.openManifest(path.join(dir, 'sigdb.manifest.json'));
		expect(set.has('hot')).toBe(true);
		expect(set.has('cold')).toBe(true);
		expect(set.packageNames().sort()).toEqual(['cold', 'hot']);
		// latest resolves via the (preferred) current shard
		expect(set.lookup('hot')?.version).toBe('2.0');
		expect(set.lookup('hot')?.exported).toEqual(['h_new']);
		// an old version is served by the full shard (not in current)
		expect(set.lookup('hot', '1.0')?.version).toBe('1.0');
		expect(set.lookup('hot', '1.0')?.exported).toEqual(['h_old']);
		expect(set.lookup('cold', '1.0')?.exported).toEqual(['c_old']);
		set.close();
	});

	test('manifest embeds indices: reads from .br-only shards (no .idx), lazily, with preload', async() => {
		const dir = sigTmpDir('sigdb-embed-');
		const cacheDir = sigTmpDir('sigdb-embed-cache-');
		const b = builder();
		const shards: SigDbManifest['shards'] = [];
		let globalMeta: SigDbManifest['meta'] = {};
		for(const tier of ['current', 'full'] as const) {
			const db = b.build({ ...meta, tier });
			const id = tier;
			const index = await writeSignatureDb(path.join(dir, id), db); // returns the SigDbIndex
			// keep ONLY the compressed shards (as a shipped package would); embed the compact index + hoist meta in the manifest
			fs.rmSync(path.join(dir, `${id}${SigDbExt}`));
			fs.rmSync(path.join(dir, `${id}${SigDbExt}.idx`));
			globalMeta = { ...globalMeta, ...index.meta };
			shards.push({ id, tier, path: `${id}${SigDbExt}`, hash: db.content.hash, packages: db.content.packages, versions: db.content.versions, idx: encodeIndex(index, false) });
		}
		const manifest: SigDbManifest = { format: SigDbManifestMagic, schema: SigDbManifestSchema, date: meta.date, generated: 0, meta: globalMeta, shards };
		writeManifest(path.join(dir, 'm.json'), manifest);
		// no plain or `.idx` sidecars remain, only the compressed shard variants + manifest
		expect(fs.readdirSync(dir).filter(f => f.endsWith(SigDbExt) || f.endsWith('.idx'))).toEqual([]);

		const set = await SigDatabaseSet.openManifest(path.join(dir, 'm.json'), { cacheDir });
		await set.preload(['hot']);                          // warm in the background
		expect(set.lookup('hot')?.exported).toEqual(['h_new']);   // from the current shard
		expect(set.lookup('hot', '1.0')?.exported).toEqual(['h_old']); // from the full shard (lazy decompress)
		set.close();
	});

	test('cache: SigDatabase.open decompresses a legacy .br into the cache and answers lookups', async() => {
		const dir = sigTmpDir('sigdb-cache-');
		const db = builder().build(meta);
		await writeSignatureDb(path.join(dir, 'db'), db); // the `.br` fallback is always written (legacy shipped bundles are `.br`)
		const cacheDir = sigTmpDir('sigdb-cachedir-');
		const rd = await SigDatabase.open(path.join(dir, `db${SigDbExt}.br`), { cacheDir });
		expect(rd.lookup('hot')?.exported).toEqual(['h_new']);
		rd.close();
		// the decompressed cache file now exists (under the cache dir's sigdb/ namespace) and is reused
		expect(fs.readdirSync(path.join(cacheDir, 'sigdb')).some(f => f.endsWith(SigDbExt))).toBe(true);
		const rd2 = await SigDatabase.open(path.join(dir, `db${SigDbExt}.br`), { cacheDir });
		expect(rd2.has('cold')).toBe(true);
		rd2.close();
	});

	test.skipIf(!zstdSupported())('cache: SigDatabase.open decompresses a new .zst into the cache and answers lookups', async() => {
		const dir = sigTmpDir('sigdb-cache-zst-');
		const db = builder().build(meta);
		await writeSignatureDb(path.join(dir, 'db'), db); // writes both, incl. the `.zst`
		const cacheDir = sigTmpDir('sigdb-cachedir-zst-');
		const rd = await SigDatabase.open(path.join(dir, `db${SigDbExt}.zst`), { cacheDir });
		expect(rd.lookup('hot')?.exported).toEqual(['h_new']);
		rd.close();
		expect(fs.readdirSync(path.join(cacheDir, 'sigdb')).some(f => f.endsWith(SigDbExt))).toBe(true);
	});
});

describe('sigdb shared-dictionary shards, verification, R-core markers and release dates', () => {
	const exp = (name: string) => ({ name, props: FnProp.Exported, params: [], callees: [], line: 1 });
	function builder(): SigDbBuilder {
		const b = new SigDbBuilder();
		b.addPackage('hot', { latest: '2.0', downloads: 1000 });
		b.addVersion('hot', '1.0', { cran: true, functions: [exp('h_old')], date: Date.UTC(2020, 0, 1) });
		b.addVersion('hot', '2.0', { cran: true, functions: [exp('h_new')], date: Date.UTC(2021, 0, 1) });
		b.addPackage('cold', { latest: '2.0', downloads: 1 });
		b.addVersion('cold', '1.0', ver([exp('c_old')]));
		b.addVersion('cold', '2.0', ver([exp('c_new')]));
		// an R-core / base package (like the historical `mva`): its versions are the R releases it was part of core
		b.addPackage('mva', { latest: '1.9.1', core: true });
		b.addVersion('mva', '1.8.0', { cran: true, functions: [exp('cancor')], date: Date.UTC(2003, 9, 8) });
		b.addVersion('mva', '1.9.1', { cran: true, functions: [exp('cancor')], date: Date.UTC(2004, 5, 5) });
		return b;
	}
	// the real default layout: base R gets its own two shards + is excluded from the popularity shards
	const specs: ShardSpec[] = [
		{ tier: 'current', core: 'only' }, { tier: 'full', core: 'only' },
		{ tier: 'current', shard: 'top', topN: 1, core: 'exclude' }, { tier: 'current', shard: 'rest', topN: 1, core: 'exclude' },
		{ tier: 'full', shard: 'top', topN: 1, core: 'exclude' }, { tier: 'full', shard: 'rest', topN: 1, core: 'exclude' }
	];

	test('buildSharded pools every shard into ONE shared dictionary; base R is isolated into its own shards', () => {
		const sharded = builder().buildSharded(meta, specs);
		expect(sharded.shards.map(s => s.id)).toEqual(['base-current', 'base-full', 'current-top', 'current-rest', 'full-top', 'full-rest']);
		expect(sharded.dictHash).toMatch(/^[0-9a-f]{16}$/);
		for(const s of sharded.shards) {
			expect(s.hash).toMatch(/^[0-9a-f]{16}$/);
		}
		const byId = Object.fromEntries(sharded.shards.map(s => [s.id, Object.keys(s.pkgs).sort()]));
		expect(byId['base-current']).toEqual(['mva']);   // the only R-core package here
		expect(byId['base-full']).toEqual(['mva']);
		// base R must NOT leak into the popularity shards
		for(const id of ['current-top', 'current-rest', 'full-top', 'full-rest']) {
			expect(byId[id]).not.toContain('mva');
		}
		expect(byId['current-top']).toEqual(['hot']);    // most-downloaded non-core
		expect(byId['current-rest']).toEqual(['cold']);
	});

	test('writeShardedDatabase + SigDatabaseSet: shared dict loads once, routes across shards, verifies clean', async() => {
		const dir = sigTmpDir('sigdb-shared-');
		const cacheDir = sigTmpDir('sigdb-shared-cache-');
		const sharded = builder().buildSharded(meta, specs);
		const manifestFile = path.join(dir, 'sigs.manifest.json');
		const manifest = await writeShardedDatabase(path.join(dir, 'sigs'), sharded, manifestFile);
		// exactly one shared dictionary, referenced by every shard
		expect(manifest.dicts?.length).toBe(1);
		expect(manifest.shards.every(s => s.dict === manifest.dicts?.[0].id)).toBe(true);

		const set = await SigDatabaseSet.openManifest(manifestFile, { cacheDir });
		// latest via the current shard; an old version via the full shard — all through the shared dictionary
		expect(set.lookup('hot')?.exported).toEqual(['h_new']);
		expect(set.lookup('hot', '1.0')?.exported).toEqual(['h_old']);
		expect(set.lookup('cold', '1.0')?.exported).toEqual(['c_old']);

		// R-core markers
		expect(set.isBaseR('mva')).toBe(true);
		expect(set.isBaseR('hot')).toBe(false);
		expect(set.coreVersions('mva')?.map(v => v.str)).toEqual(['1.8.0', '1.9.1']); // from the full-history shard
		expect(set.coreVersions('hot')).toBeUndefined();

		// release dates (informative RVersion, not bare strings)
		expect(set.latestVersion('hot')?.str).toBe('2.0');
		expect(set.releaseDate('hot')?.getUTCFullYear()).toBe(2021);
		expect(set.releaseDate('hot', '1.0')?.getUTCFullYear()).toBe(2020);
		expect(set.releaseDates('hot').map(r => r.version.str)).toEqual(['1.0', '2.0']);
		set.close();

		// strong verification gate over the written .br files
		const report = await verifyShardedDatabase(manifestFile, { cacheDir, requirePackages: ['mva', 'hot'] });
		expect(report.errors).toEqual([]);
		expect(report.ok).toBe(true);
		expect(report.dictsOk).toBe(true);
		expect(report.shards.every(s => s.hashOk)).toBe(true);
	});

	test('shards are individually enable/disable-able: include/exclude by id', async() => {
		const dir = sigTmpDir('sigdb-toggle-');
		const cacheDir = sigTmpDir('sigdb-toggle-cache-');
		const sharded = builder().buildSharded(meta, specs);
		const manifestFile = path.join(dir, 'sigs.manifest.json');
		await writeShardedDatabase(path.join(dir, 'sigs'), sharded, manifestFile);

		// current-only: disable the two history shards entirely
		const cur = await SigDatabaseSet.openManifest(manifestFile, { cacheDir, excludeShards: ['full-top', 'full-rest'] });
		expect(cur.manifest.shards.map(s => s.id).sort()).toEqual(['base-current', 'base-full', 'current-rest', 'current-top']);
		expect(cur.lookup('hot')?.exported).toEqual(['h_new']);      // latest still resolves
		expect(cur.hasVersion('hot', '1.0')).toBe(false);            // history shard gone -> old version unreachable
		cur.close();

		// includeShards: load ONLY base R
		const baseOnly = await SigDatabaseSet.openManifest(manifestFile, { cacheDir, includeShards: ['base-current', 'base-full'] });
		expect(baseOnly.packageNames()).toEqual(['mva']);
		expect(baseOnly.has('hot')).toBe(false);
		baseOnly.close();

		// filtering everything away is an error, not a silent empty set
		await expect(SigDatabaseSet.openManifest(manifestFile, { cacheDir, includeShards: ['nope'] }))
			.rejects.toThrow(/no shards left/);
	});

	test('verification catches a tampered shard hash', async() => {
		const dir = sigTmpDir('sigdb-tamper-');
		const sharded = builder().buildSharded(meta, specs);
		const manifestFile = path.join(dir, 'sigs.manifest.json');
		const manifest = await writeShardedDatabase(path.join(dir, 'sigs'), sharded, manifestFile);
		// corrupt one shard's expected hash in the manifest
		manifest.shards[0].hash = '0000000000000000';
		writeManifest(manifestFile, manifest);
		const report = await verifyShardedDatabase(manifestFile);
		expect(report.ok).toBe(false);
		expect(report.errors.some(e => e.includes('recomputed hash'))).toBe(true);
	});

	test('release dates survive a full write/read round-trip on a single bundle', async() => {
		const dir = sigTmpDir('sigdb-dates-');
		const db = builder().build(meta);
		const rd = await writeAndOpen(dir, db);
		expect(rd.isBaseR('mva')).toBe(true);
		expect(rd.coreVersions('mva')?.map(v => v.str)).toEqual(['1.8.0', '1.9.1']);
		expect(rd.latestVersion('hot')?.str).toBe('2.0');
		expect(rd.releaseDate('mva', '1.9.1')?.getUTCFullYear()).toBe(2004);
		rd.close();
	});
});

describe('sigdb dependencies and feature selection', () => {
	function withDeps(): SigDbBuilder {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '2.0' });
		b.addVersion('p', '1.0', { cran:         true, functions:    [{ name: 'f', props: FnProp.Exported, params: [], callees: [], file: 'R/f.R', line: 1 }],
			dependencies: [{ name: 'R', type: DepType.Depends, constraint: '>= 3.5.0' }, { name: 'R6', type: DepType.Imports }] });
		b.addVersion('p', '2.0', { cran:         true, functions:    [{ name: 'f', props: FnProp.Exported, params: [], callees: [], file: 'R/f.R', line: 1 }],
			dependencies: [{ name: 'R6', type: DepType.Imports }, { name: 'testthat', type: DepType.Suggests, constraint: '>= 2.1.0' }] });
		return b;
	}

	test('dependencies decode per version with type + version qualifier', () => {
		const db = withDeps().build({ ...meta });
		const blob = db.blobs[db.pkgs['p']];
		// round-trip via a written bundle + the reader
		return (async() => {
			const dir = sigTmpDir('sigdb-deps-');
			const rd = await writeAndOpen(dir, db);
			const v2 = rd.dependencies('p');           // latest
			expect(v2).toEqual([
				{ name: 'R6', type: DepType.Imports },
				{ name: 'testthat', type: DepType.Suggests, constraint: '>= 2.1.0' }
			]);
			const v1 = rd.dependencies('p', '1.0');
			expect(v1).toContainEqual({ name: 'R', type: DepType.Depends, constraint: '>= 3.5.0' });
			rd.close();
			// unchanged-across-versions dep lists would pool; here they differ, so two entries
			expect(blob.deps.length).toBe(2);
		})();
	});

	test('feature selection: dependencies-only bundle omits signatures, call graphs and locations', () => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', { cran:      true, functions: [
			{ name: 'f', props: FnProp.Exported, params: [{ name: 'x', default: 'NULL' }], callees: ['g', 'h'], file: 'R/f.R', line: 9 }
		], dependencies: [{ name: 'R6', type: DepType.Imports }] });
		const db = b.build({ ...meta, features: { signatures: false, callGraphs: false, locations: false } });
		const blob = db.blobs[db.pkgs['p']];
		expect(db.content.features).toEqual({ signatures: false, callGraphs: false, locations: false, dependencies: true });
		expect(blob.sigs.length).toBe(0);   // no signatures stored
		expect(blob.cgs.length).toBe(0);    // no call graphs stored
		const [, sigIdx, cgIdx, bits, fileIdx] = blob.fns[0];
		expect(sigIdx).toBe(-1);
		expect(cgIdx).toBe(-1);
		expect(fileIdx).toBe(-1);           // no location
		expect(bits & FnProp.Exported).toBeTruthy(); // exported flag kept (the export view still works)
		expect(blob.deps.length).toBe(1);   // dependencies kept
	});

	test('exports view still works when only dependencies+exports are stored', () => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', { cran:      true, functions: [
			{ name: 'pub', props: FnProp.Exported, params: [], callees: [], file: 'R/a.R', line: 1 },
			{ name: 'priv', props: 0, params: [], callees: [], file: 'R/a.R', line: 2 }
		] });
		const db = b.build({ ...meta, features: { signatures: false, callGraphs: false } });
		const info = deriveLibraryExports(db.strings, db.blobs[db.pkgs['p']], db.meta['p'], 'p');
		expect(info?.exported).toEqual(['pub']);
		expect(info?.internal).toEqual(['priv']);
	});
});

describe('sigdb dependency string indices survive the frequency-sort remap', () => {
	test('a rare dependency name/constraint decodes correctly even when the dictionary is heavily reordered', () => {
		const b = new SigDbBuilder();
		// many hot functions/callees so the frequency sort pushes the rare dependency strings to high indices
		const hot = Array.from({ length: 50 }, (_, i) => ({ name: `hot${i}`, props: FnProp.Exported, params: [], callees: ['common', 'c', 'paste', 'list'], line: i }));
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', { cran:         true, functions:    hot,
			dependencies: [{ name: 'a_very_rare_pkg_name', type: DepType.Imports, constraint: '>= 9.9.9-rare' }] });
		const db = b.build({ ...meta }); // optimizeStrings default on
		const blob = db.blobs[db.pkgs['p']];
		const dep = blob.deps[0][0];
		expect(db.strings[dep[0]]).toBe('a_very_rare_pkg_name');
		expect(db.strings[(dep as [number, number, number])[2]]).toBe('>= 9.9.9-rare');
	});
});

describe('sigdb dual-codec output + runtime-availability source selection', () => {
	const exp = (name: string) => ({ name, props: FnProp.Exported, params: [], callees: [], line: 1 });
	function shardedBuilder(): SigDbBuilder {
		const b = new SigDbBuilder();
		b.addPackage('hot', { latest: '1.0', downloads: 100 });
		b.addVersion('hot', '1.0', ver([exp('h')]));
		b.addPackage('cold', { latest: '1.0', downloads: 1 });
		b.addVersion('cold', '1.0', ver([exp('c')]));
		return b;
	}
	const specs: ShardSpec[] = [{ tier: 'current', shard: 'top', topN: 1 }, { tier: 'current', shard: 'rest', topN: 1 }];

	test('a sharded write emits the `.br` fallback beside every `.zst` for shards, dictionary and manifest', async() => {
		const dir = sigTmpDir('sigdb-dual-');
		const sharded = shardedBuilder().buildSharded(meta, specs);
		const manifestFile = path.join(dir, 'sigs.manifest.json');
		const manifest = await writeShardedDatabase(path.join(dir, 'sigs'), sharded, manifestFile);
		// the brotli fallback exists for the manifest, the shared dictionary and every shard...
		expect(fs.existsSync(`${manifestFile}.br`)).toBe(true);
		expect(fs.existsSync(path.join(dir, `${manifest.dicts?.[0].path}.br`))).toBe(true);
		for(const s of manifest.shards) {
			expect(fs.existsSync(path.join(dir, `${s.path}.br`))).toBe(true);
			expect(fs.existsSync(path.join(dir, `${s.path}.zst`))).toBe(zstdSupported());   // `.zst` only when supported
		}
		expect(fs.existsSync(`${manifestFile}.zst`)).toBe(zstdSupported());
		// no legacy `.gz` is produced anymore
		expect(fs.readdirSync(dir).some(f => f.endsWith('.gz'))).toBe(false);
	});

	test('resolveSource prefers `.zst` when this Node supports it, and falls back to `.br` when only `.br` exists', async() => {
		const dir = sigTmpDir('sigdb-resolve-');
		const sharded = shardedBuilder().buildSharded(meta, specs);
		const manifest = await writeShardedDatabase(path.join(dir, 'sigs'), sharded, path.join(dir, 'sigs.manifest.json'));
		const rel = manifest.shards[0].path;   // e.g. `sigs.current-top.sigs.ndjson`

		// a shipped bundle has only the compressed variants (no plain sidecar): copy just `.br` + `.zst` across
		const shipped = sigTmpDir('sigdb-shipped-');
		for(const e of zstdSupported() ? ['.br', '.zst'] : ['.br']) {
			fs.copyFileSync(path.join(dir, `${rel}${e}`), path.join(shipped, `${rel}${e}`));
		}
		// both variants present -> the preferred one is `.zst` when supported, else the `.br` fallback
		expect(resolveSource(shipped, rel)).toBe(path.join(shipped, `${rel}${zstdSupported() ? '.zst' : '.br'}`));

		// simulate a runtime that cannot use `.zst` (or a `.br`-only bundle): a dir holding only the `.br`
		const brOnly = sigTmpDir('sigdb-br-only-');
		fs.copyFileSync(path.join(dir, `${rel}.br`), path.join(brOnly, `${rel}.br`));
		expect(resolveSource(brOnly, rel)).toBe(path.join(brOnly, `${rel}.br`));   // never a missing/undecodable `.zst`
	});

	test('selectDownloadVariants picks exactly one variant per logical shard: `.zst` when supported, else `.br`', () => {
		// the release hosts both variants of two logical shards plus a `.br`-only legacy shard
		const listed = [
			'current.dict.sigs.ndjson.br', 'current.dict.sigs.ndjson.zst',
			'current.current-top.sigs.ndjson.br', 'current.current-top.sigs.ndjson.zst',
			'legacy.base-current.sigs.ndjson.br'   // only `.br` published -> always chosen regardless of zstd
		];
		const picked = selectDownloadVariants(listed).sort();
		const preferred = zstdSupported() ? '.zst' : '.br';
		expect(picked).toEqual([
			`current.current-top.sigs.ndjson${preferred}`,
			`current.dict.sigs.ndjson${preferred}`,
			'legacy.base-current.sigs.ndjson.br'
		].sort());
		expect(picked.length).toBe(3);   // one per logical shard, never both variants of the same one
	});
});
