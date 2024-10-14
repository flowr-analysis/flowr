import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

// these lists are based on https://github.com/duncantl/CodeDepends/blob/7fd96dfee16b252e5f642c77a7ababf48e9326f8/R/codeTypes.R
export const LibraryFunctions = ['library', 'require'] as const;
export const SourceFunctions = ['source'] as const;
export const ReadFunctions: FunctionInfo[] = [
	{ name: 'read.table', argIdx: 0, argName: 'file' },
	{ name: 'read.csv', argIdx: 0, argName: 'file' },
	{ name: 'read.csv2', argIdx: 0, argName: 'file' },
	{ name: 'read.delim', argIdx: 0, argName: 'file' },
	{ name: 'read.delim', argIdx: 0, argName: 'file' },
	{ name: 'read.fwf', argIdx: 0, argName: 'file' },
	{ name: 'file', argIdx: 1, argName: 'open' },
	{ name: 'url', argIdx: 1, argName: 'open' },
	{ name: 'load', argIdx: 0, argName: 'file' },
	{ name: 'gzfile', argIdx: 1, argName: 'open' },
	{ name: 'bzfile', argIdx: 1, argName: 'open' },
	{ name: 'download.file', argIdx: 0, argName: 'url' },
	{ name: 'pipe', argIdx: 1, argName: 'open' },
	{ name: 'fifo', argIdx: 1, argName: 'open' },
	{ name: 'unz', argIdx: 1, argName: 'open' },
	{ name: 'matrix', argIdx: 0, argName: 'data' },
	{ name: 'readRDS', argIdx: 0, argName: 'file' },
	{ name: 'readLines', argIdx: 0, argName: 'con' },
] as const;
export const WriteFunctions: FunctionInfo[] = [
	{ name: 'save', argIdx: 0, argName: '...' },
	{ name: 'save.image', argIdx: 0, argName: 'file' },
	{ name: 'write', argIdx: 1, argName: 'file' },
	{ name: 'dput', argIdx: 1, argName: 'file' },
	{ name: 'dump', argIdx: 1, argName: 'file' },
	{ name: 'write.table', argIdx: 1, argName: 'file' },
	{ name: 'write.csv', argIdx: 1, argName: 'file' },
	{ name: 'saveRDS', argIdx: 1, argName: 'file' },
	// write functions that don't have argIndex are assumed to write to stdout
	{ name: 'print' },
	{ name: 'cat' },
] as const;

export interface FunctionInfo {
    name:     string
    argIdx?:  number
    argName?: string
}

export interface DependenciesQuery extends BaseQueryFormat {
    readonly type: 'dependencies'
}

export interface DependenciesQueryResult extends BaseQueryResult {
    libraries:    LibraryInfo[]
    sourcedFiles: SourceInfo[]
    readData:     ReadInfo[]
    writtenData:  WriteInfo[]
}

export interface DependencyInfo {
    nodeId:       NodeId
    functionName: string
}
export type LibraryInfo = (DependencyInfo & { libraryName: 'unknown' | string })
export type SourceInfo = (DependencyInfo & { file: string })
export type ReadInfo = (DependencyInfo & { source: string })
export type WriteInfo = (DependencyInfo & { destination: 'stdout' | string })

export function printResultSection<T extends DependencyInfo>(title: string, infos: T[], result: string[], sectionSpecifics: (info: T) => string): void {
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
		result.push(`       ╰ ${functionName}`);
		result.push(infos.map(i => `           ╰ Node Id: ${i.nodeId}, ${sectionSpecifics(i)}`).join('\n'));
	}
}
