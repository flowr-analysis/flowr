import type { LintingResult, LintingRule } from '../linter-format';
import { LintingCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import type { SourceRange } from '../../util/range';
import { formatRange } from '../../util/mermaid/dfg';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrSearchElementFromQuery } from '../../search/flowr-search';
import type { QueryResults } from '../../queries/query';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import { findSource } from '../../dataflow/internal/process/functions/call/built-in/built-in-source';

export interface FilePathValidityResult extends LintingResult {
	filePath: string,
	range:    SourceRange
}

export interface FilePathValidityConfig extends MergeableRecord {
	additionalReadFunctions: FunctionInfo[]
}

export const R2_FILE_PATH_VALIDITY = {
	createSearch: (config) => Q.fromQuery({
		type:                   'dependencies',
		// we only want to check read functions, so we explicitly clear all others
		ignoreDefaultFunctions: true,
		readFunctions:          ReadFunctions.concat(config.additionalReadFunctions ?? [])
	}),
	processSearchResult: (elements, _config): FilePathValidityResult[] => elements.getElements()
		.flatMap(element => {
			const results = element.queryResult as QueryResults<'dependencies'>['dependencies'];
			const result = results.readData.find(r => r.nodeId == element.node.info.id);
			if(!result) {
				return [];
			}
			return [{
				range:    element.node.info.fullRange as SourceRange,
				filePath: result.source
			}];
		})
		.filter(element => {
			const paths = findSource(element.filePath, { referenceChain: [] });
			return !paths || !paths.length;
		})
		.map(element => ({
			...element,
			certainty: LintingCertainty.Definitely
		})),
	prettyPrint:   result => `Path ${result.filePath} at ${formatRange(result.range)}`,
	defaultConfig: {
		additionalReadFunctions: []
	}
} as const satisfies LintingRule<FilePathValidityResult, FilePathValidityConfig, ParentInformation, FlowrSearchElementFromQuery<ParentInformation>[]>;
