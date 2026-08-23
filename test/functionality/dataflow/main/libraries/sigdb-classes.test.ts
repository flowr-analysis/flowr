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

describe('Class relations in the signature database', () => {
	test('a version\'s classes round-trip through a written bundle', async() => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', { ...ver([]), classes: Classes });
		const rd = await writeAndOpen(sigTmpDir('sigdb-classes-'), b.build(meta));
		const read = rd.classes('p') as SigClassInfo[];
		/* stored sorted by name, so compare against the same order */
		expect(read).toEqual([...Classes].sort((a, c) => a.name.localeCompare(c.name)));
		rd.close();
	});

	test('a class the package does not define names the one that does', async() => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', { ...ver([]), classes: Classes });
		const rd = await writeAndOpen(sigTmpDir('sigdb-classes-foreign-'), b.build(meta));
		const read = rd.classes('p') as SigClassInfo[];
		expect(read.find(c => c.name === 'Base')?.package).toBe('otherpkg');
		expect(read.find(c => c.name === 'Account')?.package).toBeUndefined();
		rd.close();
	});

	test('the class records pool across versions that state the same thing', () => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '2.0' });
		b.addVersion('p', '1.0', { ...ver([]), classes: Classes });
		b.addVersion('p', '2.0', { ...ver([]), classes: Classes });
		const db = b.build(meta);
		expect(db.blobs[db.pkgs['p']].classes).toHaveLength(Classes.length);
	});

	test('turning the feature off stores no classes at all', () => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', { ...ver([]), classes: Classes });
		const db = b.build({ ...meta, features: { classes: false } });
		expect(db.blobs[db.pkgs['p']].classes).toBeUndefined();
		expect(db.content.features?.classes).toBe(false);
	});

	test('a bundle that states no classes answers with none', async() => {
		const b = new SigDbBuilder();
		b.addPackage('p', { latest: '1.0' });
		b.addVersion('p', '1.0', ver([]));
		const rd = await writeAndOpen(sigTmpDir('sigdb-classes-none-'), b.build(meta));
		expect(rd.classes('p')).toEqual([]);
		expect(rd.classes('nosuchpackage')).toBeUndefined();
		rd.close();
	});
});
