/**
 * On-disk (de)compression + the hash-keyed decompress cache: turn a `.br`/`.zst`/`.gz` bundle into a seekable
 * plain `.sigs.ndjson` (materialized once, reused on later startups), read a bundle's header cheaply, and resolve
 * the cache directory. Split out of `../sigdb` so the reader there only consumes plain, seekable files. The codec
 * is detected by extension (see `./codec`), so existing `.br` and new `.zst` bundles read transparently.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { SigDbExt, type SigDbContent } from './schema';
import { encodeIndex, type SigDbIndex } from './index-format';
import { Hash53 } from '../../util/hash';
import { createDecompressFor, decompressSyncFor, isCompressedExt, readableExtsPreferred } from './codec';

/** whether a bundle path is a compressed (`.br`/`.zst`/`.gz`) source that must be decompressed to be seekable */
export const isCompressed = (f: string): boolean => isCompressedExt(f);

/** read and parse the header (line 1) from a buffer/string of NDJSON */
export function parseHeader(text: string): Record<string, unknown> | undefined {
	const nl = text.indexOf('\n');
	try {
		return JSON.parse(nl >= 0 ? text.slice(0, nl) : text) as Record<string, unknown>;
	} catch{
		return undefined;
	}
}

function decompressStream(file: string): Readable {
	return fs.createReadStream(file).pipe(createDecompressFor(file));
}

/** a readable stream of the bundle's plain NDJSON, transparently decompressing `.gz`/`.br`/`.zst` inputs */
export function sigDbStream(file: string): Readable {
	return isCompressed(file) ? decompressStream(file) : fs.createReadStream(file);
}

/**
 * Resolve a manifest-relative file to the best source this runtime can read: a plain (already seekable) file
 * if present, else the most-preferred compressed variant that exists AND is decompressible here -- `.zst` first
 * when this Node supports zstd, otherwise `.br` (then `.gz`). A `.zst` is never returned on a Node without zstd
 * (it could not be decompressed), so `.br`-only bundles read on any Node. Falls back to the plain path.
 */
export function resolveSource(baseDir: string, relPath: string): string {
	const plain = path.resolve(baseDir, relPath);
	if(fs.existsSync(plain)) {
		return plain;
	}
	for(const ext of readableExtsPreferred()) {
		const compressed = `${plain}${ext}`;
		if(fs.existsSync(compressed)) {
			return compressed;
		}
	}
	return plain;
}

/**
 * Directory for decompressed, hash-keyed caches. Honours `$FLOWR_SIGDB_CACHE` / `$FLOWR_CACHE_DIR`, then the
 * platform cache home (`$XDG_CACHE_HOME` on Linux, `%LOCALAPPDATA%` on Windows), then `~/.cache/flowr`, falling
 * back to the OS temp dir (so it works in a read-only Docker image where only `/tmp` is writable -- mount a
 * volume at the cache dir to persist it).
 */
export function sigDbCacheDir(override?: string): string {
	const base = override
		?? process.env.FLOWR_SIGDB_CACHE ?? process.env.FLOWR_CACHE_DIR
		?? (process.env.XDG_CACHE_HOME ? path.join(process.env.XDG_CACHE_HOME, 'flowr') : undefined)
		?? (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'flowr', 'cache') : undefined)
		?? path.join(os.homedir?.() || os.tmpdir(), '.cache', 'flowr');
	const dir = path.join(base, 'sigdb');
	try {
		fs.mkdirSync(dir, { recursive: true });
		return dir;
	} catch{
		const tmp = path.join(os.tmpdir(), 'flowr-sigdb-cache');
		fs.mkdirSync(tmp, { recursive: true });
		return tmp;
	}
}

