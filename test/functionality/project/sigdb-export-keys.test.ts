import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { label } from '../_helper/label';
import { exportKeysFor } from '../../../src/project/sigdb/export-keys';

describe('Export keys of a bundle', () => {
	const pairs = [[7, 2], [3, 0], [7, 0], [3, 0], [100000, 5]] as const;

	test(label('are answered without a file', ['name-normal'], ['other']), () => {
		const keys = exportKeysFor(undefined, 6, () => pairs);
		assert.deepStrictEqual(keys.ordinalsOf(7), [0, 2]);
		assert.deepStrictEqual(keys.ordinalsOf(3), [0]);
		assert.deepStrictEqual(keys.ordinalsOf(100000), [5]);
		assert.deepStrictEqual(keys.ordinalsOf(4), []);
		assert.deepStrictEqual(keys.ordinalsOf(200000), []);
	});

	test(label('persist for the next reader and are derived anew for another bundle', ['name-normal'], ['other']), () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-export-keys-'));
		try {
			const bundle = path.join(dir, 'bundle.sigs.ndjson');
			fs.writeFileSync(bundle, '');
			exportKeysFor(bundle, 6, () => pairs);
			assert.isTrue(fs.existsSync(`${bundle}.exports`));
			const reread = exportKeysFor(bundle, 6, () => {
				throw new Error('must be read, not derived');
			});
			assert.deepStrictEqual(reread.ordinalsOf(7), [0, 2]);
			assert.deepStrictEqual(reread.ordinalsOf(8), []);
			const other = exportKeysFor(bundle, 7, () => [[8, 1]]);
			assert.deepStrictEqual(other.ordinalsOf(8), [1]);
			assert.deepStrictEqual(other.ordinalsOf(7), []);
			const later = new Date(Date.now() + 60_000);
			fs.utimesSync(bundle, later, later);
			const rebuilt = exportKeysFor(bundle, 7, () => [[9, 3]]);
			assert.deepStrictEqual(rebuilt.ordinalsOf(9), [3]);
			assert.deepStrictEqual(rebuilt.ordinalsOf(8), []);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
