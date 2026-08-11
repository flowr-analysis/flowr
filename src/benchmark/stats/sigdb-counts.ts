/**
 * Counts what the signature database mounted on the benchmarking machine carries, so a release also shows
 * how the database grew. Everything is read from the manifests and the bundle headers, i.e. without unpacking
 * a bundle, the one exception being the small base-R bundle whose entries are walked for {@link SigDbBaseCounts}.
 * @module
 */
import fs from 'fs';
import path from 'path';
import { defaultSigDbPaths, readManifestFile, type SigDbManifest, type SigDbShardRef } from '../../project/sigdb/manifest';
import { readHeaderOf, resolveSource } from '../../project/sigdb/decompress';
import { decodeIndex } from '../../project/sigdb/index-format';
import { SigDatabase } from '../../project/sigdb/reader';
import { FnPropNames, type SigDbContent } from '../../project/sigdb/schema';
import type { SigDbBaseCounts, SigDbCounts } from './stats';

/** what a temporal tier of a bundle keeps, in the words the wiki uses for it */
const KindOfTier: Record<string, string> = {
	current: 'latest only',
	full:    'full history',
	history: 'older only'
};

const ManifestFile = /\.manifest\.json(\.(br|zst|gz))?$/;

/** one distinct shard of the database, paired with the manifest it was taken from */
interface Bundle {
	readonly id:       string;
	readonly ref:      SigDbShardRef;
	readonly file:     string;
	readonly manifest: SigDbManifest | undefined;
}

function sizeOf(file: string): number {
	try {
		return fs.statSync(file).size;
	} catch{
		return 0;
	}
}

async function contentOf(file: string): Promise<SigDbContent | undefined> {
	try {
		return (await readHeaderOf(file))?.content as SigDbContent | undefined;
	} catch{
		return undefined;
	}
}

/** the kind a shard belongs to, falling back to its tier so an unknown tier still gets a counter of its own */
function kindOf(tier: string | undefined): string {
	const name = String(tier ?? 'unknown');
	return KindOfTier[name] ?? name;
}

function add(into: Record<string, number>, key: string, value: number): void {
	into[key] = (into[key] ?? 0) + value;
}

/**
 * Every distinct shard of every discovered bundle, plus the dictionaries and manifests they need. A shard id a
 * later manifest ships again is skipped (the two copies hold the same packages), and with it that manifest's
 * dictionary, so nothing is counted twice.
 */
function collectBundles(paths: readonly string[]): { bundles: Bundle[], dictionaries: number, manifests: number } {
	const bundles: Bundle[] = [];
	const seen = new Set<string>();
	let dictionaries = 0;
	let manifests = 0;
	for(const p of paths) {
		if(!ManifestFile.test(p)) {
			// a standalone bundle, which is a database of one shard without a manifest around it
			const id = path.basename(p);
			if(!seen.has(id)) {
				seen.add(id);
				bundles.push({ id, ref: { id, tier: 'full', path: p, hash: '', packages: 0, versions: 0 }, file: p, manifest: undefined });
			}
			continue;
		}
		let manifest: SigDbManifest;
		try {
			manifest = readManifestFile(p);
		} catch(e) {
			console.log(`  skipping signature database manifest ${p}: ${(e as Error).message}`);
			continue;
		}
		const baseDir = path.dirname(p);
		const own = (manifest.shards ?? []).filter(s => s?.id !== undefined && !seen.has(s.id));
		if(own.length === 0) {
			continue;
		}
		for(const ref of own) {
			seen.add(ref.id);
			bundles.push({ id: ref.id, ref, file: resolveSource(baseDir, ref.path), manifest });
		}
		manifests += sizeOf(p);
		for(const dict of manifest.dicts ?? []) {
			dictionaries += sizeOf(resolveSource(baseDir, dict.path));
		}
	}
	return { bundles, dictionaries, manifests };
}

