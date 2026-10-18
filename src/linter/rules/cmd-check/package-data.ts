import fs from 'fs';
import path from 'path';
import { LintingPrettyPrintContext, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../../linter-format';
import type { MergeableRecord } from '../../../util/objects';
import { Q } from '../../../search/flowr-search-builder';
import { LintingRuleTag } from '../../linter-tags';
import { SourceLocation } from '../../../util/range';
import { escapeRegex } from '../../../util/text/strings';
import { RRange } from '../../../util/r-version';
import { FlowrInlineTextFile } from '../../../project/context/flowr-file';
import { CompressionType, RDAParser } from '../../../project/plugins/file-plugins/files/flowr-rda-file';
import type { FlowrDescriptionFile } from '../../../project/plugins/file-plugins/files/flowr-description-file';
import { type CmdCheckResult, packageInfo } from './cmd-check-util';
import { type PackageEntry, type PackageFiles, packageFiles } from './package-files';

export type PackageDataKind =
	| 'data-directory' | 'lazydata' | 'compact-data' | 'compact-sysdata' | 'compression-depends' | 'serialization-version' | 'undocumented-data';

export interface PackageDataResult extends CmdCheckResult {
	/** the sub-check of `R CMD check` the finding stems from */
	readonly kind: PackageDataKind
	/** the data file (or `DESCRIPTION`) the finding is about, relative to the package root */
	readonly file: string
}

export interface PackageDataConfig extends MergeableRecord {
	/** the extensions (without the leading dot) a file in `data` may have, `R CMD check` default */
	readonly dataExtensions:      readonly string[]
	/** an uncompressed or ASCII save above this many bytes is flagged (default `100000`) */
	readonly maxUncompressedSize: number
	/** whether to check that saves are compressed (`R CMD check` does with `_R_CHECK_COMPACT_DATA_`, default `true`) */
	readonly checkCompaction:     boolean
	/** whether to check that the data sets are documented in `man` (default `true`) */
	readonly checkUndocumented:   boolean
}

export interface PackageDataMetadata extends MergeableRecord {
	/** the data files (and the system data) inspected */
	readonly inspectedDataFiles: number
	/** whether the package was read from the file system, which enables reading the objects a save holds */
	readonly onDisk:             boolean
}

const DefaultDataExtensions: readonly string[] = ['R', 'r', 'RData', 'rdata', 'rda', 'tab', 'txt', 'TXT', 'tab.gz', 'txt.gz', 'tab.bz2', 'txt.bz2', 'tab.xz', 'txt.xz', 'csv', 'CSV', 'csv.gz', 'csv.bz2', 'csv.xz'];
const LazyDataCompressions: ReadonlySet<string> = new Set(['gzip', 'bzip2', 'xz', 'none']);
const RdaFile = /\.(rda|RData)$/;
const DatalistLine = /^[^ :]+($|: +[A-Za-z.])/;

type Compression = 'gzip' | 'bzip2' | 'xz' | 'none' | 'unknown';

/** What the header of an `.rda` file says: how it is compressed, whether it is ASCII and its serialization version. */
interface RdaHeader {
	readonly compress: Compression
	/** `undefined` if the content could not be read (e.g. xz, which flowR cannot decompress) */
	readonly ascii?:   boolean
	readonly version?: number
}

function compressionOf(buf: Buffer): Compression {
	if(buf[0] === 0x1f && buf[1] === 0x8b) {
		return 'gzip';
	}
	const head = buf.toString('latin1', 0, 5);
	if(head.startsWith('BZh')) {
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

/** The object names a save holds, read from disk; `undefined` if they cannot be read. */
function objectNamesOf(file: string): string[] | undefined {
	try {
		return new RDAParser(new FlowrInlineTextFile(file, ''), true).parse()?.flatMap(o => o.name ? [o.name] : []);
	} catch{
		return undefined;
	}
}

/** The bytes of a save, read from disk; `undefined` for a file only known in memory, whose bytes flowR does not hand out. */
function bytesOf(entry: PackageEntry): Buffer | undefined {
	if(entry.stats === undefined) {
		return undefined;
	}
	try {
		return fs.readFileSync(entry.absolute);
	} catch{
		return undefined;
	}
}

/** whether the `R (>= version)` dependency of the DESCRIPTION is declared (in `Depends`, the only place R can be) */
function dependsOnR(desc: FlowrDescriptionFile | undefined, minimum: string): boolean {
	const depends = desc?.content().get('Depends')?.join(' ') ?? '';
	for(const [, op, version] of depends.matchAll(/\bR\s*\(\s*(>=|>)\s*([0-9][0-9.-]*)\s*\)/g)) {
		if(op !== undefined && version !== undefined && RRange.satisfies(version, `>= ${minimum}`)) {
			return true;
		}
	}
	return false;
}

/** the line of a DESCRIPTION field, `undefined` if the field is not stated */
function fieldLine(pf: PackageFiles, field: string): number | undefined {
	const index = (pf.read('DESCRIPTION') ?? '').split(/\r?\n/).findIndex(l => l.startsWith(`${field}:`));
	return index < 0 ? undefined : index + 1;
}

/**
 * Ports the data checks of `R CMD check`: the contents of `data/`, `LazyData`, the compression and serialization
 * version of saves, and the documentation of data sets. Saves are read from disk, so they are only inspected for
 * packages on disk.
 */
export const PACKAGE_DATA = {
	createSearch:        () => Q.from([]),
	processSearchResult: (_elements, config, data) => {
		const ctx = data.inspectContext();
		const pkg = packageInfo(ctx);
		const pf = packageFiles(ctx, pkg.name);
		if(pf === undefined) {
			return { results: [], '.meta': { inspectedDataFiles: 0, onDisk: false } };
		}
		const results: PackageDataResult[] = [];
		const add = (kind: PackageDataKind, file: string, message: string, line?: number) => {
			results.push({ certainty: LintingResultCertainty.Certain, involvedId: undefined, loc: pf.locate(file, line), kind, file, message });
		};
		const desc = pkg.description;
		const entries = pf.entries;
		const dataExtensions = new RegExp(`\\.(${config.dataExtensions.map(escapeRegex).join('|')})$`);
		const headers = new Map<PackageEntry, RdaHeader | undefined>();
		const headerOf = (e: PackageEntry): RdaHeader | undefined => {
			if(!headers.has(e)) {
				const bytes = bytesOf(e);
				headers.set(e, bytes === undefined ? undefined : rdaHeader(bytes, e.absolute));
			}
			return headers.get(e);
		};

		/* contents of the data directory, as `R CMD check` lists them (without hidden files) */
		const dataDir = entries.some(e => e.isDirectory && e.relative === 'data');
		const children = entries.filter(e => path.posix.dirname(e.relative) === 'data' && !path.posix.basename(e.relative).startsWith('.'));
		const datalist = children.find(e => e.relative === 'data/datalist');
		if(datalist?.isDirectory) {
			add('data-directory', datalist.relative, '\'data/datalist\' is a directory, but must be a file');
		} else if(datalist !== undefined) {
			const text = pf.read(datalist.relative) ?? '';
			const lines = text === '' ? [] : text.replace(/\r?\n$/, '').split(/\r?\n/);
			lines.forEach((line, i) => {
				if(!DatalistLine.test(line)) {
					add('data-directory', datalist.relative, `'data/datalist' contains a malformed line: '${line}'`, i + 1);
				}
			});
		}
		const dataSets = children.filter(e => !e.isDirectory && e.relative !== 'data/datalist' && dataExtensions.test(path.posix.basename(e.relative)));
		for(const e of children) {
			if(e.relative !== 'data/datalist' && (e.isDirectory || !dataExtensions.test(path.posix.basename(e.relative)))) {
				add('data-directory', e.relative, `'${e.relative}' is not of a type allowed in a 'data' directory`);
			}
		}

		/* the object names of the data sets, as `data()` brings them into scope */
		const names = new Map<PackageEntry, string[]>();
		const namesOf = (e: PackageEntry): string[] => {
			if(!names.has(e)) {
				const base = path.posix.basename(e.relative).replace(dataExtensions, '');
				const saved = RdaFile.test(e.relative) && pf.onDisk ? objectNamesOf(e.absolute) : undefined;
				const objects = ctx.files.datasetObjects(base);
				names.set(e, saved ?? (objects.length > 0 ? [...objects] : [base]));
			}
			return names.get(e) as string[];
		};
		for(const e of dataSets) {
			if(RdaFile.test(e.relative) && pf.onDisk && namesOf(e).includes('.Random.seed')) {
				add('data-directory', e.relative, `object '.Random.seed' found in data set '${path.posix.basename(e.relative)}', please remove it`);
			}
		}

		/* the serialization version of every save, as `R CMD check` reads it */
		const saves = entries.filter(e => !e.isDirectory && RdaFile.test(e.relative));
		for(const e of saves) {
			if((headerOf(e)?.version ?? 0) >= 3 && !dependsOnR(desc, '3.5.0')) {
				add('serialization-version', e.relative, `'${e.relative}' is saved with version 3 serialization, which only R >= 3.5.0 reads, declare it in Depends`);
			}
		}

		/* lazy loading, as `R CMD check` states it */
		if(desc !== undefined) {
			const lazy = ['1', 'yes', 'true'].includes(desc.content().get('LazyData')?.join(' ').toLowerCase() ?? '');
			const compression = desc.content().get('LazyDataCompression')?.join(' ');
			const lazyLine = fieldLine(pf, 'LazyData');
			const compressionLine = fieldLine(pf, 'LazyDataCompression');
			if(lazy && !dataDir) {
				add('lazydata', 'DESCRIPTION', '\'LazyData\' is specified without a \'data\' directory', lazyLine);
				if(compression !== undefined) {
					add('lazydata', 'DESCRIPTION', '\'LazyDataCompression\' is specified without a \'data\' directory', compressionLine);
				}
			} else if(!lazy && compression !== undefined) {
				add('lazydata', 'DESCRIPTION', '\'LazyDataCompression\' is specified without \'LazyData\'', compressionLine);
			} else if(lazy && compression !== undefined && !LazyDataCompressions.has(compression)) {
				add('lazydata', 'DESCRIPTION', `undocumented value '${compression}' of field 'LazyDataCompression'`, compressionLine);
			}
		}

		/* compressed saves, as `R CMD check` wants them */
		const compacted = config.checkCompaction ? [...dataSets.filter(e => RdaFile.test(e.relative)), ...entries.filter(e => !e.isDirectory && e.relative === 'R/sysdata.rda')] : [];
		for(const e of compacted) {
			const header = headerOf(e);
			if(header === undefined || !(header.ascii === true || header.compress === 'none')) {
				continue;
			}
			const size = e.stats?.size ?? 0;
			if(size <= config.maxUncompressedSize) {
				continue;
			}
			const reasons = [header.ascii ? 'ASCII format' : undefined, header.compress === 'none' ? 'uncompressed' : undefined].filter(r => r !== undefined);
			add(e.relative === 'R/sysdata.rda' ? 'compact-sysdata' : 'compact-data', e.relative, `large data file saved inefficiently (${reasons.join(', ')}, ${Math.round(size / 1024)}Kb)`);
		}
		if(compacted.some(e => ['bzip2', 'xz'].includes(headerOf(e)?.compress ?? '')) && !dependsOnR(desc, '2.10')) {
			add('compression-depends', 'DESCRIPTION', 'package needs dependence on R (>= 2.10) for data saved with bzip2 or xz compression', fieldLine(pf, 'Depends'));
		}

		/* documentation of the data sets */
		if(config.checkUndocumented && entries.some(e => e.isDirectory && e.relative === 'man')) {
			const index = ctx.files.documentation();
			for(const e of dataSets) {
				for(const name of namesOf(e)) {
					if(!index.documents(name)) {
						add('undocumented-data', e.relative, `undocumented data set '${name}'`);
					}
				}
			}
		}

		return { results, '.meta': { inspectedDataFiles: dataSets.length + entries.filter(e => e.relative === 'R/sysdata.rda').length, onDisk: pf.onDisk } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result: PackageDataResult) => `${result.message} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  (result: PackageDataResult) => `${result.message} at ${SourceLocation.format(result.loc)}`
	},
	info: {
		name:          'Package Data',
		tags:          [LintingRuleTag.CmdCheck],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Checks `data/` and `R/sysdata.rda`: allowed file types, LazyData, compression, the serialization version R needs, and undocumented data sets.',
		defaultConfig: () => ({
			dataExtensions:      DefaultDataExtensions,
			maxUncompressedSize: 100_000,
			checkCompaction:     true,
			checkUndocumented:   true
		})
	}
} as const satisfies LintingRule<PackageDataResult, PackageDataMetadata, PackageDataConfig>;
