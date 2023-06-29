import { getKeysGuarded, NamedXmlBasedJson, XmlBasedJson } from '../../input-format'
import { guard, isNotUndefined } from '../../../../../../../util/assert'
import { getWithTokenType, retrieveMetaStructure } from '../meta'
import { splitArrayOn } from '../../../../../../../util/arrays'
import { parseLog } from '../../parser'
import { tryParseSymbol } from '../values'
import { ParserData } from '../../data'
import { Type, RNode, RFunctionCall, RUnnamedFunctionCall, RNamedFunctionCall } from '../../../../model'
import { executeHook, executeUnknownHook } from '../../hooks'
import { tryToParseArgument } from './argument'
import { SourceRange } from '../../../../../../../util/range'
import { parseBasedOnType } from '../structure'

/**
 * Tries to parse the given data as a function call.
 *
 * @param data           - The data used by the parser (see {@link ParserData})
 * @param mappedWithName - The json object to extract the meta-information from
 *
 * @returns The parsed {@link RFunctionCall} (either named or unnamed) or `undefined` if the given construct is not a function call
 */
export function tryToParseFunctionCall(data: ParserData, mappedWithName: NamedXmlBasedJson[]): RFunctionCall | undefined {
  const fnBase = mappedWithName[0]
  if(fnBase.name !== Type.Expression) {
    parseLog.trace(`expected function call name to be wrapped an expression, yet received ${JSON.stringify(fnBase)}`)
    return executeUnknownHook(data.hooks.functions.onFunctionCall.unknown, data, mappedWithName)
  }

  parseLog.trace('trying to parse function call')
  mappedWithName = executeHook(data.hooks.functions.onFunctionCall.before, data, mappedWithName)

  const {
    unwrappedObj, content, location
  } = retrieveMetaStructure(data.config, fnBase.content)
  const symbolContent: XmlBasedJson[] = getKeysGuarded(unwrappedObj, data.config.childrenName)

  let result: RFunctionCall

  const namedSymbolContent = getWithTokenType(data.config.tokenMap, symbolContent)
  if(namedSymbolContent.findIndex(x => x.name === Type.FunctionCall) < 0) {
    parseLog.trace(`is not named function call, as the name is not of type ${Type.FunctionCall}`)
    const mayResult = tryParseUnnamedFunctionCall(data, namedSymbolContent, mappedWithName, location, content)
    if(mayResult === undefined) {
      return executeUnknownHook(data.hooks.functions.onFunctionCall.unknown, data, mappedWithName)
    }
    result = mayResult
  } else {
    result = parseNamedFunctionCall(data, symbolContent, mappedWithName, location, content)
  }

  return executeHook(data.hooks.functions.onFunctionCall.after, data, result)
}

function parseArguments(mappedWithName: NamedXmlBasedJson[], data: ParserData) {
  const argContainer = mappedWithName.slice(1)
  guard(argContainer.length > 1 && argContainer[0].name === Type.ParenLeft && argContainer[argContainer.length - 1].name === Type.ParenRight, `expected args in parenthesis, but ${JSON.stringify(argContainer)}`)
  const splitArgumentsOnComma = splitArrayOn(argContainer.slice(1, argContainer.length - 1), x => x.name === Type.Comma)
  const parsedArguments: RNode[] = splitArgumentsOnComma.map(x => {
    // guard(x.length === 1, `expected argument to be a single element wrapped in an expression, yet received ${JSON.stringify(x)}`)
    // TODO: improve expression unwrap
    parseLog.trace('trying to parse argument')
    const gotArgument = tryToParseArgument(data, x)
    guard(gotArgument !== undefined, () => `expected one argument result in argumentlist, yet received ${JSON.stringify(gotArgument)}`)
    return gotArgument
  }).filter(isNotUndefined)
  return parsedArguments
}

function tryParseUnnamedFunctionCall(data: ParserData, symbolContent: NamedXmlBasedJson[], mappedWithName: NamedXmlBasedJson[], location: SourceRange, content: string): RUnnamedFunctionCall | undefined {
  if(symbolContent.length !== 3 || mappedWithName.length !== 3) {
    parseLog.trace(`expected unnamed function call to have 3 elements [like (<func>)], yet received ${JSON.stringify(symbolContent)}`)
    return undefined
  }
  if(mappedWithName[1].name !== Type.ParenLeft || mappedWithName[mappedWithName.length - 1].name !== Type.ParenRight) {
    parseLog.trace(`expected unnamed function call to have parenthesis for a call, yet received ${JSON.stringify(mappedWithName)}`)
    return undefined
  }

  parseLog.trace('Assuming structure to be a function call')
  const calledFunction = parseBasedOnType(data, symbolContent)
  if(calledFunction.length !== 1) {
    parseLog.warn(`expected unnamed function call to yield one element - the definition, yet received ${JSON.stringify(calledFunction)}`)
    return undefined
  }
  const parsedArguments = parseArguments(mappedWithName, data)

  return {
    type:           Type.FunctionCall,
    flavour:        'unnamed',
    location,
    lexeme:         content,
    calledFunction: calledFunction[0],
    arguments:      parsedArguments,
    info:           {
      // TODO: include children etc.
      fullRange:        data.currentRange,
      additionalTokens: [],
      fullLexeme:       data.currentLexeme
    }
  }
}


function parseNamedFunctionCall(data: ParserData, symbolContent: XmlBasedJson[], mappedWithName: NamedXmlBasedJson[], location: SourceRange, content: string): RNamedFunctionCall {
  const functionName = tryParseSymbol(data, getWithTokenType(data.config.tokenMap, symbolContent))
  guard(functionName !== undefined, 'expected function name to be a symbol, yet received none')
  guard(functionName.type === Type.Symbol, () => `expected function name to be a symbol, yet received ${JSON.stringify(functionName)}`)

  const parsedArguments = parseArguments(mappedWithName, data)

  return {
    type:      Type.FunctionCall,
    flavour:   'named',
    location,
    lexeme:    content,
    functionName,
    arguments: parsedArguments,
    info:      {
      // TODO: include children etc.
      fullRange:        data.currentRange,
      additionalTokens: [],
      fullLexeme:       data.currentLexeme
    }
  }
}
