import type { FileRole, FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile } from '../../../context/flowr-file';
import fs from 'fs';
import { assertUnreachable } from '../../../../util/assert';
import { RFunTabOffsets } from './r-fun-tab';
import { log } from '../../../../util/log';
import { SecureMode } from '../../../../util/secure-mode';

const rdaLog = log.getSubLogger({ name: 'flowr-rda-file' });

/** This decorates a text file and provides access to its content in the format of an {@link RObjectData}. */
export class FlowrRDAFile extends FlowrFile<RObjectData[]> {
	private readonly wrapped:  FlowrFileProvider;
	private readonly shortcut: boolean;

	/** Prefer {@link FlowrRDAFile.from}, which avoids re-wrapping and handles roles. `shortcut` collects only top-level names/types and skips payloads when `true`. */
	constructor(file: FlowrFileProvider, shortcut: boolean = true) {
		super(file.path(), file.roles);
		this.wrapped = file;
		this.shortcut = shortcut;
	}

	/** See {@link RDAParser.parse}. Answers top-level {@link RObjectData}s, or `[{}]` when the file holds no R objects. */
	protected loadContent(): RObjectData[] {
		return new RDAParser(this.wrapped, this.shortcut).parse() ?? [{}];
	}

	/**
	 * Lifts a file to a {@link FlowrRDAFile}, reusing it if already one and assigning roles.
	 * @param file - The file to lift or return if already an RDA file
	 * @param role - An optional role to assign to the file
	 */
	public static from(file: FlowrFileProvider | FlowrRDAFile, role?: FileRole): FlowrRDAFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRDAFile ? file : new FlowrRDAFile(file);
	}
}

/**
 * Compression algorithm wrapping an RDA file.
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/connections.c#L2673 | R source: comp_type}
 */
export enum CompressionType {
	CompGz           = 'COMP_GZ',
	CompBz           = 'COMP_BZ',
	CompXz           = 'COMP_XZ',
	CompLzma         = 'COMP_LZMA',
	CompZstd         = 'COMP_ZSTD',
	CompUnknownOrNo = 'COMP_UNKNOWN_OR_NO',
}

/** One byte of a {@link CompressionSignature}: an exact value, or an inclusive range for the bytes that vary. */
type MagicByte = number | readonly [from: number, to: number];

/** What the first bytes of a file say about how it is compressed. */
type CompressionSignature =
	/** The bytes identify a kind flowR can unwrap. */
	| { readonly magic: readonly MagicByte[], readonly type: CompressionType, readonly zlibOnly?: boolean }
	/** The bytes are recognizable, but there is no reader for them; the string states why. */
	| { readonly magic: readonly MagicByte[], readonly unsupported: string };

/**
 * The magic bytes {@link RDAParser.detectCompression} tries, in order: the first match wins, so a longer
 * signature has to come before any shorter one it starts with.
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/connections.c#L2675-L2710 | R source: comp_type_from_memory}
 */
const CompressionSignatures: readonly CompressionSignature[] = [
	{ type: CompressionType.CompGz, magic: [0x1f, 0x8b] },
	/* a zlib header is only two bytes and thus easy to hit by accident, so it is asked for explicitly */
	{ type: CompressionType.CompGz, zlibOnly: true, magic: [0x78, 0x9c] },
	/* `BZh` + the block size as a digit, then one of the two block magics bzip2 opens a stream with */
	{ type: CompressionType.CompBz, magic: [0x42, 0x5a, 0x68, [0x31, 0x39], 0x31, 0x41, 0x59, 0x26, 0x53, 0x59] },
	{ type: CompressionType.CompBz, magic: [0x42, 0x5a, 0x68, [0x31, 0x39], 0x17, 0x72, 0x45, 0x38, 0x50, 0x90] },
	{ unsupported: 'this is a lzop-compressed file which this build of R does not support', magic: [0x89, 0x4c, 0x5a, 0x4f] },
	{ type: CompressionType.CompZstd, magic: [0x28, 0xb5, 0x2f, 0xfd] },
	{ type: CompressionType.CompXz, magic: [0xfd, 0x37, 0x7a, 0x58, 0x5a] },
	{ type: CompressionType.CompLzma, magic: [0xff, 0x4c, 0x5a, 0x4d, 0x41] },
	/* lzma_alone, which has no magic of its own: this is the default filter/dictionary header */
	{ type: CompressionType.CompLzma, magic: [0x5d, 0x00, 0x00, 0x80, 0x00] }
];

/** Whether `buf` starts with the given magic. */
function startsWithMagic(buf: Buffer, magic: readonly MagicByte[]): boolean {
	return buf.length >= magic.length
		&& magic.every((byte, i) => typeof byte === 'number' ? buf[i] === byte : buf[i] >= byte[0] && buf[i] <= byte[1]);
}

/**
 * RDA file serialization format and version.
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L61-L72 | R source: saveload.c}
 */
export enum SerializationTypeTag {
	MagicEmpty       = 'R_MAGIC_EMPTY',
	MagicCorrupt     = 'R_MAGIC_CORRUPT',
	MagicAsciiV1     = 'R_MAGIC_ASCII_V1',
	MagicBinaryV1    = 'R_MAGIC_BINARY_V1',
	MagicXdrV1       = 'R_MAGIC_XDR_V1',
	MagicAsciiV2     = 'R_MAGIC_ASCII_V2',
	MagicBinaryV2    = 'R_MAGIC_BINARY_V2',
	MagicXdrV2       = 'R_MAGIC_XDR_V2',
	MagicAsciiV3     = 'R_MAGIC_ASCII_V3',
	MagicBinaryV3    = 'R_MAGIC_BINARY_V3',
	MagicXdrV3       = 'R_MAGIC_XDR_V3',
	MagicMaybeTooNew = 'R_MAGIC_MAYBE_TOONEW',
}

type SerializationTypes = SerializationTypeTag | number;

/** The five-byte magic each serialization variant starts with. */
const SerializationMagic: Readonly<Record<string, SerializationTypeTag>> = {
	'RDA1\n': SerializationTypeTag.MagicAsciiV1,
	'RDB1\n': SerializationTypeTag.MagicBinaryV1,
	'RDX1\n': SerializationTypeTag.MagicXdrV1,
	'RDA2\n': SerializationTypeTag.MagicAsciiV2,
	'RDB2\n': SerializationTypeTag.MagicBinaryV2,
	'RDX2\n': SerializationTypeTag.MagicXdrV2,
	'RDA3\n': SerializationTypeTag.MagicAsciiV3,
	'RDB3\n': SerializationTypeTag.MagicBinaryV3,
	'RDX3\n': SerializationTypeTag.MagicXdrV3,
};

/**
 * Whether `buf` is a bare serialization stream rather than a saved workspace: an `.rds` written by `saveRDS`
 * carries no `RDX3\n` magic and no pairlist of names, it starts straight at the format byte.
 */
function isBareSerializationStream(buf: Buffer): boolean {
	return buf.length >= 2 && buf[1] === 0x0a && SerializationFormatOfByte.has(String.fromCodePoint(buf[0]));
}

/** The control characters an ASCII-format string spells with a backslash escape; any other escaped character stands for itself. */
const AsciiEscapes: Readonly<Record<string, string>> = { n: '\n', t: '\t', v: '\v', b: '\b', r: '\r', f: '\f', a: '\x07' };

