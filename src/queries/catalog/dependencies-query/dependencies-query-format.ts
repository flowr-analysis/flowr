import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { QueryResults, SupportedQuery } from '../../query';
import { bold } from '../../../util/ansi';
import { printAsMs } from '../../../util/time';
import Joi from 'joi';
import { executeDependenciesQuery } from './dependencies-query-executor';
import type { LinkTo } from '../call-context-query/call-context-query-format';

export const Unknown = 'unknown';

/** when to read the argument value from a linked function */
export enum DependencyInfoLinkConstraint {
	Always    = 'always',
	IfUnknown = 'if-unknown',
}

/**
 * A dependency link may have attached information. If you pass it, we try to resolve the argument value from the linked function
 * if the `when` constraint is met.
 */
export type DependencyInfoLink = LinkTo<RegExp | string, Omit<FunctionInfo, 'name' | 'linkTo'> & { when: DependencyInfoLinkConstraint } | undefined>
export type DependencyInfoLinkAttachedInfo = DependencyInfoLink['attachLinkInfo']

// these lists are originally based on https://github.com/duncantl/CodeDepends/blob/7fd96dfee16b252e5f642c77a7ababf48e9326f8/R/codeTypes.R
export const LibraryFunctions: FunctionInfo[] = [
	{ name: 'library',           argIdx: 0, argName: 'package', resolveValue: 'library' },
	{ name: 'require',           argIdx: 0, argName: 'package', resolveValue: 'library' },
	{ name: 'loadNamespace',     argIdx: 0, argName: 'package', resolveValue: true },
	{ name: 'attachNamespace',   argIdx: 0, argName: 'ns', resolveValue: true },
	{ name: 'attach',            argIdx: 0, argName: 'what', resolveValue: true },
	{ name: 'groundhog.library', argIdx: 0, argName: 'pkg', resolveValue: true },
	{ name: 'p_load',            argIdx: 'unnamed', resolveValue: 'library' }, // pacman
	{ name: 'p_load_gh',         argIdx: 'unnamed', resolveValue: 'library' }, // pacman
	{ name: 'from_import',       argIdx: 0, argName: 'package', resolveValue: true }, // easypackages
	{ name: 'libraries',         argIdx: 'unnamed', resolveValue: true }, // easypackages
	{ name: 'shelf',             argIdx: 'unnamed', resolveValue: true } // librarian
] as const;
export const SourceFunctions: FunctionInfo[] = [
	{ name: 'source', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'sys.source', argIdx: 0, argName: 'file', resolveValue: true }
] as const;
export const ReadFunctions: FunctionInfo[] = [
	{ name: 'read.table', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.csv', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.csv2', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.delim', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.dcf', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'scan', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.fwf', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'file', argIdx: 1, argName: 'open', resolveValue: true },
	{ name: 'url', argIdx: 1, argName: 'open', resolveValue: true },
	{ name: 'load', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'gzfile', argIdx: 1, argName: 'open', resolveValue: true },
	{ name: 'bzfile', argIdx: 1, argName: 'open', resolveValue: true },
	{ name: 'download.file', argIdx: 0, argName: 'url', resolveValue: true },
	{ name: 'pipe', argIdx: 1, argName: 'open', resolveValue: true },
	{ name: 'fifo', argIdx: 1, argName: 'open', resolveValue: true },
	{ name: 'unz', argIdx: 1, argName: 'open', resolveValue: true },
	{ name: 'matrix', argIdx: 0, argName: 'data', resolveValue: true },
	{ name: 'readRDS', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'readLines', argIdx: 0, argName: 'con', resolveValue: true },
	{ name: 'readRenviron', argIdx: 0, argName: 'path', resolveValue: true },
	// readr
	{ name: 'read_csv', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_csv2', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_lines', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_delim', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_dsv', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_fwf', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_tsv', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_table', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_log', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_lines', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_lines_chunked', argIdx: 0, argName: 'file', resolveValue: true },
	// xlsx
	{ name: 'read.xlsx', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.xlsx2', argIdx: 0, argName: 'file', resolveValue: true },
	// data.table
	{ name: 'fread', argIdx: 0, argName: 'file', resolveValue: true },
	// haven
	{ name: 'read_sas', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_sav', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_por', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_dta', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read_xpt', argIdx: 0, argName: 'file', resolveValue: true },
	// feather
	{ name: 'read_feather', argIdx: 0, argName: 'file', resolveValue: true },
	// foreign
	{ name: 'read.arff', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.dbf', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.dta', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.epiinfo', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.mtp', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.octave', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.spss', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.ssd', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.systat', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'read.xport', argIdx: 0, argName: 'file', resolveValue: true },
	// car
	{ name: 'Import', argIdx: 0, argName: 'file', resolveValue: true },
] as const;

const OutputRedirects = [
	{ type: 'link-to-last-call', callName: 'sink', attachLinkInfo: { argIdx: 0, argName: 'file', when: DependencyInfoLinkConstraint.IfUnknown, resolveValue: true } }
] as const satisfies DependencyInfoLink[];

export const WriteFunctions: FunctionInfo[] = [
	{ name: 'save', argName: 'file', resolveValue: true },
	{ name: 'save.image', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'dput', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'dump', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write.table', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write.csv', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'saveRDS', argIdx: 1, argName: 'file', resolveValue: true },
	// write functions that don't have argIndex are assumed to write to stdout
	{ name: 'print',   linkTo: OutputRedirects, resolveValue: true },
	{ name: 'cat',     linkTo: OutputRedirects, argName: 'file', resolveValue: true },
	{ name: 'message', linkTo: OutputRedirects, resolveValue: true },
	{ name: 'warning', linkTo: OutputRedirects, resolveValue: true },
	// readr
	{ name: 'write_csv',   argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_csv2',  argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_delim', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_dsv',   argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_fwf',   argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_tsv',   argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_table', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_log',   argIdx: 1, argName: 'file', resolveValue: true },
	// heaven
	{ name: 'write_sas', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_sav', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_por', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_dta', argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write_xpt', argIdx: 1, argName: 'file', resolveValue: true },
	// feather
	{ name: 'write_feather', argIdx: 1, argName: 'file', resolveValue: true },
	// foreign
	{ name: 'write.arff',    argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write.dbf',     argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write.dta',     argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write.foreign', argIdx: 1, argName: 'file', resolveValue: true },
	// xlsx
	{ name: 'write.xlsx',  argIdx: 1, argName: 'file', resolveValue: true },
	{ name: 'write.xlsx2', argIdx: 1, argName: 'file', resolveValue: true },
	// graphics
	{ name: 'pdf', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'jpeg', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'png', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'windows', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'postscript', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'xfix', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'bitmap', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'pictex', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'cairo_pdf', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'svg', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'bmp', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'tiff', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'X11', argIdx: 0, argName: 'file', resolveValue: true },
	{ name: 'quartz', argIdx: 0, argName: 'file', resolveValue: true },
	// car
	{ name: 'Export', argIdx: 0, argName: 'file', resolveValue: true },
] as const;

export interface FunctionInfo {
    name:       string
    argIdx?:    number | 'unnamed'
    argName?:   string
    linkTo?:    DependencyInfoLink[]
	resolveValue?: boolean | 'library'
}

export interface DependenciesQuery extends BaseQueryFormat {
    readonly type:                    'dependencies'
    readonly ignoreDefaultFunctions?: boolean
    readonly libraryFunctions?:       FunctionInfo[]
    readonly sourceFunctions?:        FunctionInfo[]
    readonly readFunctions?:          FunctionInfo[]
    readonly writeFunctions?:         FunctionInfo[]
}

export interface DependenciesQueryResult extends BaseQueryResult {
    libraries:    LibraryInfo[]
    sourcedFiles: SourceInfo[]
    readData:     ReadInfo[]
    writtenData:  WriteInfo[]
}

export interface DependencyInfo extends Record<string, unknown>{
    nodeId:         NodeId
    functionName:   string
    linkedIds?:     readonly NodeId[]
	/** the lexeme is presented whenever the specific info is of {@link Unknown} */
	lexemeOfArgument?: string;
}
export type LibraryInfo = (DependencyInfo & { libraryName: 'unknown' | string })
export type SourceInfo = (DependencyInfo & { file: string })
export type ReadInfo = (DependencyInfo & { source: string })
export type WriteInfo = (DependencyInfo & { destination: 'stdout' | string })

function printResultSection<T extends DependencyInfo>(title: string, infos: T[], result: string[], sectionSpecifics: (info: T) => string): void {
	if(infos.length <= 0) {
		return;
	}
	result.push(`   ╰ ${title}`);
	const grouped = infos.reduce(function(groups: Map<string, T[]>, i) {
		const array = groups.get(i.functionName);
		if(array) {
			array.push(i);
		} else {
			groups.set(i.functionName, [i]);
		}
		return groups;
	}, new Map<string, T[]>());
	for(const [functionName, infos] of grouped) {
		result.push(`       ╰ \`${functionName}\``);
		result.push(infos.map(i => `           ╰ Node Id: ${i.nodeId}, ${sectionSpecifics(i)}`).join('\n'));
	}
}

const functionInfoSchema: Joi.ArraySchema = Joi.array().items(Joi.object({
	name:    Joi.string().required().description('The name of the library function.'),
	argIdx:  Joi.number().optional().description('The index of the argument that contains the library name.'),
	argName: Joi.string().optional().description('The name of the argument that contains the library name.'),
})).optional();

export const DependenciesQueryDefinition = {
	executor:        executeDependenciesQuery,
	asciiSummarizer: (formatter, _processed, queryResults, result) => {
		const out = queryResults as QueryResults<'dependencies'>['dependencies'];
		result.push(`Query: ${bold('dependencies', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		printResultSection('Libraries', out.libraries, result, l => `\`${l.libraryName}\``);
		printResultSection('Sourced Files', out.sourcedFiles, result, s => `\`${s.file}\``);
		printResultSection('Read Data', out.readData, result, r => `\`${r.source}\``);
		printResultSection('Written Data', out.writtenData, result, w => `\`${w.destination}\``);
		return true;
	},
	schema: Joi.object({
		type:                   Joi.string().valid('dependencies').required().description('The type of the query.'),
		ignoreDefaultFunctions: Joi.boolean().optional().description('Should the set of functions that are detected by default be ignored/skipped?'),
		libraryFunctions:       functionInfoSchema.description('The set of library functions to search for.'),
		sourceFunctions:        functionInfoSchema.description('The set of source functions to search for.'),
		readFunctions:          functionInfoSchema.description('The set of data reading functions to search for.'),
		writeFunctions:         functionInfoSchema.description('The set of data writing functions to search for.'),
	}).description('The dependencies query retrieves and returns the set of all dependencies in the dataflow graph, which includes libraries, sourced files, read data, and written data.'),
	toSearchElements: (queryResults: BaseQueryResult) => {
		const out = queryResults as QueryResults<'dependencies'>['dependencies'];
		return [
			...out.libraries.map(library => library.nodeId),
			...out.sourcedFiles.map(sourced => sourced.nodeId),
			...out.readData.map(read => read.nodeId),
			...out.writtenData.map(write => write.nodeId)
		];
	}
} as const satisfies SupportedQuery<'dependencies'>;
