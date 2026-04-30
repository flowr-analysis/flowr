import type { FileRole , FlowrFileProvider } from '../../../context/flowr-file';
import { FlowrFile } from '../../../context/flowr-file';
import fs from 'fs';
// @ts-ignores
import * as bzip2 from 'bzip2';
import * as zlib from 'node:zlib';
import * as lzmaNative from 'lzma-native';
import { R_FunTabOffsets } from './r-fun-tab';
import { RShellExecutor } from '../../../../r-bridge/shell-executor';

export type RDA = string;
let currentDepth = 0;
let lastName: string | undefined = undefined;
let setLastName = false;
let format: 'XDR' | 'ASCII' | 'BINARY';
let offset = 0;
const RCodeSetMax = 63;
let RWeakRefs = null;
const ChunkSize = 8906;
const SizeOfDouble = 8;

const opinfo = {
	addr:     null,
	argc:     null,
	instName: null
};

export class FlowrRDAFile extends FlowrFile<RDA> {
	private readonly wrapped: FlowrFileProvider;

	/**
	 * Prefer the static {@link FlowrRDAFile.from} method to create instances of this class as it will not re-create if already a description file
	 * and handle role assignments.
	 */
	constructor(file: FlowrFileProvider) {
		super(file.path(), file.roles);
		this.wrapped = file;
	}

