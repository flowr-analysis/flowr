/**
 * The on-disk compression codec for sigdb bundles. Brotli (`.br`) is always written as a universal fallback
 * (every Node ships it), and zstd (`.zst`, smaller + faster to decompress) is written additionally whenever the
 * running Node exposes it (`node:zlib` zstd, Node 22.15+ / 23.8+). Readers pick the better available variant at
 * runtime -- `.zst` when this Node can decompress it, else the `.br` fallback -- so bundles read on any Node,
 * including the older Node bundled in the VS Code extension host. Only the outer compression changes -- the
 * ranged reads and `.idx` seek logic operate on the decompressed plain NDJSON and are codec-agnostic.
 */
import zlib from 'node:zlib';
import type { Transform } from 'node:stream';

// Node >= 22.15 / 23.8 ships zstd in `node:zlib`, but the installed @types/node (22.13) does not declare it yet.
// Narrowly type just the members we use here instead of weakening the whole `zlib` import.
interface ZstdOptions { readonly params?: Readonly<Record<number, number>> }
interface ZstdZlib {
	zstdCompressSync(buf: Buffer | string, options?: ZstdOptions): Buffer;
	zstdDecompressSync(buf: Buffer, options?: ZstdOptions): Buffer;
	createZstdCompress(options?: ZstdOptions): Transform;
	createZstdDecompress(options?: ZstdOptions): Transform;
	readonly constants: { readonly ZSTD_c_compressionLevel: number };
}
const zstd = zlib as unknown as ZstdZlib;

/** whether the running Node exposes the `node:zlib` zstd API (Node 22.15+ / 23.8+) */
export function zstdSupported(): boolean {
	return typeof zstd.zstdCompressSync === 'function' && typeof zstd.createZstdDecompress === 'function';
}

function requireZstd(): ZstdZlib {
	if(!zstdSupported()) {
		throw new Error('zstd sigdb bundles need Node >= 22.15 (node:zlib zstd support); upgrade Node or use the brotli codec');
	}
	return zstd;
}

/** on-disk compression codec for a sigdb bundle */
export type SigDbCodec = 'brotli' | 'zstd';

/** the richer codec, preferred by readers when this Node supports it (writers always additionally emit `.br`) */
export const DefaultSigDbCodec: SigDbCodec = 'zstd';

/** compressed extensions a reader understands (outer compression only); `.gz` is read-only legacy */
export const CompressedExts = ['.br', '.zst', '.gz'] as const;

/** whether a bundle path is a compressed source that must be decompressed to be seekable */
export function isCompressedExt(file: string): boolean {
	return CompressedExts.some(e => file.endsWith(e));
}

/** the compressed extension of a path, or `undefined` if it is a plain (uncompressed) source */
export function compressedExtOf(file: string): string | undefined {
	return CompressedExts.find(e => file.endsWith(e));
}

/** strip a trailing compressed extension (`.br`/`.zst`/`.gz`) from a filename, if present */
export function stripCompressedExt(name: string): string {
	const ext = compressedExtOf(name);
	return ext ? name.slice(0, -ext.length) : name;
}

/** regex alternation matching an optional trailing compressed extension, e.g. `(?:\.br|\.zst|\.gz)?` */
export const CompressedExtPattern = `(?:${CompressedExts.map(e => e.replace(/\./g, '\\.')).join('|')})?`;

/** options shared by the (de)compression codecs; unused knobs are ignored by a codec that lacks them */
export interface CodecCompressOptions {
	/** compression level -- brotli quality (0..11), zstd level (1..22) */
	level?:    number;
	/** brotli window bits (10..30); above 24 enables large-window mode. Ignored by zstd */
	lgwin?:    number;
	/** uncompressed size hint for the compressor */
	sizeHint?: number;
}

/** a compression codec: its file extension plus sync + streaming (de)compression */
export interface SigDbCodecSpec {
	readonly codec: SigDbCodec;
	readonly ext:   string;
	compressSync(buf: Buffer | string, opts?: CodecCompressOptions): Buffer;
	createCompress(opts?: CodecCompressOptions): Transform;
}

// reading large-window brotli requires opting in; every `.br` flowR writes uses large windows, so this is always safe
const BrotliDecodeParams = { params: { [zlib.constants.BROTLI_DECODER_PARAM_LARGE_WINDOW]: 1 } };

function brotliParams(opts: CodecCompressOptions): Record<number, number> {
	const lgwin = opts.lgwin ?? 30;
	const params: Record<number, number> = {
		[zlib.constants.BROTLI_PARAM_QUALITY]:      opts.level ?? 11,
		[zlib.constants.BROTLI_PARAM_LGWIN]:        lgwin,
		[zlib.constants.BROTLI_PARAM_LARGE_WINDOW]: lgwin > 24 ? 1 : 0
	};
	if(opts.sizeHint !== undefined) {
		params[zlib.constants.BROTLI_PARAM_SIZE_HINT] = opts.sizeHint;
	}
	return params;
}

function zstdParams(opts: CodecCompressOptions): Record<number, number> {
	return { [zstd.constants.ZSTD_c_compressionLevel]: opts.level ?? 19 };
}

export const BrotliCodec: SigDbCodecSpec = {
	codec:          'brotli',
	ext:            '.br',
	compressSync:   (buf, opts = {}) => zlib.brotliCompressSync(buf, { params: brotliParams(opts) }),
	createCompress: (opts = {}) => zlib.createBrotliCompress({ params: brotliParams(opts) })
};

export const ZstdCodec: SigDbCodecSpec = {
	codec:          'zstd',
	ext:            '.zst',
	compressSync:   (buf, opts = {}) => requireZstd().zstdCompressSync(buf, { params: zstdParams(opts) }),
	createCompress: (opts = {}) => requireZstd().createZstdCompress({ params: zstdParams(opts) })
};

/** the codec spec for a codec name (used when writing) */
export function codecFor(codec: SigDbCodec): SigDbCodecSpec {
	return codec === 'zstd' ? ZstdCodec : BrotliCodec;
}

/**
 * The codec specs a writer emits: brotli `.br` always (the universal fallback -- every Node ships it), plus
 * zstd `.zst` when this Node can produce/read it. So a `.br` fallback is guaranteed next to every `.zst`.
 */
export function writeCodecs(): readonly SigDbCodecSpec[] {
	return zstdSupported() ? [BrotliCodec, ZstdCodec] : [BrotliCodec];
}

/**
 * Compressed extensions this runtime can actually decompress, most-preferred first (zstd before brotli when
 * supported). `.zst` is omitted entirely when this Node lacks zstd, so a reader never picks a variant it cannot read.
 */
export function readableExtsPreferred(): readonly string[] {
	return zstdSupported() ? ['.zst', '.br', '.gz'] : ['.br', '.gz'];
}

/** a streaming decompressor for a compressed source, chosen by its extension (`.zst`/`.gz`/`.br`) */
export function createDecompressFor(file: string): Transform {
	if(file.endsWith('.zst')) {
		return requireZstd().createZstdDecompress();
	}
	if(file.endsWith('.gz')) {
		return zlib.createGunzip();
	}
	return zlib.createBrotliDecompress(BrotliDecodeParams);
}

/** synchronously decompress a compressed buffer, choosing the codec by the source's extension */
export function decompressSyncFor(file: string, raw: Buffer): Buffer {
	if(file.endsWith('.zst')) {
		return requireZstd().zstdDecompressSync(raw);
	}
	if(file.endsWith('.gz')) {
		return zlib.gunzipSync(raw);
	}
	return zlib.brotliDecompressSync(raw, BrotliDecodeParams);
}
