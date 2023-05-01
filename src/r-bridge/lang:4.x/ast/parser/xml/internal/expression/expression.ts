import { getKeysGuarded, XmlBasedJson } from '../../input-format'
import { getWithTokenType, retrieveMetaStructure } from '../meta'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { parseBasedOnType } from '../structure/elements'
import { tryToParseFunctionCall } from '../functions/call'
import { Type } from '../../../../model/type'
import { RExpressionList, RFunctionCall, RNode } from '../../../../model/model'
import { executeHook } from '../../hooks'

/**
 * Returns an ExprList if there are multiple children, otherwise returns the single child directly with no expr wrapper
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj - The json object to extract the meta-information from
 */
export function parseExpression(data: ParserData, obj: XmlBasedJson): RNode {
  parseLog.debug(`[expr] ${JSON.stringify(obj)}`)
  obj = executeHook(data.hooks.expression.onExpression.before, data, obj)

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
  let result: RNode
  if (children.length === 1) {
    result = children[0]
  } else {
    result = {
      type:   Type.ExpressionList,
      location,
      children,
      lexeme: content
    }
  }
  return executeHook(data.hooks.expression.onExpression.after, data, result)
}
