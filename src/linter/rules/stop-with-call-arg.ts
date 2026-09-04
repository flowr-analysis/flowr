import { LintingPrettyPrintContext, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { isNotUndefined } from '../../util/assert';
import type { Writable } from 'ts-essentials';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { VertexType } from '../../dataflow/graph/vertex';
import { OriginType } from '../../dataflow/origin/dfg-get-origin';
import { valueSetGuard } from '../../dataflow/eval/values/general';
import { Resolve } from '../../dataflow/environments/resolve-helper';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier } from '../../dataflow/environments/identifier';

/** base R's constructors of condition objects, which `stop` signals as they are */
const ConditionConstructors: ReadonlySet<string> = new Set(['simpleCondition', 'simpleError', 'simpleWarning', 'simpleMessage', 'errorCondition', 'warningCondition']);

export type StopWithCallResult = LintingResult;

export type StopWithCallConfig = MergeableRecord;

export interface StopWithCallMetadata extends MergeableRecord {
	consideredNodes: number
}

export const STOP_WITH_CALL_ARG = {
	createSearch:        () => Q.var('stop').filter(VertexType.FunctionCall),
	processSearchResult: async(elements, _config, data) => {
		const dataflow = await data.dataflow();
		const meta: StopWithCallMetadata = {
			consideredNodes: 0
		};
		return {
			results:
				elements.getElements()
					.filter(element => {
						/* R appends the call only when there is one: a top-level `stop` reports the message alone */
						const idMap = dataflow.graph.idMap;
						if(idMap !== undefined && RNode.findEnclosing(element.node.info.id, idMap, RFunctionDefinition.is) === undefined) {
							return false;
						}
						//only built-in functions
						const origins = Dataflow.origin(dataflow.graph, element.node.info.id);
						if(isNotUndefined(origins)) {
							const builtIn = origins.every(e => e.type === OriginType.BuiltInFunctionOrigin);
							if(!builtIn) {
								return false;
							}
						}

						const fCall = dataflow.graph.getVertex(element.node.info.id) as DataflowGraphVertexFunctionCall;

						//filter out function calls with argument "call." set to false
						const stopParamMap = {
							'...':    '...',
							'call.':  'call.',
							'domain': 'domain'
						} as const;
						const mapping = FunctionSemantics.call.match.toSpec(fCall.args, stopParamMap);
						/* a condition object carries its own call, so `call.` is ignored for it */
						const signaled = idMap?.get(mapping.get('...')?.[0] as NodeId);
						if(RFunctionCall.isNamed(signaled) && ConditionConstructors.has(Identifier.getName(signaled.functionName.content))) {
							return false;
						}
						const mappedToStop = mapping.get('call.') ?? [];
						for(const argId of mappedToStop) {
							const res = Resolve.toValue(argId, { graph: dataflow.graph, environment: fCall.environment, ctx: data.inspectContext() });
							const values = valueSetGuard(res);
							if(values?.type === 'set' && values.elements.length !== 0) {
								if(values.elements[0].type === 'logical') {
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
		[LintingPrettyPrintContext.Query]: result => `\`stop()\` without \`call. = FALSE\` at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  result => `\`stop()\` at ${SourceLocation.format(result.loc)} is called without \`call. = FALSE\`; the originating call is then appended to the error message, which is usually not intended - pass \`call. = FALSE\` to suppress it`,
	},
	info: {
		name:          'Stop without call.=False argument',
		tags:          [LintingRuleTag.Smell],
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Checks whether stop calls without call. argument set to FALSE are used.',
		defaultConfig: {}
	}
} as const satisfies LintingRule<StopWithCallResult, StopWithCallMetadata, StopWithCallConfig>;
