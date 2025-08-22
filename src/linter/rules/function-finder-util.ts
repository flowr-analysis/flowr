

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
import { isUndefined } from '../../util/assert';
import { getArgumentStringValue } from '../../dataflow/eval/resolve/resolve-argument';
import type { DataflowInformation } from '../../dataflow/info';
import type { FlowrConfigOptions } from '../../config';
import { isFunctionCallVertex } from '../../dataflow/graph/vertex';

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
	functionsToFind: string[]
	regEx:           RegExp
}

export const functionFinderUtil = {
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
	processSearchResult: (elements: FlowrSearchElements<ParentInformation, FlowrSearchElement<ParentInformation>[]>, config: FunctionsToDetectConfig, data: { normalize: NormalizedAst, dataflow: DataflowInformation, config: FlowrConfigOptions}) => {
		const metadata: FunctionsMetadata = {
			totalCalls:               0,
			totalFunctionDefinitions: 0
		};

		const results = elements.getElements()
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
			}).filter(element =>{
				const info = ReadFunctions.find(f => f.name === element.node.lexeme);
				if(isUndefined(info)){
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
					
					const argValues = args ? Array.from(args.values()).filter(v => !isUndefined(v)).flatMap(v => [...v]):[];
					// if(!argValues || argValues.length === 0 || argValues.some(v => v === Unknown || isUndefined(v))) {
					// 	if we have no arguments, we cannot construct the argument
					// 	return undefined;
					// }
					return argValues.map(arg => !isUndefined(arg) ? config.regEx.test(arg): undefined);
				}
				return false;
				
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
	info: (name: string, tags:LintingRuleTag[], description: string, certainty: LintingRuleCertainty, functionsToFind: string[], regEx: RegExp)=>{
		return {
			name:          name,
			tags:          tags,
			description:   description,
			certainty:	    certainty,
			defaultConfig: {
				functionsToFind: functionsToFind,
				regEx: 	         regEx
			}
		};
	}
};


