import { LintingPrettyPrintContext, type LintingResult, LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { SourceLocation } from '../../util/range';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { LintingRuleTag } from '../linter-tags';
import { isNotUndefined } from '../../util/assert';
import type { Writable } from 'ts-essentials';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import { DfgVertex, VertexType } from '../../dataflow/graph/vertex';
import { getArgumentStringValue } from '../../dataflow/eval/resolve/resolve-argument';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { OriginType } from '../../dataflow/origin/dfg-get-origin';
import { valueSetGuard } from '../../dataflow/eval/values/general';
import { Resolve } from '../../dataflow/environments/resolve-helper';
import { Dataflow } from '../../dataflow/graph/df-helper';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RFunctionCall, type RNamedFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier } from '../../dataflow/environments/identifier';

const ConditionConstructors: ReadonlySet<string> = new Set(['simpleCondition', 'simpleError', 'simpleWarning', 'simpleMessage', 'errorCondition', 'warningCondition']);

/** whether the call builds a condition object, for which `stop` ignores `call.`: a constructor, or a class naming `condition` */
function isConditionObject(signaled: RNamedFunctionCall<ParentInformation>, graph: DataflowGraph, data: ReadonlyFlowrAnalysisProvider): boolean {
	if(ConditionConstructors.has(Identifier.getName(signaled.functionName.content))) {
		return true;
	}
	const vertex = graph.getVertex(signaled.info.id);
	const classes = DfgVertex.isFunctionCall(vertex) ? getArgumentStringValue(data.flowrConfig.solver.variables, graph, vertex, undefined, 'class', true, data.inspectContext()) : undefined;
	return classes?.values().some(c => c.has('condition')) ?? false;
}

export type StopWithCallResult = LintingResult;

export type StopWithCallConfig = MergeableRecord;

export interface StopWithCallMetadata extends MergeableRecord {
	consideredNodes: number
}

export const STOP_WITH_CALL_ARG = {
	createSearch:        () => Q.all().filter(VertexType.FunctionCall),
	processSearchResult: async(elements, _config, data) => {
		const dataflow = await data.dataflow();
		const meta: StopWithCallMetadata = {
			consideredNodes: 0
		};
		return {
			results:
				elements.getElements()
					.filter(element => {
						const idMap = dataflow.graph.idMap;
						const fCall = dataflow.graph.getVertex(element.node.info.id) as DataflowGraphVertexFunctionCall;
						/* a call that hands over `stop` itself, like `do.call(stop, args)`, states its arguments elsewhere */
						if(!RFunctionCall.is(element.node) || Identifier.getName(fCall.name) !== 'stop') {
							return false;
						}
						if(idMap !== undefined && RNode.findEnclosing(element.node.info.id, idMap, RFunctionDefinition.is) === undefined) {
							return false;
						}
						// only built-in functions
						if(Dataflow.origin(dataflow.graph, element.node.info.id)?.some(e => e.type !== OriginType.BuiltInFunctionOrigin)) {
							return false;
						}
						// filter out function calls with argument "call." set to false
						const stopParamMap = { '...': '...', 'call.': 'call.', 'domain': 'domain' } as const;
						const mapping = FunctionSemantics.call.match.toSpec(fCall.args, stopParamMap);
						const signaled = idMap?.get(mapping.get('...')?.[0] as NodeId);
						if(RFunctionCall.isNamed(signaled) && isConditionObject(signaled, dataflow.graph, data)) {
							return false;
						}
						for(const argId of mapping.get('call.') ?? []) {
							const res = Resolve.toValue(argId, { graph: dataflow.graph, environment: fCall.environment, ctx: data.inspectContext() });
							const values = valueSetGuard(res);
							if(values?.type === 'set' && values.elements.length !== 0 && values.elements[0].type === 'logical') {
								return values.elements[0].value;
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
		defaultConfig: () => ({})
	}
} as const satisfies LintingRule<StopWithCallResult, StopWithCallMetadata, StopWithCallConfig>;
