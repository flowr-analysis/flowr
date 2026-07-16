import type { FileRole, FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile } from '../../../context/flowr-file';
import fs from 'node:fs';
import { RFunTabOffsets } from './r-fun-tab';
import { RShellExecutor } from '../../../../r-bridge/shell-executor';

/**
 * This decorates a text file and provides access to its content in the format of an {@link RObject}.
 */
export class FlowrRDAFile extends FlowrFile<RObject[]> {
	private readonly wrapped:  FlowrFileProvider;
	private readonly shortcut: boolean;

	/**
	 * Prefer the static {@link FlowrRDAFile.from} method to create instances of this class as it will not re-create if already a description file
	 * and handle role assignments.
	 * @param file     - The underlying file provider whose path points to an RDA file.
	 * @param shortcut - When `true`, only top-level object names and types are
	 *                   collected during parsing. Payload data is skipped.
	 */
	constructor(file: FlowrFileProvider, shortcut: boolean = true) {
		super(file.path(), file.roles);
		this.wrapped = file;
		this.shortcut = shortcut ?? false;
	}

	/**
	 * Loads and parses the content of the wrapped file as an RDA structure.
	 * @see {@link parse} for details on the parsing logic.
	 * @returns An array of top-level {@link RObject}s or `[{}]` when the
	 *          file contains no R objects.
	 */
	protected loadContent(): RObject[] {
		return new RDAParser(this.wrapped, this.shortcut).parse() ?? [{}];
	}

	/**
	 * RDA file lifter, this does not re-create if already an RDA file.
	 * @param file - A raw {@link FlowrFileProvider} or an existing {@link FlowrRDAFile}.
	 * @param role - Optional {@link FileRole} to assign before returning.
	 * @returns The (possibly newly created) {@link FlowrRDAFile}.
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

type RObject = RValues.NilValue | RObjectData;

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

/**
 * Parser for RDA files.
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c | R source: serialize.c}
 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c | R source: saveload.c}
 */
export class RDAParser{
	private readonly file:                 FlowrFileProvider;
	private readonly shortcut:             boolean;
	private buffer!:                       Buffer;
	private currentDepth:                  number = 0;
	private static readonly INITIAL_DEPTH: number = 1;
	private lastName:                      string | undefined = undefined;
	private setLastName = false;
	private offset = 0;
	private static readonly R_CODE_SET_MAX = 2 ** 6 - 1;
	private RWeakRefs:                     null | RObjectData = null;
	private static readonly CHUNK_SIZE = 8906;
	private static readonly SIZE_OF_DOUBLE = 2 ** 3;
	private static readonly WORD_SIZE = 2 ** 7;
	private static readonly MAX_VECTOR_LENGTH = 2 ** 16;
	private format!:                       SerializationFormat;
	private readonly refTable:             RObject[] = [];
	private Registry:                      RObjectData | null = null;


	private opinfo = {
		addr:     null,
		argc:     null,
		instName: null
	};

	constructor(file: FlowrFileProvider, shortcut: boolean = true) {
		this.file = file;
		this.shortcut = shortcut ?? true;
	}

	/**
	 * Parses an RDA file.
	 *
	 * The file is decompressed, deserialized and converted into a flattened
	 * object representation.
	 * @param file - RDA file provider.
	 * @param shortcut - When `true`, only names and types are collected.
	 * @returns List of found {@link RObjectData} or `null` if the file is empty.
	 */
	parse(): RObjectData[] | null {
		const fileContent = fs.readFileSync(this.file.path());
		const compressionType = this.detectCompression(fileContent);
		this.buffer = this.decompress(fileContent, compressionType);
		const result = this.deserialize2();
		if(result === RValues.NilValue) {
			return null;
		} else {
			return this.flattenRObject(result, this.shortcut);
		}
	}

	/**
	 * Detects the compression algorithm used for an RDA file.
	 * @param buf - Raw file buffer.
	 * @param with_zlib - Whether zlib headers should also be considered.
	 * @returns Detected {@link CompressionType}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/connections.c#L2675-L2710 | R source: comp_type_from_memory}
	 */
	detectCompression(buf: Buffer, with_zlib: boolean = false): CompressionType {
		if(buf.length >= 2 && buf[0] == 0x1f && buf[1] == 0x8b) {
			return CompressionType.CompGz;
		}
		if(with_zlib && buf.length >= 2 && buf[0] == 0x78 && buf[1] == 0x9c){
			return CompressionType.CompGz;
		}
		if(buf.length >= 10 && buf[0] === 0x42 && buf[1] === 0x5a && buf[2] === 0x68) {
			if(buf[3] >= 0x31 && buf[3] <= 0x39) {
				const magic1 = [0x31, 0x41, 0x59, 0x26, 0x53, 0x59];
				const magic2 = [0x17, 0x72, 0x45, 0x38, 0x50, 0x90];
				const isMagic1 = magic1.every((v, i) => buf[4 + i] === v);
				const isMagic2 = magic2.every((v, i) => buf[4 + i] === v);

				if(isMagic1 || isMagic2) {
					return CompressionType.CompBz;
				}
			}
		}

		if(buf.length >= 4){
			if(buf.length >= 4 && buf[0] == 0x89 && buf[1] === 0x4c && buf[2] === 0x5a && buf[3] === 0x4f) {
				throw new Error('this is a lzop-compressed file which this build of R does not support');
			} else if(buf.length >= 4 && buf[0] === 0x28 && buf[1] === 0xB5 && buf[2] === 0x2F && buf[3] === 0xFD) {
				return CompressionType.CompZstd;
			}
		}

		if(buf.length >= 5) {
			if(buf[0] === 0xFD && buf[1] === 0x37 && buf[2] === 0x7a && buf[3] === 0x58 && buf[4] === 0x5a) {
				return CompressionType.CompXz;
			} else if(buf[0] === 0xFF && buf[1] === 0x4C && buf[2] === 0x5A && buf[3] === 0x4D && buf[4] === 0x41) {
				return CompressionType.CompLzma;
			} else if(buf[0] === 0x5D && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x80 && buf[4] === 0x00) {
				return CompressionType.CompLzma;
			}
		}

		return CompressionType.CompUnknownOrNo;
	}

