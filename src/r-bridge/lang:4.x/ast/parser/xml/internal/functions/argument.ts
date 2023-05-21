import { NamedXmlBasedJson } from '../../input-format'
import { parseLog } from '../../parser'
import { retrieveMetaStructure } from '../meta'
import { Type } from '../../../../model'
import { ParserData } from '../../data'
import { executeHook, executeUnknownHook } from '../../hooks'
import { RArgument } from '../../../../model/nodes/RArgument'
import { log } from '../../../../../../../util/log'

/**
 * Either parses `[SYMBOL_FORMALS]` or `[SYMBOL_FORMALS, EQ_FORMALS, expr]` as a argument in R.
 * Probably directly called by the function definition/call parser as otherwise, we do not expect to find arguments.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param objs - Either `[SYMBOL_FORMALS]` or `[SYMBOL_FORMALS, EQ_FORMALS, expr]`
 *
 * @returns The parsed argument or `undefined` if the given object is not a argument.
 */
export function tryToParseArgument(data: ParserData, objs: NamedXmlBasedJson[]): RArgument | undefined {
  parseLog.debug(`[argument] try: ${JSON.stringify(objs)}`)
  objs = executeHook(data.hooks.functions.onArgument.before, data, objs)

  if(objs.length !== 1 && objs.length !== 3) {
    log.warn(`Either [SYMBOL_FORMALS] or [SYMBOL_FORMALS, EQ_FORMALS, expr], but got: ${JSON.stringify(objs)}`)
    return executeUnknownHook(data.hooks.functions.onArgument.unknown, data, objs)
  }


  const symbol = objs[0]

  const { location, content } = retrieveMetaStructure(data.config, symbol.content)

  const result: RArgument = {
    type:    Type.Argument,
    location,
    content,
    special: content === '...',
    lexeme:  content,
    name:    {
      type:      Type.Symbol,
      location, content,
      namespace: undefined,
      lexeme:    content,
      info:      {}
    },
    defaultValue: undefined /* TODO */,
    info:         {}
  }

  return executeHook(data.hooks.functions.onArgument.after, data, result)
}
