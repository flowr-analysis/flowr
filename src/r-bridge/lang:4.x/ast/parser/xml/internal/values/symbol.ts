import { NamedXmlBasedJson } from '../../input-format'
import { guard } from '../../../../../../../util/assert'
import { retrieveMetaStructure } from '../meta'
import { parseLog } from '../../parser'
import { XmlParserConfig } from '../../config'
import { isSymbol, Type } from '../../../../model/type'
import { RSymbol } from '../../../../model/nodes/RSymbol'

/**
 * Parse the given object as an R symbol (incorporating namespace information).
 *
 * @param config - the configuration of the parser to use to retrieve the corresponding name fields
 * @param obj - the json object to extract the meta-information from
 *
 * @returns the parsed symbol (with populated namespace information) or `undefined` if the given object is not a symbol
 */
// TODO: deal with namespace information
export function parseSymbol(config: XmlParserConfig, obj: NamedXmlBasedJson[]): RSymbol | undefined {
  guard(obj.length > 0, 'to parse symbols we need at least one object to work on!')
  parseLog.debug(`trying to parse symbol with ${JSON.stringify(obj)}`)

  let location, content, namespace

  if(obj.length === 1 && isSymbol(obj[0].name)) {
    const data  = retrieveMetaStructure(config, obj[0].content)
    location    = data.location
    content     = data.content
    namespace   = undefined
  } else if(obj.length === 3 && isSymbol(obj[2].name)) {
    // TODO: guard etc.
    const data  = retrieveMetaStructure(config, obj[2].content)
    location    = data.location
    content     = data.content
    namespace   = retrieveMetaStructure(config, obj[0].content).content
  } else {
    return undefined
  }

  return {
    type:   Type.Symbol,
    namespace,
    location,
    content,
    // TODO: get correct lexeme from expr wrapper :C
    lexeme: content,
  }
}
