import { XmlBasedJson } from '../../input-format'
import { RComment, Type } from '../../../../model'
import { parseLog } from '../../parser'
import { retrieveMetaStructure } from '../meta'
import { guard } from '../../../../../../../util/assert'
import { executeHook } from '../../hooks'
import { ParserData } from '../../data'

/**
 * Parse the given object as an R comment.
 * This requires you to check the corresponding name beforehand.
 *
 * @param data - The data used by the parser (see {@link ParserData})
 * @param obj - the json object to extract the meta-information from
 */
export function parseComment(data: ParserData, obj: XmlBasedJson): RComment {
  parseLog.debug(`[comment] try: ${JSON.stringify(obj)}`)
  obj = executeHook(data.hooks.other.onComment.before, data, obj)

  const { location, content } = retrieveMetaStructure(data.config, obj)
  guard(content.startsWith('#'), 'comment must start with #')

  const result: RComment = {
    type:    Type.Comment,
    location,
    content: content.slice(1),
    lexeme:  content
  }
  return executeHook(data.hooks.other.onComment.after, data, result)
}
