import { NamedXmlBasedJson } from '../../input-format'
import { parseLog } from '../../parser'
import { retrieveMetaStructure } from '../meta'
import { RNode, Type, RSymbol } from '../../../../model'
import { ParserData } from '../../data'
import { executeHook, executeUnknownHook } from '../../hooks'
import { log } from '../../../../../../../util/log'
import { guard } from '../../../../../../../util/assert'
import { tryParseOneElementBasedOnType } from '../structure'
import { RArgument } from '../../../../model/nodes/RArgument'

/**
 * Either parses `[expr]` or `[SYMBOL_SUB, EQ_SUB, expr]` as an argument of a function call in R.
 * Probably directly called by the function call parser as otherwise, we do not expect to find arguments.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param objs - Either `[expr]` or `[SYMBOL_FORMALS, EQ_FORMALS, expr]`
 *
 * @returns The parsed argument or `undefined` if the given object is not an argument.
 */
export function tryToParseArgument(data: ParserData, objs: NamedXmlBasedJson[]): RArgument | undefined {
  parseLog.debug(`[argument] try: ${JSON.stringify(objs)}`)
  objs = executeHook(data.hooks.functions.onArgument.before, data, objs)

  if(objs.length !== 1 && objs.length !== 3) {
    log.warn(`Either [expr] or [SYMBOL_SUB, EQ_SUB, expr], but got: ${JSON.stringify(objs)}`)
    return executeUnknownHook(data.hooks.functions.onArgument.unknown, data, objs)
  }


  const symbolOrExpr = objs[0]
  const { location, content } = retrieveMetaStructure(data.config, symbolOrExpr.content)

  let parsedValue: RNode | undefined
  let name: RSymbol | undefined
  if(symbolOrExpr.name === Type.Expression) {
    name = undefined
    parsedValue = tryParseOneElementBasedOnType(data, symbolOrExpr)
  } else if(symbolOrExpr.name === Type.SymbolNamedFormals) {
    name =    {
      type:      Type.Symbol,
      location, content,
      namespace: undefined,
      lexeme:    content,
      info:      {
        fullRange:        location,
        additionalTokens: [],
        fullLexeme:       content
      }
    }
    parsedValue = parseWithValue(data, objs)
  } else {
    log.warn(`expected symbol or expr for argument, yet received ${JSON.stringify(objs)}`)
    return executeUnknownHook(data.hooks.functions.onArgument.unknown, data, objs)
  }


  const result: RArgument = {
    type:   Type.Argument,
    location,
    content,
    lexeme: content,
    name,
    value:  parsedValue,
    info:   {
      // TODO:correct values
      fullRange:        location,
      fullLexeme:       content,
      additionalTokens: []
    }
  }

  return executeHook(data.hooks.functions.onArgument.after, data, result)
}

function parseWithValue(data: ParserData, objs: NamedXmlBasedJson[]): RNode | undefined {
  guard(objs[1].name === Type.EqNamedArgument, () => `[arg-default] second element of parameter must be ${Type.EqNamedArgument}, but: ${JSON.stringify(objs)}`)
  guard(objs[2].name === Type.Expression, () => `[arg-default] third element of parameter must be an Expression but: ${JSON.stringify(objs)}`)
  return tryParseOneElementBasedOnType(data, objs[2])
}
