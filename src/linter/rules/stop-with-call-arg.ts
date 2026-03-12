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
import { resolveIdToValue } from '../../dataflow/eval/resolve/alias-tracking';
import { getOriginInDfg, OriginType } from '../../dataflow/origin/dfg-get-origin';
import { pMatch } from '../../dataflow/internal/linker';
import { getArgsOfName } from '../../dataflow/internal/process/functions/call/built-in/built-in-try-catch';
import { valueSetGuard } from '../../dataflow/eval/values/general';

export interface StopWithCallResult extends LintingResult {
	readonly loc: SourceLocation
}

export type StopWithCallConfig = MergeableRecord;

export interface StopWithCallMetadata extends MergeableRecord {
	consideredNodes: number
}

export const STOP_WITH_CALL_ARG = {
	createSearch:        () => Q.var('stop').filter(VertexType.FunctionCall),
	processSearchResult: (elements, _config, { dataflow, analyzer }) => {
		const meta: StopWithCallMetadata = {
			consideredNodes: 0
		};
		return {
			results:
				elements.getElements()
					.filter(element => {
						//only built-in functions
						const origins = getOriginInDfg(dataflow.graph, element.node.info.id);
						if(isNotUndefined(origins)) {
							const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
							if(!builtIn){
								return false;
							}
						}

						const fCall = dataflow.graph.getVertex(element.node.info.id) as DataflowGraphVertexFunctionCall;

						//filter out function calls with argument "call." set to false
						const stopParamMap = {
							'...':    '...',
							'call.':  'call.',
							'domain': 'domain'
						};
						const mapping = pMatch(fCall.args, stopParamMap);
						const mappedToStop = getArgsOfName(mapping, 'call.');
						for(const argId of mappedToStop) {
							const res = resolveIdToValue(argId, { graph: dataflow.graph, environment: fCall.environment, ctx: analyzer.inspectContext() });
							const values = valueSetGuard(res);
							if(values?.type === 'set' && values.elements.length !== 0){
								if(values.elements[0].type === 'logical'){
									return values.elements[0].value;
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
