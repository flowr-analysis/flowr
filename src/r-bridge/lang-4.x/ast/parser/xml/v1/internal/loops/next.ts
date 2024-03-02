import type { ParserData } from '../../data'
import type { XmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure } from '../../../common/meta'
import type { RNext } from '../../../../../model'
import { RType } from '../../../../../model'
import { parseLog } from '../../../../json/parser'
import { expensiveTrace } from '../../../../../../../../util/log'

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
