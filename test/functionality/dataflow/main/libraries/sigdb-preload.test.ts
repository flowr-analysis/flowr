import { describe, expect, test } from 'vitest';
import { label } from '../../../_helper/label';
import { SigDatabaseSet } from '../../../../../src/project/sigdb/reader';
import { defaultSigDbPath, defaultSigDbPaths } from '../../../../../src/project/sigdb/manifest';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Exercises the parallel-warm mechanism that `solver.sigdb.warmInBackground` uses: `preloadShards` decompresses
 * a selected subset of shards and `preload` warms everything (including the full-history shards). Runs against
 * the bundled sharded manifest; skipped when a checkout ships no generated database.
 */
describe.sequential('SigDb preload', () => {
	const manifest = defaultSigDbPath();
	const hasBundledSet = manifest !== undefined && /\.manifest\.json(\.br)?$/.test(manifest);

	test.runIf(hasBundledSet)(label('preloadShards warms the hot shards, preload warms the full history', [], ['other']), async() => {
		const db = await SigDatabaseSet.openManifest(manifest as string);
		try {
			// warm only the hot shards (base + most-downloaded), exactly as the background warm does
			await db.preloadShards(s => s.tier === 'current' && s.shard !== 'rest');
			// a base package resolves from the now-warm base shard
			expect((db.functions('stats') ?? []).length).toBeGreaterThan(0);

			// a full warm brings in the history shards, so a base package exposes more than one core version
			await db.preload();
			expect((db.coreVersions('stats') ?? []).length).toBeGreaterThan(1);
		} finally {
			db.close();
		}
	});
});

describe('SigDb bundle auto-discovery (defaultSigDbPaths)', () => {
	test('discovers manifests + standalone bundles, skips a manifest\'s shards/dict, deduped and scope-ordered', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-sigdb-mount-'));
		try {
			for(const f of [
				'current.manifest.json.br', 'full.manifest.json.br', 'custom.manifest.json.br', 'current.manifest.json',
				'standalone.sigs.ndjson.br',                 // a standalone bundle -> mounted
				'current.current-top.sigs.ndjson.br',        // a shard of `current.manifest` -> skipped
				'current.dict.sigs.ndjson.br'                // the shared dictionary -> skipped
			]) {
				fs.writeFileSync(path.join(dir, f), '{}');
			}
			const names = defaultSigDbPaths([dir]).filter(p => p.startsWith(dir)).map(p => path.basename(p));
			// manifests + the standalone bundle are mounted
			expect(names).toContain('custom.manifest.json.br');
			expect(names).toContain('standalone.sigs.ndjson.br');
			// a manifest's own shard and dictionary are NOT mounted separately
			expect(names).not.toContain('current.current-top.sigs.ndjson.br');
			expect(names).not.toContain('current.dict.sigs.ndjson.br');
			// `current` is deduped to one entry despite both `.br` and plain being present
			expect(names.filter(n => n.startsWith('current.manifest'))).toHaveLength(1);
			// richer scopes lead: full before current; standalone bundles come after the manifests
			const idx = (prefix: string) => names.findIndex(n => n.startsWith(prefix));
			expect(idx('full')).toBeLessThan(idx('current'));
			expect(idx('current.manifest')).toBeLessThan(idx('standalone'));
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
