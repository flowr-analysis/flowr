import { bench, describe } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SigDatabase } from '../../../../../src/project/sigdb/reader';
import { SigDbBuilder, writeSignatureDb } from '../../../../../src/project/sigdb/build';
import { SigDbExt, FnProp, type SigVersionInfo } from '../../../../../src/project/sigdb/schema';

/**
 * The runtime cost of "having the signature database loaded" is dominated by two things: opening the bundle
 * once, and then the per-`library()`/`::` lookup during analysis. Full re-analysis cannot be micro-benched
 * (repeatedly rebuilding the tree-sitter engine exhausts its WASM memory), so we bench the database
 * operations directly: an export-view lookup and the richer per-function view. Both are O(1) after the
 * one-time open, and the reverse indices consumers build on top are cached, so the end-to-end overhead a
 * `library()` call adds is a single cached lookup.
 */
const expFn = (name: string): SigVersionInfo['functions'][number] => ({ name, props: FnProp.Exported, params: [{ name: 'x' }], callees: ['c'], line: 1 });
const ver = (functions: SigVersionInfo['functions']): SigVersionInfo => ({ cran: true, functions });

// vitest bench does not support beforeAll, so setup happens in the async describe body (see benchmarkSearch)
describe('sigdb lookup cost', async() => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigdb-bench-'));
	const b = new SigDbBuilder();
	for(let i = 0; i < 500; i++) {
		b.addPackage(`pkg${i}`, { latest: '1.0.0', downloads: i });
		b.addVersion(`pkg${i}`, '1.0.0', ver([expFn(`fn${i}a`), expFn(`fn${i}b`), expFn(`fn${i}c`)]));
	}
	await writeSignatureDb(path.join(dir, 'db'), b.build({ date: '2026-05-23', generated: 0 }));
	const db: SigDatabase = await SigDatabase.open(path.join(dir, `db${SigDbExt}`));

	bench('export-view lookup (what library() resolution consults)', () => {
		db.lookup('pkg250');
	}, { throws: true });

	bench('rich per-function lookup (signatures + call graph)', () => {
		db.functions('pkg250');
	}, { throws: true });
});
