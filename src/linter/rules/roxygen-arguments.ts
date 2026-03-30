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
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RoxygenTag, RoxygenTagParam } from '../../r-bridge/roxygen2/roxygen-ast';
import { KnownRoxygenTags } from '../../r-bridge/roxygen2/roxygen-ast';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { getDocumentationOf } from '../../r-bridge/roxygen2/documentation-provider';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';

export interface RoxygenArgsResult extends LintingResult {
	readonly loc:              SourceLocation
	readonly overDocumented?:  string[]
	readonly underDocumented?: string[]
}

export type RoxygenArgsConfig = MergeableRecord;

export type RoxygenArgsMetadata = MergeableRecord;

function getDocumentation(id: NodeId, idMap: AstIdMap): readonly RoxygenTag[] | undefined {
	const comment = getDocumentationOf(id, idMap);
	if(comment === undefined){
		return undefined;
	}
	return Array.isArray(comment) ? comment : [comment] as readonly RoxygenTag[];
}

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
	createSearch:        () => Q.all().filter(VertexType.FunctionDefinition),
	processSearchResult: (elements, _config, { normalize }) => {
		return {
			results:
				elements.getElements()
					.map(element => ({
						element,
						underDocumented: [] as string[],
						overDocumented:  [] as string[]
					}))
					.filter(({ element: { node }, underDocumented, overDocumented }) => {
						const comments = getDocumentation(node.info.id, normalize.idMap);
						if(!comments) {
							return false;
						}
						const parameters = getParameters(node);
						//get parameter names
						const functionParamNames = parameters.map(p => p.name.content.toString());
						const inheritedParams = comments.filter(tag => (tag?.inherited && tag.type === KnownRoxygenTags.Param)).map(tag => ((tag as RoxygenTagParam).value.name));
						const roxygenParamNames  = comments
							.filter(tag => tag.type === KnownRoxygenTags.Param)
							.map(tag => tag.value.name);
						if(functionParamNames === null || roxygenParamNames == null){
							return false;
						}
						const result = calculateArgumentDiff(inheritedParams, functionParamNames, roxygenParamNames);
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