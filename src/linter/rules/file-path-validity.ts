import type { LintingResult, LintingRule } from '../linter-format';
import { LintingResultCertainty, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';

import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import type { SourceRange } from '../../util/range';
import { formatRange } from '../../util/mermaid/dfg';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';

import { findSource } from '../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { Ternary } from '../../util/logic';
import { requestFromInput } from '../../r-bridge/retriever';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import { WriteFunctions } from '../../queries/catalog/dependencies-query/function-info/write-functions';
import { happensBefore } from '../../control-flow/happens-before';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { LintingRuleTag } from '../linter-tags';
import { Enrichment } from '../../search/search-executor/search-enrichers';

export interface FilePathValidityResult extends LintingResult {
	filePath: string,
	range:    SourceRange
}

export interface FilePathValidityConfig extends MergeableRecord {
	/**
	 * The set of functions that should additionally be considered as reading a file path.
	 * Entries in this array use the {@link FunctionInfo} format from the dependencies query.
	 */
	additionalReadFunctions:  FunctionInfo[]
	/**
	 * The set of functions that should additionally be considered as writing to a file path.
	 * Entries in this array use the {@link FunctionInfo} format from the dependencies query.
	 */
	additionalWriteFunctions: FunctionInfo[]
	/**
	 * Whether unknown file paths should be included as linting results.
	 */
	includeUnknown:           boolean
}

export interface FilePathValidityMetadata extends MergeableRecord {
	totalReads:              number
	totalUnknown:            number
	totalWritesBeforeAlways: number
	totalValid:              number
}

export const FILE_PATH_VALIDITY = {
	createSearch: (config) => Q.fromQuery({
		type:                   'dependencies',
		// we only want to check read and write functions, so we explicitly clear all others
		ignoreDefaultFunctions: true,
		readFunctions:          ReadFunctions.concat(config.additionalReadFunctions),
		writeFunctions:         WriteFunctions.concat(config.additionalWriteFunctions)
	}).with(Enrichment.CfgInformation),
	processSearchResult: (elements, config, data): { results: FilePathValidityResult[], '.meta': FilePathValidityMetadata } => {
		const cfg = elements.enrichmentContent(Enrichment.CfgInformation).cfg.graph;
		const metadata: FilePathValidityMetadata = {
			totalReads:              0,
			totalUnknown:            0,
			totalWritesBeforeAlways: 0,
			totalValid:              0
		};
		return {
			results: elements.getElements().flatMap(element => {
				const results = elements.enrichmentContent(Enrichment.QueryData).queries['dependencies'];
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
							certainty: LintingResultCertainty.Uncertain
						}];
					} else {
						return [];
					}
				}

				// check if any write to the same file happens before the read, and exclude this case if so
				const writesToFile = results.writtenData.filter(r => samePath(r.destination, matchingRead.source, data.config.solver.resolveSource?.ignoreCapitalization));
				const writesBefore = writesToFile.map(w => happensBefore(cfg, w.nodeId, element.node.info.id));
				if(writesBefore.some(w => w === Ternary.Always)) {
					metadata.totalWritesBeforeAlways++;
					return [];
				}

				// check if the file exists!
				const paths = findSource(data.config.solver.resolveSource, matchingRead.source, {
					referenceChain: element.node.info.file ? [requestFromInput(`file://${element.node.info.file}`)] : []
				});
				if(paths && paths.length) {
					metadata.totalValid++;
					return [];
				}

				return [{
					range,
					filePath:  matchingRead.source,
					certainty: writesBefore && writesBefore.length && writesBefore.every(w => w === Ternary.Maybe) ? LintingResultCertainty.Uncertain : LintingResultCertainty.Certain
				}];
			}),
			'.meta': metadata
		};
	},
	info: {
		name:          'File Path Validity',
		description:   'Checks whether file paths used in read and write operations are valid and point to existing files.',
		// checks all found paths for whether they're valid to ensure correctness, but doesn't handle non-constant paths so not all will be returned
		certainty:     LintingRuleCertainty.BestEffort,
		tags:          [LintingRuleTag.Robustness, LintingRuleTag.Reproducibility, LintingRuleTag.Bug],
		defaultConfig: {
			additionalReadFunctions:  [],
			additionalWriteFunctions: [],
			includeUnknown:           false
		}
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Path \`${result.filePath}\` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]:  result => `Path \`${result.filePath}\` at ${formatRange(result.range)} does not point to a valid file`
	}
} as const satisfies LintingRule<FilePathValidityResult, FilePathValidityMetadata, FilePathValidityConfig>;

function samePath(a: string, b: string, ignoreCapitalization: boolean | undefined): boolean {
	if(ignoreCapitalization === true) {
		a = a.toLowerCase();
		b = b.toLowerCase();
	}
	return a === b;
}
