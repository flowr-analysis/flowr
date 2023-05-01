import { NamedXmlBasedJson } from '../../input-format'
import { guard } from '../../../../../../../util/assert'
import { retrieveMetaStructure } from '../meta'
import { parseLog } from '../../parser'
import { isSymbol, Type } from '../../../../model/type'
import { RSymbol } from '../../../../model/nodes/RSymbol'
import { ParserData } from '../../data'
import { executeHook, executeUnknownHook } from '../../hooks'

/**
 * Parse the given object as an R symbol (incorporating namespace information).
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param objs - the json object to extract the meta-information from
 *
 * @returns the parsed symbol (with populated namespace information) or `undefined` if the given object is not a symbol
 */
// TODO: deal with namespace information
export function tryParseSymbol(data: ParserData, objs: NamedXmlBasedJson[]): RSymbol | undefined {
  guard(objs.length > 0, 'to parse symbols we need at least one object to work on!')
  parseLog.debug(`trying to parse symbol with ${JSON.stringify(objs)}`)
  objs = executeHook(data.hooks.values.onSymbol.before, data, objs)

  let location, content, namespace

  if(objs.length === 1 && isSymbol(objs[0].name)) {
    const meta  = retrieveMetaStructure(data.config, objs[0].content)
    location    = meta.location
    content     = meta.content
    namespace   = undefined
  } else if(objs.length === 3 && isSymbol(objs[2].name)) {
    // TODO: guard etc.
    const meta  = retrieveMetaStructure(data.config, objs[2].content)
    location    = meta.location
    content     = meta.content
    namespace   = retrieveMetaStructure(data.config, objs[0].content).content
  } else {
    return executeUnknownHook(data.hooks.values.onSymbol.unknown, data, objs)
  }

  const result = {
    type:   Type.Symbol,
    namespace,
    location,
    content,
    // TODO: get correct lexeme from expr wrapper :C
    lexeme: content,
  }

  return executeHook(data.hooks.values.onSymbol.after, data, result)
}
