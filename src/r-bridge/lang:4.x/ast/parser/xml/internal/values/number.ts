import { XmlBasedJson } from '../../input-format'
import { boolean2ts, isBoolean, isNA, number2ts, RNa } from '../../../../../values'
import { parseLog } from '../../parser'
import { retrieveMetaStructure } from '../meta'
import { XmlParserConfig } from '../../config'
import { Type } from '../../../../model/type'
import { NoInfo } from '../../../../model/model'
import { RNumber } from '../../../../model/nodes/RNumber'
import { RSymbol } from '../../../../model/nodes/RSymbol'
import { RLogical } from '../../../../model/nodes/RLogical'
import { ParserData } from '../../data'
import { executeHook } from '../../hooks'

/**
 * Parse the given object as a R number (see {@link number2ts}), supporting booleans (see {@link boolean2ts}),
 * and special values.
 * This requires you to check the corresponding name beforehand.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj - the json object to extract the meta-information from
 */
export function parseNumber(data: ParserData, obj: XmlBasedJson): RNumber | RLogical | RSymbol<NoInfo, typeof RNa> {
  parseLog.debug(`[number] try: ${JSON.stringify(obj)}`)
  obj = executeHook(data.hooks.values.onNumber.before, data, obj)

  const { location, content } = retrieveMetaStructure(data.config, obj)
  const common = { location, lexeme: content }

  let result:  RNumber | RLogical | RSymbol<NoInfo, typeof RNa>
  /* the special symbol */
  if (isNA(content)) {
    result = {
      ...common,
      namespace: undefined,
      type:      Type.Symbol,
      content
    }
  } else if (isBoolean(content)) {
    result = {
      ...common,
      type:    Type.Logical,
      content: boolean2ts(content)
    }
  } else {
    result = {
      ...common,
      type:    Type.Number,
      content: number2ts(content)
    }
  }
  return executeHook(data.hooks.values.onNumber.after, data, result)
}
