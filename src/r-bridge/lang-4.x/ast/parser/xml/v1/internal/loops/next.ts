import { ParserData } from '../../data'
import { XmlBasedJson } from '../../../common/input-format'
import { parseLog } from '../../normalize'
import { executeHook } from '../../hooks'
import { retrieveMetaStructure } from '../meta'
import { RNext, RType } from '../../../../../model'

export function normalizeNext(data: ParserData, obj: XmlBasedJson): RNext {
	parseLog.debug(`[next] try: ${JSON.stringify(obj)}`)
	obj = executeHook(data.hooks.loops.onNext.before, data, obj)

	const { location, content } = retrieveMetaStructure(data.config, obj)

	const result: RNext = {
		type:   RType.Next,
		location,
		lexeme: content,
		info:   {
			fullRange:        data.currentRange,
			additionalTokens: [],
			fullLexeme:       data.currentLexeme
		}
	}
	return executeHook(data.hooks.loops.onNext.after, data, result)
}
