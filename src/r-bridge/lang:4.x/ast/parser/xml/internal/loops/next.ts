import { ParserData } from '../../data'
import { XmlBasedJson } from '../../input-format'
import { parseLog } from '../../parser'
import { executeHook } from '../../hooks'
import { retrieveMetaStructure } from '../meta'
import { RNext, Type } from '../../../../model'

export function parseNext(data: ParserData, obj: XmlBasedJson): RNext {
  parseLog.debug(`[next] try: ${JSON.stringify(obj)}`)
  obj = executeHook(data.hooks.loops.onNext.before, data, obj)

  const { location, content } = retrieveMetaStructure(data.config, obj)

  const result: RNext = {
    type:   Type.Next,
    location,
    lexeme: content,
    info:   {}
  }
  return executeHook(data.hooks.loops.onNext.after, data, result)
}
