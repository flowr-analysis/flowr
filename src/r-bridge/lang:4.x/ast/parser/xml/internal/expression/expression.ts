
import { getKeysGuarded, XmlBasedJson } from "../../input-format"
import * as Lang from "../../../../model"
import { getWithTokenType, retrieveMetaStructure } from "../meta"
import { parseLog } from "../../parser"
import { ParserData } from "../../data"
import { parseBasedOnType } from "../structure/elements"
import { tryToParseAsFunctionCall } from "../functions/call"

/**
 * Returns an ExprList if there are multiple children, otherwise returns the single child directly with no expr wrapper
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj - The json object to extract the meta-information from
 */
export function parseExpr(data: ParserData, obj: XmlBasedJson): Lang.RNode {
  parseLog.debug(`trying to parse expr ${JSON.stringify(obj)}`)
  const {
    unwrappedObj,
    content,
    location
  } = retrieveMetaStructure(data.config, obj)

  const childrenSource = getKeysGuarded<XmlBasedJson[]>(unwrappedObj, data.config.childrenName)
  const maybeFunctionCall = tryToParseAsFunctionCall(data, getWithTokenType(data.config.tokenMap, childrenSource))
  if (maybeFunctionCall !== undefined) {
    return maybeFunctionCall
  }

  const children = parseBasedOnType(data, childrenSource)
  if (children.length === 1) {
    return children[0]
  } else {
    return {
      type:   Lang.Type.ExpressionList,
      location,
      children,
      lexeme: content
    }
  }
}
