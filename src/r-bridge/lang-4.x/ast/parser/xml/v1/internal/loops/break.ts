import { ParserData } from '../../data'
import { XmlBasedJson } from '../../../common/input-format'
import { parseLog } from '../../normalize'
import { executeHook } from '../../hooks'
import { retrieveMetaStructure } from '../../../common/meta'
import { RBreak, RType } from '../../../../../model'

export function normalizeBreak(data: ParserData, obj: XmlBasedJson): RBreak {
	parseLog.debug(`[break] try: ${JSON.stringify(obj)}`)
	obj = executeHook(data.hooks.loops.onBreak.before, data, obj)

	const { location, content } = retrieveMetaStructure(data.config, obj)

	const result: RBreak = {
		type:   RType.Break,
		location,
		lexeme: content,
		info:   {
			fullRange:        location,
			additionalTokens: [],
			fullLexeme:       content
		}
	}
	return executeHook(data.hooks.loops.onBreak.after, data, result)
}
