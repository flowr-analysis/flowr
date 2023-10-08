import { getKeysGuarded, XmlBasedJson } from '../../input-format'
import { assureTokenType } from '../meta'
import { normalizeBasedOnType } from './elements'
import { ParserData } from '../../data'
import { RType, RExpressionList, RawRType } from '../../../../model'

export function parseRootObjToAst(
	data: ParserData,
	obj: XmlBasedJson
): RExpressionList {
	const exprContent = getKeysGuarded<XmlBasedJson>(obj, RawRType.ExpressionList)
	assureTokenType(data.config.tokenMap, exprContent, RawRType.ExpressionList)

	const children = getKeysGuarded<XmlBasedJson[]>(
		exprContent,
		data.config.childrenName
	)
	const parsedChildren = normalizeBasedOnType(data, children)

	return {
		type:     RType.ExpressionList,
		children: parsedChildren,
		lexeme:   undefined,
		info:     {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	}
}
