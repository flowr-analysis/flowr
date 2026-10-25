import { DataFile } from './cmd-check-util';
import fs from 'fs';
import path from 'path';
import { type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { RRange } from '../../../util/r-version';
import { FlowrInlineTextFile } from '../../../project/context/flowr-file';
import { CompressionType, RDAParser } from '../../../project/plugins/file-plugins/files/flowr-rda-file';
import type { FlowrDescriptionFile } from '../../../project/plugins/file-plugins/files/flowr-description-file';
import type { PackageEntry } from './package-files';
import { type FileResult, fileFindings, firstLine, linesOf, MessageAtLocation, onPackageFiles } from './file-checks';

export type PackageDataKind =
	| 'data-directory' | 'lazydata' | 'compact-data' | 'compact-sysdata' | 'compression-depends' | 'serialization-version' | 'undocumented-data';

export type PackageDataResult = FileResult<PackageDataKind>;

export interface PackageDataConfig extends MergeableRecord {
	/** an uncompressed or ASCII save above this many bytes is flagged */
	readonly maxUncompressedSize: number
	/** report saves that a stronger compression would make much smaller */
	readonly checkCompaction:     boolean
	/** report data sets no Rd page documents */
	readonly checkUndocumented:   boolean
}

export interface PackageDataMetadata extends MergeableRecord {
	readonly inspectedDataFiles: number
	/** whether the package was read from the file system, which enables reading the objects a save holds */
	readonly onDisk:             boolean
}

const RdaFile = /\.(rda|RData)$/;
const DatalistLine = /^[^ :]+($|: +[A-Za-z.])/;
const LazyDataCompressions: readonly string[] = ['gzip', 'bzip2', 'xz', 'none'];
const SysData = 'R/sysdata.rda';

type Compression = 'gzip' | 'bzip2' | 'xz' | 'none' | 'unknown';

interface RdaHeader {
	readonly compress: Compression
	/** `undefined` if the content could not be read (e.g. xz, which flowR cannot decompress) */
	readonly ascii?:   boolean
	readonly version?: number
}

function compressionOf(buf: Buffer): Compression {
	const head = buf.toString('latin1', 0, 5);
	if(buf[0] === 0x1f && buf[1] === 0x8b) {
		return 'gzip';
	} else if(head.startsWith('BZh')) {
		return 'bzip2';
	} else if(buf[0] === 0xfd && head.slice(1) === '7zXZ') {
		return 'xz';
	}
	return /^RD[ABX][1-9]/.test(head) ? 'none' : 'unknown';
}

function rdaHeader(buf: Buffer, file: string): RdaHeader {
	const compress = compressionOf(buf);
	let plain: Buffer | undefined;
	try {
		const parser = new RDAParser(new FlowrInlineTextFile(file, ''), false);
		plain = compress === 'none' ? buf : compress === 'gzip' ? parser.decompress(buf, CompressionType.CompGz) : compress === 'bzip2' ? parser.decompress(buf, CompressionType.CompBz) : undefined;
	} catch{
		plain = undefined;
	}
	const m = /^RD([ABX])([1-9])/.exec(plain?.toString('latin1', 0, 4) ?? '');
	return m ? { compress, ascii: m[1] === 'A', version: Number(m[2]) } : { compress };
}

function objectNamesOf(file: string): string[] | undefined {
	try {
		return new RDAParser(new FlowrInlineTextFile(file, ''), true).parse()?.flatMap(o => o.name ? [o.name] : []);
	} catch{
		return undefined;
	}
}

/** the bytes of a save on disk, `undefined` for a file only known in memory */
function bytesOf(entry: PackageEntry): Buffer | undefined {
	try {
		return entry.stats === undefined ? undefined : fs.readFileSync(entry.absolute);
	} catch{
		return undefined;
	}
}

/** whether the DESCRIPTION declares `R (>= minimum)` in `Depends` */
function dependsOnR(desc: FlowrDescriptionFile | undefined, minimum: string): boolean {
	const depends = desc?.content().get('Depends')?.join(' ') ?? '';
	return [...depends.matchAll(/\bR\s*\(\s*(?:>=|>)\s*([0-9][0-9.-]*)\s*\)/g)].some(m => RRange.satisfies(m[1], `>= ${minimum}`));
}

/** Port of the data checks of `R CMD check`: `data/`, `LazyData`, save compression and serialization version, undocumented data sets. */
export const PACKAGE_DATA = {
	createSearch:        () => Q.from([]),
	processSearchResult: onPackageFiles({ inspectedDataFiles: 0, onDisk: false }, (pf, pkg, config, data) => {
		const ctx = data.inspectContext();
		const { results, add } = fileFindings<PackageDataKind>(pf);
		const desc = pkg.description;
		const entries = pf.entries;
		const isDir = (rel: string) => entries.some(e => e.isDirectory && e.relative === rel);
		const headers = new Map<PackageEntry, RdaHeader | undefined>();
		const headerOf = (e: PackageEntry): RdaHeader | undefined => {
			if(!headers.has(e)) {
				const bytes = bytesOf(e);
				headers.set(e, bytes && rdaHeader(bytes, e.absolute));
			}
			return headers.get(e);
		};

		const children = entries.filter(e => path.posix.dirname(e.relative) === 'data' && !path.posix.basename(e.relative).startsWith('.'));
		const datalist = children.find(e => e.relative === 'data/datalist');
		if(datalist?.isDirectory) {
			add('data-directory', datalist.relative, '\'data/datalist\' is a directory, but must be a file');
		} else if(datalist !== undefined) {
			const lines = linesOf(pf, datalist.relative);
			lines.forEach((line, i) => {
				if(!DatalistLine.test(line) && !(line === '' && i === lines.length - 1)) {
					add('data-directory', datalist.relative, `'data/datalist' contains a malformed line: '${line}'`, i + 1);
				}
			});
		}
		const isData = (e: PackageEntry) => !e.isDirectory && DataFile.test(path.posix.basename(e.relative));
		const dataSets = children.filter(e => e.relative !== 'data/datalist' && isData(e));
		for(const e of children) {
			if(e.relative !== 'data/datalist' && !isData(e)) {
				add('data-directory', e.relative, `'${e.relative}' is not of a type allowed in a 'data' directory`);
			}
		}

		const names = new Map<PackageEntry, string[]>();
		const namesOf = (e: PackageEntry): string[] => {
			if(!names.has(e)) {
				const base = path.posix.basename(e.relative).replace(DataFile, '');
				const objects = ctx.files.datasetObjects(base);
				names.set(e, (pf.onDisk && RdaFile.test(e.relative) ? objectNamesOf(e.absolute) : undefined) ?? (objects.length > 0 ? [...objects] : [base]));
			}
			return names.get(e) as string[];
		};
		const saves = dataSets.filter(e => RdaFile.test(e.relative));
		for(const e of saves) {
			if(pf.onDisk && namesOf(e).includes('.Random.seed')) {
				add('data-directory', e.relative, `object '.Random.seed' found in data set '${path.posix.basename(e.relative)}', please remove it`);
			}
		}
		for(const e of entries.filter(e => !e.isDirectory && RdaFile.test(e.relative))) {
			if((headerOf(e)?.version ?? 0) >= 3 && !dependsOnR(desc, '3.5.0')) {
				add('serialization-version', e.relative, `'${e.relative}' is saved with version 3 serialization, which only R >= 3.5.0 reads, declare it in Depends`);
			}
		}

		if(desc !== undefined) {
			const lazy = ['1', 'yes', 'true'].includes(desc.content().get('LazyData')?.join(' ').toLowerCase() ?? '');
			const compression = desc.content().get('LazyDataCompression')?.join(' ');
			const lazyDataAt = (field: string, message: string) => add('lazydata', 'DESCRIPTION', message, firstLine(pf, 'DESCRIPTION', new RegExp(`^${field}:`)));
			if(lazy && !isDir('data')) {
				lazyDataAt('LazyData', '\'LazyData\' is specified without a \'data\' directory');
				if(compression !== undefined) {
					lazyDataAt('LazyDataCompression', '\'LazyDataCompression\' is specified without a \'data\' directory');
				}
			} else if(!lazy && compression !== undefined) {
				lazyDataAt('LazyDataCompression', '\'LazyDataCompression\' is specified without \'LazyData\'');
			} else if(lazy && compression !== undefined && !LazyDataCompressions.includes(compression)) {
				lazyDataAt('LazyDataCompression', `undocumented value '${compression}' of field 'LazyDataCompression'`);
			}
		}

		const compacted = config.checkCompaction ? [...saves, ...entries.filter(e => !e.isDirectory && e.relative === SysData)] : [];
		for(const e of compacted) {
			const header = headerOf(e);
			const size = e.stats?.size ?? 0;
			if(header !== undefined && (header.ascii === true || header.compress === 'none') && size > config.maxUncompressedSize) {
				const reasons = [header.ascii ? 'ASCII format' : undefined, header.compress === 'none' ? 'uncompressed' : undefined].filter(r => r !== undefined);
				add(e.relative === SysData ? 'compact-sysdata' : 'compact-data', e.relative, `large data file saved inefficiently (${reasons.join(', ')}, ${Math.round(size / 1024)}Kb)`);
			}
		}
		if(compacted.some(e => ['bzip2', 'xz'].includes(headerOf(e)?.compress ?? '')) && !dependsOnR(desc, '2.10')) {
			add('compression-depends', 'DESCRIPTION', 'package needs dependence on R (>= 2.10) for data saved with bzip2 or xz compression', firstLine(pf, 'DESCRIPTION', /^Depends:/));
		}

		if(config.checkUndocumented && isDir('man')) {
			const index = ctx.files.documentation();
			for(const e of dataSets) {
				for(const name of namesOf(e).filter(n => !index.documents(n))) {
					add('undocumented-data', e.relative, `undocumented data set '${name}'`);
				}
			}
		}
		return { results, '.meta': { inspectedDataFiles: dataSets.length + entries.filter(e => e.relative === SysData).length, onDisk: pf.onDisk } };
	}),
	prettyPrint: MessageAtLocation,
	info:        {
		name:          'Package Data',
		tags:          [LintingRuleTag.CmdCheck],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Finds problems in `data/` and `R/sysdata.rda`: allowed file types, LazyData, compression, the serialization version R needs, and undocumented data sets.',
		defaultConfig: () => ({ maxUncompressedSize: 100_000, checkCompaction: true, checkUndocumented: true })
	}
} as const satisfies LintingRule<PackageDataResult, PackageDataMetadata, PackageDataConfig>;
