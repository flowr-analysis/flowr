import { XmlBasedJson } from "../../input-format"
import * as Lang from "../../../../model"
import { retrieveMetaStructure } from "../meta"
import { string2ts } from "../../../../../values"
import { parseLog } from "../../parser"
import { XmlParserConfig } from "../../config"

/**
 * Parse the given object as a R string (see {@link string2ts}).
 * This requires you to check the corresponding name beforehand.
 *
 * @param config - the configuration of the parser to use to retrieve the corresponding name fields
 * @param obj - the json object to extract the meta-information from
 */
export function parseString(config: XmlParserConfig, obj: XmlBasedJson): Lang.RString {
  parseLog.debug(`[string] try: ${JSON.stringify(obj)}`)
  const { location, content } = retrieveMetaStructure(config, obj)

  return {
    type:    Lang.Type.String,
    location,
    content: string2ts(content),
    lexeme:  content
  }
}
