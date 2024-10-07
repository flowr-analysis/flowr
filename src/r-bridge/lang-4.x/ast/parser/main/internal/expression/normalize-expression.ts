import type { NormalizerData } from '../../normalizer-data';
import { getWithTokenType, retrieveMetaStructure } from '../../normalize-meta';
import { tryNormalizeAccess } from '../normalize-access';
import { partition } from '../../../../../../../util/arrays';
import type { RNode } from '../../../../model/model';
import { normalizeExpressions, splitComments } from '../structure/normalize-expressions';
import { tryNormalizeFunctionCall } from '../functions/normalize-call';
import { tryNormalizeFunctionDefinition } from '../functions/normalize-definition';
import { RType } from '../../../../model/type';
import { normalizeComment } from '../other/normalize-comment';
import type { JsonEntry } from '../../../json/format';

/**
 * Returns an expression list if there are multiple children, otherwise returns the single child directly with no expr wrapper
 *
 * @param data - The data used by the parser (see {@link NormalizerData})
 * @param entry  - The JSON object to extract the meta-information from
 */
export function normalizeExpression(data: NormalizerData, entry: JsonEntry): RNode {

	const { content, location } = retrieveMetaStructure(entry);

	const childrenSource = entry.children;
	const typed = getWithTokenType(childrenSource);

	const { others, comments } = splitComments(typed);

	const childData: NormalizerData = { ...data, currentRange: location, currentLexeme: content };

	const maybeFunctionCall = tryNormalizeFunctionCall(childData, others);
	if(maybeFunctionCall !== undefined) {
		maybeFunctionCall.info.additionalTokens = [...maybeFunctionCall.info.additionalTokens ?? [], ...comments.map(x => normalizeComment(data, x.content))];
		return maybeFunctionCall;
	}

	const maybeAccess = tryNormalizeAccess(childData, others);
	if(maybeAccess !== undefined) {
		maybeAccess.info.additionalTokens = [...maybeAccess.info.additionalTokens ?? [], ...comments.map(x => normalizeComment(data, x.content))];
		return maybeAccess;
	}

	const maybeFunctionDefinition = tryNormalizeFunctionDefinition(childData, others);
	if(maybeFunctionDefinition !== undefined) {
		maybeFunctionDefinition.info.additionalTokens = [...maybeFunctionDefinition.info.additionalTokens ?? [], ...comments.map(x => normalizeComment(data, x.content))];
		return maybeFunctionDefinition;
	}


	const children = normalizeExpressions(childData, childrenSource);

	const [delimiters, nodes] = partition(children, x => x.type === RType.Delimiter || x.type === RType.Comment);

	if(nodes.length === 1) {
		const result = nodes[0] as RNode;
		result.info.additionalTokens = [...result.info.additionalTokens ?? [], ...delimiters];
		return result;
	} else {
		return {
			type:     RType.ExpressionList,
			grouping: undefined,
			location,
			children: nodes as RNode[],
			lexeme:   content,
			info:     {
				fullRange:        childData.currentRange,
				additionalTokens: delimiters,
				fullLexeme:       childData.currentLexeme
			}
		};
	}
}
