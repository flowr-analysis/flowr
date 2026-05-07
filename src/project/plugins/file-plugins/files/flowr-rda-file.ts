import type { FileRole , FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile } from '../../../context/flowr-file';
import fs from 'node:fs';
// @ts-ignores
import * as bzip2 from 'bzip2';
import * as zlib from 'node:zlib';
import * as lzmaNative from 'lzma-native';
import { R_FunTabOffsets } from './r-fun-tab';
import { RShellExecutor } from '../../../../r-bridge/shell-executor';

export class FlowrRDAFile extends FlowrFile<Promise<RObject[]>> {
	private readonly wrapped:  FlowrFileProvider;
	private readonly shortcut: boolean;

	/**
	 * Prefer the static {@link FlowrRDAFile.from} method to create instances of this class as it will not re-create if already a description file
	 * and handle role assignments.
	 */
	constructor(file: FlowrFileProvider, shortcut?: boolean) {
		super(file.path(), file.roles);
		this.wrapped = file;
		this.shortcut = shortcut || false;
	}

	/**
	 * Loads and parses the content of the wrapped file as an RDA structure.
	 * @see {@link parseRDA} for details on the parsing logic.
	 */
	protected async loadContent(): Promise<RObject[]> {
		return await new RDAParser().parseRDA(this.wrapped, this.shortcut) ?? [{}];
	}

	/**
	 * RDA file lifter, this does not re-create if already an RDA file
	 */
	public static from(file: FlowrFileProvider | FlowrRDAFile, role?: FileRole): FlowrRDAFile {
		if(role) {
			file.assignRole(role);
		}
		return file instanceof FlowrRDAFile ? file : new FlowrRDAFile(file);
	}
}

export type CompressionType = 'COMP_GZ' | 'COMP_BZ' | 'COMP_XZ' | 'COMP_LZMA' | 'COMP_ZSTD' | 'COMP_UNKNOWN_OR_NO';

type SerializationTypes = 'R_MAGIC_EMPTY' | 'R_MAGIC_CORRUPT' | 'R_MAGIC_ASCII_V1' | 'R_MAGIC_BINARY_V1' |
	'R_MAGIC_XDR_V1' | 'R_MAGIC_ASCII_V2' | 'R_MAGIC_BINARY_V2' | 'R_MAGIC_XDR_V2' | 'R_MAGIC_ASCII_V3' |
	'R_MAGIC_BINARY_V3' | 'R_MAGIC_XDR_V3' | 'R_MAGIC_MAYBE_TOONEW' | number;

type RObject = RValues.NilValue | RObjectData;

type Real = number | RValues.NilValue | RValues.NaReal | RValues.NaN | RValues.PosInf | RValues.NegInf;
type Complex = { r: Real, i: Real };

interface RObjectData {
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
}

enum SexpType {
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
	ExtptrSxp        = 22,
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
	PosInf            = 'PosInf',
	NegInf            = 'Neg_inf',
}

export class RDAParser{
	private file!:             FlowrFileProvider;
	private shortcut!:         boolean;
	private buffer!:           Buffer;
	private currentDepth:      number = 0;
	private initialDepth!:     number;
	private lastName:          string | undefined = undefined;
	private setLastName = false;
	private offset = 0;
	private readonly RCodeSetMax = 63;
	private RWeakRefs = null;
	private readonly ChunkSize = 8906;
	private readonly SizeOfDouble = 8;
	private format!:           'XDR' | 'ASCII' | 'BINARY';
	private readonly refTable: RObject[] = [];


	private opinfo = {
		addr:     null,
		argc:     null,
		instName: null
	};

