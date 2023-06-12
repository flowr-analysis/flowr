import { NamedXmlBasedJson, XmlBasedJson } from '../../input-format'
import { RDelimiter, Type } from '../../../../model'
import { parseLog } from '../../parser'
import { retrieveMetaStructure } from '../meta'
import { executeHook } from '../../hooks'
import { ParserData } from '../../data'

/**
 * Parse the given object as an R delimiter (parenthesis, braces, ...).
 * This requires you to check the corresponding name beforehand.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj  - The json object to extract the meta-information from
 */
export function parseDelimiter(data: ParserData, obj: NamedXmlBasedJson): RDelimiter {
  parseLog.debug(`[delimiter] try: ${JSON.stringify(obj)}`)
  obj = executeHook(data.hooks.other.onDelimiter.before, data, obj)

  const { location, content } = retrieveMetaStructure(data.config, obj.content)

  const result: RDelimiter = {
    type:    Type.Delimiter,
    lexeme:  content,
    subtype: obj.name,
    info:    {},
    location
  }
  return executeHook(data.hooks.other.onDelimiter.after, data, result)
}
