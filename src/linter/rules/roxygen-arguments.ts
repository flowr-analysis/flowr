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
import type { RoxygenTag } from '../../r-bridge/roxygen2/roxygen-ast';
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

function doParameterNamesDiffer(functionParamNames: string[], roxygenParamNames: unknown[]) {
	functionParamNames.sort();
	roxygenParamNames.sort();
	for(let i = 0; i < functionParamNames.length; i++) {
		if(functionParamNames[i] !== roxygenParamNames[i]) {
			return false;
		}
	}
	return true;
}

export const ROXYGEN_ARGS = {
	createSearch:        () => Q.all().filter(VertexType.FunctionDefinition),
	processSearchResult: (elements, _config, { normalize }) => {
		return {
			results:
				elements.getElements()
					.filter(element => {
						const comments = getDocumentation(element.node.info.id, normalize.idMap);
						if(!comments) {
							return false;
						}
						const parameters = getParameters(element.node);
						//get parameter names
						const functionParamNames = parameters.map(p => p.name.content.toString());
						const roxygenParamNames = comments
							.filter(tag => tag.type === KnownRoxygenTags.Param)
							.map(tag => tag.value.name);
						//test whether same list
						if(functionParamNames === null || functionParamNames.length !== roxygenParamNames.length) {
							return false;
						}
						return doParameterNamesDiffer(functionParamNames, roxygenParamNames);
					})
					.map(element => ({
						certainty:      LintingResultCertainty.Uncertain,
						involvedId:     element.node.info.id,
						loc:            SourceLocation.fromNode(element.node),
						overDocumented: ['a'],
					}))
					.filter(element => isNotUndefined(element.loc)) as Writable<RoxygenArgsResult>[],
			'.meta': {}
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Code at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Code at ${SourceLocation.format(result.loc)} has undocumented or overdocumented parameters`,
	},
	info: {
		name:          'Roxygen arguments',
		tags:          [LintingRuleTag.Smell, LintingRuleTag.Documentation, LintingRuleTag.Style],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Checks whether a function has undocumented or overdocumented parameters',
		defaultConfig: {}
	}
} as const satisfies LintingRule<RoxygenArgsResult, RoxygenArgsMetadata, RoxygenArgsConfig>;

function getParameters(node: RNode): RParameter[]{
	return RFunctionDefinition.is(node) ? node.parameters : [];
}