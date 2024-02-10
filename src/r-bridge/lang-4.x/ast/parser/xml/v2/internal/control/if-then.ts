import type {  XmlBasedJson } from '../../../common/input-format'
import { XmlParseError } from '../../../common/input-format'
import type { RFunctionCall } from '../../../../../model'
import { RType, RawRType } from '../../../../../model'
import { getTokenType, retrieveMetaStructure } from '../../../common/meta'
import { normalizeSingleToken } from '../single-element'
import type { NormalizeConfiguration } from '../../data'

/**
 * Try to parse the construct as a <pre> `if`(condition, then) </pre> function call.
 */
export function normalizeIfThen(
	config: NormalizeConfiguration,
	tokens: readonly [
		 ifToken:    XmlBasedJson,
		 leftParen:  XmlBasedJson,
		 condition:  XmlBasedJson,
		 rightParen: XmlBasedJson,
		 then:       XmlBasedJson
	]): RFunctionCall | undefined {
	const names = tokens.map(x => getTokenType(config.tokenMap, x))
	if(names[0] !== RawRType.If) {
		return undefined
	} else if(names[1] !== RawRType.ParenLeft) {
		throw new XmlParseError(`expected left-parenthesis for if but found ${JSON.stringify(tokens[1])}`)
	} else if(names[3] !== RawRType.ParenRight) {
		throw new XmlParseError(`expected right-parenthesis for if but found ${JSON.stringify(tokens[3])}`)
	}

	const parsedCondition = normalizeSingleToken(config, tokens[2])
	const parsedThen = normalizeSingleToken(config, tokens[4])

	const { location, content } = retrieveMetaStructure(config, tokens[0])

	return {
		type:         RType.FunctionCall,
		location,
		lexeme:       content,
		flavor:       'named',
		arguments:    [parsedCondition, parsedThen],
		functionName: {
			type:      RType.Symbol,
			location,
			lexeme:    content,
			content,
			namespace: undefined,
			info:      {}
		},
		info: {
			additionalTokens: [],
			fullLexeme:       config.currentLexeme
		},
	}
}
