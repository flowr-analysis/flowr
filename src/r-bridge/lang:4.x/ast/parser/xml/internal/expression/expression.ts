import { getKeysGuarded, XmlBasedJson } from '../../input-format'
import { getWithTokenType, retrieveMetaStructure } from '../meta'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { parseBasedOnType } from '../structure/elements'
import { tryToParseFunctionCall } from '../functions/call'
import { Type } from '../../../../model/type'
import { RExpressionList, RFunctionCall, RNode } from '../../../../model/model'

/**
 * Returns an ExprList if there are multiple children, otherwise returns the single child directly with no expr wrapper
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj - The json object to extract the meta-information from
 */
export function parseExpression(data: ParserData, obj: XmlBasedJson): RNode {
  parseLog.debug(`[expr] ${JSON.stringify(obj)}`)
  const {
    unwrappedObj,
    content,
    location
  } = retrieveMetaStructure(data.config, obj)

  const childrenSource = getKeysGuarded<XmlBasedJson[]>(unwrappedObj, data.config.childrenName)
  const maybeFunctionCall = tryToParseFunctionCall(data, getWithTokenType(data.config.tokenMap, childrenSource))
  if (maybeFunctionCall !== undefined) {
    return maybeFunctionCall
  }

  const children = parseBasedOnType(data, childrenSource)
  if (children.length === 1) {
    return children[0]
  } else {
    return {
      type:   Type.ExpressionList,
      location,
      children,
      lexeme: content
    }
  }
}
