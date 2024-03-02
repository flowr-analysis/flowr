import type { ParserData } from '../../data'
import type { RNext } from '../../../../model'
import { RType } from '../../../../model'
import type { XmlBasedJson } from '../../input-format'
import { expensiveTrace } from '../../../../../../../util/log'
import { parseLog } from '../../../json/parser'
import { retrieveMetaStructure } from '../../meta'

export function normalizeNext(data: ParserData, obj: XmlBasedJson): RNext {
	expensiveTrace(parseLog, () => `[next] try: ${JSON.stringify(obj)}`)

	const { location, content } = retrieveMetaStructure(obj)

	return {
		type:   RType.Next,
		location,
		lexeme: content,
		info:   {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	}
}
