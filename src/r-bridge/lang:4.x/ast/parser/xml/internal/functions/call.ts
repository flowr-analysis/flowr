import { getKeysGuarded, NamedXmlBasedJson, XmlBasedJson } from '../../input-format'
import { guard, isNotUndefined } from '../../../../../../../util/assert'
import { getTokenType, getWithTokenType, retrieveMetaStructure } from '../meta'
import { splitArrayOn } from '../../../../../../../util/arrays'
import { parseLog } from '../../parser'
import { tryParseSymbol } from '../values'
import { parseBasedOnType } from '../structure'
import { ParserData } from '../../data'
import { Type, RNode, RFunctionCall } from '../../../../model'
import { executeHook, executeUnknownHook } from '../../hooks'

/**
 * Tries to parse the given data as a function call.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param mappedWithName - The json object to extract the meta-information from
 *
 * @returns The parsed {@link RFunctionCall} or `undefined` if the given construct is not a function call
 */
export function tryToParseFunctionCall(data: ParserData, mappedWithName: NamedXmlBasedJson[]): RFunctionCall | undefined {
  const fnBase = mappedWithName[0]
  if(fnBase.name !== Type.Expression) {
    parseLog.trace(`expected function call name to be wrapped an expression, yet received ${JSON.stringify(fnBase)}`)
    return executeUnknownHook(data.hooks.functions.onFunctionCall.unknown, data, mappedWithName)
  }

  parseLog.trace(`trying to parse function call`)
  mappedWithName = executeHook(data.hooks.functions.onFunctionCall.before, data, mappedWithName)

  const {
    unwrappedObj, content, location
  } = retrieveMetaStructure(data.config, fnBase.content)
  const symbolContent: XmlBasedJson[] = getKeysGuarded(unwrappedObj, data.config.childrenName)
  if(symbolContent.map(x => getTokenType(data.config.tokenMap, x)).findIndex(x => x === Type.FunctionCall) < 0) {
    parseLog.trace(`expected function call to have corresponding symbol, yet received ${JSON.stringify(symbolContent)}`)
    return executeUnknownHook(data.hooks.functions.onFunctionCall.unknown, data, mappedWithName)
  }


  const functionName = tryParseSymbol(data, getWithTokenType(data.config.tokenMap, symbolContent))
  guard(functionName !== undefined, 'expected function name to be a symbol, yet received none')
  guard(functionName.type === Type.Symbol, () => `expected function name to be a symbol, yet received ${JSON.stringify(functionName)}`)

  const splitArgumentsOnComma = splitArrayOn(mappedWithName.slice(1), x => x.name === Type.Comma)
  const args: RNode[] = splitArgumentsOnComma.map(x => {
    const gotArguments = parseBasedOnType(data, x)
    guard(gotArguments.length < 2, () => `expected argument to be wrapped in expression, yet received ${JSON.stringify(gotArguments)}`)
    return gotArguments.length === 0 ? undefined : gotArguments[0]
  }).filter(isNotUndefined)

  const result: RFunctionCall = {
    type:      Type.FunctionCall,
    location,
    lexeme:    content,
    functionName,
    arguments: args,
    info:      {
      // TODO: include children etc.
      fullRange:        data.currentRange,
      additionalTokens: [],
      fullLexeme:       data.currentLexeme
    }
  }
  return executeHook(data.hooks.functions.onFunctionCall.after, data, result)
}
