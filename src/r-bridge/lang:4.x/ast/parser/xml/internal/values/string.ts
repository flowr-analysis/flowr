import { XmlBasedJson } from '../../input-format'
import { retrieveMetaStructure } from '../meta'
import { string2ts } from '../../../../../values'
import { parseLog } from '../../parser'
import { XmlParserConfig } from '../../config'
import { Type } from '../../../../model/type'
import { RString } from '../../../../model/nodes/RString'
import { executeHook } from '../../hooks'
import { ParserData } from '../../data'

/**
 * Parse the given object as a R string (see {@link string2ts}).
 * This requires you to check the corresponding name beforehand.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj - the json object to extract the meta-information from
 */
export function parseString(data: ParserData, obj: XmlBasedJson): RString {
  parseLog.debug(`[string] try: ${JSON.stringify(obj)}`)
  obj = executeHook(data.hooks.values.onString.before, data, obj)

  const { location, content } = retrieveMetaStructure(data.config, obj)

  const result = {
    type:    Type.String,
    location,
    content: string2ts(content),
    lexeme:  content
  }
  return executeHook(data.hooks.values.onString.after, data, result)
}