/** every package name the bundles route, so the same package in several bundles is only counted once */
function countPackages(bundles: readonly Bundle[]): number {
	const names = new Set<string>();
	for(const { ref, manifest } of bundles) {
		for(const name of Object.keys(ref.idx?.p ?? {})) {
			names.add(name);
		}
		for(const name of Object.keys(manifest?.meta ?? {})) {
			names.add(name);
		}
	}
	return names.size > 0 ? names.size : Math.max(0, ...bundles.map(b => b.ref.packages ?? 0));
}

/**
 * Walk the base-R bundle of the newest R release and count what its function records carry. It is a few
 * hundred KiB unpacked, so this stays in the milliseconds; only the numeric tuples are read, no string
 * dictionary is needed for them.
 */
async function countBaseEntries(bundles: readonly Bundle[]): Promise<SigDbBaseCounts | undefined> {
	const base = bundles.find(b => b.ref.tier === 'current' && b.id.startsWith('base'));
	if(base === undefined) {
		return undefined;
	}
	let db: SigDatabase | undefined;
	try {
		db = await SigDatabase.open(base.file, {
			hash:  base.ref.hash,
			index: base.ref.idx ? decodeIndex(base.ref.idx, base.manifest?.meta) : undefined
		});
		const carrying: Record<string, number> = {
			'with parameters':        0,
			'with a call graph':      0,
			'with a source location': 0,
			'with a help topic':      0
		};
		for(const name of Object.values(FnPropNames)) {
			carrying[name] = 0;
		}
		let functions = 0;
		let parameters = 0;
		for(const blob of db.allBlobs()) {
			for(const fn of blob.fns ?? []) {
				functions++;
				const [, sigIdx, cgIdx, props, fileIdx] = fn;
				if(sigIdx >= 0) {
					carrying['with parameters']++;
					parameters += blob.sigs[sigIdx]?.length ?? 0;
				}
				if(cgIdx >= 0) {
					carrying['with a call graph']++;
				}
				if(fileIdx >= 0) {
					carrying['with a source location']++;
				}
				if(fn.length > 6) {
					carrying['with a help topic']++;
				}
				for(const [bit, name] of Object.entries(FnPropNames)) {
					if((props & Number(bit)) !== 0) {
						carrying[name]++;
					}
				}
			}
		}
		return { functions, parameters, functionsCarrying: carrying };
	} catch(e) {
		console.log(`  skipping the signature database entry breakdown: ${(e as Error).message}`);
		return undefined;
	} finally {
		db?.close();
	}
}

/**
 * Counts the bundles of the mounted signature database, what they describe, and what they occupy.
 * Every step is defensive, as this also runs against older databases when the history is filled in, and a
 * machine without a mounted database simply yields `undefined` instead of failing the benchmark.
 */
export async function countSignatureDatabase(): Promise<SigDbCounts | undefined> {
	let paths: readonly string[];
	try {
		paths = defaultSigDbPaths();
	} catch(e) {
		console.log(`  no signature database counted: ${(e as Error).message}`);
		return undefined;
	}
	const { bundles, dictionaries, manifests } = collectBundles(paths);
	if(bundles.length === 0) {
		console.log('  no signature database is mounted, its counters are left out');
		return undefined;
	}

	const bundlesByKind: Record<string, number> = {};
	const functionsByKind: Record<string, number> = {};
	const sizeByKind: Record<string, number> = {};
	let packageVersions = 0;
	let functions = 0;
	let size = dictionaries + manifests;
	for(const bundle of bundles) {
		const content = await contentOf(bundle.file);
		const kind = kindOf(content?.tier ?? bundle.ref.tier);
		const bytes = sizeOf(bundle.file);
		add(bundlesByKind, kind, 1);
		add(functionsByKind, kind, content?.functions ?? 0);
		add(sizeByKind, kind, bytes);
		packageVersions += content?.versions ?? bundle.ref.versions ?? 0;
		functions += content?.functions ?? 0;
		size += bytes;
	}

	return {
		bundles:            bundles.length,
		bundlesByKind,
		packages:           countPackages(bundles),
		packageVersions,
		functions,
		functionsByKind,
		sizeByKind,
		sizeOfDictionaries: dictionaries,
		sizeOfManifests:    manifests,
		size,
		base:               await countBaseEntries(bundles)
	};
}
