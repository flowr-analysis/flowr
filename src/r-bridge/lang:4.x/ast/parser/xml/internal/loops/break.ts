import { ParserData } from '../../data'
import { XmlBasedJson } from '../../input-format'
import { parseLog } from '../../parser'
import { executeHook } from '../../hooks'
import { retrieveMetaStructure } from '../meta'
import { RBreak, Type } from '../../../../model'

export function parseBreak(data: ParserData, obj: XmlBasedJson): RBreak {
  parseLog.debug(`[break] try: ${JSON.stringify(obj)}`)
  obj = executeHook(data.hooks.loops.onBreak.before, data, obj)

  const { location, content } = retrieveMetaStructure(data.config, obj)

  const result: RBreak = {
    type:   Type.Break,
    location,
    lexeme: content,
    info:   {}
  }
  return executeHook(data.hooks.loops.onBreak.after, data, result)
}
