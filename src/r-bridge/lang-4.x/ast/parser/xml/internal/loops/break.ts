import { ParserData } from '../../data'
import { XmlBasedJson } from '../../input-format'
import { parseLog } from '../../parser'
import { executeHook } from '../../hooks'
import { retrieveMetaStructure } from '../meta'
import { RBreak, RType } from '../../../../model'

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
