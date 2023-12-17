import { getKeysGuarded, XmlBasedJson } from '../../input-format'
import { assureTokenType } from '../meta'
import { normalizeBasedOnType } from './elements'
import { ParserData } from '../../data'
import { RType, RExpressionList, RawRType, RNode } from '../../../../../model'
import { log } from '../../../../../../../../util/log'
import { partition } from '../../../../../../../../util/arrays'
import { RDelimiter } from '../../../../../model/nodes/info'

export function normalizeRootObjToAst(
	data: ParserData,
	obj: XmlBasedJson
): RExpressionList {
	const config = data.config
	const exprContent = getKeysGuarded<XmlBasedJson>(obj, RawRType.ExpressionList)
	assureTokenType(config.tokenMap, exprContent, RawRType.ExpressionList)

	let parsedChildren: (RNode | RDelimiter)[] = []

	if(config.children in exprContent) {
		const children = getKeysGuarded<XmlBasedJson[]>(
			exprContent,
			config.children
		)

		parsedChildren = normalizeBasedOnType(data, children)
	} else {
		log.debug('no children found, assume empty input')
	}

	const [delimiters, nodes] = partition(parsedChildren, x => x.type === RType.Delimiter)

	return {
		type:     RType.ExpressionList,
		children: nodes as RNode[],
		lexeme:   undefined,
		info:     {
			fullRange:        data.currentRange,
			additionalTokens: delimiters,
			fullLexeme:       data.currentLexeme
		}
	}
}