	/**
	 * Parses an RDA-file by decompressing and deserializing
	 * @param file - RDA-file to parse
	 * @param shortcut - If true, only the names of objects in the rda are returned, if false, all data is collected
	 * @returns Parsed RDA-File as an RObject
	 */
	async parseRDA(file: FlowrFileProvider, shortcut?: boolean): Promise<RObjectData[] | null> {
		this.file = file;
		this.shortcut = shortcut || false;
		const fileContent = fs.readFileSync(file.path());
		const compressionType = this.detectCompression(fileContent);
		this.buffer = await this.decompress(fileContent, compressionType);
		const result = this.deserialize2();
		if(result === RValues.NilValue) {
			return null;
		} else {
			return this.flattenRObject(result, this.shortcut);
		}
	}

	/**
	 * Detects the compression used for the RDA-file.
	 * @param buf - Buffer with compressed RDA-file content
	 * @param with_zlib - Whether zlib support should be used
	 * @returns Compression type of compressed RDA-file
	 * @remarks
	 * Based on the original R implementation:
	 * https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/connections.c#L2675-L2710
	 */
	detectCompression(buf: Buffer, with_zlib: boolean = false): CompressionType {
		if(buf.length >= 2 && buf[0] == 0x1f && buf[1] == 0x8b) {
			return 'COMP_GZ';
		}
		if(with_zlib && buf.length>=2 && buf[0] == 0x78 && buf[1] == 0x9c){
			return 'COMP_GZ';
		}
		if(buf.length >= 10 && buf[0] === 0x42 && buf[1] === 0x5a && buf[2] === 0x68) {
			if(buf[3] >= 0x31 && buf[3] <= 0x39) {
				const magic1 = [0x31, 0x41, 0x59, 0x26, 0x53, 0x59];
				const magic2 = [0x17, 0x72, 0x45, 0x38, 0x50, 0x90];
				const isMagic1 = magic1.every((v, i) => buf[4 + i] === v);
				const isMagic2 = magic2.every((v, i) => buf[4 + i] === v);

				if(isMagic1 || isMagic2) {
					return 'COMP_BZ';
				}
			}
		}

		if(buf.length >=4){
			if(buf.length >= 4 && buf[0] == 0x89 && buf[1] === 0x4c && buf[2] === 0x5a && buf[3] === 0x4f) {
				throw new Error('this is a lzop-compressed file which this build of R does not support');
			} else if(buf.length >= 4 && buf[0] === 0x28 && buf[1] === 0xB5 && buf[2] === 0x2F && buf[3] === 0xFD) {
				return 'COMP_ZSTD';
			}
		}

		if(buf.length >= 5) {
			if(buf[0] === 0xFD && buf[1] === 0x37 && buf[2] === 0x7a && buf[3] === 0x58 && buf[4] === 0x5a) {
				return 'COMP_XZ';
			} else if(buf[0] === 0xFF && buf[1] === 0x4C && buf[2] === 0x5A && buf[3] === 0x4D && buf[4] === 0x41) {
				return 'COMP_LZMA';
			} else if(buf[0] === 0x5D && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x80 && buf[4] === 0x00) {
				return 'COMP_LZMA';
			}
		}

		return 'COMP_UNKNOWN_OR_NO';
	}

