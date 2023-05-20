import { ParserData } from '../../data'
import { NamedXmlBasedJson } from '../../input-format'
import { Type } from '../../../../model'
import { RFunctionDefinition } from '../../../../model/nodes/RFunctionDefinition'
import { parseLog } from '../../parser'
import { executeHook, executeUnknownHook } from '../../hooks'
import { retrieveMetaStructure } from '../meta'
import { exprList } from '../../../../../../../../test/helper/ast-builder'

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

  /*  const splitParametersOnComma = splitArrayOn(mappedWithName.slice(1), x => x.name === Type.Comma)
  const parameters: RNode[] = splitParametersOnComma.map(x => {
    const gotParameters = parseBasedOnType(data, x.map(x => x.content))
    guard(gotParameters.length < 2, () => `expected parameter to be wrapped in expression, yet received ${JSON.stringify(gotParameters)}`)
    return gotParameters.length === 0 ? undefined : gotParameters[0]
  }).filter(isNotUndefined)*/

  const result: RFunctionDefinition = {
    type:       Type.Function,
    location,
    lexeme:     content,
    parameters: [],
    body:       exprList(),
    info:       {}
  }
  return executeHook(data.hooks.functions.onFunctionDefinition.after, data, result)
}
