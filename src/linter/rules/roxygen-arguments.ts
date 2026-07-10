import {
	LintingPrettyPrintContext,
	type LintingResult,
	LintingResultCertainty,
	type LintingRule,
	LintingRuleCertainty
} from '../linter-format';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { isNotUndefined } from '../../util/assert';
import type { Writable } from 'ts-essentials';
import { VertexType } from '../../dataflow/graph/vertex';
import { KnownRoxygenTags } from '../../r-bridge/roxygen2/roxygen-ast';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { Enrichment, enrichmentContent } from '../../search/search-executor/search-enrichers';

export interface RoxygenArgsResult extends LintingResult {
	readonly overDocumented?:  string[]
	readonly underDocumented?: string[]
}

export type RoxygenArgsConfig = MergeableRecord;

export type RoxygenArgsMetadata = MergeableRecord;

function calculateArgumentDiff(inheritedParams: readonly string[], functionParam: readonly string[], roxygenParam: readonly string[]): false | { under: string[], over: string[] }{

	//match documented against existing params
	let underDocumented = new Set(functionParam);
	const notOverDocumented = underDocumented.has('...');
	let overDocumented = new Set(roxygenParam);
	const commonParams = underDocumented.intersection(overDocumented);
	underDocumented = underDocumented.difference(commonParams);
	overDocumented = overDocumented.difference(commonParams);

	//case: '...', overdocumentation not possible
	if(notOverDocumented){
		//if still remaining overdocumented parameters, "..." doesn't need to be documented
		if(overDocumented.size > 0){
			underDocumented.delete('...');
		}
		//can't be overdocumented
		overDocumented.clear();
	}
	//inherited params removed from list of overdocumented params
	overDocumented = overDocumented.difference(new Set(inheritedParams));

	return underDocumented.size === 0 && overDocumented.size === 0 ? false : { under: Array.from(underDocumented), over: Array.from(overDocumented) };
}

export const ROXYGEN_ARGS = {
	createSearch: () => Q.all()
		.filter(VertexType.FunctionDefinition)
		.with(Enrichment.Roxygen),
	processSearchResult: (elements, _config) => {
		return {
			results:
				elements.getElements()
					.map(element => ({
						element,
						underDocumented: [] as string[],
						overDocumented:  [] as string[]
					}))
					.filter(({ element, underDocumented, overDocumented }) => {
						const roxygen = enrichmentContent(element, Enrichment.Roxygen);
						if(!roxygen.documentation.length) {
							return false;
						}
						//get parameter names
						const params = roxygen.tags[KnownRoxygenTags.Param] ?? [];
						const functionParamNames = getParameters(element.node).map(p => p.name.content.toString());
						const inheritedParams = params.filter(tag => tag.inherited).map(tag => tag.value.name);
						const roxygenParamNames = params.map(tag => tag.value.name);
						const result = calculateArgumentDiff(inheritedParams ?? [], functionParamNames, roxygenParamNames);
						if(result === false){
							return false;
						}
						underDocumented.push(...result.under);
						overDocumented.push(...result.over);
						return true;
					})
					.map(({ element, overDocumented, underDocumented }) => ({
						certainty:       LintingResultCertainty.Uncertain,
						involvedId:      element.node.info.id,
						loc:             SourceLocation.fromNode(element.node),
						underDocumented: underDocumented,
						overDocumented:  overDocumented
					}))
					.filter(element => isNotUndefined(element.loc)) as Writable<RoxygenArgsResult>[],
			'.meta': {}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Code at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Code at ${SourceLocation.format(result.loc)} has undocumented parameters: ${result.underDocumented?.join()} and overdocumented parameters: ${result.overDocumented?.join()}`
	},
	info: {
		name:          'Roxygen Arguments',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Documentation, LintingRuleTag.Style],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Checks whether a function has undocumented or overdocumented parameters',
		defaultConfig: {}
	}
} as const satisfies LintingRule<RoxygenArgsResult, RoxygenArgsMetadata, RoxygenArgsConfig>;

function getParameters(node: RNode): RParameter[]{
	return RFunctionDefinition.is(node) ? node.parameters : [];
}
