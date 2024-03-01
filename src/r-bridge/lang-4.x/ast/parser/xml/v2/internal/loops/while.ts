import type { XmlBasedJson } from '../../../common/input-format'
import { XmlParseError } from '../../../common/input-format'
import { getTokenType, retrieveMetaStructure } from '../../../common/meta'
import type { RFunctionCall } from '../../../../../model'
import { EmptyArgument, RawRType, RType } from '../../../../../model'
import { parseLog } from '../../../../json/parser'
import type { NormalizeConfiguration } from '../../data'
import { normalizeSingleToken } from '../single-element'

export function tryNormalizeWhile(
	config: NormalizeConfiguration,
	tokens: [
		whileToken: XmlBasedJson,
		leftParen: XmlBasedJson,
		condition: XmlBasedJson,
		rightParen: XmlBasedJson,
		body: XmlBasedJson
	]
): RFunctionCall | undefined {
	const [whileToken, leftParen, condition, rightParen, body] = tokens
	if(getTokenType(whileToken) !== RawRType.While) {
		parseLog.debug('encountered non-while token for supposed while-loop structure')
		return undefined
	} else if(getTokenType(leftParen) !== RawRType.ParenLeft) {
		throw new XmlParseError(`expected left-parenthesis for while but found ${JSON.stringify(leftParen)}`)
	} else if(getTokenType(rightParen) !== RawRType.ParenRight) {
		throw new XmlParseError(`expected right-parenthesis for while but found ${JSON.stringify(rightParen)}`
		)
	}

	parseLog.debug('trying to parse while-loop')


	const parsedCondition = normalizeSingleToken(config, condition)
	const parseBody = normalizeSingleToken(config, body)

	const { location, content } = retrieveMetaStructure(whileToken)

	return {
		type:         RType.FunctionCall,
		flavor:       'named',
		arguments:    [parsedCondition ?? EmptyArgument, parseBody ?? EmptyArgument],
		functionName: {
			type:      RType.Symbol,
			lexeme:    content,
			content,
			namespace: undefined,
			location,
			info:      {}
		},
		lexeme: content,
		location,
		info:   {
			additionalTokens: [],
			fullLexeme:       config.currentLexeme
		}
	}
}