	/**
	 * Decompresses the given RDA-file
	 * @param fileContent - File content as a  {@link Buffer}
	 * @param compressionType - {@link CompressionType} of RDA-file
	 * @returns Decompressed RDA-file
	 */
	async decompress(fileContent: Buffer, compressionType: CompressionType): Promise<Buffer> {
		let buffer: Buffer;

		switch(compressionType) {
			case 'COMP_GZ': {
				try {
					buffer = zlib.gunzipSync(fileContent);
				} catch{
					buffer = zlib.inflateSync(fileContent);
				}
				break;
			}

			case 'COMP_BZ': {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
				const decompressed = bzip2.simple(bzip2.array(fileContent));
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				buffer = Buffer.from(decompressed);
				break;
			}

			case 'COMP_XZ':
			case 'COMP_LZMA': {
				buffer = await new Promise<Buffer>((resolve, reject) => {
					// @ts-expect-error
					lzmaNative.decompress(fileContent, (result: Buffer | Error) => {
						if(result instanceof Error) {
							reject(result);
						} else {
							resolve(result);
						}
					});
				});
				break;
			}

			case 'COMP_ZSTD': {
				throw new Error(compressionType + 'not supported yet.');
			}

			case 'COMP_UNKNOWN_OR_NO':
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
	 * @returns Serialization type of decompressed RDA-file
	 * @remarks
	 * Based on the original R implementation:
	 * https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L1808-L1858
	 */
	determineSerializationType(buf: Buffer): SerializationTypes {
		if(buf.length < 5) {
			if(buf.length === 0) {
				return 'R_MAGIC_EMPTY';
			} else {
				return 'R_MAGIC_CORRUPT';
			}
		}

		const magic = buf.toString('ascii', 0, 5);
		switch(magic) {
			case 'RDA1\n':
				return 'R_MAGIC_ASCII_V1';
			case 'RDB1\n':
				return 'R_MAGIC_BINARY_V1';
			case 'RDX1\n':
				return 'R_MAGIC_XDR_V1';
			case 'RDA2\n':
				return 'R_MAGIC_ASCII_V2';
			case 'RDB2\n':
				return 'R_MAGIC_BINARY_V2';
			case 'RDX2\n':
				return 'R_MAGIC_XDR_V2';
			case 'RDA3\n':
				return 'R_MAGIC_ASCII_V3';
			case 'RDB3\n':
				return 'R_MAGIC_BINARY_V3';
			case 'RDX3\n':
				return 'R_MAGIC_XDR_V3';
		}

		if(magic.startsWith('RD')) {
			return 'R_MAGIC_MAYBE_TOONEW';
		}

		return Number(buf.toString('ascii', 0, 4));
	}

	/**
	 * Deserializes a decompressed RDA-file.
	 * @returns Deserialized RDA-file as RObject or RValues.NilValue, if the deserialization fails
	 * @remarks
	 * Based on the original R implementation:
	 * https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L1923-L1972
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
		return RValues.NilValue;
	}

	/**
	 * Deserializes a decompressed RDA-file.
	 * @returns Deserialized RDA-file
	 * @remarks
	 * Based on the original R implementation:
	 * https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2237-L2292
	 */
	deserialize(): RObject {

		switch(String.fromCodePoint(this.buffer[this.offset])) {
			case 'A': this.format = 'ASCII'; break;
			case 'B': this.format = 'BINARY'; break;
			case 'X': this.format = 'XDR'; break;
			case '\n':
				if(String.fromCodePoint(this.buffer[this.offset + 1]) === 'A') {
					this.format = 'ASCII';
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
				if(neLen > this.RCodeSetMax || neLen < 0)  {
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
	 * Determine integer value.
	 * @returns number
	 * @remarks
	 * Based on the original R implementation:
	 * https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L396-L420
	 */
	inInteger(): number | RValues.NaInteger {
		switch(this.format) {
			case 'ASCII': {
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
			case 'BINARY': {
				const i = this.buffer.readInt32LE(this.offset);
				this.offset += 4;
				return i;
			}
			case 'XDR':{
				const i = this.buffer.readInt32BE(this.offset);
				this.offset += 4;
				return i;
			}
			default:
				return RValues.NaInteger;
		}
	}

	assertInteger(value: number | RValues.NaInteger): number {
		if(value === RValues.NaInteger) {
			throw new Error('Unexpected NA integer');
		}
		return value;
	}

	assertRObjectData(obj: RObject): RObjectData {
		if(obj === RValues.NilValue) {
			throw new Error('Unexpected NilValue');
		}
		return obj;
	}

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

	inChar(): number {
		if(this.offset >= this.buffer.length) {
			return -1;
		}

		const char = this.buffer[this.offset];
		this.offset++;
		return char;
	}

	isSpace(c: number): boolean {
		return c >= 9 && c <= 13 || c === 32;
	}

	inString(len: number): string {
		if(this.format === 'ASCII') {
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
			return bytes.toString('utf8');
		}
	}

	decodeVersion(writerVersion: number): number[] {
		const v = writerVersion / 65536;
		writerVersion = writerVersion % 65536;
		const p = writerVersion / 256;
		writerVersion = writerVersion % 256;
		const s = writerVersion;

		return [v,p,s];
	}

	readItem(): RObject {
		const flags = this.assertInteger(this.inInteger());
		return this.readItemRecursive(flags);
	}

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
		} else {
			console.log(result);
		}
		return val;
	}

	readItemRecursive(flags: number): RObjectData {
		const [type, levels, object, hasAttribute, _hasTag] = this.unpackFlags(flags);

		let s: RObjectData = {};

		switch(type) {
			case SexpType.NilValueSxp:
			case SexpType.EmptyEnvSxp:
			case SexpType.BaseEnvSxp:
			case SexpType.GlobalEnvSxp:
			case SexpType.UnboundValueSxp:
			case SexpType.MissingArgSxp:
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
				const _info = this.readItem();
				const _state = this.readItem();
				const _attr = this.readItem();
				// s = ALTREP_UNSERIALIZE_EX(info, state, attr, object, levels); //TODO
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
				// @ts-expect-error: not implemented yet
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
				// R_RestoreHashCount(s); -> TODO
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
					case SexpType.ExtptrSxp: {
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
						s.value = this.R_MakeWeakRef(RValues.NilValue, RValues.NilValue, RValues.NilValue, false);
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

							if(name in R_FunTabOffsets) {
								s.value = this.mkPrimSxp(name, SexpType.BuiltInSxp); // TODO
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
						if(this.shortcut && this.format === 'XDR') {
							this.offset += len * 4;
						} else {
							s.value = this.inIntegerVec(len);
						}
						break;
					}
					case SexpType.RealSxp:
					{
						const len = this.readLength();
						s.type = type;
						if(this.shortcut && this.format === 'XDR'){
							this.offset += len * this.SizeOfDouble;
						} else {
							s.value = this.inRealVec(len);
						}
						break;
					}
					case SexpType.CplxSxp: {
						const len = this.readLength();
						s.type = type;
						if(this.shortcut && this.format === 'XDR'){
							this.offset += len * this.SizeOfDouble * 2;
						} else {
							s.value = this.inComplexVec(len);
						}
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
						s = this.readBC();
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
					s.attributes = hasAttribute ? [this.readItem()] : undefined;
					this.currentDepth--;
				}
				if(s.type === SexpType.BcodesSxp && !this.R_BCVersionOK(s)) {
					return this.R_BytecodeExpr(s);
				}
				return s;
		}
	}

	inRaw(len: number): number[]{
		const result = [];
		switch(this.format) {
			case 'ASCII':
				for(let ix = 0; ix < len; ix++) {
					const word = this.inWord(128);
					result[ix] = Number.parseInt(word, 16);
				}
				break;
			default: {
				let t = 0;
				for(let done = 0; done < len; done += t) {
					t = Math.min(this.ChunkSize, len - done);
					for(let i = 0; i < t; i++) {
						result[done + i] = this.buffer[this.offset];
						this.offset += 1;
					}
				}
			}
		}
		return result;
	}

	rFindPackageEnv(_s: RObject): void {
		throw new Error('Not implemented yet!');
	}

	unpackFlags(flags: number): [number, number, boolean, boolean, boolean] {
		const pType = flags & 255;
		const pLevels = flags >> 12;
		const pIsObj = (flags & (1 << 8)) !== 0;
		const pHasAttr =  (flags & (1 << 9)) !== 0;
		const pHasTag =  (flags & (1 << 10)) !== 0;

		return [pType, pLevels, pIsObj, pHasAttr, pHasTag];
	}

	getReadRef(index: number): RObjectData {
		const i = index - 1;

		if(i < 0 || i >= this.refTable.length) {
			throw new Error('reference index out of range');
		}
		return this.refTable[i];
	}

	inRefIndex(flags: number): number {
		const i = flags >> 8;
		if(i === 0) {
			return this.assertInteger(this.inInteger());
		} else {
			return i;
		}
	}

	addReadRef(value: RObject): void {
		this.refTable.push(value);
	}

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

			s.attributes = hasAttr ? [this.assertRObjectData(this.readItem())] : undefined;
			s.tag = hasTag ? this.readItem() : RValues.NilValue;

			if(hasTag && this.currentDepth == this.initialDepth && typeof s.tag === 'object') {
				this.lastName = s.tag.name;
				this.setLastName = true;
			}

			s.car = this.readItem();
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

	// TODO
	R_MakeWeakRef(key, val, fin, onexit): RObject {
		switch(fin) {
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

	// TODO
	newWeakRef(key, val, fin, onexit): RObject{
		switch(key) {
			case SexpType.NilSxp:
			case SexpType.EnvSxp:
			case SexpType.ExtptrSxp:
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

		if(!key || key !== RValues.NilValue){
			// 	SET_WEAKREF_KEY(w, key);
			w.key = key;
			// 	SET_WEAKREF_VALUE(w, val);
			w.value = val;
			// 	SET_WEAKREF_FINALIZER(w, fin);
			w.finalizer = fin;
			// 	SET_WEAKREF_NEXT(w, RWeakRefs);
			w.next = this.RWeakRefs;
			// 	CLEAR_READY_TO_FINALIZE(w);
			w.gp &= ~1;

			if(onexit){
				w.gp |= 2;
			} else {
				w.gp &= ~2;
			}

			this.RWeakRefs = w;
		}
		return w;
	}

	// TODO
	mkPrimSxp(index: number, evaluation: number): RObject {
		const type = evaluation ? SexpType.BuiltInSxp : SexpType.SpecialSxp;
		let primCache: RObject = RValues.NilValue;
		let funTabSize = 0;
		if(!primCache || primCache === RValues.NilValue){
			funTabSize = Object.keys(R_FunTabOffsets).length;

			primCache = {};
			primCache.type = SexpType.VecSxp;
			primCache.value = funTabSize;
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

	// TODO
	readChar(len: number, levs: number): string{
		const cbuf = this.inString(len);
		if(levs & (1 << 3))  {
			// return new TextDecoder('utf-8').decode(cbuf);
		}
		if(levs & (1 << 2)) {
			// return new TextDecoder('iso-8859-1').decode(cbuf);
		}
		// if (levs & (1 << 1)) return mkCharLenCE(buf, length, CE_BYTES);
		if(levs & (1 << 6)) {
			return cbuf;
		}

		return '';

		// throw new Error('Native encoding not supported yet.');
	}

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
			if(len1 > 65536) {
				throw new Error('invalid upper part of serialized vector length');
			}
			return (xLen << 32) + len2;
		} else {
			return len;
		}
	}

	inIntegerVec(len: number): (number | RValues.NaInteger)[]{
		switch(this.format) {
			case 'XDR':
			{
				let t = 0;
				const result: number[] = [];
				for(let done = 0; done < len; done += t) {
					t = Math.min(this.ChunkSize, len - done);
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
			case 'BINARY':
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

	inRealVec(len: number): (number | RValues)[] | null[]{
		switch(this.format) {
			case 'XDR': {
				const result = [];
				let t = 0;
				for(let done = 0; done < len; done += t) {
					t = Math.min(this.ChunkSize, len - done);

					const chunkBytes = t * this.SizeOfDouble;
					const chunk = this.buffer.subarray(this.offset, this.offset + chunkBytes);
					this.offset += chunkBytes;

					for(let i = 0; i < t; i++) {
						const value = chunk.readDoubleBE(i * this.SizeOfDouble);
						result.push(value);
					}
				}
				return result;
			}
			case 'BINARY':
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

	inReal(): Real {
		switch(this.format){
			case 'ASCII': {
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
			case 'BINARY': {
				const d = this.buffer.readDoubleLE(this.offset);
				this.offset += 8;
				return d;
			}
			case 'XDR': {
				const d = this.buffer.readDoubleBE(this.offset);
				this.offset += 8;
				return d;
			}
			default:
				return RValues.NilValue;
		}
	}

	inComplexVec(len: number): Complex[] {
		switch(this.format) {
			case 'XDR': {
				const result: Complex[] = [];
				let t = 0;
				for(let done = 0; done < len; done += t) {
					t = Math.min(this.ChunkSize, len - done);
					for(let cnt = 0; cnt < t; cnt++) {
						result[done] = this.inComplex();
					}
				}
				return result;
			}
			case 'BINARY': {
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

	inComplex(): Complex {
		return { r: this.inReal(), i: this.inReal() };
	}

	SET_STRING_ELT(x: RObjectData, i: number, v: RObjectData): void {
		if(i < 0 || i >= (x.value as Array<string>).length) {
			throw new Error('index out of bounds');
		}
		x.value[i] = v.name;
	}

	SET_VECTOR_ELT(x: RObjectData, i: number, v: RObject): void {
		if(x.type !== SexpType.VecSxp &&
			x.type !== SexpType.ExprSxp &&
			x.type !== SexpType.WeakRefSxp) {
			throw new Error(`SET_VECTOR_ELT() can only be applied to a 'list', not a '${x.type}'`);
		}
		if(i < 0 || i >= (x.value as Array<RObject>).length) {
			throw new Error(`attempt to set index ${i}/${(x.value as Array<RObject>).length} in SET_VECTOR_ELT`);
		}

		x.value[i] = v;
	}

	readBC(): RObject {
		const reps: RObjectData = {};
		reps.type = SexpType.VecSxp;
		reps.value = new Array(this.assertInteger(this.inInteger()));
		return this.readBC1(reps);
	}

	R_registerBC(_bytes: RObject, _s: RObject) {
		throw new Error('BC not implemented yet');
	}

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

	_R_bcEncode(_bytes: Int32Array){
		throw new Error('Not implemented');
	}

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

	ReadBCLang(type: SexpType, reps: RObjectData): RObjectData {
		switch(type) {
			case SexpType.BcRepRef:
				return this.VECTOR_ELT(reps, this.assertInteger(this.inInteger()));
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
				const res = this.readItem();
				this.currentDepth--;
				return res;
			}
		}
	}

	// TODO
	VECTOR_ELT(x: RObjectData,  i: number): RObject {
		if(x.type !== SexpType.VecSxp &&
			x.type !== SexpType.ExprSxp &&
			x.type !== SexpType.WeakRefSxp) {
			throw new Error(`VECTOR_ELT() can only be applied to a 'list', not a '${x.type}'`);
		}
		// "VECTOR_ELT", "list", R_typeToChar(x));
		if(i < 0 || i >= x.value?.length) {
			throw new Error('attempt access index %lld/%lld in VECTOR_ELT');
		}
		// 	(long long)i, (long long)XLENGTH(x));
		if(x.alt) {
			const ans = x[i];
			/* the element is marked as not mutable since complex
			   assignment can't see reference counts on any intermediate
			   containers in an ALTREP */
			// MARK_NOT_MUTABLE(ans);
			return ans;
		} else {
			return x[i];
		}
	}

	// TODO
	R_BCVersionOK(s: RObject): boolean{
		if(s.type !== SexpType.BcodesSxp) {
			return false;
		}

		const pc = s.code;
		const version = pc;

		return (version >= 9 && version <= 12);
	}

	R_BytecodeExpr(s: RObjectData): RObject {
		if(s.type === SexpType.BcodesSxp) {
			if((s.cdr as RObjectData).value?.length > 0) {
				return this.VECTOR_ELT(s.cdr, 0);
			} else {
				return RValues.NilValue;
			}
		} else {
			return s;
		}
	}

	// TODO
	ALTREP_UNSERIALIZE_EX(info: RObject, state, attr,objf: boolean,levs: number): RObject {
		const cSym = info.car;
		const pSym = (info.cdr as RObject).car;
		const type = (((info.cdr as RObject).cdr as RObject).car as RObject).type as SexpType;

		/* look up the class in the registry and handle failure */
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
					console.warn(`cannot unserialize ALTVEC object of class '${cSym?.name}' from package '${pSym?.name}' returning length zero vector`);
					return info.type = 0;
				default:
					throw new Error('cannot unserialize this ALTREP object');
			}
		}

		return undefined;

		/* check the registered and unserialized types match */
		// const rtype = ALTREP_CLASS_BASE_TYPE(c);
		// if (type !== rtype)
		// 	console.warn(`serialized class '${CHAR(PRINTNAME(csym))}' from package '${CHAR(PRINTNAME(psym))}' has type ${type2char(type)} registered class has type ${type2char(rtype)}`);
		//
		// /* dispatch to a class method */
		// const altrep_methods_t *m = CLASS_METHODS_TABLE(c);
		// const val = m->UnserializeEX(c, state, attr, objf, levs);
		// return val;
	}

	ALTREP_UNSERIALIZE_CLASS(info: RObjectData) {
		return undefined;

		// if(info.type == SexpType.ListSxp) {
		// 	const cSym = info.car;
		// 	const  pSym = (info.cdr as RObject).car;
		// 	let clss = LookupClass(cSym, pSym);
		// 	if(clss === undefined) {
		// 		// const pName = ScalarString(pSym.name);
		// 		// R_tryCatchError(find_namespace, pname,
		// 		// 	handle_namespace_error, NULL);
		// 		clss = LookupClass(cSym, pSym);
		// 	}
		// 	return clss;
		// }
		// return null;
	}

	// LookupClass(cSym: RObject, pSym: RObject) {
	// 	const entry = LookupClassEntry(cSym, pSym);
	// 	return entry === undefined ? undefined : entry.car;
	// }

	// LookupClassEntry(cSym: RObject, pSym: RObject): RObject {
	// 	for (const chain = CDR(Registry); chain !== RValues.NilValue; chain = CDR(chain))
	// 	// if (TAG(CAR(chain)) == csym && CADR(CAR(chain)) == psym)
	// 	// 	return CAR(chain);
	// 	// return NULL;
	// }

	restoreHashCount(s: RObjectData): void{
		if(s.hashTab !== RValues.NilValue) {
			const table = s.hashTab as RObjectData;
			const size = table.value.length;
			let count = 0;
			for(let i= 0; i < size; i++) {
				if(this.VECTOR_ELT(table, i) !== RValues.NilValue) {
					count++;
				}
			}
			// SET_HASHPRI(table, count);
			//TODO???
		}
	}

	flattenRObject(node: RObject, shortcut: boolean): RObjectData[] {
		const result:  RObjectData[] = [];

		function walk(n: RObject | null, shortcut: boolean) {
			if(!n || n === RValues.NilValue) {
				return;
			}

			const name = (n.tag as RObjectData)?.name;

			if(name !== undefined) {
				const copy: RObject = {
					name:         (n.tag as RObjectData).name,
					value:        shortcut ? undefined : (n.car as RObjectData).value,
					hasAttribute: !!n.hasAttribute,
					attributes:   shortcut ? undefined : n.attributes,
					type:         shortcut ? undefined : (n.car as RObjectData).type,
					tag:          RValues.NilValue
				};

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