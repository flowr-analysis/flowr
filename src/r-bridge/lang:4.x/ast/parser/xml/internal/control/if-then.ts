import { NamedXmlBasedJson, XmlParseError } from '../../input-format'
import { tryNormalizeSingleNode } from '../structure'
import { ensureExpressionList, retrieveMetaStructure } from '../meta'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { Type, RIfThenElse } from '../../../../model'
import { executeHook, executeUnknownHook } from '../../hooks'

/**
 * Try to parse the construct as a {@link RIfThenElse}.
 */
export function tryNormalizeIfThen(data: ParserData,
																																			tokens: [
                                   ifToken:    NamedXmlBasedJson,
                                   leftParen:  NamedXmlBasedJson,
                                   condition:  NamedXmlBasedJson,
                                   rightParen: NamedXmlBasedJson,
                                   then:       NamedXmlBasedJson
    ]): RIfThenElse | undefined {
	// TODO: guard-like syntax for this too?
	parseLog.trace(`trying to parse if-then structure`)
	if (tokens[0].name !== Type.If) {
		parseLog.debug('encountered non-if token for supposed if-then structure')
		return executeUnknownHook(data.hooks.control.onIfThen.unknown, data, tokens)
	} else if (tokens[1].name !== Type.ParenLeft) {
		throw new XmlParseError(`expected left-parenthesis for if but found ${JSON.stringify(tokens[1])}`)
	} else if (tokens[3].name !== Type.ParenRight) {
		throw new XmlParseError(`expected right-parenthesis for if but found ${JSON.stringify(tokens[3])}`)
	}

	tokens = executeHook(data.hooks.control.onIfThen.before, data, tokens)

	const parsedCondition = tryNormalizeSingleNode(data, tokens[2])
	const parsedThen = tryNormalizeSingleNode(data, tokens[4])


	if (parsedCondition === undefined || parsedThen === undefined) {
		throw new XmlParseError(`unexpected missing parts of if, received ${JSON.stringify([parsedCondition, parsedThen])} for ${JSON.stringify(tokens)}`)
	}

	const { location, content} = retrieveMetaStructure(data.config, tokens[0].content)

	const result: RIfThenElse = {
		type:      Type.If,
		condition: parsedCondition,
		then:      ensureExpressionList(parsedThen),
		location,
		lexeme:    content,
		info:      {
			// TODO: include children etc.
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	}
	return executeHook(data.hooks.control.onIfThen.after, data, result)
}
