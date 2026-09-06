import type { FileRole, FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile } from '../../../context/flowr-file';
import fs from 'fs';
import { assertUnreachable } from '../../../../util/assert';
import { RFunTabOffsets } from './r-fun-tab';
import { RShellExecutor } from '../../../../r-bridge/shell-executor';
import { log } from '../../../../util/log';

const rdaLog = log.getSubLogger({ name: 'flowr-rda-file' });

/**
 * This decorates a text file and provides access to its content in the format of an {@link RObjectData}.
 */
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

/** the format byte a bare serialization stream opens with, before its newline */
const BareStreamFormats = new Set(['A', 'B', 'X']);

/**
 * Whether `buf` is a bare serialization stream rather than a saved workspace: an `.rds` written by `saveRDS`
 * carries no `RDX3\n` magic and no pairlist of names, it starts straight at the format byte.
 */
function isBareSerializationStream(buf: Buffer): boolean {
	return buf.length >= 2 && buf[1] === 0x0a && BareStreamFormats.has(String.fromCodePoint(buf[0]));
}

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

/**
 * Parser for RDA files.
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c | R source: serialize.c}
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c | R source: saveload.c}
 */
export class RDAParser {
	private readonly file:                 FlowrFileProvider;
	private readonly shortcut:             boolean;
	private buffer!:                       Buffer;
	private currentDepth:                  number = 0;
	private static readonly INITIAL_DEPTH: number = 1;
	private lastName:                      string | undefined = undefined;
	private offset = 0;
	private static readonly R_CODE_SET_MAX = 2 ** 6 - 1;
	private RWeakRefs:                     null | RObjectData = null;
	private static readonly SIZE_OF_DOUBLE = 2 ** 3;
	private static readonly WORD_SIZE = 2 ** 7;
	private static readonly MAX_VECTOR_LENGTH = 2 ** 16;
	private format!:                       SerializationFormat;
	private readonly refTable:             RObject[] = [];
	private Registry:                      RObjectData | null = null;

	constructor(file: FlowrFileProvider, shortcut: boolean = true) {
		this.file = file;
		this.shortcut = shortcut;
	}

	/** Decompresses, deserializes, and flattens (per the constructor's `shortcut`) the file. Answers found {@link RObjectData}s, `null` if the file is empty. */
	parse(): RObjectData[] | null {
		const result = this.parseObject();
		if(result === RValues.NilValue) {
			return null;
		} else {
			return this.flattenRObject(result, this.shortcut);
		}
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
		for(const signature of CompressionSignatures) {
			if(!startsWithMagic(buf, signature.magic) || ('zlibOnly' in signature && signature.zlibOnly && !withZlib)) {
				continue;
			} else if('unsupported' in signature) {
				throw new Error(signature.unsupported);
			}
			return signature.type;
		}
		return CompressionType.CompUnknownOrNo;
	}

	/** Decompresses `fileContent` per the {@link detectCompression} result `compressionType`. Throws error for unsupported compression types. */
	decompress(fileContent: Buffer, compressionType: CompressionType): Buffer {
		let buffer: Buffer;

		switch(compressionType) {
			case CompressionType.CompGz: {
				// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-unsafe-assignment
				const zlib = require('zlib');
				try {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
					buffer = zlib.gunzipSync(fileContent);
				} catch{
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
					buffer = zlib.inflateSync(fileContent);
				}
				break;
			}

			case CompressionType.CompBz: {
				// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-unsafe-assignment
				const bzip2 = require('bzip2');
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
				const decompressed = bzip2.simple(bzip2.array(fileContent));
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				buffer = Buffer.from(decompressed);
				break;
			}

			case CompressionType.CompXz:
			case CompressionType.CompLzma:
			case CompressionType.CompZstd:
				throw new Error(`${compressionType} is not supported yet.`);

			case CompressionType.CompUnknownOrNo:
				buffer = fileContent;
				break;
			default:
				assertUnreachable(compressionType);
		}

		return buffer;
	}