/** The variants {@link RDAParser.deserialize} handles. */
const SupportedSerializationTypes: ReadonlySet<SerializationTypes> = new Set([
	SerializationTypeTag.MagicAsciiV2, SerializationTypeTag.MagicBinaryV2, SerializationTypeTag.MagicXdrV2,
	SerializationTypeTag.MagicAsciiV3, SerializationTypeTag.MagicBinaryV3, SerializationTypeTag.MagicXdrV3
]);

/** The variants that would need the version one reader, see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L2157-L2196 | R source: R_LoadSavedData}. */
const VersionOneSerializationTypes: ReadonlySet<SerializationTypes> = new Set([
	SerializationTypeTag.MagicAsciiV1, SerializationTypeTag.MagicBinaryV1, SerializationTypeTag.MagicXdrV1
]);

export type RObject = RValues.NilValue | RObjectData;

type Real = number | RValues.NilValue | RValues.NaReal | RValues.NaN | RValues.PosInf | RValues.NegInf;
type Complex = { r: Real, i: Real };

/**
 * Structured representation of a deserialized R SEXP node.
 *
 * Not all fields are populated on every instance. If a field is populated depends on the {@link SexpType}.
 */
export interface RObjectData {
	name?:         string;
	type?:         SexpType,
	levels?:       number,
	object?:       boolean,
	hasAttribute?: boolean,
	attributes?:   RObjectData[],
	hasTag?:       boolean,
	tag?:          RObject,
	value?:        RObject | RObject[] | RValues | number | (number | RValues | Complex | Real)[] | string | (string | RValues)[] | null[],
	frame?:        RObject,
	_isObject?:    boolean,
	_isLocked?:    boolean,
	car?:          RObject,
	cdr?:          RObject,
	enClos?:       RObject,
	address?:      object | null,
	protected?:    RObject,
	cloEnv?:       RValues;
	prEnv?:        RValues;
	key?:          unknown;
	finalizer?:    unknown;
	next?:         unknown;
	gp?:           number;
	hashTab?:      unknown;
	offset?:       number;
	altRep?:       boolean;
}

/**
 * Numeric identifiers for R SEXP types.
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/include/Rinternals.h#L111-L144 | R source: SEXP}
 * @see {@link http://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L681-L711 | R source: SEXP}
 */
export enum SexpType {
	NilSxp           = 0,
	SymSxp           = 1,
	ListSxp          = 2,
	CloSxp           = 3,
	EnvSxp           = 4,
	PromSxp          = 5,
	LangSxp          = 6,
	SpecialSxp       = 7,
	BuiltInSxp       = 8,
	CharSxp          = 9,
	LglSxp           = 10,
	IntSxp           = 13,
	RealSxp          = 14,
	CplxSxp          = 15,
	StrSxp           = 16,
	DotSxp           = 17,
	AnySxp           = 18,
	VecSxp           = 19,
	ExprSxp          = 20,
	BcodesSxp        = 21,
	ExtPtrSxp        = 22,
	WeakRefSxp       = 23,
	RawSxp           = 24,
	ObjSxp           = 25,
	NewSxp           = 30,
	FreeSxp          = 31,
	FunSxp           = 99,
	RefSxp           = 255,
	NilValueSxp      = 254,
	GlobalEnvSxp     = 253,
	UnboundValueSxp  = 252,
	MissingArgSxp    = 251,
	BaseNamespaceSxp = 250,
	NamespaceSxp     = 249,
	PackageSxp       = 248,
	PersistSxp       = 247,
	ClassRefSxp      = 246,
	GenericRefSxp    = 245,
	BcRepDef         = 244,
	BcRepRef         = 243,
	EmptyEnvSxp      = 242,
	BaseEnvSxp       = 241,
	AltLangSxp       = 240,
	AttrListSxp      = 239,
	AltRepSxp        = 238,
}

/**
 * Special values used internally by R serialization.
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/include/Rinternals.h#L401-L471 | R source: RValues}
 */
enum RValues {
	NilValue        = 'NIL',
	EmptyEnv        = 'EMPTY_ENV',
	BaseEnv         = 'BASE_ENV',
	GlobalEnv       = 'GLOBAL_ENV',
	UnboundValue    = 'UNBOUND_VALUE',
	MissingArg      = 'MISSING_ARG',
	BaseNamespace   = 'BASE_NAMESPACE',
	ClassSymbol     = 'CLASS',
	NaString        = 'NA_character_',
	NaInteger       = 'NA_integer_',
	NaReal          = 'NA_real_',
	NaComplex       = 'NA_complex_',
	NaN               = 'NaN',
	PosInf            = 'Pos_Inf',
	NegInf            = 'Neg_inf',
}

export enum SerializationFormat {
	Xdr    = 'XDR',
	Ascii  = 'ASCII',
	Binary = 'BINARY',
}

/** pairlist-based SEXP types {@link RDAParser.readItemIterative} unrolls iteratively rather than recursing per element. */
const IterativeSexpTypes: ReadonlySet<SexpType> = new Set([
	SexpType.ListSxp, SexpType.LangSxp, SexpType.CloSxp, SexpType.PromSxp, SexpType.DotSxp
]);

/** the `{ value, type }` every parameterless special SEXP marker in {@link RDAParser.readItemRecursive} decodes to directly. */
const SpecialValueSxps: ReadonlyMap<SexpType, { readonly value: RValues, readonly type: SexpType }> = new Map([
	[SexpType.NilValueSxp,      { value: RValues.NilValue,      type: SexpType.NilSxp }],
	[SexpType.EmptyEnvSxp,      { value: RValues.EmptyEnv,      type: SexpType.EnvSxp }],
	[SexpType.BaseEnvSxp,       { value: RValues.BaseEnv,       type: SexpType.EnvSxp }],
	[SexpType.GlobalEnvSxp,     { value: RValues.GlobalEnv,     type: SexpType.EnvSxp }],
	[SexpType.UnboundValueSxp,  { value: RValues.UnboundValue,  type: SexpType.EnvSxp }],
	[SexpType.MissingArgSxp,    { value: RValues.MissingArg,    type: SexpType.EnvSxp }],
	[SexpType.BaseNamespaceSxp, { value: RValues.BaseNamespace, type: SexpType.EnvSxp }],
]);

/** The parts of the (untyped) `bzip2` package we use. */
export interface Bzip2 {
	array(bytes: Uint8Array): unknown
	header(bits: unknown): number
	/** decompresses the next block (stopping after `len` bytes), `-1` after the last one */
	decompress(bits: unknown, size: number, len?: number): Uint8Array | -1
}

