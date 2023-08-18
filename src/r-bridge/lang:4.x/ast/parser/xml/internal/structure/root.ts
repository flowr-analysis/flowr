import { getKeysGuarded, XmlBasedJson } from "../../input-format"
import { assureTokenType } from "../meta"
import { normalizeBasedOnType } from "./elements"
import { ParserData } from "../../data"
import { Type, RExpressionList } from '../../../../model'

export function parseRootObjToAst(
	data: ParserData,
	obj: XmlBasedJson
): RExpressionList {
	const exprContent = getKeysGuarded<XmlBasedJson>(obj, Type.ExpressionList)
	assureTokenType(data.config.tokenMap, exprContent, Type.ExpressionList)

	const children = getKeysGuarded<XmlBasedJson[]>(
		exprContent,
		data.config.childrenName
	)
	const parsedChildren = normalizeBasedOnType(data, children)

	// TODO: at total object in any case of error?
	return {
		type:     Type.ExpressionList,
		children: parsedChildren,
		lexeme:   undefined,
		info:     {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	}
}