	/**
	 * Loads and parses the content of the wrapped file as an RDA structure.
	 * @see {@link parseRDA} for details on the parsing logic.
	 */
	protected async loadContent(): Promise<RDA> {
		return await parseRDA(this.wrapped);
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


/**
 * Parses a RDA-file by decompressing and deserializing
 * @param file - RDA-file to parse
 * @returns Parsed RDA-File as an RObject
 */
export async function parseRDA(file: FlowrFileProvider): Promise<RObject[] | null> {
	// can read gzip, bzip2 and xz forms of compression when reading from a file, and gzip compression when reading from a connection.
	const fileContent = fs.readFileSync(file.path());
	const compressionType = detectCompression(fileContent);
	const decompressedBuffer = await decompress(fileContent, compressionType);
	const result = deserialize2(decompressedBuffer);
	if(result !== RValues.NilValue){
		return flattenRObject(result);
	} else {
		return null;
	}
	// load.R --> load()
	// saveload.c --> do_loadFromConn2()
	// serialize.c --> ReadItem_Recursive()
	// saveload.c --> do_load() --> version 1 and earlier load
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
function detectCompression(buf: Buffer, with_zlib: boolean = false): CompressionType {
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
export async function decompress(fileContent: Buffer, compressionType: CompressionType): Promise<Buffer> {
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
			break;
		}

		case 'COMP_UNKNOWN_OR_NO':
			buffer = fileContent;
			break;
		default:
			throw new Error('Unknown or unsupported compression type.');
	}

	return buffer;
}

type SerializationTypes = 'R_MAGIC_EMPTY' | 'R_MAGIC_CORRUPT' | 'R_MAGIC_ASCII_V1' | 'R_MAGIC_BINARY_V1' |
	'R_MAGIC_XDR_V1' | 'R_MAGIC_ASCII_V2' | 'R_MAGIC_BINARY_V2' | 'R_MAGIC_XDR_V2' | 'R_MAGIC_ASCII_V3' |
	'R_MAGIC_BINARY_V3' | 'R_MAGIC_XDR_V3' | 'R_MAGIC_MAYBE_TOONEW' | number;

interface RObject {
	name?:         string;
	levels?:       number,
	object?:       boolean,
	hasAttribute?: boolean,
	attributes?:   RObject[],
	hasTag?:       boolean,
	tag?:          RObject,
	type?:         SexpType,
	value:         unknown,
	frame?:        object,
	_isObject?:    boolean,
	_isLocked?:    boolean,
	car?:          RObject,
	cdr?:          RObject,
	enClos?:       RObject | RValues.NilValue,
	address?:      object | null,
	protected?:    RObject,
	cloEnv?: 	     RValues;
	prEnv?: 	      RValues;
	key?:          any;
	finalizer?:    any;
	next?: 		      any;
	gp?: 		        number;
	hashTab?:      any;
	offset?:       number;
}

function newEmptyRObject(): RObject {
	return {
		name:         '',
		levels:       undefined,
		object:       undefined,
		hasAttribute: undefined,
		attributes:   [],
		hasTag:       undefined,
		tag:          undefined,
		type:         undefined,
		value:        RValues.NilValue,
		frame:        undefined,
		hashTab:      undefined,
		_isObject:    undefined,
		_isLocked:    undefined,
		car:          undefined,
		cdr:          undefined,
		enClos:       RValues.NilValue,
		address:      undefined,
		protected:    undefined,
		offset:       undefined,
	};
}

/**
 * Detects the serialization type used for the RDA-file.
 * @param buf - Buffer with decompressed RDA-file content
 * @returns Serialization type of decompressed RDA-file
 * @remarks
 * Based on the original R implementation:
 * https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L1808-L1858
 */
function determineSerializationType(buf: Buffer): SerializationTypes {
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
 * @param buffer - Buffer with decompressed RDA-file content
 * @returns Deserialized RDA-file
 * @remarks
 * Based on the original R implementation:
 * https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/saveload.c#L1923-L1972
 */
function deserialize2(buffer: Buffer): RObject | RValues.NilValue{
	offset = 0;

	const serializationType = determineSerializationType(buffer);

	offset += 5;

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
		const result = deserialize(buffer);
		currentDepth--;
		return result;
	}
	return RValues.NilValue;
}

/**
 * Deserializes a decompressed RDA-file.
 * @param buffer - Buffer with decompressed RDA-file content
 * @returns Deserialized RDA-file
 * @remarks
 * Based on the original R implementation:
 * https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L2237-L2292
 */
function deserialize(buffer: Buffer) {

	switch(String.fromCodePoint(buffer[offset])) {
		case 'A': format = 'ASCII'; break; /* also for asciihex */
		case 'B': format = 'BINARY'; break;
		case 'X': format = 'XDR'; break;
		case '\n':
			if(String.fromCodePoint(buffer[offset + 1]) === 'A') {
				format = 'ASCII';
				offset += 1;
			}
			break;
		default:
			throw new Error('unknown input format');
	}

	offset += 2;

	const version = inInteger(buffer) as number;
	const writerVersion = inInteger(buffer) as number;
	const minReaderVersion = inInteger(buffer) as number;

	switch(version) {
		case 2: break;
		case 3:
		{
			const neLen = inInteger(buffer) as number;
			if(neLen > RCodeSetMax || neLen < 0)  {
				throw new Error('invalid length of encoding name');
			}
			const nativeEncoding = inString(buffer, neLen);
			// console.log('Encoding detected: ', nativeEncoding);
			break;
		}
		default:
		{
			const [vw, pw, sw] = decodeVersion(writerVersion);
			if(minReaderVersion < 0) {
				throw new Error(`cannot read unreleased workspace version ${version} written by experimental R ${vw}.${pw}.${sw}`);
			} else {
				const [vm, pm, sm] = decodeVersion(minReaderVersion);
				throw new Error(`cannot read unreleased workspace version ${version} written by experimental R ${vw}.${pw}.${sw}; need R ${vm}.${pm}.${sm} or newer`);
			}
		}
	}

	/* Read the actual object back */
	const refTable: RObject[] = [];

	return readItem(refTable, buffer);
}

/**
 * Determine integer value.
 * @param buffer - Buffer with decompressed RDA-file content
 * @returns number
 * @remarks
 * Based on the original R implementation:
 * https://github.com/wch/r-source/blob/2196e6982a8f49082ee5c3d3521f6dd6596ea72c/src/main/serialize.c#L396-L420
 */
function inInteger(buffer: Buffer): number | RValues {
	switch(format) {
		case 'ASCII': {
			const word = inWord(buffer, 128);
			if(word === 'NA') {
				return RValues.NaInteger;
			}
			const i = Number.parseInt(word, 10);
			if(Number.isNaN(i)) {
				throw new Error('read error');
			}
			return i;
		}
		case 'BINARY': {
			const i = buffer.readInt32LE(offset);
			offset += 4;
			return i;
		}
		case 'XDR':{
			const i = buffer.readInt32BE(offset);
			offset += 4;
			return i;
		}
		default:
			return RValues.NaInteger;
	}
}

function inWord(buffer: Buffer, size: number): string {
	let i = 0;
	let c;
	const word = new Array(size);

	do{
		c = inChar(buffer);
		if(c === -1){
			throw new Error('read error');
		}
	} while(isSpace(c));

	while(!isSpace(c) && i < size) {
		word[i++] = String.fromCodePoint(c);
		c = inChar(buffer);
	}
	if(i == size) {
		throw new Error('read error');
	}

	return word.join('');
}

function inChar(buffer: Buffer): number {
	if(offset >= buffer.length) {
		return -1;
	}

	const char = buffer[offset];
	offset++;
	return char;
}

function isSpace(c: number): boolean {
	return c >= 9 && c <= 13 || c === 32;
}

function inString(buffer: Buffer, len: number): string {
	if(format === 'ASCII') {
		if(len > 0){
			const result = [];

			while(offset < buffer.length && isSpace(buffer[offset++])){
				;
			}
			offset--;

			for(let i = 0; i < len; i++) {
				let c = String.fromCodePoint(buffer[offset++]);
				if(c === '\\'){
					switch(c = String.fromCodePoint(buffer[offset++])){
						case 'n': result.push('\n'); break;
						case 't': result.push('\t'); break;
						case 'v': result.push('\v'); break;
						case 'b': result.push('\b'); break;
						case 'r': result.push('\r'); break;
						case 'f': result.push('\f'); break;
						case 'a': result.push('\a'); break;
						case '\\': result.push('\\'); break;
						case '?': result.push('\?'); break;
						case '\'': result.push('\''); break;
						case '\"': result.push('\"'); break;
						case '0': case '1': case '2': case '3':
						case '4': case '5': case '6': case '7': {
							let d = 0;
							let j = 0;
							while('0' <= c && c < '8' && j < 3) {
								d = d * 8 + (Number.parseInt(c));
								c = String.fromCodePoint(buffer[offset++]);
								j++;
							}
							result.push(String.fromCodePoint(d));
							offset--;
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
		const bytes = buffer.subarray(offset, offset + len);
		offset += len;
		return bytes.toString('utf8');
	}
}

function decodeVersion(writerVersion: number) {
	const v = writerVersion / 65536;
	writerVersion = writerVersion % 65536;
	const p = writerVersion / 256;
	writerVersion = writerVersion % 256;
	const s = writerVersion;

	return [v,p,s];
}

function readItem(refTable: RObject[], buffer: Buffer): RObject | RValues.NilValue {
	const flags = inInteger(buffer) as number;
	return readItemRecursive(flags, refTable, buffer);
}

export enum SexpType {
	NilSxp       = 0,
	SymSxp       = 1,
	ListSxp      = 2,
	CloSxp       = 3,
	EnvSxp       = 4,
	PromSxp	     = 5,
	LangSxp	     = 6,
	SpecialSxp   = 7,
	BuiltInSxp    = 8,
	CharSxp	     = 9,
	LglSxp	    = 10,
	IntSxp	    = 13,
	RealSxp	    = 14,
	CplxSxp	    = 15,
	StrSxp	    = 16,
	DotSxp	    = 17,
	AnySxp	    = 18,
	VecSxp	    = 19,
	ExprSxp	    = 20,
	BcodesSxp    = 21,
	ExtptrSxp   = 22,
	WeakRefSxp  = 23,
	RawSxp      = 24,
	ObjSxp      = 25,
	S4Sxp       = 25,
	NewSxp      = 30,
	FreeSxp     = 31,
	FunSxp      = 99,
	RefSxp            = 255,
	NilValueSxp      = 254,
	GlobalEnvSxp     = 253,
	UnboundValueSxp  = 252,
	MissingArgSxp    = 251,
	BaseNamespaceSxp = 250,
	NamespaceSxp      = 249,
	PackageSxp        = 248,
	PersistSxp        = 247,
	ClassRefSxp       = 246,
	GenericRefSxp     = 245,
	BcRepDef          = 244,
	BcRepRef          = 243,
	EmptyEnvSxp	  = 242,
	BaseEnvSxp	  	  = 241,
	AltLangSxp       = 240,
	AttrListSxp       = 239,
	AltRepSxp	      = 238,
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

function R_FindNamespace1(info: RObject): RObject {
	const where = newEmptyRObject();
	where.type = SexpType.CharSxp;
	where.value = lastName;
	const code = `..getNamespace("${info.value[0].name as string}", "${where.value as string}")`;
	const shell = new RShellExecutor();
	const result = shell.run(code);
	shell.close();
	const val = newEmptyRObject();
	val.type = SexpType.EnvSxp;
	if(result == '<environment: R_GlobalEnv>') {
		val.value = RValues.GlobalEnv; // maybe GlobalEnvSxp?
	} else {
		console.log(result);
	}
	return val;
}

function readItemRecursive(flags: number, refTable: RObject[], buffer: Buffer): RObject | RValues.NilValue {
	const [type, levels, object, hasAttribute, _hasTag] = unpackFlags(flags);

	let s: RObject = newEmptyRObject();

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
		case SexpType.RefSxp: return getReadRef(refTable, inRefIndex(buffer, flags));
		case SexpType.PersistSxp: {
			s = inStringVec(buffer, refTable);
			addReadRef(refTable, s);
			return s;
		}
		case SexpType.AltRepSxp:
		{
			currentDepth++;
			console.warn('AltReps are not supported yet!');
			const _info = readItem(refTable, buffer) as RObject;
			const _state = readItem(refTable, buffer) as RObject;
			const _attr = readItem(refTable, buffer) as RObject;
			// s = ALTREP_UNSERIALIZE_EX(info, state, attr, object, levels);
			currentDepth--;
			return s;
		}
		case SexpType.SymSxp: {
			currentDepth++;
			s = readItem(refTable, buffer) as RObject;
			currentDepth--;
			s.type = SexpType.SymSxp;
			addReadRef(refTable, s);
			return s;
		}
		case SexpType.PackageSxp:
		{
			s = inStringVec(buffer, refTable);
			// s = rFindPackageEnv(s); --> Here we would have to insert package infos
			addReadRef(refTable, s);
			return s;
		}
		case SexpType.NamespaceSxp:
			s = inStringVec(buffer, refTable);
			s = R_FindNamespace1(s); // --> Here we would have to insert namespace infos
			addReadRef(refTable, s);
			return s;
		case SexpType.EnvSxp:
		{
			const locked = inInteger(buffer);

			s.type = SexpType.EnvSxp;

			/* MUST register before filling in */
			addReadRef(refTable, s);

			/* Now fill it in  */
			currentDepth++;
			SetEnClos(s, readItem(refTable, buffer) as RObject);
			s.frame = readItem(refTable, buffer) as RObject;
			s.hashTab = readItem(refTable, buffer) as RObject;
			s.attributes = (readItem(refTable, buffer) as RObject).attributes;

			currentDepth--;

			if(s.attributes?.some(e => e.name === RValues.ClassSymbol)){
				/* We don't write out the object bit for environments,
   				so reconstruct it here if needed. */

				s._isObject = true;
			}
			// R_RestoreHashCount(s);
			if(locked) {
				s._isLocked = false;
			}
			/* Convert a NULL enclosure to baseenv() */
			if(s.enClos === RValues.NilValue) {
				SetEnClos(s, {
					value: RValues.BaseEnv,
					type:  SexpType.EnvSxp,
				} as RObject);
			}
			return s;
		}
		case SexpType.ListSxp:
		case SexpType.LangSxp:
		case SexpType.CloSxp:
		case SexpType.PromSxp:
		case SexpType.DotSxp:
			return readItemIterative(flags, refTable, buffer);
		default:
		/* These break out of the switch to have their ATTR,
		   LEVELS, and OBJECT fields filled in.  Each leaves the
		   newly allocated value PROTECTed */
			switch(type) {
				case SexpType.ExtptrSxp: {
					s.type = type;
					addReadRef(refTable, s);
					s.address = null;
					currentDepth++;
					s.protected = readItem(refTable, buffer) as RObject;
					s.tag = readItem(refTable, buffer) as RObject | undefined;
					currentDepth--;
					break;
				}
				case SexpType.WeakRefSxp:
					s.value = R_MakeWeakRef(RValues.NilValue, RValues.NilValue, RValues.NilValue, false);
					addReadRef(refTable, s);
					break;
				case SexpType.SpecialSxp:
				case SexpType.BuiltInSxp:
					{
						/* These are all short strings */
						const len = inInteger(buffer) as number;
						if(len < 0) {
							throw new Error('invalid length');
						}
						const name = inString(buffer, len);

						if(R_FunTabOffsets[name]) {
							s.value = mkPRIMSXP(name, SexpType.BuiltInSxp);
						} else {
							throw new Error(`unrecognized internal function name "${name}"`);
							s.value = RValues.NilValue;
						}
					}
					break;
				case SexpType.CharSxp: {
					/* these are currently limited to 2^31 -1 bytes */
					const len = inInteger(buffer) as number;
					if(len < -1) {
						throw new Error('invalid length');
					} else if(len == -1) {
						s.name = RValues.NaString;
					} else if(len < 1000) {
						s.name = readChar(buffer, len, levels);
					} else {
						s.name = readChar(buffer, len, levels);
					}
					break;
				}
				case SexpType.LglSxp:
				case SexpType.IntSxp:
				{
					const len = readLength(buffer);
					s.type = type;
					s.value = inIntegerVec(buffer, len);
					break;
				}
				case SexpType.RealSxp:
				{
					const len = readLength(buffer);
					s.type = type;
					s.value = inRealVec(buffer, len);
					break;
				}
				case SexpType.CplxSxp: {
					const len = readLength(buffer);
					s.type = type;
					s.value = inComplexVec(buffer, len);
					break;
				}
				case SexpType.StrSxp: {
					const len = readLength(buffer);
					s.type = type;
					s.value = new Array(len);
					currentDepth++;
					for(let count = 0; count < len; ++count) {
						SET_STRING_ELT(s, count, readItem(refTable, buffer) as RObject);
					}
					currentDepth--;

					break;
				}
				case SexpType.VecSxp:
				case SexpType.ExprSxp: {
					const len = readLength(buffer);
					s.type = type;
					s.value = new Array(len);
					currentDepth++;
					for(let count = 0; count < len; ++count) {
						SET_VECTOR_ELT(s, count, readItem(refTable, buffer) as RObject);
					}
					currentDepth--;
					break;
				}
				case SexpType.BcodesSxp:
					s = readBC(refTable, buffer);
					break;
				case SexpType.ClassRefSxp:
					throw new Error('this version of R cannot read class references');
				case SexpType.GenericRefSxp:
					throw new Error('this version of R cannot read generic function references');
				case SexpType.RawSxp: {
					const len = readLength(buffer);
					s.type = type;
					s.value = [];
					switch(format) {
						case 'ASCII':
							for(let ix = 0; ix < len; ix++) {
								const word = inWord(buffer, 128);
								(s.value as number[])[ix] = Number.parseInt(word, 16);
							}
							break;
						default: {
							let t = 0;
							for(let done = 0; done < len; done += t) {
								t = Math.min(ChunkSize, len - done);
								(s.value as number[])[done] = buffer[offset];
								offset +=1;
							}
						}
					}
					break;
				}
				case SexpType.ObjSxp:
					// s = R_allocObject();
					s.type = SexpType.ObjSxp;
					break;
				default:
					s.value = RValues.NilValue; /* keep compiler happy */
					throw new Error(`ReadItem: unknown type ${type}, perhaps written by later version of R`);
			}
			if(type !== SexpType.CharSxp) {
				s.levels = levels;
			}
			s.object = object;
			if(s.type === SexpType.CharSxp) {
			/* With the CHARSXP cache maintained through the ATTRIB
			   field that field has already been filled in by the
			   mkChar/mkCharCE call above, so we need to leave it
			   alone.  If there is an attribute (as there might be if
			   the serialized data was created by an older version) we
			   read and ignore the value. */
				currentDepth++;
				if(hasAttribute) {
					readItem(refTable, buffer);
				}
				currentDepth--;
			} else {
				currentDepth++;
				s.attributes = hasAttribute ? [readItem(refTable, buffer) as RObject] : undefined;
				currentDepth--;
			}
			if(s.type === SexpType.BcodesSxp && !R_BCVersionOK(s)) {
				return R_BytecodeExpr(s);
			}
			return s;
	}
}

function unpackFlags(flags: number): [number, number, boolean, boolean, boolean] {
	const pType = flags & 255;
	const pLevels = flags >> 12;
	const pIsObj = (flags & (1 << 8)) !== 0;
	const pHasAttr =  (flags & (1 << 9)) !== 0;
	const pHasTag =  (flags & (1 << 10)) !== 0;

	return [pType, pLevels, pIsObj, pHasAttr, pHasTag];
}

function getReadRef(refTable: RObject[], index: number) {
	const i = index - 1;

	if(i < 0 || i >= refTable.length) {
		throw new Error('reference index out of range');
	}
	return refTable[i];
}

function inRefIndex(buffer: Buffer, flags: number): number {
	const i = flags >> 8;
	if(i === 0) {
		return inInteger(buffer) as number;
	} else {
		return i;
	}
}

function addReadRef(refTable: RObject[], value: RObject) {
	refTable.push(value);
}

function inStringVec(buffer: Buffer, refTable: RObject[]): RObject {
	if(inInteger(buffer) !== 0) {
		throw new Error('names in persistent strings are not supported yet');
	}
	const len = inInteger(buffer) as number;
	const s = newEmptyRObject();
	s.type = SexpType.CharSxp;
	s.value = new Array<RObject>(len);
	currentDepth++;
	for(let i = 0; i < len; i++) {
		(s.value as RObject[])[i] = readItem(refTable, buffer) as RObject;
	}
	currentDepth--;
	return s;
}

function SetEnClos(x: RObject, v: RObject){
	if(v.value === RValues.NilValue) {
		v.value = RValues.EmptyEnv;
	}
	if(v.type !== SexpType.EnvSxp) {
		throw new Error("'parent' is not an environment");
	}
	for(let e: RObject | RValues.NilValue = v; e !== RValues.NilValue; e = e.enClos as RObject | RValues.NilValue){
		if(e === x) {
			throw new Error('cycles in parent chains are not allowed');
		}
	}
	x.enClos = v;
}

function readItemIterative(flags: number, refTable: RObject[], buffer: Buffer): RObject{
	/* Building dotted pair objects with recursion on the CDR will
       overflow the PROTECT stack for long lists. Instead we build
       pairlists in an iterative loop */

	let sFirst: RObject | null = null;
	let sLast: RObject = newEmptyRObject();

	let type = flags & 255;


	/* An assertion here guarantees that we go through the loop at
       least once. This make for cleaner exit code and avoids a
       potential infinite loop: ReadItem_Recursive <->
       ReadIterm_iterative */

	const validIterativeTypes = [
		SexpType.ListSxp,   // 2
		SexpType.LangSxp,   // 6
		SexpType.CloSxp,    // 3
		SexpType.PromSxp,   // 5
		SexpType.DotSxp     // 17
	];

	if(!validIterativeTypes.includes(type)){
		throw new Error('Wrong type.');
	}

	while(validIterativeTypes.includes(type)) {
		const unpackedFlags = unpackFlags(flags);
		type = unpackedFlags[0] as SexpType;
		const levels = unpackedFlags[1];
		const isObject = unpackedFlags[2];
		const hasAttr = unpackedFlags[3];
		const hasTag = unpackedFlags[4];
		const s = newEmptyRObject();

		s.type = type;
		s.levels = levels;
		s.object = isObject;
		currentDepth++;

		s.attributes = hasAttr ? [readItem(refTable, buffer) as RObject] : undefined;
		s.tag = hasTag ? readItem(refTable, buffer) : undefined;

		if(hasTag && currentDepth == 1 && typeof s.tag === 'object' && s.tag !== undefined) {
			lastName = s.tag.name;
			setLastName = true;
		}

		s.car = readItem(refTable, buffer);
		currentDepth--;

		if(sFirst === null) {
			sFirst = s; /* First iteration: start list */
		} else {
			sLast.cdr = s;
		}
		sLast = s;

		/* For reading closures and promises stored in earlier
		   versions, convert NULL env to baseenv() */
		if(type === SexpType.CloSxp && s.cloEnv === RValues.NilValue) {
			s.cloEnv = RValues.EmptyEnv;
		} else if(type === SexpType.PromSxp && s.prEnv === RValues.NilValue) {
			s.prEnv = RValues.BaseEnv;
		}

		flags = inInteger(buffer) as number;
		type = flags & 255;
	}

	currentDepth++;
	const s = readItemRecursive(flags, refTable, buffer);
	currentDepth--;
	sLast.cdr = s as RObject;
	return sFirst as RObject;
}

function R_MakeWeakRef(key, val, fin, onexit){
	switch(fin) {
		case SexpType.NilSxp:
		case SexpType.CloSxp:
		case SexpType.BuiltInSxp:
		case SexpType.SpecialSxp:
			break;
		default:
			throw new Error('finalizer must be a function or NULL');
	}
	return newWeakRef(key, val, fin, onexit);
}

function newWeakRef(key, val, fin, onexit){
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
	const w = newEmptyRObject();

	w.type = SexpType.WeakRefSxp;

	if(key !== RValues.NilValue){
		/* If the key is R_NilValue we don't register the weak reference.
		   This is used in loading saved images. */
		// 	SET_WEAKREF_KEY(w, key);
		w.key = key;
		// 	SET_WEAKREF_VALUE(w, val);
		w.value = val;
		// 	SET_WEAKREF_FINALIZER(w, fin);
		w.finalizer = fin;
		// 	SET_WEAKREF_NEXT(w, RWeakRefs);
		w.next = RWeakRefs;
		// 	CLEAR_READY_TO_FINALIZE(w);
		w.gp &= ~1;

		if(onexit){
			w.gp |= 2;
		} else {
			w.gp &= ~2;
		}

		RWeakRefs = w;
	}
	return w;
}

function mkPRIMSXP(index: number, evaluation: number){
	// TODO
	const type = evaluation ? SexpType.BuiltInSxp : SexpType.SpecialSxp;
	let primCache = null;
	let funTabSize = 0;
	if(primCache === null){

		/* compute the number of entries in R_FunTab */
		funTabSize = Object.keys(R_FunTabOffsets).length;

		/* allocate and protect the cache */
		primCache = newEmptyRObject();
		primCache.type = SexpType.VecSxp;
		primCache.value = funTabSize;
	}

	if(index < 0 || index >= funTabSize) {
		throw new Error('offset is out of R_FunTab range');
	}

	let result = VECTOR_ELT(primCache, index);

	if(result === RValues.NilValue || result === undefined) {
		result = newEmptyRObject();
		result.type = type;
		result.offset = index;
		// SET_VECTOR_ELT(primCache, index, result);
	} else if(result.type !== type) {
		throw new Error('requested primitive type is not consistent with cached value');
	}

	return result;
}

function readChar(buffer: Buffer, len: number, levs: number){
	const cbuf = inString(buffer, len);
	if(levs & (1 << 3))  {
		// return new TextDecoder('utf-8').decode(cbuf);
	}
	if(levs & (1 << 2)) {
		// return new TextDecoder('iso-8859-1').decode(cbuf);
	}
	// if (levs & (1 << 1)) return mkCharLenCE(buf, length, CE_BYTES); --> ??? TODO
	if(levs & (1 << 6)) {
		return cbuf;
	}

	// TODO

	// /* native encoding, not ascii */
	// if (!stream->native_encoding[0] || /* original native encoding unknown */
	//     (stream->nat2nat_obj == (void *)-1 && /* translation impossible or disabled */
	//      stream->nat2utf8_obj == (void *)-1))
	// return mkCharLenCE(buf, length, CE_NATIVE);
//     /* try converting to native encoding */
//     if (!stream->nat2nat_obj &&
//         !strcmp(stream->native_encoding, R_nativeEncoding())) {
// 	/* No translation needed. Performance optimization but also leaves
// 	   invalid strings in their encoding undetected. */
// 	stream->nat2nat_obj = (void *)-1;
// 	stream->nat2utf8_obj = (void *)-1;
//     }
//     if (!stream->nat2nat_obj) {
// 	char *from = native_fromcode(stream);
// 	stream->nat2nat_obj = Riconv_open("", from);
// 	if (stream->nat2nat_obj == (void *)-1)
// 	    warning(_("unsupported conversion from '%s' to '%s'"), from, "");
//     }
//     if (stream->nat2nat_obj != (void *)-1) {
// 	cetype_t enc = CE_NATIVE;
// 	if (known_to_be_utf8) enc = CE_UTF8;
// 	else if (known_to_be_latin1) enc = CE_LATIN1;
// 	SEXP ans = ConvertChar(stream->nat2nat_obj, buf, length, enc);
// 	if (ans != R_NilValue)
// 	    return ans;
// 	if (known_to_be_utf8) {
// 	    /* nat2nat_obj is converting to UTF-8, no need to use nat2utf8_obj */
// 	    stream->nat2utf8_obj = (void *)-1;
// 	    invalid_utf8_warning(buf, native_fromcode(stream));
// 	}
//     }
//     /* try converting to UTF-8 */
//     if (!stream->nat2utf8_obj) {
// 	char *from = native_fromcode(stream);
// 	stream->nat2utf8_obj = Riconv_open("UTF-8", from);
// 	if (stream->nat2utf8_obj == (void *)-1) {
// 	    /* very unlikely */
// 	    warning(_("unsupported conversion from '%s' to '%s'"),
// 	            from, "UTF-8");
// 	    warning(_("strings not representable in native encoding will not be translated"));
// 	} else
// 	    warning(_("strings not representable in native encoding will be translated to UTF-8"));
//     }
//     if (stream->nat2utf8_obj != (void *)-1) {
// 	SEXP ans = ConvertChar(stream->nat2utf8_obj, buf, length, CE_UTF8);
// 	if (ans != R_NilValue)
// 	    return ans;
// 	invalid_utf8_warning(buf, native_fromcode(stream));
//     }
//     /* no translation possible */
//     return mkCharLenCE(buf, length, CE_NATIVE);
// }
}

function readLength(buffer: Buffer): number {
	const len = inInteger(buffer) as number;
	if(len < -1) {
		throw new Error('negative serialized length for vector');
	}
	if(len == -1) {
		const len1 = inInteger(buffer) as number; /* upper part */
		const len2 = inInteger(buffer) as number; /* lower part */
		const xlen = len1;
		/* sanity check for now */
		if(len1 > 65536) {
			throw new Error('invalid upper part of serialized vector length');
		}
		return (xlen << 32) + len2;
	} else {
		return len;
	}
}

function inIntegerVec(buffer: Buffer, len: number): number[]{
	switch(format) {
		case 'XDR':
		{
			let t = 0;
			const result: number[] = [];
			for(let done = 0; done < len; done += t) {
				t = Math.min(ChunkSize, len - done);
				//somthing wrong here!
				for(let cnt = 0; cnt < t; cnt++) {
					if(offset + 4 > buffer.length) {
						throw new Error('XDR read failed');
					}
					result[done + cnt] = buffer.readInt32BE(offset);
					offset += 4;
				}
			}
			return result;
		}
		case 'BINARY':
		{
			// TODO: debug!
			let t = 0;
			const result = [];
			for(let done = 0; done < len; done += t) {
				t = Math.min(ChunkSize, length - done);
				// 		stream->InBytes(stream, INTEGER(obj) + done,
				// 			(int)(sizeof(int) * this));
				const view = new DataView(buffer, offset, t * 4);
				const value = view.getInt32(t * 4, true);
				result[done] = value;
				offset += t*4;
			}
			return result;
		}
		default: {
			const result: number[] = [];
			for(let cnt = 0; cnt < len; cnt++) {
				result[cnt] = inInteger(buffer);
			}
			return result;
		}
	}
}

function inRealVec(buffer: Buffer, len: number): (number | RValues)[] | null[]{
	// TODO
	switch(format) {
		case 'XDR': {
			const result = [];
			let t = 0;
			for(let done = 0; done < len; done += t) {
				t = Math.min(ChunkSize, len - done);

				const chunkBytes = t * SizeOfDouble;
				const chunk = buffer.subarray(offset, offset + chunkBytes);
				offset += chunkBytes;

				for(let i = 0; i < t; i++) {
					const value = chunk.readDoubleBE(i * SizeOfDouble);
					result.push(value);
				}
			}
			return result;
		}
		case 'BINARY':
		{
			const result = [];
			const t = 0;
			for(let done = 0; done < len; done += t) {
				const t = Math.min(ChunkSize, len - done);
				// 		    stream->InBytes(stream, REAL(obj) + done,
				// 			    (int)(sizeof(double) * this));
			}
			return result;
		}
		default: {
			const result: (number | RValues)[] = [];
			for(let cnt = 0; cnt < len; cnt++) {
				result[cnt] = inReal(buffer);
			}
			return result;
		}
	}
}

function inReal(buffer: Buffer): number | RValues {
	switch(format){
		case 'ASCII': {
			const word = inWord(buffer, 128);

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
					throw new Error('Read error: Invalid numeric ASCII format');
				}
				return d;
			}
		}
		case 'BINARY': {
			const d = buffer.readDoubleLE(offset);
			offset += 8;
			return d;
		}
		case 'XDR': {
			const d = buffer.readDoubleBE(offset);
			offset += 8;
			return d;
		}
		default:
			return RValues.NilValue;
	}
}

function inComplexVec(buffer: Buffer, len: number): {r: number | RValues, i: number| RValues}[] {
	// TODO
	switch(format) {
		case 'XDR': {
			const result: { r: number | RValues, i: number | RValues }[] = [];
			let t = 0;
			for(let done = 0; done < len; done += t) {
				t = Math.min(ChunkSize, len - done);
				for(let cnt = 0; cnt < t; cnt++) {
					result[done] = inComplex(buffer);
				}
			}
			return result;
		}
		case 'BINARY': {
			let t = 0;
			for(let done = 0; done < len; done += t) {
				t = Math.min(ChunkSize, length - done);
				// stream->InBytes(stream, COMPLEX(obj) + done,
				// 	(int)(sizeof(Rcomplex) * this));
			}
			return [];
		}
		default: {
			const result: {r: number, i: number}[] = [];
			for(let cnt = 0; cnt < len; cnt++) {
				result[cnt] = inComplex(buffer);
			}
			return result;
		}
	}
}

function inComplex(buffer: Buffer) {
	const r = inReal(buffer);
	const i = inReal(buffer);
	return { r, i };
}

function SET_STRING_ELT(x: RObject, i: number, v: RObject) {
	if(i < 0 || i >= (x.value as Array<string>).length) {
		throw new Error('index out of bounds');
	}
	x.value[i] = v.name;
}

function SET_VECTOR_ELT(x: RObject, i: number, v: RObject) {
	/*  we need to allow vector-like types here */
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

function readBC(refTable: RObject[], buffer: Buffer): RObject {
	const reps = newEmptyRObject();
	reps.type = SexpType.VecSxp;
	reps.value = new Array(inInteger(buffer) as number);
	return readBC1(refTable, reps, buffer);
}

function R_registerBC(bytes: RObject, s: RObject) {
	throw new Error('not implemented yet');
}

function readBC1(refTable: RObject[], reps: RObject, buffer: Buffer): RObject {
	const s = newEmptyRObject();
	s.type = SexpType.BcodesSxp;
	currentDepth++;
	s.car = readItem(refTable, buffer) as RObject;
	currentDepth--;
	const bytes = s.car;
	// s.car = R_bcEncode(bytes);
	s.cdr = ReadBCConsts(refTable, reps, buffer); /* consts */
	s.tag = undefined; /* expr */
	// R_registerBC(bytes, s);
	return s;
}

function _R_bcEncode(_bytes: Int32Array){
	throw new Error('Not implemented');
}

function ReadBCConsts(refTable: RObject[], reps: RObject, buffer: Buffer): RObject {
	const n = inInteger(buffer) as number;
	const ans = newEmptyRObject();
	ans.type = SexpType.VecSxp;
	ans.value = new Array(n);
	for(let i = 0; i < n; i++) {
		const type = inInteger(buffer);
		switch(type) {
			case SexpType.BcodesSxp: {
				const c = readBC1(refTable, reps, buffer);
				SET_VECTOR_ELT(ans, i, c);
				break;
			}
			case SexpType.LangSxp:
			case SexpType.ListSxp:
			case SexpType.BcRepDef:
			case SexpType.BcRepRef:
			case SexpType.AltLangSxp:
			case SexpType.AttrListSxp: {
				const c = ReadBCLang(type, refTable, reps, buffer);
				SET_VECTOR_ELT(ans, i, c);
				break;
			}
			default:
				currentDepth++;
				SET_VECTOR_ELT(ans, i, readItem(refTable, buffer) as RObject);
				currentDepth--;
		}
	}
	return ans;
}

function ReadBCLang(type: SexpType, refTable: RObject[], reps: RObject, buffer: Buffer): RObject {
	switch(type) {
		case SexpType.BcRepRef:
			return VECTOR_ELT(reps, inInteger(buffer) as number) as RObject;
		case SexpType.BcRepDef:
		case SexpType.LangSxp:
		case SexpType.ListSxp:
		case SexpType.AltLangSxp:
		case SexpType.AttrListSxp:
		{
			let pos = -1;
			let hasAttr = false;
			if(type == SexpType.BcRepDef) {
				pos = inInteger(buffer) as number;
				type = inInteger(buffer) as number;
			}
			switch(type) {
				case SexpType.AltLangSxp: type = SexpType.LangSxp; hasAttr = true; break;
				case SexpType.AttrListSxp: type = SexpType.ListSxp; hasAttr = true; break;
			}
			const ans = newEmptyRObject();
			ans.type = type;
			if(pos >= 0) {
				SET_VECTOR_ELT(reps, pos, ans);
			}
			currentDepth++;
			if(hasAttr) {
				ans.attributes?.push(readItem(refTable, buffer) as RObject);
			}
			ans.tag = readItem(refTable, buffer) as RObject;
			currentDepth--;
			ans.car = ReadBCLang(inInteger(buffer) as number, refTable, reps, buffer);
			ans.cdr = ReadBCLang(inInteger(buffer) as number, refTable, reps, buffer);
			return ans;
		}
		default:
		{
			currentDepth++;
			const res = readItem(refTable, buffer);
			currentDepth--;
			return res;
		}
	}
}

function VECTOR_ELT(x: RObject,  i: number): RObject | RValues.NilValue {
	// TODO
	/* We need to allow vector-like types here */
	if(x.type !== SexpType.VecSxp &&
		x.type !== SexpType.ExprSxp &&
		x.type !== SexpType.WeakRefSxp) {
		throw new Error(`VECTOR_ELT() can only be applied to a 'list', not a '${x.type}'`);
	}
	// "VECTOR_ELT", "list", R_typeToChar(x));
	if(i < 0 || i >= x.length) {
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

function R_BCVersionOK(s){
	// TODO
	if(s.type !== SexpType.BcodesSxp) {
		return false;
	}

	const pc = s.code;
	const version = pc;

	return (version >= 9 && version <= 12);
}

function R_BytecodeExpr(s: RObject): RObject | RValues.NilValue{
	if(s.type === SexpType.BcodesSxp) {
		if((s.cdr as RObject).value?.length > 0) {
			return VECTOR_ELT(s.cdr, 0);
		} else {
			return RValues.NilValue;
		}
	} else {
		return s;
	}
}

function ALTREP_UNSERIALIZE_EX(info: RObject, state, attr,objf: boolean,levs: number): RObject {
	// TODO
	const cSym = info.car;
	const pSym = (info.cdr as RObject).car;
	const type = (((info.cdr as RObject).cdr as RObject).car as RObject).type as SexpType;

	/* look up the class in the registry and handle failure */
	const clss = ALTREP_UNSERIALIZE_CLASS(info);
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

function ALTREP_UNSERIALIZE_CLASS(info: RObject) {
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

// function LookupClass(cSym: RObject, pSym: RObject) {
// 	const entry = LookupClassEntry(cSym, pSym);
// 	return entry === undefined ? undefined : entry.car;
// }

// function LookupClassEntry(cSym: RObject, pSym: RObject): RObject {
// 	for (const chain = CDR(Registry); chain !== RValues.NilValue; chain = CDR(chain))
// 	// if (TAG(CAR(chain)) == csym && CADR(CAR(chain)) == psym)
// 	// 	return CAR(chain);
// 	// return NULL;
// }

function restoreHashCount(s: RObject): RObject{
	if(s.hashTab !== RValues.NilValue) {
		const table = s.hashTab as RObject;
		const size = table.value.length;
		let count = 0;
		for(let i= 0; i < size; i++) {
			if(VECTOR_ELT(table, i) !== RValues.NilValue) {
				count++;
			}
		}
		// SET_HASHPRI(table, count);
		//TODO???
	}
}

function flattenRObject(node: RObject): RObject[] {
	const result:  RObject[] = [];

	function walk(n: RObject | null) {
		if(!n) {
			return;
		}

		const name = n.tag?.name;

		if(name !== undefined) {
			const copy: RObject = {
				name:         n.tag?.name,
				value:        n.car?.value,
				hasAttribute: n.hasAttribute,
				attributes:   n.attributes,
			};

			result.push(copy);
		}

		if(n.cdr !== undefined) {
			walk(n.cdr);
		}
	}
	walk(node);

	return result;
}




