import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { LinkTo, LinkToLastCall, LinkToNestedCall } from './call-context-query-format';
import type { PromotedLinkTo } from './call-context-query-executor';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { identifyLinkToLastCallRelation } from './identify-link-to-last-call-relation';
import { identifyLinkToNestedRelation } from './identify-link-to-nested-call-relation';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { assertUnreachable } from '../../../util/assert';

/**
 * This facade selects the appropriate link-to relation identification function
 * based on the type of link-to relation specified.
 */
export async function identifyLinkToRelation(
	from: NodeId,
	analyzer: ReadonlyFlowrAnalysisProvider,
	l: LinkTo | PromotedLinkTo,
	knownCalls?: Map<NodeId, Required<DataflowGraphVertexFunctionCall>>
): Promise<NodeId[]> {
	switch(l.type) {
		case 'link-to-last-call':
			return identifyLinkToLastCallRelation(from, analyzer, l as LinkToLastCall<RegExp> | PromotedLinkTo<LinkToLastCall<RegExp>>, knownCalls);
		case 'link-to-nested-call':
			return identifyLinkToNestedRelation(from, analyzer, l as LinkToNestedCall<RegExp> | PromotedLinkTo<LinkToNestedCall<RegExp>>);
		default:
			assertUnreachable(l);
	}
}