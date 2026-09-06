import { afterAll, describe, expect, test } from 'vitest';
import { SigDbBuilder } from '../../../../../src/project/sigdb/build';
import type { SigClassInfo } from '../../../../../src/project/sigdb/schema';
import { cleanupSigTmpDirs, sigTmpDir, writeAndOpen, ver } from '../../../_helper/sigdb';

afterAll(cleanupSigTmpDirs);

const meta = { date: '2026-05-23', generated: 0 };

const Classes: SigClassInfo[] = [
	{ name: 'Account', system: 's4', supers: ['Base'], slots: [{ name: 'balance', type: 'numeric' }, { name: 'owner' }] },
	{ name: 'Abstract', system: 's4', supers: [], slots: [], virtual: true },
	{ name: 'NumOrChar', system: 's4', supers: ['numeric', 'character'], slots: [], virtual: true, union: true },
	{ name: 'Base', system: 's4', supers: [], slots: [], package: 'otherpkg' },
	{ name: 'Person', system: 'r6', supers: [], slots: [{ name: 'name' }] }
];

/** builds package `p` with one version per entry in `versionNums`, optionally carrying {@link Classes} and feature overrides */
function buildVersions(latest: string, versionNums: readonly string[], opts?: { classes?: SigClassInfo[]; features?: Record<string, boolean> }) {
	const b = new SigDbBuilder();
	b.addPackage('p', { latest });
	for(const v of versionNums) {
		b.addVersion('p', v, opts?.classes ? { ...ver([]), classes: opts.classes } : ver([]));
	}
	return b.build(opts?.features ? { ...meta, features: opts.features } : meta);
}

/** writes {@link Classes} for package `p` and opens the resulting bundle */
async function openWithClasses(suffix: string) {
	return writeAndOpen(sigTmpDir(`sigdb-classes-${suffix}-`), buildVersions('1.0', ['1.0'], { classes: Classes }));
}

describe('Class relations in the signature database', () => {
	test('a version\'s classes round-trip through a written bundle', async() => {
		const rd = await openWithClasses('roundtrip');
		const read = rd.classes('p') as SigClassInfo[];
		/* stored sorted by name, so compare against the same order */
		expect(read).toEqual([...Classes].sort((a, c) => a.name.localeCompare(c.name)));
		rd.close();
	});

	test('a class the package does not define names the one that does', async() => {
		const rd = await openWithClasses('foreign');
		const read = rd.classes('p') as SigClassInfo[];
		expect(read.find(c => c.name === 'Base')?.package).toBe('otherpkg');
		expect(read.find(c => c.name === 'Account')?.package).toBeUndefined();
		rd.close();
	});

	test('the class records pool across versions that state the same thing, and turning the feature off stores none', () => {
		const pooledDb = buildVersions('2.0', ['1.0', '2.0'], { classes: Classes });
		expect(pooledDb.blobs[pooledDb.pkgs['p']].classes).toHaveLength(Classes.length);

		const offDb = buildVersions('1.0', ['1.0'], { classes: Classes, features: { classes: false } });
		expect(offDb.blobs[offDb.pkgs['p']].classes).toBeUndefined();
		expect(offDb.content.features?.classes).toBe(false);
	});

	test('a bundle that states no classes answers with none', async() => {
		const rd = await writeAndOpen(sigTmpDir('sigdb-classes-none-'), buildVersions('1.0', ['1.0']));
		expect(rd.classes('p')).toEqual([]);
		expect(rd.classes('nosuchpackage')).toBeUndefined();
		rd.close();
	});
});

describe('sigdb class string indices survive the frequency-sort remap', () => {
	test('a rare class name/super/slot decodes correctly even when the dictionary is heavily reordered', async() => {
		const b = new SigDbBuilder();
		/* the classes are interned first, so their strings hold low indices the frequency sort has to move ... */
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', { ...ver([]), classes: Classes });
		/* ... and a second package full of hot names is what pushes them, since those belong at the front */
		const hot = Array.from({ length: 50 }, (_, i) => ({ name: `hot${i}`, props: 1, params: [], callees: ['common', 'c', 'paste', 'list'], line: i }));
		b.addPackage('q', { latest: '1.0' });
		b.addVersion('q', '1.0', ver(hot));
		const rd = await writeAndOpen(sigTmpDir('sigdb-classes-remap-'), b.build({ ...meta }));
		const read = rd.classes('p') as SigClassInfo[];
		expect(read.map(c => c.name).sort()).toEqual(Classes.map(c => c.name).sort());
		expect(read.find(c => c.name === 'Account')?.supers).toEqual(['Base']);
		expect(read.find(c => c.name === 'Account')?.slots)
			.toEqual([{ name: 'balance', type: 'numeric' }, { name: 'owner' }]);
		expect(read.find(c => c.name === 'NumOrChar')?.supers).toEqual(['numeric', 'character']);
		expect(read.find(c => c.name === 'Base')?.package).toBe('otherpkg');
		rd.close();
	});
});
