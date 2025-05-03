import type { LintingResult, LintingRule } from '../linter-format';
import { LintingCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import type { SourceRange } from '../../util/range';
import { formatRange } from '../../util/mermaid/dfg';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrSearchElementFromQuery } from '../../search/flowr-search';
import type { QueryResults } from '../../queries/query';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';

import { findSource } from '../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { Ternary } from '../../util/logic';
import { getConfig } from '../../config';
import { requestFromInput } from '../../r-bridge/retriever';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import { WriteFunctions } from '../../queries/catalog/dependencies-query/function-info/write-functions';
import type { ControlFlowGraph } from '../../control-flow/control-flow-graph';
import { extractCFG } from '../../control-flow/extract-cfg';
import { happensBefore } from '../../control-flow/happens-before';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';

export interface FilePathValidityResult extends LintingResult {
	filePath: string,
	range:    SourceRange
}

export interface FilePathValidityConfig extends MergeableRecord {
	additionalReadFunctions:  FunctionInfo[]
	additionalWriteFunctions: FunctionInfo[]
	includeUnknown:           boolean
}

export interface FilePathValidityMetadata extends MergeableRecord {
	totalReads:              number
	totalUnknown:            number
	totalWritesBeforeAlways: number
	totalValid:              number
}

export const R2_FILE_PATH_VALIDITY = {
	createSearch: (config) => Q.fromQuery({
		type:                   'dependencies',
		// we only want to check read and write functions, so we explicitly clear all others
		ignoreDefaultFunctions: true,
		readFunctions:          ReadFunctions.concat(config.additionalReadFunctions),
		writeFunctions:         WriteFunctions.concat(config.additionalWriteFunctions)
	}),
	processSearchResult: (elements, config, data): { results: FilePathValidityResult[], '.meta': FilePathValidityMetadata } => {
		let cfg: ControlFlowGraph;
		const metadata: FilePathValidityMetadata = {
			totalReads:              0,
			totalUnknown:            0,
			totalWritesBeforeAlways: 0,
			totalValid:              0
		};
		return {
			results: elements.getElements().flatMap(element => {
				const results = element.queryResult as QueryResults<'dependencies'>['dependencies'];
				const matchingRead = results.readData.find(r => r.nodeId == element.node.info.id);
				if(!matchingRead) {
					return [];
				}
				metadata.totalReads++;
				const range = element.node.info.fullRange as SourceRange;

				// check if we can't parse the file path statically
				if(matchingRead.source === Unknown) {
					metadata.totalUnknown++;
					if(config.includeUnknown) {
						return [{
							range,
							filePath:  Unknown,
							certainty: LintingCertainty.Maybe
						}];
					} else {
						return [];
					}
				}

				// check if any write to the same file happens before the read, and exclude this case if so
				cfg ??= extractCFG(data.normalize, data.dataflow.graph).graph;
				const writesToFile = results.writtenData.filter(r => samePath(r.destination, matchingRead.source));
				const writesBefore = writesToFile.map(w => happensBefore(cfg, w.nodeId, element.node.info.id));
				if(writesBefore.some(w => w === Ternary.Always)) {
					metadata.totalWritesBeforeAlways++;
					return [];
				}

				// check if the file exists!
				const paths = findSource(matchingRead.source, {
					referenceChain: element.node.info.file ? [requestFromInput(`file://${element.node.info.file}`)] : []
				});
				if(paths && paths.length) {
					metadata.totalValid++;
					return [];
				}

				return [{
					range,
					filePath:  matchingRead.source,
					certainty: writesBefore.length && writesBefore.every(w => w === Ternary.Maybe) ? LintingCertainty.Maybe : LintingCertainty.Definitely
				}];
			}),
			'.meta': metadata
		};
	},
	prettyPrint:   result => `Path ${result.filePath} at ${formatRange(result.range)}`,
	defaultConfig: {
		additionalReadFunctions:  [],
		additionalWriteFunctions: [],
		includeUnknown:           false
	}
} as const satisfies LintingRule<FilePathValidityResult, FilePathValidityMetadata, FilePathValidityConfig, ParentInformation, FlowrSearchElementFromQuery<ParentInformation>[]>;

function samePath(a: string, b: string): boolean {
	if(a === b) {
		return true;
	}
	return getConfig().solver.resolveSource?.ignoreCapitalization === true && a.toLowerCase() === b.toLowerCase();
}
