import { Q } from '../../search/flowr-search-builder';
import { FlowrFilter, testFunctionsIgnoringPackage } from '../../search/flowr-search-filters';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import type { SourceRange } from '../../util/range';
import { LintingPrettyPrintContext, type LintingResult, LintingResultCertainty } from '../linter-format';
import type { FlowrSearchElement, FlowrSearchElements } from '../../search/flowr-search';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { MergeableRecord } from '../../util/objects';
import { formatRange } from '../../util/mermaid/dfg';
import { isNotUndefined } from '../../util/assert';
import { getArgumentStringValue } from '../../dataflow/eval/resolve/resolve-argument';
import type { DataflowInformation } from '../../dataflow/info';
import { isFunctionCallVertex, VertexType } from '../../dataflow/graph/vertex';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import type { BrandedIdentifier } from '../../dataflow/environments/identifier';

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
	fns: readonly string[]
}


/**
 * This helper object collects utility functions used to create linting rules that search for specific functions.
 */
export const functionFinderUtil = {
	createSearch: (functions: readonly string[]) => {
		return (
			Q.all().filter(VertexType.FunctionCall)
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
		_config: unknown,
		_data: unknown,
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
						target: target as BrandedIdentifier
					};
				});
			});

		return {
			results:
				results.map(element => ({
					certainty:  LintingResultCertainty.Certain,
					involvedId: element.node.info.id,
					function:   element.target,
					range:      element.range
				})),
			'.meta': metadata
		};
	},
	prettyPrint: (functionType: string) =>{
		return {
			[LintingPrettyPrintContext.Query]: (result: FunctionsResult) => `Function \`${result.function}\` at ${formatRange(result.range)}`,
			[LintingPrettyPrintContext.Full]:  (result: FunctionsResult) => `Function \`${result.function}\` called at ${formatRange(result.range)} is related to ${functionType}`
		};
	},
	requireArgumentValue(
		element: FlowrSearchElement<ParentInformation>,
		pool: readonly FunctionInfo[],
		data: { normalize: NormalizedAst, dataflow: DataflowInformation, analyzer: ReadonlyFlowrAnalysisProvider},
		requireValue: RegExp | string | undefined
	): boolean {
		const info = pool.find(f => f.name === element.node.lexeme);
		/* if we have no additional info, we assume they always access the network */
		if(info === undefined) {
			return true;
		}
		const vert = data.dataflow.graph.getVertex(element.node.info.id);
		if(isFunctionCallVertex(vert)){
			const args = getArgumentStringValue(
				data.analyzer.flowrConfig.solver.variables,
				data.dataflow.graph,
				vert,
				info.argIdx,
				info.argName,
				info.resolveValue,
				data.analyzer.inspectContext());
			// we obtain all values, at least one of them has to trigger for the request
			const argValues: string[] = args ? args.values().flatMap(v => [...v]).filter(isNotUndefined).toArray() : [];

			/* if there are no arguments we assume they may access the network, otherwise we check for the flag */
			return argValues.length === 0 || argValues.some(v => v === Unknown || (requireValue instanceof RegExp ? requireValue.test(v) : v === requireValue));
		}
		return false;
	}
};


