import type { ParserData } from '../../data'
import type { XmlBasedJson } from '../../input-format'
import { executeHook } from '../../hooks'
import { retrieveMetaStructure } from '../meta'
import type { RNext} from '../../../../model'
import { RType } from '../../../../model'
import {parseLog} from '../../../csv/parser'

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