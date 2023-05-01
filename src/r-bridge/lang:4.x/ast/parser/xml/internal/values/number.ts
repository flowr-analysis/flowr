import { XmlBasedJson } from "../../input-format"
import * as Lang from "../../../../model"
import { NoInfo, RSymbol } from "../../../../model"
import { boolean2ts, isBoolean, isNA, number2ts, RNa } from "../../../../../values"
import { parseLog } from "../../parser"
import { retrieveMetaStructure } from "../meta"
import { XmlParserConfig } from "../../config"

/**
 * Parse the given object as a R number (see {@link number2ts}), supporting booleans (see {@link boolean2ts}),
 * and special values.
 * This requires you to check the corresponding name beforehand.
 *
 * @param config - the configuration of the parser to use to retrieve the corresponding name fields
 * @param obj - the json object to extract the meta-information from
 */
export function parseNumber (config: XmlParserConfig, obj: XmlBasedJson): Lang.RNumber | Lang.RLogical | RSymbol<NoInfo, typeof RNa> {
  parseLog.debug(`[number] try: ${JSON.stringify(obj)}`)

  const { location, content } = retrieveMetaStructure(config, obj)
  const common = { location, lexeme: content }

  /* the special symbol */
  if (isNA(content)) {
    return {
      ...common,
      namespace: undefined,
      type:      Lang.Type.Symbol,
      content
    }
  } else if (isBoolean(content)) {
    return {
      ...common,
      type:    Lang.Type.Logical,
      content: boolean2ts(content)
    }
  } else {
    return {
      ...common,
      type:    Lang.Type.Number,
      content: number2ts(content)
    }
  }
}
