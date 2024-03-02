import type { ParserData } from '../../data'
import type { XmlBasedJson } from '../../../common/input-format'
import { retrieveMetaStructure } from '../../../common/meta'
import type { RBreak } from '../../../../../model'
import { RType } from '../../../../../model'
import { parseLog } from '../../../../json/parser'

export function normalizeBreak(data: ParserData, obj: XmlBasedJson): RBreak {
	parseLog.debug(`[break] try: ${JSON.stringify(obj)}`)

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
