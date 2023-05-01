import { XmlParserConfig } from '../../config'
import { XmlBasedJson } from '../../input-format'
import { RComment } from '../../../../model/nodes/RComment'
import { parseLog } from '../../parser'
import { retrieveMetaStructure } from '../meta'
import { Type } from '../../../../model/type'
import { guard } from '../../../../../../../util/assert'

/**
 * Parse the given object as an R comment.
 * This requires you to check the corresponding name beforehand.
 *
 * @param config - the configuration of the parser to use to retrieve the corresponding name fields
 * @param obj - the json object to extract the meta-information from
 */
export function parseComment(config: XmlParserConfig, obj: XmlBasedJson): RComment {
  parseLog.debug(`[comment] try: ${JSON.stringify(obj)}`)
  const { location, content } = retrieveMetaStructure(config, obj)
  guard(content.startsWith('#'), 'comment must start with #')

  return {
    type:    Type.Comment,
    location,
    content: content.slice(1),
    lexeme:  content
  }
}
