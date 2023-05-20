import { ParserData } from '../../data'
import { NamedXmlBasedJson } from '../../input-format'
import { RNode, Type } from '../../../../model'
import { RFunctionDefinition } from '../../../../model/nodes/RFunctionDefinition'
import { parseLog } from '../../parser'
import { executeHook, executeUnknownHook } from '../../hooks'
import { retrieveMetaStructure } from '../meta'
import { guard, isNotUndefined } from '../../../../../../../util/assert'
import { splitArrayOn } from '../../../../../../../util/arrays'
import { parseBasedOnType } from '../structure'

/**
 * Tries to parse the given data as a function definition.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param mappedWithName - The json object to extract the meta-information from
 *
 * @returns The parsed {@link RFunctionDefinition} or `undefined` if the given construct is not a function definition
 */
export function tryToParseFunctionDefinition(data: ParserData, mappedWithName: NamedXmlBasedJson[]): RFunctionDefinition | undefined {
  const fnBase = mappedWithName[0]
  if(fnBase.name !== Type.Function) {
    parseLog.trace(`expected function definition to be identified by keyword, yet received ${JSON.stringify(fnBase)}`)
    return executeUnknownHook(data.hooks.functions.onFunctionDefinition.unknown, data, mappedWithName)
  }

  parseLog.trace(`trying to parse function definition`)
  mappedWithName = executeHook(data.hooks.functions.onFunctionDefinition.before, data, mappedWithName)

  const { content, location } = retrieveMetaStructure(data.config, fnBase.content)

  const openParen = mappedWithName[1]
  guard(openParen.name === Type.ParenLeft, () => `expected opening parenthesis, yet received ${JSON.stringify(openParen)}`)

  const closingParenIndex = mappedWithName.findIndex(x => x.name === Type.ParenRight)
  guard(closingParenIndex !== -1, () => `expected closing parenthesis, yet received ${JSON.stringify(mappedWithName)}`)

  const splitParameters = splitArrayOn(mappedWithName.slice(2, closingParenIndex), x => x.name === Type.Comma)

  parseLog.trace(`function definition has ${splitParameters.length} parameters (by comma split)`)

  const parameters: RNode[] = splitParameters.map(x => {
    const gotParameters = parseBasedOnType(data, x.map(x => x.content))
    guard(gotParameters.length < 2, () => `expected parameter to be wrapped in expression, yet received ${JSON.stringify(gotParameters)}`)
    return gotParameters.length === 0 ? undefined : gotParameters[0]
  }).filter(isNotUndefined)

  parseLog.trace(`function definition retained ${parameters.length} parameters after parsing, moving to body.`)

  const bodyStructure = mappedWithName.slice(closingParenIndex + 1)
  guard(bodyStructure.length === 1, () => `expected function body to be unique, yet received ${JSON.stringify(bodyStructure)}`)

  const body = parseBasedOnType(data, bodyStructure.map(b => b.content))
  guard(body.length === 1, () => `expected function body to yield one normalized expression, but ${JSON.stringify(body)}`)


  const result: RFunctionDefinition = {
    type:   Type.Function,
    location,
    lexeme: content,
    parameters,
    body:   body[0],
    info:   {}
  }
  return executeHook(data.hooks.functions.onFunctionDefinition.after, data, result)
}
