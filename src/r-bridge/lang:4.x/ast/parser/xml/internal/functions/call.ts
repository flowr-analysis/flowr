import { getKeysGuarded, NamedXmlBasedJson, XmlBasedJson } from '../../input-format'
import { guard, isNotUndefined } from '../../../../../../../util/assert'
import { getTokenType, getWithTokenType, retrieveMetaStructure } from '../meta'
import { splitArrayOn } from '../../../../../../../util/arrays'
import { parseLog } from '../../parser'
import { tryParseSymbol } from '../values/symbol'
import { parseBasedOnType } from '../structure/elements'
import { ParserData } from '../../data'
import { Type } from '../../../../model/type'
import { RFunctionCall } from '../../../../model/nodes/RFunctionCall'
import { RNode } from '../../../../model/model'

/**
 * Tries to parse the given data as a function call.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param mappedWithName - The json object to extract the meta-information from
 *
 * @returns The parsed {@link RFunctionCall} or `undefined` if the given construct is not a function call
 */
export function tryToParseFunctionCall(data: ParserData, mappedWithName: NamedXmlBasedJson[]): RFunctionCall | undefined {
  guard(mappedWithName.length > 0, 'to parse function calls we need at least one object to work on!')
  const fnBase = mappedWithName[0]
  if(fnBase.name !== Type.Expression) {
    parseLog.info(`expected function call name to be wrapped an expression, yet received ${JSON.stringify(fnBase)}`)
    return undefined
  }
  parseLog.trace(`trying to parse function call with ${JSON.stringify(fnBase)}`)
  const {
    unwrappedObj, content, location
  } = retrieveMetaStructure(data.config, fnBase.content)
  const symbolContent: XmlBasedJson[] = getKeysGuarded(unwrappedObj, data.config.childrenName)
  if(symbolContent.map(x => getTokenType(data.config.tokenMap, x)).findIndex(x => x === Type.FunctionCall) < 0) {
    parseLog.trace(`expected function call to have corresponding symbol, yet received ${JSON.stringify(symbolContent)}`)
    return undefined
  }
  const functionName = tryParseSymbol(data, getWithTokenType(data.config.tokenMap, symbolContent))
  guard(functionName !== undefined, 'expected function name to be a symbol, yet received none')
  const splitParametersOnComma = splitArrayOn(mappedWithName.slice(1), x => x.name === Type.Comma)
  const parameters: RNode[] = splitParametersOnComma.map(x => {
    const gotParameters = parseBasedOnType(data, x.map(x => x.content))
    guard(gotParameters.length < 2, `expected parameter to be wrapped in expression, yet received ${JSON.stringify(gotParameters)}`)
    return gotParameters.length === 0 ? undefined : gotParameters[0]
  }).filter(isNotUndefined)

  return {
    type:   Type.FunctionCall,
    location,
    lexeme: content,
    functionName,
    parameters
  }
}
