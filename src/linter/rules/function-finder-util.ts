

import { Q } from '../../search/flowr-search-builder';
import { FlowrFilter, testFunctionsIgnoringPackage } from '../../search/flowr-search-filters';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { SourceRange } from '../../util/range';
import type { Identifier } from '../../dataflow/environments/identifier';
import type { LintingResult, LintingRuleCertainty } from '../linter-format';
import { LintingResultCertainty, LintingPrettyPrintContext } from '../linter-format';
import type { FlowrSearchElement, FlowrSearchElements } from '../../search/flowr-search';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { MergeableRecord } from '../../util/objects';
import { formatRange } from '../../util/mermaid/dfg';
import type { LintingRuleTag } from '../linter-tags';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import {isNotUndefined, isUndefined} from '../../util/assert';
import { getArgumentStringValue } from '../../dataflow/eval/resolve/resolve-argument';
import type { DataflowInformation } from '../../dataflow/info';
import type { FlowrConfigOptions } from '../../config';
import { isFunctionCallVertex } from '../../dataflow/graph/vertex';
import {NoInfo} from "../../r-bridge/lang-4.x/ast/model/model";
import type {FunctionInfo} from "../../queries/catalog/dependencies-query/function-info/function-info";
import {Unknown} from "../../queries/catalog/dependencies-query/dependencies-query-format";

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
	fns:     readonly string[]
}


/**
 * This helper object collects utility functions used to create linting rules that search for specific functions.
 */
export const functionFinderUtil = {
	createSearch: (functions: readonly string[]) => {
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
	processSearchResult: <T extends FlowrSearchElement<ParentInformation>[]>(
        elements: FlowrSearchElements<ParentInformation, T>,
        _config: FunctionsToDetectConfig,
        _data: { normalize: NormalizedAst, dataflow: DataflowInformation, config: FlowrConfigOptions},
        refineSearch: (elements: T) => T = e => e,
    ) => {
		const metadata: FunctionsMetadata = {
			totalCalls:               0,
			totalFunctionDefinitions: 0
		};

		const results = refineSearch(elements.getElements())
			.flatMap(element => {
				metadata.totalCalls++;
				return enrichmentContent(element, Enrichment.CallTargets).targets.map(target => {
					metadata.totalFunctionDefinitions++;
					return {
						node:   element.node,
						range:  element.node.info.fullRange as SourceRange,
						target: target as Identifier
					};
				});
			});

		return {
			results: 
				results.map(element => ({
					certainty: LintingResultCertainty.Certain,
					function:  element.target,
					range:     element.range
				})),
			'.meta': metadata
		};
	},
	prettyPrint: (functionType: string) =>{
		return {
			[LintingPrettyPrintContext.Query]: (result:FunctionsResult) => `Function \`${result.function}\` at ${formatRange(result.range)}`,
			[LintingPrettyPrintContext.Full]:  (result:FunctionsResult) => `Function \`${result.function}\` called at ${formatRange(result.range)} is related to ${functionType}`
		};
	},
    requireArgumentValue(
        element: FlowrSearchElement<ParentInformation>,
        pool: readonly FunctionInfo[],
        data: { normalize: NormalizedAst, dataflow: DataflowInformation, config: FlowrConfigOptions},
        require: RegExp | string | undefined
    ): boolean {
        const info = pool.find(f => f.name === element.node.lexeme);
        /* if we have no additional info, we assume they always access the network */
        if(info === undefined) {
            return true;
        }
        const vert = data.dataflow.graph.getVertex(element.node.info.id);
        if(isFunctionCallVertex(vert)){
            const args = getArgumentStringValue(
                data.config.solver.variables,
                data.dataflow.graph,
                vert,
                info.argIdx,
                info.argName,
                info.resolveValue);
            // we obtain all values, at least one of them has to trigger for the request
            const argValues: string[] = args ? args.values().flatMap(v => [...v]).filter(isNotUndefined).toArray() : [];

            /* if there are no arguments we assume they may access the network, otherwise we check for the flag */
            return argValues.length === 0 || argValues.some(v => v === Unknown || (require instanceof RegExp ? require.test(v) : v === require))
        }
        return false;
    }
};


