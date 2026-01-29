import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { LinkToNestedCall } from './call-context-query-format';
import type { PromotedLinkTo } from './call-context-query-executor';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { getSubCallGraph } from '../../../dataflow/graph/call-graph';

/**
 * **Please refer to {@link identifyLinkToRelation}.**
 *
 * Links to the nested call context of the current function call.
 * This is useful for identifying calls made within nested functions
 * that should be associated with their parent function's call context.
 */
export async function identifyLinkToNestedRelation(
	from: NodeId,
	analyzer: ReadonlyFlowrAnalysisProvider,
	{ callName, ignoreIf }: LinkToNestedCall<RegExp> | PromotedLinkTo<LinkToNestedCall<RegExp>>
): Promise<NodeId[]> {
	const df = await analyzer.dataflow();
	if(ignoreIf?.(from, df.graph)) {
		return [];
	}

	const found: NodeId[] = [];
	const cg = await analyzer.callGraph();
	const subCg = getSubCallGraph(cg, new Set([from]));
	for(const [,{ id, name }] of subCg.vertices(true)) {
		if(typeof name !== 'string') {
			continue;
		}
		if(callName instanceof RegExp ? callName.test(name) : callName.has(name)) {
			found.push(id);
		}
	}
	// TODO: allow to inverse checks to link to all nested calls! ~> rename linktonested
	return found;
}