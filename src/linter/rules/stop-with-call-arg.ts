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
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { VertexType } from '../../dataflow/graph/vertex';
import { FunctionArgument } from '../../dataflow/graph/graph';
import { resolveIdToValue } from '../../dataflow/eval/resolve/alias-tracking';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';

export interface StopWithCallResult extends LintingResult {
	readonly loc: SourceLocation
}

export interface StopWithCallConfig extends MergeableRecord {
	foo?: boolean;
}

export interface StopWithCallMetadata extends MergeableRecord {
	consideredNodes: number
}

export const STOP_WITH_CALL_ARG = {
	createSearch:        () => Q.var('stop').filter(VertexType.FunctionCall),
	processSearchResult: (elements, _config, _data) => {
		const meta: StopWithCallMetadata = {
			consideredNodes: 0
		};
		return {
			results:
				elements.getElements()
					.filter(element => {
						//only built-in functions
						const origins = getOriginInDfg(_data.dataflow.graph, element.node.info.id);
						if(isNotUndefined(origins)){
							let builtIn = true;
							for(let i = 0; i < origins.length; i++){
								if(origins[i].type !== OriginType.BuiltInFunctionOrigin){
									builtIn = false;
								}
							}
							if(!builtIn){
								return false;
							}
						}

						const fCall = _data.dataflow.graph.getVertex(element.node.info.id) as DataflowGraphVertexFunctionCall;

						//filter out function calls with argument "call." set to false
						for(let i = 0; i < fCall.args.length; i++){
							if(FunctionArgument.hasName(fCall.args[i], 'call.')){
								const argId = FunctionArgument.getReference(fCall.args[i]) as NodeId;
								const res = resolveIdToValue(argId, { graph: _data.dataflow.graph, environment: fCall.environment, ctx: _data.analyzer.inspectContext() });
								if(res.type === 'set' && res.elements.length != 0){
									if(res.elements[0].type === 'logical'){
										return res.elements[0].value;
									}
								}
							}
						}
						return true;
					})
					.map(element => ({
						certainty:  LintingResultCertainty.Uncertain,
						involvedId: element.node.info.id,
						loc:        SourceLocation.fromNode(element.node)
					}))
					.filter(element => isNotUndefined(element.loc)) as Writable<StopWithCallResult>[],
			'.meta': meta
		};
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Code at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `Code at ${SourceLocation.format(result.loc)} does call stop without setting call. to FALSE`,
	},
	info: {
		name:          'Stop without call.=False argument',
		tags:          [LintingRuleTag.Smell],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Checks whether stop calls without call. argument set to FALSE are used.',
		defaultConfig: {}
	}
} as const satisfies LintingRule<StopWithCallResult, StopWithCallMetadata, StopWithCallConfig>;