/** Decompresses a bzip2 stream block by block, throwing a `RangeError` if it would yield more than `limit` bytes. */
export function bunzip(bzip2: Bzip2, content: Buffer, limit = Infinity): Buffer {
	const bits = bzip2.array(content);
	const size = bzip2.header(bits);
	const chunks: Uint8Array[] = [];
	let total = 0;
	for(let chunk = bzip2.decompress(bits, size, limit - total + 1); chunk !== -1; chunk = bzip2.decompress(bits, size, limit - total + 1)) {
		total += chunk.byteLength;
		if(total > limit) {
			throw new RangeError(`Refusing to decompress more than ${limit} bytes`);
		}
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

/** the list-like SEXP types {@link RDAParser.VECTOR_ELT} and {@link RDAParser.SET_VECTOR_ELT} accept */
const ListSexpTypes: ReadonlySet<SexpType | undefined> = new Set([SexpType.VecSxp, SexpType.ExprSxp, SexpType.WeakRefSxp]);

/** the bytecode constant types {@link RDAParser.ReadBCLang} decodes as language objects */
const BCLangTypes: ReadonlySet<number | string> = new Set([SexpType.LangSxp, SexpType.ListSxp, SexpType.BcRepDef, SexpType.BcRepRef, SexpType.AltLangSxp, SexpType.AttrListSxp]);

/** the base types an ALTREP object of an unregistered class is read back as, as a length zero vector */
const AltVecSexpTypes: ReadonlySet<SexpType> = new Set([
	SexpType.LglSxp, SexpType.IntSxp, SexpType.RealSxp, SexpType.CplxSxp, SexpType.StrSxp, SexpType.RawSxp, SexpType.VecSxp, SexpType.ExprSxp
]);

/** the ASCII words that spell the special doubles */
const AsciiReals: ReadonlyMap<string, Real> = new Map([['NA', RValues.NaReal], ['NaN', RValues.NaN], ['Inf', RValues.PosInf], ['-Inf', RValues.NegInf]]);

/** the format byte a serialization stream opens with */
const SerializationFormatOfByte: ReadonlyMap<string, SerializationFormat> = new Map([['A', SerializationFormat.Ascii], ['B', SerializationFormat.Binary], ['X', SerializationFormat.Xdr]]);

/**
 * Parser for RDA files.
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c | R source: serialize.c}
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c | R source: saveload.c}
 */
export class RDAParser {
	private buffer!:           Buffer;
	private offset = 0;
	private static readonly R_CODE_SET_MAX = 2 ** 6 - 1;
	private static readonly SIZE_OF_DOUBLE = 2 ** 3;
	private static readonly WORD_SIZE = 2 ** 7;
	private static readonly MAX_VECTOR_LENGTH = 2 ** 16;
	private format!:           SerializationFormat;
	private readonly refTable: RObject[] = [];

	constructor(private readonly file: FlowrFileProvider, private readonly shortcut: boolean = true) {}

	/** Decompresses, deserializes, and flattens (per the constructor's `shortcut`) the file. Answers found {@link RObjectData}s, `null` if the file is empty. */
	parse(): RObjectData[] | null {
		const result = this.parseObject();
		return result === RValues.NilValue ? null : this.flattenRObject(result, this.shortcut);
	}

	/**
	 * Parses the file into the single R object it serializes (what an `.rds` holds), without the flattening
	 * {@link parse} applies. Answers the deserialized object, {@link RValues.NilValue} for an empty file.
	 */
	parseObject(): RObject {
		const fileContent = fs.readFileSync(this.file.path());
		this.buffer = this.decompress(fileContent, this.detectCompression(fileContent));
		return this.deserialize2();
	}

	/**
	 * First {@link CompressionSignatures} entry `buf` matches, {@link CompressionType.CompUnknownOrNo} if none does.
	 * Throws Error if the file is of a recognized but unreadable kind. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/connections.c#L2675-L2710 | R source: comp_type_from_memory}
	 */
	detectCompression(buf: Buffer, withZlib: boolean = false): CompressionType {
		const signature = CompressionSignatures.find(s => startsWithMagic(buf, s.magic) && !('zlibOnly' in s && s.zlibOnly && !withZlib));
		if(signature && 'unsupported' in signature) {
			throw new Error(signature.unsupported);
		}
		return signature?.type ?? CompressionType.CompUnknownOrNo;
	}

	/** Decompresses `fileContent` per the {@link detectCompression} result `compressionType`. Throws error for unsupported compression types. */
	decompress(fileContent: Buffer, compressionType: CompressionType): Buffer {
		// the file belongs to the (possibly hostile) project, so the secure mode bounds what it may decompress to
		const limit = SecureMode.decompressionLimit();
		switch(compressionType) {
			case CompressionType.CompGz: {
				// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on demand, so bundles without gzip files do not pull in zlib
				const zlib = require('zlib') as typeof import('zlib');
				try {
					return zlib.gunzipSync(fileContent, { maxOutputLength: limit });
				} catch(e) {
					if((e as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
						throw e;
					}
					return zlib.inflateSync(fileContent, { maxOutputLength: limit });
				}
			}
			case CompressionType.CompBz:
				// eslint-disable-next-line @typescript-eslint/no-require-imports -- the untyped `bzip2` package has no module declaration, and is loaded on demand
				return bunzip(require('bzip2') as Bzip2, fileContent, limit);
			case CompressionType.CompXz:
			case CompressionType.CompLzma:
			case CompressionType.CompZstd:
				throw new Error(`${compressionType} is not supported yet.`);
			case CompressionType.CompUnknownOrNo:
				return fileContent;
			default:
				assertUnreachable(compressionType);
		}
	}

	/**
	 * Identifies the {@link SerializationTypes} of a decompressed RDA-file buffer.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L1808-L1858 | R source: R_ReadMagic}
	 */
	determineSerializationType(buf: Buffer): SerializationTypes {
		if(buf.length < 5) {
			return buf.length === 0 ? SerializationTypeTag.MagicEmpty : SerializationTypeTag.MagicCorrupt;
		}
		const magic = buf.toString('ascii', 0, 5);
		if(magic in SerializationMagic) {
			return SerializationMagic[magic];
		}
		/* without any magic, the first four bytes are the version number of a pre-magic workspace */
		return magic.startsWith('RD') ? SerializationTypeTag.MagicMaybeTooNew : Number(buf.toString('ascii', 0, 4));
	}

	/**
	 * Deserializes a decompressed RDA-file. Answers {@link RObject}, or {@link RValues.NilValue} if deserialization fails.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L1923-L1972 | R source: R_LoadFromFile}
	 */
	deserialize2(): RObject {
		this.offset = 0;
		/* an `.rds` holds a single object as a bare stream: no workspace magic, no pairlist of names */
		if(isBareSerializationStream(this.buffer)) {
			return this.deserialize();
		}
		const serializationType = this.determineSerializationType(this.buffer);
		this.offset += 5;
		if(([SerializationTypeTag.MagicCorrupt, SerializationTypeTag.MagicEmpty, SerializationTypeTag.MagicMaybeTooNew] as SerializationTypes[]).includes(serializationType)) {
			throw new Error('Could not determine serialization type');
		}
		if(SupportedSerializationTypes.has(serializationType)) {
			return this.deserialize();
		} else if(VersionOneSerializationTypes.has(serializationType)) {
			rdaLog.warn('Version one rda files are not supported yet');
		}
		return RValues.NilValue;
	}

	/** Deserializes a decompressed RDA-file. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2237-L2292 | R source: R_Unserialize} */
	deserialize(): RObject {
		let formatByte = String.fromCodePoint(this.buffer[this.offset]);
		/* an ASCII stream may leave a trailing newline behind, so the format follows in the next two bytes */
		if(formatByte === '\n' && String.fromCodePoint(this.buffer[this.offset + 1]) === 'A') {
			formatByte = 'A';
			this.offset += 2;
		}
		const format = SerializationFormatOfByte.get(formatByte);
		if(format === undefined) {
			throw new Error('unknown input format');
		}
		this.format = format;
		this.offset += 2;

		const version = this.readInt();
		const writerVersion = this.readInt();
		const minReaderVersion = this.readInt();
		if(version === 3) {
			const neLen = this.readInt();
			if(neLen > RDAParser.R_CODE_SET_MAX || neLen < 0) {
				throw new Error('invalid length of encoding name');
			}
			this.inString(neLen);
		} else if(version !== 2) {
			const [vw, pw, sw] = this.decodeVersion(writerVersion);
			const unreleased = `cannot read unreleased workspace version ${version} written by experimental R ${vw}.${pw}.${sw}`;
			if(minReaderVersion < 0) {
				throw new Error(unreleased);
			}
			const [vm, pm, sm] = this.decodeVersion(minReaderVersion);
			throw new Error(`${unreleased}; need R ${vm}.${pm}.${sm} or newer`);
		}
		return this.readItem();
	}

	/** Reads a serialized integer. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L396-L420 | R source: inInteger} */
	inInteger(): number | RValues.NaInteger {
		if(this.format === SerializationFormat.Ascii) {
			const word = this.inWord(128);
			if(word === 'NA') {
				return RValues.NaInteger;
			}
			const i = Number.parseInt(word, 10);
			if(Number.isNaN(i)) {
				throw new TypeError(`${word} (or ${i}) is not a number`);
			}
			return i;
		} else if(this.format === SerializationFormat.Binary || this.format === SerializationFormat.Xdr) {
			const i = this.format === SerializationFormat.Binary ? this.buffer.readInt32LE(this.offset) : this.buffer.readInt32BE(this.offset);
			this.offset += 4;
			return i;
		}
		return RValues.NaInteger;
	}

	/** Reads a serialized integer that must not be {@link RValues.NaInteger}. */
	readInt(): number {
		return this.assertInteger(this.inInteger());
	}

	/** Advances past a serialized integer. Mirrors {@link inInteger}. */
	skipInteger(): void {
		if(this.format === SerializationFormat.Ascii) {
			this.skipWord();
		} else if(this.format === SerializationFormat.Binary || this.format === SerializationFormat.Xdr) {
			this.offset += 4;
		}
	}

	/**. Throws error if `value` is {@link RValues.NaInteger}. */
	assertInteger(value: number | RValues.NaInteger): number {
		if(value === RValues.NaInteger) {
			throw new Error('Unexpected NA integer');
		}
		return value;
	}

	/**. Throws error if `obj` is {@link RValues.NilValue}. */
	assertRObjectData(obj: RObject): RObjectData {
		if(obj === RValues.NilValue) {
			throw new Error('Unexpected NilValue');
		}
		return obj;
	}

	/**
	 * Reads an ASCII word of at most `size` bytes. Throws error on EOF or overflow.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L378-L394 | R source: inWord}
	 */
	inWord(size: number): string {
		let c;
		do{
			c = this.inChar();
			if(c === -1) {
				throw new Error('Read character is -1.');
			}
		} while(this.isSpace(c));
		let word = '';
		while(!this.isSpace(c) && word.length < size) {
			word += String.fromCodePoint(c);
			c = this.inChar();
		}
		if(word.length >= size) {
			throw new Error(`${word.length} >= ${size} when reading word.`);
		}
		return word;
	}

	/** Skips an ASCII word. Mirrors {@link inWord}. Throws error on EOF or overflow past {@link RDAParser.WORD_SIZE}. */
	skipWord(): void {
		this.inWord(RDAParser.WORD_SIZE);
	}

	/**. Answers the next character, or `-1` on EOF. */
	inChar(): number {
		return this.offset >= this.buffer.length ? -1 : this.buffer[this.offset++];
	}

	/** Whether `c` is a whitespace byte. */
	isSpace(c: number): boolean {
		return c >= 9 && c <= 13 || c === 32;
	}

	/**
	 * Reads a serialized string of `len` bytes.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L505-L550 | R source: inString}
	 */
	inString(len: number): string {
		if(this.format !== SerializationFormat.Ascii) {
			const bytes = this.buffer.subarray(this.offset, this.offset + len);
			this.offset += len;
			return bytes.toString('latin1');
		} else if(len <= 0) {
			return '';
		}
		while(this.offset < this.buffer.length) {
			if(!this.isSpace(this.buffer[this.offset++])) {
				break;
			}
		}
		this.offset--;
		const result: string[] = [];
		for(let i = 0; i < len; i++) {
			let c = String.fromCodePoint(this.buffer[this.offset++]);
			if(c !== '\\') {
				result.push(c);
				continue;
			}
			c = String.fromCodePoint(this.buffer[this.offset++]);
			if(c in AsciiEscapes) {
				result.push(AsciiEscapes[c]);
			} else if('0' <= c && c < '8') {
				let d = 0;
				for(let j = 0; '0' <= c && c < '8' && j < 3; j++) {
					d = d * 8 + Number.parseInt(c);
					c = String.fromCodePoint(this.buffer[this.offset++]);
				}
				result.push(String.fromCodePoint(d));
				this.offset--;
			} else {
				result.push(c);
			}
		}
		return result.join('');
	}

	/** Skips a serialized string of `len` bytes. Mirrors {@link inString}. */
	skipString(len: number): void {
		if(this.format === SerializationFormat.Ascii) {
			// the escape handling makes the consumed length depend on the content, so we have to decode it
			this.inString(len);
		} else {
			this.offset += len;
		}
	}

	/**
	 * Decodes an encoded R writer version into `[v, p, s]`.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2230-L2235 | R source: decodeVersion}
	 */
	decodeVersion(writerVersion: number): number[] {
		const rest = writerVersion % RDAParser.MAX_VECTOR_LENGTH;
		return [Math.trunc(writerVersion / RDAParser.MAX_VECTOR_LENGTH), Math.trunc(rest / 2 ** 8), rest % 2 ** 8];
	}

	/**
	 * Reads the next flags and dispatches to {@link readItemRecursive}; the main recursive entry point for every R
	 * object encountered during deserialization.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2117-L2121 | R source: ReadItem}
	 */
	readItem(): RObject {
		return this.readItemRecursive(this.readInt());
	}

	/** Reads the next item, or with `skip` advances past it via {@link skipItem}. */
	private nextItem(skip: boolean): RObject {
		return skip ? this.skipItem() : this.readItem();
	}

	/**
	 * Resolves a namespace reference by name. Simpler variant of {@link R_FindNamespace1}.
	 * R would load the namespace (`getNamespace()`), but flowR analyzes R code and data without running it: the name comes
	 * from the (untrusted) file, and loading a namespace runs the package's code. Hence, this answers an `EnvSxp` standing
	 * for the (unknown) namespace environment without consulting R.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/envir.c#L3795-L3804 | R source: R_FindNamespace}
	 */
	R_FindNamespace(info: RObjectData): RObjectData {
		rdaLog.trace(`Not loading namespace ${JSON.stringify((info.value as RObjectData | undefined)?.name)} of a serialized object`);
		return { type: SexpType.EnvSxp };
	}

	/**
	 * Resolves a serialized namespace reference, see {@link R_FindNamespace} for why this does not ask R.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1785-L1796 | R source: R_FindNamespace1}
	 */
	R_FindNamespace1(info: RObjectData): RObjectData {
		return this.R_FindNamespace({ ...info, value: (info.value as RObjectData[] | undefined)?.[0] });
	}

	/**
	 * Deserializes a single SEXP node, dispatching on its encoded {@link SexpType}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1871-L2115 | R source: ReadItem_Recursive}
	 */
	readItemRecursive(flags: number): RObjectData {
		const [type, levels, object, hasAttribute] = this.unpackFlags(flags);
		const special = SpecialValueSxps.get(type);
		if(special) {
			return { ...special };
		}
		switch(type) {
			case SexpType.RefSxp:
				return this.getReadRef(this.inRefIndex(flags));
			case SexpType.PersistSxp:
				return this.addReadRef(this.inStringVec());
			case SexpType.AltRepSxp:
				rdaLog.warn('AltReps are not supported yet!');
				return this.readOrSkipAltRep(object, levels, false);
			case SexpType.SymSxp:
				return this.readOrSkipSym(false);
			case SexpType.PackageSxp:
				return this.addReadRef(this.rFindPackageEnv(this.inStringVec()));
			case SexpType.NamespaceSxp:
				return this.addReadRef(this.R_FindNamespace1(this.inStringVec()));
			case SexpType.EnvSxp:
				return this.readOrSkipEnv(false);
			default:
				return IterativeSexpTypes.has(type) ? this.readItemIterative(flags) : this.readOrSkipLeaf(type, levels, object, hasAttribute, false);
		}
	}

	/** Reads (or with `skip`, discards) a `SymSxp` symbol. Shared by {@link readItemRecursive} and {@link skipItem}. */
	readOrSkipSym(skip: boolean): RObjectData {
		const s = skip ? this.skipItem() : this.assertRObjectData(this.readItem());
		s.type = SexpType.SymSxp;
		return this.addReadRef(s);
	}

	/**
	 * Reads (or with `skip`, discards) an `AltRepSxp`. Only `skip === false` attempts {@link AltRepUnserializeEx};
	 * discarding it just derives the base type its payload triple encodes. Shared by {@link readItemRecursive} and {@link skipItem}.
	 */
	readOrSkipAltRep(object: boolean, levels: number, skip: boolean): RObjectData {
		const info = this.nextItem(skip) as RObjectData;
		const state = this.nextItem(skip) as RObjectData;
		const attr = this.nextItem(skip) as RObjectData;
		return skip ? { type: (((info.cdr as RObjectData).cdr as RObjectData).car as RObjectData).type } : this.AltRepUnserializeEx(info, state, attr, object, levels);
	}

	/**
	 * Reads (or with `skip`, discards) an `EnvSxp` environment frame; the locked/class-object bookkeeping only matters when kept.
	 * Shared by {@link readItemRecursive} and {@link skipItem}.
	 */
	readOrSkipEnv(skip: boolean): RObjectData {
		let locked: number | RValues.NaInteger = 0;
		if(skip) {
			this.skipInteger();
		} else {
			locked = this.inInteger();
		}
		const s = this.addReadRef<RObjectData>({ type: SexpType.EnvSxp });
		this.SetEnClos(s, this.assertRObjectData(this.nextItem(skip)));
		s.frame = this.nextItem(skip);
		s.hashTab = this.nextItem(skip);
		s.attributes = this.assertRObjectData(this.nextItem(skip)).attributes;
		if(!skip) {
			if(s.attributes?.some(e => e.name === RValues.ClassSymbol)) {
				s._isObject = true;
			}
			if(locked) {
				s._isLocked = false;
			}
		}
		return s;
	}

	/**
	 * Reads (or with `skip`, discards) the payload of a leaf SEXP node, shared by {@link readItemRecursive} and {@link skipItem}.
	 * `skip` mirrors their field-by-field differences exactly; see the branches below.
	 */
	readOrSkipLeaf(type: number, levels: number, object: boolean, hasAttribute: boolean, skip: boolean): RObjectData {
		let s: RObjectData = {};
		switch(type) {
			case SexpType.ExtPtrSxp:
				s.type = type;
				this.addReadRef(s);
				if(!skip) {
					s.address = null;
				}
				s.protected = this.nextItem(skip);
				s.tag = this.nextItem(skip);
				break;
			case SexpType.WeakRefSxp:
				s.value = { type: SexpType.WeakRefSxp };
				this.addReadRef(s);
				break;
			case SexpType.SpecialSxp:
			case SexpType.BuiltInSxp: {
				const len = this.readInt();
				if(len < 0) {
					throw new Error('invalid length');
				}
				if(skip) {
					s.type = type;
					this.skipString(len);
				} else {
					const name = this.inString(len);
					if(!(name in RFunTabOffsets)) {
						throw new Error(`unrecognized internal function name "${name}"`);
					}
					s = this.mkPrimSxp((RFunTabOffsets as Record<string, string | number>)[name] as number, type === SexpType.BuiltInSxp ? 1 : 0);
				}
				break;
			}
			case SexpType.CharSxp: {
				const len = this.readInt();
				if(len < -1) {
					throw new Error(`Invalid length ${len} of string.`);
				}
				s.name = len === -1 ? RValues.NaString : this.readChar(len, levels);
				break;
			}
			case SexpType.LglSxp:
			case SexpType.IntSxp:
			case SexpType.RealSxp: {
				const len = this.readLength();
				s.type = type;
				s.value = type === SexpType.RealSxp ? this.inRealVec(len, skip) : this.inIntegerVec(len, skip);
				break;
			}
			case SexpType.CplxSxp:
			case SexpType.RawSxp: {
				const len = this.readLength();
				s.type = type;
				const value = type === SexpType.CplxSxp ? this.inComplexVec(len, skip) : this.inRaw(len, skip);
				if(!skip) {
					s.value = value;
				}
				break;
			}
			case SexpType.StrSxp:
			case SexpType.VecSxp:
			case SexpType.ExprSxp: {
				const len = this.readLength();
				s.type = type;
				if(!skip) {
					s.value = new Array(len);
				}
				for(let count = 0; count < len; ++count) {
					if(skip) {
						this.skipItem();
					} else if(type === SexpType.StrSxp) {
						this.SET_STRING_ELT(s, count, this.assertRObjectData(this.readItem()));
					} else {
						this.SET_VECTOR_ELT(s, count, this.readItem());
					}
				}
				break;
			}
			case SexpType.BcodesSxp:
				if(skip) {
					this.skipBC();
					s.type = SexpType.VecSxp;
				} else {
					s = this.readBC() as RObjectData;
				}
				break;
			case SexpType.ClassRefSxp:
				throw new Error('this version of R cannot read class references');
			case SexpType.GenericRefSxp:
				throw new Error('this version of R cannot read generic function references');
			case SexpType.ObjSxp:
				s.type = SexpType.ObjSxp;
				break;
			default:
				throw new Error(`ReadItem: unknown type ${type}, perhaps written by later version of R`);
		}
		if(!skip) {
			if(type !== SexpType.CharSxp) {
				s.levels = levels;
			}
			s.object = object;
		}
		if(s.type !== SexpType.CharSxp) {
			s.attributes = hasAttribute ? [skip ? this.skipItem() : this.assertRObjectData(this.readItem())] : undefined;
		} else if(hasAttribute) {
			this.nextItem(skip);
		}
		return !skip && s.type === SexpType.BcodesSxp ? this.R_BytecodeExpr(s) as RObjectData : s;
	}

	/** Advances past a serialized SEXP node, filling in only its type. Mirrors {@link readItemRecursive}'s structure, but skips payload data. */
	skipItem(): RObjectData {
		const flags = this.readInt();
		const [type, levels, object, hasAttribute] = this.unpackFlags(flags);
		if(SpecialValueSxps.has(type)) {
			return { type: SexpType.EnvSxp };
		}
		switch(type) {
			case SexpType.RefSxp:
				return this.getReadRef(this.inRefIndex(flags));
			case SexpType.NamespaceSxp:
				this.inStringVec(true);
				return this.addReadRef({ type: SexpType.EnvSxp });
			case SexpType.PackageSxp:
			case SexpType.PersistSxp:
				this.inStringVec(true);
				return { type: SexpType.CharSxp };
			case SexpType.AltRepSxp:
				return this.readOrSkipAltRep(object, levels, true);
			case SexpType.SymSxp:
				return this.readOrSkipSym(true);
			case SexpType.EnvSxp:
				return this.readOrSkipEnv(true);
			default:
				return IterativeSexpTypes.has(type) ? this.readItemIterative(flags) : this.readOrSkipLeaf(type, levels, object, hasAttribute, true);
		}
	}

	/**
	 * Reads (or with `skip`, discards) `len` raw bytes into a number array.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2062-L2084 | R source: ReadItem_Recursive}
	 */
	inRaw(len: number, skip: boolean = false): number[] {
		if(this.format === SerializationFormat.Ascii) {
			const result: number[] = [];
			for(let ix = 0; ix < len; ix++) {
				if(skip) {
					this.skipWord();
				} else {
					result.push(Number.parseInt(this.inWord(128), 16));
				}
			}
			return result;
		}
		const start = this.offset;
		this.offset += len;
		return skip ? [] : Array.from({ length: len }, (_, i) => this.buffer[start + i]);
	}

	/** Resolves package environments. Not implemented yet!. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/envir.c#L3732-L3741 | R source: R_FindPackageEnv} */
	rFindPackageEnv(s: RObjectData): RObjectData {
		rdaLog.warn('Resolving package environments was triggered, but is not implemented yet!');
		return s;
	}

	/** Decodes a raw SEXP flags word into `[type, levels, isObject, hasAttribute, hasTag]`. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L748-L756 | R source: UnpackFlags} */
	unpackFlags(flags: number): [number, number, boolean, boolean, boolean] {
		return [flags & 255, flags >> 12, (flags & (1 << 8)) !== 0, (flags & (1 << 9)) !== 0, (flags & (1 << 10)) !== 0];
	}

	/** Retrieves the registered object at 1-based reference `index`. Throws error if out of range. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1461-L1469 | R source: GetReadRef} */
	getReadRef(index: number): RObjectData {
		if(index < 1 || index > this.refTable.length) {
			throw new Error('reference index out of range');
		}
		return this.refTable[index - 1] as RObjectData;
	}

	/**
	 * The 1-based reference index encoded in `flags`: bits 8-31 encode it directly when non-zero, otherwise it is read as the next stream integer.
	 * @see {@link http://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L782-L789 | R source: InRefIndex}
	 */
	inRefIndex(flags: number): number {
		const i = flags >> 8;
		return i === 0 ? this.readInt() : i;
	}

	/** Appends `value` to the reference table so it can be resolved later by {@link getReadRef}, and answers it. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1471-L1490 | R source: AddReadRef} */
	addReadRef<T extends RObject>(value: T): T {
		this.refTable.push(value);
		return value;
	}

	/**
	 * Reads (or with `skip`, discards) a persistent string vector. Answers a `CharSxp` {@link RObjectData} whose
	 * `value` array holds the deserialized items, empty when skipped. Throws Error if the names flag is non-zero.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1492-L1504 | R source: InStringVec}
	 */
	inStringVec(skip: boolean = false): RObjectData {
		if(this.inInteger() !== 0) {
			throw new Error('names in persistent strings are not supported yet');
		}
		const len = this.readInt();
		const value = new Array<RObject>(skip ? 0 : len);
		for(let i = 0; i < len; i++) {
			if(skip) {
				this.skipItem();
			} else {
				value[i] = this.readItem();
			}
		}
		return { type: SexpType.CharSxp, value };
	}

	/** Sets `x`'s enclosing environment to `v`. Throws error if `v` is invalid or would introduce a cycle. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L4677-L4690 | R source: SET_ENCLOS} */
	SetEnClos(x: RObjectData, v: RObjectData): void {
		if(v.value === undefined || v.value === RValues.NilValue) {
			v.value = RValues.EmptyEnv;
		}
		if(v.type !== SexpType.EnvSxp) {
			throw new Error("'parent' is not an environment");
		}
		for(let e: RObject = v; e !== RValues.NilValue; e = e.enClos ?? RValues.NilValue) {
			if(e === x) {
				throw new Error('cycles in parent chains are not allowed');
			}
		}
		x.enClos = v;
	}

	/**
	 * Iteratively deserializes linked-list based SEXP structures. Answers head node of the reconstructed pairlist
	 * chain. Throws Error if the initial type is not a valid pairlist type.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1800-L1868 | R source: ReadItem_Iterative}
	 */
	readItemIterative(flags: number): RObjectData {
		let type = flags & 255;
		if(!IterativeSexpTypes.has(type)) {
			throw new Error('Wrong type.');
		}
		const head: RObjectData = {};
		let last = head;
		while(IterativeSexpTypes.has(type)) {
			const [, levels, object, hasAttr, hasTag] = this.unpackFlags(flags);
			const s: RObjectData = { type, levels, object };
			s.attributes = hasAttr ? [this.shortcut ? this.skipItem() : this.assertRObjectData(this.readItem())] : undefined;
			s.tag = hasTag ? this.readItem() : RValues.NilValue;
			s.car = this.nextItem(this.shortcut);
			if(type === SexpType.CloSxp) {
				s.cloEnv = RValues.EmptyEnv;
			} else if(type === SexpType.PromSxp) {
				s.prEnv = RValues.BaseEnv;
			}
			last.cdr = s;
			last = s;
			flags = this.readInt();
			type = flags & 255;
		}
		last.cdr = this.readItemRecursive(flags);
		return head.cdr as RObjectData;
	}

	/**
	 * Creates or retrieves a cached primitive function object of type {@link SexpType.BuiltInSxp} (`evaluation` non-zero)
	 * or {@link SexpType.SpecialSxp}, from `index` into the primitive function table. Throws Error if out of range.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/dstruct.c#L37-L68 | R source: mkPRIMSXP}
	 */
	mkPrimSxp(index: number, evaluation: number): RObjectData {
		if(index < 0 || index >= Object.keys(RFunTabOffsets).length) {
			throw new Error('offset is out of R_FunTab range');
		}
		return { type: evaluation ? SexpType.BuiltInSxp : SexpType.SpecialSxp, offset: index };
	}

	/**
	 * Reads `len` bytes as a character string, decoded per the encoding flags in `levels` (bit 3 UTF-8, bit 2 Latin-1,
	 * bit 1 raw bytes, bit 6 ASCII); answers `''` for a native encoding, which is not yet handled.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1689-L1759 | R source: ReadChar}
	 */
	readChar(len: number, levels: number): string {
		const bytes = Buffer.from(this.inString(len), 'latin1');
		if(levels & (1 << 3)) {
			return new TextDecoder('utf-8').decode(bytes);
		} else if(levels & (1 << 2)) {
			return new TextDecoder('iso-8859-1').decode(bytes);
		} else if(levels & (1 << 1) || levels & (1 << 6)) {
			return bytes.toString('latin1');
		}
		rdaLog.warn('Native encoding detected! Native encoding not supported yet! Value will be empty');
		return '';
	}

	/**
	 * Reads a vector length from the stream. Throws Error for negative lengths or an invalid high-word value.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1761-L1782 | R source: ReadLENGTH}
	 */
	readLength(): number {
		const len = this.readInt();
		if(len < -1) {
			throw new Error('negative serialized length for vector');
		} else if(len !== -1) {
			return len;
		}
		const len1 = this.readInt();
		const len2 = this.readInt();
		if(len1 > RDAParser.MAX_VECTOR_LENGTH) {
			throw new Error('invalid upper part of serialized vector length');
		}
		/* both halves are written as unsigned; a shift would wrap at 32 bit, so the high half is scaled instead */
		return len1 * 2 ** 32 + (len2 >>> 0);
	}

	/**
	 * Reads (or with `skip`, discards) `len` integers. Throws Error for BINARY format or XDR buffer overrun.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1507-L1541 | R source: InIntegerVec}
	 */
	inIntegerVec(len: number, skip: boolean = false): (number | RValues.NaInteger)[] {
		if(this.format === SerializationFormat.Binary) {
			throw new Error('No binary support yet.');
		} else if(this.format === SerializationFormat.Xdr) {
			if(this.offset + 4 * len > this.buffer.length) {
				throw new Error('XDR read failed');
			}
			const start = this.offset;
			this.offset += 4 * len;
			return skip ? [] : Array.from({ length: len }, (_, i) => this.buffer.readInt32BE(start + 4 * i));
		}
		const result: (number | RValues.NaInteger)[] = [];
		for(let cnt = 0; cnt < len; cnt++) {
			if(skip) {
				this.skipInteger();
			} else {
				result.push(this.inInteger());
			}
		}
		return result;
	}

	/**
	 * Reads (or with `skip`, discards) `len` doubles. Throws Error for BINARY format.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1543-L1577 | R source: InRealVec}
	 */
	inRealVec(len: number, skip: boolean = false): Real[] {
		if(this.format === SerializationFormat.Binary) {
			throw new Error('No binary support yet.');
		} else if(this.format === SerializationFormat.Xdr) {
			const start = this.offset;
			this.offset += len * RDAParser.SIZE_OF_DOUBLE;
			return skip ? [] : Array.from({ length: len }, (_, i) => this.buffer.readDoubleBE(start + i * RDAParser.SIZE_OF_DOUBLE));
		}
		const result = Array.from({ length: len }, () => this.inReal(skip));
		return skip ? [] : result;
	}

	/**
	 * Reads (or with `skip`, discards) the next double. Throws TypeError if the ASCII token is not a valid float.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L427-L463 | R source: InReal}
	 */
	inReal(skip: boolean = false): Real {
		if(this.format === SerializationFormat.Ascii) {
			if(skip) {
				this.skipWord();
				return RValues.NilValue;
			}
			const word = this.inWord(128);
			const special = AsciiReals.get(word);
			if(special !== undefined) {
				return special;
			}
			const d = Number.parseFloat(word);
			if(Number.isNaN(d)) {
				throw new TypeError('Read error: Invalid numeric ASCII format');
			}
			return d;
		} else if(this.format === SerializationFormat.Binary || this.format === SerializationFormat.Xdr) {
			const d = skip ? RValues.NilValue : this.format === SerializationFormat.Binary ? this.buffer.readDoubleLE(this.offset) : this.buffer.readDoubleBE(this.offset);
			this.offset += 8;
			return d;
		}
		return RValues.NilValue;
	}

	/**
	 * Reads (or with `skip`, discards) `len` complex numbers, each as two consecutive doubles via {@link inComplex}. Throws Error for BINARY format.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1579-L1616 | R source: InComplexVec}
	 */
	inComplexVec(len: number, skip: boolean = false): Complex[] {
		if(this.format === SerializationFormat.Binary) {
			throw new Error('No binary support yet.');
		}
		const result = Array.from({ length: len }, () => this.inComplex(skip));
		return skip ? [] : result;
	}

	/**
	 * Reads (or with `skip`, discards) a single complex number as two consecutive real values.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L465-L471 | R source: InComplex}
	 */
	inComplex(skip: boolean = false): Complex {
		return { r: this.inReal(skip), i: this.inReal(skip) };
	}

	/**
	 * Sets the `i`-th element of a {@link SexpType.StrSxp} character vector to `v.name`. Throws Error if `x` is not
	 * a {@link SexpType.StrSxp} or `i` is out of bounds. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L4283-L4301 | R source: SET_STRING_ELT}
	 */
	SET_STRING_ELT(x: RObjectData, i: number, v: RObjectData): void {
		if(x.type !== SexpType.StrSxp) {
			throw new Error(`SET_STRING_ELT() can only be applied to a 'character vector', not a '${x.type}'`);
		}
		const arr = x.value as (string | RValues)[];
		if(i < 0 || i >= arr.length) {
			throw new Error(`attempt to set index ${i}/${arr.length} in SET_STRING_ELT`);
		}
		arr[i] = v.name ?? RValues.NaString;
	}

	/**
	 * Sets the `i`-th element of a generic list or vector. Mirrors R's `SET_VECTOR_ELT` macro. Throws Error if `x`
	 * is not a list type or `i` is out of bounds. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L4303-L4322 | R source: SET_VECTOR_ELT}
	 */
	SET_VECTOR_ELT(x: RObjectData, i: number, v: RObject): void {
		if(!ListSexpTypes.has(x.type)) {
			throw new Error(`SET_VECTOR_ELT() can only be applied to a 'list', not a '${x.type}'`);
		}
		const arr = x.value as RObject[];
		if(i < 0 || i >= arr.length) {
			throw new Error(`attempt to set index ${i}/${arr.length} in SET_VECTOR_ELT`);
		}
		arr[i] = v;
	}

	/** Deserializes an R bytecode object. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2221-L2228 | R source: ReadBC} */
	readBC(): RObject {
		return this.readBC1({ type: SexpType.VecSxp, value: new Array(this.readInt()) });
	}

	/** Advances past a bytecode object. Mirrors {@link readBC}. */
	skipBC(): void {
		this.skipInteger();
		this.skipBC1();
	}

	/** Advances past a single bytecode. Mirrors {@link readBC1}. */
	skipBC1(): void {
		this.skipItem();
		this.readOrSkipBCConsts(undefined, true);
	}

	/** Deserializes a single bytecode object, `reps` is the repetition table shared across all constants. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2205-L2219 | R source: ReadBC1} */
	readBC1(reps: RObjectData): RObjectData {
		return { type: SexpType.BcodesSxp, car: this.readItem(), cdr: this.readOrSkipBCConsts(reps, false), tag: RValues.NilValue };
	}

	/**
	 * Reads (or with `skip`, discards) the `n` constants of a bytecode object into a `VecSxp`, `reps` resolves `BcRepDef`/`BcRepRef`.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2173-L2203 | R source: ReadBCConsts}
	 */
	readOrSkipBCConsts(reps: RObjectData | undefined, skip: boolean): RObjectData {
		const n = this.readInt();
		const ans: RObjectData = { type: SexpType.VecSxp, value: new Array(n) };
		for(let i = 0; i < n; i++) {
			const type = this.inInteger();
			if(!skip) {
				this.SET_VECTOR_ELT(ans, i, type === SexpType.BcodesSxp ? this.readBC1(reps as RObjectData) : BCLangTypes.has(type) ? this.ReadBCLang(type as SexpType, reps as RObjectData) : this.readItem());
			} else if(type === SexpType.BcodesSxp) {
				this.skipBC1();
			} else if(BCLangTypes.has(type)) {
				this.skipBCLang(type as SexpType);
			} else {
				this.skipItem();
			}
		}
		return ans;
	}

	/** Reads a single language object from bytecode constants, `reps` is the shared repetition table. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2125-L2171 | R source: ReadBCLang} */
	ReadBCLang(type: SexpType, reps: RObjectData): RObjectData {
		if(type === SexpType.BcRepRef) {
			return this.VECTOR_ELT(reps, this.readInt()) as RObjectData;
		} else if(!BCLangTypes.has(type)) {
			return this.readItem() as RObjectData;
		}
		let pos = -1;
		if(type === SexpType.BcRepDef) {
			pos = this.readInt();
			type = this.readInt();
		}
		const hasAttr = type === SexpType.AltLangSxp || type === SexpType.AttrListSxp;
		const ans: RObjectData = { type: type === SexpType.AltLangSxp ? SexpType.LangSxp : type === SexpType.AttrListSxp ? SexpType.ListSxp : type };
		if(pos >= 0) {
			this.SET_VECTOR_ELT(reps, pos, ans);
		}
		if(hasAttr) {
			ans.attributes = [this.assertRObjectData(this.readItem())];
		}
		ans.tag = this.readItem();
		ans.car = this.ReadBCLang(this.readInt(), reps);
		ans.cdr = this.ReadBCLang(this.readInt(), reps);
		return ans;
	}

	/** Advances past a single language object. Mirrors {@link ReadBCLang}. */
	skipBCLang(type: SexpType): void {
		if(type === SexpType.BcRepRef) {
			this.skipInteger();
			return;
		} else if(!BCLangTypes.has(type)) {
			this.skipItem();
			return;
		}
		if(type === SexpType.BcRepDef) {
			this.skipInteger();
			type = this.readInt();
		}
		if(type === SexpType.AltLangSxp || type === SexpType.AttrListSxp) {
			this.skipItem();
		}
		this.readItem();
		this.skipItem();
		this.skipBCLang(this.readInt());
		this.skipBCLang(this.readInt());
	}

	/**
	 * Retrieves the `i`-th element of a generic list or vector. Throws Error if `x` is not a list type or `i` is out of bounds.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L4122-L4142 | R source: VECTOR_ELT}
	 */
	VECTOR_ELT(x: RObjectData, i: number): RObject {
		if(!ListSexpTypes.has(x.type)) {
			throw new Error(`VECTOR_ELT() can only be applied to a 'list', not a '${x.type}'`);
		}
		if(i < 0 || i >= (x.value as RObject[])?.length) {
			throw new Error('attempt access index %lld/%lld in VECTOR_ELT');
		}
		return (x.value as RObject[])[i];
	}

	/** Source-language expression for an unsupported bytecode object: its first constant pool entry, or {@link RValues.NilValue}. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/eval.c#L5566-L5574 | R source: bytecodeExpr} */
	R_BytecodeExpr(s: RObjectData): RObject {
		if(s.type !== SexpType.BcodesSxp) {
			return s;
		}
		return ((s.cdr as RObjectData).value as RObject[])?.length > 0 ? this.VECTOR_ELT(s.cdr as RObjectData, 0) : RValues.NilValue;
	}

	/**
	 * Attempts to unserialize an ALTREP object. As flowR registers no ALTREP classes, an object of a supported vector
	 * base type is read back as a length zero vector of that type. Throws error for any other base type.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/altrep.c#L298-L338 | R source: ALTREP_UNSERIALIZE_EX}
	 */
	AltRepUnserializeEx(info: RObjectData, _state: RObjectData, _attr: RObjectData, _objf: boolean, _levs: number): RObjectData {
		const type = (((info.cdr as RObjectData).cdr as RObjectData).car as RObjectData).type as SexpType;
		if(!AltVecSexpTypes.has(type)) {
			throw new Error('cannot unserialize this ALTREP object');
		}
		rdaLog.warn(`cannot unserialize ALTVEC object of class '${(info.car as RObjectData).name}' from package '${((info.cdr as RObjectData).car as RObjectData).name}' returning length zero vector`);
		info.type = type;
		info.value = [];
		return info;
	}

	/** Converts a linked-list based R object tree into a flat array of top-level objects, omitting payloads when `shortcut`. */
	flattenRObject(node: RObject, shortcut: boolean): RObjectData[] {
		const result: RObjectData[] = [];
		for(let n: RObject | undefined = node; n && n !== RValues.NilValue; n = n.cdr) {
			const name = (n.tag as RObjectData | undefined)?.name;
			const car = n.car as RObjectData;
			if(name !== undefined) {
				result.push(shortcut ? { name, type: car.type }
					: { name, value: car.value, hasAttribute: !!n.hasAttribute, attributes: n.attributes, type: car.type, tag: RValues.NilValue });
			}
		}
		return result;
	}
}

/** the value of the R attribute `name`, which hangs off an object as a chain of pairlist cells */
export function attributeOf(obj: RObject | undefined, name: string): RObjectData | undefined {
	for(const attribute of (typeof obj === 'object' && obj !== null ? obj.attributes : undefined) ?? []) {
		for(let cell: RObjectData | undefined = attribute; cell !== undefined; cell = cell.cdr as RObjectData | undefined) {
			if((cell.tag as RObjectData | undefined)?.name === name) {
				return cell.car as RObjectData | undefined;
			}
		}
	}
	return undefined;
}

/** the strings of a character vector, empty for anything that is not one */
export function stringsOf(obj: RObjectData | undefined): string[] {
	return obj?.type === SexpType.StrSxp && Array.isArray(obj.value) ? (obj.value as unknown[]).filter(v => typeof v === 'string') : [];
}

/** the `names` attribute of a serialized object, empty when it states none */
export function namesOf(obj: RObject | undefined): string[] {
	return stringsOf(attributeOf(obj, 'names'));
}

/** the element called `name` of a serialized named list */
export function elementOf(obj: RObject | undefined, name: string): RObject | undefined {
	const at = namesOf(obj).indexOf(name);
	const elements = typeof obj === 'object' && obj !== null ? obj.value : undefined;
	return at < 0 || !Array.isArray(elements) ? undefined : elements[at] as RObject;
}
