import type { NormalizerData } from '../../normalizer-data';
import { assureTokenType } from '../../normalize-meta';
import { normalizeExpressions } from './normalize-expressions';
import { log } from '../../../../../../../util/log';
import { partition } from '../../../../../../../util/arrays';
import { RawRType, RType } from '../../../../model/type';
import type { RExpressionList } from '../../../../model/nodes/r-expression-list';
import type { RNode } from '../../../../model/model';
import type { RDelimiter } from '../../../../model/nodes/info/r-delimiter';
import type { JsonEntry } from '../../../json/format';


export function normalizeRootObjToAst(
	data: NormalizerData,
	obj: JsonEntry
): RExpressionList {
	const exprContent = obj.token;
	assureTokenType(exprContent, RawRType.ExpressionList);

	let parsedChildren: (RNode | RDelimiter)[] = [];

	if(obj.children.length > 0) {
		const children = obj.children;
		parsedChildren = normalizeExpressions(data, children);
	} else {
		log.debug('no children found, assume empty input');
	}

	const [delimiters, nodes] = partition(parsedChildren, x => x.type === RType.Delimiter || x.type === RType.Comment);

	return {
		type:     RType.ExpressionList,
		children: nodes as RNode[],
		grouping: undefined,
		lexeme:   undefined,
		info:     {
			fullRange:        data.currentRange,
			additionalTokens: delimiters,
			fullLexeme:       data.currentLexeme
		}
	};
}
