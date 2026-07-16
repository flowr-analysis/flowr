/**
 * The sidecar `.idx` index format: the byte ranges a reader seeks to (dictionary + per-package blob) plus the
 * package routing/metadata, and its compact on-disk (wire) form. Split out of `../sigdb` so the reader/writer
 * there does not carry the index encoding.
 */
import fs from 'node:fs';
import type { SigDbPkgMeta } from './schema';

/** a byte range `[startByte, bytes]` in the plain `.ndjson` */
export type ByteRange = [startByte: number, bytes: number];

/**
 * Everything a reader needs to seek into a plain `.ndjson`: the dictionary's byte range, each package
 * blob's byte range, the package to blob-index map, and per-package metadata. (Line numbers and section
 * bookkeeping the writer used are intentionally not kept -- they bloat the index and are never read.)
 */
export interface SigDbIndex {
	/** total byte size of the plain `.ndjson` */
	byteCount: number;
	/** byte range of the string dictionary section */
	dict:      ByteRange;
	/** per package-blob byte range (indexed by blob index) */
	blobs:     ByteRange[];
	/** package name to blob index */
	pkgs:      Record<string, number>;
	/** package name to metadata */
	meta:      Record<string, SigDbPkgMeta>;
}

/** the on-disk (compact) form of a {@link SigDbIndex}: short keys, `meta` optional (hoisted into a manifest) */
export interface SigDbIndexWire { n: number; d: ByteRange; b: ByteRange[]; p: Record<string, number>; m?: Record<string, SigDbPkgMeta> }

/** the on-disk (compact) index of a blob-only shard (no dictionary of its own; it shares a dictionary file) */
export interface SigShardIndexWire { n: number; b: ByteRange[]; p: Record<string, number> }

/** encode an index to its compact on-disk form; omit `meta` when it is hoisted elsewhere (a manifest) */
export function encodeIndex(i: SigDbIndex, withMeta = true): SigDbIndexWire {
	return { n: i.byteCount, d: i.dict, b: i.blobs, p: i.pkgs, ...(withMeta ? { m: i.meta } : {}) };
}
/** decode a compact index; `meta` falls back to a hoisted map, and `dict` to empty (a blob-only shard) */
export function decodeIndex(w: SigDbIndexWire | SigShardIndexWire, meta?: Record<string, SigDbPkgMeta>): SigDbIndex {
	const full = w as SigDbIndexWire;
	return { byteCount: w.n, dict: full.d ?? [0, 0], blobs: w.b, pkgs: w.p, meta: full.m ?? meta ?? {} };
}

/** read a plain bundle's sidecar `.idx` file and decode it */
export function readSigDbIndex(plainFile: string): SigDbIndex {
	return decodeIndex(JSON.parse(fs.readFileSync(`${plainFile}.idx`, 'utf8')) as SigDbIndexWire);
}
