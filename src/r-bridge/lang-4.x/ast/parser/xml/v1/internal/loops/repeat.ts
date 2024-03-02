import type { NamedXmlBasedJson } from '../../../common/input-format'
import { ensureExpressionList, retrieveMetaStructure } from '../../../common/meta'
import type { ParserData } from '../../data'
import { tryNormalizeSingleNode } from '../structure'
import type { RRepeatLoop } from '../../../../../model'
import { RawRType, RType } from '../../../../../model'
import { guard } from '../../../../../../../../util/assert'
import { parseLog } from '../../../../json/parser'

/**
 * Try to parse the construct as a {@link RRepeatLoop}.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param repeatToken - Token which represents the `repeat` keyword
 * @param body - The `body` of the repeat-loop
 *
 * @returns The parsed {@link RRepeatLoop} or `undefined` if the given construct is not a repeat-loop
 */
export function tryNormalizeRepeat(data: ParserData, repeatToken: NamedXmlBasedJson, body: NamedXmlBasedJson): RRepeatLoop | undefined {
	if(repeatToken.name !== RawRType.Repeat) {
		parseLog.debug('encountered non-repeat token for supposed repeat-loop structure')
		return undefined
	}

	parseLog.debug('trying to parse repeat-loop')

	const parseBody = tryNormalizeSingleNode(data, body)
	guard(parseBody.type !== RType.Delimiter, () => `no body for repeat-loop ${JSON.stringify(repeatToken)} (${JSON.stringify(body)})`)

	const { location, content } = retrieveMetaStructure(repeatToken.content)

	return {
		type:   RType.RepeatLoop,
		location,
		lexeme: content,
		body:   ensureExpressionList(parseBody),
		info:   {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	}
}