	/**
	 * Identifies the {@link SerializationTypes} of a decompressed RDA-file buffer.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L1808-L1858 | R source: R_ReadMagic}
	 */
	determineSerializationType(buf: Buffer): SerializationTypes {
		if(buf.length < 5) {
			if(buf.length === 0) {
				return SerializationTypeTag.MagicEmpty;
			} else {
				return SerializationTypeTag.MagicCorrupt;
			}
		}

		const magic = buf.toString('ascii', 0, 5);
		if(magic in SerializationMagic) {
			return SerializationMagic[magic];
		} else if(magic.startsWith('RD')) {
			return SerializationTypeTag.MagicMaybeTooNew;
		}
		/* no magic at all: the first four bytes are the version number of a pre-magic workspace */
		return Number(buf.toString('ascii', 0, 4));
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

		if(
			serializationType === SerializationTypeTag.MagicCorrupt ||
			serializationType === SerializationTypeTag.MagicEmpty   ||
			serializationType === SerializationTypeTag.MagicMaybeTooNew
		) {
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

		switch(String.fromCodePoint(this.buffer[this.offset])) {
			case 'A': this.format = SerializationFormat.Ascii; break;
			case 'B': this.format = SerializationFormat.Binary; break;
			case 'X': this.format = SerializationFormat.Xdr; break;
			case '\n':
				/* an ASCII stream may leave a trailing newline behind, so the format follows in the next two bytes */
				if(String.fromCodePoint(this.buffer[this.offset + 1]) !== 'A') {
					throw new Error('unknown input format');
				}
				this.format = SerializationFormat.Ascii;
				this.offset += 2;
				break;
			default:
				throw new Error('unknown input format');
		}

		this.offset += 2;

		const version = this.assertInteger(this.inInteger());
		const writerVersion = this.assertInteger(this.inInteger());
		const minReaderVersion = this.assertInteger(this.inInteger());

		switch(version) {
			case 2: break;
			case 3:
			{
				const neLen = this.assertInteger(this.inInteger());
				if(neLen > RDAParser.R_CODE_SET_MAX || neLen < 0)  {
					throw new Error('invalid length of encoding name');
				}
				const _nativeEncoding = this.inString(neLen);
				break;
			}
			default:
			{
				const [vw, pw, sw] = this.decodeVersion(writerVersion);
				if(minReaderVersion < 0) {
					throw new Error(`cannot read unreleased workspace version ${version} written by experimental R ${vw}.${pw}.${sw}`);
				} else {
					const [vm, pm, sm] = this.decodeVersion(minReaderVersion);
					throw new Error(`cannot read unreleased workspace version ${version} written by experimental R ${vw}.${pw}.${sw}; need R ${vm}.${pm}.${sm} or newer`);
				}
			}
		}

		return this.readItem();
	}

	/** Reads a serialized integer. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L396-L420 | R source: inInteger} */
	inInteger(): number | RValues.NaInteger {
		switch(this.format) {
			case SerializationFormat.Ascii: {
				const word = this.inWord(128);
				if(word === 'NA') {
					return RValues.NaInteger;
				}
				const i = Number.parseInt(word, 10);
				if(Number.isNaN(i)) {
					throw new TypeError(`${word} (or ${i}) is not a number`);
				}
				return i;
			}
			case SerializationFormat.Binary: {
				const i = this.buffer.readInt32LE(this.offset);
				this.offset += 4;
				return i;
			}
			case SerializationFormat.Xdr: {
				const i = this.buffer.readInt32BE(this.offset);
				this.offset += 4;
				return i;
			}
			default:
				return RValues.NaInteger;
		}
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
		let i = 0;
		let c;
		const word = new Array(size);

		do{
			c = this.inChar();
			if(c === -1) {
				throw new Error('Read character is -1.');
			}
		} while(this.isSpace(c));

		while(!this.isSpace(c) && i < size) {
			word[i++] = String.fromCodePoint(c);
			c = this.inChar();
		}
		if(i >= size) {
			throw new Error(`${i} >= ${size} when reading word.`);
		}

		return word.join('');
	}

	/** Skips an ASCII word. Mirrors {@link inWord}. Throws error on EOF or overflow past {@link RDAParser.WORD_SIZE}. */
	skipWord(): string {
		this.inWord(RDAParser.WORD_SIZE);
		return '';
	}

	/**. Answers the next character, or `-1` on EOF. */
	inChar(): number {
		if(this.offset >= this.buffer.length) {
			return -1;
		}

		const char = this.buffer[this.offset];
		this.offset++;
		return char;
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
		if(this.format === SerializationFormat.Ascii) {
			if(len > 0) {
				const result = [];

				while(this.offset < this.buffer.length) {
					const c = this.buffer[this.offset++];
					if(!this.isSpace(c)) {
						break;
					}
				}

				this.offset--;

				for(let i = 0; i < len; i++) {
					let c = String.fromCodePoint(this.buffer[this.offset++]);
					if(c === '\\') {
						c = String.fromCodePoint(this.buffer[this.offset++]);
						switch(c) {
							case 'n': result.push('\n'); break;
							case 't': result.push('\t'); break;
							case 'v': result.push('\v'); break;
							case 'b': result.push('\b'); break;
							case 'r': result.push('\r'); break;
							case 'f': result.push('\f'); break;
							case 'a': result.push('\x07'); break; // \a
							case '\\': result.push('\\'); break;
							case '?': result.push('?'); break;
							case '\'': result.push('\''); break;
							case '"': result.push('"'); break;
							case '0': case '1': case '2': case '3':
							case '4': case '5': case '6': case '7': {
								let d = 0;
								let j = 0;
								while('0' <= c && c < '8' && j < 3) {
									d = d * 8 + (Number.parseInt(c));
									c = String.fromCodePoint(this.buffer[this.offset++]);
									j++;
								}
								result.push(String.fromCodePoint(d));
								this.offset--;
								break;
							}
							default:
								result.push(c);
						}
					} else {
						result.push(c);
					}
				}
				return result.join('');
			}
			return '';
		} else {
			const bytes = this.buffer.subarray(this.offset, this.offset + len);
			this.offset += len;
			return bytes.toString('latin1');
		}
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
		const v = Math.trunc(writerVersion / RDAParser.MAX_VECTOR_LENGTH);
		writerVersion = writerVersion % RDAParser.MAX_VECTOR_LENGTH;
		const p = Math.trunc(writerVersion / 2 ** 8);
		writerVersion = writerVersion % 2 ** 8;
		const s = writerVersion;

		return [v, p, s];
	}

	/**
	 * Reads the next flags and dispatches to {@link readItemRecursive}; the main recursive entry point for every R
	 * object encountered during deserialization.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2117-L2121 | R source: ReadItem}
	 */
	readItem(): RObject {
		const flags = this.assertInteger(this.inInteger());
		return this.readItemRecursive(flags);
	}

	/** Runs `code` in R and answers an `EnvSxp`, `value` set to {@link RValues.GlobalEnv} when the result names it. Shared by {@link R_FindNamespace} and {@link R_FindNamespace1}. */
	private runNamespaceLookup(code: string): RObjectData {
		const shell = new RShellExecutor();
		const result = shell.run(code);
		shell.close();

		const val: RObjectData = { type: SexpType.EnvSxp };
		if(result === '<environment: R_GlobalEnv>') {
			val.value = RValues.GlobalEnv;
		}
		return val;
	}

	/**
	 * Resolves a namespace reference by name via `getNamespace()` in R. Simpler variant of {@link R_FindNamespace1}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/envir.c#L3795-L3804 | R source: R_FindNamespace}
	 */
	R_FindNamespace(info: RObjectData): RObjectData {
		const namespaceName = (info.value as RObjectData).name as string;
		return this.runNamespaceLookup(`getNamespace("${namespaceName}")`);
	}

	/**
	 * Resolves a serialized namespace reference by executing R at runtime. See {@link R_FindNamespace} for the result shape.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1785-L1796 | R source: R_FindNamespace1}
	 */
	R_FindNamespace1(info: RObjectData): RObjectData {
		const where = this.lastName;
		const code = `..getNamespace("${(info.value as RObjectData[])[0].name as string}", "${where as string}")`;
		return this.runNamespaceLookup(code);
	}

	/**
	 * Deserializes a single SEXP node, dispatching on its encoded {@link SexpType}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1871-L2115 | R source: ReadItem_Recursive}
	 */
	readItemRecursive(flags: number): RObjectData {
		const [type, levels, object, hasAttribute, _hasTag] = this.unpackFlags(flags);

		const special = SpecialValueSxps.get(type);
		if(special) {
			return { ...special };
		}

		let s: RObjectData;

		switch(type) {
			case SexpType.RefSxp: return this.getReadRef(this.inRefIndex(flags));
			case SexpType.PersistSxp: {
				s = this.inStringVec();
				this.addReadRef(s);
				return s;
			}
			case SexpType.AltRepSxp:
				rdaLog.warn('AltReps are not supported yet!');
				return this.readOrSkipAltRep(object, levels, false);
			case SexpType.SymSxp:
				return this.readOrSkipSym(false);
			case SexpType.PackageSxp:
			{
				s = this.inStringVec();
				s = this.rFindPackageEnv(s);
				this.addReadRef(s);
				return s;
			}
			case SexpType.NamespaceSxp:
				s = this.inStringVec();
				s = this.R_FindNamespace1(s);
				this.addReadRef(s);
				return s;
			case SexpType.EnvSxp:
				return this.readOrSkipEnv(false);
			case SexpType.ListSxp:
			case SexpType.LangSxp:
			case SexpType.CloSxp:
			case SexpType.PromSxp:
			case SexpType.DotSxp:
				return this.readItemIterative(flags);
			default:
				return this.readOrSkipLeaf(type, levels, object, hasAttribute, false);
		}
	}

	/** Reads (or with `skip`, discards) a `SymSxp` symbol. Shared by {@link readItemRecursive} and {@link skipItem}. */
	readOrSkipSym(skip: boolean): RObjectData {
		this.currentDepth++;
		const s = skip ? this.skipItem() : this.assertRObjectData(this.readItem());
		this.currentDepth--;
		s.type = SexpType.SymSxp;
		this.addReadRef(s);
		return s;
	}

	/**
	 * Reads (or with `skip`, discards) an `AltRepSxp`. Only `skip === false` attempts {@link AltRepUnserializeEx};
	 * discarding it just derives the base type its payload triple encodes. Shared by {@link readItemRecursive} and {@link skipItem}.
	 */
	readOrSkipAltRep(object: boolean, levels: number, skip: boolean): RObjectData {
		this.currentDepth++;
		const info = skip ? this.skipItem() : this.readItem() as RObjectData;
		const state = skip ? this.skipItem() : this.readItem() as RObjectData;
		const attr = skip ? this.skipItem() : this.readItem() as RObjectData;
		const s = skip ?
			{ type: (((info.cdr as RObjectData).cdr as RObjectData).car as RObjectData).type } :
			this.AltRepUnserializeEx(info, state, attr, object, levels);
		this.currentDepth--;
		return s;
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
		const s: RObjectData = { type: SexpType.EnvSxp };
		this.addReadRef(s);

		this.currentDepth++;
		this.SetEnClos(s, this.assertRObjectData(skip ? this.skipItem() : this.readItem()));
		s.frame = skip ? this.skipItem() : this.readItem();
		s.hashTab = skip ? this.skipItem() : this.readItem();
		s.attributes = this.assertRObjectData(skip ? this.skipItem() : this.readItem()).attributes;
		this.currentDepth--;

		if(!skip) {
			if(s.attributes?.some(e => e.name === RValues.ClassSymbol)) {
				s._isObject = true;
			}
			// R_RestoreHashCount(s);
			if(locked) {
				s._isLocked = false;
			}
		}
		if(!s.enClos || s.enClos === RValues.NilValue) {
			this.SetEnClos(s, {
				value:  RValues.BaseEnv,
				type:   SexpType.EnvSxp,
				enClos: RValues.NilValue
			});
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
			case SexpType.ExtPtrSxp: {
				s.type = type;
				this.addReadRef(s);
				if(!skip) {
					s.address = null;
				}
				this.currentDepth++;
				s.protected = skip ? this.skipItem() : this.readItem();
				s.tag = skip ? this.skipItem() : this.readItem();
				this.currentDepth--;
				break;
			}
			case SexpType.WeakRefSxp: {
				const nilSxp = { type: SexpType.NilSxp, value: RValues.NilValue };
				s.value = this.R_MakeWeakRef(nilSxp, RValues.NilValue, nilSxp, false);
				this.addReadRef(s);
				break;
			}
			case SexpType.SpecialSxp:
			case SexpType.BuiltInSxp: {
				const len = this.assertInteger(this.inInteger());
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
					const index = (RFunTabOffsets as Record<string, string | number>)[name] as number;
					s = this.mkPrimSxp(index, type === SexpType.BuiltInSxp ? 1 : 0);
				}
				break;
			}
			case SexpType.CharSxp: {
				const len = this.assertInteger(this.inInteger());
				if(len < -1) {
					throw new Error(`Invalid length ${len} of string.`);
				} else if(len == -1) {
					s.name = RValues.NaString;
				} else {
					s.name = this.readChar(len, levels);
				}
				break;
			}
			case SexpType.LglSxp:
			case SexpType.IntSxp: {
				const len = this.readLength();
				s.type = type;
				s.value = this.inIntegerVec(len, skip);
				break;
			}
			case SexpType.RealSxp: {
				const len = this.readLength();
				s.type = type;
				s.value = this.inRealVec(len, skip);
				break;
			}
			case SexpType.CplxSxp: {
				const len = this.readLength();
				s.type = type;
				if(skip) {
					this.inComplexVec(len, true);
				} else {
					s.value = this.inComplexVec(len);
				}
				break;
			}
			case SexpType.StrSxp:
			case SexpType.VecSxp:
			case SexpType.ExprSxp: {
				const len = this.readLength();
				s.type = type;
				this.currentDepth++;
				if(skip) {
					for(let count = 0; count < len; ++count) {
						this.skipItem();
					}
				} else {
					s.value = new Array(len);
					for(let count = 0; count < len; ++count) {
						if(type === SexpType.StrSxp) {
							this.SET_STRING_ELT(s, count, this.assertRObjectData(this.readItem()));
						} else {
							this.SET_VECTOR_ELT(s, count, this.readItem());
						}
					}
				}
				this.currentDepth--;
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
			case SexpType.RawSxp: {
				const len = this.readLength();
				s.type = type;
				if(skip) {
					this.inRaw(len, true);
				} else {
					s.value = this.inRaw(len);
				}
				break;
			}
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
		if(s.type === SexpType.CharSxp) {
			this.currentDepth++;
			if(hasAttribute) {
				if(skip) {
					this.skipItem();
				} else {
					this.readItem();
				}
			}
			this.currentDepth--;
		} else {
			this.currentDepth++;
			s.attributes = hasAttribute ? [skip ? this.skipItem() : this.assertRObjectData(this.readItem())] as RObjectData[] : undefined;
			this.currentDepth--;
		}
		if(!skip && s.type === SexpType.BcodesSxp && !this.R_BCVersionOK(s)) {
			return this.R_BytecodeExpr(s) as RObjectData;
		}
		return s;
	}

	/** Advances past a serialized SEXP node, filling in only its type. Mirrors {@link readItemRecursive}'s structure, but skips payload data. */
	skipItem(): RObjectData {
		const flags = this.assertInteger(this.inInteger());
		const [type, levels, object, hasAttribute, _hasTag] = this.unpackFlags(flags);

		const s: RObjectData = {};

		switch(type) {
			case SexpType.NilValueSxp:
			case SexpType.EmptyEnvSxp:
			case SexpType.BaseEnvSxp:
			case SexpType.GlobalEnvSxp:
			case SexpType.UnboundValueSxp:
			case SexpType.MissingArgSxp:
			case SexpType.BaseNamespaceSxp:
				s.type = SexpType.EnvSxp;
				return s;
			case SexpType.RefSxp:
				return this.getReadRef(this.inRefIndex(flags));
			case SexpType.NamespaceSxp:
				this.inStringVec(true);
				s.type = SexpType.EnvSxp;
				this.addReadRef(s);
				return s;
			case SexpType.PackageSxp:
			case SexpType.PersistSxp: {
				this.inStringVec(true);
				s.type = SexpType.CharSxp;
				return s;
			}
			case SexpType.AltRepSxp:
				return this.readOrSkipAltRep(object, levels, true);
			case SexpType.SymSxp:
				return this.readOrSkipSym(true);
			case SexpType.EnvSxp:
				return this.readOrSkipEnv(true);
			case SexpType.ListSxp:
			case SexpType.LangSxp:
			case SexpType.CloSxp:
			case SexpType.PromSxp:
			case SexpType.DotSxp:
				return this.readItemIterative(flags);
			default:
				return this.readOrSkipLeaf(type, levels, object, hasAttribute, true);
		}
	}

	/**
	 * Reads (or with `skip`, discards) `len` raw bytes into a number array.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2062-L2084 | R source: ReadItem_Recursive}
	 */
	inRaw(len: number, skip: boolean = false): number[] {
		const result: number[] = [];
		if(this.format === SerializationFormat.Ascii) {
			for(let ix = 0; ix < len; ix++) {
				if(skip) {
					this.skipWord();
				} else {
					result[ix] = Number.parseInt(this.inWord(128), 16);
				}
			}
			return result;
		}
		if(skip) {
			this.offset += len;
			return result;
		}
		for(let i = 0; i < len; i++) {
			result[i] = this.buffer[this.offset++];
		}
		return result;
	}

	/** Resolves package environments. Not implemented yet!. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/envir.c#L3732-L3741 | R source: R_FindPackageEnv} */
	rFindPackageEnv(s: RObjectData): RObjectData {
		rdaLog.warn('Resolving package environments was triggered, but is not implemented yet!');
		return s;
	}

	/** Decodes a raw SEXP flags word into `[type, levels, isObject, hasAttribute, hasTag]`. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L748-L756 | R source: UnpackFlags} */
	unpackFlags(flags: number): [number, number, boolean, boolean, boolean] {
		const pType = flags & 255;
		const pLevels = flags >> 12;
		const pIsObj = (flags & (1 << 8)) !== 0;
		const pHasAttr =  (flags & (1 << 9)) !== 0;
		const pHasTag =  (flags & (1 << 10)) !== 0;

		return [pType, pLevels, pIsObj, pHasAttr, pHasTag];
	}

	/** Retrieves the registered object at 1-based reference `index`. Throws error if out of range. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1461-L1469 | R source: GetReadRef} */
	getReadRef(index: number): RObjectData {
		const i = index - 1;

		if(i < 0 || i >= this.refTable.length) {
			throw new Error('reference index out of range');
		}
		return this.refTable[i] as RObjectData;
	}

	/**
	 * The 1-based reference index encoded in `flags`: bits 8-31 encode it directly when non-zero, otherwise it is read as the next stream integer.
	 * @see {@link http://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L782-L789 | R source: InRefIndex}
	 */
	inRefIndex(flags: number): number {
		const i = flags >> 8;
		if(i === 0) {
			return this.assertInteger(this.inInteger());
		} else {
			return i;
		}
	}

	/** Appends `value` to the reference table so it can be resolved later by {@link getReadRef}. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1471-L1490 | R source: AddReadRef} */
	addReadRef(value: RObject): void {
		this.refTable.push(value);
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
		const len = this.assertInteger(this.inInteger());
		const s: RObjectData = { type: SexpType.CharSxp };
		s.value = new Array<RObject>(skip ? 0 : len);
		this.currentDepth++;
		for(let i = 0; i < len; i++) {
			if(skip) {
				this.skipItem();
			} else {
				(s.value)[i] = this.readItem();
			}
		}
		this.currentDepth--;
		return s;
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
		let sFirst: RObjectData | null = null;
		let sLast: RObjectData = {};

		let type = flags & 255;

		if(!IterativeSexpTypes.has(type)) {
			throw new Error('Wrong type.');
		}

		while(IterativeSexpTypes.has(type)) {
			let levels: number, isObject: boolean, hasAttr: boolean, hasTag: boolean;
			[type, levels, isObject, hasAttr, hasTag] = this.unpackFlags(flags);
			const s: RObjectData = { type, levels, object: isObject };
			this.currentDepth++;

			s.attributes = hasAttr ? [this.shortcut ? this.skipItem() : this.assertRObjectData(this.readItem())] : undefined;
			s.tag = hasTag ? this.readItem() : RValues.NilValue;

			if(hasTag && this.currentDepth == RDAParser.INITIAL_DEPTH && typeof s.tag === 'object') {
				this.lastName = s.tag.name;
			}

			s.car = this.shortcut ? this.skipItem() : this.readItem();
			this.currentDepth--;

			if(sFirst === null) {
				sFirst = s;
			} else {
				sLast.cdr = s;
			}
			sLast = s;

			if(type === SexpType.CloSxp && (!s.enClos || s.cloEnv === RValues.NilValue)) {
				s.cloEnv = RValues.EmptyEnv;
			} else if(type === SexpType.PromSxp && (!s.prEnv || s.prEnv === RValues.NilValue)) {
				s.prEnv = RValues.BaseEnv;
			}

			flags = this.assertInteger(this.inInteger());
			type = flags & 255;
		}

		this.currentDepth++;
		const s = this.readItemRecursive(flags);
		this.currentDepth--;
		sLast.cdr = s;
		return sFirst as RObjectData;
	}

	/** Creates a weak reference object. Throws error if `fin` is not a function or NULL. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L1424-L1435 | R source: R_MakeWeakRef} */
	R_MakeWeakRef(key: RObjectData, val: RObject, fin: RObjectData, onexit: boolean): RObject {
		switch(fin.type) {
			case SexpType.NilSxp:
			case SexpType.CloSxp:
			case SexpType.BuiltInSxp:
			case SexpType.SpecialSxp:
				break;
			default:
				throw new Error('finalizer must be a function or NULL');
		}
		return this.newWeakRef(key, val, fin, onexit);
	}

	/** Allocates and initializes a weak reference object. Throws error if `key`'s type is invalid. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L1388-L1422 | R source: NewWeakRef} */
	newWeakRef(key: RObjectData, val: RObject, fin: RObjectData, _onexit: boolean): RObject {
		switch(key.type) {
			case SexpType.NilSxp:
			case SexpType.EnvSxp:
			case SexpType.ExtPtrSxp:
			case SexpType.BcodesSxp:
				break;
			default:
				throw new Error('can only weakly reference/finalize reference objects');
		}

		const w: RObjectData = { type: SexpType.WeakRefSxp };

		if(key.value !== RValues.NilValue) {
			w.key = key;
			w.value = val;
			w.finalizer = fin;
			w.next = this.RWeakRefs;
			// gp bitflag bookkeeping omitted: gp is never populated on a freshly built RObjectData, so it was always a no-op
			this.RWeakRefs = w;
		}
		return w;
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
		return {
			type:   evaluation ? SexpType.BuiltInSxp : SexpType.SpecialSxp,
			offset: index
		};
	}

	/**
	 * Reads `len` bytes as a character string, decoded per the encoding flags in `levels` (bit 3 UTF-8, bit 2 Latin-1,
	 * bit 1 raw bytes, bit 6 ASCII); answers `''` for a native encoding, which is not yet handled.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1689-L1759 | R source: ReadChar}
	 */
	readChar(len: number, levels: number): string {
		const cBuf = this.inString(len);
		const bytes = Buffer.from(cBuf, 'latin1');

		if(levels & (1 << 3))  {
			return new TextDecoder('utf-8').decode(bytes);
		}
		if(levels & (1 << 2)) {
			return new TextDecoder('iso-8859-1').decode(bytes);
		}
		if(levels & (1 << 1) || levels & (1 << 6)) {
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
		const len = this.assertInteger(this.inInteger());
		if(len < -1) {
			throw new Error('negative serialized length for vector');
		}
		if(len == -1) {
			const len1 = this.assertInteger(this.inInteger());
			const len2 = this.assertInteger(this.inInteger());
			/* sanity check for now */
			if(len1 > RDAParser.MAX_VECTOR_LENGTH) {
				throw new Error('invalid upper part of serialized vector length');
			}
			/* both halves are written as unsigned; a shift would wrap at 32 bit, so the high half is scaled instead */
			return len1 * 2 ** 32 + (len2 >>> 0);
		} else {
			return len;
		}
	}

	/**
	 * Reads (or with `skip`, discards) `len` integers. Throws Error for BINARY format or XDR buffer overrun.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1507-L1541 | R source: InIntegerVec}
	 */
	inIntegerVec(len: number, skip: boolean = false): (number | RValues.NaInteger)[] {
		switch(this.format) {
			case SerializationFormat.Xdr: {
				if(this.offset + 4 * len > this.buffer.length) {
					throw new Error('XDR read failed');
				}
				if(skip) {
					this.offset += 4 * len;
					return [];
				}
				const result: number[] = [];
				for(let cnt = 0; cnt < len; cnt++) {
					result[cnt] = this.buffer.readInt32BE(this.offset);
					this.offset += 4;
				}
				return result;
			}
			case SerializationFormat.Binary:
				throw new Error('No binary support yet.');
			default: {
				const result: (number | RValues.NaInteger)[] = [];
				for(let cnt = 0; cnt < len; cnt++) {
					if(skip) {
						this.skipInteger();
					} else {
						result[cnt] = this.inInteger();
					}
				}
				return skip ? [] : result;
			}
		}
	}

	/**
	 * Reads (or with `skip`, discards) `len` doubles. Throws Error for BINARY format.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1543-L1577 | R source: InRealVec}
	 */
	inRealVec(len: number, skip: boolean = false): (number | RValues)[] | null[] {
		switch(this.format) {
			case SerializationFormat.Xdr: {
				if(skip) {
					this.offset += len * RDAParser.SIZE_OF_DOUBLE;
					return [];
				}
				const result = [];
				for(let i = 0; i < len; i++) {
					result.push(this.buffer.readDoubleBE(this.offset));
					this.offset += RDAParser.SIZE_OF_DOUBLE;
				}
				return result;
			}
			case SerializationFormat.Binary:
				throw new Error('No binary support yet.');
			default: {
				const result: (Real)[] = [];
				for(let cnt = 0; cnt < len; cnt++) {
					if(skip) {
						this.inReal(true);
					} else {
						result[cnt] = this.inReal();
					}
				}
				return skip ? [] : result;
			}
		}
	}

	/**
	 * Reads (or with `skip`, discards) the next double. Throws TypeError if the ASCII token is not a valid float.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L427-L463 | R source: InReal}
	 */
	inReal(skip: boolean = false): Real {
		switch(this.format) {
			case SerializationFormat.Ascii: {
				if(skip) {
					this.skipWord();
					return RValues.NilValue;
				}
				const word = this.inWord(128);

				if(word === 'NA') {
					return RValues.NaReal;
				} else if(word === 'NaN') {
					return RValues.NaN;
				} else if(word === 'Inf') {
					return RValues.PosInf;
				} else if(word === '-Inf') {
					return RValues.NegInf;
				} else {
					const d = Number.parseFloat(word);
					if(Number.isNaN(d)) {
						throw new TypeError('Read error: Invalid numeric ASCII format');
					}
					return d;
				}
			}
			case SerializationFormat.Binary:
			case SerializationFormat.Xdr: {
				const d = skip ? RValues.NilValue :
					this.format === SerializationFormat.Binary ? this.buffer.readDoubleLE(this.offset) : this.buffer.readDoubleBE(this.offset);
				this.offset += 8;
				return d;
			}
			default:
				return RValues.NilValue;
		}
	}

	/**
	 * Reads (or with `skip`, discards) `len` complex numbers, each as two consecutive doubles via {@link inComplex}. Throws Error for BINARY format.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1579-L1616 | R source: InComplexVec}
	 */
	inComplexVec(len: number, skip: boolean = false): Complex[] {
		if(this.format === SerializationFormat.Binary) {
			throw new Error('No binary support yet.');
		}
		const result: Complex[] = [];
		for(let cnt = 0; cnt < len; cnt++) {
			result[cnt] = this.inComplex(skip);
		}
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
		if(x.type !== SexpType.VecSxp &&
			x.type !== SexpType.ExprSxp &&
			x.type !== SexpType.WeakRefSxp) {
			throw new Error(`SET_VECTOR_ELT() can only be applied to a 'list', not a '${x.type}'`);
		}
		if(i < 0 || i >= (x.value as Array<RObject>).length) {
			throw new Error(`attempt to set index ${i}/${(x.value as Array<RObject>).length} in SET_VECTOR_ELT`);
		}

		(x.value as RObject[])[i] = v;
	}

	/** Deserializes an R bytecode object. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2221-L2228 | R source: ReadBC} */
	readBC(): RObject {
		const reps: RObjectData = { type: SexpType.VecSxp, value: new Array(this.assertInteger(this.inInteger())) };
		return this.readBC1(reps);
	}

	/** Advances past a bytecode object. Mirrors {@link readBC}. */
	skipBC(): void {
		this.skipInteger();
		this.skipBC1();
	}

	/** Advances past a single bytecode. Mirrors {@link readBC1}. */
	skipBC1(): void {
		this.currentDepth++;
		this.skipItem();
		this.currentDepth--;
		this.readOrSkipBCConsts(undefined, true);
	}

	/**
	 * Registers a bytecode object after encoding.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/eval.c#L8820-L8885 | R source: R_registerBC}
	 */
	R_registerBC(_bytes: RObject, _s: RObject) {
		throw new Error('BC not implemented yet');
	}

	/** Deserializes a single bytecode object, `reps` is the repetition table shared across all constants. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2205-L2219 | R source: ReadBC1} */
	readBC1(reps: RObjectData): RObjectData {
		const s: RObjectData = { type: SexpType.BcodesSxp };
		this.currentDepth++;
		s.car = this.readItem();
		this.currentDepth--;
		// s.car = R_bcEncode(bytes);
		s.cdr = this.readOrSkipBCConsts(reps, false);
		s.tag = RValues.NilValue;
		// R_registerBC(bytes, s);
		return s;
	}

	/** Encodes bytecode instructions. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/eval.c#L8723-L8771 | R source: R_bcEncode} */
	_R_bcEncode(_bytes: Int32Array) {
		throw new Error('Not implemented');
	}

	/**
	 * Reads (or with `skip`, discards) the `n` constants of a bytecode object into a `VecSxp`, `reps` resolves `BcRepDef`/`BcRepRef`.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2173-L2203 | R source: ReadBCConsts}
	 */
	readOrSkipBCConsts(reps: RObjectData | undefined, skip: boolean): RObjectData {
		const n = this.assertInteger(this.inInteger());
		const ans: RObjectData = { type: SexpType.VecSxp, value: new Array(n) };
		for(let i = 0; i < n; i++) {
			const type = this.inInteger();
			switch(type) {
				case SexpType.BcodesSxp:
					if(skip) {
						this.skipBC1();
					} else {
						this.SET_VECTOR_ELT(ans, i, this.readBC1(reps as RObjectData));
					}
					break;
				case SexpType.LangSxp:
				case SexpType.ListSxp:
				case SexpType.BcRepDef:
				case SexpType.BcRepRef:
				case SexpType.AltLangSxp:
				case SexpType.AttrListSxp:
					if(skip) {
						this.skipBCLang(type);
					} else {
						this.SET_VECTOR_ELT(ans, i, this.ReadBCLang(type, reps as RObjectData));
					}
					break;
				default:
					this.currentDepth++;
					if(skip) {
						this.skipItem();
					} else {
						this.SET_VECTOR_ELT(ans, i, this.readItem());
					}
					this.currentDepth--;
			}
		}
		return ans;
	}

	/** Reads a single language object from bytecode constants, `reps` is the shared repetition table. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2125-L2171 | R source: ReadBCLang} */
	ReadBCLang(type: SexpType, reps: RObjectData): RObjectData {
		switch(type) {
			case SexpType.BcRepRef:
				return this.VECTOR_ELT(reps, this.assertInteger(this.inInteger())) as RObjectData;
			case SexpType.BcRepDef:
			case SexpType.LangSxp:
			case SexpType.ListSxp:
			case SexpType.AltLangSxp:
			case SexpType.AttrListSxp:
			{
				let pos = -1;
				let hasAttr = false;
				if(type == SexpType.BcRepDef) {
					pos = this.assertInteger(this.inInteger());
					type = this.assertInteger(this.inInteger());
				}
				switch(type) {
					case SexpType.AltLangSxp: type = SexpType.LangSxp; hasAttr = true; break;
					case SexpType.AttrListSxp: type = SexpType.ListSxp; hasAttr = true; break;
				}
				const ans: RObjectData = {};
				ans.type = type;
				if(pos >= 0) {
					this.SET_VECTOR_ELT(reps, pos, ans);
				}
				this.currentDepth++;
				if(hasAttr) {
					ans.attributes ??= [];
					ans.attributes.push(this.assertRObjectData(this.readItem()));
				}
				ans.tag = this.readItem();
				this.currentDepth--;
				ans.car = this.ReadBCLang(this.assertInteger(this.inInteger()), reps);
				ans.cdr = this.ReadBCLang(this.assertInteger(this.inInteger()), reps);
				return ans;
			}
			default:
			{
				this.currentDepth++;
				const res = this.readItem() as RObjectData;
				this.currentDepth--;
				return res;
			}
		}
	}

	/** Advances past a single language object. Mirrors {@link ReadBCLang}. */
	skipBCLang(type: SexpType) {
		switch(type) {
			case SexpType.BcRepRef:
				this.skipInteger();
				break;
			case SexpType.BcRepDef:
			case SexpType.LangSxp:
			case SexpType.ListSxp:
			case SexpType.AltLangSxp:
			case SexpType.AttrListSxp:
			{
				let hasAttr = false;
				if(type == SexpType.BcRepDef) {
					this.skipInteger();
					type = this.assertInteger(this.inInteger());
				}
				/* eslint-disable no-useless-assignment -- mirrors the read path */
				switch(type) {
					case SexpType.AltLangSxp: type = SexpType.LangSxp; hasAttr = true; break;
					case SexpType.AttrListSxp: type = SexpType.ListSxp; hasAttr = true; break;
				}
				/* eslint-enable no-useless-assignment */

				this.currentDepth++;
				if(hasAttr) {
					this.skipItem();
				}
				this.readItem();
				this.skipItem();
				this.currentDepth--;
				this.skipBCLang(this.assertInteger(this.inInteger()));
				this.skipBCLang(this.assertInteger(this.inInteger()));
				break;
			}
			default:
			{
				this.currentDepth++;
				this.skipItem();
				this.currentDepth--;
			}
		}
	}

	/**
	 * Retrieves the `i`-th element of a generic list or vector. Throws Error if `x` is not a list type or `i` is out of bounds.
	 * See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L4122-L4142 | R source: VECTOR_ELT}
	 */
	VECTOR_ELT(x: RObjectData,  i: number): RObject {
		if(x.type !== SexpType.VecSxp &&
			x.type !== SexpType.ExprSxp &&
			x.type !== SexpType.WeakRefSxp) {
			throw new Error(`VECTOR_ELT() can only be applied to a 'list', not a '${x.type}'`);
		}
		if(i < 0 || i >= (x.value as RObject[])?.length) {
			throw new Error('attempt access index %lld/%lld in VECTOR_ELT');
		}
		if(x.altRep) {
			const ans = (x.value as RObject[])[i];
			/* the element is marked as not mutable since complex
			   assignment can't see reference counts on any intermediate
			   containers in an ALTREP */
			// MARK_NOT_MUTABLE(ans);
			return ans;
		} else {
			return (x.value as RObject[])[i];
		}
	}

	/** Whether a {@link SexpType.BcodesSxp}'s version is within the supported range. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/eval.c#L7166-L7175 | R source: R_BCVersionOK} */
	R_BCVersionOK(s: RObjectData): boolean {
		if(s.type !== SexpType.BcodesSxp) {
			return false;
		}
		// const version = s.code;
		const version = 0;
		return version >= 9 && version <= 12;
	}

	/** Source-language expression for an unsupported bytecode object: its first constant pool entry, or {@link RValues.NilValue}. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/eval.c#L5566-L5574 | R source: bytecodeExpr} */
	R_BytecodeExpr(s: RObjectData): RObject {
		if(s.type === SexpType.BcodesSxp) {
			if(((s.cdr as RObjectData).value as RObject[])?.length > 0) {
				return this.VECTOR_ELT(s.cdr as RObjectData, 0);
			} else {
				return RValues.NilValue;
			}
		} else {
			return s;
		}
	}

	/**
	 * Attempts to unserialize an ALTREP object. Throws error if the base type is not a supported vector type.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/altrep.c#L298-L338 | R source: ALTREP_UNSERIALIZE_EX}
	 */
	AltRepUnserializeEx(info: RObjectData, _state: RObjectData, _attr: RObjectData, _objf: boolean, _levs: number): RObjectData {
		const cSym = info.car;
		const pSym = (info.cdr as RObjectData).car;
		const type = (((info.cdr as RObjectData).cdr as RObjectData).car as RObjectData).type as SexpType;

		const clss = this.ALTREP_UNSERIALIZE_CLASS(info);
		if(clss == undefined) {
			switch(type) {
				case SexpType.LglSxp:
				case SexpType.IntSxp:
				case SexpType.RealSxp:
				case SexpType.CplxSxp:
				case SexpType.StrSxp:
				case SexpType.RawSxp:
				case SexpType.VecSxp:
				case SexpType.ExprSxp:
					rdaLog.warn(`cannot unserialize ALTVEC object of class '${(cSym as RObjectData).name}'
					from package '${(pSym as RObjectData).name}' returning length zero vector`);
					info.type = type;
					info.value = [];
					return info;
				default:
					throw new Error('cannot unserialize this ALTREP object');
			}
		}
		return {};
	}

	/**
	 * The ALTREP class registered for `info`'s class/package symbol pair, `undefined` if unregistered, `null` if `info` is not a `ListSxp`.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/altrep.c#L279-L296 | R source: ALTREP_UNSERIALIZE_CLASS}
	 */
	ALTREP_UNSERIALIZE_CLASS(info: RObjectData) {
		if(info.type == SexpType.ListSxp) {
			const cSym = info.car as RObjectData;
			const  pSym = (info.cdr as RObjectData).car as RObjectData;
			let clss = this.LookupClass(cSym, pSym);
			if(clss === undefined) {
				const pName = this.ScalarString(pSym.name as string);
				try {
					this.R_FindNamespace(pName);
				} catch(e) {
					rdaLog.warn(`${pName.value as string} ${e as string}`);
				}
				clss = this.LookupClass(cSym, pSym);
			}
			return clss;
		}
		return null;
	}

	/** ALTREP class entry for `cSym`/`pSym`, `undefined` if not registered. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/altrep.c#L90-L94 | R source: LookupClass} */
	LookupClass(cSym: RObjectData, pSym: RObjectData) {
		const entry = this.LookupClassEntry(cSym, pSym);
		return entry === undefined || entry === null ? undefined : entry.car as RObjectData;
	}

	/** Searches the ALTREP class registry for an entry matching `cSym`/`pSym`. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/altrep.c#L53-L59 | R source: LookupClassEntry} */
	LookupClassEntry(cSym: RObject, pSym: RObject): RObjectData | null {
		if(!this.Registry) {
			return null;
		}

		for(let chain: RObjectData | null = (this.Registry).cdr as RObjectData || null; chain; chain = chain.cdr as RObjectData | null) {
			if((chain.car as RObjectData).tag == cSym && ((chain.car as RObjectData).cdr as RObjectData).car === pSym) {
				return chain.car as RObjectData;
			}
		}
		return null;
	}

	/** A length-1 {@link SexpType.StrSxp} character vector wrapping `x`. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/include/Rinlinedfuns.h#L1044-L1052 | R source: ScalarString} */
	ScalarString(x: string): RObjectData {
		const ans: RObjectData = { type: SexpType.StrSxp, value: new Array(1) };
		this.SET_STRING_ELT(ans, 0, { name: x });
		return ans;
	}

	/** Recomputes and restores the cached hash-table priority count for environment `s`. See {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/envir.c#L3685-L3698 | R source: R_RestoreHashCount} */
	restoreHashCount(s: RObjectData): void {
		if(s.hashTab !== RValues.NilValue) {
			const table = s.hashTab as RObjectData;
			const size = (table.value as RObject[]).length;
			let _count = 0;
			for(let i = 0; i < size; i++) {
				if(this.VECTOR_ELT(table, i) !== RValues.NilValue) {
					_count++;
				}
			}
			// SET_HASHPRI(table, count);
		}
	}

	/** Converts a linked-list based R object tree into a flat array of top-level objects, omitting payloads when `shortcut`. */
	flattenRObject(node: RObject, shortcut: boolean): RObjectData[] {
		const result: RObjectData[] = [];

		function walk(n: RObject | null) {
			if(!n || n === RValues.NilValue) {
				return;
			}
			const name = (n.tag as RObjectData)?.name;
			if(name !== undefined) {
				result.push(shortcut ? {
					name: (n.tag as RObjectData).name,
					type: (n.car as RObjectData).type,
				} : {
					name:         (n.tag as RObjectData).name,
					value:        (n.car as RObjectData).value,
					hasAttribute: !!n.hasAttribute,
					attributes:   n.attributes,
					type:         (n.car as RObjectData).type,
					tag:          RValues.NilValue
				});
			}
			if(n.cdr && n.cdr !== RValues.NilValue) {
				walk(n.cdr);
			}
		}
		walk(node);
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
