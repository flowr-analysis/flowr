import { XmlBasedJson } from '../../input-format'
import { retrieveMetaStructure } from '../meta'
import { string2ts } from '../../../../../values'
import { parseLog } from '../../parser'
import { Type, RString } from '../../../../model'
import { executeHook } from '../../hooks'
import { ParserData } from '../../data'

/**
 * Parse the given object as a R string (see {@link string2ts}).
 * This requires you to check the corresponding name beforehand.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj  - The json object to extract the meta-information from
 */
export function parseString(data: ParserData, obj: XmlBasedJson): RString {
  parseLog.debug(`[string] try: ${JSON.stringify(obj)}`)
  obj = executeHook(data.hooks.values.onString.before, data, obj)

  const { location, content } = retrieveMetaStructure(data.config, obj)

  const result: RString = {
    type:    Type.String,
    location,
    content: string2ts(content),
    lexeme:  content,
    info:    {
      // TODO: include children etc.
      fullRange:        data.currentRange,
      additionalTokens: [],
      fullLexeme:       data.currentLexeme
    }
  }
  return executeHook(data.hooks.values.onString.after, data, result)
}
