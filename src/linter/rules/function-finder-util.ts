

import { Q } from '../../search/flowr-search-builder';
import { FlowrFilter, testFunctionsIgnoringPackage } from '../../search/flowr-search-filters';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { SourceRange } from '../../util/range';
import type { Identifier } from '../../dataflow/environments/identifier';
import type { LintingResult } from '../linter-format';
import { LintingCertainty } from '../linter-format';
import type { FlowrSearchElement, FlowrSearchElements } from '../../search/flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { MergeableRecord } from '../../util/objects';

export interface FunctionsResult extends LintingResult {
    function: string
    range:    SourceRange
}

export interface FunctionsMetadata extends MergeableRecord {
    totalCalls:               number;
    totalFunctionDefinitions: number;
}

export interface FunctionsToDetectConfig extends MergeableRecord {
	/**
	 * The list of function names that should be marked in the given context.
	 */
	deprecatedFunctions: string[]
}

export const FUNCTION_FINDER_UTIL = {
	createSearch: (functions: string[]) => {
		return (
			Q.all()
				.with(Enrichment.CallTargets, { onlyBuiltin: true })
				.filter({
					name: FlowrFilter.MatchesEnrichment,
					args: {
						enrichment: Enrichment.CallTargets,
						test:       testFunctionsIgnoringPackage(functions)
					}
				})
		);
	},
	processSearchResult: (elements: FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]>) => {
		const metadata: FunctionsMetadata = {
			totalCalls:               0,
			totalFunctionDefinitions: 0
		};
		return {
			results: elements.getElements()
				.flatMap(element => {
					metadata.totalCalls++;
					return enrichmentContent(element, Enrichment.CallTargets).targets.map(target => {
						metadata.totalFunctionDefinitions++;
						return {
							range:  element.node.info.fullRange as SourceRange,
							target: target as Identifier
						};
					});
				})
				.map(element => ({
					certainty: LintingCertainty.Definitely,
					function:  element.target,
					range:     element.range
				})),
			'.meta': metadata
		};
	}
};


