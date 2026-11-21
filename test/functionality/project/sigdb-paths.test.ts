import { assert, describe, test, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
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

	test('bundles in the working directory (the analyzed project) are never mounted', () => {
		const project = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-sigdb-cwd-'));
		const nested = path.join(project, 'R');
		fs.mkdirSync(path.join(project, 'data', 'sigdb'), { recursive: true });
		fs.mkdirSync(nested);
		fs.writeFileSync(path.join(project, 'data', 'sigdb', 'full.manifest.json'), '{}');
		fs.writeFileSync(path.join(project, 'planted.sigs.ndjson'), '{}');
		const cwd = vi.spyOn(process, 'cwd').mockReturnValue(nested);
		try {
			assert.notInclude(String(defaultSigDbPath('full')), project);
			assert.isTrue(defaultSigDbPaths().every(p => !p.startsWith(project)));
		} finally {
			cwd.mockRestore();
			fs.rmSync(project, { recursive: true, force: true });
		}
	});
});
