import type { ParserData } from '../../data'
import type { XmlBasedJson } from '../../input-format'
import type { RBreak } from '../../../../model'
import { RType } from '../../../../model'
import { parseLog } from '../../../json/parser'
import { expensiveTrace } from '../../../../../../../util/log'
import { retrieveMetaStructure } from '../../meta'


export function normalizeBreak(data: ParserData, obj: XmlBasedJson): RBreak {
	expensiveTrace(parseLog, () => `[break] try: ${JSON.stringify(obj)}`)

	const { location, content } = retrieveMetaStructure(obj)

	return {
		type:   RType.Break,
		location,
		lexeme: content,
		info:   {
			fullRange:        location,
			additionalTokens: [],
			fullLexeme:       content
		}
	}
}
