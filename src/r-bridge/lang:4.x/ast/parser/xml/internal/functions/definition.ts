import { ParserData } from '../../data'
import { NamedXmlBasedJson } from '../../input-format'
import { Type, RArgument, RFunctionDefinition } from '../../../../model'
import { parseLog } from '../../parser'
import { executeHook, executeUnknownHook } from '../../hooks'
import { retrieveMetaStructure } from '../meta'
import { guard, isNotUndefined } from '../../../../../../../util/assert'
import { splitArrayOn } from '../../../../../../../util/arrays'
import { parseBasedOnType } from '../structure'
import { tryToParseArgument } from './argument'
import { log } from '../../../../../../../util/log'

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

  const splitArguments = splitArrayOn(mappedWithName.slice(2, closingParenIndex), x => x.name === Type.Comma)

  parseLog.trace(`function definition has ${splitArguments.length} arguments (by comma split)`)

  const args: (undefined | RArgument)[] = splitArguments.map(x => tryToParseArgument(data, x))

  if(args.some(p => p === undefined)) {
    log.error(`function had unexpected unknown arguments: ${JSON.stringify(args.filter(isNotUndefined))}, aborting.`)
    return executeUnknownHook(data.hooks.functions.onFunctionDefinition.unknown, data, mappedWithName)
  }

  parseLog.trace(`function definition retained ${args.length} arguments after parsing, moving to body.`)

  const bodyStructure = mappedWithName.slice(closingParenIndex + 1)
  guard(bodyStructure.length === 1, () => `expected function body to be unique, yet received ${JSON.stringify(bodyStructure)}`)

  const body = parseBasedOnType(data, bodyStructure)
  guard(body.length === 1, () => `expected function body to yield one normalized expression, but ${JSON.stringify(body)}`)


  const result: RFunctionDefinition = {
    type:      Type.Function,
    location,
    lexeme:    content,
    arguments: args as RArgument[],
    body:      body[0],
    info:      {}
  }
  return executeHook(data.hooks.functions.onFunctionDefinition.after, data, result)
}
