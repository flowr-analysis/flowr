import { getKeysGuarded, NamedXmlBasedJson, XmlBasedJson } from '../../input-format'
import { guard } from '../../../../../../../util/assert'
import { getWithTokenType, retrieveMetaStructure } from '../meta'
import { splitArrayOn } from '../../../../../../../util/arrays'
import { parseLog } from '../../parser'
import { tryParseSymbol } from '../values'
import { ParserData } from '../../data'
import { Type, RNode, RFunctionCall, RUnnamedFunctionCall, RNamedFunctionCall } from '../../../../model'
import { executeHook, executeUnknownHook } from '../../hooks'
import { tryToParseArgument } from './argument'
import { SourceRange } from '../../../../../../../util/range'
import { parseExpression } from '../expression'

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
    parseLog.trace('expected function call name to be wrapped an expression, yet received ${fnBase.name}')
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
    parseLog.trace(`is not named function call, as the name is not of type ${Type.FunctionCall}, but: ${namedSymbolContent.map(n => n.name).join(',')}`)
    const mayResult = tryParseUnnamedFunctionCall(data, mappedWithName, location, content)
    if(mayResult === undefined) {
      return executeUnknownHook(data.hooks.functions.onFunctionCall.unknown, data, mappedWithName)
    }
    result = mayResult
  } else {
    result = parseNamedFunctionCall(data, symbolContent, mappedWithName, location, content)
  }

  return executeHook(data.hooks.functions.onFunctionCall.after, data, result)
}

function parseArguments(mappedWithName: NamedXmlBasedJson[], data: ParserData): (RNode| undefined)[] {
  const argContainer = mappedWithName.slice(1)
  guard(argContainer.length > 1 && argContainer[0].name === Type.ParenLeft && argContainer[argContainer.length - 1].name === Type.ParenRight, `expected args in parenthesis, but ${JSON.stringify(argContainer)}`)
  const splitArgumentsOnComma = splitArrayOn(argContainer.slice(1, argContainer.length - 1), x => x.name === Type.Comma)
  return  splitArgumentsOnComma.map(x => {
    // TODO: improve expression unwrap
    parseLog.trace('trying to parse argument')
    return tryToParseArgument(data, x)
  })
}

function tryParseUnnamedFunctionCall(data: ParserData, mappedWithName: NamedXmlBasedJson[], location: SourceRange, content: string): RUnnamedFunctionCall | undefined {
  // maybe remove symbol-content again because i just use the root expr of mapped with name
  if(mappedWithName.length < 3) {
    parseLog.trace('expected unnamed function call to have 3 elements [like (<func>)], but was not')
    return undefined
  }
  if(mappedWithName[1].name !== Type.ParenLeft || mappedWithName[mappedWithName.length - 1].name !== Type.ParenRight) {
    parseLog.trace(`expected unnamed function call to have parenthesis for a call, but was not`)
    return undefined
  }

  parseLog.trace('Assuming structure to be a function call')

  // we parse an expression to allow function calls
  const calledFunction = parseExpression(data, mappedWithName[0].content)
  const parsedArguments = parseArguments(mappedWithName, data)

  return {
    type:           Type.FunctionCall,
    flavour:        'unnamed',
    location,
    lexeme:         content,
    calledFunction: calledFunction,
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
  guard(functionName.type === Type.Symbol, () => `expected function name to be a symbol, yet received ${functionName.type}`)

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
