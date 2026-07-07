import { describe, expect, test } from 'vitest';
import zlib from 'zlib';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PkgDatabase, PkgDbBuilder, cranBlobUrl, validatePkgDb, DefaultCranBase, type PkgDbAll } from '../../../../../src/project/plugins/package-version-plugins/pkgdb';

const header = { format: 'flowr-pkgdb', schema: 4, content: { version: 1, date: '2026-05-23', hash: 'x', generated: 0, packages: 3, versions: 3 } };

const latestDb = {
	...header,
	scope:    'latest',
	strings:  ['common'],
	archived: ['oldpkg'],
	noncran:  ['localpkg'],
	pkgs:     {
		ggplot2:  ['3.5.1', [0, 'aes']],
		oldpkg:   ['1.0', ['old']],
		localpkg: ['0.1', ['fn']]
	}
};

const allDb = {
	...header,
	scope:    'all',
	strings:  ['a', 'b'],
	lists:    [[], [0, 1], ['helper'], ['dep']],
	archived: ['oldpkg'],
	pkgs:     {
		p:      ['2.0', [['1.0', 1, 2], ['2.0', 1, 2]]],
		oldpkg: ['1.0', [['1.0', 1, 2, 3]], ['1.0']]
	}
};

describe('pkgdb database (schema 4)', () => {
	describe('latest scope', () => {
		const db = PkgDatabase.fromObject(latestDb);

		test('version-first tuple: decodes pooled indices + inlined singletons; reconstructs the CRAN blob', () => {
			const info = db.lookup('ggplot2');
			expect(info?.version).toBe('3.5.1');
			expect(info?.exported).toEqual(['common', 'aes']); // 0 -> 'common', 'aes' inlined
			expect(info?.internal).toEqual([]);                // internals are not in the latest scope
			expect(info?.cran).toBe(true);
			expect(info?.cranUrl).toBe(`${DefaultCranBase}ggplot2_3.5.1.tar.gz`);
		});

		test('archived package (top-level set) uses the Archive tree; latest carries no deprecation', () => {
			const info = db.lookup('oldpkg');
			expect(info?.exported).toEqual(['old']);
			expect(info?.deprecated).toEqual([]); // deprecation lives only in the `all` scope
			expect(info?.cranUrl).toBe(`${DefaultCranBase}Archive/oldpkg/oldpkg_1.0.tar.gz`);
		});

		test('non-CRAN package (top-level noncran set) has no blob url', () => {
			const info = db.lookup('localpkg');
			expect(info?.cran).toBe(false);
			expect(info?.cranUrl).toBeUndefined();
		});

		test('missing package -> undefined', () => {
			expect(db.lookup('nope')).toBeUndefined();
			expect(db.has('ggplot2')).toBe(true);
		});
	});

	describe('all scope', () => {
		const db = PkgDatabase.fromObject(allDb);

		test('carries exported + internal identifiers; identical versions share pooled lists', () => {
			const info = db.lookup('p', '1.0');
			expect(info?.exported).toEqual(['a', 'b']);
			expect(info?.internal).toEqual(['helper']);
			expect(db.lookup('p', '2.0')?.exported).toEqual(['a', 'b']);
		});

		test('older / archived versions resolve to the Archive tree; deprecated decoded', () => {
			const info = db.lookup('oldpkg', '1.0');
			expect(info?.deprecated).toEqual(['dep']);
			expect(info?.internal).toEqual(['helper']);
			expect(info?.cran).toBe(false); // listed in nc
			expect(info?.cranUrl).toBeUndefined();
		});

		test('unknown version falls back to latest', () => {
			expect(db.lookup('p', '9.9.9')?.version).toBe('2.0');
		});

		test('optional definition locations round-trip for the latest version, absent otherwise', () => {
			const b = new PkgDbBuilder();
			b.addPackage('withLoc', { latest: '2.0' });
			b.addVersion('withLoc', '1.0', { exported: ['old'], internal: [], deprecated: [], cran: true });
			b.addVersion('withLoc', '2.0', { exported:   ['f', 'g'], internal:   ['h'], deprecated: [], cran:       true,
				locations:  new Map([['f', ['R/f.R', 10]], ['g', ['R/g.R', 20]], ['h', ['R/util.R', 3]]]) });
			b.addPackage('noLoc', { latest: '1.0' });
			b.addVersion('noLoc', '1.0', { exported: ['x'], internal: [], deprecated: [], cran: true });
			const withLoc = PkgDatabase.fromObject(b.build('all', { version: 1, date: '2026-05-23', generated: 0 }));

			const latest = withLoc.lookup('withLoc');
			expect(latest?.locations?.get('f')).toEqual({ file: 'R/f.R', line: 10 });
			expect(latest?.locations?.get('h')).toEqual({ file: 'R/util.R', line: 3 });
			expect(withLoc.lookup('withLoc', '1.0')?.locations).toBeUndefined(); // only the latest version carries them
			expect(withLoc.lookup('noLoc')?.locations).toBeUndefined();          // package without locations
		});

		test('a database built without any locations omits the files/locs fields entirely', () => {
			const b = new PkgDbBuilder();
			b.addPackage('p', { latest: '1.0' });
			b.addVersion('p', '1.0', { exported: ['f'], internal: [], deprecated: [], cran: true });
			const raw = b.build('all', { version: 1, date: '2026-05-23', generated: 0 }) as PkgDbAll;
			expect(raw.files).toBeUndefined();
			expect(raw.locs).toBeUndefined();
			expect(PkgDatabase.fromObject(raw).lookup('p')?.locations).toBeUndefined();
		});
	});

	test('cranBlobUrl helper', () => {
		expect(cranBlobUrl(DefaultCranBase, 'p', '1.0', { latest: '1.0', archived: false, cran: true })).toBe(`${DefaultCranBase}p_1.0.tar.gz`);
		expect(cranBlobUrl(DefaultCranBase, 'p', '0.9', { latest: '1.0', archived: false, cran: true })).toBe(`${DefaultCranBase}Archive/p/p_0.9.tar.gz`);
		expect(cranBlobUrl(DefaultCranBase, 'p', '1.0', { latest: '1.0', archived: false, cran: false })).toBeUndefined();
	});

	test('brotli (.br), gzip (.gz) and plain (.json) files all load via fromFileSync', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgdb-'));
		const json = Buffer.from(JSON.stringify(latestDb));
		const brFile = path.join(dir, 'pkgdb-latest.json.br');
		const gzFile = path.join(dir, 'pkgdb-latest.json.gz');
		const plain = path.join(dir, 'pkgdb-latest.json');
		fs.writeFileSync(brFile, zlib.brotliCompressSync(json));
		fs.writeFileSync(gzFile, zlib.gzipSync(json));
		fs.writeFileSync(plain, json);
		for(const f of [brFile, gzFile, plain]) {
			expect(PkgDatabase.fromFileSync(f).lookup('ggplot2')?.exported).toEqual(['common', 'aes']);
		}
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test('gzip round-trip via portable fromBytes', async() => {
		const gz = zlib.gzipSync(Buffer.from(JSON.stringify(latestDb)));
		const loaded = await PkgDatabase.fromBytes(new Uint8Array(gz));
		expect(loaded.lookup('ggplot2')?.exported).toEqual(['common', 'aes']);
	});

	test('plain (non-gzip) bytes via fromBytes', async() => {
		const loaded = await PkgDatabase.fromBytes(new TextEncoder().encode(JSON.stringify(allDb)));
		expect(loaded.lookup('p')?.internal).toEqual(['helper']);
	});

	test('serialize + deserialize + lookup stays fast for a few thousand packages', () => {
		const b = new PkgDbBuilder();
		for(let i = 0; i < 5000; i++) {
			b.addPackage(`p${i}`, { latest: '1.0.0', downloads: i });
			b.addVersion(`p${i}`, '1.0.0', { exported: [`f${i}`, `g${i}`, 'common'], internal: [], deprecated: [], cran: true });
		}
		const t0 = Date.now();
		const db = PkgDatabase.fromObject(b.build('latest', { version: 1, date: '2026-05-23', generated: 0 }));
		for(let i = 0; i < 5000; i++) {
			db.lookup(`p${i}`);
		}
		const elapsed = Date.now() - t0;
		expect(db.content.packages).toBe(5000);
		expect(db.lookup('p42')?.exported).toContain('common');   // shared name is pooled
		expect(elapsed).toBeLessThan(2000);                        // generous bound; typically well under 100ms
	});

	describe('PkgDbBuilder round-trip (serialize then read back)', () => {
		const ex = (exported: string[], internal: string[] = [], deprecated: string[] = [], cran = true) => ({ exported, internal, deprecated, cran });
		const bmeta = { version: 20260523, date: '2026-05-23', generated: 0 };

		test('latest scope: exports of the most-downloaded packages, exclusive of internals', () => {
			const b = new PkgDbBuilder();
			b.addPackage('pop', { latest: '2.0', downloads: 1000 });
			b.addPackage('rare', { latest: '1.0', downloads: 1 });
			b.addVersion('pop', '2.0', ex(['ggplot', 'aes'], ['helper']));
			b.addVersion('rare', '1.0', ex(['x']));
			const db = PkgDatabase.fromObject(b.build('latest', { ...bmeta, topN: 1 }));
			expect(db.lookup('pop')?.exported.sort()).toEqual(['aes', 'ggplot']);
			expect(db.lookup('pop')?.internal).toEqual([]); // internals excluded from latest
			expect(db.has('rare')).toBe(false);             // pruned by topN
		});

		test('all scope: exported + internal + deprecated survive a round-trip', () => {
			const b = new PkgDbBuilder();
			b.addPackage('p', { latest: '1.0' });
			b.addVersion('p', '1.0', ex(['f'], ['helper'], ['f'], false));
			const db = PkgDatabase.fromObject(b.build('all', bmeta));
			const info = db.lookup('p', '1.0');
			expect(info?.exported).toEqual(['f']);
			expect(info?.internal).toEqual(['helper']);
			expect(info?.deprecated).toEqual(['f']);
			expect(info?.cran).toBe(false);
		});
	});

	describe('schema validation', () => {
		test('rejects a non-pkgdb object with a descriptive error', () => {
			expect(() => PkgDatabase.fromObject({ hello: 'world' })).toThrow(/format/);
		});
		test('rejects an unsupported schema version', () => {
			expect(() => validatePkgDb({ ...latestDb, schema: 99 })).toThrow(/schema version 99/);
		});
		test('rejects an all-scope database without a lists pool', () => {
			expect(() => validatePkgDb({ ...header, scope: 'all', strings: [], pkgs: {} })).toThrow(/lists/);
		});
	});
});
