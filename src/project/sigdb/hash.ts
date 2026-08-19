/**
 * Stable content hashes over a bundle's data, used both when writing a bundle (to stamp its header/manifest)
 * and when reading one back (to verify it). A portable {@link Hash53} runs over newline-terminated JSON chunks
 * so chunk boundaries can never collide. Split out of `../sigdb` as it is shared by the writer and the reader.
 */
import { Hash53 } from '../../util/hash';
import type { PkgBlob, SigDb } from './schema';
import { blobTuple } from './decode';

/** the JSON chunks a bundle is hashed over: every dictionary string, every blob tuple, then the pkgs + meta maps */
function* hashChunks(db: Pick<SigDb, 'strings' | 'blobs' | 'pkgs' | 'meta'>): Generator<string> {
	for(const s of db.strings) {
		yield JSON.stringify(s);
	}
	for(const b of db.blobs) {
		yield JSON.stringify(blobTuple(b));
	}
	yield JSON.stringify(db.pkgs);
	yield JSON.stringify(db.meta);
}

/** run a Hash53 over a stream of chunks (each null-terminated so boundaries can't collide) */
export function hashOf(chunks: Iterable<string>): string {
	const h = new Hash53();
	for(const chunk of chunks) {
		h.update(chunk).update('\x00');
	}
	return h.digest();
}

/** the self-contained content hash of a whole bundle (dictionary + blobs + routing/metadata) */
export function contentHash(db: Pick<SigDb, 'strings' | 'blobs' | 'pkgs' | 'meta'>): string {
	return hashOf(hashChunks(db));
}

/** stable hash of a shared dictionary */
export function dictionaryHash(strings: readonly string[]): string {
	return hashOf((function*() {
		for(const s of strings) {
			yield JSON.stringify(s);
		}
	})());
}

/** stable hash of one shard's data (its blobs + pkgs map; the dictionary is hashed separately) */
export function shardHash(blobs: readonly PkgBlob[], pkgs: Record<string, number>): string {
	return hashOf((function*() {
		for(const b of blobs) {
			yield JSON.stringify(blobTuple(b));
		}
		yield JSON.stringify(pkgs);
	})());
}
