import { assert, describe, test } from 'vitest';
import { defaultSigDbPath, defaultSigDbPaths } from '../../../src/project/sigdb/manifest';
import { readableExtsPreferred, compressedExtOf } from '../../../src/project/sigdb/codec';

describe('sigdb discovery', () => {
	test('both discovery functions agree on the same database', () => {
		const single = defaultSigDbPath('current');
		if(single === undefined) {
			return;   // nothing shipped to compare against
		}
		const fromAll = defaultSigDbPaths().find(p => (p.split(/[\\/]/).pop() ?? '').startsWith('current.manifest.json'));
		assert.strictEqual(fromAll, single, 'defaultSigDbPaths must pick the same file as defaultSigDbPath');
	});

	test('a discovered manifest uses a codec we can actually read', () => {
		for(const p of defaultSigDbPaths()) {
			const ext = compressedExtOf(p);
			if(ext !== undefined) {
				assert.include(readableExtsPreferred(), ext, `${p} uses a codec that cannot be read here`);
			}
		}
	});
});
