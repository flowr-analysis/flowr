import { NamedXmlBasedJson, XmlParseError } from "../../input-format"
import { ensureExpressionList, retrieveMetaStructure } from '../meta'
import { parseLog } from "../../parser"
import { tryNormalizeSingleNode } from '../structure'
import { ParserData } from "../../data"
import { Type, RWhileLoop } from '../../../../model'
import { executeHook, executeUnknownHook } from '../../hooks'

export function tryNormalizeWhile(
	data: ParserData,
	whileToken: NamedXmlBasedJson,
	leftParen: NamedXmlBasedJson,
	condition: NamedXmlBasedJson,
	rightParen: NamedXmlBasedJson,
	body: NamedXmlBasedJson
): RWhileLoop | undefined {
	if(whileToken.name !== Type.While) {
		parseLog.debug(
			"encountered non-while token for supposed while-loop structure"
		)
		return executeUnknownHook(data.hooks.loops.onWhileLoop.unknown, data, { whileToken, leftParen, condition, rightParen, body })
	} else if(leftParen.name !== Type.ParenLeft) {
		throw new XmlParseError(
			`expected left-parenthesis for while but found ${JSON.stringify(
				leftParen
			)}`
		)
	} else if(rightParen.name !== Type.ParenRight) {
		throw new XmlParseError(
			`expected right-parenthesis for while but found ${JSON.stringify(
				rightParen
			)}`
		)
	}

	parseLog.debug(
		`trying to parse while-loop`
	)


	const parsedCondition = tryNormalizeSingleNode(data, condition)
	const parseBody = tryNormalizeSingleNode(data, body)

	if(parsedCondition === undefined || parseBody === undefined) {
		throw new XmlParseError(
			`unexpected under-sided while-loop, received ${JSON.stringify([
				parsedCondition,
				parseBody,
			])} for ${JSON.stringify([whileToken, condition, body])}`
		)
	}

	const { location, content } = retrieveMetaStructure(
		data.config,
		whileToken.content
	)

	const result: RWhileLoop = {
		type:      Type.While,
		condition: parsedCondition,
		body:      ensureExpressionList(parseBody),
		lexeme:    content,
		location,
		info:      {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	}
	return executeHook(data.hooks.loops.onWhileLoop.after, data, result)
}