/** read the (small) header line of a possibly-compressed bundle without decompressing the whole thing */
export async function readHeaderOf(source: string): Promise<Record<string, unknown> | undefined> {
	if(!isCompressed(source)) {
		const fd = fs.openSync(source, 'r');
		try {
			const buf = Buffer.allocUnsafe(65536);
			const n = fs.readSync(fd, buf, 0, buf.length, 0);
			return parseHeader(buf.toString('utf8', 0, n));
		} finally {
			fs.closeSync(fd);
		}
	}
	const input = decompressStream(source);
	const rl = readline.createInterface({ input, crlfDelay: Infinity });
	try {
		const line = (await rl[Symbol.asyncIterator]().next()).value as string | undefined;   // just the first line (the header)
		return line !== undefined ? JSON.parse(line) as Record<string, unknown> : undefined;
	} finally {
		rl.close();
		input.destroy();
	}
}

/** where an index for a decompressed source comes from -- a caller-supplied one (e.g. a manifest) or the sibling `.idx` */
export interface EnsureOptions {
	cacheDir?:  string;
	hash?:      string;
	index?:     SigDbIndex;
	/** the source is not a seekable bundle (e.g. a shared dictionary file) -- decompress only, write no `.idx` */
	indexless?: boolean;
}

/** the cache paths for a source given its content hash */
interface CachePaths { plain: string; idx: string }
function cachePaths(hash: string, cacheDir?: string): CachePaths {
	const plain = path.join(sigDbCacheDir(cacheDir), `sigdb-${hash}${SigDbExt}`);
	return { plain, idx: `${plain}.idx` };
}

/** materialize the `.idx` for a freshly decompressed cache file -- from the supplied index or the source's sibling */
function writeCacheIndex(source: string, idx: string, index?: SigDbIndex): void {
	if(index) {
		fs.writeFileSync(idx, JSON.stringify(encodeIndex(index)));
		return;
	}
	const srcIdx = source.replace(/\.(br|zst|gz)$/, '') + '.idx';
	if(!fs.existsSync(srcIdx)) {
		throw new Error(`missing sidecar index next to ${source} (expected ${srcIdx}), and none was supplied`);
	}
	fs.copyFileSync(srcIdx, idx);
}

/**
 * Ensure a seekable plain `.sigs.ndjson` (+ its `.idx`) exists for `source`, decompressing a `.br`/`.zst`/`.gz`
 * once into a hash-keyed cache the first time and reusing it on every later startup. The index may be
 * supplied by the caller (e.g. embedded in a manifest) so no separate `.idx` file needs to ship.
 */
export async function ensurePlain(source: string, opts: EnsureOptions = {}): Promise<string> {
	if(!isCompressed(source)) {
		return source;
	}
	let hash = opts.hash;
	if(hash === undefined) {
		const content = (await readHeaderOf(source))?.content as SigDbContent | undefined;
		hash = content?.hash ?? new Hash53().update(source).digest();
	}
	const { plain, idx } = cachePaths(hash, opts.cacheDir);
	if(fs.existsSync(plain) && (opts.indexless || fs.existsSync(idx))) {
		return plain;
	}
	const tmp = `${plain}.${process.pid}.tmp`;
	await pipeline(decompressStream(source), fs.createWriteStream(tmp));
	fs.renameSync(tmp, plain);
	if(!opts.indexless) {
		writeCacheIndex(source, idx, opts.index);
	}
	return plain;
}

/** synchronous {@link ensurePlain} (blocking decompression) -- a `hash` must be supplied to key the cache */
export interface EnsurePlainSyncOptions extends EnsureOptions { hash: string }
/** synchronous {@link ensurePlain} (blocking decompression); the supplied `hash` keys the decompress cache */
export function ensurePlainSync(source: string, opts: EnsurePlainSyncOptions): string {
	if(!isCompressed(source)) {
		return source;
	}
	const { plain, idx } = cachePaths(opts.hash, opts.cacheDir);
	if(fs.existsSync(plain) && (opts.indexless || fs.existsSync(idx))) {
		return plain;
	}
	const raw = fs.readFileSync(source);
	const out = decompressSyncFor(source, raw);
	const tmp = `${plain}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, out);
	fs.renameSync(tmp, plain);
	if(!opts.indexless) {
		writeCacheIndex(source, idx, opts.index);
	}
	return plain;
}
