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
import { parseRoxygenCommentsOfNode } from '../../r-bridge/roxygen2/roxygen-parse';
import { KnownRoxygenTags } from '../../r-bridge/roxygen2/roxygen-ast';
import type { RoxygenBlock } from '../../r-bridge/roxygen2/roxygen-ast';
import type { DataflowInformation } from '../../dataflow/info';
import type { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
export interface RoxygenArgsResult extends LintingResult {
	readonly loc: SourceLocation
}

export type RoxygenArgsConfig = MergeableRecord;

export interface RoxygenArgsMetadata extends MergeableRecord {
	consideredNodes: number
}

export const ROXYGEN_ARGS = {
	createSearch:        () => Q.all().filter(VertexType.FunctionDefinition),
	processSearchResult: (elements, _config, { dataflow }) => {
		const meta: RoxygenArgsMetadata = {
			consideredNodes: 0
		};
		return {
			results:
				elements.getElements()
					//only functions with a comment
					.filter(element => isNotUndefined(parseRoxygenCommentsOfNode(element.node, dataflow.graph.idMap)))
					.map(element => ({
						element:    element,
						comment:    parseRoxygenCommentsOfNode(element.node, dataflow.graph.idMap) as RoxygenBlock,
						parameters: getParameters(element.node.info.id, dataflow)
					}))
					.filter(({ comment, parameters }) => {
						//get parameter names
						const functionParamNames = parameters.map(p => p.name.content.toString());
						const roxygenParamNames = comment.tags.filter(tag => tag.type===KnownRoxygenTags.Param).map(tag => tag.value.name);
						//test whether same list
						let sameParams = false;
						if(functionParamNames !== null && roxygenParamNames !== null && functionParamNames.length === roxygenParamNames.length){
							sameParams = true;
							for(let i = 0; i < functionParamNames.length; i++){
								if(functionParamNames.sort()[i] !== roxygenParamNames.sort()[i]){
									sameParams = false;
									break;
								}
							}
						}
						return !sameParams;
					})
					.map(({ element }) => ({
						certainty:  LintingResultCertainty.Uncertain,
						involvedId: element.node.info.id,
						loc:        SourceLocation.fromNode(element.node)
					}))
					.filter(element => isNotUndefined(element.loc)) as Writable<RoxygenArgsResult>[],
			'.meta': meta
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

function getParameters(id: NodeId, dataflow: DataflowInformation): RParameter[]{
	return (dataflow.graph.idMap?.get(id) as RFunctionDefinition).parameters;
}