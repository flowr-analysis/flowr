/*
import { getKeysGuarded, XmlBasedJson } from '../../../common/input-format'
import { assureTokenType } from '../meta'
import { normalizeBasedOnType } from './elements'
import { RType, RExpressionList, RawRType, RNode } from '../../../../../model'
import { log } from '../../../../../../../../util/log'
import { partition } from '../../../../../../../../util/arrays'
import { RDelimiter } from '../../../../../model/nodes/info'
import { NormalizeConfiguration } from '../data'

export function normalizeRootObjToAst(
	config: NormalizeConfiguration,
	obj: XmlBasedJson
): RExpressionList {
	const exprContent = getKeysGuarded<XmlBasedJson>(obj, RawRType.ExpressionList)
	assureTokenType(config.tokenMap, exprContent, RawRType.ExpressionList)

	let parsedChildren: (RNode | RDelimiter)[] = []

	if(config.children in exprContent) {
		const children = getKeysGuarded<XmlBasedJson[]>(
			exprContent,
			config.children
		)

		parsedChildren = normalizeBasedOnType(config, children)
	} else {
		log.debug('no children found, assume empty input')
	}

	const [delimiters, nodes] = partition(parsedChildren, x => x.type === RType.Delimiter)

	return {
		type:     RType.ExpressionList,
		children: nodes as RNode[],
		lexeme:   undefined,
		info:     {
			fullRange:        config.currentRange,
			additionalTokens: delimiters,
			fullLexeme:       config.currentLexeme
		}
	}
}
*/
