import { getKeysGuarded, XmlBasedJson } from '../../input-format'
import { getWithTokenType, retrieveMetaStructure } from '../meta'
import { parseLog } from '../../parser'
import { ParserData } from '../../data'
import { parseBasedOnType } from '../structure'
import { tryToParseFunctionCall, tryToParseFunctionDefinition } from '../functions'
import { Type, RNode } from '../../../../model'
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
  const typed = getWithTokenType(data.config.tokenMap, childrenSource)
  const maybeFunctionCall = tryToParseFunctionCall(data, typed)
  if (maybeFunctionCall !== undefined) {
    return maybeFunctionCall
  }

  const maybeFunctionDefinition = tryToParseFunctionDefinition(data, typed)
  if (maybeFunctionDefinition !== undefined) {
    return maybeFunctionDefinition
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
      lexeme: content,
      info:   {}
    }
  }
  return executeHook(data.hooks.expression.onExpression.after, data, result)
}
