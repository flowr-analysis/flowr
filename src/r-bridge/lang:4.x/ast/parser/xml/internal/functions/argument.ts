import { NamedXmlBasedJson } from '../../input-format'
import { parseLog } from '../../parser'
import { retrieveMetaStructure } from '../meta'
import { RNode, Type, RArgument } from '../../../../model'
import { ParserData } from '../../data'
import { executeHook, executeUnknownHook } from '../../hooks'
import { log } from '../../../../../../../util/log'
import { guard } from '../../../../../../../util/assert'
import { tryParseOneElementBasedOnType } from '../structure'

/**
 * Either parses `[SYMBOL_FORMALS]` or `[SYMBOL_FORMALS, EQ_FORMALS, expr]` as an argument in R.
 * Probably directly called by the function definition/call parser as otherwise, we do not expect to find arguments.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param objs - Either `[SYMBOL_FORMALS]` or `[SYMBOL_SUB, EQ_FORMALS, expr]`
 *
 * @returns The parsed argument or `undefined` if the given object is not an argument.
 */
export function tryToParseArgument(data: ParserData, objs: NamedXmlBasedJson[]): RArgument | undefined {
  parseLog.debug(`[argument] try: ${JSON.stringify(objs)}`)
  objs = executeHook(data.hooks.functions.onArgument.before, data, objs)

  if(objs.length !== 1 && objs.length !== 3) {
    log.warn(`Either [SYMBOL_FORMALS] or [SYMBOL_SUB, EQ_FORMALS, expr], but got: ${JSON.stringify(objs)}`)
    return executeUnknownHook(data.hooks.functions.onArgument.unknown, data, objs)
  }


  const symbol = objs[0]
  if(objs.length === 1 && symbol.name !== Type.SymbolFormals || objs.length === 3 && symbol.name !== Type.SymbolNamedFormals) {
    log.warn(`expected symbol for argument, yet received ${JSON.stringify(objs)}`)
    return executeUnknownHook(data.hooks.functions.onArgument.unknown, data, objs)
  }

  const defaultValue: RNode | undefined = objs.length === 3 ? parseWithDefaultValue(data, objs) : undefined

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
      info:      {
        fullRange:        location,
        additionalTokens: [],
        fullLexeme:       content
      }
    },
    defaultValue,
    info: {
      // TODO: add default value to both
      fullRange:        location,
      fullLexeme:       content,
      additionalTokens: []
    }
  }

  return executeHook(data.hooks.functions.onArgument.after, data, result)
}

function parseWithDefaultValue(data: ParserData, objs: NamedXmlBasedJson[]): RNode | undefined {
  guard(objs[1].name === Type.EqFormals, () => `[arg-default] second element of argument must be EQ_FORMALS, but: ${JSON.stringify(objs)}`)
  guard(objs[2].name === Type.Expression, () => `[arg-default] third element of argument must be an Expression but: ${JSON.stringify(objs)}`)
  return tryParseOneElementBasedOnType(data, objs[2])
}
