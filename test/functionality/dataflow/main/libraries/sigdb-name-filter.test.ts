import { afterAll, assert, describe, test } from 'vitest';
import { SigDbBuilder } from '../../../../../src/project/sigdb/build';
import { FnProp } from '../../../../../src/project/sigdb/schema';
import { cleanupSigTmpDirs, sigTmpDir, writeAndOpen, ver } from '../../../_helper/sigdb';

afterAll(cleanupSigTmpDirs);

const meta = { date: '2026-05-23', generated: 0 };

/**
 * `functionByName` skips a package whose name set cannot hold the wanted name, which is only filled once that
 * package's blob has been read. So the very first lookup of a package answers unfiltered and every later one
 * answers filtered: asking twice and comparing is what pins that the filter changes no answer.
 */
function database() {
	const b = new SigDbBuilder();
	b.addPackage('alpha', { latest: '2.0.0', downloads: 10 });
	// `gone` exists only in the old version, `added` only in the new one, `both` in each
	b.addVersion('alpha', '1.0.0', ver([
		{ name: 'both', props: FnProp.Exported, params: [], callees: [], file: 'R/a.R', line: 1 },
		{ name: 'gone', props: FnProp.Exported, params: [], callees: [], file: 'R/a.R', line: 2 }
	]));
	b.addVersion('alpha', '2.0.0', ver([
		{ name: 'both', props: FnProp.Exported, params: [], callees: [], file: 'R/a.R', line: 1 },
		{ name: 'added', props: FnProp.Exported, params: [], callees: [], file: 'R/a.R', line: 3 }
	]));
	b.addPackage('beta', { latest: '1.0.0', downloads: 5 });
	b.addVersion('beta', '1.0.0', ver([
		// shares a name with alpha, and has one only it holds
		{ name: 'both', props: FnProp.Exported, params: [], callees: [], file: 'R/b.R', line: 1 },
		{ name: 'onlyBeta', props: 0, params: [], callees: [], file: 'R/b.R', line: 2 }
	]));
	return b.build(meta);
}

/** every question worth asking of this database, as `pkg|name|version` keys */
const questions: readonly [string, string, string | undefined][] = [
	['alpha', 'both', undefined], ['alpha', 'both', '1.0.0'], ['alpha', 'both', '2.0.0'],
	['alpha', 'gone', undefined], ['alpha', 'gone', '1.0.0'], ['alpha', 'gone', '2.0.0'],
	['alpha', 'added', undefined], ['alpha', 'added', '1.0.0'], ['alpha', 'added', '2.0.0'],
	['alpha', 'onlyBeta', undefined], ['alpha', 'nowhere', undefined],
	['beta', 'both', undefined], ['beta', 'onlyBeta', undefined],
	['beta', 'gone', undefined], ['beta', 'added', undefined], ['beta', 'nowhere', undefined],
	['gamma', 'both', undefined]
];

describe('sigdb name filter', () => {
	test('the filter changes no answer, whether or not it is populated', async() => {
		const db = await writeAndOpen(sigTmpDir('sigdb-filter-'), database());
		const ask = () => questions.map(([pkg, name, version]) =>
			`${pkg}|${name}|${version ?? '-'}=${JSON.stringify(db.functionByName(pkg, name, version)?.name ?? null)}`);
		const unfiltered = ask();
		// every package has been read by now, so the filter is in place for the second round
		assert.deepStrictEqual(ask(), unfiltered, 'the populated filter has to answer exactly as the cold reader did');
		assert.deepStrictEqual(ask(), unfiltered);
		db.close();
	});

	test('it finds what the database holds, at every version', async() => {
		const db = await writeAndOpen(sigTmpDir('sigdb-filter-hit-'), database());
		for(let round = 0; round < 2; round++) {
			// a version-less lookup answers from the latest version, so `gone` is only found by asking for 1.0.0
			assert.strictEqual(db.functionByName('alpha', 'both')?.name, 'both', `round ${round}`);
			assert.strictEqual(db.functionByName('alpha', 'added')?.name, 'added', `round ${round}`);
			assert.strictEqual(db.functionByName('alpha', 'gone', '1.0.0')?.name, 'gone', `round ${round}`);
			assert.strictEqual(db.functionByName('beta', 'onlyBeta')?.name, 'onlyBeta', `round ${round}`);
			// a name another package holds is not this package's
			assert.isUndefined(db.functionByName('beta', 'added'), `round ${round}`);
			assert.isUndefined(db.functionByName('alpha', 'onlyBeta'), `round ${round}`);
			// and a name the dictionary does not know at all is nobody's
			assert.isUndefined(db.functionByName('alpha', 'nowhere'), `round ${round}`);
			assert.isUndefined(db.functionByName('gamma', 'both'), `round ${round}`);
		}
		db.close();
	});
});