	/**
	 * Decompresses the given RDA file buffer.
	 * @param fileContent - Raw compressed file buffer.
	 * @param compressionType - {@link CompressionType} as returned by {@link detectCompression}.
	 * @returns Decompressed buffer.
	 * @throws Error for unsupported compression types.
	 */
	decompress(fileContent: Buffer, compressionType: CompressionType): Buffer {
		let buffer: Buffer;

		switch(compressionType) {
			case CompressionType.CompGz: {
				// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-unsafe-assignment
				const zlib = require('node:zlib');
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
			case CompressionType.CompZstd: {
				throw new Error(compressionType + 'not supported yet.');
			}

			case CompressionType.CompUnknownOrNo:
				buffer = fileContent;
				break;
			default:
				throw new Error('Unknown or unsupported compression type.');
		}

		return buffer;
	}

	/**
	 * Detects the serialization type used for the RDA-file.
	 * @param buf - Buffer with decompressed RDA-file content
	 * @returns The identified {@link SerializationTypes} of decompressed RDA-file
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
		switch(magic) {
			case 'RDA1\n':
				return SerializationTypeTag.MagicAsciiV1;
			case 'RDB1\n':
				return SerializationTypeTag.MagicBinaryV1;
			case 'RDX1\n':
				return SerializationTypeTag.MagicXdrV1;
			case 'RDA2\n':
				return SerializationTypeTag.MagicAsciiV2;
			case 'RDB2\n':
				return SerializationTypeTag.MagicBinaryV2;
			case 'RDX2\n':
				return SerializationTypeTag.MagicXdrV2;
			case 'RDA3\n':
				return SerializationTypeTag.MagicAsciiV3;
			case 'RDB3\n':
				return SerializationTypeTag.MagicBinaryV3;
			case 'RDX3\n':
				return SerializationTypeTag.MagicXdrV3;
		}

		if(magic.startsWith('RD')) {
			return SerializationTypeTag.MagicMaybeTooNew;
		}

		return Number(buf.toString('ascii', 0, 4));
	}

	/**
	 * Deserializes a decompressed RDA-file.
	 * @returns Deserialized RDA-file as {@link RObject} or {@link RValues.NilValue}, if the deserialization fails
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L1923-L1972 | R source: R_LoadFromFile}
	 */
	deserialize2(): RObject{
		this.offset = 0;
		const serializationType = this.determineSerializationType(this.buffer);
		this.offset += 5;

		if(
			serializationType === undefined         ||
			serializationType === 'R_MAGIC_CORRUPT' ||
			serializationType === 'R_MAGIC_EMPTY'   ||
			serializationType === 'R_MAGIC_MAYBE_TOONEW'
		) {
			throw new Error('Could not determine serialization type');
		}

		if(
			serializationType === 'R_MAGIC_ASCII_V2'  ||
			serializationType === 'R_MAGIC_ASCII_V3'  ||
			serializationType === 'R_MAGIC_XDR_V2'    ||
			serializationType === 'R_MAGIC_XDR_V3'    ||
			serializationType === 'R_MAGIC_BINARY_V2' ||
			serializationType === 'R_MAGIC_BINARY_V3'
		) {
			const result = this.deserialize();
			this.currentDepth--;
			return result;
		}
		if(
			serializationType === 'R_MAGIC_ASCII_V1' ||
			serializationType === 'R_MAGIC_XDR_V1'   ||
			serializationType === 'R_MAGIC_BINARY_V1'
		){
			// https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L2157-L2196
			console.warn('Version one rda files are not supported yet');
		}
		return RValues.NilValue;
	}

	/**
	 * Deserializes a decompressed RDA-file.
	 * @returns Deserialized RDA-file as {@link RObject}
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2237-L2292 | R source: R_Unserialize}
	 */
	deserialize(): RObject {

		switch(String.fromCodePoint(this.buffer[this.offset])) {
			case 'A': this.format = SerializationFormat.Ascii; break;
			case 'B': this.format = SerializationFormat.Binary; break;
			case 'X': this.format = SerializationFormat.Xdr; break;
			case '\n':
				if(String.fromCodePoint(this.buffer[this.offset + 1]) === 'A') {
					this.format = SerializationFormat.Ascii;
					this.offset += 1;
				}
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

	/**
	 * Reads a serialized integer value from the current buffer position.
	 * @returns Parsed integer value or {@link RValues.NaInteger}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L396-L420 | R source: inInteger}
	 */
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
			case SerializationFormat.Xdr:{
				const i = this.buffer.readInt32BE(this.offset);
				this.offset += 4;
				return i;
			}
			default:
				return RValues.NaInteger;
		}
	}

	/**
	 * Advances the buffer offset past a serialized integer value.
	 *
	 * Mirrors {@link inInteger}.
	 */
	skipInteger(): void {
		if(this.format === SerializationFormat.Ascii) {
			this.skipWord();
		} else if(this.format === SerializationFormat.Binary || this.format === SerializationFormat.Xdr) {
			this.offset += 4;
		} else {
			return;
		}
	}

	/**
	 * Ensures that the given value is not {@link RValues.NaInteger}.
	 * @param value - Integer value to be tested.
	 * @returns The validated integer value.
	 * @throws Error if the value equals `RValues.NaInteger`.
	 */
	assertInteger(value: number | RValues.NaInteger): number {
		if(value === RValues.NaInteger) {
			throw new Error('Unexpected NA integer');
		}
		return value;
	}

	/**
	 * Ensures that the given object is not {@link RValues.NilValue}.
	 * @param obj - R object to validate.
	 * @returns The validated {@link RObjectData}.
	 * @throws Error if the object equals {@link RValues.NilValue}.
	 */
	assertRObjectData(obj: RObject): RObjectData {
		if(obj === RValues.NilValue) {
			throw new Error('Unexpected NilValue');
		}
		return obj;
	}

	/**
	 * Reads an ASCII word from the input buffer.
	 * @param size - Maximum allowed word size.
	 * @returns The parsed word.
	 * @throws Error if EOF is reached or the word exceeds the allowed size.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L378-L394 | R source: inWord}
	 */
	inWord(size: number): string {
		let i = 0;
		let c;
		const word = new Array(size);

		do{
			c = this.inChar();
			if(c === -1){
				throw new Error('Read character is -1.');
			}
		} while(this.isSpace(c));

		while(!this.isSpace(c) && i < size) {
			word[i++] = String.fromCodePoint(c);
			c = this.inChar();
		}
		if(i >= size) {
			throw new Error(`$\{i} >= ${size} when reading word.`);
		}

		return word.join('');
	}

	/**
	 * Skips an ASCII word in the input buffer.
	 *
	 * Mirrors {@link inWord}
	 * @returns An empty string.
	 * @throws Error if EOF is reached or the word exceeds {@link RDAParser.WORD_SIZE}.
	 */
	skipWord(): string {
		let c;
		let i = 0;

		do{
			c = this.inChar();
			if(c === -1){
				throw new Error('Read character is -1.');
			}
		} while(this.isSpace(c));

		while(!this.isSpace(c) && i < RDAParser.WORD_SIZE) {
			i++;
			c = this.inChar();
		}
		if(i >= RDAParser.WORD_SIZE) {
			throw new Error(`$\{i} >= ${RDAParser.WORD_SIZE} when reading word.`);
		}

		return '';
	}

	/**
	 * Reads the next character from the input buffer.
	 * @returns The next character or `-1` on EOF.
	 */
	inChar(): number {
		if(this.offset >= this.buffer.length) {
			return -1;
		}

		const char = this.buffer[this.offset];
		this.offset++;
		return char;
	}

	/**
	 * Checks whether the given byte represents a whitespace character.
	 * @param c - Character code to check.
	 * @returns `true` if the character is whitespace.
	 */
	isSpace(c: number): boolean {
		return c >= 9 && c <= 13 || c === 32;
	}

	/**
	 * Reads a serialized string from the buffer.
	 * @param len - Length of the serialized string.
	 * @returns Decoded string.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L505-L550 | R source: inString}
	 */
	inString(len: number): string {
		if(this.format === SerializationFormat.Ascii) {
			if(len > 0){
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
					if(c === '\\'){
						c = String.fromCodePoint(this.buffer[this.offset++]);
						switch(c){
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

	/**
	 * Skips a serialized string depending on the current serialization format.
	 *
	 * Mirrors {@link inString}
	 * @param len - Length of the serialized string.
	 */
	skipString(len: number): void {
		if(this.format === SerializationFormat.Ascii) {
			if(len > 0){
				while(this.offset < this.buffer.length) {
					const c = this.buffer[this.offset++];
					if(!this.isSpace(c)) {
						break;
					}
				}

				this.offset--;

				for(let i = 0; i < len; i++) {
					let c = String.fromCodePoint(this.buffer[this.offset++]);
					if(c === '\\'){
						c = String.fromCodePoint(this.buffer[this.offset++]);
						switch(c){
							case '0': case '1': case '2': case '3':
							case '4': case '5': case '6': case '7': {
								let j = 0;
								while('0' <= c && c < '8' && j < 3) {
									c = String.fromCodePoint(this.buffer[this.offset++]);
									j++;
								}
								this.offset--;
								break;
							}
						}
					}
				}
			}
		} else {
			this.offset += len;
		}
	}

	/**
	 * Decodes an R writer version integer into v, p, and s.
	 * @param writerVersion - Encoded writer version.
	 * @returns Tuple containing version components `[v,p,s]`.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2230-L2235 | R source: decodeVersion}
	 */
	decodeVersion(writerVersion: number): number[] {
		const v = writerVersion / RDAParser.MAX_VECTOR_LENGTH;
		writerVersion = writerVersion % RDAParser.MAX_VECTOR_LENGTH;
		const p = writerVersion / 2 ** 8;
		writerVersion = writerVersion % 2 ** 8;
		const s = writerVersion;

		return [v, p, s];
	}

	/**
	 * Reads the next flags and dispatches to {@link readItemRecursive}.
	 * This is the main recursive entry point called for every R object encountered
	 * during deserialization.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2117-L2121 | R source: ReadItem}
	 */
	readItem(): RObject {
		const flags = this.assertInteger(this.inInteger());
		return this.readItemRecursive(flags);
	}

	/**
	 * Resolves a namespace reference by name using `getNamespace()` in R.
	 * Simpler variant of {@link R_FindNamespace1}.
	 * @param info - The {@link RObjectData} holding the namespace/package info.
	 * @returns An {@link RObjectData} of type {@link SexpType.EnvSxp} whose
	 *          `value` is set to the resolved environment. Currently only
	 *          `R_GlobalEnv` is handled; other results are logged as warnings.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/envir.c#L3795-L3804 | R source: R_FindNamespace}
	 */
	R_FindNamespace(info: RObjectData): RObjectData {
		const namespaceName = (info.value as RObjectData).name as string;

		const code = `getNamespace("${namespaceName}")`;
		const shell = new RShellExecutor();
		const result = shell.run(code);
		shell.close();

		const val: RObjectData = {};
		val.type = SexpType.EnvSxp;

		if(result === '<environment: R_GlobalEnv>') {
			val.value = RValues.GlobalEnv;
		}

		return val;
	}

	/**
	 * Resolves a serialized namespace reference by executing R at runtime.
	 * @param info - The {@link RObjectData} holding the namespace/package info.
	 * @returns An {@link RObjectData} of type {@link SexpType.EnvSxp} whose
	 *          `value` is set to the resolved environment. Currently only
	 *          `R_GlobalEnv` is handled; other results are logged as warnings.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1785-L1796 | R source: R_FindNamespace1}
	 */
	R_FindNamespace1(info: RObjectData): RObjectData {
		const where: RObjectData = {};
		where.type = SexpType.CharSxp;
		where.value = this.lastName;
		const code = `..getNamespace("${(info.value as RObjectData[])[0].name as string}", "${where.value as string}")`;
		const shell = new RShellExecutor();
		const result = shell.run(code);
		shell.close();
		const val: RObjectData = {};
		val.type = SexpType.EnvSxp;
		if(result == '<environment: R_GlobalEnv>') {
			val.value = RValues.GlobalEnv;
		}
		return val;
	}

	/**
	 * Deserializes a single SEXP node recursively.
	 *
	 * The method dispatches to the corresponding deserialization logic
	 * depending on the encoded {@link SexpType}.
	 * @param flags - Serialized SEXP flags word.
	 * @returns Deserialized {@link RObjectData}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1871-L2115 | R source: ReadItem_Recursive}
	 */
	readItemRecursive(flags: number): RObjectData {
		const [type, levels, object, hasAttribute, _hasTag] = this.unpackFlags(flags);

		let s: RObjectData = {};

		switch(type) {
			case SexpType.NilValueSxp:
				s.value = RValues.NilValue;
				s.type = SexpType.NilSxp;
				return s;
			case SexpType.EmptyEnvSxp:
				s.value = RValues.EmptyEnv;
				s.type = SexpType.EnvSxp;
				return s;
			case SexpType.BaseEnvSxp:
				s.value = RValues.BaseEnv;
				s.type = SexpType.EnvSxp;
				return s;
			case SexpType.GlobalEnvSxp:
				s.value = RValues.GlobalEnv;
				s.type = SexpType.EnvSxp;
				return s;
			case SexpType.UnboundValueSxp:
				s.value = RValues.UnboundValue;
				s.type = SexpType.EnvSxp;
				return s;
			case SexpType.MissingArgSxp:
				s.value = RValues.MissingArg;
				s.type = SexpType.EnvSxp;
				return s;
			case SexpType.BaseNamespaceSxp:
				s.value = RValues.BaseNamespace;
				s.type = SexpType.EnvSxp;
				return s;
			case SexpType.RefSxp: return this.getReadRef(this.inRefIndex(flags));
			case SexpType.PersistSxp: {
				s = this.inStringVec();
				this.addReadRef(s);
				return s;
			}
			case SexpType.AltRepSxp:
			{
				this.currentDepth++;
				console.warn('AltReps are not supported yet!');
				const info = this.readItem() as RObjectData;
				const state = this.readItem() as RObjectData;
				const attr = this.readItem() as RObjectData;
				s.type = (((info.cdr as RObjectData).cdr as RObjectData).car as RObjectData).type as SexpType;
				s = this.AltRepUnserializeEx(info, state, attr, object, levels);
				this.currentDepth--;
				return s;
			}
			case SexpType.SymSxp: {
				this.currentDepth++;
				s = this.assertRObjectData(this.readItem());
				this.currentDepth--;
				s.type = SexpType.SymSxp;
				this.addReadRef(s);
				return s;
			}
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
			{
				const locked = this.inInteger();
				s.type = SexpType.EnvSxp;
				this.addReadRef(s);

				this.currentDepth++;
				this.SetEnClos(s, this.assertRObjectData(this.readItem()));
				s.frame = this.readItem();
				s.hashTab = this.readItem();
				s.attributes = this.assertRObjectData(this.readItem()).attributes;

				this.currentDepth--;

				if(s.attributes?.some(e => e.name === RValues.ClassSymbol)){
					s._isObject = true;
				}
				// R_RestoreHashCount(s);
				if(locked) {
					s._isLocked = false;
				}
				if(!s.enClos || s.enClos === RValues.NilValue) {
					this.SetEnClos(s, {
						value:  RValues.BaseEnv,
						type:   SexpType.EnvSxp,
						enClos: RValues.NilValue
					} as RObjectData);
				}
				return s;
			}
			case SexpType.ListSxp:
			case SexpType.LangSxp:
			case SexpType.CloSxp:
			case SexpType.PromSxp:
			case SexpType.DotSxp:
				return this.readItemIterative(flags);
			default:
				switch(type) {
					case SexpType.ExtPtrSxp: {
						s.type = type;
						this.addReadRef(s);
						s.address = null;
						this.currentDepth++;
						s.protected = this.readItem();
						s.tag = this.readItem();
						this.currentDepth--;
						break;
					}
					case SexpType.WeakRefSxp:
						s.value = this.R_MakeWeakRef(
							{ type: SexpType.NilSxp, value: RValues.NilValue } as RObjectData,
							RValues.NilValue,
							{ type: SexpType.NilSxp, value: RValues.NilValue } as RObjectData,
							false);
						this.addReadRef(s);
						break;
					case SexpType.SpecialSxp:
					case SexpType.BuiltInSxp:
						{
							const len = this.assertInteger(this.inInteger());
							if(len < 0) {
								throw new Error('invalid length');
							}
							const name = this.inString(len);
							const index = (RFunTabOffsets as Record<string, string | number>)[name] as number;
							if(name in RFunTabOffsets) {
								s = this.mkPrimSxp(index, type === SexpType.BuiltInSxp ? 1 : 0);
							} else {
								s.value = RValues.NilValue;
								throw new Error(`unrecognized internal function name "${name}"`);
							}
						}
						break;
					case SexpType.CharSxp: {
						const len = this.assertInteger(this.inInteger());
						if(len < -1) {
							throw new Error(`Invalid length ${len} of string.`);
						} else if(len == -1) {
							s.name = RValues.NaString;
						} else if(len < 1000) {
							s.name = this.readChar(len, levels);
						} else {
							s.name = this.readChar(len, levels);
						}
						break;
					}
					case SexpType.LglSxp:
					case SexpType.IntSxp:
					{
						const len = this.readLength();
						s.type = type;
						s.value = this.inIntegerVec(len);
						break;
					}
					case SexpType.RealSxp:
					{
						const len = this.readLength();
						s.type = type;
						s.value = this.inRealVec(len);
						break;
					}
					case SexpType.CplxSxp: {
						const len = this.readLength();
						s.type = type;
						s.value = this.inComplexVec(len);
						break;
					}
					case SexpType.StrSxp: {
						const len = this.readLength();
						s.type = type;
						s.value = new Array(len);
						this.currentDepth++;
						for(let count = 0; count < len; ++count) {
							this.SET_STRING_ELT(s, count, this.assertRObjectData(this.readItem()));
						}
						this.currentDepth--;

						break;
					}
					case SexpType.VecSxp:
					case SexpType.ExprSxp: {
						const len = this.readLength();
						s.type = type;
						s.value = new Array(len);
						this.currentDepth++;
						for(let count = 0; count < len; ++count) {
							this.SET_VECTOR_ELT(s, count, this.readItem());
						}
						this.currentDepth--;
						break;
					}
					case SexpType.BcodesSxp:
						s = this.readBC() as RObjectData;
						break;
					case SexpType.ClassRefSxp:
						throw new Error('this version of R cannot read class references');
					case SexpType.GenericRefSxp:
						throw new Error('this version of R cannot read generic function references');
					case SexpType.RawSxp: {
						const len = this.readLength();
						s.type = type;
						s.value = this.inRaw(len);
						break;
					}
					case SexpType.ObjSxp:
						s.type = SexpType.ObjSxp;
						break;
					default:
						throw new Error(`ReadItem: unknown type ${type}, perhaps written by later version of R`);
				}
				if(type !== SexpType.CharSxp) {
					s.levels = levels;
				}
				s.object = object;
				if(s.type === SexpType.CharSxp) {
					this.currentDepth++;
					if(hasAttribute) {
						this.readItem();
					}
					this.currentDepth--;
				} else {
					this.currentDepth++;
					s.attributes = hasAttribute ? [this.readItem()] as RObjectData[] : undefined;
					this.currentDepth--;
				}
				if(s.type === SexpType.BcodesSxp && !this.R_BCVersionOK(s)) {
					return this.R_BytecodeExpr(s) as RObjectData;
				}
				return s;
		}
	}

	/**
	 * Skips a serialized SEXP node, only filling in its type and calling other skip methods to
	 * advance the buffer position.
	 *
	 * Mirrors the structure of {@link readItemRecursive} but skips payload data.
	 * @returns A minimal {@link RObjectData} with little to no payload.
	 */
	skipItem(): RObjectData {
		const flags = this.assertInteger(this.inInteger());
		const [type, levels, _object, hasAttribute, _hasTag] = this.unpackFlags(flags);

		let s: RObjectData = {};

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
				this.skipStringVec();
				s.type = SexpType.EnvSxp;
				this.addReadRef(s);
				return s;
			case SexpType.PackageSxp:
			case SexpType.PersistSxp: {
				this.skipStringVec();
				s.type = SexpType.CharSxp;
				return s;
			}
			case SexpType.AltRepSxp:
			{
				this.currentDepth++;
				const info = this.skipItem();
				const _state = this.skipItem();
				const _attr = this.skipItem();

				s.type = (((info.cdr as RObjectData).cdr as RObjectData).car as RObjectData).type as SexpType;
				this.currentDepth--;
				return s;
			}
			case SexpType.SymSxp: {
				this.currentDepth++;
				s = this.skipItem();
				this.currentDepth--;
				s.type = SexpType.SymSxp;
				this.addReadRef(s);
				return s;
			}
			case SexpType.EnvSxp:
			{
				this.skipInteger();
				s.type = SexpType.EnvSxp;
				this.addReadRef(s);

				this.currentDepth++;
				this.SetEnClos(s, this.assertRObjectData(this.skipItem()));
				s.frame = this.skipItem();
				s.hashTab = this.skipItem();
				s.attributes = this.assertRObjectData(this.skipItem()).attributes;

				this.currentDepth--;

				if(!s.enClos || s.enClos === RValues.NilValue) {
					this.SetEnClos(s, {
						value:  RValues.BaseEnv,
						type:   SexpType.EnvSxp,
						enClos: RValues.NilValue
					} as RObjectData);
				}
				return s;
			}
			case SexpType.ListSxp:
			case SexpType.LangSxp:
			case SexpType.CloSxp:
			case SexpType.PromSxp:
			case SexpType.DotSxp:
				return this.readItemIterative(flags);
			default:
				switch(type) {
					case SexpType.ExtPtrSxp: {
						s.type = type;
						this.addReadRef(s);
						this.currentDepth++;
						s.protected = this.skipItem();
						s.tag = this.skipItem();
						this.currentDepth--;
						break;
					}
					case SexpType.WeakRefSxp:
						s.value = this.R_MakeWeakRef(
							{ type: SexpType.NilSxp, value: RValues.NilValue } as RObjectData,
							RValues.NilValue,
							{ type: SexpType.NilSxp, value: RValues.NilValue } as RObjectData,
							false);
						this.addReadRef(s);
						break;
					case SexpType.SpecialSxp:
					case SexpType.BuiltInSxp:
						{
							s.type = type;
							const len = this.assertInteger(this.inInteger());
							if(len < 0) {
								throw new Error('invalid length');
							}
							this.skipString(len);
						}
						break;
					case SexpType.CharSxp: {
						const len = this.assertInteger(this.inInteger());
						if(len < -1) {
							throw new Error(`Invalid length ${len} of string.`);
						} else if(len == -1) {
							s.name = RValues.NaString;
						} else if(len < 1000) {
							s.name = this.readChar(len, levels);
						} else {
							s.name = this.readChar(len, levels);
						}
						break;
					}
					case SexpType.LglSxp:
					case SexpType.IntSxp:
					{
						const len = this.readLength();
						s.type = type;
						s.value = this.skipIntegerVec(len);
						break;
					}
					case SexpType.RealSxp:
					{
						const len = this.readLength();
						s.type = type;
						s.value = this.skipRealVec(len);
						break;
					}
					case SexpType.CplxSxp: {
						const len = this.readLength();
						s.type = type;
						this.skipComplexVec(len);
						break;
					}
					case SexpType.StrSxp:
					case SexpType.VecSxp:
					case SexpType.ExprSxp: {
						const len = this.readLength();
						s.type = type;
						this.currentDepth++;
						for(let count = 0; count < len; ++count) {
							this.skipItem();
						}
						this.currentDepth--;
						break;
					}
					case SexpType.BcodesSxp:
						this.skipBC();
						s.type = SexpType.VecSxp;
						break;
					case SexpType.ClassRefSxp:
						throw new Error('this version of R cannot read class references');
					case SexpType.GenericRefSxp:
						throw new Error('this version of R cannot read generic function references');
					case SexpType.RawSxp: {
						const len = this.readLength();
						s.type = type;
						this.skipRaw(len);
						break;
					}
					case SexpType.ObjSxp:
						s.type = SexpType.ObjSxp;
						break;
					default:
						throw new Error(`ReadItem: unknown type ${type}, perhaps written by later version of R`);
				}
				if(s.type === SexpType.CharSxp) {
					this.currentDepth++;
					if(hasAttribute) {
						this.skipItem();
					}
					this.currentDepth--;
				} else {
					this.currentDepth++;
					s.attributes = hasAttribute ? [this.skipItem()] : undefined;
					this.currentDepth--;
				}
				return s;
		}
	}

	/**
	 * Reads `len` raw bytes from the buffer into a number array.
	 * @param len - Number of raw bytes to read.
	 * @returns Array of unsigned byte values.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2062-L2084 | R source: ReadItem_Recursive}
	 */
	inRaw(len: number): number[]{
		const result = [];
		switch(this.format) {
			case SerializationFormat.Ascii:
				for(let ix = 0; ix < len; ix++) {
					const word = this.inWord(128);
					result[ix] = Number.parseInt(word, 16);
				}
				break;
			default: {
				let t = 0;
				for(let done = 0; done < len; done += t) {
					t = Math.min(RDAParser.CHUNK_SIZE, len - done);
					for(let i = 0; i < t; i++) {
						result[done + i] = this.buffer[this.offset];
						this.offset += 1;
					}
				}
			}
		}
		return result;
	}

	/**
	 * Advances the buffer offset past `len` raw bytes without reading values.
	 *
	 * Mirrors {@link inRaw}.
	 * @param len - Number of raw bytes to skip.
	 */
	skipRaw(len: number): void{
		if(this.format === SerializationFormat.Ascii) {
			for(let ix = 0; ix < len; ix++) {
				this.skipWord();
			}
		} else {
			let t = 0;
			for(let done = 0; done < len; done += t) {
				t = Math.min(RDAParser.CHUNK_SIZE, len - done);
				for(let i = 0; i < t; i++) {
					this.offset += 1;
				}
			}
		}
	}

	/**
	 * Resolves package environments.
	 * @param s - String-vec {@link RObject} identifying the package.
	 *
	 * Not implemented yet!
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/envir.c#L3732-L3741 | R source: R_FindPackageEnv}
	 */
	rFindPackageEnv(s: RObjectData): RObjectData {
		console.warn('Resolving package environments was triggered, but is not implemented yet!');
		return s;
	}

	/**
	 * Decodes the SEXP flags.
	 * @param flags - Raw 32-bit flags word.
	 * @returns `[type, levels, isObject, hasAttribute, hasTag]`.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L748-L756 | R source: UnpackFlags}
	 */
	unpackFlags(flags: number): [number, number, boolean, boolean, boolean] {
		const pType = flags & 255;
		const pLevels = flags >> 12;
		const pIsObj = (flags & (1 << 8)) !== 0;
		const pHasAttr =  (flags & (1 << 9)) !== 0;
		const pHasTag =  (flags & (1 << 10)) !== 0;

		return [pType, pLevels, pIsObj, pHasAttr, pHasTag];
	}

	/**
	 * Retrieves an object from the reference table.
	 * @param index - 1-based reference index.
	 * @returns A registered {@link RObjectData}.
	 * @throws Error if the index is out of range.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1461-L1469 | R source: GetReadRef}
	 */
	getReadRef(index: number): RObjectData {
		const i = index - 1;

		if(i < 0 || i >= this.refTable.length) {
			throw new Error('reference index out of range');
		}
		return this.refTable[i] as RObjectData;
	}

	/**
	 * Extracts the reference index from the given flags.
	 *
	 * When bits 8–31 are non-zero they encode the index directly;
	 * otherwise the index is read as the next integer from the stream.
	 * @param flags - Raw 32-bit flags word.
	 * @returns A 1-based reference index.
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

	/**
	 * Appends an object to the reference table so it can be resolved later by {@link getReadRef}.
	 * @param value - The {@link RObject} to register.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1471-L1490 | R source: AddReadRef}
	 */
	addReadRef(value: RObject): void {
		this.refTable.push(value);
	}

	/**
	 * Reads a persistent string vector from the stream.
	 * @returns An {@link RObjectData} of type `CharSxp` whose `value` array holds the deserialized string items.
	 * @throws Error if the names flag is non-zero.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1492-L1504 | R source: InStringVec}
	 */
	inStringVec(): RObjectData {
		if(this.inInteger() !== 0) {
			throw new Error('names in persistent strings are not supported yet');
		}
		const len = this.assertInteger(this.inInteger());
		const s: RObjectData = {};
		s.type = SexpType.CharSxp;
		s.value = new Array<RObject>(len);
		this.currentDepth++;
		for(let i = 0; i < len; i++) {
			(s.value)[i] = this.readItem();
		}
		this.currentDepth--;
		return s;
	}

	/**
	 * Advances the buffer past a persistent string vector without reading values.
	 *
	 * Mirrors {@link inStringVec}.
	 * @throws Error if the names flag is non-zero.
	 */
	skipStringVec(): void {
		if(this.inInteger() !== 0) {
			throw new Error('names in persistent strings are not supported yet');
		}
		const len = this.assertInteger(this.inInteger());
		this.currentDepth++;
		for(let i = 0; i < len; i++) {
			this.skipItem();
		}
		this.currentDepth--;
	}

	/**
	 * Sets the enclosing environment of an environment object.
	 * @param x - Environment whose enclosure should be set.
	 * @param v - Parent environment.
	 * @throws Error if the parent is invalid or would introduce a cycle.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L4677-L4690 | R source: SET_ENCLOS}
	 */
	SetEnClos(x: RObjectData, v: RObjectData): void {
		if(v.value === undefined || v.value === RValues.NilValue) {
			v.value = RValues.EmptyEnv;
		}
		if(v.type !== SexpType.EnvSxp) {
			throw new Error("'parent' is not an environment");
		}

		for(let e: RObject = v; e !== RValues.NilValue; e = e.enClos ?? RValues.NilValue){
			if(e === x) {
				throw new Error('cycles in parent chains are not allowed');
			}
		}
		x.enClos = v;
	}

	/**
	 * Iteratively deserializes linked-list based SEXP structures.
	 * @param flags - Initial flags.
	 * @returns Head node of the reconstructed pairlist chain as {@link RObjectData}.
	 * @throws Error if the initial type is not a valid pairlist type.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1800-L1868 | R source: ReadItem_Iterative}
	 */
	readItemIterative(flags: number): RObjectData{
		let sFirst: RObjectData | null = null;
		let sLast: RObjectData = {};

		let type = flags & 255;

		const validIterativeTypes = new Set([
			SexpType.ListSxp,   // 2
			SexpType.LangSxp,   // 6
			SexpType.CloSxp,    // 3
			SexpType.PromSxp,   // 5
			SexpType.DotSxp     // 17
		]);

		if(!validIterativeTypes.has(type)) {
			throw new Error('Wrong type.');
		}

		while(validIterativeTypes.has(type)) {
			const unpackedFlags = this.unpackFlags(flags);
			type = unpackedFlags[0] as SexpType;
			const levels = unpackedFlags[1];
			const isObject = unpackedFlags[2];
			const hasAttr = unpackedFlags[3];
			const hasTag = unpackedFlags[4];
			const s: RObjectData = {};

			s.type = type;
			s.levels = levels;
			s.object = isObject;
			this.currentDepth++;

			s.attributes = hasAttr ? [this.shortcut ? this.skipItem() : this.assertRObjectData(this.readItem())] : undefined;
			s.tag = hasTag ? this.readItem() : RValues.NilValue;

			if(hasTag && this.currentDepth == RDAParser.INITIAL_DEPTH && typeof s.tag === 'object') {
				this.lastName = s.tag.name;
				this.setLastName = true;
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

	/**
	 * Creates a weak reference object.
	 * @param key - Weak reference key object.
	 * @param val - Referenced value.
	 * @param fin - Finalizer function or NULL.
	 * @param onexit - Whether the finalizer should run on exit.
	 * @returns The created weak reference object as {@link RObject}.
	 * @throws Error if the finalizer type is invalid.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L1424-L1435 | R source: R_MakeWeakRef}
	 */
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

	/**
	 * Allocates and initializes a weak reference object.
	 * @param key - Weak reference key object.
	 * @param val - Referenced value.
	 * @param fin - Finalizer function.
	 * @param onexit - Whether the finalizer should run on exit.
	 * @returns The initialized weak reference object as {@link RObject}.
	 * @throws Error if the key type is invalid.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L1388-L1422 | R source: NewWeakRef}
	 */
	newWeakRef(key: RObjectData, val: RObject, fin: RObjectData, onexit: boolean): RObject{
		switch(key.type) {
			case SexpType.NilSxp:
			case SexpType.EnvSxp:
			case SexpType.ExtPtrSxp:
			case SexpType.BcodesSxp:
				break;
			default:
				throw new Error('can only weakly reference/finalize reference objects');
		}

		//     PROTECT(val = MAYBE_REFERENCED(val) ? duplicate(val) : val);
		//     w = allocVector(VECSXP, WEAKREF_SIZE);
		//     SET_TYPEOF(w, WEAKREFSXP);
		const w: RObjectData = {};

		w.type = SexpType.WeakRefSxp;

		if(key.value !== RValues.NilValue){
			w.key = key;
			w.value = val;
			w.finalizer = fin;
			w.next = this.RWeakRefs;
			// CLEAR_READY_TO_FINALIZE(w);
			if(w.gp) {
				w.gp &= ~1;
			}

			if(onexit){
				if(w.gp) {
					w.gp |= 2;
				}
			} else {
				if(w.gp) {
					w.gp &= ~2;
				}
			}

			this.RWeakRefs = w;
		}
		return w;
	}

	/**
	 * Creates or retrieves a cached primitive function object.
	 * @param index - Primitive function table index.
	 * @param evaluation - Non-zero for {@link SexpType.BuiltInSxp}, zero for {@link SexpType.SpecialSxp}.
	 * @returns of type {@link SexpType.BuiltInSxp} or {@link SexpType.SpecialSxp}.
	 * @throws Error if the index is out of range or the cached type mismatches.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/dstruct.c#L37-L68 | R source: mkPRIMSXP}
	 */
	mkPrimSxp(index: number, evaluation: number): RObjectData {
		const type = evaluation ? SexpType.BuiltInSxp : SexpType.SpecialSxp;
		let primCache: RObject = RValues.NilValue;
		let funTabSize = 0;
		if(!primCache || primCache === RValues.NilValue){
			funTabSize = Object.keys(RFunTabOffsets).length;

			primCache = {};
			primCache.type = SexpType.VecSxp;
			primCache.value = new Array(funTabSize);
		}

		if(index < 0 || index >= funTabSize) {
			throw new Error('offset is out of R_FunTab range');
		}

		let result = this.VECTOR_ELT(primCache, index);

		if(!result || result === RValues.NilValue) {
			result = {};
			result.type = type;
			result.offset = index;
			// SET_VECTOR_ELT(primCache, index, result);
		} else if(result.type !== type) {
			throw new Error('requested primitive type is not consistent with cached value');
		}

		return result;
	}

	/**
	 * Reads `len` bytes as a character string and applies encoding from the GP bits.
	 *
	 * Encoding flags: bit 3 = UTF-8, bit 2 = Latin-1, bit 6 = bytes (returned as-is).
	 * @param len - Number of bytes to read.
	 * @param levels - GP levels bits from the `CharSxp` flags word.
	 * @returns The decoded string, or `''` when the encoding is not yet handled.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1689-L1759 | R source: ReadChar}
	 */
	readChar(len: number, levels: number): string{
		const cBuf = this.inString(len);
		const bytes = Buffer.from(cBuf, 'latin1');

		if(levels & (1 << 3))  {
			return new TextDecoder('utf-8').decode(bytes);
		}
		if(levels & (1 << 2)) {
			return new TextDecoder('iso-8859-1').decode(bytes);
		}
		if(levels & (1 << 6)) {
			return bytes.toString('latin1');
		}
		console.warn('Native encoding detected! Native encoding not supported yet! Value will be empty');
		return '';
	}

	/**
	 * Reads a vector length from the stream.
	 * @returns The vector length.
	 * @throws Error for negative lengths or an invalid high-word value.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1761-L1782 | R source: ReadLENGTH}
	 */
	readLength(): number {
		const len = this.assertInteger(this.inInteger());
		if(len < -1) {
			throw new Error('negative serialized length for vector');
		}
		if(len == -1) {
			const len1 = this.assertInteger(this.inInteger());
			const len2 = this.assertInteger(this.inInteger());
			const xLen = len1;
			/* sanity check for now */
			if(len1 > RDAParser.MAX_VECTOR_LENGTH) {
				throw new Error('invalid upper part of serialized vector length');
			}
			return (xLen << 32) + len2;
		} else {
			return len;
		}
	}

	/**
	 * Reads `len` integers from the buffer.
	 * @param len - Number of integers to read.
	 * @returns Array of integer values or {@link RValues.NaInteger}.
	 * @throws Error for BINARY format or XDR buffer overrun.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1507-L1541 | R source: InIntegerVec}
	 */
	inIntegerVec(len: number): (number | RValues.NaInteger)[]{
		switch(this.format) {
			case SerializationFormat.Xdr:
			{
				let t = 0;
				const result: number[] = [];
				for(let done = 0; done < len; done += t) {
					t = Math.min(RDAParser.CHUNK_SIZE, len - done);
					for(let cnt = 0; cnt < t; cnt++) {
						if(this.offset + 4 > this.buffer.length) {
							throw new Error('XDR read failed');
						}
						result[done + cnt] = this.buffer.readInt32BE(this.offset);
						this.offset += 4;
					}
				}
				return result;
			}
			case SerializationFormat.Binary:
			{
				throw new Error('No binary support yet.');
			}
			default: {
				const result: (number | RValues.NaInteger)[] = [];
				for(let cnt = 0; cnt < len; cnt++) {
					result[cnt] = this.inInteger();
				}
				return result;
			}
		}
	}

	/**
	 * Advances the buffer past `len` serialized integers without reading values.
	 *
	 * Mirrors {@link inIntegerVec}.
	 * @param len - Number of integers to skip.
	 * @returns An empty array.
	 * @throws Error for BINARY format or XDR buffer overrun.
	 */
	skipIntegerVec(len: number): (number | RValues.NaInteger)[] {
		switch(this.format) {
			case SerializationFormat.Xdr:
			{
				let t = 0;
				for(let done = 0; done < len; done += t) {
					t = Math.min(RDAParser.CHUNK_SIZE, len - done);
					for(let cnt = 0; cnt < t; cnt++) {
						if(this.offset + 4 > this.buffer.length) {
							throw new Error('XDR read failed');
						}
						this.offset += 4;
					}
				}
				break;
			}
			case SerializationFormat.Binary:
			{
				throw new Error('No binary support yet.');
			}
			default: {
				for(let cnt = 0; cnt < len; cnt++) {
					this.skipInteger();
				}
			}
		}
		return [];
	}

	/**
	 * Reads `len` doubles from the buffer.
	 * @param len - Number of doubles to read.
	 * @returns Array of numbers or {@link RValues}.
	 * @throws Error for BINARY format.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1543-L1577 | R source: InRealVec}
	 */
	inRealVec(len: number): (number | RValues)[] | null[]{
		switch(this.format) {
			case SerializationFormat.Xdr: {
				const result = [];
				let t = 0;
				for(let done = 0; done < len; done += t) {
					t = Math.min(RDAParser.CHUNK_SIZE, len - done);

					const chunkBytes = t * RDAParser.SIZE_OF_DOUBLE;
					const chunk = this.buffer.subarray(this.offset, this.offset + chunkBytes);
					this.offset += chunkBytes;

					for(let i = 0; i < t; i++) {
						const value = chunk.readDoubleBE(i * RDAParser.SIZE_OF_DOUBLE);
						result.push(value);
					}
				}
				return result;
			}
			case SerializationFormat.Binary:
			{
				throw new Error('No binary support yet.');
			}
			default: {
				const result: (Real)[] = [];
				for(let cnt = 0; cnt < len; cnt++) {
					result[cnt] = this.inReal();
				}
				return result;
			}
		}
	}

	/**
	 * Advances the buffer past `len` serialized doubles without reading values.
	 *
	 * Mirrors {@link inRealVec}.
	 * @param len - Number of doubles to skip.
	 * @returns An empty array.
	 * @throws Error for BINARY format.
	 */
	skipRealVec(len: number): (number | RValues)[] | null[] {
		switch(this.format) {
			case SerializationFormat.Xdr: {
				let t = 0;
				for(let done = 0; done < len; done += t) {
					t = Math.min(RDAParser.CHUNK_SIZE, len - done);
					const chunkBytes = t * RDAParser.SIZE_OF_DOUBLE;
					this.offset += chunkBytes;
				}
				break;
			}
			case SerializationFormat.Binary:
			{
				throw new Error('No binary support yet.');
			}
			default: {
				for(let cnt = 0; cnt < len; cnt++) {
					this.skipReal();
				}
			}
		}
		return [];
	}

	/**
	 * Reads the next double from the buffer.
	 * @returns A number or an {@link RValues}.
	 * @throws TypeError if the ASCII token is not a valid float.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L427-L463 | R source: InReal}
	 */
	inReal(): Real {
		switch(this.format){
			case SerializationFormat.Ascii: {
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
			case SerializationFormat.Binary: {
				const d = this.buffer.readDoubleLE(this.offset);
				this.offset += 8;
				return d;
			}
			case SerializationFormat.Xdr: {
				const d = this.buffer.readDoubleBE(this.offset);
				this.offset += 8;
				return d;
			}
			default:
				return RValues.NilValue;
		}
	}

	/**
	 * Advances the buffer past the next serialized double without reading it.
	 *
	 * Mirrors {@link inReal}.
	 */
	skipReal(): void {
		if(this.format === SerializationFormat.Ascii) {
			this.skipWord();
			return;

		} else if(this.format === SerializationFormat.Binary || this.format === SerializationFormat.Xdr) {
			this.offset += 8;
			return;
		}
	}

	/**
	 * Reads `len` complex numbers from the buffer.
	 *
	 * Each value is read as two consecutive doubles via {@link inComplex}.
	 * @param len - Number of complex values to read.
	 * @returns Array of {@link Complex} objects.
	 * @throws Error for BINARY format.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L1579-L1616 | R source: InComplexVec}
	 */
	inComplexVec(len: number): Complex[] {
		switch(this.format) {
			case SerializationFormat.Xdr: {
				const result: Complex[] = [];
				let t = 0;
				for(let done = 0; done < len; done += t) {
					t = Math.min(RDAParser.CHUNK_SIZE, len - done);
					for(let cnt = 0; cnt < t; cnt++) {
						result[done] = this.inComplex();
					}
				}
				return result;
			}
			case SerializationFormat.Binary: {
				throw new Error('No binary support yet.');
			}
			default: {
				const result: Complex[] = [];
				for(let cnt = 0; cnt < len; cnt++) {
					result[cnt] = this.inComplex();
				}
				return result;
			}
		}
	}

	/**
	 * Advances the buffer past `len` serialized complex numbers.
	 *
	 * Mirrors {@link inComplexVec}.
	 * @param len - Number of complex values to skip.
	 * @throws Error for BINARY format.
	 */
	skipComplexVec(len: number): void {
		switch(this.format) {
			case SerializationFormat.Xdr: {
				let t = 0;
				for(let done = 0; done < len; done += t) {
					t = Math.min(RDAParser.CHUNK_SIZE, len - done);
					for(let cnt = 0; cnt < t; cnt++) {
						this.skipComplex();
					}
				}
				break;
			}
			case SerializationFormat.Binary: {
				throw new Error('No binary support yet.');
			}
			default: {
				for(let cnt = 0; cnt < len; cnt++) {
					this.skipComplex();
				}
			}
		}
	}

	/**
	 * Reads a single complex number as two consecutive real values.
	 * @returns A {@link Complex} object with `r` (real) and `i` (imaginary) parts.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L465-L471 | R source: InComplex}
	 */
	inComplex(): Complex {
		return { r: this.inReal(), i: this.inReal() };
	}

	/**
	 * Advances the buffer past a single serialized complex number (two doubles).
	 *
	 * Mirrors {@link inComplex}.
	 */
	skipComplex(): void {
		this.skipReal();
		this.skipReal();
	}

	/**
	 * Sets the `i`-th element of a character vector.
	 * @param x - The character vector with type {@link SexpType.StrSxp} to modify.
	 * @param i - index to set.
	 * @param v - The {@link SexpType.CharSxp} {@link RObjectData} whose `name` is stored.
	 * @throws Error if `x` is not a {@link SexpType.StrSxp} or `i` is out of bounds.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L4283-L4301 | R source: SET_STRING_ELT}
	 */
	SET_STRING_ELT(x: RObjectData, i: number, _v: RObjectData): void {
		if(x.type !== SexpType.StrSxp) {
			throw new Error(`SET_STRING_ELT() can only be applied to a 'character vector', not a '${x.type}'`);
		}
		// if(v.type !== SexpType.CharSxp) {
		// throw new Error(`Value of SET_STRING_ELT() must be a 'CHARSXP' not a '${v.type}'`);
		// }

		const arr = x.value as [];

		if(i < 0 || i >= arr.length) {
			throw new Error(`attempt to set index ${i}/${arr.length} in SET_STRING_ELT`);
		}

		// if(x.altRep){
		// this.ALTSTRING_SET_ELT(x, i, v);
		// }

		// arr[i] = v.name;
	}

	/**
	 * Sets the `i`-th element of a generic list or vector.
	 *
	 * Mirrors R's `SET_VECTOR_ELT` macro.
	 * @param x - The list or vector to modify.
	 * @param i - index to set.
	 * @param v - The {@link RObject} to store at position `i`.
	 * @throws Error if `x` is not a list type or `i` is out of bounds.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L4303-L4322 | R source: SET_VECTOR_ELT}
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

	/**
	 * Deserializes an R bytecode object.
	 * @returns A {@link SexpType.BcodesSxp} {@link RObject}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2221-L2228 | R source: ReadBC}
	 */
	readBC(): RObject {
		const reps: RObjectData = {};
		reps.type = SexpType.VecSxp;
		reps.value = new Array(this.assertInteger(this.inInteger()));
		return this.readBC1(reps);
	}

	/**
	 * Advances the buffer past a bytecode object without reading it.
	 *
	 * Mirrors {@link readBC}.
	 */
	skipBC(): void{
		this.skipInteger();
		this.skipBC1();
	}

	/**
	 * Advances past a single bytecode.
	 *
	 * Mirrors {@link readBC1}.
	 */
	skipBC1(): void {
		this.currentDepth++;
		this.skipItem();
		this.currentDepth--;
		this.skipBCConsts();
	}

	/**
	 * Advances past all bytecode constants.
	 *
	 * Mirrors {@link ReadBCConsts}.
	 */
	skipBCConsts(): void {
		const n = this.assertInteger(this.inInteger());
		for(let i = 0; i < n; i++) {
			const type = this.inInteger();
			switch(type) {
				case SexpType.BcodesSxp: {
					this.skipBC1();
					break;
				}
				case SexpType.LangSxp:
				case SexpType.ListSxp:
				case SexpType.BcRepDef:
				case SexpType.BcRepRef:
				case SexpType.AltLangSxp:
				case SexpType.AttrListSxp: {
					this.skipBCLang(type);
					break;
				}
				default:
					this.currentDepth++;
					this.skipItem();
					this.currentDepth--;
			}
		}
	}

	/**
	 * Registers a bytecode object after encoding.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/eval.c#L8820-L8885 | R source: R_registerBC}
	 */
	R_registerBC(_bytes: RObject, _s: RObject) {
		throw new Error('BC not implemented yet');
	}

	/**
	 * Deserializes a single bytecode object.
	 * @param reps - Pre-allocated repetition table shared across all constants.
	 * @returns A {@link SexpType.BcodesSxp} {@link RObjectData}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2205-L2219 | R source: ReadBC1}
	 */
	readBC1(reps: RObjectData): RObjectData {
		const s: RObjectData = {};
		s.type = SexpType.BcodesSxp;
		this.currentDepth++;
		s.car = this.readItem();
		this.currentDepth--;
		const _bytes = s.car;
		// s.car = R_bcEncode(bytes);
		s.cdr = this.ReadBCConsts(reps);
		s.tag = RValues.NilValue;
		// R_registerBC(bytes, s);
		return s;
	}

	/**
	 * Encodes bytecode instructions.
	 * @param _bytes - integer array
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/eval.c#L8723-L8771 | R source: R_bcEncode}
	 */
	_R_bcEncode(_bytes: Int32Array){
		throw new Error('Not implemented');
	}

	/**
	 * Reads the constants of a bytecode object.
	 * @param reps - Shared repetition table for `BcRepDef`/`BcRepRef` resolution.
	 * @returns A `VecSxp` {@link RObjectData} holding all `n` constants.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2173-L2203 | R source: ReadBCConsts}
	 */
	ReadBCConsts(reps: RObjectData): RObjectData {
		const n = this.assertInteger(this.inInteger());
		const ans: RObjectData = {};
		ans.type = SexpType.VecSxp;
		ans.value = new Array(n);
		for(let i = 0; i < n; i++) {
			const type = this.inInteger();
			switch(type) {
				case SexpType.BcodesSxp: {
					const c = this.readBC1(reps);
					this.SET_VECTOR_ELT(ans, i, c);
					break;
				}
				case SexpType.LangSxp:
				case SexpType.ListSxp:
				case SexpType.BcRepDef:
				case SexpType.BcRepRef:
				case SexpType.AltLangSxp:
				case SexpType.AttrListSxp: {
					const c = this.ReadBCLang(type, reps);
					this.SET_VECTOR_ELT(ans, i, c);
					break;
				}
				default:
					this.currentDepth++;
					this.SET_VECTOR_ELT(ans, i, this.readItem());
					this.currentDepth--;
			}
		}
		return ans;
	}

	/**
	 * Reads a single language object from bytecode constants.
	 * @param type - {@link SexpType} read from the constants.
	 * @param reps - Shared repetition table.
	 * @returns The deserialized language {@link RObjectData}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2125-L2171 | R source: ReadBCLang}
	 */
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

	/**
	 * Advances the buffer past a single language object.
	 *
	 * Mirrors {@link ReadBCLang}.
	 * @param type - read {@link SexpType}.
	 */
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
				switch(type) {
					case SexpType.AltLangSxp: type = SexpType.LangSxp; hasAttr = true; break;
					case SexpType.AttrListSxp: type = SexpType.ListSxp; hasAttr = true; break;
				}

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
	 * Retrieves the `i`-th element of a generic list or vector.
	 * @param x - The list / expression / weak-ref vector.
	 * @param i - The index to retrieve.
	 * @returns The {@link RObject} at position `i`.
	 * @throws Error if `x` is not a list type or `i` is out of bounds.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/memory.c#L4122-L4142 | R source: VECTOR_ELT}
	 */
	VECTOR_ELT(x: RObjectData,  i: number): RObject {
		if(x.type !== SexpType.VecSxp &&
			x.type !== SexpType.ExprSxp &&
			x.type !== SexpType.WeakRefSxp) {
			throw new Error(`VECTOR_ELT() can only be applied to a 'list', not a '${x.type}'`);
		}
		// "VECTOR_ELT", "list", R_typeToChar(x));
		if(i < 0 || i >= (x.value as RObject[])?.length) {
			throw new Error('attempt access index %lld/%lld in VECTOR_ELT');
		}
		// (long long)i, (long long)XLENGTH(x));
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

	/**
	 * Checks whether a bytecode object's version is within the supported range.
	 * @param s - The {@link SexpType.BcodesSxp} {@link RObjectData} to check.
	 * @returns `true` if the version is supported.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/eval.c#L7166-L7175 | R source: R_BCVersionOK}
	 */
	R_BCVersionOK(s: RObjectData): boolean{
		if(s.type !== SexpType.BcodesSxp) {
			return false;
		}

		// const pc = s.code;
		const pc = 0;
		const version = pc;

		return (version >= 9 && version <= 12);
	}

	/**
	 * Returns the source-language expression for an unsupported bytecode object.
	 * @param s - The {@link SexpType.BcodesSxp} {@link RObjectData}.
	 * @returns First constant pool entry if available, otherwise {@link RValues.NilValue}.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/eval.c#L5566-L5574 | R source: bytecodeExpr}
	 */
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
	 * Attempts to unserialize an ALTREP object.
	 * @param info - The info to be unserialized.
	 * @param _state - Serialized state.
	 * @param _attr - Serialized attributes.
	 * @param _objf - IS_OBJECT flag.
	 * @param _levs - GP levels bits.
	 * @returns The {@link RObjectData} or .
	 * @throws Error if the base type is not a supported vector type.
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
					console.warn(`cannot unserialize ALTVEC object of class '${(cSym as RObjectData).name}'
					from package '${(pSym as RObjectData).name}' returning length zero vector`);
					info.type = type;
					info.value = [];
					return info;
				default:
					throw new Error('cannot unserialize this ALTREP object');
			}
		}
		return {} as RObjectData;
	}

	/**
	 * Looks up the ALTREP class for the given class/package symbol pair.
	 * @param info - The info to be looked up.
	 * @returns The class {@link RObjectData} when found, `undefined` if unregistered, or `null` if `info` is not a `ListSxp`.
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
				} catch(e){
					console.log(`${pName.value as string} ${e as string}`);
				}
				clss = this.LookupClass(cSym, pSym);
			}
			return clss;
		}
		return null;
	}

	/**
	 * Looks up an ALTREP class entry by class and package symbol.
	 * @param cSym - Class symbol.
	 * @param pSym - Package symbol.
	 * @returns The {@link RObjectData} or `undefined` if not registered.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/altrep.c#L90-L94 | R source: LookupClass}
	 */
	LookupClass(cSym: RObjectData, pSym: RObjectData) {
		const entry = this.LookupClassEntry(cSym, pSym);
		return entry === undefined || entry === null ? undefined : entry.car as RObjectData;
	}

	/**
	 * Searches the ALTREP class registry for an entry matching the given symbols.
	 * @param cSym - Class symbol to match.
	 * @param pSym - Package symbol to match.
	 * @returns The matching registry node or `null` if not found.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/altrep.c#L53-L59 | R source: LookupClassEntry}
	 */
	LookupClassEntry(cSym: RObject, pSym: RObject): RObjectData | null{
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

	/**
	 * Creates a length-1 character vector wrapping the given string.
	 * @param x - The string value to wrap.
	 * @returns A {@link SexpType.StrSxp} {@link RObjectData} with one element.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/include/Rinlinedfuns.h#L1044-L1052 | R source: ScalarString}
	 */
	ScalarString(x: string): RObjectData{
		const ans: RObjectData = {};
		ans.type = SexpType.StrSxp;
		ans.value = new Array(1);
		this.SET_STRING_ELT(ans, 0, { name: x });
		return ans;
	}

	/**
	 * Recomputes and restores the cached hash-table priority count for an environment.
	 * @param s - The {@link RObjectData} whose hash table is to be repaired.
	 * @see {@link https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/envir.c#L3685-L3698 | R source: R_RestoreHashCount}
	 */
	restoreHashCount(s: RObjectData): void{
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

	/**
	 * Converts a linked-list based R object tree into a flat array representation.
	 * @param node - Root node of the deserialized object tree.
	 * @param shortcut - Whether payload values should be omitted.
	 * @returns Flattened array of top-level objects.
	 */
	flattenRObject(node: RObject, shortcut: boolean): RObjectData[] {
		const result:  RObjectData[] = [];

		function walk(n: RObject | null, shortcut: boolean) {
			if(!n || n === RValues.NilValue) {
				return;
			}

			const name = (n.tag as RObjectData)?.name;

			if(name !== undefined) {
				let copy: RObjectData = {};
				if(shortcut) {
					copy = {
						name: (n.tag as RObjectData).name,
						type: (n.car as RObjectData).type,
					};
				} else {
					copy = {
						name:         (n.tag as RObjectData).name,
						value:        (n.car as RObjectData).value,
						hasAttribute: !!n.hasAttribute,
						attributes:   n.attributes,
						type:         (n.car as RObjectData).type,
						tag:          RValues.NilValue
					};
				}
				result.push(copy);
			}

			if(n.cdr && n.cdr !== RValues.NilValue) {
				walk(n.cdr, shortcut);
			}
		}
		walk(node, shortcut);

		return result;
	}
}