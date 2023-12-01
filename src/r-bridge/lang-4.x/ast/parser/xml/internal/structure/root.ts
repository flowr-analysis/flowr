import { getKeysGuarded, XmlBasedJson } from '../../input-format'
import { assureTokenType } from '../meta'
import { normalizeBasedOnType } from './elements'
import { ParserData } from '../../data'
import { RType, RExpressionList, RawRType, RNode } from '../../../../model'
import { log } from '../../../../../../../util/log'

export function parseRootObjToAst(
	data: ParserData,
	obj: XmlBasedJson
): RExpressionList {
	const config = data.config
	const exprContent = getKeysGuarded<XmlBasedJson>(obj, RawRType.ExpressionList)
	assureTokenType(config.tokenMap, exprContent, RawRType.ExpressionList)

	let parsedChildren: RNode[] = []

	if(config.childrenName in exprContent) {
		const children = getKeysGuarded<XmlBasedJson[]>(
			exprContent,
			config.childrenName
		)
		parsedChildren = normalizeBasedOnType(data, children)
	} else {
		log.debug('no children found, assume empty input')
	}

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
