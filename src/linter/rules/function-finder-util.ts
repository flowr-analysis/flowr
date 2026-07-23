import { Q } from '../../search/flowr-search-builder';
import { FlowrFilter } from '../../search/flowr-search-filters';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';
import { SourceLocation } from '../../util/range';
import { LintingPrettyPrintContext, type LintingResult, LintingResultCertainty } from '../linter-format';
import type { FlowrSearchElement, FlowrSearchElements } from '../../search/flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { MergeableRecord } from '../../util/objects';
import { isNotUndefined } from '../../util/assert';
import { getArgumentStringValue } from '../../dataflow/eval/resolve/resolve-argument';
import { isFunctionCallVertex, VertexType } from '../../dataflow/graph/vertex';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { Unknown } from '../../queries/catalog/dependencies-query/dependencies-query-format';
import type { BrandedIdentifier } from '../../dataflow/environments/identifier';
import { Identifier } from '../../dataflow/environments/identifier';
import { Ternary } from '../../util/logic';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import type { AsyncOrSync } from 'ts-essentials';
import { Dataflow } from '../../dataflow/graph/df-helper';

export interface FunctionsResult extends LintingResult {
	function: string
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
	createSearch: (functions: readonly Identifier[]) => {
		return (
			Q.all().filter(VertexType.FunctionCall)
				.with(Enrichment.CallTargets, { onlyBuiltin: true })
				.filter({
					name: FlowrFilter.MatchesEnrichment,
					args: {
						enrichment: Enrichment.CallTargets,
						test:       {
							targets: Identifier.regex(functions)
						}
					}
				})
		);
	},
	async processSearchResult<T extends FlowrSearchElement<ParentInformation>[]>(
		this: void,
		elements: FlowrSearchElements<ParentInformation, T>,
		_config: unknown,
		_data: unknown,
		refineSearch: (elements: T) => AsyncOrSync<(T[number] & { certainty?: LintingResultCertainty })[]> = e => e,
	) {
		const metadata: FunctionsMetadata = {
			totalCalls:               0,
			totalFunctionDefinitions: 0
		};

		const results = (await refineSearch(elements.getElements()))
			.flatMap(element => {
				metadata.totalCalls++;
				return enrichmentContent(element, Enrichment.CallTargets).targets.map(target => {
					metadata.totalFunctionDefinitions++;
					return {
						node:      element.node,
						loc:       SourceLocation.fromNode(element.node),
						target:    target as BrandedIdentifier,
						certainty: element.certainty
					};
				});
			});

		return {
			results:
				results.map(element => ({
					certainty:  element.certainty ?? LintingResultCertainty.Certain,
					involvedId: element.node.info.id,
					function:   element.target,
					loc:        element.loc
				})).filter(e => isNotUndefined(e.loc)) as FunctionsResult[],
			'.meta': metadata
		};
	},
	prettyPrint: (functionType: string) => {
		return {
			[LintingPrettyPrintContext.Query]: (result: FunctionsResult) => `Function \`${result.function}\` at ${SourceLocation.format(result.loc)}`,
			[LintingPrettyPrintContext.Full]:  (result: FunctionsResult) => `Function \`${result.function}\` called at ${SourceLocation.format(result.loc)} is related to ${functionType}`
		};
	},
	async requireArgumentValue(
		element: FlowrSearchElement<ParentInformation>,
		pool: ReadonlyMap<string, FunctionInfo>,
		analyzer: ReadonlyFlowrAnalysisProvider,
		requireValue: RegExp | string | undefined
	): Promise<Ternary> {
		const dataflow = await analyzer.dataflow();
		// TODO das gibt manchmal undefined zurück und ich verstehe noch nicht so ganz wieso :( benutze ich das richtig?
		const identifier = Dataflow.qualify(element.node.info.id, dataflow.graph);
		/* if we have no additional info, we assume they always access the network */
		if(identifier === undefined) {
			return Ternary.Always;
		}
		// we allow our function pool to contain non-namespaced functions
		const info = pool.get(Identifier.toString(identifier)) ?? pool.get(Identifier.getName(identifier));
		if(info === undefined) {
			return Ternary.Always;
		}
		const vert = dataflow.graph.getVertex(element.node.info.id);
		if(isFunctionCallVertex(vert)){
			const args = getArgumentStringValue(
				analyzer.flowrConfig.solver.variables,
				dataflow.graph,
				vert,
				info.argIdx,
				info.argName,
				info.resolveValue,
				analyzer.inspectContext());
			// we obtain all values, at least one of them has to trigger for the request
			const argValues: string[] = args ? args.values().flatMap(s => Array.from(s)).filter(isNotUndefined).toArray() : [];
			if(argValues.length === 0){
				return Ternary.Maybe;
			} else if(argValues.some(v => requireValue instanceof RegExp ? requireValue.test(v) : v === requireValue)){
				return Ternary.Always;
			} else if(argValues.some(v => v === Unknown)) {
				return Ternary.Maybe;
			}
		}
		return Ternary.Never;
	}
};
