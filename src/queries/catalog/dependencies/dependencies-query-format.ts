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
    libraries:    (DependencyInfo & { libraryName: string })[]
    sourcedFiles: (DependencyInfo & { file: string })[]
    readData:     (DependencyInfo & { source: string })[]
    writtenData:  (DependencyInfo & { destination: 'stdout' | string })[]
}

export interface DependencyInfo {
    nodeId:       NodeId
    functionName: string
}
