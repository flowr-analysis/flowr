import type { NormalizerData } from '../../normalizer-data';
import { assureTokenType } from '../../normalize-meta';
import { normalizeExpressions } from './normalize-expressions';
import { log } from '../../../../../../../util/log';
import { partition } from '../../../../../../../util/collections/arrays';
import { RawRType, RType } from '../../../../model/type';
import type { RNode } from '../../../../model/model';
import type { RDelimiter } from '../../../../model/nodes/info/r-delimiter';
import type { JsonEntry } from '../../../json/format';
import type { RProject } from '../../../../model/nodes/r-project';


/**
 * Takes the parse data as object and produces an undecorated, normalized AST.
 * @see {@link normalize} - for a version that also decorates the AST
 */
export function normalizeRootObjToAst(
	data: NormalizerData,
	obj: JsonEntry,
	filePath?: string
): RProject {
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
		type:  RType.Project,
		files: [
			{
				filePath,
				root: {
					type:     RType.ExpressionList,
					children: nodes as RNode[],
					grouping: undefined,
					lexeme:   undefined,
					info:     {
						fullRange:  data.currentRange,
						adToks:     delimiters,
						fullLexeme: data.currentLexeme
					}
				}
			}
		]
	};
}
