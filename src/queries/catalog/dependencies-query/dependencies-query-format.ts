import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

// these lists are based on https://github.com/duncantl/CodeDepends/blob/7fd96dfee16b252e5f642c77a7ababf48e9326f8/R/codeTypes.R
export const LibraryFunctions = ['library', 'require'] as const;
export const SourceFunctions = ['source'] as const;
export const ReadFunctions = ['read.table', 'read.csv', 'read.csv2', 'read.delim', 'read.fwf', 'file', 'url', 'load', 'gzfile', 'bzfile', 'download.file', 'pipe', 'fifo', 'unz', 'data.frame', 'matrix', 'readRDS', 'readLines'] as const;
export const WriteFunctions = ['save', 'save.image', 'write', 'dput', 'dump', 'write.table', 'write.csv', 'saveRDS', 'print', 'cat'] as const;

export interface DependenciesQuery extends BaseQueryFormat {
    readonly type: 'dependencies';
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
